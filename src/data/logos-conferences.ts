/**
 * Logos des conférences — déclaratif des fichiers déposés dans
 * `public/conferences/`, servis par NOTRE domaine.
 *
 * Pourquoi pas l'URL du logo chez la conférence ? La CSP du site n'autorise que
 * `img-src 'self'` (+ les CDN d'avatars OAuth) : un logo distant serait bloqué,
 * et l'ouvrir ferait fuiter l'IP de chaque visiteuse vers les sites des confs.
 * Les logos sont donc **rapatriés** (script `npm run logos:conferences`, qui lit
 * `site_url` du catalogue d'amorçage) puis committés.
 *
 * ATTRIBUTION : ces fichiers sont les logos des conférences, reproduits pour
 * **identifier** l'événement où une speakeuse est passée. Ils restent la
 * propriété de leurs titulaires ; une conférence qui souhaite le retrait de son
 * logo écrit à l'association (cf. `src/constants/site.ts`) et on retire la ligne
 * ici + le fichier — l'affichage retombe seul sur le monogramme.
 *
 * Clé = **slug de la conférence dans le registre** (`conferences.slug`, jumeau de
 * `slugify(nom)`), valeur = nom du fichier dans `public/conferences/`. Une conf
 * absente d'ici s'affiche en monogramme (initiales) : rien à faire, aucun trou.
 */

/** Dossier public des logos (préfixe des chemins servis). */
export const DOSSIER_LOGOS = "/conferences";

export const LOGOS_CONFERENCES: Record<string, string> = {
  // Exemple de format (à décommenter quand le fichier est déposé) :
  // "devfest-toulouse": "devfest-toulouse.png",
};

/**
 * Chemin du logo d'une conférence, ou null s'il n'y en a pas (mention libre
 * sans slug, ou conférence dont le logo n'est pas déposé) : l'appelant affiche
 * alors un monogramme.
 */
export function logoConference(slug: string | null | undefined): string | null {
  if (!slug) return null;
  // `Object.hasOwn` et pas un simple accès : un slug légitime peut porter le nom
  // d'une propriété héritée d'Object (une conférence « Constructor » slugifie en
  // « constructor »), et la lecture renverrait alors une valeur du prototype.
  if (!Object.hasOwn(LOGOS_CONFERENCES, slug)) return null;
  const fichier = LOGOS_CONFERENCES[slug];
  return fichier ? `${DOSSIER_LOGOS}/${fichier}` : null;
}
