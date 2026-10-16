// @vitest-environment node
/**
 * Intégration BDD de la migration 058 : la catégorie « Interview » devient
 * « Behind the Scenes » (notre marque, affichée sur la chip du type de contenu).
 *
 * On exécute la VRAIE migration (db/migrations/058_*.sql) dans un Postgres réel
 * (PGlite) sur le schéma de référence (db/schema.sql). On vérifie :
 *   - le renommage des lignes historiques, sans toucher aux autres catégories ;
 *   - le chapô de l'interview de Rachel : le renvoi « sur LinkedIn » disparaît
 *     (elle se lit sur sa page d'article), MAIS un chapô réécrit par une orga
 *     n'est jamais écrasé ;
 *   - l'idempotence (rejouable, sans churn de `maj_le`).
 */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const NB = " "; // espace insécable, comme dans le contenu affiché
const CHAPO_SEED = `«${NB}On t'a prise parce que t'étais la seule fille.${NB}» Première interview Behind the Scenes, sur LinkedIn.`;
const CHAPO_ATTENDU = `«${NB}On t'a prise parce que t'étais la seule fille.${NB}» Notre première interview Behind the Scenes.`;

const schemaSql = readFileSync(resolve(process.cwd(), "db/schema.sql"), "utf8");
const migrationSql = readFileSync(
  resolve(process.cwd(), "db/migrations/058_categorie_behind_the_scenes.sql"),
  "utf8",
);

let db: PGlite;

interface Row {
  slug: string;
  categorie: string | null;
  chapo: string | null;
  maj_le: string;
}

async function lire(slug: string): Promise<Row> {
  const { rows } = await db.query<Row>(
    `SELECT slug, categorie, chapo, maj_le::text AS maj_le FROM contenus WHERE slug = $1`,
    [slug],
  );
  return rows[0];
}

async function insere(slug: string, categorie: string, chapo: string | null): Promise<void> {
  await db.query(
    `INSERT INTO contenus (type, slug, titre, chapo, corps, categorie, tag, statut, publie_le, au_flux)
     VALUES ('publication', $1, $1, $2, '', $3, 'Passé', 'publie', DATE '2026-03-23', FALSE)`,
    [slug, chapo, categorie],
  );
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(schemaSql);
}, 60_000);

beforeEach(async () => {
  await db.exec("TRUNCATE contenus RESTART IDENTITY CASCADE");
});

describe("migration 058 — catégorie « Behind the Scenes »", () => {
  it("renomme les interviews et laisse les autres catégories intactes", async () => {
    await insere("interview-de-rachel-dubois", "Interview", CHAPO_SEED);
    await insere("midi-medtech", "Meetup & Talk", "Un meetup.");
    await insere("creation-de-tech-speak-her", "Communauté", "Ça a commencé comme ça.");

    await db.exec(migrationSql);

    expect((await lire("interview-de-rachel-dubois")).categorie).toBe("Behind the Scenes");
    expect((await lire("midi-medtech")).categorie).toBe("Meetup & Talk");
    expect((await lire("creation-de-tech-speak-her")).categorie).toBe("Communauté");
  });

  it("retire le renvoi « sur LinkedIn » du chapô de l'interview", async () => {
    await insere("interview-de-rachel-dubois", "Interview", CHAPO_SEED);
    await db.exec(migrationSql);
    const a = await lire("interview-de-rachel-dubois");
    expect(a.chapo).toBe(CHAPO_ATTENDU);
  });

  it("n'écrase pas un chapô réécrit par une orga", async () => {
    await insere("interview-de-rachel-dubois", "Interview", "Chapô maison.");
    await db.exec(migrationSql);
    const a = await lire("interview-de-rachel-dubois");
    expect(a.chapo).toBe("Chapô maison.");
    // Le renommage de catégorie s'applique quand même.
    expect(a.categorie).toBe("Behind the Scenes");
  });

  it("est rejouable : aucune écriture au 2ᵉ passage (maj_le ne churne pas)", async () => {
    await insere("interview-de-rachel-dubois", "Interview", CHAPO_SEED);
    await db.exec(migrationSql);
    const avant = await lire("interview-de-rachel-dubois");
    await db.exec(migrationSql);
    const apres = await lire("interview-de-rachel-dubois");
    expect(apres.categorie).toBe("Behind the Scenes");
    expect(apres.chapo).toBe(CHAPO_ATTENDU);
    expect(apres.maj_le).toBe(avant.maj_le);
  });
});
