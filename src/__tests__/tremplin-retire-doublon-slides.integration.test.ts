// @vitest-environment node
/**
 * Migration 048 — retrait du doublon « Réussir ses slides » (DevFest 2026).
 * On exécute les VRAIS fichiers SQL dans un Postgres réel (PGlite) :
 *  - l'atelier VIDE est supprimé ; un atelier investi (membre/support) est gardé ;
 *  - idempotent (2ᵉ passage = no-op) ;
 *  - le seed 046 de sync-to-latest.sql ne le recrée plus (ligne retirée) —
 *    sans quoi la suppression serait annulée à chaque déploiement.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const schemaSql = readFileSync(resolve(process.cwd(), "db/schema.sql"), "utf8");
const syncSql = readFileSync(resolve(process.cwd(), "db/sync-to-latest.sql"), "utf8");
const m046 = readFileSync(
  resolve(process.cwd(), "db/migrations/046_tremplin_phase3_ateliers.sql"),
  "utf8",
);
const m048 = readFileSync(
  resolve(process.cwd(), "db/migrations/048_retire_doublon_slides.sql"),
  "utf8",
);

async function baseAvecPhase3(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(schemaSql);
  await db.query(
    `INSERT INTO tremplin_editions (nom, annee, conf_slug, statut, finale_date)
     VALUES ('Tremplin 2026', 2026, 'devfest-toulouse', 'en_cours', '2026-06-04')`,
  );
  await db.exec(m046); // recrée l'état de prod : les 10 ateliers, dont le doublon
  return db;
}

const compte = async (db: PGlite): Promise<number> => {
  const { rows } = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM tremplin_ateliers WHERE titre = 'Réussir ses slides'`,
  );
  return rows[0].n;
};

describe("Migration 048 — retrait du doublon « Réussir ses slides »", () => {
  it("supprime l'atelier resté vide, et reste idempotente", async () => {
    const db = await baseAvecPhase3();
    expect(await compte(db)).toBe(1);
    await db.exec(m048);
    expect(await compte(db)).toBe(0);
    await db.exec(m048); // no-op
    expect(await compte(db)).toBe(0);
    await db.close();
  }, 60_000);

  it("refuse de supprimer un atelier investi (une participante inscrite)", async () => {
    const db = await baseAvecPhase3();
    await db.query(
      `INSERT INTO tremplin_registrations (edition_id, participante_nom, statut)
       VALUES (1, 'Test Investie', 'acceptee')`,
    );
    await db.query(
      `INSERT INTO tremplin_atelier_membres (atelier_id, registration_id)
       SELECT a.id, 1 FROM tremplin_ateliers a WHERE a.titre = 'Réussir ses slides'`,
    );
    await db.exec(m048);
    expect(await compte(db)).toBe(1); // gardé
    await db.close();
  }, 60_000);

  it("le seed 046 de sync-to-latest ne recrée plus l'atelier retiré", () => {
    // Garde anti-régression TEXTUELLE : la ligne du doublon ne doit pas revenir
    // dans le fichier opérationnel (le NOT EXISTS par titre le ressusciterait
    // en prod à chaque déploiement).
    const seed046 = syncSql.slice(0, syncSql.indexOf("migration 048"));
    expect(seed046).not.toContain("'Réussir ses slides'");
    // La migration historique 046, elle, ne change pas (README : historique).
    expect(m046).toContain("'Réussir ses slides'");
  });

  it("sync-to-latest complet : seed 046 amendé puis 048 → le doublon est absent au bout", async () => {
    const db = new PGlite();
    await db.exec(syncSql); // base vierge : pas d'édition 2026 → seed no-op, 048 no-op
    await db.query(
      `INSERT INTO tremplin_editions (nom, annee, conf_slug, statut)
       VALUES ('Tremplin 2026', 2026, 'devfest-toulouse', 'en_cours')`,
    );
    await db.exec(syncSql); // rejoue TOUT (déploiement suivant) : seed insère sans le doublon
    expect(await compte(db)).toBe(0);
    const { rows } = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM tremplin_ateliers WHERE phase = 'montee_sur_scene'`,
    );
    expect(rows[0].n).toBe(9); // 10 - le doublon retiré
    await db.close();
  }, 120_000);
});
