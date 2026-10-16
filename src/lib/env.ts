/**
 * Vérification (non bloquante) des variables d'environnement au démarrage.
 *
 * Volontairement **non fatale** : la preview Vercel et le build CI tournent sans
 * tous les secrets, donc on ne lève pas (sinon on casserait ces environnements).
 * On logue clairement ce qui manque pour qu'un souci de config soit visible tôt
 * dans les logs serveur, au lieu d'un bug tardif au premier appel.
 */

import { activeFeatureFlags } from "@/lib/feature-flags";

/** Recommandées : leur absence désactive une fonctionnalité (sans planter). */
const RECOMMENDED = [
  "BREVO_API_KEY", // e-mails (lien magique, relais, modération, invitations)
  "AUTH_GOOGLE_ID",
  "AUTH_GOOGLE_SECRET",
  // Sans elle, tout cron (`/api/cron/*`) est refusé (401). Absente en prod
  // jusqu'au 2026-10-15.
  "CRON_SECRET",
] as const;

const isSet = (k: string) => Boolean(process.env[k]?.trim());

/**
 * Variable de connexion DB attendue selon l'environnement — miroir de
 * `resolveConnectionString` (db.ts) : une **preview** Vercel utilise
 * `PREVIEW_DATABASE_URL` (jamais `DATABASE_URL`, pour ne pas taper la prod).
 * On la calcule à l'appel (pas au chargement) pour rester juste en test.
 */
function requiredDbVar(): string {
  return process.env.VERCEL_ENV === "preview" ? "PREVIEW_DATABASE_URL" : "DATABASE_URL";
}

export function checkEnv(): { missing: string[]; warnings: string[] } {
  // Requises pour que l'app fonctionne (DB + sessions).
  const required = [requiredDbVar(), "AUTH_SECRET"];
  const missing = required.filter((k) => !isSet(k));
  const warnings = RECOMMENDED.filter((k) => !isSet(k));

  if (missing.length > 0) {
    console.error(
      `[env] Variables REQUISES manquantes : ${missing.join(", ")} — l'app ne fonctionnera pas correctement.`,
    );
  }
  if (warnings.length > 0) {
    console.warn(
      `[env] Variables recommandées absentes (fonctionnalités liées désactivées) : ${warnings.join(", ")}.`,
    );
  }
  // Rend visibles au démarrage les fonctionnalités activées par flag.
  const flags = activeFeatureFlags();
  if (flags.length > 0) {
    console.info(`[env] Feature flags actifs : ${flags.join(", ")}.`);
  }
  return { missing, warnings };
}
