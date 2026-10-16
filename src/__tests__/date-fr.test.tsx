import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import DateFr from "@/components/DateFr";

afterEach(cleanup);

/**
 * Affichage d'une date en lecture seule : abrégé À L'ŒIL (« ven. 20 nov. 2026 »,
 * cohérent avec le champ natif iOS et plus court), mais forme COMPLÈTE pour les
 * lecteurs d'écran (« vendredi 20 novembre 2026 ») — les abréviations « ven. »
 * / « nov. » étant lues de façon peu fiable par les synthèses vocales. Balise
 * `<time>` pour la sémantique machine.
 */
describe("DateFr", () => {
  it("avec jour : abrégé visible, forme complète pour lecteur d'écran, <time> daté", () => {
    render(<DateFr iso="2026-11-20" weekday />);
    const t = screen.getByText("ven. 20 nov. 2026");
    expect(t).toHaveAttribute("aria-hidden", "true");
    // La forme longue existe pour l'audio (sr-only, mais dans le DOM).
    expect(screen.getByText("vendredi 20 novembre 2026")).toBeInTheDocument();
    const time = t.closest("time");
    expect(time).not.toBeNull();
    expect(time).toHaveAttribute("datetime", "2026-11-20");
  });

  it("sans jour : « 20 nov. 2026 » visible, « 20 novembre 2026 » pour l'audio", () => {
    render(<DateFr iso="2026-11-20" />);
    expect(screen.getByText("20 nov. 2026")).toBeInTheDocument();
    expect(screen.getByText("20 novembre 2026")).toBeInTheDocument();
  });

  it("date absente ou invalide : ne rend rien", () => {
    const { container: c1 } = render(<DateFr iso={null} weekday />);
    expect(c1).toBeEmptyDOMElement();
    const { container: c2 } = render(<DateFr iso="pas-une-date" />);
    expect(c2).toBeEmptyDOMElement();
  });
});
