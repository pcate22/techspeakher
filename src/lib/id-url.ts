/**
 * UN ID VENU DE L'EXTÉRIEUR est-il utilisable ? — la garde partagée des ids
 * d'URL et de champ caché, avant qu'ils n'atteignent la base.
 *
 * `Number.isInteger` ne suffit pas, et c'est un piège discret : la notation
 * exponentielle en sort vraie (`Number.isInteger(1e21)`), et `pg` sérialise la
 * valeur par `toString()` — donc `"1e+21"` part tel quel dans un paramètre
 * `integer`. Postgres répond `invalid input syntax for type integer`, ce qui
 * fait un **500 là où l'écran voulait un 404** (relevé par la passe sécurité du
 * lot d'arbitrage, 2026-08-21).
 *
 * D'où les deux bornes : `isSafeInteger` (la valeur se dit sans exposant) et le
 * plafond `int4`, qui est le type réel des colonnes `SERIAL` du schéma. Au-delà,
 * il n'existe aucune ligne à trouver : la refuser ici est la bonne réponse, et
 * la seule qui rende un 404 honnête.
 *
 * PURE et sans dépendance : les pages serveur, les Server Actions et les libs
 * en ont besoin, et une copie par appelant est une occasion de plus d'oublier
 * l'une des deux bornes.
 */

/** Plus grand `integer` de Postgres — le type des colonnes `SERIAL` du schéma. */
const INT4_MAX = 2_147_483_647;

export function estIdValide(n: number): boolean {
  return Number.isSafeInteger(n) && n > 0 && n <= INT4_MAX;
}

/**
 * L'id porté par un segment d'URL ou un champ caché, ou `null` s'il n'en est
 * pas un. Les appelants écrivaient tous les deux mêmes lignes (`Number(...)`
 * puis la garde) avant de brancher sur `notFound()` ou sur une erreur douce.
 */
export function idDepuis(brut: string | FormDataEntryValue | null | undefined): number | null {
  if (brut == null || typeof brut !== "string") return null;
  const n = Number(brut);
  return estIdValide(n) ? n : null;
}
