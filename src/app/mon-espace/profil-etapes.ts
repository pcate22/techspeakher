/**
 * Étapes de l'assistant de profil speakeuse — SOURCE UNIQUE.
 *
 * Les libellés (`ProfileForm`) et les clés de deep-link (`profil/page.tsx`)
 * vivaient dans deux fichiers : insérer une étape en oubliait un des deux, et
 * un `?step=contact` ouvrait alors la mauvaise étape. Les deux se lisent ici.
 */

/** Libellés affichés dans l'indicateur de progression, dans l'ordre. */
export const ETAPES = [
  "Profil",
  // Secteurs et Sujets sont DEUX étapes : empilées, les deux listes (15 + 11
  // cases, une par ligne sur mobile) faisaient ~1400 px, et la seconde légende
  // tombait sous la flottaison sans que rien n'annonce son existence.
  "Secteurs",
  "Sujets",
  // La VILLE de résidence a rejoint « Profil » (elle fait partie de l'en-tête
  // de la fiche) : il ne reste ici que la PORTÉE — où tu te déplaces, en
  // quelles langues. Deux questions différentes, deux endroits.
  "Interventions",
  "Contact",
  "Attestation",
] as const;

/**
 * Clé d'URL (`?step=…`) → index d'étape, pour ouvrir le formulaire au bon
 * endroit depuis Mon espace ou la complétude. Passer par `indexEtape()` : une
 * lecture directe répondrait aussi aux clés du prototype (`?step=constructor`
 * renvoie une fonction, qu'un `?? 0` ne rattrape pas → formulaire vide).
 */
const INDEX_ETAPE: Record<string, number> = {
  profil: 0,
  secteurs: 1,
  sujets: 2,
  // Ancienne clé, gardée valide : les liens « Domaines » de la complétude
  // circulent déjà (Mon espace, e-mails). Elle ouvre la 1ʳᵉ des deux étapes.
  domaines: 1,
  interventions: 3,
  // Ancienne clé, gardée valide : des liens « Localisation » circulent déjà.
  localisation: 3,
  contact: 4,
  attestation: 5,
};

/** Index d'étape pour une clé d'URL, 0 (Profil) si la clé est inconnue. */
export function indexEtape(cle: string | undefined): number {
  if (!cle || !Object.hasOwn(INDEX_ETAPE, cle)) return 0;
  return INDEX_ETAPE[cle];
}

/** Clés reconnues, pour les tests et la documentation des deep-links. */
export const CLES_ETAPE = Object.keys(INDEX_ETAPE);
