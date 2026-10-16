import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth-guards", () => ({ requireUserId: vi.fn() }));
vi.mock("@/lib/tremplin-registrations", () => ({
  setOwnRegistrationVisibility: vi.fn(),
  setOwnRegistrationTalk: vi.fn(),
}));
vi.mock("@/lib/profiles", () => ({ ensureProfileId: vi.fn() }));
vi.mock("@/lib/talks", () => ({ getTalkById: vi.fn() }));
vi.mock("@/lib/tremplin-ateliers", () => ({ setSousGroupeFaitLeCommeMembre: vi.fn() }));

import { requireUserId } from "@/lib/auth-guards";
import {
  setOwnRegistrationVisibility,
  setOwnRegistrationTalk,
} from "@/lib/tremplin-registrations";
import { ensureProfileId } from "@/lib/profiles";
import { getTalkById } from "@/lib/talks";
import { setSousGroupeFaitLeCommeMembre } from "@/lib/tremplin-ateliers";
import {
  setMaVisibiliteAction,
  setOwnPitchedTalkAction,
  setMonSousGroupeFaitLeAction,
} from "@/app/mon-espace/tremplin/actions";
import { fd } from "./test-helpers";

const idle = { status: "idle" as const };

beforeEach(() => vi.clearAllMocks());

describe("setMaVisibiliteAction (consentement self-service)", () => {
  it("non connectée : la garde jette (rien écrit)", async () => {
    vi.mocked(requireUserId).mockRejectedValue(new Error("REDIRECT:/connexion"));
    await expect(
      setMaVisibiliteAction(idle, fd({ editionId: "1", public: "true" })),
    ).rejects.toThrow("REDIRECT:/connexion");
    expect(setOwnRegistrationVisibility).not.toHaveBeenCalled();
  });

  it("connectée : bascule SA visibilité (l'identité vient de la session, pas du formulaire)", async () => {
    vi.mocked(requireUserId).mockResolvedValue(42);
    vi.mocked(setOwnRegistrationVisibility).mockResolvedValue(true);
    const res = await setMaVisibiliteAction(
      idle,
      // un `userId` glissé dans le formulaire est IGNORÉ
      fd({ editionId: "1", public: "true", userId: "999" }),
    );
    expect(res.status).toBe("success");
    expect(setOwnRegistrationVisibility).toHaveBeenCalledWith(42, 1, true);
  });

  it("connectée : `public` strict — tout sauf \"true\" masque", async () => {
    vi.mocked(requireUserId).mockResolvedValue(42);
    vi.mocked(setOwnRegistrationVisibility).mockResolvedValue(true);
    await setMaVisibiliteAction(idle, fd({ editionId: "1", public: "TRUE" }));
    expect(setOwnRegistrationVisibility).toHaveBeenCalledWith(42, 1, false);
  });

  it("pas inscrite à cette édition (0 ligne) : état d'erreur", async () => {
    vi.mocked(requireUserId).mockResolvedValue(42);
    vi.mocked(setOwnRegistrationVisibility).mockResolvedValue(false);
    const res = await setMaVisibiliteAction(idle, fd({ editionId: "1", public: "true" }));
    expect(res.status).toBe("error");
  });

  it("editionId invalide : état d'erreur, rien écrit", async () => {
    vi.mocked(requireUserId).mockResolvedValue(42);
    const res = await setMaVisibiliteAction(idle, fd({ editionId: "0", public: "true" }));
    expect(res.status).toBe("error");
    expect(setOwnRegistrationVisibility).not.toHaveBeenCalled();
  });
});

