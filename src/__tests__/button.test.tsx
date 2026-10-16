import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Button from "@/components/Button";

describe("Button", () => {
  it("rend un lien interne par défaut", () => {
    render(<Button href="/tremplin">Découvrir</Button>);
    const link = screen.getByRole("link", { name: /découvrir/i });
    expect(link).toHaveAttribute("href", "/tremplin");
    expect(link).not.toHaveAttribute("target");
  });

  it("rend un lien externe avec target=_blank", () => {
    render(
      <Button href="https://example.com" external>
        Lien externe
      </Button>,
    );
    const link = screen.getByRole("link", { name: /lien externe/i });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("inclut un sr-only pour les liens externes", () => {
    const { container } = render(
      <Button href="https://example.com" external>
        Lien
      </Button>,
    );
    expect(container.querySelector(".sr-only")).toBeInTheDocument();
  });

  it("applique le variant primary par défaut", () => {
    const { container } = render(<Button href="/">OK</Button>);
    const link = container.querySelector("a")!;
    expect(link.className).toContain("bg-magenta");
  });

  it("applique le variant secondary", () => {
    const { container } = render(
      <Button href="/" variant="secondary">
        OK
      </Button>,
    );
    const link = container.querySelector("a")!;
    expect(link.className).toContain("border-cyan");
  });

  it("applique le variant ghost", () => {
    const { container } = render(
      <Button href="/" variant="ghost">
        OK
      </Button>,
    );
    const link = container.querySelector("a")!;
    expect(link.className).toContain("text-cyan");
    expect(link.className).not.toContain("bg-magenta");
  });

  it("applique la taille sm", () => {
    const { container } = render(
      <Button href="/" size="sm">
        OK
      </Button>,
    );
    const link = container.querySelector("a")!;
    expect(link.className).toContain("px-4");
    expect(link.className).toContain("text-sm");
  });

  it("applique la taille lg", () => {
    const { container } = render(
      <Button href="/" size="lg">
        OK
      </Button>,
    );
    const link = container.querySelector("a")!;
    expect(link.className).toContain("px-10");
    expect(link.className).toContain("text-lg");
  });

  it("inclut toujours focus-visible", () => {
    const { container } = render(<Button href="/">OK</Button>);
    const link = container.querySelector("a")!;
    expect(link.className).toContain("focus-visible:outline-none");
    expect(link.className).toContain("focus-visible:ring-2");
  });

  it("accepte une className custom", () => {
    const { container } = render(
      <Button href="/" className="mt-4">
        OK
      </Button>,
    );
    const link = container.querySelector("a")!;
    expect(link.className).toContain("mt-4");
  });

  it("rend un <button> de soumission quand il n'y a pas de href", () => {
    render(
      <Button type="submit">Enregistrer</Button>,
    );
    const btn = screen.getByRole("button", { name: /enregistrer/i });
    expect(btn).toHaveAttribute("type", "submit");
    expect(btn.tagName).toBe("BUTTON");
  });

  it("rend un <button type=button> par défaut sans href", () => {
    render(<Button>Action</Button>);
    expect(screen.getByRole("button", { name: /action/i })).toHaveAttribute(
      "type",
      "button",
    );
  });

  it("transmet l'état disabled au bouton", () => {
    render(
      <Button type="submit" disabled>
        Envoi…
      </Button>,
    );
    expect(screen.getByRole("button", { name: /envoi/i })).toBeDisabled();
  });

  it("applique la variante danger", () => {
    const { container } = render(
      <Button type="submit" variant="danger">
        Supprimer
      </Button>,
    );
    const btn = container.querySelector("button")!;
    expect(btn.className).toContain("border-orange");
  });
  it("rend un lien de téléchargement natif avec `download`", () => {
    // `next/link` naviguerait (et préchargerait) vers un fichier : un
    // téléchargement passe par un <a download> nu.
    render(
      <Button href="/kit/logo.png" download>
        Télécharger le logo
      </Button>,
    );
    const lien = screen.getByRole("link", { name: /télécharger le logo/i });
    expect(lien).toHaveAttribute("href", "/kit/logo.png");
    expect(lien).toHaveAttribute("download");
  });
});
