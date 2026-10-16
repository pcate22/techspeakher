import { BASE_URL } from "@/constants/site";
import { getEditionById } from "@/lib/tremplin-editions";
import { isMagicLinkEnabled } from "@/lib/magic-link";
import { sendBrevoEmail } from "@/lib/email";
import { escapeHtml, salutation } from "@/lib/format";
import type { UserLite } from "@/lib/users";

/**
 * E-mail « ton espace Tremplin est prêt », envoyé quand l'orga rattache
 * l'inscription d'une participante à son compte. Fonction pure (testable) ;
 * l'envoi réel passe par sendBrevoEmail, gardé par la présence de BREVO_API_KEY.
 */
export function buildTremplinReadyEmail({
  name,
  editionNom,
  editionId,
}: {
  name: string | null;
  editionNom: string;
  editionId: number;
}): { subject: string; htmlContent: string; textContent: string } {
  // Le nom vient d'un compte (Google/LinkedIn ou saisie) : on l'échappe avant
  // de l'interpoler dans le HTML de l'e-mail.
  // Le HTML reçoit la salutation échappée, le texte brut la reçoit telle
  // quelle (« Anne &amp; Co » n'a rien à faire dans un e-mail texte).
  const salut = salutation(name);
  const bonjour = escapeHtml(salut);
  const url = `${BASE_URL}/mon-espace/tremplin/${editionId}`;

  const htmlContent = `
    <p>${bonjour}</p>
    <p>Ton espace pour le <strong>${editionNom}</strong> est prêt 🎤. Tu y retrouves
       le programme des ateliers, leurs supports, et ton <strong>retour individuel
       du jury</strong>.</p>
    <p>👉 <a href="${url}">Accède à ton espace Tremplin</a> (connecte-toi avec ton
       compte&nbsp;: Google, LinkedIn ou lien par e-mail).</p>
    <p style="color:#555;font-size:13px">Tes documents sont privés&nbsp;: seules toi
       et l’équipe organisatrice y avez accès. Hébergement en Europe (RGPD), code du site public.</p>
    <p>À bientôt&nbsp;!</p>
    <p>L'équipe Tech Speak'Her</p>
  `;

  const textContent =
    `${salut}\n\n` +
    `Ton espace pour le ${editionNom} est prêt. Tu y retrouves le programme des ` +
    `ateliers, leurs supports et ton retour individuel du jury.\n\n` +
    `Accède à ton espace\u00a0: ${url}\n\n` +
    `Tes documents sont privés (toi et l’équipe organisatrice). L'équipe Tech Speak'Her.`;

  return {
    subject: `Ton espace ${editionNom} est prêt 🎤`,
    htmlContent,
    textContent,
  };
}

/**
 * Envoie l'invitation « ton espace est prêt » à un compte pour une édition,
 * en best-effort : gardé par Brevo (lien magique actif), un échec est loggé
 * mais ne bloque jamais l'inscription. Renvoie `true` si l'e-mail est parti.
 * Source unique du bloc partagé par le rattachement et l'ajout par e-mail.
 */
export async function sendEditionInviteEmail(
  user: UserLite,
  editionId: number,
): Promise<boolean> {
  if (!user.email || !isMagicLinkEnabled()) return false;
  try {
    const edition = await getEditionById(editionId);
    const mail = buildTremplinReadyEmail({
      name: user.name,
      editionNom: edition?.nom ?? "Tremplin",
      editionId,
    });
    await sendBrevoEmail({
      to: user.email,
      toName: user.name ?? undefined,
      subject: mail.subject,
      htmlContent: mail.htmlContent,
      textContent: mail.textContent,
    });
    return true;
  } catch (err) {
    console.error("Envoi e-mail Tremplin échoué (non bloquant)", err);
    return false;
  }
}
