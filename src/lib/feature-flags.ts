/**
 * Feature flags — activation de fonctionnalités par variable d'environnement.
 *
 * Formalise le pattern déjà présent (`isGoogleEnabled`, `hasBrevoApiKey`…) :
 * un flag = une variable d'env booléenne, lue via un helper typé et centralisé.
 * Pas de dépendance externe : au volume du site, une variable Vercel par
 * environnement (prod / preview) suffit et reste auditée dans `.env.example`.
 *
 * Ajouter un flag : une entrée dans FEATURE_FLAGS (clé métier → nom de la
 * variable), puis le documenter dans `.env.example` + `docs/exploitation.md`.
 *
 * ⚠️ `process.env` n'est lisible QUE côté serveur (Server Component, Server
 * Action, route). Pour un composant client, résoudre le flag côté serveur et
 * le passer en prop (rien n'est exposé au navigateur). Réserver `NEXT_PUBLIC_*`
 * aux flags non sensibles, en connaissance de cause (inliné dans le bundle).
 */

/** Flags connus : clé métier → nom de la variable d'environnement. */
export const FEATURE_FLAGS = {
  /** Annuaire réservé aux membres (préavis, pause, relance) — cf.
   *  docs/conception-adhesions-helloasso.md et docs/exploitation.md « Adhésions HelloAsso ». */
  adhesions: "FLAG_ADHESIONS",
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

/**
 * Un flag est actif si sa variable vaut « 1 » ou « true » (insensible à la
 * casse, espaces ignorés). Toute autre valeur (absente, « 0 », « false »,
 * quelconque) le laisse inactif. Défaut fermé : une fonctionnalité derrière un
 * flag reste éteinte tant qu'on ne l'active pas explicitement.
 */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  const raw = process.env[FEATURE_FLAGS[flag]]?.trim().toLowerCase();
  return raw === "1" || raw === "true";
}

/** Flags actuellement actifs (sert au log de démarrage, cf. `checkEnv`). */
export function activeFeatureFlags(): FeatureFlag[] {
  return (Object.keys(FEATURE_FLAGS) as FeatureFlag[]).filter(isFeatureEnabled);
}
