import { describe, it, expect, vi, beforeEach } from "vitest";

// Redirige en levant une sentinelle, comme Auth.js/Next (stoppe l'exécution).
vi.mock("next/navigation", () => ({
  redirect: vi.fn((p: string) => {
    throw new Error(`REDIRECT:${p}`);
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/profiles", () => ({
  getProfilesEnSommeil: vi.fn(async () => []),
  getFicheARelancer: vi.fn(async () => null),
  markRemindersSent: vi.fn(),
}));
vi.mock("@/lib/reglages", () => ({
  getReglages: vi.fn(async () => ({ relance_brouillon_jours: 30 })),
}));
vi.mock("@/lib/magic-link", () => ({ isMagicLinkEnabled: vi.fn(() => true) }));
vi.mock("@/lib/email", () => ({ sendBrevoEmail: vi.fn() }));

import { auth } from "@/auth";
import {
  getProfilesEnSommeil,
  getFicheARelancer,
  markRemindersSent,
  type FicheEnSommeil,
} from "@/lib/profiles";
import { isMagicLinkEnabled } from "@/lib/magic-link";
import { sendBrevoEmail } from "@/lib/email";
import {
  relancerLotAction,
  relancerFicheAction,
} from "@/app/admin/speakeuses/relances/actions";
import { IDLE } from "@/lib/action-state";
import { fd } from "./test-helpers";

/** Une fiche en sommeil minimale, telle que la lib la rend. */
function fiche(id: number, nom: string, email: string): FicheEnSommeil {
  return {
    profile: {
      id,
      name: nom,
      status: "brouillon",
      titreProfil: null,
      bio: null,
      linkedin: null,
      contactEmailOk: false,
      isWoman: false,
      secteurs: [],
      sujets: [],
    } as unknown as FicheEnSommeil["profile"],
    email,
    talksCount: 0,
    lastReminderAt: null,
  };
}

const orga = { user: { id: "1", isOrga: true } } as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue(orga);
  vi.mocked(isMagicLinkEnabled).mockReturnValue(true);
  vi.mocked(getProfilesEnSommeil).mockResolvedValue([]);
  vi.mocked(getFicheARelancer).mockResolvedValue(null);
  vi.mocked(sendBrevoEmail).mockResolvedValue(undefined);
});

describe("relancerLotAction — autorisation", () => {
  it("refuse une membre connectée sans rôle orga (aucun envoi)", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "2", isOrga: false } } as never);
    await expect(relancerLotAction()).rejects.toThrow("REDIRECT:/connexion");
    expect(getProfilesEnSommeil).not.toHaveBeenCalled();
    expect(sendBrevoEmail).not.toHaveBeenCalled();
  });

  it("refuse une visiteuse (aucun envoi)", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    await expect(relancerLotAction()).rejects.toThrow("REDIRECT:/connexion");
    expect(sendBrevoEmail).not.toHaveBeenCalled();
  });
});

describe("relancerLotAction — envoi", () => {
  it("écrit à chaque fiche du lot et les marque relancées", async () => {
    vi.mocked(getProfilesEnSommeil).mockResolvedValue([
      fiche(1, "Ada", "ada@test.fr"),
      fiche(2, "Grace", "grace@test.fr"),
    ]);
    await expect(relancerLotAction()).rejects.toThrow(/envoyees=2/);
    expect(sendBrevoEmail).toHaveBeenCalledTimes(2);
    expect(vi.mocked(sendBrevoEmail).mock.calls[0][0].to).toBe("ada@test.fr");
    // Marquée une par une, dans la foulée de son propre envoi : une coupure en
    // cours de lot laisse une trace exacte de ce qui est parti.
    expect(vi.mocked(markRemindersSent).mock.calls).toEqual([[[1]], [[2]]]);
  });

  it("laisse relançable celle dont l'envoi a échoué (le lot continue)", async () => {
    vi.mocked(getProfilesEnSommeil).mockResolvedValue([
      fiche(1, "Ada", "ada@test.fr"),
      fiche(2, "Grace", "grace@test.fr"),
    ]);
    vi.mocked(sendBrevoEmail).mockRejectedValueOnce(new Error("Brevo 401"));
    await expect(relancerLotAction()).rejects.toThrow(/echecs=1/);
    // Marquer un échec effacerait la personne du lot SANS qu'elle ait rien reçu.
    expect(vi.mocked(markRemindersSent).mock.calls).toEqual([[[2]]]);
  });

  it("remonte la raison du premier échec (sinon la panne est muette)", async () => {
    vi.mocked(getProfilesEnSommeil).mockResolvedValue([fiche(1, "Ada", "a@test.fr")]);
    vi.mocked(sendBrevoEmail).mockRejectedValue(new Error("Brevo 401"));
    await expect(relancerLotAction()).rejects.toThrow(/err=Brevo/);
  });

  it("s'arrête net si l'envoi d'e-mails est indisponible", async () => {
    vi.mocked(isMagicLinkEnabled).mockReturnValue(false);
    await expect(relancerLotAction()).rejects.toThrow(/envoi=indisponible/);
    expect(getProfilesEnSommeil).not.toHaveBeenCalled();
  });
});

