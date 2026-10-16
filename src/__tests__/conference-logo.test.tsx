import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// Le déclaratif réel est vide tant qu'aucun logo n'est déposé : on le simule
// pour couvrir les DEUX branches (logo déposé / repli monogramme).
vi.mock("@/data/logos-conferences", () => ({
  DOSSIER_LOGOS: "/conferences",
  LOGOS_CONFERENCES: { "devfest-toulouse": "devfest-toulouse.png" },
  logoConference: (slug: string | null) =>
    slug === "devfest-toulouse" ? "/conferences/devfest-toulouse.png" : null,
}));

const { default: ConferenceLogo } = await import("@/components/ConferenceLogo");

afterEach(cleanup);

describe("ConferenceLogo", () => {
  it("affiche le logo déposé pour la conférence", () => {
    const { container } = render(
      <ConferenceLogo nom="DevFest Toulouse" slug="devfest-toulouse" />,
    );
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", "/conferences/devfest-toulouse.png");
    // Le nom de la conférence est écrit juste à côté : l'image est décorative
    // (RGAA 1.2), sinon les lecteurs d'écran l'annoncent deux fois.
    expect(img).toHaveAttribute("alt", "");
    expect(img).toHaveAttribute("aria-hidden", "true");
  });

  it("retombe sur un monogramme quand aucun logo n'est déposé", () => {
    const { container } = render(<ConferenceLogo nom="Sunny Tech" slug="sunny-tech" />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("ST")).toBeInTheDocument();
    expect(screen.getByText("ST")).toHaveAttribute("aria-hidden", "true");
  });

  it("ignore l'année du libellé figé dans le monogramme", () => {
    render(<ConferenceLogo nom="Sunny Tech 2026" slug="sunny-tech" />);
    expect(screen.getByText("ST")).toBeInTheDocument();
  });

  it("retombe sur un monogramme pour une conférence hors registre (sans slug)", () => {
    render(<ConferenceLogo nom="Meetup interne" slug={null} />);
    expect(screen.getByText("MI")).toBeInTheDocument();
  });
});
