import { getUserById } from "@/lib/users";
import { supprimerContactBrevo } from "@/lib/brevo-contacts";
import { effacerCompteEnBase } from "@/lib/profiles";

/**
 * LA SUPPRESSION D'UN COMPTE, EN ENTIER — l'unique porte d'entrée.
 *
 * Un compte vit à DEUX endroits : notre base, et le sous-traitant e-mail (son
 * contact dans « Comptes plateforme », qui reçoit la lettre d'information).
 * L'effacer d'un seul des deux laisse la donnée que la suppression existe pour
 * faire disparaître (dette P0-6, 2026-08-16 : la synchro ne savait que POUSSER,
 * donc un compte supprimé devenait simplement absent de la poussée suivante et
 * son contact restait là indéfiniment).
 *
 * Pourquoi un module à part, et pas l'appel glissé dans `effacerCompteEnBase` :
 * `src/lib/profiles.ts` est un module d'ACCÈS BASE, importé par une soixantaine
 * d'autres — dont l'accueil, le sitemap et l'annuaire. Y poser un effet réseau
 * fait entrer le SDK du sous-traitant dans le graphe de pages publiques qui ne
 * l'appelleront jamais (mesuré : 551 modules, ~180 ms d'évaluation au démarrage
 * à froid), et met les tests d'intégration base à une variable d'environnement
 * d'appeler vraiment le sous-traitant. L'orchestration vit donc ici, à côté de
 * `passe-conservation.ts`, comme tous les effets composés du dépôt.
 *
 * Ce qui garantit qu'on ne l'oublie pas, du coup, c'est le NOM : la moitié SQL
 * s'appelle `effacerCompteEnBase` et dit ce qu'elle ne fait pas. Qui cherche
 * « la fonction qui supprime un compte » tombe sur celle-ci.
 *
 * L'ORDRE porte la règle. L'adresse est le seul moyen d'aller chercher le
 * contact : le sous-traitant passe donc D'ABORD, tant qu'on la tient encore.
 * Une panne LÈVE et rien n'est effacé en base — la passe de conservation
 * retente le lendemain, le geste manuel le dit à l'écran. L'ordre inverse
 * effacerait l'adresse puis perdrait le contact pour toujours. Et si la base
 * échoue APRÈS, le compte reste : la synchro suivante repousse son contact,
 * seule des deux pannes qui se répare toute seule.
 */
export async function supprimerCompte(userId: number): Promise<void> {
  const compte = await getUserById(userId);
  await supprimerContactBrevo(compte?.email ?? null);
  await effacerCompteEnBase(userId);
}
