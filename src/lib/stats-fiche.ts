import type { Talk } from "@/lib/talks";
import { isExactTalkDate, estPasseTalkDate } from "@/lib/talk-date";

/**
 * Stats SOBRES de la fiche publique (conception N1 §2.5, écran B) : des faits
 * publics, jamais comparatifs — « 3 talks · 2 scènes faites ». Une scène est
 * « faite » quand son occurrence porte une date EXACTE strictement passée —
 * les règles de précision et de passé vivent dans `talk-date.ts` (source
 * unique), et le fil (`getScenesRecentes`) applique la même borne stricte.
 * Fonction pure, testée sans BDD.
 */
export function statsFiche(
  talks: Talk[],
  aujourdhui: string,
): { talks: number; scenes: number } {
  const scenes = talks
    .flatMap((t) => t.occurrences)
    .filter((o) => isExactTalkDate(o.date) && estPasseTalkDate(o.date!, aujourdhui))
    .length;
  return { talks: talks.length, scenes };
}
