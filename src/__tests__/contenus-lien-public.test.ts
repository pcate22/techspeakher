import { describe, it, expect } from "vitest";
import { lienPublicContenu } from "@/lib/contenu-lien-public";

/**
 * URL publique d'un contenu (source unique, partagée par la page d'édition et
 * l'éditeur pour proposer « Voir » après enregistrement). Un brouillon n'a pas
 * de page publique. Une publication avec corps a sa page /articles ; sans corps,
 * c'est une annonce qui vit sur /actualites ; une page a son slug racine.
 */
describe("lienPublicContenu", () => {
  it("article publié (avec corps) → sa page /articles/slug", () => {
    expect(
      lienPublicContenu({ type: "publication", corps: "## Titre", slug: "mon-article", statut: "publie" }),
    ).toBe("/articles/mon-article");
  });

  it("publication publiée sans corps (annonce) → /actualites", () => {
    expect(
      lienPublicContenu({ type: "publication", corps: "   ", slug: "annonce", statut: "publie" }),
    ).toBe("/actualites");
  });

  it("page publiée → /slug", () => {
    expect(
      lienPublicContenu({ type: "page", corps: "Texte", slug: "a-propos", statut: "publie" }),
    ).toBe("/a-propos");
  });

  it("brouillon → null (aucune page publique)", () => {
    expect(
      lienPublicContenu({ type: "publication", corps: "## Titre", slug: "x", statut: "brouillon" }),
    ).toBeNull();
  });
});
