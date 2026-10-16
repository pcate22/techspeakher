/**
 * Grouper une liste DÉJÀ TRIÉE en tranches consécutives de même clé — le geste
 * des agendas du projet (mois, puis jours). Il existait en deux exemplaires
 * (agenda personnel, liste des ateliers), même algorithme à la variable près.
 *
 * « Déjà triée » est la condition : on ne rassemble que des voisins, donc deux
 * tranches de même clé restent séparées si la liste ne l'est pas. C'est
 * volontaire — l'ordre d'affichage reste la décision de l'appelant, pas un
 * effet de bord du groupement.
 */
export interface Tranche<T, K> {
  cle: K;
  items: T[];
}

export function grouperPar<T, K>(items: readonly T[], cle: (item: T) => K): Tranche<T, K>[] {
  const tranches: Tranche<T, K>[] = [];
  for (const item of items) {
    const k = cle(item);
    const dernier = tranches[tranches.length - 1];
    if (dernier && dernier.cle === k) dernier.items.push(item);
    else tranches.push({ cle: k, items: [item] });
  }
  return tranches;
}

/**
 * Indexer des lignes SQL en `Map<clé, valeurs[]>` — le geste qui suit toute
 * lecture « à plat » (une requête pour tout l'ensemble, plutôt qu'une par
 * parent) et qui existait en huit exemplaires recopiés dans `src/lib`.
 *
 * L'ordre des valeurs est celui des lignes : c'est l'`ORDER BY` de la requête
 * qui décide, pas ce helper — une fonction de groupement qui réordonne cache la
 * décision là où personne ne la cherche.
 */
export function indexerListes<L, K, V>(
  lignes: readonly L[],
  cle: (ligne: L) => K,
  valeur: (ligne: L) => V,
): Map<K, V[]> {
  const par = new Map<K, V[]>();
  for (const ligne of lignes) {
    const k = cle(ligne);
    const deja = par.get(k);
    if (deja) deja.push(valeur(ligne));
    else par.set(k, [valeur(ligne)]);
  }
  return par;
}
