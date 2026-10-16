import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((p: string) => {
    throw new Error(`REDIRECT:${p}`);
  }),
}));
const cookieSet = vi.fn();
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ set: cookieSet })) }));
vi.mock("@/auth", () => ({ signIn: vi.fn() }));
vi.mock("@/auth.config", () => ({
  isGoogleEnabled: vi.fn(),
  isLinkedInEnabled: vi.fn(),
}));

import { signIn } from "@/auth";
import { isGoogleEnabled, isLinkedInEnabled } from "@/auth.config";
import { SKIP_DUP_CHECK_COOKIE } from "@/lib/accounts";
import { continueAsNewAction } from "@/app/connexion/deja-un-compte/actions";

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isGoogleEnabled).mockReturnValue(true);
  vi.mocked(isLinkedInEnabled).mockReturnValue(true);
});

describe("continueAsNewAction", () => {
  it("pose le cookie de court-circuit puis relance la connexion", async () => {
    await continueAsNewAction(fd({ methode: "linkedin" }));
    expect(cookieSet).toHaveBeenCalledWith(
      SKIP_DUP_CHECK_COOKIE,
      "1",
      expect.objectContaining({ httpOnly: true, path: "/" }),
    );
    expect(signIn).toHaveBeenCalledWith("linkedin", { redirectTo: "/mon-espace" });
  });

  it("provider non configuré → retour connexion, aucune connexion ni cookie", async () => {
    vi.mocked(isLinkedInEnabled).mockReturnValue(false);
    await expect(continueAsNewAction(fd({ methode: "linkedin" }))).rejects.toThrow(
      "REDIRECT:/connexion?error=default",
    );
    expect(cookieSet).not.toHaveBeenCalled();
    expect(signIn).not.toHaveBeenCalled();
  });

  it("provider inconnu → retour connexion", async () => {
    await expect(continueAsNewAction(fd({ methode: "facebook" }))).rejects.toThrow(
      "REDIRECT:/connexion?error=default",
    );
    expect(signIn).not.toHaveBeenCalled();
  });
});