describe("relancerFicheAction — le geste depuis la fiche", () => {
  it("refuse une non-orga (aucun envoi)", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "2", isOrga: false } } as never);
    await expect(
      relancerFicheAction(IDLE, fd({ profileId: "7" })),
    ).rejects.toThrow("REDIRECT:/connexion");
    expect(sendBrevoEmail).not.toHaveBeenCalled();
  });

  it("écrit à la speakeuse et la marque relancée", async () => {
    vi.mocked(getFicheARelancer).mockResolvedValue(fiche(7, "Ada Lovelace", "ada@test.fr"));
    const etat = await relancerFicheAction(IDLE, fd({ profileId: "7" }));
    expect(etat.status).toBe("success");
    expect(vi.mocked(sendBrevoEmail).mock.calls[0][0].to).toBe("ada@test.fr");
    expect(markRemindersSent).toHaveBeenCalledWith([7]);
    // Le retour NOMME la personne (principes UI § 5).
    if (etat.status === "success") expect(etat.message).toContain("Ada");
  });

  it("refuse d'envoyer quand la base dit que la fiche est hors relance", async () => {
    // C'est la BASE qui tranche, jamais l'écran : le bouton peut rester affiché
    // sur un onglet ouvert depuis une heure.
    vi.mocked(getFicheARelancer).mockResolvedValue(null);
    const etat = await relancerFicheAction(IDLE, fd({ profileId: "7" }));
    expect(sendBrevoEmail).not.toHaveBeenCalled();
    expect(markRemindersSent).not.toHaveBeenCalled();
    // On juge le MOTIF, pas seulement le statut : sans la garde, l'action part
    // sur une fiche absente, plante, et rend elle aussi un « error » — un refus
    // et un plantage se ressembleraient, et le test resterait vert (mesuré).
    expect(etat.status).toBe("error");
    if (etat.status === "error") expect(etat.error).toMatch(/Rafraîchis la page/);
  });

  it("laisse la fiche relançable quand l'envoi échoue", async () => {
    vi.mocked(getFicheARelancer).mockResolvedValue(fiche(7, "Ada", "ada@test.fr"));
    vi.mocked(sendBrevoEmail).mockRejectedValue(new Error("Brevo 401"));
    const etat = await relancerFicheAction(IDLE, fd({ profileId: "7" }));
    expect(etat.status).toBe("error");
    expect(markRemindersSent).not.toHaveBeenCalled();
  });

  it("refuse un identifiant de fiche illisible, vide ou décimal", async () => {
    // « abc » → NaN, champ absent → 0, « 7.5 » → décimal : les trois font
    // échouer Postgres si on les laisse passer, au lieu de rendre ce message.
    for (const profileId of ["abc", "", "0", "7.5", "-3"]) {
      const etat = await relancerFicheAction(IDLE, fd({ profileId }));
      expect(etat.status, `profileId=${profileId}`).toBe("error");
    }
    expect(getFicheARelancer).not.toHaveBeenCalled();
  });

  it("dit que l'envoi est indisponible plutôt que d'échouer en silence", async () => {
    vi.mocked(isMagicLinkEnabled).mockReturnValue(false);
    const etat = await relancerFicheAction(IDLE, fd({ profileId: "7" }));
    expect(etat.status).toBe("error");
    expect(getFicheARelancer).not.toHaveBeenCalled();
  });
});
