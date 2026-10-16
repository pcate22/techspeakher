import type { Instrumentation } from "next";
import { checkEnv } from "@/lib/env";
import { journaliserErreur } from "@/lib/journal-erreurs";

/**
 * Hook Next.js exécuté une fois au démarrage du serveur (pas au build). On
 * vérifie la configuration d'environnement (non bloquant) pour rendre un secret
 * manquant visible tôt dans les logs.
 */
export function register() {
  checkEnv();
}

/**
 * Toute erreur serveur passe ici : rendu de page, route d'API, Server Action.
 *
 * Sans ce hook, une page qui casse en production ne laisse qu'un `digest` à
 * l'écran de la membre, et rien nulle part pour le relier à quoi que ce soit.
 * Les tests attrapent ce que quelqu'un a pensé à écrire ; ceci attrape le reste.
 *
 * Le tri de ce qui part au journal (et surtout de ce qui n'y va JAMAIS : les
 * en-têtes, donc les cookies de session ; la chaîne de requête, donc ce que la
 * personne a saisi) vit dans `@/lib/journal-erreurs`, où il est testable.
 */
export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  journaliserErreur(error, request, context);
};
