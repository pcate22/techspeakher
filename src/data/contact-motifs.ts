/**
 * Motifs de contact d'une speakeuse (source unique).
 * Sert au menu déroulant du formulaire de contact ET à la validation serveur.
 * La valeur (`value`) est stockée en base (contact_messages.reason) ; le libellé
 * n'existe que pour l'affichage. Toute valeur hors liste est refusée.
 */
export const CONTACT_MOTIFS = [
  { value: "conference", label: "Conférence / table ronde" },
  { value: "jury", label: "Jury" },
  { value: "interview", label: "Interview / podcast" },
  { value: "autre", label: "Autre" },
] as const;

export type ContactMotif = (typeof CONTACT_MOTIFS)[number]["value"];

/** Valeurs autorisées (pour la validation). */
export const CONTACT_MOTIF_VALUES: readonly string[] = CONTACT_MOTIFS.map(
  (m) => m.value,
);

/** Vrai si `v` est un motif connu. */
export function isContactMotif(v: string): v is ContactMotif {
  return CONTACT_MOTIF_VALUES.includes(v);
}

/** Libellé lisible d'un motif (ou le motif brut si inconnu, jamais vide). */
export function contactMotifLabel(v: string): string {
  return CONTACT_MOTIFS.find((m) => m.value === v)?.label ?? v;
}
