/**
 * Repli de recherche : minuscules + diacritiques retirés + espaces ramenées à
 * l'espace ordinaire, pour comparer une saisie à un libellé sans se soucier des
 * accents, de la casse ni du caractère d'espace (« Élodie » trouvée en tapant
 * « elodie »). Source unique — évite les copies divergentes du même NFD/strip
 * un peu partout.
 *
 * POURQUOI L'ESPACE COMPTE : le corpus est écrit en typographie française, qui
 * met une INSÉCABLE avant `! ? : ;` et dans les noms qui ne doivent pas se
 * couper (« Tech Speak'Her »). `search-index.ts` indexe les réponses de la FAQ,
 * donc ces insécables sont dans ce qu'on fouille — alors qu'un clavier produit
 * une espace ordinaire. `normalize("NFD")` ne les décompose PAS (seul NFKD le
 * ferait, mais il abîmerait au passage ligatures et exposants). D'où ce
 * remplacement explicite.
 */

/**
 * TOUT ce qui sépare deux mots, y compris les blancs de MISE EN FORME.
 *
 * `\s` couvre les espaces typographiques (insécable, fine insécable, cadratins…)
 * ET les blancs ASCII — tabulation, retour à la ligne, retour chariot. Ces
 * derniers ne viennent pas du corpus statique, écrit à la main, mais de la BASE :
 * les `keywords` d'une speakeuse assemblent bio, ville, sujets et texte des talks
 * par un simple `join(" ")`, et une bio saisie sur plusieurs lignes garde ses
 * `\n`. Le défaut est alors le même qu'avec l'insécable, à un caractère près.
 *
 * S'y ajoute U+200B (chasse nulle), le seul blanc que `\s` ignore. U+2060 (liant
 * de mots) reste dehors : il JOINT au lieu de séparer, le replier fabriquerait
 * une espace qui n'existe pas.
 *
 * PRIVÉ à dessein : ce module expose des fonctions, pas son motif. Une regex
 * exportée finit recopiée avec une nuance ailleurs, et c'est exactement la
 * divergence qu'on répare ici.
 */
const ESPACES_SOURCE = "[\\s\\u200b]";

const ESPACES = new RegExp(ESPACES_SOURCE, "g");

/** Sans drapeau `g` : `.test` reste sans état, donc réutilisable. */
const UNE_ESPACE = new RegExp(ESPACES_SOURCE);

/**
 * Index de la première espace (au sens large) à partir de `depuis`, ou -1.
 * Balaye en place : pas de `slice` intermédiaire, et surtout PAS de second
 * `search` sur la même sous-chaîne.
 */
export function premiereEspace(s: string, depuis = 0): number {
  for (let i = Math.max(0, depuis); i < s.length; i += 1) {
    if (UNE_ESPACE.test(s[i])) return i;
  }
  return -1;
}

/** Index de la dernière espace (au sens large) de `s`, ou -1. */
export function derniereEspace(s: string): number {
  for (let i = s.length - 1; i >= 0; i -= 1) {
    if (UNE_ESPACE.test(s[i])) return i;
  }
  return -1;
}

/**
 * Le repli des ESPACES seul, garanti caractère pour caractère (1 → 1).
 *
 * Fuse indexe les chaînes BRUTES et rend des index de match sur elles : c'est
 * `plierEspaces` qu'on lui donne, jamais `foldRecherche`. Retirer les
 * diacritiques change la LONGUEUR (« Élodie » décomposé fait 7 caractères) et
 * les surlignages découperaient alors le texte au mauvais endroit.
 */
export function plierEspaces(s: string): string {
  return s.replace(ESPACES, " ");
}

export function foldRecherche(s: string): string {
  return plierEspaces(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}
