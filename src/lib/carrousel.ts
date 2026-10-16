/**
 * La MATHS d'un carrousel manuel (« on fait défiler les verbatims »), à part du
 * composant qui l'utilise — comme `lib/glissement.ts` pour les rangées.
 *
 * Pourquoi elle vit ici : jsdom ne mesure rien (toutes les largeurs valent 0),
 * donc ces trois décisions ne seraient testées nulle part si elles restaient
 * dans le composant. Or ce sont elles qui font qu'une flèche ne boucle pas, que
 * les pastilles suivent le doigt, et que le mouvement se coupe quand on l'a
 * demandé.
 */

/**
 * L'index ramené dans la piste. Il s'ARRÊTE aux deux bords : une flèche qui
 * boucle du dernier verbatim au premier fait mentir le compteur (« 8 sur 8 »
 * suivi de « 1 sur 8 » sans que rien n'ait été demandé).
 */
export function indexBorne(index: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(total - 1, Math.max(0, index));
}

/**
 * Le verbatim à l'écran, lu dans la position de défilement : un verbatim occupe
 * toute la largeur de la vue, donc l'index est le rapport des deux, arrondi au
 * plus proche (un défilement au doigt s'arrête souvent entre deux).
 *
 * `largeurVue` à 0 (avant la première mesure, conteneur masqué, jsdom) renvoie
 * 0 plutôt qu'un `NaN` qui effacerait les pastilles.
 */
export function indexVisible(scrollLeft: number, largeurVue: number, total: number): number {
  if (largeurVue <= 0) return 0;
  return indexBorne(Math.round(scrollLeft / largeurVue), total);
}

/**
 * Le défilement s'anime, sauf si le mouvement réduit est demandé : `globals.css`
 * neutralise les transitions et le défilement de `html`, mais pas celui d'un
 * conteneur piloté en JS (WCAG 2.3.3).
 */
export function comportementDefilement(mouvementReduit: boolean): ScrollBehavior {
  return mouvementReduit ? "auto" : "smooth";
}
