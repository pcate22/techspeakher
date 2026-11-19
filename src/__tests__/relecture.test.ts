import { describe, it, expect } from "vitest";
import { doitEtreRelue } from "@/lib/relecture";
import { raisonBlocageAnnuaire, type SpeakerProfile } from "@/lib/profiles";

/**
 * Publication express : un nom repris tel quel du compte OAuth publie tout de
 * suite ; un nom écrit à la main passe par la relecture d'une orga.
 */
describe("doitEtreRelue", () => {
  it("nom identique au compte → publication directe", () => {
    expect(doitEtreRelue("Léa Martin", "Léa Martin")).toBe(false);
  });
  it("les blancs autour ne comptent pas", () => {
    expect(doitEtreRelue(" Léa Martin ", "Léa Martin")).toBe(false);
  });
  it("nom modifié → relecture", () => {
    expect(doitEtreRelue("Léa M.", "Léa Martin")).toBe(true);
  });
  it("compte sans nom → relecture", () => {
    expect(doitEtreRelue("Léa", null)).toBe(true);
  });
});

describe("raisonBlocageAnnuaire : thèmes", () => {
  it("une fiche nommée sans thème bloque sur « themes », avant le contact", () => {
    const p = {
      name: "Léa Martin",
      sujets: [],
      linkedin: null,
      contactEmailOk: false,
      isWoman: false,
    } as unknown as SpeakerProfile;
    expect(raisonBlocageAnnuaire(p)).toBe("themes");
  });
});
