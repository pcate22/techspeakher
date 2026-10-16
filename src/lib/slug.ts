/**
 * Slugify partagé — JUMEAU de l'expression SQL de la migration 027 (translate
 * accents → regexp non-alphanum → lower → trim '-'). Deux slugifies divergents
 * créeraient des doublons (clé de navigation ET d'unicité) : si l'un des deux
 * change, changer l'autre. L'équivalence avec le SQL réel est verrouillée par
 * `src/__tests__/conferences-db.integration.test.ts`.
 *
 * Fonction PURE, sans dépendance : réutilisable par le domaine des conférences
 * comme par celui des contenus éditables, sans tirer d'accès DB.
 */
export function slugify(nom: string): string {
  const from = "àâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ";
  const to = "aaaeeeeiioouuucAAAEEEEIIOOUUUC";
  let translit = "";
  for (const ch of nom) {
    const i = from.indexOf(ch);
    translit += i === -1 ? ch : to[i];
  }
  return translit
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .toLowerCase()
    .replace(/^-+|-+$/g, "");
}
