import { describe, it, expect } from "vitest";
import {
  SEUIL_AXE,
  axeDuGeste,
  decalageGlissement,
  tiroirOuvertApres,
} from "@/lib/glissement";

/**
 * La MATHS du glissement, à part du composant : c'est elle qui décide si le
 * doigt fait défiler la page ou ouvre un tiroir, et un tiroir qui s'ouvre pour
 * un défilement vertical rend une liste inutilisable au doigt.
 */

describe("axeDuGeste", () => {
  it("sous le seuil, l'axe reste indéterminé (on ne devine pas une intention)", () => {
    expect(axeDuGeste(0, 0)).toBe("indetermine");
    expect(axeDuGeste(-(SEUIL_AXE - 1), 2)).toBe("indetermine");
  });

  it("horizontal dès que le déplacement latéral domine et passe le seuil", () => {
    expect(axeDuGeste(-30, 4)).toBe("horizontal");
    expect(axeDuGeste(30, -4)).toBe("horizontal");
  });

  it("vertical quand c'est le défilement qui domine : la liste garde la main", () => {
    expect(axeDuGeste(-6, 40)).toBe("vertical");
    expect(axeDuGeste(4, -40)).toBe("vertical");
  });

  it("à déplacements égaux, le défilement gagne (le doute profite au scroll)", () => {
    expect(axeDuGeste(-20, 20)).toBe("vertical");
  });
});

describe("decalageGlissement", () => {
  it("vers la GAUCHE, le contenu recule à hauteur du doigt", () => {
    expect(decalageGlissement(0, -20, 56)).toBe(20);
  });

  it("borné au tiroir : glisser plus loin ne décolle pas la rangée", () => {
    expect(decalageGlissement(0, -300, 56)).toBe(56);
  });

  it("jamais vers la droite depuis un tiroir fermé (pas de tiroir fantôme)", () => {
    expect(decalageGlissement(0, 40, 56)).toBe(0);
  });

  it("tiroir ouvert : glisser vers la droite le referme progressivement", () => {
    expect(decalageGlissement(56, 20, 56)).toBe(36);
    expect(decalageGlissement(56, 200, 56)).toBe(0);
  });
});

describe("tiroirOuvertApres", () => {
  it("passé la moitié, le tiroir se cale OUVERT", () => {
    expect(tiroirOuvertApres(28, 56)).toBe(true);
    expect(tiroirOuvertApres(56, 56)).toBe(true);
  });

  it("en deçà, il se referme : un frôlement ne laisse pas une poubelle armée", () => {
    expect(tiroirOuvertApres(27, 56)).toBe(false);
    expect(tiroirOuvertApres(0, 56)).toBe(false);
  });
});
