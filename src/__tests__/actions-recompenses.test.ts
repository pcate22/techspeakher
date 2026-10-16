import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((p: string) => {
    throw new Error(`REDIRECT:${p}`);
  }),
}));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/tremplin-recompenses", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tremplin-recompenses")>()),
  addRecompense: vi.fn(),
  updateRecompense: vi.fn(),
  deleteRecompense: vi.fn(),
  setRecompenseBeneficiaire: vi.fn(),
  setRecompenseSuivi: vi.fn(),
}));

import { auth } from "@/auth";
import {
  addRecompense,
  updateRecompense,
  deleteRecompense,
  setRecompenseBeneficiaire,
  setRecompenseSuivi,
} from "@/lib/tremplin-recompenses";
import {
  addRecompenseAction,
  updateRecompenseAction,
  setRecompenseBeneficiaireAction,
  setRecompenseSuiviAction,
  deleteRecompenseAction,
} from "@/app/admin/tremplins/actions";
import { fd } from "./test-helpers";

const idle = { status: "idle" as const };
const orga = { user: { id: "1", isOrga: true } } as never;
const membre = { user: { id: "2", isOrga: false } } as never;

beforeEach(() => vi.clearAllMocks());

describe("addRecompenseAction", () => {
  it("refuse une non-orga", async () => {
    vi.mocked(auth).mockResolvedValue(membre);
    await expect(
      addRecompenseAction(idle, fd({ editionId: "1", intitule: "Un talk en meetup" })),
    ).rejects.toThrow("REDIRECT:/connexion");
    expect(addRecompense).not.toHaveBeenCalled();
  });

  it("orga : crée avec intitulé, détail et rang facultatifs", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(addRecompense).mockResolvedValue(12);
    const res = await addRecompenseAction(
      idle,
      fd({
        editionId: "1",
        intitule: "  Une présentation au DevFest Toulouse  ",
        detail: "Salle communauté",
        rang: "1",
      }),
    );
    expect(res.status).toBe("success");
    expect(addRecompense).toHaveBeenCalledWith(1, {
      intitule: "Une présentation au DevFest Toulouse",
      detail: "Salle communauté",
      rang: 1,
    });
  });

  it("orga : sans rang ni détail → null (pas 0, pas de chaîne vide)", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(addRecompense).mockResolvedValue(13);
    const res = await addRecompenseAction(
      idle,
      fd({ editionId: "1", intitule: "Un talk en meetup", detail: "", rang: "" }),
    );
    expect(res.status).toBe("success");
    expect(addRecompense).toHaveBeenCalledWith(1, {
      intitule: "Un talk en meetup",
      detail: null,
      rang: null,
    });
  });

  it("orga : intitulé vide ou rang invalide → erreur, rien n'est créé", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    const vide = await addRecompenseAction(idle, fd({ editionId: "1", intitule: "  " }));
    expect(vide.status).toBe("error");
    const rang = await addRecompenseAction(
      idle,
      fd({ editionId: "1", intitule: "Lot", rang: "-2" }),
    );
    expect(rang.status).toBe("error");
    expect(addRecompense).not.toHaveBeenCalled();
  });
});

describe("updateRecompenseAction", () => {
  it("orga : met à jour, scopé à l'édition (false → erreur explicite)", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(updateRecompense).mockResolvedValue(false);
    const res = await updateRecompenseAction(
      idle,
      fd({ editionId: "1", recompenseId: "12", intitule: "Lot", detail: "", rang: "" }),
    );
    expect(res.status).toBe("error");
    expect(updateRecompense).toHaveBeenCalledWith(12, 1, {
      intitule: "Lot",
      detail: null,
      rang: null,
    });
  });
});

