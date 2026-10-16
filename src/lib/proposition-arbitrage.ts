/**
 * Les MOTS de l'arbitrage d'une proposition de conférence — ce qu'un geste
 * emporte, dit avant le clic.
 *
 * Ici plutôt que dans la page, pour la même raison que `VUES` dans
 * `vue-liste.ts` : une phrase que la charte contraint (forme positive, nom de la
 * chose concernée, périmètre chiffré) se garde par un test, et un test ne peut
 * pas atteindre le contenu d'une modale Radix fermée.
 *
 * PURE : aucun accès base, aucun JSX.
 */

import { nb } from "@/lib/format";

/**
 * Ce qu'écarter une proposition emporte — le « périmètre chiffré » qu'un geste
 * de palier 2 doit annoncer (`docs/principes-conception-ui.md` §10).
 *
 * Les deux effets sont réels, durables, et invisibles depuis l'écran : les
 * saisies restent hors ligne chez leurs autrices, et le nom est ensuite refusé
 * à celle qui l'a proposé — TOUTES ANNÉES confondues
 * (`findPropositionByNom` → `dejaEcartee`).
 *
 * Forme POSITIVE de bout en bout (CLAUDE.md) : on dit ce qui EST. « elle ne
 * pourra plus le proposer » disait la même chose en interdisant, et c'est
 * exactement ce que la charte du dépôt refuse — `arbitrage-mots.test.ts` tient
 * la règle.
 */
export function effetDuRefus(p: {
  nom: string;
  nbSaisies: number;
  proposeParNom: string | null;
}): string {
  const saisies =
    p.nbSaisies === 0
      ? "Aucune saisie derrière elle."
      : `${nb(p.nbSaisies, "talk")} restera${p.nbSaisies > 1 ? "ient" : ""} hors ligne, dans l'espace de son autrice.`;
  const qui = p.proposeParNom ?? "Son autrice";
  return `${saisies} ${qui} verra « ${p.nom} » écartée, et ce nom lui sera refusé pour toute année. Revenir en arrière demande d'ouvrir la base.`;
}
