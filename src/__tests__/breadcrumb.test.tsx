import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import Breadcrumb from "@/components/Breadcrumb";

afterEach(cleanup);

describe("Breadcrumb (fil d'Ariane)", () => {
  it("a une nav étiquetée et des liens cliquables", () => {
    render(
      <Breadcrumb
        items={[
          { label: "Accueil", href: "/" },
          { label: "Speakeuses", href: "/speakeuses" },
          { label: "Cateline Puccetti" },
        ]}
      />,
    );
    expect(
      screen.getByRole("navigation", { name: /fil d'ariane/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /accueil/i })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: /speakeuses/i })).toHaveAttribute(
      "href",
      "/speakeuses",
    );
  });

  it("marque le dernier élément comme page courante (non cliquable)", () => {
    render(
      <Breadcrumb
        items={[{ label: "Accueil", href: "/" }, { label: "Mon espace" }]}
      />,
    );
    const current = screen.getByText("Mon espace");
    expect(current).toHaveAttribute("aria-current", "page");
    expect(
      screen.queryByRole("link", { name: /mon espace/i }),
    ).toBeNull();
  });

  it("fil long : ellipsis visuel (…) décoratif, mais chemin COMPLET gardé dans le DOM", () => {
    render(
      <Breadcrumb
        items={[
          { label: "Accueil", href: "/" },
          { label: "Espace organisatrices", href: "/admin" },
          { label: "Tremplins", href: "/admin/tremplins" },
          { label: "Tremplin 2026", href: "/admin/tremplins/1" },
          { label: "Ateliers" },
        ]}
      />,
    );
    // Ellipsis présent et purement décoratif (les lecteurs d'écran lisent le
    // fil complet via les <li> repliés, non retirés de l'arbre a11y).
    const ellipsis = screen.getByText("…");
    expect(ellipsis.closest("[aria-hidden='true']")).not.toBeNull();
    // Le fil complet reste dans le DOM (a11y + SEO) : tous les ancêtres présents.
    expect(screen.getByRole("link", { name: /accueil/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /espace orga/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /tremplins/i })).toBeInTheDocument();
    expect(screen.getByText("Ateliers")).toHaveAttribute("aria-current", "page");
  });

  it("garde TROIS niveaux visibles sur mobile : seuls les ancêtres au-delà sont repliés", () => {
    render(
      <Breadcrumb
        items={[
          { label: "Accueil", href: "/" },
          { label: "Espace organisatrices", href: "/admin" },
          { label: "Tremplins", href: "/admin/tremplins" },
          { label: "Tremplin 2026", href: "/admin/tremplins/1" },
          { label: "Ateliers" },
        ]}
      />,
    );
    // Repliés (sr-only) : Accueil et Espace orga. Visibles : les 3 derniers.
    const cacheAccueil = screen.getByRole("link", { name: /accueil/i }).closest("li");
    const cacheOrga = screen.getByRole("link", { name: /espace orga/i }).closest("li");
    const visibleTremplins = screen.getByRole("link", { name: /tremplins/i }).closest("li");
    expect(cacheAccueil?.className).toContain("sr-only");
    expect(cacheOrga?.className).toContain("sr-only");
    expect(visibleTremplins?.className).not.toContain("sr-only");
  });

  // Un fil nommé d'après une donnée (titre de talk, nom d'atelier) peut être
  // long : en `nowrap` sur toute la ligne, il sortait de l'écran et le fil
  // partait en défilement horizontal — la page courante se lisait par bouts et
  // les ancêtres cliquables pouvaient sortir du champ.
  describe("page courante longue (titre de talk, nom d'atelier)", () => {
    const TITRE = "Votre IA s'en sort moins bien que vos utilisateurs aveugles";

    function renderLong() {
      return render(
        <Breadcrumb
          items={[
            { label: "Mon espace", href: "/mon-espace" },
            { label: "Mes talks", href: "/mon-espace/talks" },
            { label: TITRE },
          ]}
        />,
      );
    }

    it("la page courante se coupe proprement (ellipsis CSS) au lieu de sortir de l'écran", () => {
      renderLong();
      const courante = screen.getByText(TITRE);
      expect(courante.className).toContain("truncate");
      // Un élément flex ne se coupe que s'il peut passer sous sa largeur de
      // contenu : sans `min-w-0`, `truncate` reste sans effet.
      expect(courante.closest("li")?.className).toContain("min-w-0");
    });

    it("le libellé reste ENTIER dans le DOM (a11y, SEO) : la coupe est visuelle", () => {
      renderLong();
      expect(screen.getByText(TITRE)).toHaveAttribute("aria-current", "page");
    });

    it("les ancêtres gardent leur libellé complet (jamais coupés, ce sont les cibles)", () => {
      renderLong();
      for (const nom of [/mon espace/i, /mes talks/i]) {
        const lien = screen.getByRole("link", { name: nom });
        expect(lien.className).not.toContain("truncate");
        expect(lien.closest("li")?.className).toContain("shrink-0");
      }
    });

    // La coupe suffit dans tous les cas réels (les ancêtres sont courts). Reste
    // le cas pathologique d'ancêtres qui débordent à eux seuls : le défilement
    // horizontal est gardé EN SECOURS, pour qu'un maillon cliquable ne soit
    // jamais hors d'atteinte. Il n'apparaît plus dans le cas courant, puisque la
    // page courante cède la place.
    it("garde le défilement en secours si les ancêtres seuls débordent", () => {
      renderLong();
      const nav = screen.getByRole("navigation", { name: /fil d'ariane/i });
      expect(nav.className).toContain("overflow-x-auto");
    });
  });

  it("fil court (≤ 3) : pas d'ellipsis", () => {
    render(
      <Breadcrumb
        items={[
          { label: "Accueil", href: "/" },
          { label: "Espace organisatrices", href: "/admin" },
          { label: "Speakeuses" },
        ]}
      />,
    );
    expect(screen.queryByText("…")).toBeNull();
  });
});
