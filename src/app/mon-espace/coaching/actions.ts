"use server";

import { revalidatePath } from "next/cache";
import { requireCoachId } from "@/lib/auth-guards";
import { parseDocumentForm } from "@/lib/tremplin-form";
import { addDocumentAsCoach, deleteOwnDocument } from "@/lib/tremplin-coachs";
import { formValues, type ActionState } from "@/lib/action-state";

export type CoachDocumentState = ActionState<{ titre: string }>;
export type CoachDeleteState = ActionState<object>;

/**
 * Dépôt d'un document par un COACH : support pour un de SES ateliers ou
 * document de suivi pour une de SES coachées. La liaison coach ↔ cible est
 * re-vérifiée dans la requête d'insertion elle-même : un id forgé ne passe
 * pas, quelle que soit la saisie. Pas de portée « générale » pour un coach.
 */
export async function addCoachDocumentAction(
  _prev: CoachDocumentState,
  formData: FormData,
): Promise<CoachDocumentState> {
  const coachId = await requireCoachId();
  const err = (error: string): CoachDocumentState => ({
    status: "error",
    error,
    values: formValues(formData),
  });

  const editionId = Number(formData.get("editionId"));
  if (!Number.isInteger(editionId) || editionId <= 0) return err("Édition invalide.");

  const parsed = parseDocumentForm(formData, coachId);
  if (!parsed.ok) return err(parsed.error);
  const { atelierId, registrationId, type, titre, lien, contenu } = parsed.data;
  if (atelierId === null && registrationId === null) {
    return err("Choisis un de tes ateliers ou une de tes coachées.");
  }

  const ok = await addDocumentAsCoach(coachId, editionId, {
    type,
    titre,
    lien,
    contenu,
    atelierId,
    registrationId,
  });
  if (!ok) {
    return err("Cible introuvable : tu ne peux déposer que pour tes ateliers et tes coachées.");
  }

  revalidatePath(`/mon-espace/coaching/${editionId}`);
  revalidatePath(`/admin/tremplins/${editionId}`, "layout");
  revalidatePath(`/mon-espace/tremplin/${editionId}`);
  return { status: "success", titre };
}

/** Suppression par le coach de SES dépôts uniquement (auteur). */
export async function deleteOwnDocumentAction(
  _prev: CoachDeleteState,
  formData: FormData,
): Promise<CoachDeleteState> {
  const coachId = await requireCoachId();
  const err = (error: string): CoachDeleteState => ({
    status: "error",
    error,
    values: formValues(formData),
  });

  const editionId = Number(formData.get("editionId"));
  const documentId = Number(formData.get("documentId"));
  if (!Number.isInteger(editionId) || editionId <= 0) return err("Édition invalide.");
  if (!Number.isInteger(documentId) || documentId <= 0) return err("Document invalide.");

  const ok = await deleteOwnDocument(coachId, documentId, editionId);
  if (!ok) return err("Tu ne peux supprimer que les documents que tu as déposés.");

  revalidatePath(`/mon-espace/coaching/${editionId}`);
  revalidatePath(`/admin/tremplins/${editionId}`, "layout");
  revalidatePath(`/mon-espace/tremplin/${editionId}`);
  return { status: "success" };
}
