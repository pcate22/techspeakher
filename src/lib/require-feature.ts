import { notFound } from "next/navigation";
import { isFeatureEnabled, type FeatureFlag } from "@/lib/feature-flags";

/**
 * Garde de fonctionnalité pour un Server Component ou une route : si le flag
 * est éteint, la page renvoie un 404 (elle « n'existe pas » pour le public),
 * comme le reste des pages dynamiques (`if (…) notFound()`).
 *
 * Réservé au serveur (importe `next/navigation`). À appeler en tête du
 * composant serveur :
 *
 *   export default async function Page() {
 *     requireFeatureEnabled("adhesions");
 *     // … le reste ne s'exécute que si le flag est actif
 *   }
 */
export function requireFeatureEnabled(flag: FeatureFlag): void {
  if (!isFeatureEnabled(flag)) notFound();
}
