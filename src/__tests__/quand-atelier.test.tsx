import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import QuandAtelier from "@/components/QuandAtelier";

afterEach(cleanup);

/** Lot A : le « quand » partagé — période affichée comme période, date simple
 * sinon, avec la forme longue pour les lecteurs d'écran (motif DateFr). */
describe("QuandAtelier", () => {
  it("période : « du 7 au 13 sept. 2026 » visible, mois en toutes lettres en sr-only", () => {
    const { container } = render(<QuandAtelier date="2026-09-07" dateFin="2026-09-13" />);
    expect(screen.getByText("du 7 au 13 sept. 2026")).toBeInTheDocument();
    // Visible masqué aux lecteurs d'écran, doublé d'une forme longue sr-only.
    expect(screen.getByText("du 7 au 13 sept. 2026")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector(".sr-only")?.textContent).toBe("du 7 au 13 septembre 2026");
  });

  it("date unique : rendu DateFr (balise <time>)", () => {
    const { container } = render(<QuandAtelier date="2026-09-15" weekday />);
    const time = container.querySelector("time");
    expect(time).toHaveAttribute("dateTime", "2026-09-15");
  });

  it("rien : null (aucun texte fantôme)", () => {
    const { container } = render(<QuandAtelier date={null} />);
    expect(container.textContent).toBe("");
  });
});
