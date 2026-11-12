import { describe, it, expect } from "vitest";
import {
  CATEGORIES_THEMES,
  THEMES,
  categorieDuTheme,
  filterSujets,
} from "@/data/domaines";

describe("thèmes en catégories", () => {
  it("compte 7 catégories et 28 thèmes", () => {
    expect(CATEGORIES_THEMES).toHaveLength(7);
    expect(THEMES).toHaveLength(28);
  });

  it("n'a aucun thème en double, toutes catégories confondues", () => {
    expect(new Set(THEMES).size).toBe(THEMES.length);
  });

  it("retrouve la catégorie d'un thème", () => {
    expect(categorieDuTheme("Accessibilité")).toBe("Design");
    expect(categorieDuTheme("Product marketing")).toBe("Produit");
    expect(categorieDuTheme("Autre")).toBeNull();
  });

  it("filtre sur la liste des thèmes", () => {
    expect(filterSujets(["Cloud", "Autre", "x"])).toEqual(["Cloud"]);
  });
});
