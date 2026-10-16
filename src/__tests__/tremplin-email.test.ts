import { describe, it, expect } from "vitest";
import { buildTremplinReadyEmail } from "@/lib/tremplin-email";
import { BASE_URL } from "@/constants/site";

describe("buildTremplinReadyEmail", () => {
  it("personnalise le prénom, nomme l'édition et lie vers l'espace", () => {
    const mail = buildTremplinReadyEmail({
      name: "Sandrine Berger",
      editionNom: "Tremplin 2026",
      editionId: 3,
    });
    expect(mail.subject).toContain("Tremplin 2026");
    expect(mail.htmlContent).toContain("Salut Sandrine,");
    expect(mail.htmlContent).toContain(`${BASE_URL}/mon-espace/tremplin/3`);
    expect(mail.textContent).toContain(`${BASE_URL}/mon-espace/tremplin/3`);
  });

  it("reste correct sans nom", () => {
    const mail = buildTremplinReadyEmail({ name: null, editionNom: "Tremplin 2026", editionId: 1 });
    expect(mail.htmlContent).toContain("Salut,");
  });
});
