// Seed des contenus : importe les actualités historiques (src/data/actualites.ts)
// dans la table `contenus` comme PUBLICATIONS. Idempotent (ON CONFLICT slug).
//
// IMPORTANT : les entrées seedées sont marquées `au_flux = false` → elles
// n'entrent PAS dans le flux RSS, donc ne repartent PAS sur LinkedIn (c'est de
// l'ancien). Seul le contenu publié via l'admin ensuite est diffusé.

import { pool } from "@/lib/db";
import { slugify } from "@/lib/slug";
import { allActualites, parseFrenchDate } from "@/data/actualites";

/** Timestamp FR → 'YYYY-MM-DD' (getters locaux, cohérents avec parseFrenchDate). */
function toIsoDate(ts: number): string {
  const d = new Date(ts);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Insère les actualités historiques comme publications publiées, hors flux.
 * Rejouable : les slugs déjà présents sont ignorés. Renvoie le nombre ajouté.
 */
export async function seedContenus(): Promise<number> {
  let inserees = 0;
  for (const a of allActualites) {
    const slug = slugify(a.title);
    if (!slug) continue;
    // Séparateur « · » (pas de cadratin dans le contenu affiché, cf. conventions).
    const chapo = a.speaker ? `${a.speaker} · ${a.description}` : a.description;
    const res = await pool.query(
      `INSERT INTO contenus
         (type, slug, titre, chapo, corps, categorie, tag, lien, lien_externe, lien_label,
          statut, publie_le, au_flux)
       VALUES ('publication', $1, $2, $3, '', $4, $5, $6, $7, $8, 'publie', $9, FALSE)
       ON CONFLICT (slug) DO NOTHING`,
      [
        slug,
        a.title,
        chapo,
        a.category,
        a.tag,
        a.link ?? null,
        a.externalLink ?? null,
        a.externalLinkLabel ?? null,
        toIsoDate(parseFrenchDate(a.date)),
      ],
    );
    inserees += res.rowCount ?? 0;
  }
  return inserees;
}
