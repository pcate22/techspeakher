/**
 * Le VOCABULAIRE des contenus éditoriaux : catégories (type de contenu) et
 * tags (temporalité). Contenu statique, donc `src/data` — et surtout un module
 * SANS dépendance.
 *
 * Il vivait dans `src/lib/contenu-form.ts`, qui construit ses schémas Zod au
 * niveau module : y puiser depuis l'index de recherche tirait `zod` (et sa
 * grappe de validation) dans le bundle client du header, présent sur toutes les
 * pages publiques. `contenu-form` réexporte ces deux listes, donc les imports
 * existants continuent de marcher.
 *
 * « Behind the Scenes » est notre marque pour les interviews : c'est le libellé
 * affiché sur la chip des cartes et des articles (migration 058 a renommé les
 * anciennes lignes « Interview »).
 */
// « Conseils de speakeuse » (lot N3, tranché le 2026-08-08) : la catégorie
// des articles écrits par les membres — astuces, REX, conseils. Proposée par
// défaut dans leur éditeur ; le rangement reste au choix.
/** LA catégorie des conseils (lot N3) : le fil en dérive son intitulé de lien
 * (« Lire le conseil ») — une seule copie de la chaîne. */
export const CATEGORIE_CONSEIL = "Conseils de speakeuse";

export const CATEGORIES = [
  "Meetup & Talk",
  "Behind the Scenes",
  "Tremplin",
  "Communauté",
  CATEGORIE_CONSEIL,
] as const;

/** Temporalité affichée d'une publication. */
export const TAGS = ["À venir", "En cours", "Passé"] as const;
