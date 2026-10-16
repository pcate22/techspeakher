import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((p: string) => {
    throw new Error(`REDIRECT:${p}`);
  }),
}));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("@/auth", () => ({ signIn: vi.fn() }));
const { remember } = vi.hoisted(() => ({ remember: vi.fn() }));
vi.mock("@/lib/last-signin-method", () => ({ rememberSignInMethod: remember }));
vi.mock("@/lib/rate-limit", () => ({
  isMagicLinkThrottled: vi.fn(() => false),
  clientIp: vi.fn(() => "1.2.3.4"),
}));

import { signIn } from "@/auth";
import { isMagicLinkThrottled } from "@/lib/rate-limit";
import {
  signInWithGoogle,
  signInWithLinkedIn,
  signInWithEmail,
} from "@/app/connexion/actions";

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

beforeEach(() => vi.clearAllMocks());

describe("actions de connexion — mémorisation de la méthode", () => {
  it("Google : mémorise puis lance la connexion", async () => {
    await signInWithGoogle();
    expect(remember).toHaveBeenCalledWith("google");
    expect(signIn).toHaveBeenCalledWith("google", { redirectTo: "/mon-espace" });
  });

  it("LinkedIn : mémorise puis lance la connexion", async () => {
    await signInWithLinkedIn();
    expect(remember).toHaveBeenCalledWith("linkedin");
    expect(signIn).toHaveBeenCalledWith("linkedin", { redirectTo: "/mon-espace" });
  });

  it("e-mail : mémorise « email » puis envoie le lien", async () => {
    await signInWithEmail(fd({ email: "a@ex.com" }));
    expect(remember).toHaveBeenCalledWith("email");
    expect(signIn).toHaveBeenCalledWith("email", {
      email: "a@ex.com",
      redirectTo: "/mon-espace",
    });
  });

  it("e-mail vide : ne fait rien", async () => {
    await signInWithEmail(fd({ email: "  " }));
    expect(remember).not.toHaveBeenCalled();
    expect(signIn).not.toHaveBeenCalled();
  });

  it("e-mail throttlé : redirige, ne mémorise ni n'envoie", async () => {
    vi.mocked(isMagicLinkThrottled).mockReturnValue(true);
    await expect(signInWithEmail(fd({ email: "a@ex.com" }))).rejects.toThrow(
      "REDIRECT:/connexion?error=throttle",
    );
    expect(remember).not.toHaveBeenCalled();
    expect(signIn).not.toHaveBeenCalled();
  });
});
