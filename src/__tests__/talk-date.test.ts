import { describe, it, expect } from "vitest";
import {
  buildTalkDate,
  parseTalkDateParts,
  isExactTalkDate,
  formatTalkDate,
  isoToTalkDate,
  formatOccurrenceDateLieu,
  dateLegueeParEdition,
} from "@/lib/talk-date";

/**
 * Ce qu'une édition LÈGUE à une occurrence dont la date est restée imprécise —
 * la règle partagée par la saisie manuelle (resolveOccurrenceLink) et l'import
 * (construirePlan). Le principe : ne jamais affirmer plus que ce qu'on SAIT.
 * Une édition sur PLUSIEURS jours ne connaît pas le jour du talk (il tombe
 * l'un des jours) : elle lègue le mois, jamais un faux jour précis.
 */
describe("dateLegueeParEdition", () => {
  it("édition d'un seul jour (fin absente) : le jour exact est légué", () => {
    expect(dateLegueeParEdition("2025-11-14", null, null)).toBe("2025-11-14");
    expect(dateLegueeParEdition("2025-11-14", null, "2025")).toBe("2025-11-14");
  });

  it("fin égale au début : un seul jour aussi", () => {
    expect(dateLegueeParEdition("2025-11-14", "2025-11-14", "2025")).toBe(
      "2025-11-14",
    );
  });

  it("édition MULTI-JOURS : le mois est légué, jamais un faux jour", () => {
    // Devoxx Belgium, 4 jours : le talk tombe l'UN des jours.
    expect(dateLegueeParEdition("2025-10-06", "2025-10-09", "2025")).toBe("2025-10");
    expect(dateLegueeParEdition("2025-10-06", "2025-10-09", null)).toBe("2025-10");
  });

  it("édition à cheval sur deux mois : seule l'année est sûre", () => {
    expect(dateLegueeParEdition("2025-09-30", "2025-10-02", null)).toBe("2025");
  });

  it("une date déjà EXACTE reste intacte (le talk peut tomber un autre jour)", () => {
    expect(dateLegueeParEdition("2025-10-06", null, "2025-10-08")).toBe(
      "2025-10-08",
    );
  });

  it("le legs ne dégrade jamais la saisie : un mois saisi survit à un legs d'année", () => {
    // Édition à cheval sur deux mois (legs = « 2025 ») mais elle a DIT le mois.
    expect(dateLegueeParEdition("2025-09-30", "2025-10-02", "2025-10")).toBe(
      "2025-10",
    );
  });

  it("le legs ne contredit jamais la saisie : une autre année saisie est gardée", () => {
    expect(dateLegueeParEdition("2025-10-06", null, "2026")).toBe("2026");
  });

  it("édition sans date de début exacte : la saisie repart telle quelle", () => {
    expect(dateLegueeParEdition(null, null, "2025")).toBe("2025");
    expect(dateLegueeParEdition(null, null, null)).toBeNull();
  });
});

describe("buildTalkDate", () => {
  it("compose jour/mois/année → format triable", () => {
    expect(buildTalkDate("2026", "11", "19")).toEqual({
      ok: true,
      value: "2026-11-19",
    });
    expect(buildTalkDate("2026", "11", "")).toEqual({ ok: true, value: "2026-11" });
    expect(buildTalkDate("2026", "", "")).toEqual({ ok: true, value: "2026" });
  });

  it("pad les mois/jours à deux chiffres", () => {
    expect(buildTalkDate("2026", "3", "5")).toEqual({
      ok: true,
      value: "2026-03-05",
    });
  });

  it("exige l'année", () => {
    expect(buildTalkDate("", "11", "").ok).toBe(false);
  });

  it("refuse une année invalide", () => {
    expect(buildTalkDate("abc", "", "").ok).toBe(false);
  });

  it("refuse un jour sans mois", () => {
    expect(buildTalkDate("2026", "", "19").ok).toBe(false);
  });
});

describe("parseTalkDateParts", () => {
  it("redécoupe une date stockée", () => {
    expect(parseTalkDateParts("2026-11-19")).toEqual({
      annee: "2026",
      mois: "11",
      jour: "19",
    });
    expect(parseTalkDateParts("2026-11")).toEqual({
      annee: "2026",
      mois: "11",
      jour: "",
    });
    expect(parseTalkDateParts("2026")).toEqual({ annee: "2026", mois: "", jour: "" });
    expect(parseTalkDateParts(null)).toEqual({ annee: "", mois: "", jour: "" });
  });
});

describe("isExactTalkDate", () => {
  it("vrai seulement si le jour est présent", () => {
    expect(isExactTalkDate("2026-11-19")).toBe(true);
    expect(isExactTalkDate("2026-11")).toBe(false);
    expect(isExactTalkDate("2026")).toBe(false);
    expect(isExactTalkDate(null)).toBe(false);
  });
});

describe("isoToTalkDate", () => {
  it("extrait la date d'un startsAt ISO", () => {
    expect(isoToTalkDate("2026-11-19T10:00:00")).toBe("2026-11-19");
  });
  it("null pour absent ou format inattendu", () => {
    expect(isoToTalkDate(null)).toBeNull();
    expect(isoToTalkDate(undefined)).toBeNull();
    expect(isoToTalkDate("bientôt")).toBeNull();
  });
  it("rejette une date hors bornes (validée via buildTalkDate)", () => {
    expect(isoToTalkDate("0000-13-45T00:00:00")).toBeNull();
  });
});

describe("formatTalkDate", () => {
  it("affiche en français selon la précision", () => {
    expect(formatTalkDate("2026-11-19")).toBe("19 novembre 2026");
    expect(formatTalkDate("2026-11")).toBe("novembre 2026");
    expect(formatTalkDate("2026")).toBe("2026");
    expect(formatTalkDate("")).toBe("");
  });

  it("affiche telle quelle une valeur libre historique", () => {
    expect(formatTalkDate("19 novembre 2026")).toBe("19 novembre 2026");
  });
});

describe("formatOccurrenceDateLieu", () => {
  it("situe l'intervention, la date d'abord (la conf est annoncée au-dessus)", () => {
    expect(
      formatOccurrenceDateLieu({
        ville: "Toulouse",
        pays: "France",
        date: "2026-11-19",
      }),
    ).toBe("19 novembre 2026 · Toulouse · France");
  });

  it("laisse tomber les parties absentes, sans séparateur orphelin", () => {
    expect(formatOccurrenceDateLieu({ ville: null, pays: null, date: "2026" })).toBe(
      "2026",
    );
    expect(
      formatOccurrenceDateLieu({ ville: "en ligne", pays: null, date: null }),
    ).toBe("en ligne");
    expect(formatOccurrenceDateLieu({ ville: null, pays: null, date: null })).toBe("");
  });
});
