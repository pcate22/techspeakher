import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import TalksManager from "@/app/mon-espace/TalksManager";
import TalksActions from "@/app/mon-espace/TalksActions";
import type { Talk } from "@/lib/talks";

afterEach(cleanup);

const talk: Talk = {
  id: 5,
  profileId: 2,
  titre: "L'IA à l'épreuve du monde physique",
  type: "Conférence",
  description: null,
  occurrences: [],
};

/**
 * La carte « liste de mes talks ». Les ACTIONS (ajouter, importer) vivent dans
 * l'en-tête de la page — UNE seule porte d'entrée (règle d'or : une page, un
 * CTA principal). La carte ne les répète jamais : les doublons de boutons
 * (signalés sur mobile le 15/08) venaient d'ici.
 *
 * Exception : la fiche VIDE. L'en-tête s'efface et c'est la carte qui accueille
 * avec les deux portes — au moment où on arrive, elles sont l'essentiel.
 */
describe("TalksManager (liste verticale)", () => {
  it("liste les talks ; chaque talk est un lien vers son édition", () => {
    render(<TalksManager talks={[talk]} />);
    const lien = screen.getByRole("link", {
      name: /l'ia à l'épreuve du monde physique/i,
    });
    expect(lien).toHaveAttribute("href", "/mon-espace/talks/5");
  });

  it("avec des talks : AUCUN bouton dans la carte (les actions vivent dans l'en-tête de page)", () => {
    render(<TalksManager talks={[talk]} />);
    expect(screen.queryByRole("link", { name: /ajouter un talk/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /importer mes talks/i })).toBeNull();
  });

  it("fiche vide : la carte accueille avec les DEUX portes (ajout + import)", () => {
    render(<TalksManager talks={[]} />);
    expect(screen.getByText(/aucun talk pour l'instant/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /ajouter un talk/i }),
    ).toHaveAttribute("href", "/mon-espace/talks/nouveau");
    expect(
      screen.getByRole("link", { name: /importer mes talks/i }),
    ).toHaveAttribute("href", "/mon-espace/talks/importer");
  });
});

/** LA paire d'actions, définie une seule fois (l'en-tête et l'accueil de la
 *  carte rendent le même composant) : les cibles se pinnent ICI, une fois. */
describe("TalksActions (la paire ajout + import)", () => {
  it("ajout (principal) + import (secondaire) vers les pages dédiées", () => {
    render(<TalksActions />);
    expect(
      screen.getByRole("link", { name: /ajouter un talk/i }),
    ).toHaveAttribute("href", "/mon-espace/talks/nouveau");
    expect(
      screen.getByRole("link", { name: /importer mes talks/i }),
    ).toHaveAttribute("href", "/mon-espace/talks/importer");
  });
});
