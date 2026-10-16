import { brevoClient } from "@/lib/brevo-client";
import { EMAIL_SENDER } from "@/constants/site";

const SENDER_NAME = "Tech Speak'Her";

/** Envoi d'un e-mail transactionnel via Brevo (expéditeur = domaine validé). */
export async function sendBrevoEmail(opts: {
  to: string;
  toName?: string;
  subject: string;
  textContent?: string;
  htmlContent?: string;
  replyTo?: string;
  replyToName?: string;
}): Promise<void> {
  await brevoClient().transactionalEmails.sendTransacEmail({
    sender: { email: EMAIL_SENDER, name: SENDER_NAME },
    to: [{ email: opts.to, name: opts.toName }],
    ...(opts.replyTo
      ? { replyTo: { email: opts.replyTo, name: opts.replyToName } }
      : {}),
    subject: opts.subject,
    ...(opts.textContent ? { textContent: opts.textContent } : {}),
    ...(opts.htmlContent ? { htmlContent: opts.htmlContent } : {}),
  });
}
