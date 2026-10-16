import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { schemaForPgMem } from "./schema-pgmem";

/**
 * VRAIS tests d'intégration BDD du flux « profils » : on exécute le SQL réel
 * contre un Postgres **en mémoire** (`pg-mem`) en chargeant `db/schema.sql`,
 * puis on fait tourner les vraies fonctions d'accès de `src/lib/profiles.ts`.
 *
 * Pourquoi ce fichier existe : plusieurs fonctions d'accès n'étaient couvertes
 * que par un pool MOCKÉ (on vérifiait la chaîne SQL, jamais qu'une écriture
 * atterrit vraiment en base, ni les contraintes réelles : index UNIQUE sur
 * "userId", cascade de suppression, DEFAULT des colonnes). C'est ce niveau qui
 * attrape un bug parti en prod.
 */

const h = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { newDb } = require("pg-mem");
  const mem = newDb();
  const pg = mem.adapters.createPg();
  const pool = new pg.Pool();
  return { mem, pool };
});

vi.mock("@/lib/db", () => ({
  pool: h.pool,
  // Le helper du lot N4 : pg-mem n'a PAS la table des réactions — on rejoue sans la
  // purge, exactement la sémantique de la fenêtre de déploiement.
  withTransactionSaufTable: async (
    _t: string,
    fn: (q: unknown, avec: boolean) => Promise<unknown>,
  ) => fn(h.pool, false),
  // Même sémantique que la vraie withTransaction, sur le pool pg-mem.
  withTransaction: async (fn: (client: unknown) => Promise<unknown>) => {
    const client = await h.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  },
}));

import {
  ensureProfileId,
  getProfileByUserId,
  upsertProfile,
  submitForValidation,
  withdrawOwnProfile,
  getProfilesPubliesSansNom,
  effacerCompteEnBase,
  type ProfileInput,
} from "@/lib/profiles";
import { addTalk, getTalksByProfileId } from "@/lib/talks";

let backup: { restore: () => void };

beforeAll(() => {
  // pg-mem ne connaît pas `btrim` (Postgres, oui) : même précédent que le banc
  // tremplin — on la déclare plutôt que d'affaiblir la requête. FIDÈLE à
  // Postgres : btrim(text) ne retire que l'espace U+0020 — un trim() JS ici
  // rendrait le double plus permissif que la prod (passe justesse 2026-08-22).
  h.mem.public.registerFunction({
    name: "btrim",
    args: ["text"],
    returns: "text",
    implementation: (v: string | null) => (v == null ? null : v.replace(/^ +| +$/g, "")),
  });
  h.mem.public.none(schemaForPgMem());
  backup = h.mem.backup(); // schéma chargé, base vide
});

beforeEach(() => backup.restore()); // isole chaque test (purge les lignes)

async function newUser(name: string, email: string): Promise<number> {
  const { rows } = await h.pool.query(
    "INSERT INTO users(name, email) VALUES($1, $2) RETURNING id",
    [name, email],
  );
  return (rows[0] as { id: number }).id;
}

/** Compte les profils d'un compte (pour prouver l'absence de doublon). */
async function countProfiles(userId: number): Promise<number> {
  const { rows } = await h.pool.query(
    'SELECT count(*)::int AS n FROM speaker_profiles WHERE "userId" = $1',
    [userId],
  );
  return (rows[0] as { n: number }).n;
}

/** Un ProfileInput complet, à surcharger champ par champ dans les tests. */
function baseInput(over: Partial<ProfileInput> = {}): ProfileInput {
  return {
    slug: null,
    titreProfil: null,
    poste: null,
    entreprise: null,
    bio: null,
    website: null,
    linkedin: null,
    instagram: null,
    sessionizeUrl: null,
    conferenceHallUrl: null,
    ville: null,
    codePostal: null,
    codeInsee: null,
    regionResidence: null,
    regions: [],
    langues: [],
    secteurs: [],
    sujets: [],
    contactEmailOk: false,
    isWoman: false,
    cfpSyncMode: "suggestions",
    ...over,
  };
}

describe("ensureProfileId (réel)", () => {
  it("est idempotent : deux appels renvoient le MÊME id, une seule ligne créée", async () => {
    const userId = await newUser("Clara", "clara@ex.fr");

    const id1 = await ensureProfileId(userId);
    const id2 = await ensureProfileId(userId);

    expect(id2).toBe(id1); // grâce à l'index UNIQUE ("userId")
    expect(await countProfiles(userId)).toBe(1); // pas de doublon
  });
});

