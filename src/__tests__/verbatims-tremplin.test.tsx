import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
// La page dérive désormais son édition mise en avant de la base : ici on la
// prive de base (rejet) — elle se replie sur l'éditorial, ce que ces bancs
// jugent (l'origine et les verbatims sont éditoriaux, indépendants du repli).
vi.mock("@/lib/tremplin-editions", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/tremplin-editions")>();
  return {
    ...actual,
    listEditionsPubliques: () => Promise.reject(new Error("sans base")),
  };
});

import TremplinConcept from "@/app/tremplin/page";
import { verbatims } from "@/data/verbatims";

/**
 * Les verbatims sur la page concept du Tremplin (`/tremplin`, la vitrine du
 * programme — pas la page d'une édition).
 *
 * Placement tenu ici : juste après le teaser de la première édition. La page
 * promet un jury bienveillant et un retour pour chacune ; ce sont les voix de
 * cette édition qui le prouvent, et elles arrivent quand le lecteur vient
 * d'apprendre qu'elle a eu lieu.
 *
 * Le bloc ne rejoue PAS la home : c'est le même composant et la même donnée,
 * seul l'habillage de section change (kicker + titre du gabarit `/tremplin`).
 */

afterEach(cleanup);

describe("/tremplin — les verbatims", () => {
  it("publie les paroles recueillies, attribuées", async () => {
    render(await TremplinConcept());
    const bloc = screen.getByRole("region", { name: /ce qu'elles en disent/i });
    for (const v of verbatims) {
      const attendue = v.citation.replace(/\u00A0/g, " ");
      expect(within(bloc).getByText(new RegExp(escapeRegExp(attendue)))).toBeInTheDocument();
      expect(within(bloc).getByText(v.auteur)).toBeInTheDocument();
    }
  });

  it("vient après le teaser de l'édition, avant « Pour qui, et pourquoi »", async () => {
    const { container } = render(await TremplinConcept());
    const sections = Array.from(container.querySelectorAll("section"));
    const rang = (nom: RegExp) =>
      sections.findIndex((s) => nom.test(s.querySelector("h2")?.textContent ?? ""));
    const edition = rang(/DevFest Toulouse 2026/i);
    const paroles = rang(/ce qu'elles en disent/i);
    const pourQui = rang(/pour qui, et/i);
    expect(edition).toBeGreaterThanOrEqual(0);
    expect(paroles).toBe(edition + 1);
    expect(paroles).toBeLessThan(pourQui);
  });

  it("reste une preuve, pas une nouvelle porte de sortie", async () => {
    // La page a déjà ses CTA (l'édition, nous contacter) : le bloc de paroles
    // n'ajoute aucun lien, seulement les commandes du défilement.
    render(await TremplinConcept());
    const bloc = screen.getByRole("region", { name: /ce qu'elles en disent/i });
    expect(within(bloc).queryAllByRole("link")).toHaveLength(0);
    for (const bouton of within(bloc).getAllByRole("button")) {
      expect(bouton).toHaveAccessibleName(/verbatim/i);
    }
  });
});

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
