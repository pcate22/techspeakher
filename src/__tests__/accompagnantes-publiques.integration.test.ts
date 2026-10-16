// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

/**
 * Intégration BDD de `listAccompagnantesPubliques` : la liste, toutes éditions
 * confondues, des femmes qui ont animé un atelier du Tremplin.
 *
 * Elle alimente `/partenaires`, où elle remplace deux entrées qui n'avaient
 * rien à y faire (les sociétés d'une fondatrice, rangées en « sponsors »).
 * Montrer celles qui donnent du temps dit mieux ce qu'est l'association que
 * remercier une entreprise. Contexte : docs/google-ad-grants.md.
 *
 * DEUX consentements gardent cette liste, et le test vérifie les deux
 * séparément : la fiche coach porte l'accord d'être citée (`coach_profiles
 * .public`), et l'atelier doit être au PROGRAMME PUBLIC — un atelier hors
 * programme n'expose pas plus son encadrement que son contenu. Chaque cas
 * négatif insère une ligne qui NE doit PAS remonter, pour qu'un WHERE relâché
 * se voie.
 *
 * Vrai Postgres (PGlite) + le vrai `db/schema.sql`.
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
vi.mock("@/lib/db", () => ({ pool: h.pool }));

import { listAccompagnantesPubliques } from "@/lib/coach-profiles";

// Le déploiement du schéma dépasse les timeouts par défaut quand la suite
// complète tourne en parallèle (cf. seed-recit.integration).
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

beforeAll(async () => {
  h.holder.db = new PGlite();
  await h.holder.db.exec(fs.readFileSync("db/schema.sql", "utf8"));
});

beforeEach(async () => {
  await h.holder.db!.exec(
    "TRUNCATE tremplin_atelier_coachs, tremplin_ateliers, tremplin_editions, coach_profiles, users RESTART IDENTITY CASCADE",
  );
});

async function newUser(name: string | null): Promise<number> {
  const { rows } = await h.pool.query(
    `INSERT INTO users(name, email) VALUES($1, $2) RETURNING id`,
    [name, `u${Math.abs(String(name).length)}-${name ?? "x"}@ex.fr`.toLowerCase()],
  );
  return (rows[0] as { id: number }).id;
}

async function newCoachProfile(
  userId: number,
  over: { role?: string | null; lien?: string | null; public?: boolean } = {},
): Promise<void> {
  await h.pool.query(
    `INSERT INTO coach_profiles ("userId", role, lien, "public") VALUES ($1, $2, $3, $4)`,
    [userId, over.role ?? null, over.lien ?? null, over.public ?? true],
  );
}

/** Une édition du Tremplin. Renvoie son id. */
async function newEdition(annee: number, statut = "ouvert"): Promise<number> {
  const { rows } = await h.pool.query(
    `INSERT INTO tremplin_editions(nom, annee, conf_slug, statut)
     VALUES ($1, $2, 'devfest-toulouse', $3) RETURNING id`,
    [`Tremplin ${annee}`, annee, statut],
  );
  return (rows[0] as { id: number }).id;
}

async function newAtelier(editionId: number, auProgrammePublic = true): Promise<number> {
  const { rows } = await h.pool.query(
    `INSERT INTO tremplin_ateliers(edition_id, titre, au_programme_public)
     VALUES ($1, 'Trouver son sujet', $2) RETURNING id`,
    [editionId, auProgrammePublic],
  );
  return (rows[0] as { id: number }).id;
}

async function anime(atelierId: number, userId: number): Promise<void> {
  await h.pool.query(
    `INSERT INTO tremplin_atelier_coachs(atelier_id, user_id) VALUES ($1, $2)`,
    [atelierId, userId],
  );
}

