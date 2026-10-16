/**
 * Rapprocher une conférence PROPOSÉE de celles déjà au répertoire — l'indice
 * qui manquait à l'arbitrage (cf. `docs/conception-arbitrage-conferences.md`,
 * défaut C).
 *
 * POURQUOI. L'orga valide pour le répertoire PARTAGÉ, celui que le sélecteur
 * propose à toutes. Or le rapprochement de l'import se fait au slug EXACT
 * (`construirePlan`) : « DevoxxFR » ne rejoint pas « Devoxx France », « KubeCon
 * + CloudNativeCon EU » ne rejoint pas « … Europe ». Deux validations créent
 * alors deux marques pour une conférence, et personne ne le voit passer.
 *
 * PUR, sans accès base (le répertoire arrive en entrée) : la même vérité peut
 * s'afficher sur la file, sur la page d'une proposition, et se tester sans
 * décor.
 *
 * DEUX NIVEAUX, et la différence est celle d'une certitude à un indice :
 * `identique` (slug égal) est un FAIT — la validation rattachera au lieu de
 * créer ; `proches` est une SUGGESTION que l'orga juge, jamais une décision.
 *
 * ASYMÉTRIE DES COÛTS, assumée : ce rapprochement est délibérément généreux.
 * Un doublon manqué installe une seconde marque dans un répertoire partagé
 * (et il faudra alors déplacer éditions, occurrences et logos pour la défaire) ;
 * un indice de trop coûte un coup d'œil.
 */

import { foldRecherche } from "@/lib/normalise-recherche";
import { slugify } from "@/lib/slug";

/** Ce qu'une conférence du répertoire doit porter pour être rapprochée : la
 * forme de `getRegistreIndex()`, en structurel — aucun import DB ici. */
export interface ConferenceRepertoriee {
  id: number;
  nom: string;
  slug: string;
  editions: { annee: number | null }[];
}

export interface Voisine {
  id: number;
  nom: string;
  slug: string;
  /** L'année de la proposition a déjà son édition chez cette conférence. */
  anneeDejaLa: boolean;
}

export interface Rapprochement {
  /** Slug identique : la validation RATTACHERA, elle ne créera pas de marque. */
  identique: Voisine | null;
  /** Ressemblances, la plus forte d'abord (plafonnées, cf. `MAX_PROCHES`). */
  proches: Voisine[];
}

/**
 * Les conférences du répertoire que le rapprochement a désignées, en UNE liste
 * (la certaine d'abord). Les deux écrans d'arbitrage en ont besoin sous cette
 * forme — pour proposer le nom canonique à recopier, ou le lien vers la fiche —
 * et l'aplatissement du champ nullable vit ici plutôt que recopié dans chacun.
 */
export function voisines({ identique, proches }: Rapprochement): Voisine[] {
  return identique ? [identique, ...proches] : proches;
}

/** Au-delà, la liste cesse d'aider : on montre les meilleures et on s'arrête. */
const MAX_PROCHES = 3;

/**
 * Part des jetons du plus COURT des deux noms qu'il faut retrouver dans
 * l'autre. 0,6 laisse passer « KubeCon + CloudNativeCon EU » vers « … Europe »
 * (2 jetons sur 3) et retient « Agile Niort » loin d'« Agile Tour » (1 sur 2).
 */
const SEUIL = 0.6;

/** Longueur minimale d'un jeton pour qu'un DÉBUT commun compte comme une
 * correspondance (« devoxxfr » ↔ « devoxx ») et pour qu'un jeton puisse porter
 * seul une ressemblance : sous ce seuil, « eu », « fr » ou « la » rapprocheraient
 * n'importe quoi. */
const JETON_SIGNIFIANT = 4;

/**
 * Part d'un mot qu'un DÉBUT commun doit couvrir pour le désigner.
 *
 * POURQUOI (mesuré le 2026-08-22 sur la file réelle). Sans elle, « Women Who Go
 * Paris » marquait 1,00 contre « ParisTestConf » — le score d'un vrai doublon :
 * « paris » commence « paristestconf », et un nom du répertoire qui ne porte
 * AUCUNE coupure fait un seul jeton, donc « la part des jetons du plus court »
 * saturait à 1 sur 1. Deux autres propositions de la file tombaient dans le même
 * piège. Le début commun doit donc peser dans le mot qu'il prétend désigner :
 * « devoxx » fait les trois quarts de « devoxxfr », « paris » un gros tiers de
 * « paristestconf ».
 */
const COUVERTURE_DEBUT = 0.6;

/**
 * Mots qui nomment la FORME de l'événement ou relient les autres, jamais son
 * identité : les garder ferait ressembler tous les meetups entre eux. Liste
 * courte et fermée — le nettoyage agressif (retirer « days », « tour »,
 * « fest ») effacerait au contraire ce qui distingue deux conférences.
 */
const MOTS_VIDES = new Set([
  "le",
  "la",
  "les",
  "de",
  "des",
  "du",
  "d",
  "et",
  "the",
  "of",
  "and",
  "meetup",
  "conference",
  "conf",
]);

