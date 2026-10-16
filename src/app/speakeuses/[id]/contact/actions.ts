"use server";

import { headers } from "next/headers";
import {
  parseContactMessage,
  createContactMessage,
  countRecentMessagesFromEmail,
} from "@/lib/contact-message";
import { getSpeakeuseContact } from "@/lib/profiles";
import { isRateLimited, clientIp } from "@/lib/rate-limit";

/** Plafond durable : messages acceptés d'une même adresse sur une fenêtre glissante. */
const DURABLE_LIMIT = 10;
const DURABLE_WINDOW_MIN = 60;

export type ContactState = { ok?: boolean; errors?: Record<string, string> };

/**
 * Met un message en FILE DE MODÉRATION (statut 'en_attente'). Il n'est PAS
 * relayé à la speakeuse : une orga le relit d'abord (safe place). Une fois
 * transmis, la speakeuse en est prévenue par le digest quotidien.
 * L'e-mail de la speakeuse n'est jamais exposé.
 */
export async function sendMessageAction(
  _prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const profileId = Number(formData.get("profileId"));
  if (!Number.isFinite(profileId))
    return { ok: false, errors: { message: "Lien invalide." } };

  const parsed = parseContactMessage(formData);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };

  // Anti-abus : borne les envois par IP et par adresse (best-effort, cf.
  // rate-limit.ts). Évite qu'un flood remplisse la file de modération.
  const ip = clientIp(await headers());
  if (
    isRateLimited(`contact-msg:ip:${ip}`, 5, 60_000) ||
    isRateLimited(`contact-msg:mail:${parsed.data.email.toLowerCase()}`, 3, 60_000)
  ) {
    return {
      ok: false,
      errors: { message: "Trop de messages envoyés, réessaie dans une minute." },
    };
  }

  // Joignabilité : on n'accepte un message que pour une fiche publiée qui a
  // activé le contact (on ne stocke pas de message pour une fiche non joignable).
  const contact = await getSpeakeuseContact(profileId);
  if (!contact || contact.status !== "publie" || !contact.contactEmailOk) {
    return {
      ok: false,
      errors: { message: "Cette personne n'est pas joignable par e-mail." },
    };
  }

  // Rate-limit DURABLE (survit aux cold starts, borne réellement la file) :
  // complète le limiteur en mémoire ci-dessus.
  const recent = await countRecentMessagesFromEmail(
    parsed.data.email,
    DURABLE_WINDOW_MIN,
  );
  if (recent >= DURABLE_LIMIT) {
    return {
      ok: false,
      errors: { message: "Trop de messages envoyés récemment, réessaie plus tard." },
    };
  }

  try {
    await createContactMessage({
      profileId,
      motif: parsed.data.motif,
      senderName: parsed.data.nom,
      senderEmail: parsed.data.email,
      body: parsed.data.message,
    });
  } catch (err) {
    console.error("Enregistrement du message échoué", err);
    return {
      ok: false,
      errors: { message: "L'envoi a échoué, réessaie dans un moment." },
    };
  }

  return { ok: true };
}
