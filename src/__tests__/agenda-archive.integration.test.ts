// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

/**
 * MÉMOIRE COMPLÈTE ET HORIZON GLISSANT — les deux décisions du 2026-08-16
 * (docs/audit-ux-agenda-2026-08.md §8), éprouvées sur un vrai Postgres.
 *
 * Ce que ces tests gardent, et que rien ne gardait avant :
 *   1. AUCUNE intervention passée n'est inatteignable. L'ancien plafond
 *      (`maxPassees = 12`) en cachait 24 sur 36 dans le décor d'audit, sans le
 *      dire. Une régression qui le réintroduirait doit faire tomber un test.
 *   2. L'horizon ne se cale JAMAIS sur l'année civile. Une page d'atterrissage
 *      calée sur l'année se viderait en décembre — défaut structurel qui
 *      n'apparaîtrait qu'une semaine par an, donc qu'aucune revue ne verrait.
 *   3. La lecture est BORNÉE en base : la mémoire complète interdit de tout
 *      charger pour tout afficher.
 */

const h = vi.hoisted(() => {
  const holder: { db: import("@electric-sql/pglite").PGlite | null } = { db: null };
  const compteur = { lignes: 0 };
  const pool = {
    query: async (text: string, params?: unknown[]) => {
      const r = await holder.db!.query(text, params);
      compteur.lignes = (r.rows as unknown[]).length;
      return { ...r, rowCount: (r as { affectedRows?: number }).affectedRows };
    },
  };
  return { holder, pool, compteur };
});

vi.mock("@/lib/db", () => ({ pool: h.pool }));

import {
  getScenesHorizon,
  getScenesDeLAnnee,
  getAnneesArchive,
} from "@/lib/agenda-public";

beforeAll(async () => {
  h.holder.db = new PGlite();
  await h.holder.db.exec(fs.readFileSync("db/schema.sql", "utf8"));
}, 60_000);

beforeEach(async () => {
  await h.holder.db!.exec(
    "TRUNCATE talk_occurrences, speaker_talks, speaker_profiles, users, conferences RESTART IDENTITY CASCADE",
  );
});

async function speakeuse(nom: string, status = "publie"): Promise<number> {
  const { rows: u } = await h.pool.query(
    `INSERT INTO users(name, email) VALUES($1, $2) RETURNING id`,
    [nom, `${nom.toLowerCase().replace(/\W+/g, ".")}@example.org`],
  );
  const { rows: p } = await h.pool.query(
    `INSERT INTO speaker_profiles("userId", status) VALUES($1, $2) RETURNING id`,
    [(u[0] as { id: number }).id, status],
  );
  return (p[0] as { id: number }).id;
}

async function scene(profileId: number, titre: string, date: string): Promise<void> {
  const { rows } = await h.pool.query(
    `INSERT INTO speaker_talks(speaker_profile_id, titre, type, source)
     VALUES($1, $2, 'Conférence', 'manuel') RETURNING id`,
    [profileId, titre],
  );
  await h.pool.query(
    `INSERT INTO talk_occurrences(talk_id, speaker_profile_id, conference, ville, date)
     VALUES($1, $2, 'Une conf', 'Toulouse', $3)`,
    [(rows[0] as { id: number }).id, profileId, date],
  );
}

describe("getScenesHorizon — ce qui vient, sans jamais se caler sur l'année civile", () => {
  it("le 28 décembre, l'horizon porte encore les dates de janvier suivant", async () => {
    // LA garde de la décision « horizon glissant ». Un agenda calé sur l'année
    // en cours rendrait cette page vide la dernière semaine de décembre.
    const p = await speakeuse("Léa Dubois");
    await scene(p, "Le 5 janvier", "2027-01-05");
    await scene(p, "Le 30 décembre", "2026-12-30");
    await scene(p, "Déjà passé", "2026-11-19");

    const scenes = await getScenesHorizon("2026-12-28");
    expect(scenes.map((s) => s.talkTitre)).toEqual(["Le 30 décembre", "Le 5 janvier"]);
  });

  it("garde une annonce imprécise jusqu'à la FIN de sa période", async () => {
    // « courant 2026 » veut dire « quelque part dans l'année » : au 1er août,
    // elle est encore à venir. Le tri sur le texte brut la dirait passée.
    const p = await speakeuse("Léa Dubois");
    await scene(p, "Courant 2026", "2026");
    await scene(p, "Novembre 2026", "2026-11");

    const titres = (await getScenesHorizon("2026-08-01")).map((s) => s.talkTitre);
    expect(titres).toContain("Courant 2026");
    expect(titres).toContain("Novembre 2026");
  });

  it("borne sa lecture en base : le passé lointain ne remonte jamais", async () => {
    // La mémoire complète interdit de tout charger pour afficher l'horizon.
    const p = await speakeuse("Léa Dubois");
    for (const a of [2018, 2019, 2020, 2021, 2022]) await scene(p, `Vieux ${a}`, `${a}-06-01`);
    await scene(p, "À venir", "2026-12-01");

    await getScenesHorizon("2026-08-01");
    // Le compteur porte le nombre de LIGNES rendues par la base, pas le
    // nombre affiché : c'est la lecture qu'on borne, pas le rendu.
    expect(h.compteur.lignes).toBeLessThanOrEqual(2);
  });
});

