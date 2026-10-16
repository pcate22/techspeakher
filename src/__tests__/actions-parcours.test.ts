import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((p: string) => {
    throw new Error(`REDIRECT:${p}`);
  }),
}));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/users", () => ({ getOrCreateUserByEmail: vi.fn(), getUserById: vi.fn() }));
vi.mock("@/lib/magic-link", () => ({ isMagicLinkEnabled: vi.fn(() => false) }));
vi.mock("@/lib/tremplin-email", () => ({ sendEditionInviteEmail: vi.fn() }));
vi.mock("@/lib/tremplin-editions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tremplin-editions")>()),
  getEditionById: vi.fn(),
}));
vi.mock("@/lib/tremplin-registrations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tremplin-registrations")>()),
  registerUserToEdition: vi.fn(),
  setRegistrationPhase: vi.fn(),
}));
vi.mock("@/lib/tremplin-ateliers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tremplin-ateliers")>()),
  setAtelierPresences: vi.fn(),
}));

import { auth } from "@/auth";
import { getUserById } from "@/lib/users";
import { getEditionById } from "@/lib/tremplin-editions";
import {
  registerUserToEdition,
  setRegistrationPhase,
} from "@/lib/tremplin-registrations";
import { setAtelierPresences } from "@/lib/tremplin-ateliers";
import { sendEditionInviteEmail } from "@/lib/tremplin-email";
import {
  addParticipanteAction,
  setRegistrationPhaseAction,
  setAtelierPresencesAction,
} from "@/app/admin/tremplins/actions";
import { fd } from "./test-helpers";

const idle = { status: "idle" as const };
const orga = { user: { id: "1", isOrga: true } } as never;
const membre = { user: { id: "2", isOrga: false } } as never;

beforeEach(() => vi.clearAllMocks());

describe("phase d'entrée pré-remplie à l'ajout d'une participante", () => {
  it("finale passée → l'ajout inscrit en phase 3 (montée sur scène)", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(getEditionById).mockResolvedValue({
      id: 1,
      nom: "Tremplin 2026",
      finaleDate: "2026-03-12", // passée (aujourd'hui : juillet 2026)
    } as never);
    vi.mocked(getUserById).mockResolvedValue({ id: 42, name: "X", email: "a@b.fr" });
    vi.mocked(registerUserToEdition).mockResolvedValue("inscrite");
    vi.mocked(sendEditionInviteEmail).mockResolvedValue(false);

    await addParticipanteAction(idle, fd({ editionId: "1", compteId: "42" }));
    expect(registerUserToEdition).toHaveBeenCalledWith(1, 42, "montee_sur_scene");
  });

  it("finale à venir (ou sans date) → phase 1 (CFP et pitch)", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(getEditionById).mockResolvedValue({
      id: 1,
      nom: "Tremplin 2027",
      finaleDate: "2099-01-01",
    } as never);
    vi.mocked(getUserById).mockResolvedValue({ id: 42, name: "X", email: "a@b.fr" });
    vi.mocked(registerUserToEdition).mockResolvedValue("inscrite");
    vi.mocked(sendEditionInviteEmail).mockResolvedValue(false);

    await addParticipanteAction(idle, fd({ editionId: "1", compteId: "42" }));
    expect(registerUserToEdition).toHaveBeenCalledWith(1, 42, "cfp_et_pitch");
  });
});

describe("setRegistrationPhaseAction", () => {
  it("refuse une non-orga", async () => {
    vi.mocked(auth).mockResolvedValue(membre);
    await expect(
      setRegistrationPhaseAction(
        idle,
        fd({ editionId: "1", registrationId: "5", phase: "finale" }),
      ),
    ).rejects.toThrow("REDIRECT:/connexion");
    expect(setRegistrationPhase).not.toHaveBeenCalled();
  });

  it("orga : change la phase (scopé) ; phase inconnue refusée", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(setRegistrationPhase).mockResolvedValue(true);
    const ok = await setRegistrationPhaseAction(
      idle,
      fd({ editionId: "1", registrationId: "5", phase: "montee_sur_scene" }),
    );
    expect(ok.status).toBe("success");
    expect(setRegistrationPhase).toHaveBeenCalledWith(5, 1, "montee_sur_scene");

    const ko = await setRegistrationPhaseAction(
      idle,
      fd({ editionId: "1", registrationId: "5", phase: "phase9" }),
    );
    expect(ko.status).toBe("error");
    expect(setRegistrationPhase).toHaveBeenCalledTimes(1);
  });
});

describe("setAtelierPresencesAction", () => {
  it("refuse une non-orga", async () => {
    vi.mocked(auth).mockResolvedValue(membre);
    await expect(
      setAtelierPresencesAction(idle, fd({ editionId: "1", atelierId: "3" })),
    ).rejects.toThrow("REDIRECT:/connexion");
  });

  it("orga : pointe les présences depuis les champs presence_<id>", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(setAtelierPresences).mockResolvedValue(true);
    const res = await setAtelierPresencesAction(
      idle,
      fd({
        editionId: "1",
        atelierId: "3",
        presence_5: "presente",
        presence_6: "absente",
        presence_7: "non_renseignee",
      }),
    );
    expect(res.status).toBe("success");
    expect(setAtelierPresences).toHaveBeenCalledWith(3, 1, [
      { registrationId: 5, presence: "presente" },
      { registrationId: 6, presence: "absente" },
      { registrationId: 7, presence: "non_renseignee" },
    ]);
  });

  it("orga : une valeur de présence inconnue est refusée, rien n'est écrit", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    const res = await setAtelierPresencesAction(
      idle,
      fd({ editionId: "1", atelierId: "3", presence_5: "peut_etre" }),
    );
    expect(res.status).toBe("error");
    expect(setAtelierPresences).not.toHaveBeenCalled();
  });

  it("orga : atelier hors édition (false) → erreur explicite", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(setAtelierPresences).mockResolvedValue(false);
    const res = await setAtelierPresencesAction(
      idle,
      fd({ editionId: "1", atelierId: "999", presence_5: "presente" }),
    );
    expect(res.status).toBe("error");
  });
});
