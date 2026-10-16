import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import NotFound from "@/app/not-found";
import Card from "@/components/Card";
import PageHero from "@/components/PageHero";
import ExternalLink from "@/components/ExternalLink";
import Button from "@/components/Button";
import SearchBar from "@/components/SearchBar";
import ProgressBar from "@/components/ProgressBar";
import AppError from "@/app/error";

afterEach(() => cleanup());

describe("ProgressBar — valeur lisible", () => {
  it("expose aria-valuenow ET aria-valuetext (lecteur d'écran annonce le %)", () => {
    const { container } = render(
      <ProgressBar value={42} label="Profil complété" />,
    );
    const bar = container.querySelector('[role="progressbar"]')!;
    expect(bar).toHaveAttribute("aria-valuenow", "42");
    expect(bar.getAttribute("aria-valuetext")).toMatch(/42/);
  });
});

describe("error.tsx — landmark", () => {
  it("lie le titre à la section via aria-labelledby", () => {
    const { container } = render(<AppError reset={() => {}} />);
    const section = container.querySelector("section")!;
    const labelledby = section.getAttribute("aria-labelledby");
    expect(labelledby).toBeTruthy();
    expect(container.querySelector("h1")!.id).toBe(labelledby);
  });
});

describe("Accessibilité RGAA", () => {
  describe("Liens externes", () => {
    it("ExternalLink a toujours un sr-only pour nouvelle fenêtre", () => {
      const { container } = render(
        <ExternalLink href="https://example.com">Lien</ExternalLink>,
      );
      const srOnly = container.querySelector(".sr-only");
      expect(srOnly).toBeInTheDocument();
      expect(srOnly?.textContent).toContain("nouvel onglet");
    });

    it("Button externe a un sr-only pour nouvelle fenêtre", () => {
      const { container } = render(
        <Button href="https://example.com" external>
          Lien
        </Button>,
      );
      const srOnly = container.querySelector(".sr-only");
      expect(srOnly).toBeInTheDocument();
      expect(srOnly?.textContent).toContain("nouvel onglet");
    });
  });

  describe("Focus visible", () => {
    it("Button inclut focus-visible sur toutes les variantes", () => {
      const variants = ["primary", "secondary", "ghost"] as const;
      for (const variant of variants) {
        const { container } = render(
          <Button href="/" variant={variant}>
            Test
          </Button>,
        );
        const link = container.querySelector("a")!;
        expect(link.className).toContain("focus-visible:");
      }
    });
  });

  describe("Sections et landmarks", () => {
    it("PageHero lie le titre à la section via aria-labelledby", () => {
      const { container } = render(
        <PageHero id="test-id" title="Titre test" />,
      );
      const section = container.querySelector("section");
      expect(section).toHaveAttribute("aria-labelledby", "test-id");
      const h1 = container.querySelector("h1");
      expect(h1).toHaveAttribute("id", "test-id");
    });
  });

  describe("Page 404", () => {
    it("affiche un titre et un lien vers l'accueil", () => {
      render(<NotFound />);
      expect(screen.getByText(/page introuvable/i)).toBeInTheDocument();
      const link = screen.getByRole("link", { name: /retour à l'accueil/i });
      expect(link).toHaveAttribute("href", "/");
    });
  });

  describe("Contrastes et rôles", () => {
    it("Card ne masque pas de contenu avec aria-hidden", () => {
      const { container } = render(<Card>Contenu visible</Card>);
      expect(container.querySelector("[aria-hidden]")).toBeNull();
    });
  });

  describe("SearchBar — combobox", () => {
    it("le bouton d'ouverture a un aria-label", () => {
      render(<SearchBar />);
      expect(screen.getByRole("button", { name: /rechercher/i })).toBeInTheDocument();
    });

    it("l'input a role=combobox, aria-controls et aria-autocomplete", () => {
      render(<SearchBar />);
      fireEvent.click(screen.getByRole("button", { name: /rechercher/i }));
      const input = screen.getByRole("combobox");
      // Id d'INSTANCE (useId) : la barre est montée deux fois dans le header
      // (desktop + mobile), un id statique était dupliqué sur chaque page.
      const cible = input.getAttribute("aria-controls");
      expect(cible).toBeTruthy();
      expect(document.getElementById(cible!)).toHaveAttribute("role", "listbox");
      expect(input).toHaveAttribute("aria-autocomplete", "list");
    });

    it("deux instances (header desktop + mobile) gardent des ids distincts", () => {
      const { container } = render(
        <>
          <SearchBar />
          <SearchBar />
        </>,
      );
      const ids = [...container.querySelectorAll("[id]")].map((el) => el.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("le bouton Esc a un aria-label", () => {
      render(<SearchBar />);
      fireEvent.click(screen.getByRole("button", { name: /rechercher/i }));
      expect(screen.getByRole("button", { name: /fermer/i })).toBeInTheDocument();
    });
  });
});
