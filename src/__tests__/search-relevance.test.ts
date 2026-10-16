import { describe, it, expect } from "vitest";
import {
  fuseOptions,
  requiredRun,
  longestRun,
  foldedIncludes,
} from "@/lib/search-relevance";

describe("search-relevance (primitives partagées)", () => {
  it("fuseOptions garde l'invariant ignoreLocation (bug « brain ») et le seuil", () => {
    const o = fuseOptions<{ x: string }>([{ name: "x", weight: 1 }]);
    expect(o.ignoreLocation).toBe(true);
    expect(o.threshold).toBe(0.2);
    expect(o.includeMatches).toBe(true);
    expect(o.keys).toEqual([{ name: "x", weight: 1 }]);
  });

  it("requiredRun : requêtes courtes en entier, longues à 60 %", () => {
    expect(requiredRun("ia")).toBe(2);
    expect(requiredRun("sql")).toBe(3);
    expect(requiredRun("rachel")).toBe(4); // ceil(6 * 0.6)
    expect(requiredRun("  brain  ")).toBe(3); // trim d'abord
  });

  it("longestRun : plus long fragment contigu, tous champs", () => {
    expect(longestRun([{ indices: [[0, 3], [10, 11]] }] as never)).toBe(4);
    expect(longestRun(undefined)).toBe(0);
    expect(longestRun([] as never)).toBe(0);
  });

  it("foldedIncludes : sous-chaîne repliée (casse + accents), needle vide → false", () => {
    expect(foldedIncludes(["Île-de-France", "CTO"], "ile")).toBe(true);
    expect(foldedIncludes(["Élodie"], "elodie")).toBe(true);
    expect(foldedIncludes(["CTO", undefined, ""], "xyz")).toBe(false);
    expect(foldedIncludes(["CTO"], "")).toBe(false);
  });
});
