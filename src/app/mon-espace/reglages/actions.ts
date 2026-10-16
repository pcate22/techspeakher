"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth-guards";
import { setAbonnement } from "@/lib/newsletter";
import { setRappelCadence } from "@/lib/profiles";
import { cadenceValide, type CadenceRappel } from "@/lib/cadence-rappels";
import { formValues, type ActionState } from "@/lib/action-state";

export type ReglageActionState = ActionState<{ abonnee: boolean }>;

export type CadenceActionState = ActionState<{ cadence: CadenceRappel | null }>;

/**
 * S'abonner ou se désabonner de la lettre d'information, depuis ses réglages.
 *
 * L'identité vient de la SESSION : le formulaire ne porte que la valeur voulue,
 * jamais l'identifiant du compte — sinon on pourrait désabonner quelqu'un
 * d'autre en changeant un champ caché.
 *
 * Les e-mails de service restent hors de portée de ce réglage, exprès.
 */
export async function setNewsletterAction(
  _prev: ReglageActionState,
  formData: FormData,
): Promise<ReglageActionState> {
  const userId = await requireUserId();
  // `present` = la valeur CIBLE, posée par SettingToggle.
  const abonnee = (formData.get("present") ?? "").toString() === "true";

  try {
    await setAbonnement(userId, abonnee);
  } catch (e) {
    console.error("Abonnement à la lettre d'information échoué", userId, e);
    return {
      status: "error",
      error:
        "Enregistrement impossible : réessaie ; si ça persiste, préviens l'équipe technique.",
      values: formValues(formData),
    };
  }

  revalidatePath("/mon-espace/reglages");
  return { status: "success", abonnee };
}

/**
 * Choisir la fréquence des RAPPELS sur sa fiche (cf.
 * `docs/conception-cadence-rappels.md`).
 *
 * Comme pour la lettre d'information, l'identité vient de la SESSION : le
 * formulaire ne porte que la valeur voulue. Un identifiant de compte dans un
 * champ caché permettrait de régler la préférence de quelqu'un d'autre.
 *
 * Une valeur inconnue retombe sur `null` (« laisse l'équipe décider ») plutôt
 * que de partir en base : la colonne a bien une contrainte, mais mieux vaut un
 * défaut sensé qu'une erreur 500 sur un réglage.
 *
 * Ce que cette action NE touche PAS, exprès : les e-mails de compte (lien de
 * connexion, décision sur la fiche, message reçu). Ils annoncent un fait ; seuls
 * les rappels, qui reviennent, se règlent.
 */
export async function setCadenceRappelAction(
  _prev: CadenceActionState,
  formData: FormData,
): Promise<CadenceActionState> {
  const userId = await requireUserId();
  const cadence = cadenceValide(formData.get("cadence"));

  try {
    // Aucune ligne touchée = aucune fiche à régler : le dire, plutôt que
    // d'annoncer « Choix enregistré » pour une écriture qui n'a rien écrit.
    if (!(await setRappelCadence(userId, cadence))) {
      return {
        status: "error",
        error:
          "Ces rappels portent sur ta fiche speakeuse : commence-la, et le réglage s'appliquera.",
        values: formValues(formData),
      };
    }
  } catch (e) {
    console.error("Enregistrement de la cadence de rappel échoué", userId, e);
    return {
      status: "error",
      error:
        "Enregistrement impossible : réessaie ; si ça persiste, préviens l'équipe technique.",
      values: formValues(formData),
    };
  }

  revalidatePath("/mon-espace/reglages");
  return { status: "success", cadence };
}
