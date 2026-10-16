// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

/**
 * Intégration BDD du lot N4 (Bravo 👏) : un geste nominatif par membre et par
 * carte du fil, posé par INTENTION (idempotent), borné aux cartes VISIBLES et
 * jamais la sienne — mais TOUJOURS retirable (la base légale RGPD en dépend).
 * Le retrait rétroactif PURGE (fiche retirée, contenu dépublié), les cascades
 * font le reste. Vrai Postgres (PGlite) + db/schema.sql.
 */
const h = vi.hoisted(() => {
  const holder: { db: import("@electric-sql/pglite").PGlite | null } = { db: null };
  const pool = {
    query: async (text: string, params?: unknown[]) => {
      const r = await holder.db!.query(text, params);
      return { ...r, rowCount: (r as { affectedRows?: number }).affectedRows };
    },
  };
  return { holder, pool };
});
vi.mock("@/lib/db", () => ({
  pool: h.pool,
  // Une VRAIE transaction (PGlite est un vrai Postgres) : l'atomicité des
  // purges se teste, elle ne se déclare pas.
  withTransaction: async (fn: (client: unknown) => Promise<unknown>) => {
    await h.pool.query("BEGIN");
    try {
      const r = await fn(h.pool);
      await h.pool.query("COMMIT");
      return r;
    } catch (e) {
      await h.pool.query("ROLLBACK");
      throw e;
    }
  },
  withTransactionSaufTable: async (
    _table: string,
    fn: (q: unknown, avec: boolean) => Promise<unknown>,
  ) => {
    await h.pool.query("BEGIN");
    try {
      const r = await fn(h.pool, true);
      await h.pool.query("COMMIT");
      return r;
    } catch (e) {
      await h.pool.query("ROLLBACK");
      throw e;
    }
  },
}));
vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/auth";
import { poserReaction, retirerReaction, getReactionsPourFil } from "@/lib/reactions";
import { withdrawOwnProfile, setProfileStatus, submitForValidation } from "@/lib/profiles";
import { setStatut, updateContenu } from "@/lib/contenus";
import { carteScene, carteVenue, carteAsso, type CarteFil } from "@/lib/fil-cartes";

let db: PGlite;

// Boot PGlite (wasm) : au-delà des 10 s de `hookTimeout` par défaut dès que la
// suite sature les workers. Sans cette ligne, ce fichier tombe par
// INTERMITTENCE — un rouge qui n'accuse rien et qu'on relance jusqu'au vert,
// exactement ce que `docs/principes-tests.md` § 3 range dans « le silence
// ressemble au succès ». Les autres fichiers PGlite la posent déjà.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

beforeAll(async () => {
  db = new PGlite();
  h.holder.db = db;
  await db.exec(fs.readFileSync("db/schema.sql", "utf8"));
});
afterAll(async () => {
  await db.close();
});

let seq = 0;
async function membre(nom: string | null): Promise<number> {
  seq += 1;
  const { rows } = await db.query(
    `INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id`,
    [nom, `m${seq}@example.org`],
  );
  return (rows[0] as { id: number }).id;
}

async function fiche(userId: number, statut = "publie"): Promise<number> {
  const { rows } = await db.query(
    `INSERT INTO speaker_profiles ("userId", status, published_at)
     VALUES ($1, $2, CASE WHEN $2 = 'publie' THEN now() END) RETURNING id`,
    [userId, statut],
  );
  return (rows[0] as { id: number }).id;
}

async function scene(profileId: number, date = "2020-06-01"): Promise<number> {
  seq += 1;
  const { rows: t } = await db.query(
    `INSERT INTO speaker_talks (speaker_profile_id, titre) VALUES ($1, $2) RETURNING id`,
    [profileId, `Talk ${seq}`],
  );
  const { rows } = await db.query(
    `INSERT INTO talk_occurrences (talk_id, speaker_profile_id, date, conference)
     VALUES ($1, $2, $3, 'DevFest') RETURNING id`,
    [(t[0] as { id: number }).id, profileId, date],
  );
  return (rows[0] as { id: number }).id;
}

