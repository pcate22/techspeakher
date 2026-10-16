import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { schemaForPgMem } from "./schema-pgmem";

/**
 * LA CONSERVATION DES COMPTES, éprouvée contre le `db/schema.sql` réel
 * (`pg-mem`). C'est le seul geste IRRÉVERSIBLE que le produit exécute tout seul :
 * il mérite la couche de test la plus proche de la base, et chaque exclusion y a
 * son cas — une exclusion oubliée supprime quelqu'un qu'on avait promis
 * d'épargner (`docs/principes-tests.md` § 5).
 */

const h = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { newDb } = require("pg-mem");
  const mem = newDb();
  const pg = mem.adapters.createPg();
  const pool = new pg.Pool();
  return { mem, pool };
});

vi.mock("@/lib/db", () => ({ pool: h.pool }));

import {
  comptesAAvertir,
  comptesASupprimer,
  marquerAvertissement,
  toucherSigneDeVie,
  ilYA,
} from "@/lib/comptes-inactifs";

let backup: { restore: () => void };

beforeAll(() => {
  h.mem.public.none(schemaForPgMem());
  backup = h.mem.backup();
});

beforeEach(() => backup.restore());

const INACTIVITE = 730;
const PREAVIS = 30;

/** Un compte, avec ce qui décide de son sort. */
async function compte(opts: {
  nom: string;
  vuIlYA?: number | null;
  email?: string | null;
  orga?: boolean;
  coach?: boolean;
  avertiIlYA?: number;
  ficheMajIlYA?: number;
  adhesion?: { finieDansJours: number; status?: string };
}): Promise<number> {
  const { rows } = await h.pool.query(
    `INSERT INTO users (name, email, is_orga, is_coach, last_seen_at, suppression_annoncee_le)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [
      opts.nom,
      opts.email === undefined ? `${opts.nom.toLowerCase()}@test.fr` : opts.email,
      opts.orga ?? false,
      opts.coach ?? false,
      opts.vuIlYA == null ? null : ilYA(opts.vuIlYA),
      opts.avertiIlYA === undefined ? null : ilYA(opts.avertiIlYA),
    ],
  );
  const id = rows[0].id as number;
  if (opts.ficheMajIlYA !== undefined) {
    await h.pool.query(
      `INSERT INTO speaker_profiles ("userId", updated_at) VALUES ($1, $2)`,
      [id, ilYA(opts.ficheMajIlYA)],
    );
  }
  if (opts.adhesion) {
    await h.pool.query(
      `INSERT INTO user_memberships ("userId", expires_at, status) VALUES ($1, $2, $3)`,
      [id, ilYA(-opts.adhesion.finieDansJours), opts.adhesion.status ?? "active"],
    );
  }
  return id;
}

const noms = (l: { name: string | null }[]) => l.map((c) => c.name);

describe("comptesAAvertir — qui entre dans le champ", () => {
  it("retient un compte sans passage depuis deux ans", async () => {
    await compte({ nom: "Dormante", vuIlYA: 800 });
    await compte({ nom: "Active", vuIlYA: 10 });
    expect(noms(await comptesAAvertir(INACTIVITE))).toEqual(["Dormante"]);
  });

  it("compte une fiche qui a bougé comme un signe de vie", async () => {
    // Elle ne s'est pas reconnectée, mais sa fiche a été modifiée : la session
    // JWT vit longtemps, on serait passé à côté de quelqu'un d'actif.
    await compte({ nom: "Ecrit", vuIlYA: 800, ficheMajIlYA: 100 });
    await compte({ nom: "Dort", vuIlYA: 800, ficheMajIlYA: 900 });
    expect(noms(await comptesAAvertir(INACTIVITE))).toEqual(["Dort"]);
  });

  it("laisse de côté un compte injoignable (adresse absente ou .invalid)", async () => {
    // On ne supprime jamais quelqu'un qu'on n'a pas pu avertir.
    await compte({ nom: "Sans", vuIlYA: 800, email: null });
    await compte({ nom: "Factice", vuIlYA: 800, email: "f@techspeakher.invalid" });
    expect(await comptesAAvertir(INACTIVITE)).toEqual([]);
  });

  it("laisse de côté les orgas et les coachs", async () => {
    await compte({ nom: "Orga", vuIlYA: 800, orga: true });
    await compte({ nom: "Coach", vuIlYA: 800, coach: true });
    expect(await comptesAAvertir(INACTIVITE)).toEqual([]);
  });

  it("laisse de côté une adhérente à jour, retient une adhésion expirée", async () => {
    // La base de conservation est l'adhésion, pas l'usage de la plateforme.
    // « Resiliee » : statut posé à la main AVANT le terme (la liste est fermée
    // par la 073, `expired` est le seul statut non actif possible) — le statut
    // périmé compte indépendamment des dates. Le cas suivant montre pourquoi
    // cette lecture est en liste blanche et non en négatif.
    await compte({ nom: "Ajour", vuIlYA: 800, adhesion: { finieDansJours: 200 } });
    await compte({ nom: "Expiree", vuIlYA: 800, adhesion: { finieDansJours: -100 } });
    await compte({
      nom: "Resiliee",
      vuIlYA: 800,
      adhesion: { finieDansJours: 200, status: "expired" },
    });
    expect(noms(await comptesAAvertir(INACTIVITE))).toEqual(["Expiree", "Resiliee"]);
  });

  it("un statut d'adhésion INCONNU épargne le compte, il ne le condamne pas", async () => {
    // Le commentaire ci-dessus s'appuyait sur le CHECK de la 073 pour lire le
    // statut EN NÉGATIF (« expired est le seul statut non actif possible »).
    // C'est vrai de la valeur illisible d'aujourd'hui, faux du statut qu'on
    // ajoutera légitimement demain : lu en négatif, il aurait rangé ces comptes
    // du côté de la SUPPRESSION, en silence. La lecture est donc en liste
    // blanche, et c'est ce que ce cas garde.
    //
    // On retire la contrainte le temps d'écrire la ligne, pour jouer l'état
    // d'une base d'AVANT la 073 — ou d'un statut ajouté au modèle sans qu'on
    // relise ce filtre. Le `backup.restore()` du `beforeEach` la remet pour les
    // cas suivants (la remettre ici lèverait, la ligne étant encore là).
    h.mem.public.none(
      `ALTER TABLE user_memberships DROP CONSTRAINT user_memberships_status_ck`,
    );
    await compte({
      nom: "Suspendue",
      vuIlYA: 800,
      adhesion: { finieDansJours: 200, status: "suspended" },
    });

    expect(noms(await comptesAAvertir(INACTIVITE))).toEqual([]);
  });

  it("épargne un compte JAMAIS MESURÉ (mesure absente ≠ inactivité prouvée)", async () => {
    // Le cas qui a failli coûter cher : un compte créé par une voie qui ne
    // passe pas par la connexion (invitation Tremplin, rattachement orga)
    // naissait sans `last_seen_at`. Lu comme « dormant depuis toujours », il
    // recevait l'avertissement au premier passage du cron et disparaissait
    // trente et un jours plus tard. La colonne a un DEFAULT ; ceci garde le cas
    // où une ligne arriverait quand même sans mesure.
    await compte({ nom: "Jamais mesuree", vuIlYA: null });
    expect(await comptesAAvertir(INACTIVITE)).toEqual([]);
    expect(await comptesASupprimer(INACTIVITE, PREAVIS)).toEqual([]);
  });

  it("laisse de côté un compte déjà averti (aucun second envoi)", async () => {
    await compte({ nom: "Avertie", vuIlYA: 800, avertiIlYA: 3 });
    expect(await comptesAAvertir(INACTIVITE)).toEqual([]);
  });
});

describe("comptesASupprimer — le préavis est un verrou, pas une formalité", () => {
  it("refuse un compte jamais averti, même très ancien", async () => {
    // LA garde principale : aucune suppression sans avertissement envoyé.
    await compte({ nom: "Jamais", vuIlYA: 3000 });
    expect(await comptesASupprimer(INACTIVITE, PREAVIS)).toEqual([]);
  });

  it("refuse un compte averti trop récemment", async () => {
    await compte({ nom: "Hier", vuIlYA: 800, avertiIlYA: 2 });
    expect(await comptesASupprimer(INACTIVITE, PREAVIS)).toEqual([]);
  });

  it("retient un compte averti il y a plus que le préavis", async () => {
    await compte({ nom: "Echue", vuIlYA: 800, avertiIlYA: 40 });
    expect(noms(await comptesASupprimer(INACTIVITE, PREAVIS))).toEqual(["Echue"]);
  });

  it("épargne celle qui est revenue entre l'avertissement et l'échéance", async () => {
    const id = await compte({ nom: "Revenue", vuIlYA: 800, avertiIlYA: 40 });
    expect(noms(await comptesASupprimer(INACTIVITE, PREAVIS))).toEqual(["Revenue"]);
    await toucherSigneDeVie(id);
    expect(await comptesASupprimer(INACTIVITE, PREAVIS)).toEqual([]);
    // Et elle ne repart pas non plus dans la file d'avertissement.
    expect(await comptesAAvertir(INACTIVITE)).toEqual([]);
  });

  it("garde les mêmes exclusions que l'avertissement", async () => {
    // Une exclusion oubliée dans CETTE branche supprimerait quelqu'un qu'on
    // avait promis d'épargner : les deux lectures partagent la clause.
    await compte({ nom: "Orga", vuIlYA: 800, avertiIlYA: 40, orga: true });
    await compte({
      nom: "Ajour",
      vuIlYA: 800,
      avertiIlYA: 40,
      adhesion: { finieDansJours: 200 },
    });
    await compte({ nom: "Factice", vuIlYA: 800, avertiIlYA: 40, email: "f@x.invalid" });
    expect(await comptesASupprimer(INACTIVITE, PREAVIS)).toEqual([]);
  });
});

describe("un avertissement périmé ne vaut pas préavis", () => {
  it("refuse de supprimer sur la foi d'une annonce trop ancienne", async () => {
    // On sort du champ autrement qu'en se réveillant (une adhésion saisie par
    // une orga, un rôle accordé), puis on y revient : l'annonce d'il y a deux
    // ans traînait, et la suppression tombait au premier passage — sans aucun
    // préavis.
    await compte({ nom: "Oubliee", vuIlYA: 800, avertiIlYA: 400 });
    expect(await comptesASupprimer(INACTIVITE, PREAVIS)).toEqual([]);
  });

  it("la renvoie se faire avertir plutôt que de la laisser en suspens", async () => {
    // Sans cette porte, elle serait ni supprimable ni réavertissable :
    // « avertie une fois, jamais supprimée » — l'apparence de la conformité.
    await compte({ nom: "Oubliee", vuIlYA: 800, avertiIlYA: 400 });
    expect(noms(await comptesAAvertir(INACTIVITE))).toEqual(["Oubliee"]);
  });

  it("laisse tranquille une annonce encore valide et non échue", async () => {
    await compte({ nom: "Recente", vuIlYA: 800, avertiIlYA: 5 });
    expect(await comptesAAvertir(INACTIVITE)).toEqual([]);
    expect(await comptesASupprimer(INACTIVITE, PREAVIS)).toEqual([]);
  });
});

describe("l'avertissement ne prolonge pas le sursis", () => {
  it("le compteur suit le signe de vie, jamais la date d'envoi", async () => {
    // Si l'avertissement remettait le compteur à zéro, l'horloge ne tournerait
    // jamais et la règle serait décorative.
    const id = await compte({ nom: "Dormante", vuIlYA: 800 });
    await marquerAvertissement(id);
    const { rows } = await h.pool.query(
      `SELECT last_seen_at, suppression_annoncee_le FROM users WHERE id = $1`,
      [id],
    );
    expect(new Date(rows[0].last_seen_at).getTime()).toBeLessThan(
      ilYA(700).getTime(),
    );
    expect(rows[0].suppression_annoncee_le).toBeTruthy();
  });

  it("marque uniquement les comptes qu'on lui donne", async () => {
    const a = await compte({ nom: "A", vuIlYA: 800 });
    await compte({ nom: "B", vuIlYA: 800 });
    await marquerAvertissement(a);
    expect(noms(await comptesAAvertir(INACTIVITE))).toEqual(["B"]);
  });
});

describe("toucherSigneDeVie — mesurer sans écrire à chaque page", () => {
  it("horodate le passage et efface l'avertissement", async () => {
    const id = await compte({ nom: "Revenue", vuIlYA: 800, avertiIlYA: 40 });
    expect(await toucherSigneDeVie(id)).toBe(true);
    const { rows } = await h.pool.query(
      `SELECT last_seen_at, suppression_annoncee_le FROM users WHERE id = $1`,
      [id],
    );
    expect(rows[0].suppression_annoncee_le).toBeNull();
    expect(new Date(rows[0].last_seen_at).getTime()).toBeGreaterThan(
      ilYA(1).getTime(),
    );
  });

  it("se tait quand le passage est déjà récent (une écriture par semaine)", async () => {
    // Le callback jwt tourne à chaque rafraîchi de jeton : sans cette borne, on
    // écrirait en base à chaque page.
    const id = await compte({ nom: "Hier", vuIlYA: 1 });
    expect(await toucherSigneDeVie(id)).toBe(false);
  });

  it("écrit de nouveau une fois la semaine passée", async () => {
    const id = await compte({ nom: "Vieille", vuIlYA: 10 });
    expect(await toucherSigneDeVie(id)).toBe(true);
  });

  it("ne touche QUE le compte visé", async () => {
    const a = await compte({ nom: "A", vuIlYA: 800, avertiIlYA: 40 });
    const b = await compte({ nom: "B", vuIlYA: 800, avertiIlYA: 40 });
    await toucherSigneDeVie(a);
    const { rows } = await h.pool.query(
      `SELECT suppression_annoncee_le FROM users WHERE id = $1`,
      [b],
    );
    expect(rows[0].suppression_annoncee_le).toBeTruthy();
  });
});
