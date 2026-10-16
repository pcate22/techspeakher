import { describe, it, expect } from "vitest";
import { filterRegions, filterLangues, REGIONS, LANGUES } from "@/data/domaines";

describe("filterRegions", () => {
  it("ne garde que les régions de la liste blanche, dédoublonnées", () => {
    expect(
      filterRegions(["Occitanie", "Occitanie", "Pays inventé", "Toute la France"]),
    ).toEqual(["Occitanie", "Toute la France"]);
  });
  it("accepte International et À distance", () => {
    expect(filterRegions(["International", "À distance (visio)"])).toEqual([
      "International",
      "À distance (visio)",
    ]);
  });
  it("liste vide si rien de valide", () => {
    expect(filterRegions(["", "n'importe quoi"])).toEqual([]);
  });
  it("toutes les régions déclarées sont acceptées telles quelles", () => {
    expect(filterRegions([...REGIONS])).toEqual([...REGIONS]);
  });
});

describe("filterLangues", () => {
  it("ne garde que les langues connues", () => {
    expect(filterLangues(["Français", "Klingon", "Anglais"])).toEqual([
      "Français",
      "Anglais",
    ]);
  });
  it("toutes les langues déclarées sont acceptées", () => {
    expect(filterLangues([...LANGUES])).toEqual([...LANGUES]);
  });
});
