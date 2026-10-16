import { describe, it, expect } from "vitest";
import { parseContactMessage } from "@/lib/contact-message";
import { fd } from "./test-helpers";

describe("parseContactMessage", () => {
  it("valide un message correct", () => {
    const r = parseContactMessage(
      fd({
        motif: "conference",
        nom: "Jean",
        email: "jean@exemple.com",
        message: "Bonjour !",
      }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.email).toBe("jean@exemple.com");
      expect(r.data.motif).toBe("conference");
    }
  });

  it("exige nom, e-mail valide et message", () => {
    const r = parseContactMessage(
      fd({ motif: "jury", nom: "", email: "pasunmail", message: "" }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.nom).toBeTruthy();
      expect(r.errors.email).toBeTruthy();
      expect(r.errors.message).toBeTruthy();
    }
  });

  it("exige un motif dans la liste", () => {
    const manquant = parseContactMessage(
      fd({ nom: "Jean", email: "jean@exemple.com", message: "Salut" }),
    );
    expect(manquant.ok).toBe(false);
    if (!manquant.ok) expect(manquant.errors.motif).toBeTruthy();

    const inconnu = parseContactMessage(
      fd({
        motif: "spam",
        nom: "Jean",
        email: "jean@exemple.com",
        message: "Salut",
      }),
    );
    expect(inconnu.ok).toBe(false);
    if (!inconnu.ok) expect(inconnu.errors.motif).toBeTruthy();
  });
});
