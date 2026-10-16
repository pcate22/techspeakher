import { describe, it, expect } from "vitest";
import { authConfig } from "@/auth.config";

/**
 * Protection des routes (callback `authorized`, utilisé par le proxy) :
 * - pages publiques : ouvertes
 * - /mon-espace : connectée
 * - /admin : connectée ET orga (rôle)
 */
type AuthArg = Parameters<NonNullable<NonNullable<typeof authConfig.callbacks>["authorized"]>>[0];

function authorized(
  pathname: string,
  opts: { loggedIn?: boolean; isOrga?: boolean } = {},
) {
  const arg = {
    auth: opts.loggedIn
      ? { user: { email: "x@example.com", isOrga: !!opts.isOrga } }
      : null,
    request: { nextUrl: { pathname } },
  } as unknown as AuthArg;
  return authConfig.callbacks!.authorized!(arg);
}

describe("authConfig.authorized — protection des routes", () => {
  it("laisse passer les pages publiques", () => {
    expect(authorized("/", {})).toBe(true);
    expect(authorized("/speakeuses", {})).toBe(true);
  });

  it("bloque /mon-espace si non connectée, autorise si connectée", () => {
    expect(authorized("/mon-espace", { loggedIn: false })).toBe(false);
    expect(authorized("/mon-espace", { loggedIn: true })).toBe(true);
  });

  it("réserve /admin aux orgas", () => {
    expect(authorized("/admin", { loggedIn: false })).toBe(false);
    expect(authorized("/admin", { loggedIn: true, isOrga: false })).toBe(false);
    expect(authorized("/admin", { loggedIn: true, isOrga: true })).toBe(true);
  });
});
