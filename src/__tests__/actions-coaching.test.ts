import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth-guards", () => ({ requireCoachId: vi.fn() }));
vi.mock("@/lib/tremplin-coachs", () => ({
  addDocumentAsCoach: vi.fn(),
  deleteOwnDocument: vi.fn(),
}));

import { requireCoachId } from "@/lib/auth-guards";
import { addDocumentAsCoach, deleteOwnDocument } from "@/lib/tremplin-coachs";
import {
  addCoachDocumentAction,
  deleteOwnDocumentAction,
} from "@/app/mon-espace/coaching/actions";
import { fd } from "./test-helpers";

const idle = { status: "idle" as const };

beforeEach(() => vi.clearAllMocks());

describe("addCoachDocumentAction (dépôt par un coach)", () => {
  it("sans profil coach : la garde jette, rien écrit", async () => {
    vi.mocked(requireCoachId).mockRejectedValue(new Error("REDIRECT:/connexion"));
    await expect(
      addCoachDocumentAction(
        idle,
        fd({ editionId: "1", portee: "atelier", atelierId: "3", titre: "Slides", lien: "https://x.fr" }),
      ),
    ).rejects.toThrow("REDIRECT:/connexion");
    expect(addDocumentAsCoach).not.toHaveBeenCalled();
  });

  it("coach : dépose pour SON atelier (auteur = session, jamais le formulaire)", async () => {
    vi.mocked(requireCoachId).mockResolvedValue(42);
    vi.mocked(addDocumentAsCoach).mockResolvedValue(true);
    const res = await addCoachDocumentAction(
      idle,
      fd({
        editionId: "1",
        portee: "atelier",
        atelierId: "3",
        titre: "Slides",
        lien: "https://x.fr",
        auteurId: "999", // ignoré
      }),
    );
    expect(res.status).toBe("success");
    expect(addDocumentAsCoach).toHaveBeenCalledWith(42, 1, {
      type: "autre",
      titre: "Slides",
      lien: "https://x.fr",
      contenu: null,
      atelierId: 3,
      registrationId: null,
    });
  });

  it("coach : dépose pour SA coachée (portée participante)", async () => {
    vi.mocked(requireCoachId).mockResolvedValue(42);
    vi.mocked(addDocumentAsCoach).mockResolvedValue(true);
    const res = await addCoachDocumentAction(
      idle,
      fd({
        editionId: "1",
        portee: "participante",
        registrationId: "7",
        type: "note",
        titre: "Points de travail",
        contenu: "Débit + chute",
      }),
    );
    expect(res.status).toBe("success");
    expect(vi.mocked(addDocumentAsCoach).mock.calls[0][2].registrationId).toBe(7);
  });

  it("portée générale refusée pour un coach (réservée orga)", async () => {
    vi.mocked(requireCoachId).mockResolvedValue(42);
    const res = await addCoachDocumentAction(
      idle,
      fd({ editionId: "1", portee: "generale", titre: "Doc", lien: "https://x.fr" }),
    );
    expect(res.status).toBe("error");
    expect(addDocumentAsCoach).not.toHaveBeenCalled();
  });

  it("cible qui n'est pas à lui (lib → false) : erreur explicite", async () => {
    vi.mocked(requireCoachId).mockResolvedValue(42);
    vi.mocked(addDocumentAsCoach).mockResolvedValue(false);
    const res = await addCoachDocumentAction(
      idle,
      fd({ editionId: "1", portee: "atelier", atelierId: "999", titre: "Slides", lien: "https://x.fr" }),
    );
    expect(res.status).toBe("error");
    if (res.status === "error") expect(res.error).toMatch(/tes ateliers et tes coachées/);
  });
});

describe("deleteOwnDocumentAction", () => {
  it("coach : supprime SON dépôt ; celui d'un autre → erreur", async () => {
    vi.mocked(requireCoachId).mockResolvedValue(42);
    vi.mocked(deleteOwnDocument).mockResolvedValue(true);
    const ok = await deleteOwnDocumentAction(idle, fd({ editionId: "1", documentId: "5" }));
    expect(ok.status).toBe("success");
    expect(deleteOwnDocument).toHaveBeenCalledWith(42, 5, 1);

    vi.mocked(deleteOwnDocument).mockResolvedValue(false);
    const ko = await deleteOwnDocumentAction(idle, fd({ editionId: "1", documentId: "5" }));
    expect(ko.status).toBe("error");
  });
});
