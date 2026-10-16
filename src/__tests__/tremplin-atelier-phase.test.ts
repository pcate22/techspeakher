import { describe, it, expect } from "vitest";
import { phaseDateCoherente, isPhaseAtelier } from "@/lib/tremplin-ateliers";

describe("isPhaseAtelier", () => {
  it("accepte les deux phases d'atelier, refuse le reste (dont « finale »)", () => {
    expect(isPhaseAtelier("cfp_et_pitch")).toBe(true);
    expect(isPhaseAtelier("montee_sur_scene")).toBe(true);
    expect(isPhaseAtelier("finale")).toBe(false); // la soirée n'a pas d'atelier
    expect(isPhaseAtelier("")).toBe(false);
    expect(isPhaseAtelier(undefined)).toBe(false);
  });
});

describe("phaseDateCoherente (date ↔ phase relative à la finale)", () => {
  const finale = "2026-06-04";

  it("avant la soirée : date <= finale OK, date après = incohérent", () => {
    expect(phaseDateCoherente("cfp_et_pitch", "2026-05-01", finale)).toBe(true);
    expect(phaseDateCoherente("cfp_et_pitch", "2026-06-04", finale)).toBe(true); // le jour même
    expect(phaseDateCoherente("cfp_et_pitch", "2026-07-01", finale)).toBe(false);
  });

  it("après la soirée : date >= finale OK, date avant = incohérent", () => {
    expect(phaseDateCoherente("montee_sur_scene", "2026-09-01", finale)).toBe(true);
    expect(phaseDateCoherente("montee_sur_scene", "2026-05-01", finale)).toBe(false);
  });

  it("ne contraint pas si une des dates manque", () => {
    expect(phaseDateCoherente("cfp_et_pitch", null, finale)).toBe(true);
    expect(phaseDateCoherente("montee_sur_scene", "2026-05-01", null)).toBe(true);
  });
});
