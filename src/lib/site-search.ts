import type { FuseResult } from "fuse.js";
import { searchIndex, dedupeSearchItems, type SearchItem } from "@/data/search-index";
import { foldRecherche, premiereEspace } from "@/lib/normalise-recherche";
import { fuseOptions, requiredRun, longestRun, foldedIncludes } from "@/lib/search-relevance";

/**
 * Champs dont un match est VISIBLE dans le résultat affiché (titre, aperçu,
 * pastille catégorie). Un match sur `keywords` (bio, secteurs, texte des talks)
 * est invisible : on conserve ces résultats — ils permettent de retrouver une
 * speakeuse par ce qu'elle raconte — mais on les classe APRÈS ceux dont on voit
 * la raison, pour qu'un résultat ne « remonte pas sans qu'on comprenne
 * pourquoi ».
 */
const VISIBLE_KEYS = new Set<string>(["title", "description", "category"]);

/**
 * Champs dont on tire l'extrait affiché sous le titre, par ordre de préférence.
 * On exclut `title` (déjà affiché en entier) et `category` (trop court, et déjà
 * porté par la pastille) : on met en avant l'aperçu, sinon le plein-texte caché
 * — pour qu'un match dans la bio ou un talk devienne enfin VISIBLE. Un résultat
 * qui ne matche QUE sur `category` reste donc sans extrait (repli sur la
 * description brute) : sa raison est la pastille de catégorie.
 */
const SNIPPET_FIELDS = ["description", "keywords"];

/** Longueur cible de l'extrait et contexte de tête avant le 1er terme trouvé. */
const SNIPPET_MAX = 100;
const SNIPPET_LEAD = 24;

/** Un morceau d'extrait : `hit` = partie qui correspond à la recherche (surlignée). */
export interface HighlightSegment {
  text: string;
  hit: boolean;
}

/** Résultat classé, prêt à afficher : l'item + son extrait surligné (ou null). */
export interface RankedResult {
  item: SearchItem;
  /** Extrait montrant le terme trouvé ; null → afficher `item.description` tel quel. */
  snippet: HighlightSegment[] | null;
}

/**
 * Options Fuse de la recherche globale : seuils partagés (`fuseOptions`) +
 * pondération propre à l'index mixte (titre > aperçu > catégorie > plein-texte
 * caché). Le plein-texte reste indexé faiblement pour retrouver un terme enfoui
 * sans supplanter un vrai match de titre.
 */
export const FUSE_OPTIONS = fuseOptions<SearchItem>([
  { name: "title", weight: 2 },
  { name: "description", weight: 1 },
  { name: "category", weight: 0.5 },
  { name: "keywords", weight: 0.3 },
]);

/**
 * Liste indexable : contenu éditorial (index statique) + speakeuses publiées
 * (annuaire en base), dédupliquée par (url + titre) pour qu'un même contenu
 * n'apparaisse jamais deux fois.
 */
export function buildSearchList(speakers: SearchItem[]): SearchItem[] {
  return dedupeSearchItems([...searchIndex, ...speakers]);
}

/**
 * Découpe `value` en une fenêtre d'~`SNIPPET_MAX` caractères centrée sur le 1er
 * terme trouvé, et renvoie les morceaux surlignés (`hit`) ou non. Ajoute « … »
 * quand la fenêtre ne part pas du début / ne va pas jusqu'à la fin.
 */
export function makeSnippet(
  value: string,
  indices: ReadonlyArray<readonly [number, number]>,
): HighlightSegment[] {
  if (!value) return [];
  const ranges = [...indices].filter(([s, e]) => e >= s).sort((a, b) => a[0] - b[0]);
  const firstStart = ranges[0]?.[0] ?? 0;

  let start = 0;
  let end = value.length;
  if (value.length > SNIPPET_MAX) {
    start = Math.max(0, firstStart - SNIPPET_LEAD);
    end = Math.min(value.length, start + SNIPPET_MAX);
    start = Math.max(0, end - SNIPPET_MAX);
    // Évite de commencer au milieu d'un mot : on repart après la 1re espace,
    // sans jamais dépasser le 1er terme trouvé (le hit reste visible).
    // `premiereEspace` reconnaît TOUTE espace, pas seulement U+0020 : le corpus
    // porte des insécables (« Tech\u00A0Speak'Her ») et le plein-texte venu de la
    // base des retours à la ligne. Les sauter ouvrait la fenêtre au milieu d'un
    // mot. C'est le MÊME jeu de caractères que le repli d'indexation : deux jeux
    // qui divergent, c'est une fenêtre qui s'ouvre là où le repli n'a rien vu.
    if (start > 0) {
      const espace = premiereEspace(value, start);
      if (espace !== -1 && espace < firstStart) start = espace + 1;
    }
  }

  const segments: HighlightSegment[] = [];
  const push = (text: string, hit: boolean) => {
    if (!text) return;
    const last = segments[segments.length - 1];
    if (last && last.hit === hit) last.text += text;
    else segments.push({ text, hit });
  };

  if (start > 0) push("…", false);
  let cursor = start;
  for (const [s, e] of ranges) {
    const hitStart = Math.max(s, cursor);
    const hitEnd = Math.min(e + 1, end); // e est inclusif
    if (hitEnd <= cursor || hitStart >= end) continue;
    if (hitStart > cursor) push(value.slice(cursor, hitStart), false);
    push(value.slice(hitStart, hitEnd), true);
    cursor = hitEnd;
  }
  if (cursor < end) push(value.slice(cursor, end), false);
  if (end < value.length) push("…", false);
  return segments;
}

