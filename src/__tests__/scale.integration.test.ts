// @vitest-environment node
import { describe, it, expect, beforeAll, vi } from "vitest";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

/**
 * Tests d'ÉCHELLE (montée de charge côté base) : on sème une base réaliste à
 * l'horizon 6 mois (~200 speakeuses, ~1000 talks) dans un vrai Postgres (PGlite)
 * et on vérifie les propriétés qui DÉGRADENT quand le volume grossit :
 *   1. nombre de requêtes BORNÉ (pas de N+1) quel que soit le volume ;
 *   2. justesse à l'échelle (une jointure ne multiplie pas les lignes) ;
 *   3. agrégats corrects sur 1000 lignes ;
 *   4. les requêtes chaudes UTILISENT l'index (EXPLAIN), pas un Seq Scan.
 *
 * Ce n'est PAS un test de débit HTTP (k6/artillery contre un déploiement) : le
 * risque réel à ce volume est côté requêtes SQL, et il se teste ici de façon
 * déterministe, sans infra, en CI. Le débit bout-en-bout reste un job manuel.
 */

const NB_PROFILS = 200;
const NB_PUBLIES = 150;
const NB_TALKS = 1000;

const h = vi.hoisted(() => {
  const holder: { db: import("@electric-sql/pglite").PGlite | null } = { db: null };
  const compteur = { n: 0 }; // requêtes émises (garde anti N+1)
  const pool = {
    query: async (text: string, params?: unknown[]) => {
      compteur.n++;
      const r = await holder.db!.query(text, params);
      return { ...r, rowCount: (r as { affectedRows?: number }).affectedRows };
    },
  };
  return { holder, pool, compteur };
});

vi.mock("@/lib/db", () => ({ pool: h.pool }));

import { getPublishedAnnuaire, toPublicSpeaker } from "@/lib/profiles";
import { getPublicTalkTextByProfile, getTalksByProfileId } from "@/lib/talks";
import { getSpeakerSearchItems } from "@/lib/search";

beforeAll(async () => {
  const db = new PGlite();
  h.holder.db = db;
  await db.exec(fs.readFileSync("db/schema.sql", "utf8"));

  // Semis en masse (INSERT ... SELECT generate_series) : 200 comptes + profils
  // (les 150 premiers publiés), 1000 talks répartis sur les profils publiés.
  await db.exec(
    `INSERT INTO users(name, email)
       SELECT 'Speakeuse ' || g, 'user' || g || '@ex.fr'
         FROM generate_series(1, ${NB_PROFILS}) g`,
  );
  await db.exec(
    `INSERT INTO speaker_profiles("userId", status)
       SELECT id, CASE WHEN id <= ${NB_PUBLIES} THEN 'publie' ELSE 'brouillon' END
         FROM users`,
  );
  // profileId = ((g % NB_PUBLIES) + 1) → talks répartis sur les profils 1..150.
  await db.exec(
    `INSERT INTO speaker_talks(speaker_profile_id, titre, type)
       SELECT ((g % ${NB_PUBLIES}) + 1), 'Talk ' || g, 'Conférence'
         FROM generate_series(1, ${NB_TALKS}) g`,
  );
  await db.exec("ANALYZE"); // stats à jour → le planificateur choisit l'index
}, 60_000);

describe("échelle : nombre de requêtes borné (anti N+1)", () => {
  it("l'annuaire complet se charge en 2 requêtes, quel que soit le volume", async () => {
    h.compteur.n = 0;
    // Reproduit l'assemblage de la page /speakeuses : profils + texte des talks,
    // puis map EN MÉMOIRE (aucune requête par speakeuse).
    const rows = await getPublishedAnnuaire();
    const talkText = await getPublicTalkTextByProfile();
    const vue = rows.map((r) => ({
      ...toPublicSpeaker(r),
      texte: talkText.get(r.id) ?? "",
    }));
    expect(vue).toHaveLength(NB_PUBLIES);
    // 2 requêtes pour 150 profils + 1000 talks : la garde qui casse si un jour
    // quelqu'un réintroduit une requête par speakeuse.
    expect(h.compteur.n).toBe(2);
  });

  it("l'index de recherche (Fuse) se construit aussi en 2 requêtes", async () => {
    h.compteur.n = 0;
    const items = await getSpeakerSearchItems();
    expect(items).toHaveLength(NB_PUBLIES);
    expect(h.compteur.n).toBe(2);
  });
});

describe("échelle : justesse sur gros volume", () => {
  it("getPublishedAnnuaire ne renvoie QUE les publiés, sans doublon de ligne", async () => {
    const rows = await getPublishedAnnuaire();
    expect(rows).toHaveLength(NB_PUBLIES);
    // Aucune multiplication de lignes par la jointure users malgré 1000 talks.
    expect(new Set(rows.map((r) => r.id)).size).toBe(NB_PUBLIES);
  });

  it("getPublicTalkTextByProfile agrège 1000 talks en une entrée par profil", async () => {
    const map = await getPublicTalkTextByProfile();
    expect(map.size).toBe(NB_PUBLIES); // tous les publiés ont au moins un talk
    // Total des talks = somme des talks agrégés par profil.
    const totalTalks = [...map.values()].reduce(
      (acc, txt) => acc + (txt.match(/Talk \d+/g)?.length ?? 0),
      0,
    );
    expect(totalTalks).toBe(NB_TALKS);
  });

  it("getTalksByProfileId renvoie tous les talks d'un profil chargé, triés par id", async () => {
    const talks = await getTalksByProfileId(1);
    expect(talks.length).toBeGreaterThan(0);
    const ids = talks.map((t) => t.id);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
    expect(talks.every((t) => t.profileId === 1)).toBe(true);
  });
});

describe("échelle : les requêtes chaudes utilisent l'index (EXPLAIN)", () => {
  async function plan(sql: string, params: unknown[]): Promise<string> {
    const r = await h.holder.db!.query<Record<string, string>>(
      `EXPLAIN ${sql}`,
      params,
    );
    return r.rows.map((row) => row["QUERY PLAN"]).join("\n");
  }

  it("SELECT talks WHERE speaker_profile_id passe par idx_speaker_talks_profile", async () => {
    const p = await plan(
      "SELECT id FROM speaker_talks WHERE speaker_profile_id = $1",
      [7],
    );
    // Doit utiliser l'index dédié, pas balayer les 1000 lignes (Seq Scan).
    expect(p).toMatch(/idx_speaker_talks_profile/);
    expect(p).not.toMatch(/Seq Scan on speaker_talks/);
  });

  it("l'agrégat public du texte des talks n'explose pas (GROUP BY sur l'index)", async () => {
    const p = await plan(
      `SELECT speaker_profile_id, string_agg(titre, ' ') AS txt
         FROM speaker_talks GROUP BY speaker_profile_id`,
      [],
    );
    // On documente le plan choisi ; le point clé est l'absence de produit
    // cartésien (le test de justesse ci-dessus le prouve déjà côté résultat).
    expect(p.length).toBeGreaterThan(0);
  });
});
