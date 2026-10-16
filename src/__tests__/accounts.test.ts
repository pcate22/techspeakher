import { describe, it, expect } from "vitest";
import { activeSignInMethods, canUnlinkProvider, hasUnlinkedOAuth } from "@/lib/accounts";

/**
 * Helpers PURS des moyens de connexion (aucune base). Le cœur du garde-fou
 * anti-lockout : on ne délie jamais le dernier moyen de se reconnecter.
 */
describe("activeSignInMethods", () => {
  it("ajoute le lien magique quand activé et le compte a un e-mail", () => {
    expect(
      activeSignInMethods(["google"], { hasEmail: true, magicLinkEnabled: true }),
    ).toEqual(["google", "email"]);
  });

  it("n'ajoute pas le lien magique sans e-mail sur le compte", () => {
    expect(
      activeSignInMethods(["google"], { hasEmail: false, magicLinkEnabled: true }),
    ).toEqual(["google"]);
  });

  it("n'ajoute pas le lien magique si le provider e-mail est désactivé", () => {
    expect(
      activeSignInMethods(["linkedin"], { hasEmail: true, magicLinkEnabled: false }),
    ).toEqual(["linkedin"]);
  });
});

describe("canUnlinkProvider — garde-fou anti-lockout", () => {
  const withMagic = { hasEmail: true, magicLinkEnabled: true };
  const noMagic = { hasEmail: true, magicLinkEnabled: false };

  it("autorise si un autre provider OAuth reste", () => {
    expect(canUnlinkProvider("google", ["google", "linkedin"], noMagic)).toBe(true);
  });

  it("autorise le retrait du dernier OAuth si le lien magique prend le relais", () => {
    expect(canUnlinkProvider("google", ["google"], withMagic)).toBe(true);
  });

  it("REFUSE le retrait du dernier OAuth si le lien magique n'est pas disponible", () => {
    expect(canUnlinkProvider("google", ["google"], noMagic)).toBe(false);
  });

  it("REFUSE si aucun moyen ne resterait (dernier OAuth, sans e-mail)", () => {
    expect(
      canUnlinkProvider("linkedin", ["linkedin"], { hasEmail: false, magicLinkEnabled: true }),
    ).toBe(false);
  });
});

describe("hasUnlinkedOAuth — incitation au regroupement", () => {
  it("true : un provider OAuth configuré reste non relié", () => {
    expect(hasUnlinkedOAuth(["google"], ["google", "linkedin"])).toBe(true);
  });

  it("true : aucun OAuth relié (compte lien magique seul)", () => {
    expect(hasUnlinkedOAuth([], ["google", "linkedin"])).toBe(true);
  });

  it("false : tous les providers configurés sont déjà reliés", () => {
    expect(hasUnlinkedOAuth(["linkedin", "google"], ["google", "linkedin"])).toBe(false);
  });

  it("false : aucun provider OAuth configuré (rien à relier)", () => {
    expect(hasUnlinkedOAuth([], [])).toBe(false);
  });
});
