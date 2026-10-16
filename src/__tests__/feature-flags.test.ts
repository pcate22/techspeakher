import { describe, it, expect, afterEach } from "vitest";
import {
  isFeatureEnabled,
  activeFeatureFlags,
  FEATURE_FLAGS,
} from "@/lib/feature-flags";

const VAR = FEATURE_FLAGS.adhesions;

describe("feature-flags — activation par variable d'environnement", () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });

  it("inactif quand la variable est absente (défaut fermé)", () => {
    delete process.env[VAR];
    expect(isFeatureEnabled("adhesions")).toBe(false);
  });

  it("actif pour « 1 » et « true » (insensible à la casse, espaces ignorés)", () => {
    for (const v of ["1", "true", "TRUE", "  true  "]) {
      process.env[VAR] = v;
      expect(isFeatureEnabled("adhesions")).toBe(true);
    }
  });

  it("inactif pour toute autre valeur (« 0 », « false », quelconque, vide)", () => {
    for (const v of ["0", "false", "no", "oui", ""]) {
      process.env[VAR] = v;
      expect(isFeatureEnabled("adhesions")).toBe(false);
    }
  });

  it("activeFeatureFlags ne liste que les flags actifs", () => {
    delete process.env[VAR];
    expect(activeFeatureFlags()).not.toContain("adhesions");
    process.env[VAR] = "1";
    expect(activeFeatureFlags()).toContain("adhesions");
  });
});
