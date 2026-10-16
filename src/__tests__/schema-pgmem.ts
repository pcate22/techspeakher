import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * `db/schema.sql` SANS les fonctions plpgsql ni les triggers.
 *
 * Les tests d'intégration des libs tournent sur **pg-mem** (émulateur JS), qui
 * ne parse pas le plpgsql — charger le schéma complet échouerait. Ces tests ne
 * vérifient que des fonctions d'accès JS ; ils n'ont pas besoin des triggers.
 * `schema.sql` n'en définit plus aucun depuis le retrait du miroir `sujet`
 * (migration 035) ; le stripping reste par sécurité, pour que pg-mem continue de
 * charger le schéma si une fonction/trigger était réintroduite. L'alignement
 * schema.sql ↔ sync-to-latest.sql est vérifié par `db-schema-drift.test.ts`.
 */
export function schemaForPgMem(): string {
  return readFileSync(resolve(process.cwd(), "db/schema.sql"), "utf8")
    .replace(/CREATE OR REPLACE FUNCTION[\s\S]*?\$\$[\s\S]*?\$\$;/g, "")
    .replace(/(?:DROP|CREATE)\s+TRIGGER[\s\S]*?;/g, "");
}
