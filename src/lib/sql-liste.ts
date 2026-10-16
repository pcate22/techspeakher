/**
 * Une liste fermée du code, rendue en clause SQL POSITIVE.
 *
 * Pourquoi une fonction plutôt que la liste écrite à la main : les lectures
 * soldées par la migration 073 avaient toutes la même forme — un lecteur EN
 * NÉGATIF (`NOT IN (…)`, `<> 'active'`, `<> 'aucun'`) qui range toute valeur
 * inattendue du côté dangereux. Dérivée d'une constante, la clause suit le
 * code : une valeur ajoutée demain n'entre dans la requête que si quelqu'un l'a
 * rangée du bon côté. Le récit est dans
 * `db/migrations/073_statuts_listes_fermees.sql`.
 *
 * Littéraux et non paramètres `$n` : un fragment doit pouvoir se composer sans
 * imposer à l'appelante une convention de numérotation. Colonne ET valeurs sont
 * donc bornées à l'alphabet des identifiants NUS — un identifiant entre
 * guillemets (`u."userId"`, la convention majoritaire du schéma) en sort et est
 * refusé. Les trois appels construisent une constante de module, si bien qu'une
 * valeur hors alphabet ferait échouer le CHARGEMENT du module, jamais une
 * requête.
 *
 * Liste vide → `false` : « aucune valeur ne convient », la lecture prudente
 * jusqu'au bout, là où `IN ()` serait une erreur de syntaxe.
 */
const IDENTIFIANT = /^[a-z][a-z0-9_]*$/;

export function sqlDansListe(colonne: string, valeurs: readonly string[]): string {
  const horsAlphabet = [...colonne.split("."), ...valeurs].find(
    (v) => !IDENTIFIANT.test(v),
  );
  if (horsAlphabet !== undefined) {
    throw new Error(`sqlDansListe : « ${horsAlphabet} » n'est pas un identifiant`);
  }
  if (valeurs.length === 0) return "false";
  return `${colonne} IN (${valeurs.map((v) => `'${v}'`).join(", ")})`;
}