describe("getScenesDeLAnnee — le compte rendu d'une année", () => {
  it("rend les interventions de CETTE année-là, et d'aucune autre", async () => {
    const p = await speakeuse("Léa Dubois");
    await scene(p, "En 2025", "2025-04-17");
    await scene(p, "Aussi en 2025", "2025-11-20");
    await scene(p, "En 2024", "2024-09-01");

    const scenes = await getScenesDeLAnnee(2025);
    expect(scenes.map((s) => s.talkTitre).sort()).toEqual(["Aussi en 2025", "En 2025"]);
  });

  it("ramasse aussi les annonces imprécises de l'année", async () => {
    const p = await speakeuse("Léa Dubois");
    await scene(p, "Année seule", "2025");
    await scene(p, "Mois seul", "2025-06");

    expect((await getScenesDeLAnnee(2025)).map((s) => s.talkTitre).sort()).toEqual([
      "Année seule",
      "Mois seul",
    ]);
  });

  it("applique le même périmètre public : une fiche retirée disparaît", async () => {
    // La mémoire complète ne fige JAMAIS d'instantané : retirer sa fiche reste
    // souverain (RGPD art. 7-3), y compris sur l'archive.
    const publiee = await speakeuse("Publiée");
    const retiree = await speakeuse("Retirée", "masque");
    await scene(publiee, "Reste", "2025-04-17");
    await scene(retiree, "Disparaît", "2025-04-18");

    expect((await getScenesDeLAnnee(2025)).map((s) => s.talkTitre)).toEqual(["Reste"]);
  });
});

describe("getAnneesArchive — les années qui portent quelque chose", () => {
  it("liste les années passées avec leur compte, la plus récente d'abord", async () => {
    const p = await speakeuse("Léa Dubois");
    await scene(p, "A", "2024-03-01");
    await scene(p, "B", "2025-03-01");
    await scene(p, "C", "2025-09-01");

    expect(await getAnneesArchive("2026-08-01")).toEqual([
      { annee: 2025, nombre: 2 },
      { annee: 2024, nombre: 1 },
    ]);
  });

  it("AUCUN SEUIL : une année à une seule intervention existe", async () => {
    // Décision du 16/08 : le passé se remplit à retardement, à mesure que les
    // speakeuses complètent leur fiche. Masquer une année maigre reviendrait à
    // cacher la page pendant qu'elle grandit.
    const p = await speakeuse("Léa Dubois");
    await scene(p, "Seule", "2023-05-01");

    expect(await getAnneesArchive("2026-08-01")).toEqual([{ annee: 2023, nombre: 1 }]);
  });

  it("l'année EN COURS y figure dès qu'elle a du passé", async () => {
    const p = await speakeuse("Léa Dubois");
    await scene(p, "Plus tôt cette année", "2026-02-01");
    await scene(p, "À venir", "2026-12-01");

    expect(await getAnneesArchive("2026-08-01")).toEqual([{ annee: 2026, nombre: 1 }]);
  });

  it("une annonce « courant 2026 » reste HORS archive tant que l'année court", async () => {
    // Le plancher SQL est grossier : la chaîne « 2026 » est bien inférieure à
    // « 2026-08-01 », donc la base la remonte. C'est `estPasseTalkDate` qui
    // doit l'écarter — sinon l'archive de l'année en cours compterait une date
    // qui n'a pas encore eu lieu, et le compte afficherait un passé faux.
    const p = await speakeuse("Léa Dubois");
    await scene(p, "Courant 2026", "2026");
    await scene(p, "Vraiment passée", "2026-02-01");

    expect(await getAnneesArchive("2026-08-01")).toEqual([{ annee: 2026, nombre: 1 }]);
  });

  it("rien de passé : aucune année, et donc aucune archive à annoncer", async () => {
    const p = await speakeuse("Léa Dubois");
    await scene(p, "À venir", "2026-12-01");
    expect(await getAnneesArchive("2026-08-01")).toEqual([]);
  });
});
