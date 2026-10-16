import { describe, it, expect, afterEach } from "vitest";
import { isMagicLinkEnabled, magicLinkProvider } from "@/lib/magic-link";

describe("lien magique (e-mail)", () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });

  it("désactivé si Brevo n'est pas configuré", () => {
    delete process.env.BREVO_API_KEY;
    expect(isMagicLinkEnabled()).toBe(false);
  });

  it("activé dès que la clé Brevo est présente (config contact réutilisée)", () => {
    process.env.BREVO_API_KEY = "key";
    expect(isMagicLinkEnabled()).toBe(true);
  });

  it("le provider est de type email (signIn 'email')", () => {
    const p = magicLinkProvider() as { id: string; type: string };
    expect(p.id).toBe("email");
    expect(p.type).toBe("email");
  });
});