async function article(auteurId: number | null, statut = "publie"): Promise<number> {
  seq += 1;
  const { rows } = await db.query(
    `INSERT INTO contenus (type, slug, titre, corps, statut, publie_le, auteur_user_id)
     VALUES ('publication', $1, 'Un article', 'Corps.', $2,
             CASE WHEN $2 = 'publie' THEN CURRENT_DATE END, $3) RETURNING id`,
    [`article-${seq}`, statut, auteurId],
  );
  return (rows[0] as { id: number }).id;
}

async function nbBravos(): Promise<number> {
  const { rows } = await db.query(`SELECT COUNT(*)::int AS n FROM fil_reactions`);
  return (rows[0] as { n: number }).n;
}

const sessionDe = (uid: number) =>
  vi.mocked(auth).mockResolvedValue({ user: { id: String(uid) } } as never);

beforeEach(async () => {
  vi.clearAllMocks();
  await db.exec(`DELETE FROM fil_reactions; DELETE FROM contenus;
    DELETE FROM talk_occurrences; DELETE FROM speaker_talks;
    DELETE FROM speaker_profiles; DELETE FROM users;`);
});

describe("poser un bravo : par intention, idempotent, borné au visible", () => {
  it("pose UNE fois, même rejouée (double-submit inoffensif)", async () => {
    const ada = await membre("Ada");
    const eve = await membre("Eve");
    const pid = await fiche(eve);
    await poserReaction(ada, { type: "venue", id: pid });
    await poserReaction(ada, { type: "venue", id: pid });
    expect(await nbBravos()).toBe(1);
  });

  it("retirer est idempotent aussi, et rejouable sans erreur", async () => {
    const ada = await membre("Ada");
    const eve = await membre("Eve");
    const pid = await fiche(eve);
    await poserReaction(ada, { type: "venue", id: pid });
    await retirerReaction(ada, { type: "venue", id: pid });
    await retirerReaction(ada, { type: "venue", id: pid });
    expect(await nbBravos()).toBe(0);
  });

  it("le périmètre des scènes est CELUI du fil : passée à date exacte, fiche publiée", async () => {
    const ada = await membre("Ada");
    const eve = await membre("Eve");
    const pid = await fiche(eve);
    await poserReaction(ada, { type: "scene", id: await scene(pid, "2020-06-01") });
    // Future, imprécise : le fil ne les montre jamais → zéro ligne, sans bruit.
    await poserReaction(ada, { type: "scene", id: await scene(pid, "2999-01-01") });
    await poserReaction(ada, { type: "scene", id: await scene(pid, "2026") });
    expect(await nbBravos()).toBe(1);
  });

  it("fiche en brouillon, contenu en brouillon, cible inexistante : MÊME silence (zéro oracle)", async () => {
    const ada = await membre("Ada");
    const eve = await membre("Eve");
    await poserReaction(ada, { type: "venue", id: await fiche(eve, "brouillon") });
    await poserReaction(ada, { type: "asso", id: await article(null, "brouillon") });
    await poserReaction(ada, { type: "asso", id: 999999 });
    expect(await nbBravos()).toBe(0);
  });

  it("jamais sa propre carte : sa fiche, sa scène, son article", async () => {
    const ada = await membre("Ada");
    const sienne = await fiche(ada);
    await poserReaction(ada, { type: "venue", id: sienne });
    await poserReaction(ada, { type: "scene", id: await scene(sienne) });
    await poserReaction(ada, { type: "asso", id: await article(ada) });
    expect(await nbBravos()).toBe(0);
  });

  it("l'actualité de l'ASSO ne s'applaudit pas : un bravo va à une PERSONNE", async () => {
    // On applaudit quelqu'un pour son geste (« Nawel a publié un article »),
    // jamais une annonce de l'association — qui n'a personne à féliciter.
    const ada = await membre("Ada");
    const nawel = await membre("Nawel");
    await poserReaction(ada, { type: "asso", id: await article(null) });
    expect(await nbBravos()).toBe(0);
    // L'article d'une MEMBRE, lui, s'applaudit : il porte son nom.
    await poserReaction(ada, { type: "asso", id: await article(nawel) });
    expect(await nbBravos()).toBe(1);
  });
});

