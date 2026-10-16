import { describe, it, expect } from "vitest";
import { buildModerationEmail } from "@/lib/moderation-email";

describe("buildModerationEmail", () => {
  it("publication : sujet positif + lien vers la fiche", () => {
    const { subject, textContent } = buildModerationEmail({
      decision: "publie",
      name: "Marie Curie",
      profileId: 12,
    });
    expect(subject).toMatch(/en ligne/i);
    expect(textContent).toMatch(/Salut Marie,/);
    expect(textContent).toMatch(/\/speakeuses\/12/);
  });

  it("refus : inclut le motif et invite à re-soumettre", () => {
    const { subject, textContent } = buildModerationEmail({
      decision: "refuse",
      name: "Marie Curie",
      motif: "La bio est vide.",
      profileId: 12,
    });
    expect(subject).toMatch(/ajustements/i);
    expect(textContent).toMatch(/La bio est vide\./);
    expect(textContent).toMatch(/\/mon-espace/);
  });

  it("refus sans motif : reste lisible", () => {
    const { textContent } = buildModerationEmail({
      decision: "refuse",
      name: null,
      motif: null,
      profileId: 1,
    });
    expect(textContent).toMatch(/Salut,/);
    expect(textContent).toMatch(/aucun détail/i);
  });
});
