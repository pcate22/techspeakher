/**
 * Codes `?err=` / `?ok=` des DERNIÈRES actions Tremplin en style redirect
 * (suppressions destructives : participante, récompense, photo, édition — destructif, PRG). Tout le
 * reste est passé au pattern « résultat » (useActionState) : le feedback vit
 * à côté du bouton, nominatif, sans rechargement.
 */

export const TREMPLIN_ERR_MESSAGES: Record<string, string> = {
  retrait: "Impossible de retirer : inscription introuvable pour cette édition.",
  recompense: "Impossible de supprimer : récompense introuvable pour cette édition.",
  photo: "Impossible de supprimer : photo introuvable pour cette édition.",
  edition_nom:
    "Suppression annulée : réécris le nom de l'édition tel qu'il est affiché.",
  participante_nom:
    "Retrait annulé : réécris le nom de la participante tel qu'il est affiché.",
  atelier: "Impossible de supprimer : atelier introuvable pour cette édition.",
};

export const TREMPLIN_OK_MESSAGES: Record<string, string> = {
  participante_retiree: "Participante retirée de l'édition (documents et présences photo effacés).",
  recompense_supprimee: "Récompense supprimée.",
  photo_supprimee: "Photo supprimée.",
  atelier_supprime: "Atelier supprimé (participantes, sous-groupes et supports compris).",
};

/** Libellé d'un code `?err=`, ou null si absent/inconnu. */
export function errMessage(code: string | undefined): string | null {
  return code ? (TREMPLIN_ERR_MESSAGES[code] ?? null) : null;
}

/** Libellé d'un code `?ok=`, ou null si absent/inconnu. */
export function okMessage(code: string | undefined): string | null {
  return code ? (TREMPLIN_OK_MESSAGES[code] ?? null) : null;
}
