import type { Provider } from "next-auth/providers";
import { brevoClient } from "@/lib/brevo-client";
import { CONTACT_EMAIL, EMAIL_SENDER } from "@/constants/site";
import { salutation } from "@/lib/format";

/**
 * Lien magique (connexion par e-mail). On réutilise la config Brevo DÉJÀ en
 * place pour le formulaire de contact : même `BREVO_API_KEY`, même expéditeur
 * validé. Activé dès que `BREVO_API_KEY` est présent (donc déjà OK en prod).
 *
 * À garder côté Node (auth.ts) uniquement — jamais dans la config edge.
 */
const SENDER_NAME = "Tech Speak'Her";

export function isMagicLinkEnabled(): boolean {
  return Boolean(process.env.BREVO_API_KEY);
}

function senderEmail(): string {
  return process.env.AUTH_EMAIL_FROM || EMAIL_SENDER;
}

/** L'e-mail de connexion. Pur, pour que ses règles de rédaction se testent
 *  (`emails-redaction.test.ts`). */
export function buildMagicLinkEmail(url: string): { subject: string; htmlContent: string } {
  return {
    subject: "Ta connexion à Tech Speak'Her",
    htmlContent: `
      <p>${salutation(null)}</p>
      <p>Voici ton lien pour te connecter à ton espace Tech Speak'Her&nbsp;:</p>
      <p><a href="${url}">Me connecter</a></p>
      <p style="color:#666;font-size:13px">Ce lien expire dans 24 heures et sert une seule fois. Une demande faite par quelqu'un d'autre&nbsp;? Ignore simplement cet e-mail.</p>
    `,
  };
}

async function sendMagicLink(to: string, url: string): Promise<void> {
  await brevoClient().transactionalEmails.sendTransacEmail({
    sender: { email: senderEmail(), name: SENDER_NAME },
    replyTo: { email: CONTACT_EMAIL, name: SENDER_NAME },
    to: [{ email: to }],
    ...buildMagicLinkEmail(url),
  });
}

/** Provider Auth.js « email » avec envoi via Brevo (SDK, pas de nodemailer). */
export function magicLinkProvider(): Provider {
  return {
    id: "email",
    type: "email",
    name: "E-mail",
    from: senderEmail(),
    maxAge: 24 * 60 * 60,
    async sendVerificationRequest({ identifier, url }) {
      await sendMagicLink(identifier, url);
    },
  } as Provider;
}
