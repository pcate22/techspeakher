import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { schemaForPgMem } from "./schema-pgmem";

/**
 * QUI reçoit une relance — la question la plus risquée de la feature (§ 5 de
 * `docs/principes-tests.md` : un envoi d'e-mail est irréversible). La sélection
 * vit dans des clauses `WHERE`, pas dans des `if` d'action : on l'éprouve donc
 * contre un vrai Postgres (`pg-mem`) chargé du `db/schema.sql` réel.
 *
 * Chaque exclusion a sa raison, écrite à côté de son test : une règle sans sa
 * raison se fait défaire de bonne foi par la personne suivante.
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
  getProfilesEnSommeil,
  getProfilesEnSommeilBrefs,
  getFicheARelancer,
  markRemindersSent,
} from "@/lib/profiles";
import { addTalk, deleteTalk } from "@/lib/talks";

let backup: { restore: () => void };

beforeAll(() => {
  h.mem.public.none(schemaForPgMem());
  backup = h.mem.backup();
});

beforeEach(() => backup.restore());

/** Crée un compte + sa fiche, avec l'ancienneté voulue. */
async function fiche(opts: {
  nom: string;
  email: string | null;
  jours: number;
  status?: string;
  migrated?: boolean;
  invitee?: boolean;
  relanceeIlYA?: number;
}): Promise<number> {
  const { rows: u } = await h.pool.query(
    `INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id`,
    [opts.nom, opts.email],
  );
  const userId = u[0].id as number;
  const { rows } = await h.pool.query(
    `INSERT INTO speaker_profiles
       ("userId", status, migrated, invited_at, updated_at, last_reminder_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      userId,
      opts.status ?? "brouillon",
      opts.migrated ?? false,
      opts.invitee ? new Date() : null,
      ilYA(opts.jours),
      opts.relanceeIlYA === undefined ? null : ilYA(opts.relanceeIlYA),
    ],
  );
  return rows[0].id as number;
}

/** Un instant daté d'il y a N jours. */
function ilYA(jours: number): Date {
  return new Date(Date.now() - jours * 86_400_000);
}

const FENETRE = 30;

describe("getProfilesEnSommeil — qui entre dans le lot", () => {
  it("retient un brouillon sans modification depuis la fenêtre", async () => {
    await fiche({ nom: "Ada", email: "ada@test.fr", jours: 45 });
    const liste = await getProfilesEnSommeil(FENETRE);
    expect(liste.map((f) => f.profile.name)).toEqual(["Ada"]);
    expect(liste[0].email).toBe("ada@test.fr");
  });

  it("laisse de côté un brouillon modifié récemment", async () => {
    await fiche({ nom: "Ada", email: "ada@test.fr", jours: 3 });
    expect(await getProfilesEnSommeil(FENETRE)).toEqual([]);
  });

  it("laisse de côté les fiches soumises, publiées ou refusées", async () => {
    // Une fiche soumise attend une ORGA ; une fiche refusée a déjà reçu son
    // motif. Relancer l'une ou l'autre parlerait à côté.
    for (const status of ["en_attente", "publie", "refuse", "masque"]) {
      await fiche({ nom: status, email: `${status}@test.fr`, jours: 90, status });
    }
    expect(await getProfilesEnSommeil(FENETRE)).toEqual([]);
  });

  it("laisse de côté une adresse absente ou de migration (.invalid)", async () => {
    // `.invalid` marque les comptes migrés SANS adresse connue : écrire là
    // rebondit, et Brevo compte le rejet contre la réputation du domaine.
    await fiche({ nom: "Sans", email: null, jours: 90 });
    await fiche({ nom: "Factice", email: "factice@techspeakher.invalid", jours: 90 });
    expect(await getProfilesEnSommeil(FENETRE)).toEqual([]);
  });

  it("laisse de côté une migrée jamais invitée, retient une migrée invitée", async () => {
    // La migrée jamais invitée ignore que sa fiche existe : son premier
    // courrier doit être l'invitation, pas une relance.
    await fiche({ nom: "Attend", email: "attend@test.fr", jours: 90, migrated: true });
    await fiche({
      nom: "Invitée",
      email: "invitee@test.fr",
      jours: 90,
      migrated: true,
      invitee: true,
    });
    const liste = await getProfilesEnSommeil(FENETRE);
    expect(liste.map((f) => f.profile.name)).toEqual(["Invitée"]);
  });

  it("laisse de côté une fiche déjà relancée dans la fenêtre", async () => {
    await fiche({ nom: "Fraîche", email: "f@test.fr", jours: 90, relanceeIlYA: 5 });
    await fiche({ nom: "Ancienne", email: "a@test.fr", jours: 90, relanceeIlYA: 60 });
    const liste = await getProfilesEnSommeil(FENETRE);
    expect(liste.map((f) => f.profile.name)).toEqual(["Ancienne"]);
  });

  it("compte les talks de chaque fiche (matière de l'e-mail)", async () => {
    const id = await fiche({ nom: "Ada", email: "ada@test.fr", jours: 90 });
    await h.pool.query(
      `INSERT INTO speaker_talks (speaker_profile_id, titre) VALUES ($1, 'Un talk')`,
      [id],
    );
    const [f] = await getProfilesEnSommeil(FENETRE);
    expect(f.talksCount).toBe(1);
  });

  it("la vue brève désigne exactement les mêmes personnes que la liste", async () => {
    // Deux requêtes pour une seule règle : si elles divergeaient, le tableau de
    // bord annoncerait un nombre que la page de relance ne retrouverait pas.
    await fiche({ nom: "Ada", email: "ada@test.fr", jours: 90 });
    await fiche({ nom: "Grace", email: "grace@test.fr", jours: 90 });
    await fiche({ nom: "Récente", email: "r@test.fr", jours: 2 });
    await fiche({ nom: "Factice", email: "f@techspeakher.invalid", jours: 90 });
    const brefs = await getProfilesEnSommeilBrefs(FENETRE);
    const complets = await getProfilesEnSommeil(FENETRE);
    expect(brefs.map((b) => b.nom)).toEqual(["Ada", "Grace"]);
    expect(brefs.map((b) => b.id)).toEqual(complets.map((c) => c.profile.id));
  });

  it("un talk ajouté réveille la fiche (le sommeil, c'est l'inactivité)", async () => {
    // `updated_at` porte « quand cette fiche a bougé », talks compris : sans
    // cela, quelqu'un qui remplit ses talks sans toucher au profil recevrait
    // « ta fiche attend encore un peu de toi » la semaine de son activité.
    const id = await fiche({ nom: "Ada", email: "ada@test.fr", jours: 90 });
    expect((await getProfilesEnSommeil(FENETRE)).length).toBe(1);
    const talkId = await addTalk(id, {
      titre: "Observabilité sans jargon",
      type: "Conférence",
      description: null,
    });
    expect(await getProfilesEnSommeil(FENETRE)).toEqual([]);
    // Et retirer un talk est encore un mouvement : la fiche reste éveillée.
    await deleteTalk(talkId, id);
    expect(await getProfilesEnSommeil(FENETRE)).toEqual([]);
  });
});

describe("getFicheARelancer — le geste depuis la fiche", () => {
  it("accepte un brouillon récent (l'orga voit la personne, elle décide)", async () => {
    const id = await fiche({ nom: "Ada", email: "ada@test.fr", jours: 2 });
    const f = await getFicheARelancer(id, FENETRE);
    expect(f?.profile.name).toBe("Ada");
  });

  it("refuse une fiche déjà relancée dans la fenêtre", async () => {
    const id = await fiche({
      nom: "Ada",
      email: "ada@test.fr",
      jours: 90,
      relanceeIlYA: 5,
    });
    expect(await getFicheARelancer(id, FENETRE)).toBeNull();
  });

  it("refuse une fiche publiée, une adresse .invalid, une migrée non invitée", async () => {
    const publiee = await fiche({
      nom: "Publiée",
      email: "p@test.fr",
      jours: 90,
      status: "publie",
    });
    const factice = await fiche({ nom: "F", email: "f@techspeakher.invalid", jours: 90 });
    const attend = await fiche({ nom: "A", email: "a@test.fr", jours: 90, migrated: true });
    expect(await getFicheARelancer(publiee, FENETRE)).toBeNull();
    expect(await getFicheARelancer(factice, FENETRE)).toBeNull();
    expect(await getFicheARelancer(attend, FENETRE)).toBeNull();
  });

  it("refuse une fiche inexistante", async () => {
    expect(await getFicheARelancer(9999, FENETRE)).toBeNull();
  });
});

describe("markRemindersSent — l'anti-doublon se ferme vraiment", () => {
  it("sort la fiche du lot après un envoi", async () => {
    const id = await fiche({ nom: "Ada", email: "ada@test.fr", jours: 90 });
    expect((await getProfilesEnSommeil(FENETRE)).length).toBe(1);
    await markRemindersSent([id]);
    expect(await getProfilesEnSommeil(FENETRE)).toEqual([]);
    expect(await getFicheARelancer(id, FENETRE)).toBeNull();
  });
});
