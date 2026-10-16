import type { Contenu } from "@/lib/contenus";

/**
 * URL publique CANONIQUE d'un contenu (la page où il vit sur le site), ou
 * `null` s'il n'en a pas encore (brouillon). Un article (publication AVEC
 * corps) a sa page `/articles/slug` ; une publication sans corps est une
 * annonce qui vit sur `/actualites` ; une page a son slug racine.
 *
 * Sert les liens « Voir » de l'admin (page d'édition + éditeur). À NE PAS
 * confondre avec la destination du CTA d'une carte ou d'une annonce (cf.
 * `toCarte`), qui peut viser un lien externe/interne : ici on renvoie la page
 * du site elle-même.
 *
 * Module SANS dépendance à la base (`Contenu` importé en `import type`, effacé
 * au build) : l'éditeur est un composant client, importer `@/lib/contenus`
 * (→ `pg`) y casserait le bundle navigateur.
 */
export function lienPublicContenu(
  c: Pick<Contenu, "type" | "corps" | "slug" | "statut">,
): string | null {
  if (c.statut !== "publie") return null;
  if (c.type === "page") return `/${c.slug}`;
  return c.corps.trim() ? `/articles/${c.slug}` : "/actualites";
}
