import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import CarteFil from "@/components/CarteFil";
import type { CarteFil as Carte } from "@/lib/fil-cartes";

afterEach(cleanup);

/**
 * Le visuel d'une actualité sur sa carte du fil (retour de Cateline : la photo
 * s'affichait sur l'article et sur `/actualites`, mais le fil restait en texte
 * seul). Il illustre le fait, il ne le nomme pas : la carte ENTIÈRE reste le
 * lien, et son nom accessible ne change pas.
 */
function carte(over: Partial<Carte> = {}): Carte {
  return {
    cle: "asso-40",
    type: "asso",
    date: "2026-03-23",
    nom: "Tech Speak'Her",
    image: null,
    fait: null,
    titre: "Interview de Rachel Dubois",
    detail: "Notre première interview Behind the Scenes.",
    href: "/articles/interview-de-rachel-dubois",
    hrefLabel: "Lire l'article",
    externe: false,
    id: 40,
    proprioProfileId: null,
    proprioUserId: null,
    visuelUrl: null,
    ...over,
  };
}

describe("CarteFil — visuel de l'actualité", () => {
  it("affiche le visuel quand l'actualité en a un", () => {
    const { container } = render(
      <CarteFil
        carte={carte({ visuelUrl: "https://x.example/visuel.png" })}
        aujourdhui="2026-03-24"
      />,
    );
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", "https://x.example/visuel.png");
    // Entier (nos visuels sont des cartes à lire), dans un cadre de hauteur
    // réservée : un visuel portrait ne doit ni être recadré ni manger l'écran
    // et repousser les cartes suivantes.
    expect(img!.className).toContain("object-contain");
    expect(img!.className).not.toContain("object-cover");
    expect(img!.parentElement!.className).toMatch(/aspect-/);
  });

  it("reste en texte seul quand l'actualité n'a pas de visuel", () => {
    const { container } = render(<CarteFil carte={carte()} aujourdhui="2026-03-24" />);
    expect(container.querySelector("img")).toBeNull();
  });

  it("le visuel illustre sans nommer : le nom du lien reste inchangé", () => {
    // Toute la carte est UN lien. Le visuel est décoratif (RGAA 1.2), comme
    // l'avatar : sans ça son alt s'ajouterait au nom du lien, déjà complet.
    const { container } = render(
      <CarteFil
        carte={carte({ visuelUrl: "https://x.example/visuel.png" })}
        aujourdhui="2026-03-24"
      />,
    );
    const img = container.querySelector("img")!;
    expect(img).toHaveAttribute("alt", "");
    expect(img).toHaveAttribute("aria-hidden", "true");

    const lien = screen.getByRole("link");
    expect(lien).toHaveAttribute("href", "/articles/interview-de-rachel-dubois");
    expect(lien).toHaveTextContent("Lire l'article");
  });
});
