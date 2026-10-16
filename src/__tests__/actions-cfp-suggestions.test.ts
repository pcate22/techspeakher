import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((p: string) => {
    throw new Error(`REDIRECT:${p}`);
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("@/auth", () => ({ auth: vi.fn(), signOut: vi.fn() }));
vi.mock("@/lib/profiles", () => ({
  getProfileByUserId: vi.fn(),
  canSubmitToDirectory: vi.fn(),
  submitForValidation: vi.fn(),
  withdrawOwnProfile: vi.fn(),
  upsertProfile: vi.fn(),
  ensureProfileId: vi.fn(),
}));
vi.mock("@/lib/talks", () => ({
  addTalk: vi.fn(),
  updateTalk: vi.fn(),
  deleteTalk: vi.fn(),
}));
// importOriginal : conference-form (importé par les actions) consomme les
// helpers Zod réels (optionalText/optionalUrl) ; seul l'accès formulaire
// profil est mocké.
vi.mock("@/lib/profile-form", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/profile-form")>();
  return { ...actual, parseProfileForm: vi.fn() };
});
vi.mock("@/lib/talk-form", () => ({ parseTalkForm: vi.fn() }));
vi.mock("@/lib/cfp-suggestions", () => ({
  acceptSuggestion: vi.fn(),
  refuseSuggestion: vi.fn(),
}));

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getProfileByUserId } from "@/lib/profiles";
import { acceptSuggestion, refuseSuggestion } from "@/lib/cfp-suggestions";
import {
  acceptSuggestionAction,
  refuseSuggestionAction,
} from "@/app/mon-espace/actions";
import { fd } from "./test-helpers";

beforeEach(() => vi.clearAllMocks());

describe("acceptSuggestionAction — garde-fous", () => {
  it("sans session → /connexion, rien d'écrit", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    await expect(
      acceptSuggestionAction(fd({ suggestionId: "9" })),
    ).rejects.toThrow("REDIRECT:/connexion");
    expect(acceptSuggestion).not.toHaveBeenCalled();
  });

  it("confirme avec le profil de la SESSION (jamais un id client)", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7" } } as never);
    vi.mocked(getProfileByUserId).mockResolvedValue({ id: 4 } as never);

    await acceptSuggestionAction(fd({ suggestionId: "9" }));
    expect(getProfileByUserId).toHaveBeenCalledWith(7);
    expect(acceptSuggestion).toHaveBeenCalledWith(9, 4);
  });

  it("rafraîchit la fiche publique + l'annuaire (le talk confirmé y apparaît)", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7" } } as never);
    vi.mocked(getProfileByUserId).mockResolvedValue({ id: 4 } as never);
    await acceptSuggestionAction(fd({ suggestionId: "9" }));
    const paths = vi.mocked(revalidatePath).mock.calls.map((c) => c[0]);
    expect(paths).toContain("/speakeuses");
    // Fiche revalidée par motif de route dynamique (id OU slug).
    expect(paths).toContain("/speakeuses/[id]");
  });

  it("suggestionId non numérique → rien", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7" } } as never);
    vi.mocked(getProfileByUserId).mockResolvedValue({ id: 4 } as never);
    await acceptSuggestionAction(fd({ suggestionId: "abc" }));
    expect(acceptSuggestion).not.toHaveBeenCalled();
  });

  it("sans profil → rien (aucune suggestion ne peut exister)", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7" } } as never);
    vi.mocked(getProfileByUserId).mockResolvedValue(null as never);
    await acceptSuggestionAction(fd({ suggestionId: "9" }));
    expect(acceptSuggestion).not.toHaveBeenCalled();
  });
});

describe("refuseSuggestionAction — garde-fous", () => {
  it("sans session → /connexion, rien d'écrit", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    await expect(
      refuseSuggestionAction(fd({ suggestionId: "9" })),
    ).rejects.toThrow("REDIRECT:/connexion");
    expect(refuseSuggestion).not.toHaveBeenCalled();
  });

  it("refuse avec le profil de la session", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7" } } as never);
    vi.mocked(getProfileByUserId).mockResolvedValue({ id: 4 } as never);

    await refuseSuggestionAction(fd({ suggestionId: "9" }));
    expect(refuseSuggestion).toHaveBeenCalledWith(9, 4);
  });

  it("écarter NE revalide PAS la fiche publique (rien de public ne change)", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7" } } as never);
    vi.mocked(getProfileByUserId).mockResolvedValue({ id: 4 } as never);
    await refuseSuggestionAction(fd({ suggestionId: "9" }));
    const paths = vi.mocked(revalidatePath).mock.calls.map((c) => c[0]);
    expect(paths).not.toContain("/speakeuses");
    expect(paths).not.toContain("/speakeuses/[id]");
    // Seul l'espace membre est rafraîchi (la suggestion disparaît de la
    // liste des talks, la marche du profil se met à jour — lot N2).
    expect(paths).toContain("/mon-espace/talks");
    expect(paths).toContain("/mon-espace/profil");
  });
});
