import { describe, it, expect } from "vitest";
import {
  comportementDefilement,
  indexBorne,
  indexVisible,
} from "@/lib/carrousel";

/**
 * La MATHS du carrousel, à part du composant : c'est elle qui dit quel verbatim
 * est à l'écran et où va la flèche suivante. Comme le glissement de rangée
 * (`lib/glissement.ts`), cette décision se teste sans DOM — et c'est tant mieux,
 * jsdom ne mesure rien (toutes les largeurs valent 0).
 */

describe("indexBorne", () => {
  it("garde l'index dans la piste, sans repartir à l'autre bout", () => {
    expect(indexBorne(0, 8)).toBe(0);
    expect(indexBorne(3, 8)).toBe(3);
    expect(indexBorne(7, 8)).toBe(7);
  });

  it("s'arrête aux deux bords : la flèche ne boucle jamais", () => {
    // Une boucle ferait sauter du dernier au premier verbatim sans prévenir :
    // les pastilles et le compteur « 8 sur 8 » deviendraient incompréhensibles.
    expect(indexBorne(-1, 8)).toBe(0);
    expect(indexBorne(8, 8)).toBe(7);
    expect(indexBorne(42, 8)).toBe(7);
  });

  it("reste à zéro sur une piste vide (aucun verbatim publié)", () => {
    expect(indexBorne(0, 0)).toBe(0);
    expect(indexBorne(3, 0)).toBe(0);
  });
});

describe("indexVisible", () => {
  it("lit l'index dans la position de défilement", () => {
    expect(indexVisible(0, 300, 8)).toBe(0);
    expect(indexVisible(300, 300, 8)).toBe(1);
    expect(indexVisible(900, 300, 8)).toBe(3);
  });

  it("arrondit au verbatim le plus proche : un défilement s'arrête entre deux", () => {
    expect(indexVisible(149, 300, 8)).toBe(0);
    expect(indexVisible(151, 300, 8)).toBe(1);
  });

  it("borne le résultat, même si le défilement dépasse (élastique iOS)", () => {
    expect(indexVisible(-40, 300, 8)).toBe(0);
    expect(indexVisible(999999, 300, 8)).toBe(7);
  });

  it("renvoie 0 quand la largeur est inconnue, au lieu de diviser par zéro", () => {
    // Avant la mesure (premier rendu, jsdom, conteneur masqué) la largeur vaut
    // 0 : sans ce garde-fou l'index serait NaN et les pastilles disparaîtraient.
    expect(indexVisible(0, 0, 8)).toBe(0);
    expect(indexVisible(120, 0, 8)).toBe(0);
  });
});

describe("comportementDefilement", () => {
  it("glisse en douceur par défaut, saute net si le mouvement est réduit", () => {
    // WCAG 2.3.3 / `prefers-reduced-motion` : le défilement animé est du
    // mouvement, il se coupe pour qui l'a demandé (globals.css ne couvre que
    // les transitions et le défilement de `html`, pas ce conteneur).
    expect(comportementDefilement(false)).toBe("smooth");
    expect(comportementDefilement(true)).toBe("auto");
  });
});
