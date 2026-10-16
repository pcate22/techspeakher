import { BrevoClient } from "@getbrevo/brevo";

let client: BrevoClient | null = null;

/**
 * Client Brevo en singleton paresseux, partagé par tous les envois (contact,
 * relais, lien magique, modération, invitations, rappels). Lève si
 * `BREVO_API_KEY` est absent : les appelants gardent l'e-mail derrière
 * `isMagicLinkEnabled()` / un try-catch best-effort selon le cas.
 */
export function brevoClient(): BrevoClient {
  if (client) return client;
  const key = process.env.BREVO_API_KEY;
  if (!key) throw new Error("BREVO_API_KEY non défini");
  client = new BrevoClient({ apiKey: key });
  return client;
}
