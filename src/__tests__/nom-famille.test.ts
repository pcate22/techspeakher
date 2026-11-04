import { describe, it, expect } from "vitest";
import { lireNomFamille, nomEnCapitales, nomFamilleValide, nomPublic } from "@/lib/nom-famille";

describe("nomEnCapitales : heuristique", () => {
  it.each([
    ["Asma Taberkokt", "Asma TABERKOKT"],
    ["Asma TABERKOKT", "Asma TABERKOKT"],
    ["Aurélie Vache", "Aurélie VACHE"],
    ["Céline Chantry-Darmon", "Céline CHANTRY-DARMON"],
    ["Jean-Marie Dupont", "Jean-Marie DUPONT"],
    ["Marie de La Tour", "Marie de LA TOUR"],
    ["Jeanne d'Arc", "Jeanne d'ARC"],
    ["Anna van der Berg", "Anna van der BERG"],
    ["Élodie Léger", "Élodie LÉGER"],
    ["  Asma   Taberkokt ", "Asma TABERKOKT"],
  ])("%s → %s", (nom, attendu) => {
    expect(nomEnCapitales(nom)).toBe(attendu);
  });

  it("une insécable tient deux mots ensemble, comme à l'enregistrement du nom", () => {
    expect(nomEnCapitales("Marie\u00a0Anne Dupont")).toBe("Marie\u00a0Anne DUPONT");
  });

  it("laisse un nom d'un seul mot tel quel", () => {
    expect(nomEnCapitales("Asma")).toBe("Asma");
  });

  it("laisse un nom fait uniquement de particules après le prénom", () => {
    expect(nomEnCapitales("Marie de")).toBe("Marie de");
  });
});

describe("nomEnCapitales : correction saisie", () => {
  it("met en capitales la partie désignée, même sur plusieurs mots", () => {
    expect(nomEnCapitales("Marie Anne Dupont", "Dupont")).toBe("Marie Anne DUPONT");
    expect(nomEnCapitales("Marie Lou Martin Durand", "Martin Durand")).toBe(
      "Marie Lou MARTIN DURAND",
    );
  });

  it("garde les particules en tête du nom saisi en minuscules", () => {
    expect(nomEnCapitales("Marie Anne de La Tour", "de La Tour")).toBe("Marie Anne de LA TOUR");
  });

  it("ignore une correction qui ne termine pas le nom (repli sur l'heuristique)", () => {
    expect(nomEnCapitales("Asma Taberkokt", "Dupont")).toBe("Asma TABERKOKT");
    expect(nomEnCapitales("Asma Taberkokt", "berkokt")).toBe("Asma TABERKOKT");
  });

  it("ignore une correction vide", () => {
    expect(nomEnCapitales("Asma Taberkokt", "  ")).toBe("Asma TABERKOKT");
  });
});

describe("nomFamilleValide", () => {
  it("accepte des mots entiers qui terminent le nom, sans tenir compte de la casse", () => {
    expect(nomFamilleValide("Marie Anne Dupont", "dupont")).toBe(true);
    expect(nomFamilleValide("Marie Anne Dupont", "Anne Dupont")).toBe(true);
  });

  it("refuse un morceau de mot, le nom entier ou un texte absent", () => {
    expect(nomFamilleValide("Marie Anne Dupont", "pont")).toBe(false);
    expect(nomFamilleValide("Marie Anne Dupont", "Marie Anne Dupont")).toBe(false);
    expect(nomFamilleValide("Marie Anne Dupont", "Martin")).toBe(false);
  });
});

describe("nomPublic", () => {
  it("rend null pour un nom absent ou blanc, le nom mis en forme sinon", () => {
    expect(nomPublic(null)).toBeNull();
    expect(nomPublic("  ")).toBeNull();
    expect(nomPublic("Asma Taberkokt")).toBe("Asma TABERKOKT");
  });
});

describe("lireNomFamille : la saisie du formulaire", () => {
  it("vide → null (la coupe devinée reprend)", () => {
    expect(lireNomFamille("Marie Anne Dupont", "  ")).toEqual({ ok: true, valeur: null });
  });

  it("garde les mots tels que saisis dans le nom, espaces repliés", () => {
    expect(lireNomFamille("Marie Anne Dupont", " anne  dupont ")).toEqual({
      ok: true,
      valeur: "Anne Dupont",
    });
  });

  it("refuse ce qui ne termine pas le nom", () => {
    expect(lireNomFamille("Marie Anne Dupont", "Martin").ok).toBe(false);
  });
});
