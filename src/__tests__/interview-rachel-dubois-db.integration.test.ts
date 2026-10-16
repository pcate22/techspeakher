// @vitest-environment node
/**
 * Intégration BDD de la migration 047 : le corps de l'article « Interview de
 * Rachel Dubois » (publication du 23/03/26) est chargé dans la table `contenus`,
 * avec les questions en titres Markdown « ## » et les réponses en texte.
 *
 * On exécute la VRAIE migration (db/migrations/047_*.sql) dans un Postgres réel
 * (PGlite) sur le schéma de référence (db/schema.sql), comme les autres tests
 * d'intégration. On vérifie :
 *   - la pose des métadonnées de publication (catégorie, tag, date, hors flux) ;
 *   - le corps : questions en « ## », réponse-citation en blockquote, ressources ;
 *   - l'idempotence (rejouable, une seule ligne) ;
 *   - le chemin UPSERT : sur une ligne préexistante (seed, corps vide), seul le
 *     corps est posé — le chapô déjà en base n'est PAS écrasé (choix orga gardé).
 */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const SLUG = "interview-de-rachel-dubois";
const schemaSql = readFileSync(resolve(process.cwd(), "db/schema.sql"), "utf8");
const migrationSql = readFileSync(
  resolve(process.cwd(), "db/migrations/047_interview_rachel_dubois.sql"),
  "utf8",
);

let db: PGlite;

interface Row {
  type: string;
  titre: string;
  chapo: string | null;
  corps: string;
  categorie: string | null;
  tag: string | null;
  lien_externe: string | null;
  lien_label: string | null;
  statut: string;
  publie_le: string | null;
  au_flux: boolean;
  maj_le: string;
}

async function lireArticle(): Promise<Row | null> {
  const { rows } = await db.query<Row>(
    `SELECT type, titre, chapo, corps, categorie, tag, lien_externe, lien_label,
            statut, to_char(publie_le, 'YYYY-MM-DD') AS publie_le, au_flux,
            maj_le::text AS maj_le
       FROM contenus WHERE slug = $1`,
    [SLUG],
  );
  return rows[0] ?? null;
}

async function compter(): Promise<number> {
  const { rows } = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM contenus WHERE slug = $1`,
    [SLUG],
  );
  return rows[0].n;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(schemaSql);
}, 60_000);

beforeEach(async () => {
  await db.exec("TRUNCATE contenus RESTART IDENTITY CASCADE");
});

describe("migration 047 — corps de l'interview de Rachel Dubois", () => {
  it("insère la publication complète sur une base neuve", async () => {
    await db.exec(migrationSql);
    const a = await lireArticle();
    expect(a).not.toBeNull();
    expect(a!.type).toBe("publication");
    expect(a!.titre).toBe("Interview de Rachel Dubois");
    expect(a!.categorie).toBe("Interview");
    expect(a!.tag).toBe("Passé");
    expect(a!.statut).toBe("publie");
    expect(a!.publie_le).toBe("2026-03-23");
    // Historique : hors flux RSS (pas de repost LinkedIn automatique).
    expect(a!.au_flux).toBe(false);
    expect(a!.lien_externe).toContain("linkedin.com");
  });

  it("charge le corps : questions en titres, réponses en texte", async () => {
    await db.exec(migrationSql);
    const { corps } = (await lireArticle())!;

    // Chaque question de l'interview est un titre Markdown de niveau 2 (« ## »
    // → h2 côté rendu) : 30 questions + le titre « ressources » = 31 titres.
    const titres = corps.match(/^## /gm) ?? [];
    expect(titres.length).toBe(31);

    // Première et dernière question posées.
    expect(corps).toContain(
      "## Peux-tu nous raconter qui tu es dans la tech et ce que tu fais au quotidien ?",
    );
    expect(corps).toContain("## Un petit mot de la fin ?");

    // La phrase-titre de l'interview, mise en exergue (blockquote Markdown).
    expect(corps).toContain("> On t’a prise parce que t’étais la seule fille.");

    // Un extrait de réponse (texte), preuve que le contenu de fond est là.
    expect(corps).toContain("Toastmasters International");
    expect(corps).toContain("## Les ressources indispensables pour Rachel Dubois");

    // Qualité FR : pas de cadratin dans le contenu affiché (convention projet).
    expect(corps).not.toContain("—");
  });

  it("est idempotente : rejouable sans doublon, sans réécrire le corps ni bumper maj_le", async () => {
    await db.exec(migrationSql);
    const avant = (await lireArticle())!;
    await db.exec(migrationSql);
    const apres = (await lireArticle())!;
    expect(await compter()).toBe(1);
    expect(apres.corps).toBe(avant.corps);
    // Le garde `WHERE corps IS DISTINCT FROM EXCLUDED` évite toute écriture au 2ᵉ
    // passage : maj_le ne bouge pas (sinon il churnerait à chaque déploiement).
    expect(apres.maj_le).toBe(avant.maj_le);
  });

  it("UPSERT : pose le corps sur une ligne seedée sans écraser le chapô orga", async () => {
    // Simule l'état prod : la publication existe déjà (seed des actualités
    // historiques) avec un corps vide et un chapô propre.
    await db.query(
      `INSERT INTO contenus (type, slug, titre, chapo, corps, categorie, tag, statut, publie_le, au_flux)
       VALUES ('publication', $1, 'Interview de Rachel Dubois', 'CHAPÔ SEED', '', 'Interview', 'Passé', 'publie', DATE '2026-03-23', FALSE)`,
      [SLUG],
    );

    await db.exec(migrationSql);

    const a = (await lireArticle())!;
    expect(await compter()).toBe(1);
    // Le corps est désormais rempli…
    expect(a.corps).toContain("## Un petit mot de la fin ?");
    // …mais le chapô déjà en base est préservé (DO UPDATE ne touche qu'au corps).
    expect(a.chapo).toBe("CHAPÔ SEED");
  });
});
