// Applique db/sync-to-latest.sql à la base pointée par DATABASE_URL.
//
// Utilisé par le déploiement (GitHub Actions) pour synchroniser le schéma AVANT
// de livrer le nouveau code : `sync-to-latest.sql` est idempotent et additif
// (il crée les tables/colonnes manquantes, ne supprime rien), donc rejouable
// sans risque à chaque déploiement. On réutilise le même pilote `pg` et la même
// chaîne de connexion (SSL compris) que l'application (src/lib/db.ts), pour un
// comportement identique en CI et en prod.
//
// Le fichier est envoyé en UNE requête simple : Postgres l'exécute dans une
// transaction implicite unique (aucun BEGIN/COMMIT explicite dans le script,
// seulement des blocs DO $$ … $$) → tout ou rien.

import { readFileSync } from "node:fs";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL absent : migration impossible.");
  process.exit(1);
}

const sql = readFileSync(new URL("../db/sync-to-latest.sql", import.meta.url), "utf8");

const client = new pg.Client({
  connectionString,
  // Un peu large : la base Neon peut « démarrer à froid » (cold start).
  connectionTimeoutMillis: 20_000,
  statement_timeout: 120_000,
});

try {
  await client.connect();
  await client.query(sql);
  console.log("Migration (sync-to-latest.sql) appliquée : OK.");
} catch (err) {
  console.error("Migration en échec :", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