/**
 * Les jetons signifiants d'un nom : replié, découpé sur tout ce qui n'est pas
 * alphanumérique, sans les mots vides ni les NOMBRES DE QUATRE CHIFFRES.
 *
 * Ces nombres sont retirés parce qu'un nom de conférence en porte un quand
 * l'année s'y est glissée à la saisie — et pas seulement une année plausible :
 * la file contient « DevFest Strasbourg 3019 · 2019 ». Retirer les quatre
 * chiffres, et pas seulement `19xx`/`20xx` (ce que fait `extraireAnnee`), est
 * ce qui fait remonter la conférence que la faute de frappe cachait.
 */
function jetons(nom: string): string[] {
  return foldRecherche(nom)
    .split(/[^a-z0-9]+/)
    .filter((j) => j.length > 1 && !MOTS_VIDES.has(j) && !/^\d{4}$/.test(j));
}

/**
 * L'un est-il un DÉBUT de l'autre, assez long pour le désigner et assez large
 * pour le couvrir ? Deux bornes, et chacune tient un cas réel : sous
 * `JETON_SIGNIFIANT`, « la » rapprocherait n'importe quoi ; sous
 * `COUVERTURE_DEBUT`, « paris » désignerait « paristestconf ».
 */
function memeDebut(a: string, b: string): boolean {
  const [court, long] = a.length <= b.length ? [a, b] : [b, a];
  return (
    court.length >= JETON_SIGNIFIANT &&
    long.startsWith(court) &&
    court.length / long.length >= COUVERTURE_DEBUT
  );
}

/** Deux jetons désignent-ils la même chose ? Égaux, ou l'un début de l'autre
 * (« devoxxfr » et « devoxx »). */
function memeJeton(a: string, b: string): boolean {
  return a === b || memeDebut(a, b);
}

/**
 * Les deux noms sont-ils la MÊME suite de lettres, à leurs séparations près ?
 * « SunnyTech » et « Sunny Tech », « RivieraDev » et « Riviera Dev ».
 *
 * POURQUOI À PART. Le découpage en jetons ne peut pas voir ces cas : c'est
 * justement la coupure qui manque d'un côté, et « sunny » ne couvre que la
 * moitié de « sunnytech ». Recoller les jetons rend la comparaison à l'échelle
 * du nom, là où elle se joue.
 *
 * ÉGALITÉ STRICTE, et pas un début commun : un nom qui COMMENCE l'autre sans
 * l'épuiser (« DevoxxFR » dans « Devoxx France ») remonte déjà par les jetons,
 * aux mêmes bornes. Une seconde voie pour le même fait ne serait qu'une branche
 * de plus, sans cas à elle.
 *
 * Et cette voie passe AVANT le plancher de longueur du score : la suite entière
 * qui coïncide est un fait plus fort qu'un jeton partagé, elle n'a pas à peser
 * quatre lettres pour valoir.
 */
function memeSuiteDeLettres(a: string[], b: string[]): boolean {
  return a.join("") === b.join("");
}

/**
 * Score de ressemblance de deux noms, par DEUX voies : la même suite de lettres
 * à ses séparations près (1, « SunnyTech » et « Sunny Tech »), sinon la part des
 * jetons du plus court qu'on retrouve dans l'autre. 0 si l'un des deux n'a aucun
 * jeton signifiant, ou si rien de ce qui correspond n'est assez long pour porter
 * une ressemblance.
 */
export function scoreRessemblance(a: string, b: string): number {
  const ja = jetons(a);
  const jb = jetons(b);
  if (ja.length === 0 || jb.length === 0) return 0;
  if (memeSuiteDeLettres(ja, jb)) return 1;
  const communs = ja.filter((x) => jb.some((y) => memeJeton(x, y)));
  if (!communs.some((j) => j.length >= JETON_SIGNIFIANT)) return 0;
  return communs.length / Math.min(ja.length, jb.length);
}

/**
 * Ce que le répertoire dit d'une proposition. `annee` sert à répondre à la
 * seule question qui change le geste : « valider ajoutera-t-il une édition, ou
 * rejoindra-t-il celle qui est déjà là ? »
 */
export function rapprocher(
  proposition: { nom: string; annee: number | null },
  repertoire: ConferenceRepertoriee[],
): Rapprochement {
  const slug = slugify(proposition.nom);
  const voisine = (c: ConferenceRepertoriee): Voisine => ({
    id: c.id,
    nom: c.nom,
    slug: c.slug,
    anneeDejaLa:
      proposition.annee !== null &&
      c.editions.some((e) => e.annee === proposition.annee),
  });

  const identique = repertoire.find((c) => c.slug === slug) ?? null;
  const proches = repertoire
    // La conférence identique n'est pas « ressemblante » : elle est dite plus
    // haut, avec sa certitude. La répéter en dessous donnerait deux lignes pour
    // un fait.
    .filter((c) => c.slug !== slug)
    .map((c) => ({ c, score: scoreRessemblance(proposition.nom, c.nom) }))
    .filter((r) => r.score >= SEUIL)
    // Score décroissant, puis nom : un ordre stable d'une visite à l'autre.
    .sort((x, y) => y.score - x.score || x.c.nom.localeCompare(y.c.nom, "fr"))
    .slice(0, MAX_PROCHES)
    .map((r) => voisine(r.c));

  return { identique: identique ? voisine(identique) : null, proches };
}
