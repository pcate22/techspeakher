import { describe, it, expect } from "vitest";
import { canViewEditionSpace } from "@/lib/tremplin-guards";
import type { Registration } from "@/lib/tremplin-registrations";

const reg = { id: 1 } as Registration;

describe("canViewEditionSpace", () => {
  it("autorise une participante inscrite", () => {
    expect(canViewEditionSpace(reg, false)).toBe(true);
  });

  it("autorise une orga même sans inscription (prévisualisation)", () => {
    expect(canViewEditionSpace(null, true)).toBe(true);
  });

  it("refuse un compte connecté ni inscrit ni orga", () => {
    expect(canViewEditionSpace(null, false)).toBe(false);
  });
});

/**
 * La VISIBILITÉ d'un atelier (`atelierVisiblePour`) se teste avec le registre
 * des audiences qui la porte : `atelier-audience.test.ts`. Une seule table de
 * vérité pour une seule règle.
 */
