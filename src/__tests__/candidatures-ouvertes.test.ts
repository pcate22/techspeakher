import { describe, it, expect } from "vitest";
import { candidaturesOuvertes } from "@/lib/tremplin-statut";

/**
 * Une seule règle décide si une édition recrute : l'accueil s'en sert pour son
 * bouton principal, la page de l'édition pour sa section « Candidater ». Les
 * deux pages lisent la même fonction : le bouton de l'accueil mène toujours à
 * une ancre qui existe.
 */
const fenetre = { inscriptionsDebut: "2026-11-09", inscriptionsFin: "2026-11-30" };

describe("candidaturesOuvertes", () => {
  it.each(["ouvert", "en_cours"])("statut %s, dans la fenêtre : ouvertes", (statut) => {
    expect(candidaturesOuvertes({ ...fenetre, statut }, "2026-11-12")).toBe(true);
  });

  it.each(["preparation", "clos", "archive"])("statut %s, même dans la fenêtre : fermées", (statut) => {
    expect(candidaturesOuvertes({ ...fenetre, statut }, "2026-11-12")).toBe(false);
  });

  it("bornes incluses, hors fenêtre fermées", () => {
    const ed = { ...fenetre, statut: "ouvert" };
    expect(candidaturesOuvertes(ed, "2026-11-09")).toBe(true);
    expect(candidaturesOuvertes(ed, "2026-11-30")).toBe(true);
    expect(candidaturesOuvertes(ed, "2026-11-08")).toBe(false);
    expect(candidaturesOuvertes(ed, "2026-12-01")).toBe(false);
  });

  it("sans fenêtre en base : fermées", () => {
    expect(
      candidaturesOuvertes({ statut: "ouvert", inscriptionsDebut: null, inscriptionsFin: null }, "2026-11-12"),
    ).toBe(false);
  });
});
