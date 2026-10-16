// Mention @speakeuse dans l'éditeur de contenus — logique PURE (sans DOM, sans
// accès DB), donc testable seule. L'UI (liste déroulante, clavier) vit dans
// l'éditeur ; ici on ne fait que : détecter le jeton « @… » sous le curseur,
// filtrer l'annuaire, et produire le lien Markdown à insérer.

import { foldRecherche } from "@/lib/normalise-recherche";

/** Une speakeuse mentionnable : nom affiché + chemin de sa fiche (annuaire). */
export interface MentionItem {
  name: string;
  href: string;
}

/** Jeton de mention actif sous le curseur : le texte tapé après « @ » et sa plage. */
export interface ActiveMention {
  /** Texte saisi après le « @ » (sans le « @ »), jusqu'au curseur. */
  query: string;
  /** Index du « @ » dans le texte. */
  start: number;
  /** Index du curseur (fin de la plage à remplacer). */
  end: number;
}

// Un « @ » n'ouvre une mention que s'il est en début de texte ou précédé d'une
// frontière (espace ou ouvrant). Ça évite de déclencher sur une adresse e-mail
// (« a@b »), où le « @ » est collé à un caractère de mot.
const FRONTIERE_AVANT = /[\s(["'«]/;

/**
 * Détecte la mention en cours de frappe qui se termine au curseur. On remonte
 * depuis le curseur : les caractères du jeton sont tout sauf une espace ou un
 * « @ ». Le jeton n'est actif que s'il commence par un « @ » posé sur une
 * frontière. Renvoie null s'il n'y a pas de mention active à cet endroit.
 */
export function activeMention(text: string, caret: number): ActiveMention | null {
  if (caret < 0 || caret > text.length) return null;
  let i = caret - 1;
  while (i >= 0 && !/\s/.test(text[i]) && text[i] !== "@") i--;
  if (i < 0 || text[i] !== "@") return null;
  const prev = i > 0 ? text[i - 1] : "";
  if (prev !== "" && !FRONTIERE_AVANT.test(prev)) return null;
  return { query: text.slice(i + 1, caret), start: i, end: caret };
}

/**
 * Filtre l'annuaire pour une saisie donnée (repli accents/casse via
 * `foldRecherche`). Les noms qui COMMENCENT par la saisie remontent en premier,
 * puis ordre alphabétique FR. Sans saisie (« @ » seul), renvoie les premières
 * de l'annuaire. Résultat borné à `limit`.
 */
export function filterMentions(items: MentionItem[], query: string, limit = 8): MentionItem[] {
  const q = foldRecherche(query.trim());
  if (!q) return items.slice(0, limit);
  return items
    .map((it) => ({ it, hay: foldRecherche(it.name) }))
    .filter((x) => x.hay.includes(q))
    .sort(
      (a, b) =>
        Number(b.hay.startsWith(q)) - Number(a.hay.startsWith(q)) ||
        a.it.name.localeCompare(b.it.name, "fr"),
    )
    .slice(0, limit)
    .map((x) => x.it);
}

/**
 * Remplace la plage `[start, end)` (le « @… » en cours) par un lien Markdown
 * vers la fiche. Renvoie le nouveau texte et la position du curseur après le
 * lien. Le libellé du lien reste le nom (sans « @ »).
 */
export function insertMention(
  text: string,
  start: number,
  end: number,
  item: MentionItem,
): { value: string; caret: number } {
  const lien = `[${item.name}](${item.href})`;
  const value = text.slice(0, start) + lien + text.slice(end);
  return { value, caret: start + lien.length };
}
