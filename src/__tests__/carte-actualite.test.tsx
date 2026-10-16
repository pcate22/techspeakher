import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import CarteActualite from "@/components/CarteActualite";
import type { CarteActu } from "@/lib/carte-actu";

afterEach(cleanup);

/**
 * Vignette de la carte (lot 6) : la photo déposée dans l'éditeur devait rester
 * invisible sur les listes (accueil, `/actualites`, public et orga) alors
 * qu'elle transitait déjà pour le SEO — corrigé ici.
 */
function carte(over: Partial<CarteActu> = {}): CarteActu {
  return {
    slug: "un-article",
    titre: "Un article",
    chapo: "Accroche.",
    date: "1 juin 2026",
    dateISO: "2026-06-01",
    categorie: "Communauté",
    tag: "Passé",
    statut: "publie",
    editHref: null,
    href: "/articles/un-article",
    externe: false,
    hrefLabel: "Lire la suite",
    hrefContexte: "de « Un article »",
    imageUrl: null,
    imageAlt: null,
    ...over,
  };
}

describe("CarteActualite — vignette", () => {
  it("affiche la photo quand la carte en a une", () => {
    const { container } = render(
      <CarteActualite carte={carte({ imageUrl: "https://x.example/photo.png", imageAlt: "Le jury du Tremplin" })} />,
    );
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", "https://x.example/photo.png");
    expect(img).toHaveAttribute("alt", "Le jury du Tremplin");
  });

  it("ne montre aucune image quand la carte n'en a pas", () => {
    const { container } = render(<CarteActualite carte={carte()} />);
    expect(container.querySelector("img")).toBeNull();
  });

  it("montre la vignette ENTIÈRE, dans un cadre de hauteur réservée", () => {
    // Deux exigences à la fois : nos visuels sont des cartes à lire (un
    // recadrage les décapite, retour de Cateline) ET la liste ne doit pas
    // sursauter à l'arrivée des images. D'où le cadre fixe + `object-contain`.
    const { container } = render(
      <CarteActualite carte={carte({ imageUrl: "https://x.example/photo.png" })} />,
    );
    const img = container.querySelector("img")!;
    expect(img.className).toContain("object-contain");
    expect(img.className).not.toContain("object-cover");
    expect(img.parentElement!.className).toMatch(/aspect-/);
  });
});
