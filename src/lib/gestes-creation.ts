import type { FeuilleDonnees } from "@/lib/feuille-creer";

/*
 * Les liens des gestes de création, PURS : lus par des composants client (la
 * feuille ➕, le rail, la fenêtre « Une date ») ET par le serveur. Ils vivent
 * hors de `feuille-creer.ts`, qui touche la base — un import client de ce
 * module-là embarquerait `pg` dans le navigateur.
 */

/**
 * Le geste de création principal, PARTAGÉ par la feuille ➕ et le bouton de
 * tête du rail : deux copies du couple libellé/lien auraient dérivé.
 */
export function gestePrincipal(
  creation: FeuilleDonnees["creation"],
): { href: string; label: string } | null {
  if (creation === "talk") return { href: "/mon-espace/talks/nouveau", label: "Ajouter un talk" };
  if (creation === "fiche") return { href: "/mon-espace/fiche", label: "Créer ma fiche speakeuse" };
  return null;
}

/** Le paramètre de la fiche qui ouvre la fenêtre « Une date » d'un talk. */
export const PARAM_DATE_TALK = "date";

/** La fenêtre de date d'un talk, sur la fiche (elle s'y ouvre d'elle-même). */
export const hrefDateTalk = (talkId: number) => `/mon-espace/fiche?${PARAM_DATE_TALK}=${talkId}`;