describe("getProfileByUserId (réel)", () => {
  it("renvoie null tant qu'aucun profil n'existe", async () => {
    const userId = await newUser("Sans profil", "vide@ex.fr");
    expect(await getProfileByUserId(userId)).toBeNull();
  });

  it("renvoie le profil (jointure users pour le nom), avec l'id d'ensureProfileId", async () => {
    const userId = await newUser("Camille", "camille@ex.fr");
    const id = await ensureProfileId(userId);

    const profile = await getProfileByUserId(userId);
    expect(profile).not.toBeNull();
    expect(profile!.id).toBe(id); // même id que celui rendu par ensureProfileId
    expect(profile!.userId).toBe(userId);
    expect(profile!.name).toBe("Camille"); // vient de la table users (jointure)
    expect(profile!.status).toBe("brouillon"); // DEFAULT à la création
    expect(profile!.contactEmailOk).toBe(false); // DEFAULT false
  });
});

describe("upsertProfile (réel)", () => {
  it("écrit puis relit tous les champs, y compris les tableaux", async () => {
    const userId = await newUser("Sandrine", "sandrine@ex.fr");

    await upsertProfile(
      userId,
      baseInput({
        titreProfil: "Ingénieure plateforme",
        poste: "Staff Engineer",
        entreprise: "Isybuy",
        bio: "J'aime parler d'observabilité.",
        website: "https://exemple.fr",
        linkedin: "https://linkedin.com/in/sandrine",
        ville: "Toulouse",
        regions: ["Occitanie"],
        langues: ["Français", "Anglais"],
        secteurs: ["Cloud", "DevOps"],
        sujets: ["Observabilité", "SRE"],
        contactEmailOk: true,
        isWoman: true,
        cfpSyncMode: "aucun",
      }),
    );

    const profile = await getProfileByUserId(userId);
    expect(profile).toMatchObject({
      titreProfil: "Ingénieure plateforme",
      poste: "Staff Engineer",
      entreprise: "Isybuy",
      bio: "J'aime parler d'observabilité.",
      website: "https://exemple.fr",
      linkedin: "https://linkedin.com/in/sandrine",
      ville: "Toulouse",
      regions: ["Occitanie"],
      langues: ["Français", "Anglais"],
      secteurs: ["Cloud", "DevOps"],
      sujets: ["Observabilité", "SRE"],
      contactEmailOk: true,
      isWoman: true,
      cfpSyncMode: "aucun",
    });
  });

  it("un 2e upsert met à jour la même ligne (pas de doublon) et vide les champs", async () => {
    const userId = await newUser("Morgane", "morgane@ex.fr");

    await upsertProfile(
      userId,
      baseInput({ bio: "Première version", secteurs: ["IA"], sujets: ["LLM"] }),
    );
    const id1 = (await getProfileByUserId(userId))!.id;

    // Ré-enregistrement avec les champs vidés → relus à null / tableaux vides.
    await upsertProfile(userId, baseInput({ bio: null, secteurs: [], sujets: [] }));

    const profile = await getProfileByUserId(userId);
    expect(profile!.id).toBe(id1); // ON CONFLICT ("userId") : même ligne
    expect(await countProfiles(userId)).toBe(1);
    expect(profile!.bio).toBeNull();
    expect(profile!.secteurs).toEqual([]);
    expect(profile!.sujets).toEqual([]);
  });
});

describe("getProfilesPubliesSansNom (réel)", () => {
  it("attrape les publiées au nom vide OU blanc — et elles seules", async () => {
    // Le défaut d'origine (dette P1) : `??` à l'affichage laissait passer
    // `""` et `"   "` — la requête doit juger comme les gardes (`btrim`),
    // et rester sourde aux brouillons (pas publiés) comme aux fiches nommées.
    const sansNom = await newUser("", "vide@test.fr");
    const enBlanc = await newUser("   ", "blanc@test.fr");
    const nommee = await newUser("Ada Lovelace", "ada@test.fr");
    const brouillonSansNom = await newUser("", "brouillon@test.fr");
    for (const [userId, status, titre] of [
      [sansNom, "publie", "Dev & mentor"],
      [enBlanc, "publie", null],
      [nommee, "publie", null],
      [brouillonSansNom, "brouillon", null],
    ] as const) {
      await h.pool.query(
        `INSERT INTO speaker_profiles ("userId", status, titre_profil) VALUES ($1, $2, $3)`,
        [userId, status, titre],
      );
    }

    const fiches = await getProfilesPubliesSansNom();
    // Attendu EXACT : la requête trie par sp.id (ordre d'insertion ci-dessus).
    expect(fiches.map((f) => f.titreProfil)).toEqual(["Dev & mentor", null]);
  });
});

