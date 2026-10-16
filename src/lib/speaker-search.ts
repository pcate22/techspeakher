import type { IFuseOptions, FuseResult } from "fuse.js";
import { foldRecherche } from "@/lib/normalise-recherche";
import { fuseOptions, requiredRun, longestRun, foldedIncludes, chercherReplie } from "@/lib/search-relevance";

/**
 * Moteur de matching des speakeuses, MUTUALISÉ entre deux surfaces (mêmes règles,
 * UX distinctes) :
 *  - recherche globale (⌘K) : lanceur multi-contenus → renvoie des liens ;
 *  - annuaire (`/speakeuses`) : filtre la liste en place, croisé aux facettes.
 *
 * Ce module ne connaît que le MATCHING (normalisation + champs + seuils +
 * matcher renvoyant des ids classés). Il ne rend rien et ne navigue pas :
 * chaque surface garde son propre rendu.
 */

/** Normalisation de recherche (minuscules + accents retirés) — source unique,
 *  partagée. Alias sémantique de `foldRecherche` pour ce domaine. */
export { foldRecherche as normalizeText };

/**
 * Un profil réduit à ce qui est cherchable. `text` (bio + talks) est fourni à
 * part du DTO d'affichage : l'annuaire le reçoit déjà via `searchText`, sans
 * l'exposer sur la carte (minimisation du payload liste).
 */
export interface SpeakerDoc {
  id: number;
  name: string;
  titreProfil: string;
  poste: string;
  entreprise: string;
  secteurs: string[];
  sujets: string[];
  regions: string[];
  langues: string[];
  /**
   * Plein-texte cherchable, non affiché en liste : bio + titres/descriptions de
   * talks. ⚠️ RGPD (minimisation) : côté ANNUAIRE, ne PAS y replier la `ville`
   * (agrégation ville↔identité en masse dans un payload public envoyé à tout
   * visiteur). La ville reste cherchable via la recherche globale uniquement.
   */
  text: string;
}

/**
 * Champs cherchables + poids, en UN SEUL endroit : nom > titre/poste >
 * entreprise > secteurs/sujets/zones/langues > bio/talks. Un match sur le nom
 * prime ; le plein-texte (bio/talks) reste trouvable mais ne supplante pas.
 */
export const SPEAKER_FUSE_KEYS: NonNullable<IFuseOptions<SpeakerDoc>["keys"]> = [
  { name: "name", weight: 4 },
  { name: "titreProfil", weight: 2 },
  { name: "poste", weight: 2 },
  { name: "entreprise", weight: 1.5 },
  { name: "secteurs", weight: 1 },
  { name: "sujets", weight: 1 },
  { name: "regions", weight: 1 },
  { name: "langues", weight: 1 },
  { name: "text", weight: 0.3 },
];

/**
 * Options Fuse : seuils partagés (`fuseOptions`, dont l'INVARIANT
 * `ignoreLocation: true` — bug « brain ») + pondération speakeuses.
 */
export const SPEAKER_FUSE_OPTIONS = fuseOptions<SpeakerDoc>(SPEAKER_FUSE_KEYS);

/** Toutes les valeurs cherchables d'un doc, à plat (pour le filtre anti-bruit). */
function searchableValues(doc: SpeakerDoc): string[] {
  return [
    doc.name,
    doc.titreProfil,
    doc.poste,
    doc.entreprise,
    ...doc.secteurs,
    ...doc.sujets,
    ...doc.regions,
    ...doc.langues,
    doc.text,
  ];
}

/** Constructeur Fuse (injecté pour permettre l'import paresseux côté client). */
type FuseCtor = new (list: SpeakerDoc[], options: IFuseOptions<SpeakerDoc>) => {
  search: (q: string) => FuseResult<SpeakerDoc>[];
};

/**
 * Construit un matcher réutilisable : `(query) => ids classés par pertinence`.
 * Client-side, synchrone une fois l'index bâti. Renvoie des **ids** (jamais des
 * liens) : chaque surface les croise/rend à sa façon.
 *
 * Un résultat n'est gardé que si la requête y apparaît vraiment (sous-chaîne
 * repliée) OU via un fragment flou contigu significatif — les alignements de
 * lettres éparses sont écartés. Requête < 2 caractères : tous les ids (ordre
 * d'origine), l'annuaire affiche alors tout et laisse les facettes filtrer.
 *
 * ⚠️ Invariant : `items` ne doit contenir QUE des profils publiés. Le matcher
 * est client-side (le `text` de chaque doc part au navigateur) : alimenter avec
 * un profil brouillon/en attente/masqué diffuserait son contenu. Les surfaces
 * n'alimentent aujourd'hui qu'en publié (`getPublishedAnnuaire`).
 */
export function createSpeakerMatcher(
  Fuse: FuseCtor,
  items: SpeakerDoc[],
): (query: string) => number[] {
  const fuse = new Fuse(items, SPEAKER_FUSE_OPTIONS);
  return (raw: string) => {
    const query = raw.trim();
    if (query.length < 2) return items.map((d) => d.id);
    const needle = foldRecherche(query);
    const minRun = requiredRun(query);
    return chercherReplie(fuse, query)
      .filter((r) => foldedIncludes(searchableValues(r.item), needle) || longestRun(r.matches) >= minRun)
      .map((r) => r.item.id);
  };
}
