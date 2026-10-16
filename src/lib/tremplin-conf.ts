/**
 * Routage « hub d'une conférence ».
 *
 * Certaines conférences ont une page éditoriale riche et dédiée (ex. le DevFest
 * Toulouse, sur `/devfest-toulouse`). Pour celles-là, on ne veut pas d'une page
 * générique `/tremplin/[conf]` qui dupliquerait le contenu : on réutilise la
 * page existante comme hub des éditions. Les autres confs (sans page dédiée)
 * tombent sur la page générique `/tremplin/[conf]`.
 *
 * Une seule source de vérité ici, utilisée par :
 *  - `/tremplin/[conf]` (redirige vers la page dédiée si elle existe) ;
 *  - la page d'édition `/tremplin/[conf]/[annee]` (fil d'Ariane + bouton retour).
 */

/**
 * Nom affiché d'une conférence, composé de la marque et de son lieu (ville OU
 * pays), tel que les organisateurs la nomment : « DevFest » + « Toulouse » →
 * « DevFest Toulouse », « Devoxx » + « France » → « Devoxx France ». Le lieu est
 * optionnel (Mix-IT, Agile on the Beach n'en ont pas). L'ANNÉE n'y figure jamais :
 * c'est l'édition. Pur (importable côté client), source unique d'affichage. Si la
 * marque manque, on renvoie le lieu seul, sinon "" (le libellé de repli, ex.
 * « Conférence », reste à la charge de l'appelant, comme aujourd'hui). */
export function nomConference(
  confNom: string | null | undefined,
  confLieu: string | null | undefined,
): string {
  return [confNom, confLieu].map((s) => s?.trim() ?? "").filter(Boolean).join(" ");
}

/** Slug de conf → chemin de sa page éditoriale dédiée (hub des éditions). */
const CONF_DEDICATED_PAGE: Record<string, string> = {
  "devfest-toulouse": "/devfest-toulouse",
};

/** Chemin de la page éditoriale dédiée d'une conf, ou `null` si elle n'en a pas. */
export function confDedicatedPage(confSlug: string): string | null {
  return CONF_DEDICATED_PAGE[confSlug] ?? null;
}

/**
 * URL du hub des éditions d'une conf : sa page dédiée si elle existe, sinon la
 * page générique `/tremplin/[conf]`.
 */
export function confHubHref(confSlug: string): string {
  return confDedicatedPage(confSlug) ?? `/tremplin/${confSlug}`;
}
