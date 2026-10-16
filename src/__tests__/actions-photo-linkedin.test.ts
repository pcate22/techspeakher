import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((p: string) => {
    throw new Error(`REDIRECT:${p}`);
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
const cookieSet = vi.fn();
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ set: cookieSet })) }));
vi.mock("@/auth", () => ({ signIn: vi.fn(), signOut: vi.fn(), unstable_update: vi.fn() }));
vi.mock("@/lib/auth-guards", () => ({ requireUserId: vi.fn() }));
vi.mock("@/lib/linkedin-photo", () => ({ reprendrePhotoLinkedIn: vi.fn() }));
vi.mock("@/lib/users", () => ({
  setUserName: vi.fn(),
  getUserById: vi.fn(),
  setUserImage: vi.fn(),
}));
vi.mock("@/lib/rate-limit", () => ({ isRateLimited: vi.fn() }));
vi.mock("@/auth.config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/auth.config")>();
  return { ...actual, isLinkedInEnabled: vi.fn() };
});

import { updateTag } from "next/cache";
import { signIn, unstable_update } from "@/auth";
import { requireUserId } from "@/lib/auth-guards";
import { reprendrePhotoLinkedIn } from "@/lib/linkedin-photo";
import { setUserImage } from "@/lib/users";
import { isRateLimited } from "@/lib/rate-limit";
import { isLinkedInEnabled } from "@/auth.config";
import { SKIP_DUP_CHECK_COOKIE } from "@/lib/accounts";
import {
  reprendrePhotoLinkedInAction,
  reconnecterLinkedInAction,
} from "@/app/mon-espace/actions";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireUserId).mockResolvedValue(7 as never);
  vi.mocked(isRateLimited).mockReturnValue(false);
  vi.mocked(isLinkedInEnabled).mockReturnValue(true);
});

describe("reprendrePhotoLinkedInAction", () => {
  it("écrit NOTRE copie sur le compte de la SESSION, et rafraîchit l'avatar affiché", async () => {
    vi.mocked(reprendrePhotoLinkedIn).mockResolvedValue({
      ok: true,
      url: "https://blob.example/avatars/moi.jpg",
    });

    const r = await reprendrePhotoLinkedInAction();

    expect(reprendrePhotoLinkedIn).toHaveBeenCalledWith(7);
    expect(setUserImage).toHaveBeenCalledWith(7, "https://blob.example/avatars/moi.jpg");
    // Sans ça, le header garderait l'ancienne photo jusqu'à la prochaine connexion.
    expect(unstable_update).toHaveBeenCalledWith({
      user: { image: "https://blob.example/avatars/moi.jpg" },
    });
    expect(r).toEqual({ statut: "ok", url: "https://blob.example/avatars/moi.jpg" });
    // La photo s'affiche sur la carte de l'annuaire : son cache expire aussi.
    expect(vi.mocked(updateTag)).toHaveBeenCalledWith("annuaire");
  });

  it("cadence dépassée : rien n'est demandé à LinkedIn, rien n'est écrit", async () => {
    vi.mocked(isRateLimited).mockReturnValue(true);
    const r = await reprendrePhotoLinkedInAction();
    expect(r).toMatchObject({ statut: "erreur" });
    expect(reprendrePhotoLinkedIn).not.toHaveBeenCalled();
    expect(setUserImage).not.toHaveBeenCalled();
  });

  it("jeton périmé : le statut « reconnexion » remonte, SANS toucher au compte", async () => {
    vi.mocked(reprendrePhotoLinkedIn).mockResolvedValue({ ok: false, raison: "reconnexion" });
    expect(await reprendrePhotoLinkedInAction()).toEqual({ statut: "reconnexion" });
    expect(setUserImage).not.toHaveBeenCalled();
    expect(unstable_update).not.toHaveBeenCalled();
  });

  it("échec : le message remonte, la photo du compte reste celle d'avant", async () => {
    vi.mocked(reprendrePhotoLinkedIn).mockResolvedValue({
      ok: false,
      raison: "echec",
      message: "LinkedIn met du temps à répondre. Réessaie dans un instant.",
    });
    expect(await reprendrePhotoLinkedInAction()).toEqual({
      statut: "erreur",
      message: "LinkedIn met du temps à répondre. Réessaie dans un instant.",
    });
    expect(setUserImage).not.toHaveBeenCalled();
  });

  it("LinkedIn hors configuration : rien n'est demandé (une ligne accounts survit au retrait des clés)", async () => {
    vi.mocked(isLinkedInEnabled).mockReturnValue(false);
    expect(await reprendrePhotoLinkedInAction()).toMatchObject({ statut: "erreur" });
    expect(reprendrePhotoLinkedIn).not.toHaveBeenCalled();
  });

  it("visiteuse anonyme : la garde de session tranche avant tout le reste", async () => {
    vi.mocked(requireUserId).mockRejectedValue(new Error("REDIRECT:/connexion") as never);
    await expect(reprendrePhotoLinkedInAction()).rejects.toThrow("REDIRECT:/connexion");
    expect(reprendrePhotoLinkedIn).not.toHaveBeenCalled();
  });
});

describe("reconnecterLinkedInAction", () => {
  it("repart vers LinkedIn en promettant le retour demandé", async () => {
    await reconnecterLinkedInAction("/mon-espace/fiche/identite");
    expect(cookieSet).toHaveBeenCalledWith(
      SKIP_DUP_CHECK_COOKIE,
      "1",
      expect.objectContaining({ httpOnly: true, path: "/" }),
    );
    expect(signIn).toHaveBeenCalledWith("linkedin", {
      redirectTo: "/mon-espace/fiche/identite",
    });
  });

  it.each([
    "https://ailleurs.example/piege",
    "//ailleurs.example",
    "/admin",
    "/mon-espacepiege",
  ])("borne le retour à l'espace perso : %s est ignoré", async (retour) => {
    await reconnecterLinkedInAction(retour);
    expect(signIn).toHaveBeenCalledWith("linkedin", { redirectTo: "/mon-espace/profil" });
  });

  it("LinkedIn hors configuration : on rentre, aucune connexion lancée", async () => {
    vi.mocked(isLinkedInEnabled).mockReturnValue(false);
    await expect(reconnecterLinkedInAction("/mon-espace/photo")).rejects.toThrow(
      "REDIRECT:/mon-espace/photo",
    );
    expect(signIn).not.toHaveBeenCalled();
  });

  it("visiteuse anonyme : aucune connexion lancée", async () => {
    vi.mocked(requireUserId).mockRejectedValue(new Error("REDIRECT:/connexion") as never);
    await expect(reconnecterLinkedInAction("/mon-espace/photo")).rejects.toThrow(
      "REDIRECT:/connexion",
    );
    expect(signIn).not.toHaveBeenCalled();
  });
});
