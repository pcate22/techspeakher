/**
 * La COUVERTURE d'un atelier en sous-groupes : « tout le monde a-t-il un
 * sous-groupe ? »
 *
 * C'est la raison d'être des sous-groupes (mots de l'orga, 01/08) : « s'assurer
 * que tout le monde a un sous-groupe dans un ensemble donné ». Le modèle savait
 * déjà dire ce que chaque sous-groupe contient ; il ne savait pas dire QUI
 * n'était rangée nulle part — la seule question qui compte quand on répartit.
 * Faute de cette vue, on ne voyait pas la répartition d'un atelier, et un
 * sous-groupe a fini par être créé comme un ATELIER de plus (12 doublons en
 * prod).
 *
 * L'ENSEMBLE à couvrir n'est PAS défini ici : c'est l'AUDIENCE de l'atelier
 * (`atelier-audience.ts` ; résolue par `getCohorteAtelier`) — une sélection
 * nommée, la cohorte d'une phase, ou toute l'édition. Une seconde dérivation de
 * « qui est concerné » serait exactement la duplication que le lot audience
 * vient de supprimer. Ce module ne fait donc qu'une chose : confronter cette
 * cohorte à ce qui est rangé.
 *
 * Fonctions PURES, partagées par la liste des ateliers, la fiche et la page de
 * répartition : une seule définition du reste à ranger, donc trois écrans qui
 * racontent la même chose.
 *
 * Rien de nominatif ne sort d'ici : des identifiants d'inscription, que
 * l'appelant traduit en noms là où c'est justifié (la page de répartition, pas
 * une liste de consultation).
 */

/**
 * La répartition est-elle COMPLÈTE ? Définition UNIQUE, partagée par la
 * couverture nominative (page de répartition) et par la dérivation en comptes
 * (`atelierEtat`, qui sert la liste et la fiche) — recalculer « aRanger === 0 »
 * à côté perdait la garde `total > 0`, et un atelier SANS personne à répartir
 * s'annonçait « tout le monde est rangé » : une fausse réassurance, qui
 * contredisait la page de répartition disant « personne à répartir ».
 *
 * `total === 0` n'est donc jamais « complet » : rien à couvrir n'est pas une
 * réussite, c'est une étape qui n'a pas commencé.
 */
export function repartitionComplete(total: number, rangees: number): boolean {
  return total > 0 && rangees >= total;
}

export interface Couverture {
  /** Effectif de la cohorte à couvrir. */
  total: number;
  /** Combien sont déjà rangées. Un COMPTE : personne n'a besoin de la liste de
   * celles qui vont bien — ce sont les manquantes qu'on nomme. */
  nbRangees: number;
  /** Inscriptions de la cohorte encore sans sous-groupe — le manque à combler. */
  aRanger: number[];
  /** Tout le monde a un sous-groupe (et il y avait quelqu'un à ranger). */
  complete: boolean;
}

/**
 * Qui est rangée, qui reste à ranger. `cohorte` vient de `getCohorteAtelier`
 * (l'audience de l'atelier) ; `rangeesParSousGroupe` est la composition des
 * sous-groupes (`getSousGroupesByAtelier`).
 *
 * Une inscription rangée mais ABSENTE de la cohorte (sortie de la phase depuis,
 * audience resserrée après coup) ne compte pas dans `nbRangees` — on ne veut
 * pas d'un « 11 sur 10 » qui ferait croire à une couverture complète alors
 * qu'il manque quelqu'un.
 *
 * Ids TRIÉS et dédoublonnés : l'ordre d'affichage ne dépend pas de celui de la
 * base, et deux rendus serveur donnent la même page.
 */
export function couvertureSousGroupes(
  cohorte: Iterable<number>,
  rangeesParSousGroupe: Iterable<Iterable<number>>,
): Couverture {
  const rangeesToutes = new Set<number>();
  for (const membres of rangeesParSousGroupe) {
    for (const id of membres) rangeesToutes.add(id);
  }
  const ids = [...new Set(cohorte)].sort((a, b) => a - b);
  const aRanger = ids.filter((id) => !rangeesToutes.has(id));
  const nbRangees = ids.length - aRanger.length;
  return {
    total: ids.length,
    nbRangees,
    aRanger,
    complete: repartitionComplete(ids.length, nbRangees),
  };
}