describe("le retrait marche TOUJOURS (base légale RGPD)", () => {
  it("un bravo dont la carte a quitté le fil se retire quand même", async () => {
    const ada = await membre("Ada");
    const eve = await membre("Eve");
    const pid = await fiche(eve);
    await poserReaction(ada, { type: "venue", id: pid });
    // La fiche sort du périmètre SANS passer par le retrait volontaire (pas de
    // purge) : le bouton a disparu, le retrait doit marcher quand même.
    await db.query(`UPDATE speaker_profiles SET status = 'masque' WHERE id = $1`, [pid]);
    await retirerReaction(ada, { type: "venue", id: pid });
    expect(await nbBravos()).toBe(0);
  });

  it("chacune ne retire que LE SIEN", async () => {
    const ada = await membre("Ada");
    const zoe = await membre("Zoé");
    const eve = await membre("Eve");
    const pid = await fiche(eve);
    await poserReaction(ada, { type: "venue", id: pid });
    await retirerReaction(zoe, { type: "venue", id: pid });
    expect(await nbBravos()).toBe(1);
  });
});

describe("retrait rétroactif = purge ; cascades", () => {
  it("retirer sa fiche supprime les bravos reçus (fiche ET scènes)", async () => {
    const ada = await membre("Ada");
    const eve = await membre("Eve");
    const pid = await fiche(eve);
    await poserReaction(ada, { type: "venue", id: pid });
    await poserReaction(ada, { type: "scene", id: await scene(pid) });
    expect(await nbBravos()).toBe(2);
    await withdrawOwnProfile(eve);
    expect(await nbBravos()).toBe(0);
  });

  it("la modération orga purge comme le retrait volontaire (masquer, refuser)", async () => {
    const ada = await membre("Ada");
    const orga = await membre("Orga");
    const eve = await membre("Eve");
    const pid = await fiche(eve);
    await poserReaction(ada, { type: "venue", id: pid });
    await poserReaction(ada, { type: "scene", id: await scene(pid) });
    await setProfileStatus(pid, "masque", orga);
    // Quitter « publié » ne laisse rien dormir : une re-publication (retour
    // discret, published_at conservé) repart de zéro.
    expect(await nbBravos()).toBe(0);
  });

  it("re-soumettre sa fiche publiée purge aussi (la TROISIÈME sortie de « publié »)", async () => {
    const ada = await membre("Ada");
    const eve = await membre("Eve");
    const pid = await fiche(eve);
    await poserReaction(ada, { type: "venue", id: pid });
    await poserReaction(ada, { type: "scene", id: await scene(pid) });
    await submitForValidation(eve);
    expect(await nbBravos()).toBe(0);
  });

  it("une ÉDITION qui sort la carte du fil purge (destination effacée), une édition anodine garde tout", async () => {
    const ada = await membre("Ada");
    const nawel = await membre("Nawel");
    const cid = await article(nawel);
    await poserReaction(ada, { type: "asso", id: cid });
    const entree = {
      type: "publication" as const, titre: "Un article", chapo: null,
      corps: "Corps.", imageUrl: null, imageAlt: null, imageWidth: null, imageHeight: null, videoUrl: null,
      categorie: null, tag: null, lien: null, lienExterne: null,
      lienLabel: null, conferenceEditionId: null,
    };
    // Édition anodine (le corps reste) : le bravo reste.
    expect((await updateContenu(cid, entree)).ok).toBe(true);
    expect(await nbBravos()).toBe(1);
    // Destination effacée : la carte quitte le fil, le bravo part avec elle.
    expect((await updateContenu(cid, { ...entree, corps: "" })).ok).toBe(true);
    expect(await nbBravos()).toBe(0);
  });

  it("dépublier un article de membre supprime ses réactions", async () => {
    const ada = await membre("Ada");
    const nawel = await membre("Nawel");
    const cid = await article(nawel);
    await poserReaction(ada, { type: "asso", id: cid });
    await setStatut(cid, "brouillon");
    expect(await nbBravos()).toBe(0);
  });

  it("compte supprimé : ses réactions DONNÉES partent (cascade)", async () => {
    const ada = await membre("Ada");
    const eve = await membre("Eve");
    await poserReaction(ada, { type: "venue", id: await fiche(eve) });
    await db.query(`DELETE FROM users WHERE id = $1`, [ada]);
    expect(await nbBravos()).toBe(0);
  });
});

