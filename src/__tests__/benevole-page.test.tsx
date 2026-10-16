import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";

import Benevole from "@/app/benevole/page";
import { missionsBenevoles } from "@/data/benevole";

/**
 * /BENEVOLE (2026-10-15) : le site cherchait des coachs et un jury sans page
 * pour les accueillir. Une page, un rôle (proposer son temps), une action :
 * nous écrire.
 */

afterEach(cleanup);

describe("/benevole", () => {
  it("le titre principal dit à qui la page parle", () => {
    render(<Benevole />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/bénévole/i);
  });

  it("chaque mission a son titre", () => {
    render(<Benevole />);
    const missions = screen.getByRole("region", { name: /Ce que vous pouvez faire/ });
    for (const m of missionsBenevoles) {
      expect(within(missions).getByRole("heading", { name: m.titre })).toBeInTheDocument();
    }
  });

  it("une seule action, répétée : nous écrire", () => {
    render(<Benevole />);
    const ctas = screen.getAllByRole("link", { name: /Proposer mon aide/ });
    expect(ctas.length).toBeGreaterThanOrEqual(2);
    for (const l of ctas) expect(l).toHaveAttribute("href", "/contact");
  });

  it("dit que l'adhésion est gratuite pour les bénévoles d'un programme", () => {
    render(<Benevole />);
    expect(document.body.textContent).toMatch(/adhésion est gratuite/i);
  });
});
