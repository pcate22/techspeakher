import { describe, it, expect } from "vitest";
import { plierConfirmation } from "@/lib/confirmation";

/**
 * Contrat PARTAGÉ client/serveur du type-to-confirm (palier 3, §10). C'est le
 * seul point où une dérive casserait les deux côtés à la fois : le bouton se
 * déverrouillerait sans que le serveur accepte, ou l'inverse. D'où des
 * assertions directes plutôt qu'une couverture seulement indirecte.
 *
 * Ce qu'on accepte : tout ce qu'une personne peut RAISONNABLEMENT taper en
 * regardant la valeur affichée. Le but est de faire REGARDER ce qu'on
 * supprime, jamais de piéger la saisie.
 */
describe("plierConfirmation", () => {
  const equivalents: [string, string, string][] = [
    ["casse", "Tremplin 2026", "tremplin 2026"],
    ["accents", "L'édition d'Été", "l'edition d'ete"],
    ["apostrophe courbe (moissonneur CFP, clavier iPhone)", "L’art du pitch", "L'art du pitch"],
    ["points de suspension", "Et après…", "Et après..."],
    ["guillemets typographiques", "Le « vrai » sujet", 'Le "vrai" sujet'],
    ["tiret demi-cadratin", "Coder – vite", "Coder - vite"],
    ["espaces multiples (HTML les fractionne à l'affichage)", "Coder  proprement", "Coder proprement"],
    ["espace insécable, invisible et intapable", "Coder vite", "Coder vite"],
    ["espaces de bord", "  Camille Roux  ", "Camille Roux"],
  ];

  it.each(equivalents)("%s", (_cas, stocke, tape) => {
    expect(plierConfirmation(stocke)).toBe(plierConfirmation(tape));
  });

  it("garde la distinction entre deux valeurs réellement différentes", () => {
    expect(plierConfirmation("Tremplin 2026")).not.toBe(plierConfirmation("Tremplin 2025"));
    expect(plierConfirmation("Camille Roux")).not.toBe(plierConfirmation("Camille Roux-Martin"));
  });

  it("une valeur vide ou blanche se replie sur la chaîne vide", () => {
    // Les appelants s'en servent pour repérer l'absence de valeur attendue et
    // décider s'il y a une garde à appliquer.
    expect(plierConfirmation("")).toBe("");
    expect(plierConfirmation("     ")).toBe("");
  });
});
