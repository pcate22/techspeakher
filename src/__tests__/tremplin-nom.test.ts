import { describe, it, expect } from "vitest";
import { nomEditionPropose } from "@/lib/tremplin-nom";

describe("nomEditionPropose (nom proposé à la duplication)", () => {
  it("remplace l'année finale du nom de conf par l'année cible", () => {
    expect(nomEditionPropose("DevFest Toulouse 2026", 2027)).toBe(
      "Tremplin DevFest Toulouse 2027",
    );
  });

  it("ajoute l'année quand le nom de conf n'en porte pas", () => {
    expect(nomEditionPropose("Devoxx France", 2027)).toBe("Tremplin Devoxx France 2027");
  });

  it("sans conf connue (nouvelle conférence) : « Tremplin {année} »", () => {
    expect(nomEditionPropose(null, 2027)).toBe("Tremplin 2027");
  });

  it("année en cours de saisie (invalide) : ne colle pas d'année fantôme", () => {
    expect(nomEditionPropose("DevFest Toulouse 2026", null)).toBe("Tremplin DevFest Toulouse");
    expect(nomEditionPropose(null, null)).toBe("Tremplin");
  });

  it("ne touche pas un nombre qui n'est pas une année en fin de nom", () => {
    // 4 chiffres hors plage 19xx/20xx, ou nombre au milieu : conservés.
    expect(nomEditionPropose("Forum 4042", 2027)).toBe("Tremplin Forum 4042 2027");
    expect(nomEditionPropose("Conf 2026 du Sud", 2027)).toBe("Tremplin Conf 2026 du Sud 2027");
  });
});