describe("transitions de statut (réel)", () => {
  it("submitForValidation fait passer le profil en 'en_attente' et horodate la soumission", async () => {
    const userId = await newUser("Alice", "alice@ex.fr");
    await ensureProfileId(userId);

    await submitForValidation(userId);

    const profile = await getProfileByUserId(userId);
    expect(profile!.status).toBe("en_attente");
    expect(profile!.submittedAt).not.toBeNull();
  });

  it("withdrawOwnProfile ramène un profil 'en_attente' en 'brouillon' (1 ligne)", async () => {
    const userId = await newUser("Bea", "bea@ex.fr");
    await ensureProfileId(userId);
    await submitForValidation(userId);

    expect(await withdrawOwnProfile(userId)).toBe(1);
    expect((await getProfileByUserId(userId))!.status).toBe("brouillon");
  });

  it("withdrawOwnProfile ne touche pas un brouillon (aucune ligne affectée)", async () => {
    const userId = await newUser("Chloe", "chloe@ex.fr");
    await ensureProfileId(userId); // reste 'brouillon'

    // Le statut n'est pas dans ('publie', 'en_attente', 'masque') → 0 ligne.
    expect(await withdrawOwnProfile(userId)).toBe(0);
    expect((await getProfileByUserId(userId))!.status).toBe("brouillon");
  });
});

describe("effacerCompteEnBase (réel, RGPD)", () => {
  it("supprime le compte, et en cascade le profil ET les talks", async () => {
    const userId = await newUser("Julie", "julie@ex.fr");
    const profileId = await ensureProfileId(userId);
    await addTalk(profileId, {
      titre: "Mon talk DevFest",
      type: "Conférence",
      description: "Un retour d'expérience.",
    });
    expect(await getTalksByProfileId(profileId)).toHaveLength(1);

    await expect(effacerCompteEnBase(userId)).resolves.toBeUndefined();

    // Le compte, le profil (ON DELETE CASCADE) et le talk ont disparu.
    expect(await getProfileByUserId(userId)).toBeNull();
    expect(await getTalksByProfileId(profileId)).toHaveLength(0);
    const { rows } = await h.pool.query("SELECT id FROM users WHERE id = $1", [userId]);
    expect(rows).toHaveLength(0);
  });

  it("inscription PUBLIQUE : garde le strict nécessaire à l'archive, efface le reste (RGPD)", async () => {
    // Une lauréate qui a consenti à figurer publiquement (public = true) : le
    // palmarès public a besoin de son nom, son titre primé et son classement. Le
    // reste (bio, site, photo, LinkedIn, rôle) n'est plus jamais affiché → doit
    // disparaître à l'effacement du compte (minimisation).
    const userId = await newUser("Sofia", "sofia@ex.fr");
    const { rows: edRows } = await h.pool.query(
      "INSERT INTO tremplin_editions(conf_slug, annee, nom, statut) VALUES('devfest', 2025, 'Tremplin 2025', 'archive') RETURNING id",
    );
    const editionId = (edRows[0] as { id: number }).id;
    await h.pool.query(
      `INSERT INTO tremplin_registrations
         (edition_id, "userId", participante_nom, participante_role, participante_linkedin,
          titre_palmares, "public", public_consent_at, classement, bio, site_web, photo_url)
       VALUES ($1, $2, 'Sofia Nguyen', 'CTO', 'https://linkedin/sofia',
          'Scaler une équipe', true, now(), 1, 'Bio perso', 'https://sofia.dev', 'https://img/sofia.jpg')`,
      [editionId, userId],
    );

    await effacerCompteEnBase(userId);

    const { rows } = await h.pool.query(
      `SELECT "userId", participante_nom, participante_role, participante_linkedin,
              titre_palmares, classement, bio, site_web, photo_url, "public"
         FROM tremplin_registrations WHERE edition_id = $1`,
      [editionId],
    );
    expect(rows).toHaveLength(1);
    const r = rows[0] as Record<string, unknown>;
    // Archive publique préservée : nom figé, titre primé, classement.
    expect(r.participante_nom).toBe("Sofia Nguyen");
    expect(r.titre_palmares).toBe("Scaler une équipe");
    expect(r.classement).toBe(1);
    // Lien au compte coupé (SET NULL) + données perso non publiques effacées.
    expect(r.userId).toBeNull();
    expect(r.participante_role).toBeNull();
    expect(r.participante_linkedin).toBeNull();
    expect(r.bio).toBeNull();
    expect(r.site_web).toBeNull();
    expect(r.photo_url).toBeNull();
  });
});
