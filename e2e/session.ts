import { encode } from "next-auth/jwt";
import type { BrowserContext } from "@playwright/test";

/**
 * OUVRIR UNE SESSION EN E2E, SANS OAUTH ET SANS BASE.
 *
 * Les parcours connectés étaient hors de portée depuis le début du projet
 * (`docs/plateforme-conception-technique.md` §17 : « OAuth réelle difficile en
 * e2e, donc provider de test gated en env de test ou mock — étape ultérieure »).
 * L'étape n'a jamais été faite, et c'est elle qui tenait 83 pages et 106 Server
 * Actions hors de tout test de bout en bout.
 *
 * Il n'y a en fait rien à mocker, ni aucun provider de test à exposer. La
 * session est déjà un JWT (`authConfig.session.strategy = "jwt"`) et le token
 * ne porte que trois champs lus par le callback `session` : `sub`, `isOrga`,
 * `isCoach`. On fabrique donc le cookie avec la MÊME fonction que la prod
 * (`encode` d'Auth.js) et le même secret : le serveur ne fait pas la
 * différence, parce qu'il n'y en a pas.
 *
 * Ce que ça permet SANS base de données : tout ce que le proxy décide avant
 * qu'une page ne s'affiche — c'est-à-dire les autorisations d'accès, dont
 * l'escalade de privilège (une membre qui vise /admin). Ce que ça ne permet
 * pas : rendre les pages elles-mêmes, qui lisent Postgres. Le décor de données
 * est le lot suivant (cf. `docs/audit-e2e-parcours-2026-08.md` §5.2).
 *
 * ATTENTION à ne pas confondre les deux niveaux de garde : le token est cru
 * SUR PAROLE par le proxy (c'est le principe d'un JWT signé), donc forger
 * `isOrga: true` ici ne teste pas la promotion en orga — ça teste ce que le
 * proxy fait d'un rôle donné. Le fait qu'une personne SOIT orga se décide en
 * base (`getUserRoles`, callback `jwt`), et se teste en unitaire.
 */

/**
 * Le secret des sessions E2E.
 *
 * Ce n'en est pas un au sens du dépôt (« secrets uniquement en env, jamais
 * committés ») : il ne chiffre que des sessions fabriquées par les tests, sur
 * un serveur localhost éphémère, pour des comptes qui n'existent pas. Sa valeur
 * doit être PARTAGÉE entre les workers Playwright et le serveur de test, donc
 * fixe : un secret tiré au hasard différerait d'un worker à l'autre et aucune
 * session ne serait déchiffrable.
 *
 * Un `AUTH_SECRET` déjà présent en environnement gagne, pour qu'un `.env.local`
 * de développement reste maître chez soi.
 */
export const E2E_AUTH_SECRET =
  process.env.AUTH_SECRET ?? "e2e-uniquement-aucune-valeur-de-production";

/**
 * Le nom du cookie de session sert AUSSI de sel de dérivation (`salt`) chez
 * Auth.js : les deux doivent coller, sinon le token est indéchiffrable. Pas de
 * préfixe `__Secure-` ici, le serveur de test parle http.
 */
export const COOKIE_SESSION = "authjs.session-token";

export type RoleE2E = {
  /** L'id du compte, tel que le callback `session` le lira (`token.sub`). */
  id: number;
  isOrga?: boolean;
  isCoach?: boolean;
};

/** Les rôles du décor. Nommés, pour que les tests disent QUI agit. */
export const MEMBRE: RoleE2E = { id: 4001 };
export const COACH: RoleE2E = { id: 4002, isCoach: true };
export const ORGA: RoleE2E = { id: 4003, isOrga: true };

/** Fabrique le cookie de session correspondant à un rôle. */
export async function cookieDeSession(role: RoleE2E): Promise<string> {
  return encode({
    token: {
      sub: String(role.id),
      isOrga: role.isOrga === true,
      isCoach: role.isCoach === true,
    },
    secret: E2E_AUTH_SECRET,
    salt: COOKIE_SESSION,
  });
}

/** Connecte le contexte du navigateur sous le rôle demandé. */
export async function seConnecter(context: BrowserContext, role: RoleE2E): Promise<void> {
  await context.addCookies([
    {
      name: COOKIE_SESSION,
      value: await cookieDeSession(role),
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}
