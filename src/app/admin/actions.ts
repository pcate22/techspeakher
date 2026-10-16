"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { invaliderAnnuaire } from "@/lib/annuaire-cache";
import { requireOrgaId } from "@/lib/auth-guards";
import {
  setProfileStatus,
  getSpeakeuseContact,
  getProfilesToInvite,
  markInvited,
} from "@/lib/profiles";
import { isMagicLinkEnabled } from "@/lib/magic-link";
import { sendBrevoEmail } from "@/lib/email";
import { buildModerationEmail } from "@/lib/moderation-email";
import { buildInvitationEmail } from "@/lib/invitation-email";
import {
  setContactMessageStatus,
  getContactMessageById,
  markMessagesNotified,
} from "@/lib/contact-message";
import { buildSpeakeuseDigestEmail } from "@/lib/digest-email";

/**
 * Modération d'un profil par une orga : publier ou refuser (avec motif).
 * Sécurité : réservé aux orgas (vérif sur la session, en plus du proxy).
 * La speakeuse est notifiée par e-mail (si Brevo est configuré).
 */
export async function moderateProfileAction(formData: FormData): Promise<void> {
  const orgaId = await requireOrgaId();

  const profileId = Number(formData.get("profileId"));
  const decision = String(formData.get("decision"));
  const motif = (formData.get("motif") ?? "").toString().trim() || null;
  if (!Number.isFinite(profileId)) return;
  // publie / refuse (avec motif) / masque (mettre en retrait).
  if (decision !== "publie" && decision !== "refuse" && decision !== "masque") {
    return;
  }

  // Statut AVANT décision : sert à ne notifier que sur un vrai changement
  // (une « revalidation » d'un profil déjà publié ne renvoie pas d'e-mail).
  const before = await getSpeakeuseContact(profileId);
  const statusChanged = before?.status !== decision;

  // PUBLIER exige un nom : la fiche s'affiche dans l'annuaire sous le nom de la
  // personne. La condition est portée par `setProfileStatus` (dans son SQL, donc
  // non contournable) ; ici on ne fait que la traduire pour l'orga. Refuser ou
  // masquer reste possible — c'est justement la réponse à une fiche incomplète.
  const applique = await setProfileStatus(
    profileId,
    decision,
    orgaId,
    decision === "refuse" ? motif : null,
  );
  if (!applique) redirect("/admin/speakeuses?err=nom");

  // Notifie la speakeuse uniquement pour publie/refuse (pas pour un retrait).
  const notifiable = decision === "publie" || decision === "refuse";
  if (notifiable && statusChanged && before?.email && isMagicLinkEnabled()) {
    try {
      const { subject, textContent } = buildModerationEmail({
        decision,
        name: before.name,
        motif,
        profileId,
        slug: before.slug,
      });
      await sendBrevoEmail({
        to: before.email,
        toName: before.name ?? undefined,
        subject,
        textContent,
      });
    } catch (err) {
      console.error("Envoi e-mail de modération échoué", err);
    }
  }

  revalidatePath("/admin/speakeuses");
  revalidatePath(`/speakeuses/${profileId}`);
  // La page publique est dynamique mais sa DONNÉE est en cache (tag
  // « annuaire ») : une décision de modération change l'ensemble des fiches
  // publiées, le cache expire immédiatement (updateTag, via invaliderAnnuaire).
  invaliderAnnuaire();
  revalidatePath("/speakeuses");
  redirect("/admin/speakeuses");
}

/**
 * Modération d'un message de contact par une orga : transmettre ou rejeter.
 * Réservé aux orgas (vérif sur la session). À la transmission, la speakeuse est
 * prévenue **immédiatement** par e-mail (extrait seulement ; elle lit le message
 * complet et répond depuis son espace). Si l'envoi échoue, `notified_at` reste
 * NULL et le cron quotidien le rattrapera. Le rejet ne relaie rien mais conserve
 * le message (audit / récidive).
 */
export async function moderateContactMessageAction(
  formData: FormData,
): Promise<void> {
  const orgaId = await requireOrgaId();

  const messageId = Number(formData.get("messageId"));
  const decision = String(formData.get("decision"));
  if (
    Number.isFinite(messageId) &&
    (decision === "transmis" || decision === "rejete")
  ) {
    // rowCount = 1 seulement si le message ÉTAIT encore `en_attente` : sur un
    // double-clic / deux onglets, la 2e décision ne transitionne rien (0) et
    // ne doit donc PAS re-notifier (sinon double e-mail).
    const changed = await setContactMessageStatus(messageId, decision, orgaId);

    if (changed === 1 && decision === "transmis" && isMagicLinkEnabled()) {
      // Notification immédiate (best-effort). En cas d'échec, on NE marque pas
      // notified_at : le cron quotidien reprendra ce message.
      try {
        const message = await getContactMessageById(messageId);
        const contact = message
          ? await getSpeakeuseContact(message.profileId)
          : null;
        if (message && contact?.email) {
          const { subject, textContent } = buildSpeakeuseDigestEmail({
            name: contact.name,
            messages: [{ motif: message.motif, body: message.body }],
          });
          await sendBrevoEmail({
            to: contact.email,
            toName: contact.name ?? undefined,
            subject,
            textContent,
          });
          await markMessagesNotified([messageId]);
        }
      } catch (err) {
        console.error("Notification immédiate de message échouée", messageId, err);
      }
    }
  }

  revalidatePath("/admin/messages");
  redirect("/admin/messages");
}

/**
 * Envoi (manuel, orga) des invitations de migration aux fiches publiées jamais
 * invitées. Idempotent : chaque envoi réussi marque invited_at, donc relancer
 * n'invite pas deux fois. Best-effort par destinataire (un échec n'interrompt
 * pas le lot).
 */
export async function sendInvitationsAction(): Promise<void> {
  await requireOrgaId();
  if (!isMagicLinkEnabled()) redirect("/admin/speakeuses?invite=disabled");

  const toInvite = await getProfilesToInvite();
  const sent: number[] = [];
  let firstError: string | null = null;
  for (const p of toInvite) {
    try {
      const { subject, htmlContent } = buildInvitationEmail({
        name: p.name,
        email: p.email,
        isOrga: p.isOrga,
      });
      await sendBrevoEmail({
        to: p.email,
        toName: p.name ?? undefined,
        subject,
        htmlContent,
      });
      sent.push(p.id);
    } catch (err) {
      if (firstError === null) {
        firstError = err instanceof Error ? err.message : String(err);
      }
      console.error("Invitation échouée", p.id, err);
    }
  }
  await markInvited(sent);

  // On remonte le nombre d'échecs et la raison du 1er à l'UI : sinon un envoi
  // qui échoue (clé Brevo invalide, expéditeur non autorisé…) est invisible.
  const failed = toInvite.length - sent.length;
  const params = new URLSearchParams({ invited: String(sent.length) });
  if (failed > 0) {
    params.set("failed", String(failed));
    if (firstError) params.set("err", firstError.slice(0, 160));
  }

  revalidatePath("/admin/speakeuses");
  redirect(`/admin/speakeuses?${params.toString()}`);
}