describe("setRecompenseBeneficiaireAction", () => {
  it("refuse une non-orga", async () => {
    vi.mocked(auth).mockResolvedValue(membre);
    await expect(
      setRecompenseBeneficiaireAction(
        idle,
        fd({ editionId: "1", recompenseId: "12", registrationId: "5" }),
      ),
    ).rejects.toThrow("REDIRECT:/connexion");
    expect(setRecompenseBeneficiaire).not.toHaveBeenCalled();
  });

  it("orga : attribue avec motif ; registrationId vide = retrait (null)", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(setRecompenseBeneficiaire).mockResolvedValue(true);

    const attribue = await setRecompenseBeneficiaireAction(
      idle,
      fd({
        editionId: "1",
        recompenseId: "12",
        registrationId: "5",
        motif: "1ʳᵉ déjà retenue via le CFP",
      }),
    );
    expect(attribue.status).toBe("success");
    expect(setRecompenseBeneficiaire).toHaveBeenCalledWith(
      12,
      1,
      5,
      "1ʳᵉ déjà retenue via le CFP",
      null, // pas de raison de transfert publique fournie
    );

    const retire = await setRecompenseBeneficiaireAction(
      idle,
      fd({ editionId: "1", recompenseId: "12", registrationId: "", motif: "" }),
    );
    expect(retire.status).toBe("success");
    expect(setRecompenseBeneficiaire).toHaveBeenLastCalledWith(12, 1, null, null, null);
  });

  it("orga : transmet la raison de transfert PUBLIQUE (énumérée) si valide", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(setRecompenseBeneficiaire).mockResolvedValue(true);
    await setRecompenseBeneficiaireAction(
      idle,
      fd({ editionId: "1", recompenseId: "12", registrationId: "5", transfertRaison: "cfp_officiel" }),
    );
    expect(setRecompenseBeneficiaire).toHaveBeenCalledWith(12, 1, 5, null, "cfp_officiel");
  });

  it("orga : raison de transfert inconnue → ignorée (null), pas d'erreur", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(setRecompenseBeneficiaire).mockResolvedValue(true);
    await setRecompenseBeneficiaireAction(
      idle,
      fd({ editionId: "1", recompenseId: "12", registrationId: "5", transfertRaison: "n_importe_quoi" }),
    );
    expect(setRecompenseBeneficiaire).toHaveBeenLastCalledWith(12, 1, 5, null, null);
  });

  it("orga : inscription d'une autre édition (false) → erreur explicite", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(setRecompenseBeneficiaire).mockResolvedValue(false);
    const res = await setRecompenseBeneficiaireAction(
      idle,
      fd({ editionId: "1", recompenseId: "12", registrationId: "999" }),
    );
    expect(res.status).toBe("error");
  });
});

describe("setRecompenseSuiviAction", () => {
  it("orga : statut valide + date facultative", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(setRecompenseSuivi).mockResolvedValue(true);
    const res = await setRecompenseSuiviAction(
      idle,
      fd({ editionId: "1", recompenseId: "12", statut: "planifiee", evenementLe: "2026-09-10" }),
    );
    expect(res.status).toBe("success");
    expect(setRecompenseSuivi).toHaveBeenCalledWith(12, 1, "planifiee", "2026-09-10");
  });

  it("orga : statut inconnu → erreur, rien n'est écrit", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    const res = await setRecompenseSuiviAction(
      idle,
      fd({ editionId: "1", recompenseId: "12", statut: "perdu" }),
    );
    expect(res.status).toBe("error");
    expect(setRecompenseSuivi).not.toHaveBeenCalled();
  });

  it("orga : date hors calendrier (2026-02-31) → erreur inline, pas de crash Postgres", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    for (const evenementLe of ["2026-02-31", "2026-13-01", "31/12/2026"]) {
      const res = await setRecompenseSuiviAction(
        idle,
        fd({ editionId: "1", recompenseId: "12", statut: "planifiee", evenementLe }),
      );
      expect(res.status).toBe("error");
    }
    expect(setRecompenseSuivi).not.toHaveBeenCalled();
  });
});

describe("deleteRecompenseAction (PRG, depuis la fiche)", () => {
  it("refuse une non-orga", async () => {
    vi.mocked(auth).mockResolvedValue(membre);
    await expect(
      deleteRecompenseAction(fd({ editionId: "1", recompenseId: "12" })),
    ).rejects.toThrow("REDIRECT:/connexion");
    expect(deleteRecompense).not.toHaveBeenCalled();
  });

  it("orga : supprime puis redirige vers le tableau de bord (ok)", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(deleteRecompense).mockResolvedValue(true);
    await expect(
      deleteRecompenseAction(fd({ editionId: "1", recompenseId: "12" })),
    ).rejects.toThrow("REDIRECT:/admin/tremplins/1?ok=recompense_supprimee");
    expect(deleteRecompense).toHaveBeenCalledWith(12, 1);
  });

  it("orga : id hors édition (false) → redirection d'erreur", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(deleteRecompense).mockResolvedValue(false);
    await expect(
      deleteRecompenseAction(fd({ editionId: "1", recompenseId: "12" })),
    ).rejects.toThrow("REDIRECT:/admin/tremplins/1?err=recompense");
  });
});
