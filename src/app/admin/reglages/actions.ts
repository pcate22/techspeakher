"use server";

import { revalidatePath } from "next/cache";
import { requireOrgaId } from "@/lib/auth-guards";
import {
  setReglage,
  REGLAGES_DEFAUT,
  REGLAGE_MIN,
  REGLAGE_MAX,
  type CleReglage,
} from "@/lib/reglages";
import { formValues, type ActionState } from "@/lib/action-state";

export type ReglageActionState = ActionState;

/**
 * Enregistre UN réglage de plateforme (lot C4). Garde-fous côté serveur :
 * orga seulement, clé connue, entier borné (des jours). Les pages qui dérivent
 * leurs tâches des réglages sont `force-dynamic` (toujours fraîches) ; les
 * revalidations ci-dessous couvrent les entrées de navigation.
 */
export async function setReglageAction(
  _prev: ReglageActionState,
  formData: FormData,
): Promise<ReglageActionState> {
  await requireOrgaId();
  const err = (error: string): ReglageActionState => ({
    status: "error",
    error,
    values: formValues(formData),
  });

  const cle = (formData.get("cle") ?? "").toString();
  // Object.hasOwn : `in` accepterait les clés du prototype (toString…).
  if (!Object.hasOwn(REGLAGES_DEFAUT, cle)) return err("Réglage inconnu.");

  const valeur = Number((formData.get("valeur") ?? "").toString());
  if (!Number.isInteger(valeur) || valeur < REGLAGE_MIN || valeur > REGLAGE_MAX) {
    return err(
      `Choisis un nombre de jours entier entre ${REGLAGE_MIN} et ${REGLAGE_MAX}.`,
    );
  }

  await setReglage(cle as CleReglage, valeur);
  revalidatePath("/admin");
  revalidatePath("/admin/reglages");
  return { status: "success" };
}
