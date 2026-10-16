import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * LES DOCS DE PASSATION SONT TENUS À LA MAIN, ET LEUR EN-TÊTE EST CE QUE LIT
 * LA SESSION SUIVANTE.
 *
 * La dérive, constatée quatre fois de suite : on ajoute au CORPS (une section
 * datée, une entrée de registre) sans recaler la ligne du HAUT. La roadmap a
 * porté « Dernière mise à jour : 2026-08-15 » entre deux sections du 08-16 et
 * du 08-18 ; `principes-tests.md` a porté 08-18 avec cinq entrées de registre
 * du 08-21 en dessous. Un doc de suivi qu'on ne raye pas ne vieillit pas
 * seulement, il BLOQUE : le 18/08, une factorisation sûre a été refusée sur la
 * foi d'une liste périmée.
 *
 * CE QUE CE TEST NE JUGE PAS, et qui reste à la charge de la session
 * (`docs/clore-une-session.md`) : l'EMPILEMENT — un addendum posé en haut, avec
 * sa date, passe ici, et c'était pourtant le défaut principal du 08-21 ; une
 * rature MANQUANTE ; la VÉRACITÉ d'un « relu contre le code » ; et la
 * contradiction entre deux sections éloignées.
 *
 * Une date FUTURE écrite dans le corps (une échéance) fait rougir ce test à
 * tort : écrire l'échéance en clair (« septembre 2026 ») plutôt qu'en ISO. La
 * liste est volontairement COURTE : un scan de tout `docs/` rougirait sur 25
 * fichiers sur 40 et se ferait désactiver — ce que `principes-tests.md` §5
 * range dans les mauvais réflexes.
 */
const DOCS_DE_PASSATION = [
  "docs/dette-technique.md",
  "docs/roadmap.md",
  "docs/principes-tests.md",
] as const;

const DATE_ISO = /20\d\d-\d\d-\d\d/g;

/** L'en-tête : tout ce qui précède le premier titre de niveau 2, 40 lignes maxi. */
function entete(lignes: readonly string[]): string {
  const premierTitre = lignes.findIndex((l) => l.startsWith("## "));
  const fin = premierTitre === -1 ? lignes.length : premierTitre;
  return lignes.slice(0, Math.min(fin, 40)).join("\n");
}

function datesTriees(texte: string): string[] {
  // Format ISO : l'ordre lexicographique EST l'ordre chronologique.
  return [...texte.matchAll(DATE_ISO)].map((m) => m[0]).sort();
}

describe("docs de passation : l'en-tête est au moins aussi frais que le corps", () => {
  for (const chemin of DOCS_DE_PASSATION) {
    it(`${chemin} — la date du haut couvre la date la plus récente du corps`, () => {
      const texte = readFileSync(resolve(process.cwd(), chemin), "utf8");
      const lignes = texte.split("\n");

      const plusRecente = datesTriees(texte).at(-1);
      if (plusRecente === undefined) return; // doc sans date : rien à tenir

      const dateEntete = datesTriees(entete(lignes)).at(-1);
      if (dateEntete === plusRecente) return;

      const ligne = lignes.findIndex((l) => l.includes(plusRecente)) + 1;
      expect.fail(
        `${chemin} : l'en-tête annonce ${dateEntete ?? "AUCUNE date"}, le corps porte ` +
          `${plusRecente} (ligne ${ligne}). Recaler la ligne du haut — c'est la seule ` +
          `que lit la session suivante (CLAUDE.md §Clore une session). Si ${plusRecente} ` +
          `est une échéance À VENIR, l'écrire en clair (« septembre 2026 ») plutôt qu'en ISO.`,
      );
    });
  }
});