describe("listAccompagnantesPubliques", () => {
  it("rend celle qui a animé un atelier public et donné son accord", async () => {
    const ed = await newEdition(2026);
    const at = await newAtelier(ed);
    const u = await newUser("Lucile Briotet");
    await newCoachProfile(u, { role: "Conceptrice-rédactrice", lien: "https://ex.fr" });
    await anime(at, u);

    expect(await listAccompagnantesPubliques()).toEqual([
      { nom: "Lucile Briotet", role: "Conceptrice-rédactrice", lien: "https://ex.fr" },
    ]);
  });

  it("écarte celle qui n'a pas donné son accord d'être citée", async () => {
    const ed = await newEdition(2026);
    const at = await newAtelier(ed);
    const u = await newUser("Discrète");
    await newCoachProfile(u, { public: false });
    await anime(at, u);

    expect(await listAccompagnantesPubliques()).toEqual([]);
  });

  it("écarte celle qui n'a aucune fiche coach", async () => {
    // Sans fiche, il n'y a pas de consentement : le silence vaut refus.
    const ed = await newEdition(2026);
    const at = await newAtelier(ed);
    await anime(at, await newUser("Sans fiche"));

    expect(await listAccompagnantesPubliques()).toEqual([]);
  });

  it("écarte une édition encore en préparation", async () => {
    // `getPublicEdition` renvoie null pour `statut = 'preparation'` : la page de
    // l'édition répond 404. Sans le même filtre ici, une session cochée « au
    // programme public » sur une édition en préparation publiait ses coachs sur
    // /partenaires alors que sa propre page reste introuvable. Le consentement
    // n'est pas en cause (`coach_profiles.public` vaut pour toutes les éditions
    // à la fois) ; c'est l'ÉDITION qui n'est pas encore publique.
    const ed = await newEdition(2027, "preparation");
    const at = await newAtelier(ed);
    const u = await newUser("Trop tôt");
    await newCoachProfile(u);
    await anime(at, u);

    expect(await listAccompagnantesPubliques()).toEqual([]);
  });

  it("écarte un atelier hors du programme public, même avec l'accord", async () => {
    const ed = await newEdition(2026);
    const at = await newAtelier(ed, false);
    const u = await newUser("Coach interne");
    await newCoachProfile(u);
    await anime(at, u);

    expect(await listAccompagnantesPubliques()).toEqual([]);
  });

  it("ne cite personne deux fois, quel que soit le nombre d'ateliers ou d'éditions", async () => {
    // Le cas réel : une coach revient d'une édition à l'autre. Sans DISTINCT,
    // la page de partenaires afficherait son nom autant de fois qu'elle a
    // donné du temps — soit l'inverse du remerciement recherché.
    const u = await newUser("Fidèle");
    await newCoachProfile(u, { role: "Coach produit" });
    for (const annee of [2026, 2027]) {
      const ed = await newEdition(annee);
      await anime(await newAtelier(ed), u);
      await anime(await newAtelier(ed), u);
    }

    const liste = await listAccompagnantesPubliques();
    expect(liste).toHaveLength(1);
    expect(liste[0].nom).toBe("Fidèle");
  });

  it("écarte un compte sans nom, qui s'afficherait comme une vignette vide", async () => {
    const ed = await newEdition(2026);
    const at = await newAtelier(ed);
    const u = await newUser(null);
    await newCoachProfile(u);
    await anime(at, u);

    expect(await listAccompagnantesPubliques()).toEqual([]);
  });

  it("classe par nom, pour que l'ordre d'affichage soit stable", async () => {
    const ed = await newEdition(2026);
    for (const nom of ["Zoé Martin", "Alice Durand", "Marie Blanc"]) {
      const u = await newUser(nom);
      await newCoachProfile(u);
      await anime(await newAtelier(ed), u);
    }

    expect((await listAccompagnantesPubliques()).map((a) => a.nom)).toEqual([
      "Alice Durand",
      "Marie Blanc",
      "Zoé Martin",
    ]);
  });

  it("rend une liste vide plutôt qu'une erreur si la table manque", async () => {
    // Même repli que le reste du module : `/partenaires` doit survivre à un
    // déploiement où la migration 054 n'est pas encore passée.
    await h.holder.db!.exec("DROP TABLE tremplin_atelier_coachs CASCADE");
    expect(await listAccompagnantesPubliques()).toEqual([]);
  });
});