describe("setOwnPitchedTalkAction (talk pitché self-service)", () => {
  it("non connectée : la garde jette (rien écrit)", async () => {
    vi.mocked(requireUserId).mockRejectedValue(new Error("REDIRECT:/connexion"));
    await expect(
      setOwnPitchedTalkAction(idle, fd({ editionId: "1", talkId: "5" })),
    ).rejects.toThrow("REDIRECT:/connexion");
    expect(setOwnRegistrationTalk).not.toHaveBeenCalled();
  });

  it("connectée : désigne SON talk (ownership vérifié via son profil, identité de la session)", async () => {
    vi.mocked(requireUserId).mockResolvedValue(42);
    vi.mocked(ensureProfileId).mockResolvedValue(7);
    vi.mocked(getTalkById).mockResolvedValue({ id: 5 } as never);
    vi.mocked(setOwnRegistrationTalk).mockResolvedValue(true);
    const res = await setOwnPitchedTalkAction(
      idle,
      // un `registrationId` glissé dans le formulaire est IGNORÉ (anti-IDOR)
      fd({ editionId: "1", talkId: "5", registrationId: "999", userId: "999" }),
    );
    expect(res.status).toBe("success");
    // ownership : c'est SON profil (dérivé de la session) qui est interrogé
    expect(ensureProfileId).toHaveBeenCalledWith(42);
    expect(getTalkById).toHaveBeenCalledWith(5, 7);
    expect(setOwnRegistrationTalk).toHaveBeenCalledWith(42, 1, 5);
  });

  it("talk d'une autre (ownership refusé) : erreur, rien écrit", async () => {
    vi.mocked(requireUserId).mockResolvedValue(42);
    vi.mocked(ensureProfileId).mockResolvedValue(7);
    vi.mocked(getTalkById).mockResolvedValue(null); // pas dans SON répertoire
    const res = await setOwnPitchedTalkAction(idle, fd({ editionId: "1", talkId: "5" }));
    expect(res.status).toBe("error");
    expect(setOwnRegistrationTalk).not.toHaveBeenCalled();
  });

  it("option « Aucun » (talkId vide) : retire le talk sans vérifier d'ownership", async () => {
    vi.mocked(requireUserId).mockResolvedValue(42);
    vi.mocked(setOwnRegistrationTalk).mockResolvedValue(true);
    const res = await setOwnPitchedTalkAction(idle, fd({ editionId: "1", talkId: "" }));
    expect(res.status).toBe("success");
    expect(getTalkById).not.toHaveBeenCalled();
    expect(setOwnRegistrationTalk).toHaveBeenCalledWith(42, 1, null);
  });

  it("talkId non entier : erreur, rien écrit", async () => {
    vi.mocked(requireUserId).mockResolvedValue(42);
    const res = await setOwnPitchedTalkAction(idle, fd({ editionId: "1", talkId: "abc" }));
    expect(res.status).toBe("error");
    expect(setOwnRegistrationTalk).not.toHaveBeenCalled();
  });

  it("editionId invalide : erreur, rien écrit", async () => {
    vi.mocked(requireUserId).mockResolvedValue(42);
    const res = await setOwnPitchedTalkAction(idle, fd({ editionId: "0", talkId: "5" }));
    expect(res.status).toBe("error");
    expect(setOwnRegistrationTalk).not.toHaveBeenCalled();
  });

  it("pas inscrite à cette édition (0 ligne) : erreur", async () => {
    vi.mocked(requireUserId).mockResolvedValue(42);
    vi.mocked(ensureProfileId).mockResolvedValue(7);
    vi.mocked(getTalkById).mockResolvedValue({ id: 5 } as never);
    vi.mocked(setOwnRegistrationTalk).mockResolvedValue(false);
    const res = await setOwnPitchedTalkAction(idle, fd({ editionId: "1", talkId: "5" }));
    expect(res.status).toBe("error");
  });
});

describe("setMonSousGroupeFaitLeAction (réalisation self-service)", () => {
  it("non connectée : la garde jette (rien écrit)", async () => {
    vi.mocked(requireUserId).mockRejectedValue(new Error("REDIRECT:/connexion"));
    await expect(
      setMonSousGroupeFaitLeAction(idle, fd({ editionId: "1", sousGroupeId: "7", faitLe: "2026-09-16" })),
    ).rejects.toThrow("REDIRECT:/connexion");
    expect(setSousGroupeFaitLeCommeMembre).not.toHaveBeenCalled();
  });

  it("connectée : pose la date de SON sous-groupe (identité de la session, pas du formulaire)", async () => {
    vi.mocked(requireUserId).mockResolvedValue(42);
    vi.mocked(setSousGroupeFaitLeCommeMembre).mockResolvedValue(true);
    const res = await setMonSousGroupeFaitLeAction(
      idle,
      // un `userId` glissé dans le formulaire est IGNORÉ (anti-IDOR)
      fd({ editionId: "1", sousGroupeId: "7", faitLe: "2026-09-16", userId: "999" }),
    );
    expect(res.status).toBe("success");
    expect(setSousGroupeFaitLeCommeMembre).toHaveBeenCalledWith(7, 42, "2026-09-16");
  });

  it("« pas encore fait » (date vide) → null", async () => {
    vi.mocked(requireUserId).mockResolvedValue(42);
    vi.mocked(setSousGroupeFaitLeCommeMembre).mockResolvedValue(true);
    await setMonSousGroupeFaitLeAction(idle, fd({ editionId: "1", sousGroupeId: "7", faitLe: "" }));
    expect(setSousGroupeFaitLeCommeMembre).toHaveBeenCalledWith(7, 42, null);
  });

  it("date mal formée : erreur, rien écrit", async () => {
    vi.mocked(requireUserId).mockResolvedValue(42);
    const res = await setMonSousGroupeFaitLeAction(idle, fd({ editionId: "1", sousGroupeId: "7", faitLe: "16-09-2026" }));
    expect(res.status).toBe("error");
    expect(setSousGroupeFaitLeCommeMembre).not.toHaveBeenCalled();
  });

  it("pas membre du sous-groupe (0 ligne) : erreur (anti-IDOR)", async () => {
    vi.mocked(requireUserId).mockResolvedValue(42);
    vi.mocked(setSousGroupeFaitLeCommeMembre).mockResolvedValue(false);
    const res = await setMonSousGroupeFaitLeAction(idle, fd({ editionId: "1", sousGroupeId: "7", faitLe: "2026-09-16" }));
    expect(res.status).toBe("error");
  });

  it("sousGroupeId invalide : erreur, rien écrit", async () => {
    vi.mocked(requireUserId).mockResolvedValue(42);
    const res = await setMonSousGroupeFaitLeAction(idle, fd({ editionId: "1", sousGroupeId: "0", faitLe: "2026-09-16" }));
    expect(res.status).toBe("error");
    expect(setSousGroupeFaitLeCommeMembre).not.toHaveBeenCalled();
  });
});
