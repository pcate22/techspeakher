// @vitest-environment node
/**
 * Migration 031 — « ouvert à toutes » devient une propriété EXPLICITE de
 * l'atelier (opt-in), à la place de l'implicite « aucun membre = ouvert ».
 *
 * Le point délicat est le BACKFILL une-fois : les ateliers existants SANS
 * membre étaient ouverts DE FAIT ; il faut préserver ce comportement, mais
 * SANS jamais rejouer (sinon une refermeture manuelle serait écrasée au
 * prochain déploiement). Le drift-test n'attrape pas ça : il exécute chaque
 * fichier UNE fois sur une base VIERGE, jamais sur une base pré-031 peuplée.
 *
 * On construit donc une base LEGACY (tremplin_ateliers SANS la colonne), on la
 * peuple (un atelier avec membre, un sans), on applique la migration, puis on
 * vérifie le backfill et l'idempotence stricte (2e passage = no-op, une
 * refermeture manuelle survivante). Le même bloc gardé vit à l'identique dans
 * `sync-to-latest.sql` : on le teste aussi.
 */
import { describe, it, expect } from "vitest";

// PGlite (wasm) : au-delà des 5 s par défaut.
const TIMEOUT = 60_000;
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const migration031 = readFileSync(
  resolve(process.cwd(), "db/migrations/031_atelier_ouvert_a_toutes.sql"),
  "utf8",
);
// Le bloc 031 tel qu'embarqué dans le sync idempotent (mêmes garde + backfill).
const syncSql = readFileSync(resolve(process.cwd(), "db/sync-to-latest.sql"), "utf8");
const bloc031DuSync = (() => {
  const debut = syncSql.indexOf("-- Migration 031");
  const fin = syncSql.indexOf("END $$;", debut) + "END $$;".length;
  return syncSql.slice(debut, fin);
})();

/** Base LEGACY minimale, état prod PRÉ-031 (tremplin_ateliers sans la colonne). */
const LEGACY_DDL = `
CREATE TABLE tremplin_editions (
  id SERIAL PRIMARY KEY,
  nom TEXT NOT NULL,
  annee INTEGER NOT NULL
);
CREATE TABLE tremplin_registrations (
  id SERIAL PRIMARY KEY,
  edition_id INTEGER NOT NULL REFERENCES tremplin_editions(id) ON DELETE CASCADE,
  participante_nom TEXT
);
CREATE TABLE tremplin_ateliers (
  id SERIAL PRIMARY KEY,
  edition_id INTEGER NOT NULL REFERENCES tremplin_editions(id) ON DELETE CASCADE,
  titre TEXT NOT NULL
);
CREATE TABLE tremplin_atelier_membres (
  atelier_id INTEGER NOT NULL REFERENCES tremplin_ateliers(id) ON DELETE CASCADE,
  registration_id INTEGER NOT NULL REFERENCES tremplin_registrations(id) ON DELETE CASCADE,
  PRIMARY KEY (atelier_id, registration_id)
);
`;

/** Deux ateliers : « avec-membre » (fermé de fait) et « sans-membre » (ouvert de fait). */
async function seedLegacy(db: PGlite) {
  await db.exec(`
    INSERT INTO tremplin_editions (nom, annee) VALUES ('Tremplin 2025', 2025);
    INSERT INTO tremplin_registrations (edition_id, participante_nom) VALUES (1, 'Léa');
    INSERT INTO tremplin_ateliers (edition_id, titre) VALUES
      (1, 'avec-membre'),   -- id 1 : fermé de fait
      (1, 'sans-membre');   -- id 2 : ouvert de fait
    INSERT INTO tremplin_atelier_membres (atelier_id, registration_id) VALUES (1, 1);
  `);
}

async function ouverturePar(db: PGlite): Promise<Record<string, boolean>> {
  const r = await db.query<{ titre: string; ouvert_a_toutes: boolean }>(
    `SELECT titre, ouvert_a_toutes FROM tremplin_ateliers ORDER BY id`,
  );
  return Object.fromEntries(r.rows.map((a) => [a.titre, a.ouvert_a_toutes]));
}

for (const [label, sql] of [
  ["migrations/031_atelier_ouvert_a_toutes.sql", migration031],
  ["sync-to-latest.sql (bloc 031)", bloc031DuSync],
] as const) {
  describe(`backfill « ouvert à toutes » via ${label}`, () => {
    it("préserve le comportement : sans membre → ouvert, avec membre → fermé", async () => {
      const db = new PGlite();
      await db.exec(LEGACY_DDL);
      await seedLegacy(db);

      await db.exec(sql);

      expect(await ouverturePar(db)).toEqual({
        "avec-membre": false, // avait un membre : réservé, reste fermé
        "sans-membre": true, // ouvert de fait : préservé une fois
      });
      await db.close();
    }, TIMEOUT);

    it("idempotent : une refermeture manuelle n'est PAS rouverte au 2e passage", async () => {
      const db = new PGlite();
      await db.exec(LEGACY_DDL);
      await seedLegacy(db);

      await db.exec(sql);
      // L'orga referme manuellement l'atelier « sans-membre » (toujours sans membre).
      await db.exec(
        `UPDATE tremplin_ateliers SET ouvert_a_toutes = false WHERE titre = 'sans-membre'`,
      );
      // Redéploiement : le bloc est rejoué et ne doit RIEN toucher (colonne déjà là).
      await db.exec(sql);

      expect(await ouverturePar(db)).toEqual({
        "avec-membre": false,
        "sans-membre": false, // refermeture survivante
      });
      await db.close();
    }, TIMEOUT);
  });
}
