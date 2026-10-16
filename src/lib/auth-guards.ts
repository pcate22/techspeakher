import { cache } from "react";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

/**
 * Gardes d'authentification pour les Server Actions / pages serveur. L'identité
 * vient TOUJOURS de la session (jamais d'un champ client). Factorise le motif
 * `auth()` + redirection répété partout.
 *
 * `auth()` déchiffre le cookie de session : sur une page profonde on empile
 * plusieurs gardes (layout édition + layout entité + page). On mémoïse donc
 * l'appel PAR REQUÊTE (`React.cache`) : un seul déchiffrement, partagé.
 */
export const getSession = cache(() => auth());

/** Id de la membre connectée, ou redirige vers /connexion. */
export async function requireUserId(): Promise<number> {
  const session = await getSession();
  const id = session?.user?.id;
  if (!id) redirect("/connexion");
  return Number(id);
}

/**
 * Id de la membre connectée pour une ROUTE API (`route.ts`), consommée par un
 * `fetch` : répond 401 JSON plutôt que `redirect()` (cf. `requireOrgaJson`).
 * `instanceof Response` = accès refusé, sinon l'id (number) de la membre.
 */
export async function requireUserJson(): Promise<number | Response> {
  const session = await getSession();
  const id = session?.user?.id;
  if (!id) return NextResponse.json({ error: "Non connectée." }, { status: 401 });
  return Number(id);
}

/** Id d'une orga connectée, ou redirige vers /connexion (non connectée OU non orga). */
export async function requireOrgaId(): Promise<number> {
  const session = await getSession();
  if (!session?.user?.isOrga) redirect("/connexion");
  return Number(session.user.id);
}

/**
 * Garde orga pour une ROUTE API (`route.ts`), consommée par un `fetch` ou un
 * formulaire brut, jamais par une navigation applicative : `redirect()` n'a
 * pas de sens ici (le fetch appelant ne le suivrait pas comme une page le
 * ferait), on répond donc en JSON. `null` = accès autorisé, sinon la réponse
 * à renvoyer telle quelle (`const denied = await requireOrgaJson(); if
 * (denied) return denied;`).
 */
export async function requireOrgaJson(): Promise<Response | null> {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Non connectée." }, { status: 401 });
  if (!session.user.isOrga) {
    return NextResponse.json({ error: "Réservé aux organisatrices." }, { status: 403 });
  }
  return null;
}

/**
 * Garde de PAGE orga : redirige une visiteuse non connectée vers /connexion, et
 * une membre connectée NON orga vers /mon-espace (pas de reboucle sur la
 * connexion). Motif recopié sur chaque page d'administration — factorisé ici.
 */
export async function requireOrgaPage(): Promise<void> {
  const session = await getSession();
  if (!session?.user) redirect("/connexion");
  if (!session.user.isOrga) redirect("/mon-espace");
}

/**
 * Garde « animateur / coach » : session + rôle isCoach (posé à la connexion,
 * comme isOrga — un coach fraîchement assigné doit se reconnecter).
 */
export async function requireCoachId(): Promise<number> {
  const session = await getSession();
  if (!session?.user?.isCoach) redirect("/connexion");
  return Number(session.user.id);
}