describe("getReactionsPourFil : une requête, nominative, gardée par la session", () => {
  const cartes = (pid: number, occ: number, cid: number): CarteFil[] => [
    carteVenue({
      profileId: pid, nom: "Eve", href: "/speakeuses/eve", titreProfil: null,
      image: null, date: "2026-08-01",
    } as never),
    carteScene({
      occurrenceId: occ, date: "2020-06-01", conference: "DevFest", ville: null,
      pays: null, lienConf: null, talkTitre: "T", talkType: "Conférence",
      speakeuseNom: "Eve", speakeuseHref: "/speakeuses/eve", image: null,
    } as never),
    carteAsso({
      id: cid, type: "publication", slug: "a", titre: "A", chapo: null,
      corps: "x", lien: null, lienExterne: null, lienLabel: null,
      statut: "publie", publieLe: "2026-08-01", auteurNom: "Nawel B.",
      auteurUserId: 999,
    } as never)!,
  ];

  it("compte, cite la PREMIÈRE donneuse nommée (ordre d'arrivée), dit « moi »", async () => {
    const zoe = await membre("Zoé");
    const anonyme = await membre(null);
    const ada = await membre("Ada");
    const eve = await membre("Eve");
    const pid = await fiche(eve);
    // Une sans-nom d'abord (sautée dans la citation), puis Zoé, puis Ada.
    await poserReaction(anonyme, { type: "venue", id: pid });
    await poserReaction(zoe, { type: "venue", id: pid });
    await poserReaction(ada, { type: "venue", id: pid });

    sessionDe(ada);
    const infos = await getReactionsPourFil(cartes(pid, 1, 1));
    const v = infos.get(`venue-${pid}`);
    expect(v).toEqual({ nb: 3, premiere: "Zoé", moi: true });
  });

  it("la citée est la première AUTRE que moi (jamais « Toi, Toi-même »)", async () => {
    const zoe = await membre("Zoé");
    const ada = await membre("Ada");
    const eve = await membre("Eve");
    const pid = await fiche(eve);
    await poserReaction(zoe, { type: "venue", id: pid });
    await poserReaction(ada, { type: "venue", id: pid });

    sessionDe(zoe); // Zoé a applaudi LA PREMIÈRE : on cite Ada, pas elle.
    const infos = await getReactionsPourFil(cartes(pid, 1, 1));
    expect(infos.get(`venue-${pid}`)).toEqual({ nb: 2, premiere: "Ada", moi: true });
  });

  it("seule à avoir applaudi : « moi », zéro citée", async () => {
    const ada = await membre("Ada");
    const eve = await membre("Eve");
    const pid = await fiche(eve);
    await poserReaction(ada, { type: "venue", id: pid });
    sessionDe(ada);
    const infos = await getReactionsPourFil(cartes(pid, 1, 1));
    expect(infos.get(`venue-${pid}`)).toEqual({ nb: 1, premiere: null, moi: true });
  });

  it("« moi » est faux pour qui a seulement regardé ; les cartes muettes sont absentes", async () => {
    const ada = await membre("Ada");
    const zoe = await membre("Zoé");
    const eve = await membre("Eve");
    const pid = await fiche(eve);
    const occ = await scene(pid);
    const cid = await article(null);
    await poserReaction(ada, { type: "scene", id: occ });

    sessionDe(zoe);
    const infos = await getReactionsPourFil(cartes(pid, occ, cid));
    expect(infos.get(`scene-${occ}`)).toEqual({ nb: 1, premiere: "Ada", moi: false });
    expect(infos.has(`venue-${pid}`)).toBe(false);
    expect(infos.has(`asso-${cid}`)).toBe(false);
  });

  it("hors session : la lib refuse de servir (Map vide) — rien ne fuit vers un écran public", async () => {
    const ada = await membre("Ada");
    const eve = await membre("Eve");
    const pid = await fiche(eve);
    await poserReaction(ada, { type: "venue", id: pid });
    vi.mocked(auth).mockResolvedValue(null as never);
    const infos = await getReactionsPourFil(cartes(pid, 1, 1));
    expect(infos.size).toBe(0);
  });
});
