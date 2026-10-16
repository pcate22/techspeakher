import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((p: string) => {
    throw new Error(`REDIRECT:${p}`);
  }),
}));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/tremplin-photos", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tremplin-photos")>()),
  addPhotoTag: vi.fn(),
  removePhotoTag: vi.fn(),
  setPhotoTagConsent: vi.fn(),
  updatePhoto: vi.fn(),
  deletePhoto: vi.fn(),
}));

import { auth } from "@/auth";
import {
  addPhotoTag,
  removePhotoTag,
  setPhotoTagConsent,
  updatePhoto,
  deletePhoto,
} from "@/lib/tremplin-photos";
import {
  addPhotoTagAction,
  removePhotoTagAction,
  setPhotoTagConsentAction,
  updatePhotoAction,
  deletePhotoFromFicheAction,
} from "@/app/admin/tremplins/actions";
import { fd } from "./test-helpers";

const idle = { status: "idle" as const };
const orga = { user: { id: "1", isOrga: true } } as never;
const membre = { user: { id: "2", isOrga: false } } as never;

beforeEach(() => vi.clearAllMocks());

describe("addPhotoTagAction", () => {
  it("refuse une non-orga", async () => {
    vi.mocked(auth).mockResolvedValue(membre);
    await expect(
      addPhotoTagAction(idle, fd({ editionId: "1", photoId: "2", registrationId: "5" })),
    ).rejects.toThrow("REDIRECT:/connexion");
    expect(addPhotoTag).not.toHaveBeenCalled();
  });

  it("orga : tag inscription", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(addPhotoTag).mockResolvedValue(true);
    const res = await addPhotoTagAction(
      idle,
      fd({ editionId: "1", photoId: "2", registrationId: "5" }),
    );
    expect(res.status).toBe("success");
    expect(addPhotoTag).toHaveBeenCalledWith(2, 1, {
      registrationId: 5,
      consentement: true, // inscription : consentement porté par son profil, pas ici
    });
  });

  it("orga : tag compte ou nom libre, consentement recueilli via la case", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(addPhotoTag).mockResolvedValue(true);
    await addPhotoTagAction(
      idle,
      fd({ editionId: "1", photoId: "2", compteId: "9", consentement: "on" }),
    );
    expect(addPhotoTag).toHaveBeenCalledWith(2, 1, { userId: 9, consentement: true });

    await addPhotoTagAction(idle, fd({ editionId: "1", photoId: "2", nomLibre: "  Jurée X  " }));
    expect(addPhotoTag).toHaveBeenLastCalledWith(2, 1, {
      nomLibre: "Jurée X",
      consentement: false,
    });
  });

  it("orga : aucune identité → erreur, rien taggué", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    const res = await addPhotoTagAction(idle, fd({ editionId: "1", photoId: "2" }));
    expect(res.status).toBe("error");
    expect(addPhotoTag).not.toHaveBeenCalled();
  });

  it("orga : cible hors édition (false) → erreur explicite", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(addPhotoTag).mockResolvedValue(false);
    const res = await addPhotoTagAction(
      idle,
      fd({ editionId: "1", photoId: "2", nomLibre: "X" }),
    );
    expect(res.status).toBe("error");
  });
});

describe("setPhotoTagConsentAction", () => {
  it("orga : bascule le consentement recueilli (à la volée)", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(setPhotoTagConsent).mockResolvedValue(true);
    const res = await setPhotoTagConsentAction(
      idle,
      fd({ editionId: "1", tagId: "7", consentement: "on" }),
    );
    expect(res.status).toBe("success");
    expect(setPhotoTagConsent).toHaveBeenCalledWith(7, 1, true);
  });

  it("orga : case décochée → false", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(setPhotoTagConsent).mockResolvedValue(true);
    await setPhotoTagConsentAction(idle, fd({ editionId: "1", tagId: "7" }));
    expect(setPhotoTagConsent).toHaveBeenCalledWith(7, 1, false);
  });
});

describe("removePhotoTagAction", () => {
  it("orga : retire un tag, scopé", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(removePhotoTag).mockResolvedValue(true);
    const res = await removePhotoTagAction(idle, fd({ editionId: "1", tagId: "7" }));
    expect(res.status).toBe("success");
    expect(removePhotoTag).toHaveBeenCalledWith(7, 1);
  });
});

describe("updatePhotoAction", () => {
  it("orga : met à jour légende + moment (scopé)", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(updatePhoto).mockResolvedValue(true);
    const res = await updatePhotoAction(
      idle,
      fd({ editionId: "1", photoId: "2", legende: "Le podium", kind: "podium" }),
    );
    expect(res.status).toBe("success");
    expect(updatePhoto).toHaveBeenCalledWith(2, 1, { legende: "Le podium", kind: "podium" });
  });

  it("orga : moment inconnu → erreur", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    const res = await updatePhotoAction(
      idle,
      fd({ editionId: "1", photoId: "2", legende: "x", kind: "n_importe" }),
    );
    expect(res.status).toBe("error");
    expect(updatePhoto).not.toHaveBeenCalled();
  });
});

describe("deletePhotoFromFicheAction (PRG)", () => {
  it("orga : supprime puis redirige vers le tableau de bord", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(deletePhoto).mockResolvedValue(true);
    await expect(
      deletePhotoFromFicheAction(fd({ editionId: "1", photoId: "2" })),
    ).rejects.toThrow("REDIRECT:/admin/tremplins/1?ok=photo_supprimee");
    expect(deletePhoto).toHaveBeenCalledWith(2, 1);
  });

  it("orga : id hors édition (false) → redirection d'erreur", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(deletePhoto).mockResolvedValue(false);
    await expect(
      deletePhotoFromFicheAction(fd({ editionId: "1", photoId: "2" })),
    ).rejects.toThrow("REDIRECT:/admin/tremplins/1?err=photo");
  });
});
