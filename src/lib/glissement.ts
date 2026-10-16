/**
 * La MATHS d'un glissement de rangée (« glisser vers la gauche pour découvrir
 * l'action »), à part du composant qui l'utilise : c'est elle qui départage un
 * défilement de liste d'un geste latéral, et cette décision se teste sans DOM.
 *
 * Pourquoi elle vit ici et pas dans le composant : un tiroir qui s'ouvre parce
 * qu'on faisait défiler la page rend une liste inutilisable au doigt. C'est le
 * genre de règle qu'on veut verrouillée par des tests, pas relue à l'œil.
 */

/** Déplacement (px) sous lequel on ne tranche PAS l'axe du geste : en deçà, on
 * ne sait pas encore si la personne fait défiler ou glisse la rangée. */
export const SEUIL_AXE = 10;

export type AxeGeste = "indetermine" | "horizontal" | "vertical";

/**
 * L'axe du geste, une fois pour toutes : dès qu'il est tranché, il ne rechange
 * plus (sans quoi un doigt en diagonale ferait clignoter le tiroir).
 *
 * À déplacements égaux, le DÉFILEMENT gagne : parcourir la liste est le geste
 * courant, découvrir une poubelle est l'exception.
 */
export function axeDuGeste(dx: number, dy: number, seuil = SEUIL_AXE): AxeGeste {
  if (Math.abs(dx) >= seuil && Math.abs(dx) > Math.abs(dy)) return "horizontal";
  if (Math.abs(dy) >= seuil) return "vertical";
  return "indetermine";
}

/**
 * Le décalage du contenu pendant le geste : la rangée SUIT le doigt, bornée à
 * la largeur du tiroir. Vers la gauche (`dx` négatif) elle découvre l'action,
 * vers la droite elle la recouvre — et jamais au-delà, dans un sens comme dans
 * l'autre : une rangée qui décolle de son cadre passe pour un bug d'affichage.
 */
export function decalageGlissement(depart: number, dx: number, largeur: number): number {
  return Math.min(largeur, Math.max(0, depart - dx));
}

/**
 * Au relâchement, le tiroir se CALE : ouvert s'il est passé la moitié, refermé
 * sinon. Pas d'état intermédiaire qui laisserait une poubelle à demi armée.
 */
export function tiroirOuvertApres(decalage: number, largeur: number): boolean {
  return decalage >= largeur / 2;
}
