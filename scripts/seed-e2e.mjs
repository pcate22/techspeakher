// Pose le DÉCOR de données des tests E2E dans la base pointée par DATABASE_URL.
//
// Applique `db/seed-preview.sql` : le jeu de données fictives que le dépôt
// maintient déjà pour les previews. On ne crée PAS un second jeu de données
// pour les tests — deux jeux dériveraient l'un de l'autre, exactement comme les
// trois copies de `PAGES_PUBLIQUES` avaient divergé (cf. e2e/pages-publiques.ts).
// Un seul décor, maintenu à un seul endroit, sert les deux usages.
//
// RGPD : ce fichier ne contient que des personnes INVENTÉES (@demo.techspeakher.test).
// Il porte en plus son propre garde-fou anti-prod (il refuse de tourner si la
// base contient de vraies speakeuses publiées) — on ne le contourne pas.
//
// Usage : DATABASE_URL=… node scripts/seed-e2e.mjs
// (précédé de `node scripts/migrate.mjs` pour créer le schéma.)

import { readFileSync } from "node:fs";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL absent : impossible de poser le décor.");
  process.exit(1);
}

const sql = readFileSync(new URL("../db/seed-preview.sql", import.meta.url), "utf8");

const client = new pg.Client({
  connectionString,
  connectionTimeoutMillis: 20_000,
  statement_timeout: 120_000,
});

try {
  await client.connect();
  // Le fichier porte ses propres BEGIN/COMMIT : une requête simple suffit, et
  // Postgres applique tout ou rien.
  await client.query(sql);
  const { rows } = await client.query(
    `SELECT count(*)::int AS n FROM speaker_profiles WHERE status = 'publie'`,
  );
  console.log(`Décor E2E posé : OK (${rows[0].n} fiches publiées).`);
} catch (err) {
  console.error("Décor E2E en échec :", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
