// @vitest-environment node
/**
 * Migration 046 — ateliers de la phase 3 (montée sur scène) du Tremplin DevFest
 * Toulouse 2026. Backfill de DONNÉES, joué au déploiement via
 * `db/sync-to-latest.sql` et historisé dans
 * `db/migrations/046_tremplin_phase3_ateliers.sql`.
 *
 * On exécute le VRAI fichier de migration dans un Postgres réel (PGlite) — pas
 * de SQL réécrit — pour garantir que le bloc :
 *  - vise la bonne édition (conf_slug = 'devfest-toulouse', annee = 2026) ;
 *  - crée 10 ateliers `montee_sur_scene`, ouverts à toutes (parcours public) ;
 *  - ne contient AUCUNE donnée personnelle (ni binôme ni coach nominatif) ;
 *  - est idempotent (rejouable sans doublon) et no-op quand l'édition manque.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const schemaSql = readFileSync(resolve(process.cwd(), "db/schema.sql"), "utf8");
const migrationSql = readFileSync(
  resolve(process.cwd(), "db/migrations/046_tremplin_phase3_ateliers.sql"),
  "utf8",
);

/** Base vierge au schéma de référence, avec l'édition 2026 déjà créée (ou pas). */
async function baseAvecEdition(annee: number | null): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(schemaSql);
  if (annee !== null) {
    await db.query(
      `INSERT INTO tremplin_editions (nom, annee, conf_slug, statut, finale_date)
       VALUES ($1, $2, 'devfest-toulouse', 'en_cours', '2026-06-04')`,
      [`Tremplin ${annee}`, annee],
    );
  }
  return db;
}

interface AtelierRow {
  ordre: number;
  titre: string;
  date: string | null;
  heure_debut: string | null;
  heure_fin: string | null;
  description: string | null;
  coachs: string | null;
  phase: string;
  ouvert_a_toutes: boolean;
}

async function ateliers(db: PGlite): Promise<AtelierRow[]> {
  // Cast en texte : le vrai pool applique un type-parser DATE→chaîne (src/lib/db.ts) ;
  // PGlite brut renverrait des objets Date/Time. On fige des chaînes ISO stables.
  const { rows } = await db.query<AtelierRow>(
    `SELECT ordre, titre, date::text AS date, heure_debut::text AS heure_debut,
            heure_fin::text AS heure_fin, description, coachs, phase, ouvert_a_toutes
       FROM tremplin_ateliers ORDER BY ordre`,
  );
  return rows;
}

describe("Migration 046 — ateliers phase 3 (DevFest 2026)", () => {
  let seedes: AtelierRow[];

  beforeAll(async () => {
    const db = await baseAvecEdition(2026);
    await db.exec(migrationSql);
    seedes = await ateliers(db);
    await db.close();
  }, 60_000);

  it("insère 10 ateliers, tous en phase « montée sur scène »", () => {
    expect(seedes).toHaveLength(10);
    expect(seedes.every((a) => a.phase === "montee_sur_scene")).toBe(true);
  });

  it("les ouvre à toutes (parcours public)", () => {
    expect(seedes.every((a) => a.ouvert_a_toutes === true)).toBe(true);
  });

  it("les ordonne après les 5 ateliers de la phase 1 (ordre 6 à 15)", () => {
    expect(seedes.map((a) => a.ordre)).toEqual([6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  });

  it("date et horaires des séances présentielles fixes", () => {
    const lancement = seedes.find((a) => a.titre === "Lancement et structure du talk");
    expect(lancement?.date).toBe("2026-09-01");
    expect(lancement?.heure_debut).toBe("18:00:00");
    expect(lancement?.heure_fin).toBe("20:20:00");
    const debrief = seedes.find((a) => a.titre === "Débrief");
    expect(debrief?.date).toBe("2026-11-24");
  });

  it("séances hebdomadaires laissées « à dater » (date nulle)", () => {
    const revue = seedes.find((a) => a.titre === "Revue croisée entre speakeuses (1)");
    expect(revue?.date).toBeNull();
    expect(revue?.heure_debut).toBeNull();
  });

  it("aucune donnée personnelle : ni coach nominatif ni prénom de participante", () => {
    // Les binômes et l'affectation des coachs se gèrent dans l'admin, hors git.
    const noms = ["Rachel", "Virginie", "Montaine", "Aurélie", "Sandrine", "Cateline",
      "Asma", "Leila", "Leïla", "Camille", "Géraldine"];
    for (const a of seedes) {
      expect(a.coachs).toBeNull();
      const texte = `${a.titre} ${a.description ?? ""}`;
      for (const nom of noms) expect(texte).not.toContain(nom);
    }
  });

  it("respecte la cohérence date ↔ phase (séances datées après la finale du 4 juin)", () => {
    for (const a of seedes) {
      if (a.date) expect(a.date >= "2026-06-04").toBe(true);
    }
  });

  it("est idempotent : rejouer la migration ne crée pas de doublon", async () => {
    const db = await baseAvecEdition(2026);
    await db.exec(migrationSql);
    await db.exec(migrationSql);
    expect(await ateliers(db)).toHaveLength(10);
    await db.close();
  }, 60_000);

  it("no-op quand l'édition 2026 est absente (autre année seulement)", async () => {
    const db = await baseAvecEdition(2025);
    await db.exec(migrationSql);
    expect(await ateliers(db)).toHaveLength(0);
    await db.close();
  }, 60_000);

  it("no-op sur base vierge (aucune édition)", async () => {
    const db = await baseAvecEdition(null);
    await db.exec(migrationSql);
    expect(await ateliers(db)).toHaveLength(0);
    await db.close();
  }, 60_000);
});
