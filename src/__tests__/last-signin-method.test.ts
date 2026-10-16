import { describe, it, expect, vi, beforeEach } from "vitest";

const store = new Map<string, string>();
const cookieSet = vi.fn((name: string, value: string) => store.set(name, value));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    set: cookieSet,
    get: (name: string) => (store.has(name) ? { value: store.get(name) } : undefined),
  })),
}));

import { rememberSignInMethod, getLastSignInMethod } from "@/lib/last-signin-method";

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
});

describe("last-signin-method", () => {
  it("null quand aucun cookie", async () => {
    expect(await getLastSignInMethod()).toBeNull();
  });

  it("mémorise puis relit la méthode (cookie httpOnly, long)", async () => {
    await rememberSignInMethod("linkedin");
    expect(cookieSet).toHaveBeenCalledWith(
      "tsh-derniere-methode",
      "linkedin",
      expect.objectContaining({ httpOnly: true, path: "/" }),
    );
    expect(await getLastSignInMethod()).toBe("linkedin");
  });

  it("ignore une valeur de cookie invalide", async () => {
    store.set("tsh-derniere-methode", "facebook");
    expect(await getLastSignInMethod()).toBeNull();
  });

  it("accepte les trois méthodes valides", async () => {
    for (const m of ["google", "linkedin", "email"] as const) {
      await rememberSignInMethod(m);
      expect(await getLastSignInMethod()).toBe(m);
    }
  });
});
