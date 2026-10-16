import { describe, it, expect, vi, afterEach } from "vitest";

// notFound() lève (comportement Next.js) — on le simule pour vérifier l'appel.
// vi.hoisted : la factory de vi.mock est hissée au-dessus des imports.
const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("next/navigation", () => ({ notFound }));

import { requireFeatureEnabled } from "@/lib/require-feature";
import { FEATURE_FLAGS } from "@/lib/feature-flags";

const VAR = FEATURE_FLAGS.adhesions;

describe("requireFeatureEnabled — garde de page derrière un flag", () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
    notFound.mockClear();
  });

  it("appelle notFound() quand le flag est éteint", () => {
    delete process.env[VAR];
    expect(() => requireFeatureEnabled("adhesions")).toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledOnce();
  });

  it("laisse passer quand le flag est actif", () => {
    process.env[VAR] = "1";
    expect(() => requireFeatureEnabled("adhesions")).not.toThrow();
    expect(notFound).not.toHaveBeenCalled();
  });
});
