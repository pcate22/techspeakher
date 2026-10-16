import { describe, it, expect } from "vitest";
import { pickManualImageUpdate } from "@/lib/provider-avatar";

describe("pickManualImageUpdate", () => {
  it("lit l'image d'un unstable_update() manuel (upload d'avatar)", () => {
    expect(pickManualImageUpdate({ user: { image: "https://blob/moi.png" } })).toBe(
      "https://blob/moi.png",
    );
  });

  it("trim l'URL", () => {
    expect(pickManualImageUpdate({ user: { image: "  https://blob/moi.png  " } })).toBe(
      "https://blob/moi.png",
    );
  });

  it.each([
    null,
    undefined,
    "chaine",
    42,
    {},
    { user: null },
    { user: {} },
    { user: { image: null } },
    { user: { image: 42 } },
    { user: { image: "   " } },
  ])("null pour une entrée non exploitable : %j", (entree) => {
    expect(pickManualImageUpdate(entree)).toBeNull();
  });
});
