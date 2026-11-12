// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

vi.mock("@/app/mon-espace/actions", () => ({ publierFicheExpressAction: vi.fn() }));

import BienvenueForm from "@/app/mon-espace/bienvenue/BienvenueForm";

describe("BienvenueForm", () => {
  afterEach(cleanup);

  it("Continuer sans nom → message dans l'alerte, relié au champ", () => {
    render(<BienvenueForm nomInitial="" />);
    fireEvent.click(screen.getByRole("button", { name: "Continuer" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Indique ton prénom et ton nom.");
    const champ = screen.getByLabelText(/Comment t'appelles-tu/);
    expect(champ).toHaveAccessibleDescription("Indique ton prénom et ton nom.");
    expect(champ).toHaveAttribute("aria-invalid", "true");
  });

  it("dit qui pourra écrire, au féminin et au masculin", () => {
    render(<BienvenueForm nomInitial="Léa Martin" />);
    expect(
      screen.getByText(
        "Les organisatrices et organisateurs de conférences pourront t'écrire par le site, ton e-mail reste caché.",
      ),
    ).toBeInTheDocument();
  });

  it("le groupe des thèmes est nommé une seule fois, par la légende", () => {
    const { container } = render(<BienvenueForm nomInitial="Léa Martin" />);
    expect(container.querySelector('[role="group"]')).toBeNull();
  });
});
