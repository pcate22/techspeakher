import { enumererFr } from "@/lib/format";

/**
 * Comment se DÉSIGNE un sous-groupe — par qui est dedans, jamais par un nom
 * saisi.
 *
 * Retour orga : « Ils n'ont pas besoin de noms, juste les participantes au sous
 * groupe et éventuellement une ou plusieurs coachs dedans ». On demandait un
 * libellé à la création (« Binôme 1 », « Binôme 2 »…), et l'écran affichait donc
 * des étiquettes qui ne disaient rien : il fallait ouvrir chaque groupe pour
 * savoir qui le composait. Un libellé DÉRIVÉ ne peut pas être en désaccord avec
 * son contenu, et il n'y a plus de champ à remplir avant de composer.
 *
 * L'énumération française vient de `format.ts` (source unique) : les noms se
 * lisent de la même façon ici, dans le sommaire de « Ma fiche » et dans l'espace
 * de la participante.
 */

/**
 * Le sous-groupe en toutes lettres. Vide (fraîchement créé, pas encore composé),
 * son RANG le désigne : il faut pouvoir l'ouvrir pour y mettre du monde.
 *
 * TOUS les membres sont nommés, sans écourter. On avait borné la liste à trois
 * pour tenir sur une rangée mobile : la quatrième participante d'un groupe
 * n'était alors nommée NULLE PART, sur l'écran qui sert justement à savoir qui
 * est dedans, ni dans la confirmation de suppression, où le périmètre doit être
 * exact. Le débordement est une question de mise en page (deux lignes suffisent
 * à un quatuor), pas une raison de retirer un nom.
 */
export function libelleSousGroupe(nomsMembres: readonly string[], rang: number): string {
  return enumererFr(nomsMembres) || `Sous-groupe ${rang}`;
}

/**
 * Les coachs du sous-groupe, NUS (sans étiquette) : c'est l'appelant qui pose
 * « Coach : » ou « Coachs : » selon sa place. Plusieurs sont désormais
 * possibles (la base n'en acceptait qu'une, cf. migration 052).
 *
 * Aucune est un état NORMAL — une revue croisée entre speakeuses se fait sans
 * coach : on dit « Autonome », pas un manque, et sans étiquette puisque c'est un
 * état et non la valeur d'un attribut.
 */
export function libelleCoachs(noms: readonly string[]): string {
  return enumererFr(noms) || "Autonome";
}

/** « Coach : Sofia » / « Coachs : Sofia et Lucile » / « Autonome ». */
export function libelleCoachsEtiquete(noms: readonly string[]): string {
  const propres = noms.filter((n) => n.trim().length > 0);
  if (propres.length === 0) return "Autonome";
  return `${propres.length > 1 ? "Coachs" : "Coach"}\u00a0: ${enumererFr(propres)}`;
}
