import { describe, it, expect } from "vitest";
import { parseFrenchDate, allActualites } from "@/data/actualites";

describe("parseFrenchDate", () => {
  it("parse une date complète (jour mois année)", () => {
    const ts = parseFrenchDate("19 novembre 2026");
    const d = new Date(ts);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(10); // novembre = 10
    expect(d.getDate()).toBe(19);
  });

  it("parse toutes les dates existantes sans NaN", () => {
    for (const actu of allActualites) {
      const ts = parseFrenchDate(actu.date);
      expect(ts).not.toBeNaN();
    }
  });

  it("parse une année seule", () => {
    const ts = parseFrenchDate("2025");
    const d = new Date(ts);
    expect(d.getFullYear()).toBe(2025);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(1);
  });

  it("gère les espaces superflus", () => {
    const ts = parseFrenchDate("  12 mars 2026  ");
    expect(ts).not.toBeNaN();
    expect(new Date(ts).getFullYear()).toBe(2026);
  });
});
