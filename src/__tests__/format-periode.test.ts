import { describe, it, expect } from "vitest";
import { periodeFr } from "@/lib/format";

/**
 * Lot A (refonte §2.4) : une PÉRIODE s'affiche comme une période — « du 7 au
 * 13 sept. 2026 » — jamais comme la seule date de début (qui faisait croire à
 * un rendez-vous le lundi 7). Fonction pure, partagée par toutes les surfaces.
 */
describe("periodeFr", () => {
  it("sans date de fin : null (l'appelant affiche la date simple)", () => {
    expect(periodeFr("2026-09-07", null)).toBeNull();
    expect(periodeFr(null, null)).toBeNull();
    expect(periodeFr(undefined, undefined)).toBeNull();
  });

  it("même mois : « du 7 au 13 sept. 2026 » (le mois une seule fois)", () => {
    expect(periodeFr("2026-09-07", "2026-09-13")).toBe("du 7 au 13 sept. 2026");
  });

  it("mois différents : « du 30 sept. au 16 oct. 2026 »", () => {
    expect(periodeFr("2026-09-30", "2026-10-16")).toBe("du 30 sept. au 16 oct. 2026");
  });

  it("années différentes : chaque borne porte son année", () => {
    expect(periodeFr("2026-12-20", "2027-01-05")).toBe("du 20 déc. 2026 au 5 janv. 2027");
  });

  it("forme longue (lecteurs d'écran) : mois en toutes lettres", () => {
    expect(periodeFr("2026-09-07", "2026-09-13", { long: true })).toBe(
      "du 7 au 13 septembre 2026",
    );
  });

  it("fin seule : « jusqu'au 13 sept. 2026 »", () => {
    expect(periodeFr(null, "2026-09-13")).toBe("jusqu'au 13 sept. 2026");
  });

  it("date illisible : null (jamais « Invalid Date » à l'écran)", () => {
    expect(periodeFr("n'importe quoi", "2026-09-13")).toBeNull();
    expect(periodeFr("2026-09-07", "n'importe quoi")).toBeNull();
  });
});

/**
 * Borne temporelle partagée (lot A) : `estPasse` est le miroir TS du fragment
 * SQL « COALESCE(date_fin, date) >= aujourd'hui » (mes-ateliers.ts) — le test
 * verrouille la complémentarité des bornes (le jour même = encore à venir).
 */
import { estPasse, finEffective } from "@/lib/tremplin-statut";

describe("finEffective / estPasse", () => {
  it("fin effective : la fin de période, sinon la date, sinon null", () => {
    expect(finEffective({ date: "2026-09-07", dateFin: "2026-09-13" })).toBe("2026-09-13");
    expect(finEffective({ date: "2026-09-15" })).toBe("2026-09-15");
    expect(finEffective({ date: null })).toBeNull();
  });

  it("le jour même, l'activité est ENCORE à venir (borne complémentaire du SQL)", () => {
    const fenetre = { date: "2026-09-07", dateFin: "2026-09-13" };
    expect(estPasse(fenetre, "2026-09-13")).toBe(false); // dernier jour : à venir
    expect(estPasse(fenetre, "2026-09-14")).toBe(true); // lendemain : passé
    expect(estPasse({ date: "2026-09-15" }, "2026-09-15")).toBe(false);
  });

  it("sans aucune date : jamais « passé »", () => {
    expect(estPasse({ date: null }, "2026-09-15")).toBe(false);
  });
});
