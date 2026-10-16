/**
 * LA boîte d'une carte (fond, bordure, réponse au survol) — une seule copie :
 * `CARTE_LIEN` la compose avec le lien, et le fil (lot N4) la pose sur le
 * conteneur quand la rangée Bravo partage la boîte avec le lien.
 */
export const CARTE_BOITE =
  "rounded-xl border border-navy-lighter bg-navy-light transition-colors hover:border-cyan/40";

/**
 * La CARTE-LIEN sobre des rangées de personnes : toute la carte est le lien
 * (cible ≥ 44 px), fond `navy-light`, bordure qui répond au survol, anneau de
 * focus visible. Consommée par `CarteNouvelleVenue` (accueil public) ; les
 * cartes du fil connecté la reprennent. Même précédent que `LIEN_TEXTE`
 * (LienTexte.tsx) : une forme canonique, une constante.
 */
export const CARTE_LIEN = `group flex h-full items-center gap-4 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan ${CARTE_BOITE}`;

/**
 * La même carte-lien SANS sa boîte (lot N4) : quand une rangée (Bravo)
 * partage la boîte avec le lien, c'est le CONTENEUR parent qui porte
 * `CARTE_BOITE` — le lien garde sa cible, son padding et son anneau de focus.
 *
 * Alignée en HAUT (et non centrée comme `CARTE_LIEN`) : une carte du fil
 * empile jusqu'à quatre lignes (nom, titre, détail, intitulé du lien), et
 * l'avatar centré sur ce pavé flottait loin du nom qu'il illustre.
 */
export const CARTE_LIEN_NUE =
  "group flex h-full items-start gap-4 rounded-xl p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan";
