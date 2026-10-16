import { describe, it, expect } from "vitest";
import { buildInvitationEmail } from "@/lib/invitation-email";

describe("buildInvitationEmail", () => {
  it("personnalise (prénom + e-mail) et pointe vers la connexion", () => {
    const { subject, htmlContent } = buildInvitationEmail({
      name: "Marie Curie",
      email: "marie@ex.fr",
      isOrga: false,
    });
    expect(subject).toMatch(/tu as la main/i);
    expect(subject).not.toContain("—"); // pas de cadratin
    expect(htmlContent).toMatch(/Salut Marie,/);
    expect(htmlContent).toContain("marie@ex.fr");
    expect(htmlContent).toContain("/connexion");
  });

  it("ajoute l'encart orga uniquement pour une orga", () => {
    const sans = buildInvitationEmail({ name: "A", email: "a@b.fr", isOrga: false });
    expect(sans.htmlContent).not.toMatch(/équipe organisatrice/i);
    const avec = buildInvitationEmail({ name: "A", email: "a@b.fr", isOrga: true });
    // Le mot ENTIER : « orga » est une troncature, et cet e-mail est lu par
    // quelqu'un qui découvre la plateforme (checklist COGA, 2026-08-16).
    expect(avec.htmlContent).toMatch(/équipe organisatrice/i);
    expect(avec.htmlContent).not.toMatch(/\borga\b/i);
    expect(avec.htmlContent).toMatch(/modérer les fiches/i);
  });

  it("gère un nom absent", () => {
    const { htmlContent } = buildInvitationEmail({
      name: null,
      email: "a@b.fr",
      isOrga: false,
    });
    expect(htmlContent).toMatch(/Salut,/);
  });
});
