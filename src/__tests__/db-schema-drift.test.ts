// @vitest-environment node
/**
 * Garde-fou anti-drift : `db/schema.sql` (référence, chargée par les tests) et
 * `db/sync-to-latest.sql` (ce qui tourne RÉELLEMENT sur Neon) sont maintenus à
 * la main, en trois exemplaires avec les migrations. Un drift a déjà eu lieu
 * (index UNIQUE absent de schema.sql, attrapé tard) ; le prochain serait
 * silencieux : contrainte manquante = pas d'erreur, données corrompues.
 *
 * Ici : on exécute chacun des deux fichiers dans un VRAI Postgres (PGlite) et
 * on compare les catalogues (colonnes, contraintes, index). Toute divergence
 * fait échouer la CI avec le détail exact.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const schemaSql = readFileSync(resolve(process.cwd(), "db/schema.sql"), "utf8");
const syncSql = readFileSync(resolve(process.cwd(), "db/sync-to-latest.sql"), "utf8");

interface Snapshot {
  colonnes: unknown[];
  contraintes: unknown[];
  index: unknown[];
  triggers: unknown[];
  fonctions: unknown[];
}

/** Charge un fichier SQL dans une base vierge et photographie son catalogue. */
async function snapshot(sql: string): Promise<Snapshot> {
  const db = new PGlite();
  await db.exec(sql);
  const colonnes = await db.query(
    `SELECT table_name, column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, column_name`,
  );
  const contraintes = await db.query(
    `SELECT conrelid::regclass::text AS table_name, conname,
            pg_get_constraintdef(oid) AS definition
       FROM pg_constraint
      WHERE connamespace = 'public'::regnamespace
      ORDER BY 1, 2`,
  );
  const index = await db.query(
    `SELECT tablename, indexname, indexdef
       FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname`,
  );
  // Triggers + fonctions : un miroir/una invariant porté par un trigger doit
  // exister À L'IDENTIQUE dans schema.sql ET sync-to-latest.sql, sinon un oubli
  // dans l'un des deux passerait silencieusement (le drift qu'on veut attraper).
  const triggers = await db.query(
    `SELECT event_object_table AS table_name, trigger_name, action_timing,
            event_manipulation, action_statement
       FROM information_schema.triggers
      WHERE trigger_schema = 'public'
      ORDER BY 1, 2, 3, 4`,
  );
  const fonctions = await db.query(
    `SELECT proname, pg_get_functiondef(oid) AS definition
       FROM pg_proc
      WHERE pronamespace = 'public'::regnamespace
      ORDER BY proname`,
  );
  await db.close();
  return {
    colonnes: colonnes.rows,
    contraintes: contraintes.rows,
    index: index.rows,
    triggers: triggers.rows,
    fonctions: fonctions.rows,
  };
}

describe("schema.sql ↔ sync-to-latest.sql : même état final", () => {
  let ref: Snapshot; // schema.sql (ce que valident tous les autres tests)
  let sync: Snapshot; // sync-to-latest.sql (ce que la prod exécute)

  beforeAll(async () => {
    [ref, sync] = await Promise.all([snapshot(schemaSql), snapshot(syncSql)]);
  }, 60_000);

  it("mêmes tables et colonnes (nom, type, nullabilité, défaut)", () => {
    expect(sync.colonnes).toEqual(ref.colonnes);
  });

  it("mêmes contraintes (PK, FK, UNIQUE, CHECK — définitions comprises)", () => {
    expect(sync.contraintes).toEqual(ref.contraintes);
  });

  it("mêmes index (noms et définitions)", () => {
    expect(sync.index).toEqual(ref.index);
  });

  it("mêmes triggers", () => {
    expect(sync.triggers).toEqual(ref.triggers);
  });

  it("mêmes fonctions (définitions comprises)", () => {
    expect(sync.fonctions).toEqual(ref.fonctions);
  });
});
