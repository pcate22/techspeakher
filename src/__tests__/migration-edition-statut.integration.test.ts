// @vitest-environment node
/**
 * Migration 072 — le statut d'une édition du Tremplin : défaut `preparation`
 * (invisible du public) et liste fermée par un CHECK.
 *
 * Ce que le drift-test ne voit pas : il exécute chaque fichier UNE fois, sur
 * une base VIERGE. Ici on prend une base PRÉ-072 peuplée — celle de l'orga,
 * avec des éditions déjà publiées — et on vérifie les deux choses qui comptent
 * au déploiement : la migration ne touche PAS les statuts existants (elle
 * change un défaut, pas les lignes), et un second passage est un no-op strict.
 * Le même bloc gardé vit dans `sync-to-latest.sql`, rejoué à CHAQUE
 * déploiement : c'est lui qu'un défaut d'idempotence casserait, pas le fichier
 * de migration. On teste donc les deux, à l'identique.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";

// PGlite (wasm) : au-delà des 5 s par défaut.
const TIMEOUT = 60_000;

const migration072 = readFileSync(
  resolve(process.cwd(), "db/migrations/072_edition_statut_preparation.sql"),
  "utf8",
);
const syncSql = readFileSync(resolve(process.cwd(), "db/sync-to-latest.sql"), "utf8");
const bloc072DuSync = (() => {
  const debut = syncSql.indexOf("-- 072 : une édition du Tremplin");
  const fin = syncSql.indexOf("END $$;", debut) + "END $$;".length;
  return syncSql.slice(debut, fin);
})();

/** État prod PRÉ-072 : `DEFAULT 'ouvert'`, aucun CHECK. */
const LEGACY_DDL = `
CREATE TABLE tremplin_editions (
  id     SERIAL PRIMARY KEY,
  nom    TEXT NOT NULL,
  annee  INTEGER NOT NULL,
  statut TEXT NOT NULL DEFAULT 'ouvert'
);
`;

async function basePre072(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(LEGACY_DDL);
  await db.exec(`
    INSERT INTO tremplin_editions (nom, annee, statut) VALUES
      ('TSH 2025', 2025, 'archive'),
      ('TSH 2026', 2026, 'ouvert');
  `);
  return db;
}

async function statutsPar(db: PGlite): Promise<Record<string, string>> {
  const r = await db.query<{ nom: string; statut: string }>(
    `SELECT nom, statut FROM tremplin_editions ORDER BY id`,
  );
  return Object.fromEntries(r.rows.map((e) => [e.nom, e.statut]));
}

for (const [label, sql] of [
  ["migrations/072_edition_statut_preparation.sql", migration072],
  ["sync-to-latest.sql (bloc 072)", bloc072DuSync],
] as const) {
  describe(`statut d'édition borné via ${label}`, () => {
    it("ne touche AUCUN statut existant : elle change le défaut, pas les lignes", async () => {
      const db = await basePre072();
      await db.exec(sql);

      expect(await statutsPar(db)).toEqual({ "TSH 2025": "archive", "TSH 2026": "ouvert" });
      // Et la suivante, créée sans statut, naît invisible du public.
      await db.exec(`INSERT INTO tremplin_editions (nom, annee) VALUES ('TSH 2027', 2027)`);
      const { rows } = await db.query<{ statut: string }>(
        `SELECT statut FROM tremplin_editions WHERE nom = 'TSH 2027'`,
      );
      expect(rows[0].statut).toBe("preparation");
      await db.close();
    }, TIMEOUT);

    it("idempotent : un 2e passage ne rejoue rien et ne casse pas sur le CHECK déjà posé", async () => {
      const db = await basePre072();
      await db.exec(sql);
      // Redéploiement : `sync-to-latest.sql` est rejoué EN ENTIER à chaque fois.
      await db.exec(sql);

      expect(await statutsPar(db)).toEqual({ "TSH 2025": "archive", "TSH 2026": "ouvert" });
      // La contrainte n'a pas été posée deux fois (l'ADD nu aurait levé).
      const { rows } = await db.query<{ n: number }>(
        `SELECT COUNT(*)::int AS n FROM pg_constraint
          WHERE conname = 'tremplin_editions_statut_ck'`,
      );
      expect(rows[0].n).toBe(1);
      await db.close();
    }, TIMEOUT);
  });
}
