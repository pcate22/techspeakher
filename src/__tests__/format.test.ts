import { describe, it, expect } from "vitest";
import { formatDateFr, dateCourteFr, uneSeuleLigne } from "@/lib/format";

describe("formatDateFr", () => {
  it("formate une date ISO en jj/mm/aaaa", () => {
    // Midi UTC : le jour est stable quel que soit le fuseau du runner.
    expect(formatDateFr("2026-11-19T12:00:00Z")).toBe("19/11/2026");
  });

  it("null / undefined / vide → null", () => {
    expect(formatDateFr(null)).toBeNull();
    expect(formatDateFr(undefined)).toBeNull();
    expect(formatDateFr("")).toBeNull();
  });

  it("date invalide → null", () => {
    expect(formatDateFr("pas-une-date")).toBeNull();
  });

  it("accepte un timestamp complet", () => {
    expect(formatDateFr("2026-01-05T09:30:00Z")).toBe("05/01/2026");
  });

  it("UTC-safe : une colonne DATE « YYYY-MM-DD » ne décale pas d'un jour", () => {
    // new Date() interprète en UTC minuit ; timeZone:"UTC" garde le bon jour.
    expect(formatDateFr("2026-11-19")).toBe("19/11/2026");
  });

  it("opts permet un format long (jour, mois court, année)", () => {
    expect(
      formatDateFr("2026-11-19", { day: "numeric", month: "short", year: "numeric" }),
    ).toBe("19 nov. 2026");
  });
});

describe("dateCourteFr", () => {
  it("date valide → « jour mois court » sans année", () => {
    expect(dateCourteFr("2026-03-12")).toBe("12 mars");
  });

  it("null / undefined → null", () => {
    expect(dateCourteFr(null)).toBeNull();
    expect(dateCourteFr(undefined)).toBeNull();
  });
});

describe("uneSeuleLigne", () => {
  it("replie retours à la ligne et espaces multiples en espaces simples", () => {
    expect(uneSeuleLigne("Quand le design,\nle produit\net l'accessibilité")).toBe(
      "Quand le design, le produit et l'accessibilité",
    );
    expect(uneSeuleLigne("Head of product\r\n\tdesign")).toBe("Head of product design");
    expect(uneSeuleLigne("  OVH   cloud  ")).toBe("OVH cloud");
  });

  // `\\s` couvre U+00A0 en JavaScript : replier les insécables détruisait la
  // typographie française du projet (espace insécable avant «\u00a0!\u00a0?\u00a0:\u00a0;\u00a0»).
  it("préserve les espaces insécables", () => {
    expect(uneSeuleLigne("Spécialiste IA\u00a0: demain\u00a0?")).toBe(
      "Spécialiste IA\u00a0: demain\u00a0?",
    );
    expect(uneSeuleLigne("Titre\navec\u202fnarrow")).toBe("Titre avec\u202fnarrow");
  });

  it("une chaîne vide ou de blancs seuls devient vide", () => {
    expect(uneSeuleLigne("")).toBe("");
    expect(uneSeuleLigne("  \n\t ")).toBe("");
  });
});

import { dateLongueFr } from "@/lib/format";

describe("dateLongueFr", () => {
  it("dit « 1er » pour le premier du mois (Intl écrit « 1 novembre »)", () => {
    expect(dateLongueFr("2026-11-01T08:00:00Z")).toBe("1er novembre 2026");
    expect(dateLongueFr("2026-11-11T08:00:00Z")).toBe("11 novembre 2026");
    expect(dateLongueFr("2026-11-21")).toBe("21 novembre 2026");
  });
});

import { dateLongueParis } from "@/lib/format";

describe("dateLongueParis — un horodatage lu à l'heure de Paris", () => {
  it("un paiement le 16 octobre à 0 h 30 (Paris) est daté du 16, pas du 15", () => {
    expect(dateLongueParis("2026-10-15T22:30:00Z")).toBe("16 octobre 2026");
  });
  it("garde le « 1er »", () => {
    expect(dateLongueParis("2026-10-31T23:30:00Z")).toBe("1er novembre 2026");
  });
});


import { dateHeureParis, heureParis } from "@/lib/format";

describe("dateHeureParis / heureParis — l'heure d'un horodatage, à Paris", () => {
  it("« 15 octobre 2026 à 23 h 34 », heure d'été de Paris", () => {
    expect(dateHeureParis("2026-10-15T21:34:00Z")).toBe("15 octobre 2026 à 23\u00a0h\u00a034");
  });
  it("garde le « 1er » et l'heure sans zéro devant", () => {
    expect(dateHeureParis("2026-10-31T23:05:00Z")).toBe("1er novembre 2026 à 0\u00a0h\u00a005");
  });
  it("l'heure seule", () => {
    expect(heureParis("2026-10-15T07:09:00Z")).toBe("9\u00a0h\u00a009");
  });
});
