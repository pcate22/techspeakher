import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import LiveStatus from "@/components/LiveStatus";
import FilterGroup from "@/components/FilterGroup";
import FilterChip from "@/components/FilterChip";

afterEach(cleanup);

/**
 * Les deux coquilles ARIA des écrans qui filtrent. Elles existent pour qu'un
 * nouvel écran ne puisse pas oublier le `role`, l'intitulé ou l'`aria-live` :
 * c'est donc bien le contrat ARIA qu'on verrouille ici, pas l'apparence.
 */
describe("LiveStatus — région vivante d'un écran qui filtre", () => {
  it("annonce poliment, sans rien montrer à l'écran", () => {
    render(<LiveStatus>3 fiches au statut Publié</LiveStatus>);
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveClass("sr-only");
    expect(region).toHaveTextContent("3 fiches au statut Publié");
  });

  it("accepte un résumé composé de plusieurs morceaux", () => {
    // Chaque écran compose son résumé sur SES dimensions : la coquille se
    // partage, le texte non.
    render(
      <LiveStatus>
        {2} actualités{" au statut Brouillon"}
      </LiveStatus>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("2 actualités au statut Brouillon");
  });
});

describe("FilterGroup — groupe de filtres nommé", () => {
  it("porte le rôle de groupe et son intitulé", () => {
    render(
      <FilterGroup label="Filtrer par catégorie">
        <FilterChip active onClick={() => {}} aria-pressed>
          Tremplin
        </FilterChip>
      </FilterGroup>,
    );
    expect(screen.getByRole("group", { name: "Filtrer par catégorie" })).toBeInTheDocument();
  });

  it("n'est jamais un tablist (le motif promettrait un clavier absent)", () => {
    render(
      <FilterGroup label="Filtrer par statut">
        <FilterChip active={false} onClick={() => {}} aria-pressed={false}>
          Publié
        </FilterChip>
      </FilterGroup>,
    );
    expect(screen.queryAllByRole("tablist")).toHaveLength(0);
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
    // La sélection reste aux boutons, pas au groupe.
    expect(screen.getByRole("button", { name: "Publié" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("laisse l'appelant poser sa mise en page", () => {
    render(
      <FilterGroup label="Filtrer par phase" className="flex flex-wrap gap-2">
        <span />
      </FilterGroup>,
    );
    expect(screen.getByRole("group", { name: "Filtrer par phase" })).toHaveClass(
      "flex",
      "flex-wrap",
      "gap-2",
    );
  });
});
