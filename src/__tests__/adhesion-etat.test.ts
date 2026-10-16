import { describe, it, expect } from "vitest";
import { DELAI_ADHESION, etatAdhesion } from "@/lib/adhesion";
import { landingAdhesion } from "@/data/adhesion";

/** L'état d'une adhésion, lu par la page « Mon adhésion » et la rangée de Mon profil. */
const MAINTENANT = new Date("2026-10-15T12:00:00Z");

describe("etatAdhesion", () => {
  it.each([
    ["active, échéance lointaine", "active", "2027-10-15T08:00:00Z", "active"],
    ["active, échéance dans 30 jours ou moins", "active", "2026-11-10T08:00:00Z", "a_renouveler"],
    ["active, échéance passée", "active", "2026-09-01T08:00:00Z", "echue"],
    ["close avant son terme (remboursée)", "expired", "2027-09-01T08:00:00Z", "close"],
    ["expirée, échéance passée", "expired", "2026-09-01T08:00:00Z", "echue"],
  ] as const)("%s", (_l, status, expiresAt, attendu) => {
    expect(etatAdhesion({ status, expiresAt }, MAINTENANT)).toBe(attendu);
  });
});

describe("DELAI_ADHESION", () => {
  it("/adherer dit le même délai, au vouvoiement", () => {
    expect(landingAdhesion.adresseCompte).toContain(DELAI_ADHESION);
  });

  it("est la formulation validée par Cateline le 2026-10-15, telle quelle", () => {
    expect(DELAI_ADHESION).toBe("dans quelques minutes, et au plus tard le lendemain");
  });
});
