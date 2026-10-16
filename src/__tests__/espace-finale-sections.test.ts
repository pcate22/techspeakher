import { describe, it, expect } from "vitest";
import { espaceFinaleSections } from "@/lib/tremplin-registration-phases";

/**
 * Séparation des phases dans l'espace membre : le pitch DE FINALE (phase 2) et
 * la visibilité GALERIE (finalistes, phase 2) ne doivent pas apparaître pour une
 * inscrite qui n'est que sur la phase 3 (montée sur scène). Règle validée :
 * - pitch : chemin finale = phase 1 (« cfp_et_pitch ») OU finaliste ;
 * - visibilité galerie : finaliste confirmée uniquement.
 */
describe("espaceFinaleSections", () => {
  it("phase 3 seule, non finaliste : ni pitch ni visibilité (le cas signalé)", () => {
    const s = espaceFinaleSections(
      { finalePresente: false },
      new Set(["montee_sur_scene"]),
    );
    expect(s).toEqual({ showPitch: false, showVisibility: false });
  });

  it("phase 1 (CFP & pitch), pas encore finaliste : pitch oui, visibilité non", () => {
    const s = espaceFinaleSections(
      { finalePresente: false },
      new Set(["cfp_et_pitch"]),
    );
    expect(s).toEqual({ showPitch: true, showVisibility: false });
  });

  it("finaliste confirmée : pitch ET visibilité, quelle que soit la phase", () => {
    const s = espaceFinaleSections(
      { finalePresente: true },
      new Set(["montee_sur_scene"]),
    );
    expect(s).toEqual({ showPitch: true, showVisibility: true });
  });

  it("gagnante (phase 1 + phase 3, finaliste) : tout affiché", () => {
    const s = espaceFinaleSections(
      { finalePresente: true },
      new Set(["cfp_et_pitch", "montee_sur_scene"]),
    );
    expect(s).toEqual({ showPitch: true, showVisibility: true });
  });

  it("pas d'inscription (orga en aperçu / invitée) : rien", () => {
    expect(espaceFinaleSections(null, undefined)).toEqual({
      showPitch: false,
      showVisibility: false,
    });
  });

  it("appartenance de phase inconnue (données incomplètes) : repli non exposant", () => {
    const s = espaceFinaleSections({ finalePresente: false }, undefined);
    expect(s).toEqual({ showPitch: false, showVisibility: false });
  });
});
