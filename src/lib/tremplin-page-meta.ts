import type { Metadata } from "next";
import { getEditionById } from "@/lib/tremplin-editions";

/**
 * Titre de page distinct par ROUTE et par ÉDITION (RGAA 8.5 / WCAG 2.4.2) :
 * « Ateliers · Tremplin 2 | Tech Speak'Her ». Séparateur « · » (le point médian
 * maison) : le cadratin est proscrit du contenu affiché, et l'onglet du
 * navigateur s'affiche. Sans `leaf`, le hub porte le seul nom de l'édition.
 * Pages orga : toujours `robots: noindex`.
 */
export async function tremplinPageMetadata(
  editionRaw: string,
  leaf?: string,
): Promise<Metadata> {
  const editionId = Number(editionRaw);
  const edition = Number.isInteger(editionId) ? await getEditionById(editionId) : null;
  const nom = edition?.nom ?? "Édition Tremplin";
  return {
    title: leaf ? `${leaf} · ${nom} | Tech Speak'Her` : `${nom} | Tech Speak'Her`,
    robots: { index: false },
  };
}
