/**
 * Vérification Cloudflare Turnstile du formulaire public de contact.
 *
 * Turnstile est un CAPTCHA « invisible » : il juge le navigateur (et non la
 * personne), sans énigme à résoudre dans la quasi-totalité des cas, sans cookie
 * et sans profilage publicitaire — c'est ce qui le rend acceptable ici, là où
 * reCAPTCHA nous ferait dépendre de Google.
 *
 * ACTIVATION PAR L'ENVIRONNEMENT. Sans `TURNSTILE_SECRET_KEY`, la vérification
 * est INACTIVE et le formulaire fonctionne comme avant (dev, CI, previews) : la
 * clé n'existe que là où elle a été posée. Le filtre de contenu
 * (`anti-spam.ts`), lui, tourne toujours.
 *
 * ÉCHEC OUVERT si Cloudflare est injoignable : une panne chez eux couperait
 * sinon le seul canal de contact de l'association. Un jeton explicitement
 * REFUSÉ reste refusé.
 */

const URL_VERIFICATION =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Au-delà, on considère Cloudflare injoignable (échec ouvert). */
const DELAI_MAX_MS = 5_000;

export type VerdictTurnstile =
  /** Vérification désactivée : aucune clé secrète dans l'environnement. */
  | "inactif"
  /** Jeton vérifié par Cloudflare. */
  | "valide"
  /** Jeton absent, expiré, rejoué ou invalide. */
  | "refuse"
  /** Cloudflare injoignable : on laisse passer plutôt que couper le contact. */
  | "indisponible";

/** Vrai si la vérification est armée dans cet environnement. */
export function turnstileActif(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

/**
 * Soumet le jeton du widget à Cloudflare. `ip` (l'adresse cliente) est
 * facultative côté Cloudflare et sert à leur analyse.
 */
export async function verifierTurnstile(
  jeton: unknown,
  ip?: string,
): Promise<VerdictTurnstile> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return "inactif";

  if (typeof jeton !== "string" || jeton.trim().length === 0) {
    // Tracé, comme le refus prononcé par Cloudflare : une Secret Key posée sans
    // sa Site Key ferait tomber 100 % des envois, et sans cette ligne les logs
    // Vercel resteraient muets sur la cause.
    console.warn("Turnstile : jeton absent de la requête");
    return "refuse";
  }

  const corps = new URLSearchParams({ secret, response: jeton.trim() });
  if (ip && ip !== "unknown") corps.set("remoteip", ip);

  try {
    const reponse = await fetch(URL_VERIFICATION, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: corps,
      signal: AbortSignal.timeout(DELAI_MAX_MS),
    });
    if (!reponse.ok) {
      console.error("Turnstile : réponse inattendue", reponse.status);
      return "indisponible";
    }
    const donnees = (await reponse.json()) as {
      success?: boolean;
      "error-codes"?: string[];
    };
    if (donnees.success === true) return "valide";
    console.warn("Turnstile : jeton refusé", donnees["error-codes"] ?? []);
    return "refuse";
  } catch (err) {
    console.error("Turnstile injoignable", err);
    return "indisponible";
  }
}
