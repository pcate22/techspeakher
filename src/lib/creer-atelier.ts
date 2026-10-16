/**
 * LE contrat du raccourci « Ajouter un atelier » (feuille ➕, lot N1 §2.4) :
 * la feuille construit l'URL, la page ateliers lit le paramètre, la modale
 * le consomme. Un seul module possède la chaîne — producteur et consommateur
 * dérivent ensemble ou pas du tout.
 */
export const PARAM_CREER = "creer";

/** L'URL des ateliers d'une édition, modale d'ajout ouverte d'emblée. */
export function hrefCreerAtelier(editionId: number): string {
  return `/admin/tremplins/${editionId}/ateliers?${PARAM_CREER}=1`;
}
