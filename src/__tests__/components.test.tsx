import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import TagBadge from "@/components/TagBadge";
import ExternalLink from "@/components/ExternalLink";
import Card from "@/components/Card";
import PageHero from "@/components/PageHero";

describe("TagBadge", () => {
  it("affiche le tag", () => {
    render(<TagBadge tag="Tremplin" />);
    expect(screen.getByText("Tremplin")).toBeInTheDocument();
  });

  it("applique la couleur par défaut pour un tag connu", () => {
    const { container } = render(<TagBadge tag="Tremplin" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain("bg-magenta/20");
    expect(badge.className).toContain("text-magenta");
  });

  it("applique le fallback pour un tag inconnu", () => {
    const { container } = render(<TagBadge tag="Inconnu" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain("bg-navy-lighter");
  });

  it("accepte des couleurs custom qui surchargent les défauts", () => {
    const custom = { Tremplin: "bg-red text-red" };
    const { container } = render(<TagBadge tag="Tremplin" colors={custom} />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain("bg-red");
  });
});

describe("ExternalLink", () => {
  it("rend un lien avec target=_blank et rel sécurisé", () => {
    render(
      <ExternalLink href="https://example.com" className="test-class">
        Lien externe
      </ExternalLink>,
    );
    const link = screen.getByRole("link", { name: /Lien externe/i });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveAttribute("href", "https://example.com");
    expect(link).toHaveClass("test-class");
  });

  it("inclut un texte sr-only pour l'accessibilité", () => {
    const { container } = render(
      <ExternalLink href="https://example.com">Lien</ExternalLink>,
    );
    expect(container.querySelector(".sr-only")).toBeInTheDocument();
  });
});

describe("Card", () => {
  it("rend ses enfants dans un conteneur stylé", () => {
    render(<Card>Contenu</Card>);
    expect(screen.getByText("Contenu")).toBeInTheDocument();
  });

  it("ajoute les classes hover quand hover=true", () => {
    const { container } = render(<Card hover>Contenu</Card>);
    expect((container.firstChild as HTMLElement).className).toContain(
      "hover:border-cyan/30",
    );
  });

  it("n'ajoute pas les classes hover par défaut", () => {
    const { container } = render(<Card>Contenu</Card>);
    expect((container.firstChild as HTMLElement).className).not.toContain(
      "hover:border-cyan/30",
    );
  });

  it("accepte une className custom", () => {
    const { container } = render(<Card className="mt-4">Contenu</Card>);
    expect((container.firstChild as HTMLElement).className).toContain("mt-4");
  });
});

describe("PageHero", () => {
  it("rend le titre et le sous-titre", () => {
    render(
      <PageHero id="test" title="Mon titre" subtitle="Ma description" />,
    );
    expect(
      screen.getByRole("heading", { name: "Mon titre" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Ma description")).toBeInTheDocument();
  });

  it("lie le titre à la section via aria-labelledby", () => {
    const { container } = render(
      <PageHero id="hero-id" title="Titre" />,
    );
    const section = container.querySelector("section");
    expect(section).toHaveAttribute("aria-labelledby", "hero-id");
    expect(container.querySelector("h1")).toHaveAttribute("id", "hero-id");
  });

  it("n'affiche pas de sous-titre s'il n'est pas fourni", () => {
    const { container } = render(<PageHero id="test" title="Titre" />);
    expect(container.querySelectorAll("p")).toHaveLength(0);
  });
});
