import type { IFuseOptions, FuseResultMatch, FuseResult } from "fuse.js";
import { foldRecherche, plierEspaces } from "@/lib/normalise-recherche";

/**
 * Primitives de pertinence PARTAGÉES par les deux moteurs de recherche (globale
 * `site-search` et speakeuses `speaker-search`) : mêmes seuils, même filtre
 * anti-bruit, un seul endroit. Évite la dérive entre surfaces (c'était l'origine
 * du bug « brain » : deux moteurs divergents).
 */

/**
 * Une FEUILLE d'index, ramenée à la chaîne que Fuse comparera.
 *
 * Les chaînes passent par le repli des espaces ; un nombre ou un booléen est
 * rendu tel qu'il s'écrit. Ce dernier cas n'existe dans aucune `keys`
 * d'aujourd'hui — toutes sont `string` ou `string[]` — mais rendre `""` sur une
 * clé numérique ajoutée demain la rendrait INTROUVABLE en silence, sans qu'une
 * seule assertion tombe. Un objet reste vide : Fuse sait descendre dans les
 * chemins imbriqués, ce n'est pas à ce repli de le refaire.
 */
function feuille(v: unknown): string {
  if (typeof v === "string") return plierEspaces(v);
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

/**
 * Options Fuse communes, paramétrées par les `keys` de chaque surface.
 *  - INVARIANT `ignoreLocation: true` : sans lui, un mot enfoui dans un champ
 *    long (texte d'un talk) n'est PAS trouvé — c'était le bug « brain ». Ne pas
 *    retirer.
 *  - `threshold: 0.2` : tolère accents (« elodie » → « Élodie ») et petites
 *    fautes (« kubernets » → « kubernetes »), mais coupe les alignements de
 *    lettres éparses.
 *  - `includeMatches` : positions des termes, pour le filtre `longestRun` et le
 *    surlignage.
 */
export function fuseOptions<T>(keys: IFuseOptions<T>["keys"]): IFuseOptions<T> {
  return {
    keys,
    threshold: 0.2,
    minMatchCharLength: 2,
    ignoreLocation: true,
    includeMatches: true,
    /**
     * LE CORPUS EST INDEXÉ EN ESPACES ORDINAIRES.
     *
     * La typographie française met une insécable avant `! ? : ;` et dans les
     * noms qui ne doivent pas se couper : le corpus en contient, le clavier
     * d'une visiteuse produit une espace ordinaire. Fuse compare des chaînes
     * brutes, donc l'insécable casse en deux le fragment CONTIGU que
     * `longestRun` mesure — « bénévoles tech speak her » tombait sous
     * `requiredRun` et le résultat disparaissait, alors que la phrase cherchée
     * y est mot pour mot.
     *
     * Replier ICI plutôt que dans les données : le texte reste écrit en bonne
     * typographie, et la recherche cesse de s'en soucier. Les espaces sont les
     * seules repliées, parce que le repli doit être caractère pour caractère —
     * les index de match rendus par Fuse servent à surligner le texte brut.
     *
     * Le chemin est résolu ICI plutôt que par `Fuse.config.getFn` : importer
     * Fuse comme VALEUR le ferait entrer dans le bundle chargé d'emblée, alors
     * que `SearchBar` et `SpeakeusesFilter` prennent soin de l'importer à la
     * volée, à la première frappe. Mesuré : 84 Ko de plus au premier rendu de
     * chaque page.
     */
    getFn: (obj, path) => {
      const morceaux = Array.isArray(path) ? path : String(path).split(".");
      let v: unknown = obj;
      for (const m of morceaux) {
        if (v == null) return "";
        v = (v as Record<string, unknown>)[m];
      }
      // Un champ tableau (`sujets`, `secteurs`…) : Fuse veut une liste de
      // chaînes. Sans ce cas, l'insécable survivait dans tous ces champs.
      return Array.isArray(v) ? v.map(feuille) : feuille(v);
    },
  };
}

/**
 * Longueur minimale d'un fragment CONTIGU pour qu'un match « compte ». Sans
 * elle, la recherche floue aligne une requête sur des lettres éparses
 * (« brain » → « ...m-an-ager org-ani-satrice... ») : faux positifs. Les
 * requêtes de 2-3 lettres doivent matcher en entier ; « rachel » → 4.
 */
export function requiredRun(query: string): number {
  const n = query.trim().length;
  return n <= 3 ? n : Math.ceil(n * 0.6);
}

/** Longueur du plus long fragment contigu matché par Fuse, tous champs confondus. */
export function longestRun(matches: readonly FuseResultMatch[] | undefined): number {
  let max = 0;
  for (const m of matches ?? [])
    for (const [s, e] of m.indices ?? []) max = Math.max(max, e - s + 1);
  return max;
}

/** `needle` (déjà replié) apparaît-il comme sous-chaîne repliée dans une des valeurs ? */
export function foldedIncludes(
  values: ReadonlyArray<string | undefined>,
  needle: string,
): boolean {
  if (!needle) return false;
  return values.some((v) => v != null && v !== "" && foldRecherche(v).includes(needle));
}

/**
 * LA REQUÊTE PASSE PAR LA MÊME PORTE QUE LE CORPUS.
 *
 * `fuseOptions.getFn` replie les espaces de l'index ; si l'appelant tend la
 * requête brute, une insécable côté saisie casse à nouveau le fragment contigu.
 * Le cas n'est pas théorique depuis que le site sert son propre nom avec une
 * insécable : sélectionner « Tech Speak'Her » sur une page et le coller dans la
 * recherche envoie exactement cette requête-là.
 *
 * D'où cette fonction plutôt qu'un `plierEspaces` recopié à chaque appel : un
 * appelant qui l'oublie casse la recherche sans rien faire tomber.
 */
export function chercherReplie<T>(
  fuse: { search: (q: string, o?: { limit?: number }) => FuseResult<T>[] },
  requete: string,
  limite?: number,
): FuseResult<T>[] {
  // `limite === undefined`, pas un test de véracité : 0 veut dire zéro résultat.
  return fuse.search(plierEspaces(requete), limite === undefined ? undefined : { limit: limite });
}
