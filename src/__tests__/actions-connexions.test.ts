import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((p: string) => {
    throw new Error(`REDIRECT:${p}`);
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const cookieSet = vi.fn();
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ set: cookieSet })) }));
vi.mock("@/auth", () => ({ signIn: vi.fn() }));
vi.mock("@/lib/auth-guards", () => ({ requireUserId: vi.fn() }));
vi.mock("@/lib/users", () => ({ getUserById: vi.fn() }));
vi.mock("@/lib/magic-link", () => ({ isMagicLinkEnabled: vi.fn() }));
vi.mock("@/auth.config", () => ({
  isGoogleEnabled: vi.fn(),
  isLinkedInEnabled: vi.fn(),
}));
// On garde les helpers PURS réels (canUnlinkProvider) : seul l'accès base est mocké.
vi.mock("@/lib/accounts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/accounts")>();
  return { ...actual, getLinkedProviders: vi.fn(), unlinkProvider: vi.fn() };
});

import { signIn } from "@/auth";
import { requireUserId } from "@/lib/auth-guards";
import { getUserById } from "@/lib/users";
import { isMagicLinkEnabled } from "@/lib/magic-link";
import { isGoogleEnabled, isLinkedInEnabled } from "@/auth.config";
import { getLinkedProviders, unlinkProvider, SKIP_DUP_CHECK_COOKIE } from "@/lib/accounts";
import {
  linkProviderAction,
  unlinkProviderAction,
} from "@/app/mon-espace/connexions/actions";

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireUserId).mockResolvedValue(1 as never);
  vi.mocked(getUserById).mockResolvedValue({ id: 1, name: null, email: "moi@ex.com" });
  vi.mocked(isMagicLinkEnabled).mockReturnValue(false);
  vi.mocked(isGoogleEnabled).mockReturnValue(true);
  vi.mocked(isLinkedInEnabled).mockReturnValue(true);
});

describe("linkProviderAction", () => {
  it("lance la connexion OAuth pour un provider configuré, en court-circuitant la détection", async () => {
    await linkProviderAction(fd({ provider: "linkedin" }));
    expect(cookieSet).toHaveBeenCalledWith(
      SKIP_DUP_CHECK_COOKIE,
      "1",
      expect.objectContaining({ httpOnly: true, path: "/" }),
    );
    expect(signIn).toHaveBeenCalledWith("linkedin", {
      redirectTo: "/mon-espace/connexions?ok=liee",
    });
  });

  it("provider non configuré → erreur, aucune connexion lancée", async () => {
    vi.mocked(isLinkedInEnabled).mockReturnValue(false);
    await expect(linkProviderAction(fd({ provider: "linkedin" }))).rejects.toThrow(
      "REDIRECT:/mon-espace/connexions?error=methode",
    );
    expect(signIn).not.toHaveBeenCalled();
  });

  it("provider inconnu → erreur", async () => {
    await expect(linkProviderAction(fd({ provider: "facebook" }))).rejects.toThrow(
      "REDIRECT:/mon-espace/connexions?error=methode",
    );
    expect(signIn).not.toHaveBeenCalled();
  });
});

describe("unlinkProviderAction — garde-fou anti-lockout", () => {
  it("délie quand un autre moyen reste (deux OAuth)", async () => {
    vi.mocked(getLinkedProviders).mockResolvedValue(["google", "linkedin"]);
    await expect(unlinkProviderAction(fd({ provider: "google" }))).rejects.toThrow(
      "REDIRECT:/mon-espace/connexions?ok=deliee",
    );
    expect(unlinkProvider).toHaveBeenCalledWith(1, "google");
  });

  it("REFUSE de retirer le dernier OAuth quand le lien magique est indisponible", async () => {
    vi.mocked(getLinkedProviders).mockResolvedValue(["google"]);
    vi.mocked(isMagicLinkEnabled).mockReturnValue(false);
    await expect(unlinkProviderAction(fd({ provider: "google" }))).rejects.toThrow(
      "REDIRECT:/mon-espace/connexions?error=derniere",
    );
    expect(unlinkProvider).not.toHaveBeenCalled();
  });

  it("autorise le retrait du dernier OAuth si le lien magique prend le relais", async () => {
    vi.mocked(getLinkedProviders).mockResolvedValue(["google"]);
    vi.mocked(isMagicLinkEnabled).mockReturnValue(true);
    await expect(unlinkProviderAction(fd({ provider: "google" }))).rejects.toThrow(
      "REDIRECT:/mon-espace/connexions?ok=deliee",
    );
    expect(unlinkProvider).toHaveBeenCalledWith(1, "google");
  });

  it("provider inconnu → erreur, rien supprimé", async () => {
    await expect(unlinkProviderAction(fd({ provider: "facebook" }))).rejects.toThrow(
      "REDIRECT:/mon-espace/connexions?error=methode",
    );
    expect(unlinkProvider).not.toHaveBeenCalled();
  });
});
