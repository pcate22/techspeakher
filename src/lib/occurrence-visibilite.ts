/**
 * Ce qui rend une conférence de talk PUBLIABLE — une seule copie, importée par
 * toutes les lectures publiques (fiche annuaire, agenda, fil).
 *
 * Depuis la migration 068, une speakeuse peut saisir une conférence absente du
 * répertoire : la saisie est enregistrée tout de suite et rattachée à sa
 * proposition (`talk_occurrences.proposition_id`) au lieu du répertoire. Tant
 * que cette colonne est renseignée, la saisie attend l'arbitrage orga (ou a été
 * écartée) et ne doit apparaître nulle part publiquement. La validation la remet
 * à NULL : rien d'autre à filtrer le jour où la conférence est acceptée.
 *
 * Module à part (pas dans `talks.ts`) pour rester importable partout sans tirer
 * l'accès DB — et pour qu'un test qui mocke `@/lib/talks` ne fasse pas
 * disparaître la condition de visibilité sous ses pieds.
 *
 * `o` est l'alias de `talk_occurrences` dans la requête appelante.
 */
export const OCCURRENCE_PUBLIABLE = "o.proposition_id IS NULL";
