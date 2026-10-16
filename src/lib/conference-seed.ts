// Amorçage de la référence des conférences (lot 2) : insère le catalogue
// statique src/data/conferences-seed.ts. Idempotent (ON CONFLICT slug DO
// NOTHING) : rejouable, et ne réécrit JAMAIS une conférence existante (l'orga
// a pu corriger ses métadonnées). Déclenché depuis l'UI orga (lot 3).

import { pool } from "@/lib/db";
import { CONFERENCES_SEED } from "@/data/conferences-seed";
import { slugifyConference } from "@/lib/conferences";

/** Insère les conférences manquantes du catalogue ; renvoie le nombre créé. */
export async function seedConferences(): Promise<number> {
  let inserted = 0;
  for (const c of CONFERENCES_SEED) {
    const { rowCount } = await pool.query(
      `INSERT INTO conferences (slug, nom, type, ville, pays, site_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (slug) DO NOTHING`,
      [slugifyConference(c.nom), c.nom, c.type, c.ville, c.pays, c.siteUrl],
    );
    inserted += rowCount ?? 0;
  }
  return inserted;
}