/**
 * Positions (inclusives) de `query` dans `value`, repli casse + accents des deux
 * côtés (« cate » trouve « Catéline »). On surligne CE que l'utilisateur a tapé,
 * là où ça apparaît vraiment — sans faire confiance aux index flous de Fuse, qui
 * pointent parfois un fragment voisin (« rachel » → « V-ache »). Repli
 * longueur-à-longueur pour les accents latins usuels ; en cas d'écart de
 * longueur (ligature rare), on renonce au surlignage plutôt que de mal l'aligner.
 */
function foldedRanges(value: string, query: string): [number, number][] {
  const folded = foldRecherche(value);
  const needle = foldRecherche(query.trim());
  if (!needle || folded.length !== value.length) return [];
  const ranges: [number, number][] = [];
  for (let i = folded.indexOf(needle); i !== -1; i = folded.indexOf(needle, i + needle.length)) {
    ranges.push([i, i + needle.length - 1]);
  }
  return ranges;
}

/**
 * Extrait surligné : premier champ affichable (aperçu, sinon plein-texte caché)
 * qui contient RÉELLEMENT la requête. `title` est exclu (déjà affiché en
 * entier) ; `category` aussi (porté par la pastille). Renvoie null si la
 * requête n'apparaît dans aucun (ex. match par faute de frappe) → aperçu brut.
 */
function buildSnippet(item: SearchItem, query: string): HighlightSegment[] | null {
  for (const field of SNIPPET_FIELDS) {
    const value = field === "description" ? item.description : item.keywords;
    if (!value) continue;
    const ranges = foldedRanges(value, query);
    if (ranges.length) return makeSnippet(value, ranges);
  }
  return null;
}

/** La requête apparaît-elle RÉELLEMENT (sous-chaîne repliée) dans un champ ? */
function hasFoldedMatch(item: SearchItem, query: string): boolean {
  return foldedIncludes(
    [item.title, item.description, item.category, item.keywords],
    foldRecherche(query.trim()),
  );
}

const matchesVisibleField = (result: FuseResult<SearchItem>) =>
  (result.matches ?? []).some((m) => VISIBLE_KEYS.has(m.key ?? ""));

/**
 * Classe les résultats Fuse pour la requête `query` et calcule l'extrait des
 * `limit` premiers.
 *  - Filtre d'abord le bruit : on garde un résultat si la requête y apparaît
 *    vraiment (sous-chaîne repliée) OU via un fragment flou solide
 *    ≥ `requiredRun(query)` (tolérance aux fautes de frappe). Sinon on l'écarte :
 *    c'est un alignement de lettres éparses (cf. requiredRun).
 *  - Ordre : matchs sur un champ VISIBLE d'abord, puis plein-texte caché. Deux
 *    partitions concaténées (Array.filter préserve l'ordre de pertinence de
 *    Fuse dans chaque groupe) — inutile de trier.
 *  - Le classement à tiers ET l'extrait surligné répondent au même symptôme
 *    (« résultat sans raison visible ») de deux façons complémentaires : le
 *    tiers ORDONNE (un match caché ne coiffe pas un match visible), l'extrait
 *    EXPLIQUE (on voit le terme surligné, même issu de la bio ou d'un talk).
 *  - L'extrait n'est calculé qu'après troncature (jamais plus de `limit` fois).
 */
export function rankResults(
  results: FuseResult<SearchItem>[],
  query: string,
  limit: number = results.length,
): RankedResult[] {
  const minRun = requiredRun(query);
  const kept = results.filter(
    (r) => hasFoldedMatch(r.item, query) || longestRun(r.matches) >= minRun,
  );
  const ordered = [
    ...kept.filter(matchesVisibleField),
    ...kept.filter((r) => !matchesVisibleField(r)),
  ].slice(0, limit);

  return ordered.map((result) => ({
    item: result.item,
    snippet: buildSnippet(result.item, query),
  }));
}
