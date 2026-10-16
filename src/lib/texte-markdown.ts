import { uneSeuleLigne } from "@/lib/format";
import { derniereEspace } from "@/lib/normalise-recherche";

// Markdown → texte brut, pour l'INDEXATION et l'aperçu de la recherche.
//
// Ce n'est PAS un rendu : les articles passent par `react-markdown` +
// `rehype-sanitize` (cf. src/lib/markdown.tsx) et ne changent pas. Ici on veut
// deux choses seulement : qu'aucune syntaxe ne remonte dans un aperçu, et
// qu'une recherche de mots ne matche pas « ## » ou une URL. D'où une fonction
// naïve, sans dépendance ni analyse syntaxique.

/** Ordre important : le code part en premier, il peut contenir tout le reste. */
const REGLES: [RegExp, string][] = [
  // Filets horizontaux AVANT les puces : « - - - » commence comme une puce, et
  // la règle des puces le réduirait à « - - », que plus rien ne reconnaît.
  [/^[ \t]{0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/gm, " "],
  // Blocs de code : clôturés, OU ouverts et jamais refermés. Le second cas est
  // systématique, pas une coquille : le corps arrive tronqué à 600 caractères
  // par SQL, donc toute clôture au-delà est coupée. Sans lui, deux backticks
  // partent en code en ligne (règle suivante) et le troisième reste affiché.
  [/```[\s\S]*?```|```[\s\S]*$/g, " "],
  [/`([^`]*)`/g, "$1"], // code en ligne : on garde le mot
  [/!\[[^\]]*\]\([^)]*\)/g, " "], // images : rien à indexer, l'alt décrit un visuel
  // Liens : le libellé reste, l'URL part. Le libellé peut contenir des crochets
  // APPARIÉS ; sans ça la regex renonce et l'URL entière atterrit dans l'aperçu.
  [/\[((?:[^\][]|\[[^\][]*\])*)\]\([^)]*\)/g, "$1"],
  [/^\s{0,3}#{1,6}\s+/gm, ""], // marqueurs de titre
  [/^\s{0,3}>\s?/gm, ""], // citations
  [/^\s{0,3}[-*+]\s+/gm, ""], // listes à puces
  [/^\s{0,3}\d+\.\s+/gm, ""], // listes numérotées
  // Emphase par astérisques, du plus long au plus court. Les marqueurs DOUBLES
  // prennent leur contenu de façon NON GOURMANDE jusqu'au marqueur de même
  // longueur : une astérisque isolée à l'intérieur (« Prix : 3 * 4 € ») survit,
  // là où une classe [^*] la mangeait et laissait le « ** » de fermeture
  // remonter dans l'aperçu. Le marqueur SIMPLE garde au contraire [^*\n], pour
  // qu'une astérisque isolée ne puisse pas ouvrir une emphase.
  //
  // La règle triple n'est pas morte pour autant : sur du markdown MAL formé,
  // elle absorbe des astérisques parasites que « ** puis * » laisse passer
  // (mesuré : elle gagne dans 55 % des cas où les deux divergent).
  [/\*\*\*([\s\S]+?)\*\*\*/g, "$1"],
  [/\*\*([\s\S]+?)\*\*/g, "$1"],
  [/\*([^*\n]+)\*/g, "$1"],
  // Emphase par soulignés : bornée par une limite de mot, sinon `lien_externe`
  // perdrait son souligné.
  [/\b_{1,3}([^_]+)_{1,3}\b/g, "$1"],
];

/**
 * Texte brut d'un Markdown, replié sur une ligne. Rend `""` quand il ne reste
 * rien de lisible (un bloc de code seul, par exemple).
 *
 * Le repli passe par `uneSeuleLigne`, qui PRÉSERVE les espaces insécables :
 * un `\s+` naïf écraserait l'espace avant `! ? : ;` et l'aperçu
 * d'un article se lirait autrement que partout ailleurs sur le site.
 */
export function texteBrut(markdown: string): string {
  let texte = markdown;
  for (const [motif, remplacement] of REGLES) texte = texte.replace(motif, remplacement);
  return uneSeuleLigne(texte);
}

/**
 * Tronque à `max` caractères sur une frontière de mot, avec une ellipse. Sert
 * l'aperçu d'un contenu sans chapô : le corps arrive déjà tronqué par SQL, donc
 * coupé au milieu d'un mot, et un aperçu qui finit sur un moignon se lit comme
 * un bug d'affichage. Sans espace avant la limite, on coupe net (un mot plus
 * long que l'aperçu déborderait).
 */
export function couperSurUnMot(texte: string, max: number): string {
  if (max < 1) return "";
  if (texte.length <= max) return texte;
  const tete = texte.slice(0, max);
  // TOUTE espace, pas seulement U+0020. Le corpus est écrit en typographie
  // française : « Tech Speak'Her » et les insécables devant `! ? : ;` sont
  // partout, et un `lastIndexOf(" ")` reculait jusqu'à l'espace ordinaire
  // PRÉCÉDENTE — mesuré : 169 caractères rognés à 86, soit la moitié de
  // l'aperçu perdue. Même jeu de caractères que la fenêtre d'extrait de
  // `site-search`, qui répare le même défaut de l'autre côté.
  const espace = derniereEspace(tete);
  // Sans espace avant la limite, on coupe net : -1 garde la place de l'ellipse.
  const brut = tete.slice(0, espace > 0 ? espace : max - 1);
  // Une coupe nette peut tomber ENTRE les deux moitiés d'un caractère hors du
  // plan de base (emoji) : le navigateur afficherait un « \uFFFD ».
  const coupe = brut.replace(/[\uD800-\uDBFF]$/, "");
  // La ponctuation qui précédait la coupe n'a plus de rôle devant l'ellipse —
  // sauf « ! » et « ? », qui PORTENT le sens : « Prête à monter sur scène ? »
  // rogné devient une affirmation en suspens.
  // Si le rognage ne laisse RIEN (que de la ponctuation jusqu'à la coupe), on
  // garde la matière brute : un aperçu réduit à « … » ne dit rien.
  const net = coupe.replace(/[\s,;:.…-]+$/, "");
  return `${net || coupe.trimEnd()}…`;
}
