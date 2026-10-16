"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth-guards";
import {
  setOwnRegistrationVisibility,
  setOwnRegistrationTalk,
} from "@/lib/tremplin-registrations";
import { setSousGroupeFaitLeCommeMembre } from "@/lib/tremplin-ateliers";
import { ensureProfileId } from "@/lib/profiles";
import { getTalkById } from "@/lib/talks";
import { formValues, type ActionState } from "@/lib/action-state";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type MaVisibiliteState = ActionState<object>;

/**
 * La participante décide ELLE-MÊME de sa visibilité sur la page publique de
 * l'édition (le consentement lui appartient ; l'orga garde une main de secours
 * côté admin pour les personnes sans compte). Scopée au compte connecté,
 * journalisée comme la version orga, et la page publique est revalidée : un
 * retrait est effectif immédiatement.
 */
export async function setMaVisibiliteAction(
  _prev: MaVisibiliteState,
  formData: FormData,
): Promise<MaVisibiliteState> {
  const userId = await requireUserId();
  const err = (error: string): MaVisibiliteState => ({
    status: "error",
    error,
    values: formValues(formData),
  });

  const editionId = Number(formData.get("editionId"));
  if (!Number.isInteger(editionId) || editionId <= 0) return err("Édition invalide.");
  const isPublic = (formData.get("public") ?? "").toString() === "true";

  const ok = await setOwnRegistrationVisibility(userId, editionId, isPublic);
  if (!ok) {
    return err("Inscription introuvable pour cette édition.");
  }

  revalidatePath(`/mon-espace/tremplin/${editionId}`);
  revalidatePath(`/admin/tremplins/${editionId}`, "layout");
  revalidatePath("/tremplin/[conf]/[annee]", "page");
  return { status: "success" };
}

/**
 * La participante désigne (ou retire avec « Aucun ») le talk qu'elle pitche au
 * Tremplin, parmi SES talks. L'identité vient de la SESSION (`requireUserId`),
 * jamais du formulaire : un `registrationId`/`profileId` glissé dans les données
 * est ignoré (anti-IDOR). Ownership vérifié via SON profil (`ensureProfileId` →
 * `getTalkById`) : elle ne peut mettre en avant qu'un talk de son répertoire. Le
 * titre public est lu directement depuis le talk pitché (migration 035 : plus de
 * colonne `sujet` ni de trigger). La page publique est revalidée : si elle est
 * visible, le nouveau titre s'y reflète tout de suite.
 */
export async function setOwnPitchedTalkAction(
  _prev: MaVisibiliteState,
  formData: FormData,
): Promise<MaVisibiliteState> {
  const userId = await requireUserId();
  const err = (error: string): MaVisibiliteState => ({
    status: "error",
    error,
    values: formValues(formData),
  });

  const editionId = Number(formData.get("editionId"));
  if (!Number.isInteger(editionId) || editionId <= 0) return err("Édition invalide.");

  // « Aucun » = champ vide → retrait (forme positive). Sinon un id de talk.
  const brut = (formData.get("talkId") ?? "").toString().trim();
  const talkId = brut === "" ? null : Number(brut);
  if (talkId !== null && (!Number.isInteger(talkId) || talkId <= 0)) {
    return err("Choisis un talk de ton répertoire.");
  }

  // Rattacher : le talk doit appartenir à SON profil (jamais celui d'une autre).
  if (talkId !== null) {
    const profileId = await ensureProfileId(userId);
    const existant = await getTalkById(talkId, profileId);
    if (!existant) return err("Choisis un talk de ton répertoire.");
  }

  const ok = await setOwnRegistrationTalk(userId, editionId, talkId);
  if (!ok) return err("Ton inscription n'a pas été trouvée pour cette édition.");

  revalidatePath(`/mon-espace/tremplin/${editionId}`);
  revalidatePath(`/admin/tremplins/${editionId}`, "layout");
  revalidatePath("/tremplin/[conf]/[annee]", "page");
  return { status: "success" };
}

/**
 * La participante renseigne (ou efface) ELLE-MÊME la date de réalisation de SON
 * sous-groupe (revue croisée, point individuel). L'identité vient de la SESSION
 * (`requireUserId`), jamais du formulaire : la garde SQL de
 * `setSousGroupeFaitLeCommeMembre` n'écrit que si le compte connecté fait partie
 * du sous-groupe visé (anti-IDOR — un `sousGroupeId` d'une autre est refusé).
 * `editionId` ne sert qu'à la revalidation, pas à l'autorisation.
 */
export async function setMonSousGroupeFaitLeAction(
  _prev: MaVisibiliteState,
  formData: FormData,
): Promise<MaVisibiliteState> {
  const userId = await requireUserId();
  const err = (error: string): MaVisibiliteState => ({
    status: "error",
    error,
    values: formValues(formData),
  });

  const editionId = Number(formData.get("editionId"));
  const sousGroupeId = Number(formData.get("sousGroupeId"));
  if (!Number.isInteger(editionId) || editionId <= 0) return err("Édition invalide.");
  if (!Number.isInteger(sousGroupeId) || sousGroupeId <= 0) return err("Sous-groupe invalide.");
  const brut = (formData.get("faitLe") ?? "").toString().trim();
  if (brut !== "" && !ISO_DATE_RE.test(brut)) return err("Date invalide (AAAA-MM-JJ).");

  const ok = await setSousGroupeFaitLeCommeMembre(sousGroupeId, userId, brut === "" ? null : brut);
  if (!ok) return err("Ce sous-groupe est introuvable, ou tu n'en fais pas partie.");

  revalidatePath(`/mon-espace/tremplin/${editionId}`);
  revalidatePath(`/admin/tremplins/${editionId}`, "layout");
  return { status: "success" };
}
