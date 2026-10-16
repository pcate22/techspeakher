// Codes d'erreur Postgres (SQLSTATE) partagés par la couche d'accès BDD.
// Pas d'import `pg` ici : on ne fait qu'inspecter le `code` porté par l'erreur,
// ce qui garde ce helper importable partout (et testable sans base).

/** Le SQLSTATE porté par l'erreur, s'il y en a un. Une seule lecture défensive
 * du `code` du driver, au lieu d'une par prédicat. Exporté : `db.ts` s'en sert
 * pour les codes réseau, qui ne sont pas des SQLSTATE mais voyagent au même
 * endroit. */
export function sqlState(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const code = (err as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

/**
 * Violation de contrainte UNIQUE (SQLSTATE `23505`). Sert à retraduire un
 * conflit d'index en résultat métier (« déjà inscrite », « déjà rattachée »…)
 * plutôt que de propager l'erreur brute du driver.
 */
export function isUniqueViolation(err: unknown): boolean {
  return sqlState(err) === "23505";
}

/**
 * Relation inexistante (SQLSTATE `42P01`) : typiquement une migration pas
 * encore jouée en prod. Permet à une LECTURE de replier sur du vide plutôt que
 * d'abattre la page, sans masquer les autres incidents base.
 */
export function isMissingTable(err: unknown): boolean {
  return sqlState(err) === "42P01";
}

/** Colonne inexistante (SQLSTATE `42703`) : une migration de COLONNE pas encore
 * jouée, là où `42P01` signale une table entière absente. */
function isMissingColumn(err: unknown): boolean {
  return sqlState(err) === "42703";
}

/** Fabrique un handler `.catch` qui replie sur `vide` pour les codes que
 * `reconnu` accepte, et laisse remonter tout le reste. */
function replieSi(reconnu: (e: unknown) => boolean) {
  return <T,>(vide: T) =>
    (e: unknown): T => {
      if (reconnu(e)) return vide;
      throw e;
    };
}

/**
 * Handler `.catch` qui replie sur `vide` UNIQUEMENT si la table n'existe pas
 * (42P01) ; toute autre erreur remonte — un incident base ne doit jamais se
 * faire passer pour « aucune donnée ». Réservé aux lectures : les écritures
 * doivent, elles, échouer franchement.
 *
 * Lequel choisir ? `siTableAbsente` quand c'est une TABLE entière qui peut
 * manquer, `siSchemaEnRetard` (strictement plus permissif) quand la requête
 * lit une COLONNE ajoutée par une migration récente.
 */
export const siTableAbsente = replieSi(isMissingTable);

/**
 * Comme `siTableAbsente`, mais tolère aussi la colonne absente (42703) — pour
 * une lecture qui dépend d'une migration de colonne encore en attente. Même
 * règle par ailleurs : lectures seulement, tout autre code remonte.
 */
export const siSchemaEnRetard = replieSi((e) => isMissingTable(e) || isMissingColumn(e));
