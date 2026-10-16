import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((p: string) => {
    throw new Error(`REDIRECT:${p}`);
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/profiles", () => ({ setRappelCadence: vi.fn(async () => true) }));

import { auth } from "@/auth";
import { setRappelCadence } from "@/lib/profiles";
import { setCadenceRappelAction } from "@/app/mon-espace/reglages/actions";
import { IDLE } from "@/lib/action-state";
import { fd } from "./test-helpers";

const membre = { user: { id: "7" } } as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue(membre);
  vi.mocked(setRappelCadence).mockResolvedValue(true);
});

describe("setCadenceRappelAction — l'identité vient de la session", () => {
  it("refuse une visiteuse (aucune écriture)", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    await expect(
      setCadenceRappelAction(IDLE, fd({ cadence: "aucun" })),
    ).rejects.toThrow("REDIRECT:/connexion");
    expect(setRappelCadence).not.toHaveBeenCalled();
  });

  it("écrit sur le compte de la SESSION, jamais sur un id du formulaire", async () => {
    // Le champ « userId » est un leurre : s'il était lu, on réglerait la
    // préférence de quelqu'un d'autre depuis son propre navigateur.
    await setCadenceRappelAction(IDLE, fd({ cadence: "aucun", userId: "999" }));
    expect(setRappelCadence).toHaveBeenCalledWith(7, "aucun");
  });
});

describe("setCadenceRappelAction — ce qui est enregistré", () => {
  it("accepte les quatre cadences", async () => {
    for (const cadence of ["mensuel", "bimestriel", "semestriel", "aucun"]) {
      vi.clearAllMocks();
      const etat = await setCadenceRappelAction(IDLE, fd({ cadence }));
      expect(etat.status).toBe("success");
      expect(setRappelCadence).toHaveBeenCalledWith(7, cadence);
    }
  });

  it("traite le champ vide comme « laisse l'équipe décider »", async () => {
    const etat = await setCadenceRappelAction(IDLE, fd({ cadence: "" }));
    expect(etat.status).toBe("success");
    expect(setRappelCadence).toHaveBeenCalledWith(7, null);
  });

  it("ramène une valeur inconnue au défaut plutôt que de l'écrire", async () => {
    await setCadenceRappelAction(IDLE, fd({ cadence: "hebdomadaire" }));
    expect(setRappelCadence).toHaveBeenCalledWith(7, null);
  });

  it("rend la cadence retenue, pour que l'écran affiche l'état réel", async () => {
    const etat = await setCadenceRappelAction(IDLE, fd({ cadence: "semestriel" }));
    if (etat.status === "success") expect(etat.cadence).toBe("semestriel");
    else throw new Error("succès attendu");
  });

  it("dit qu'il n'y a rien à régler quand aucune fiche n'a bougé", async () => {
    // Sans fiche, l'UPDATE ne touche aucune ligne : annoncer « Choix
    // enregistré » ferait croire à un réglage qui n'existe pas.
    vi.mocked(setRappelCadence).mockResolvedValue(false);
    const etat = await setCadenceRappelAction(IDLE, fd({ cadence: "aucun" }));
    expect(etat.status).toBe("error");
    if (etat.status === "error") expect(etat.error).toMatch(/fiche speakeuse/i);
  });

  it("dit l'échec au lieu de laisser croire que c'est enregistré", async () => {
    vi.mocked(setRappelCadence).mockRejectedValue(new Error("base indisponible"));
    const etat = await setCadenceRappelAction(IDLE, fd({ cadence: "aucun" }));
    expect(etat.status).toBe("error");
  });
});
