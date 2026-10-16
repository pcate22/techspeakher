import { describe, it, expect, vi, beforeEach } from "vitest";

// Redirige en levant une sentinelle, comme Auth.js/Next (stoppe l'exécution).
vi.mock("next/navigation", () => ({
  redirect: vi.fn((p: string) => {
    throw new Error(`REDIRECT:${p}`);
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/profiles", () => ({
  setProfileStatus: vi.fn(),
  getSpeakeuseContact: vi.fn(),
  getProfilesToInvite: vi.fn(),
  markInvited: vi.fn(),
}));
vi.mock("@/lib/magic-link", () => ({ isMagicLinkEnabled: vi.fn(() => true) }));
vi.mock("@/lib/email", () => ({ sendBrevoEmail: vi.fn() }));
vi.mock("@/lib/moderation-email", () => ({
  buildModerationEmail: vi.fn(() => ({ subject: "s", textContent: "t" })),
}));
vi.mock("@/lib/invitation-email", () => ({
  buildInvitationEmail: vi.fn(() => ({ subject: "s", htmlContent: "<p>h</p>" })),
}));

import { updateTag } from "next/cache";
import { auth } from "@/auth";
import {
  setProfileStatus,
  getSpeakeuseContact,
  getProfilesToInvite,
  markInvited,
} from "@/lib/profiles";
import { isMagicLinkEnabled } from "@/lib/magic-link";
import { sendBrevoEmail } from "@/lib/email";
import { buildModerationEmail } from "@/lib/moderation-email";
import {
  moderateProfileAction,
  sendInvitationsAction,
} from "@/app/admin/actions";
import { fd } from "./test-helpers";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("moderateProfileAction — autorisation", () => {
  it("refuse une non-orga (redirige, aucune écriture)", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "2", isOrga: false } } as never);
    await expect(
      moderateProfileAction(fd({ profileId: "5", decision: "publie" })),
    ).rejects.toThrow("REDIRECT:/connexion");
    expect(setProfileStatus).not.toHaveBeenCalled();
    expect(sendBrevoEmail).not.toHaveBeenCalled();
  });
});

/** Contact d'une fiche en attente : le littéral était recopié à chaque test. */
const contact = (o: object = {}) => ({
  name: "Marie",
  email: "marie@ex.fr",
  contactEmailOk: false,
  slug: null,
  status: "en_attente" as const,
  ...o,
});

describe("moderateProfileAction — décision orga", () => {
  beforeEach(() => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "3", isOrga: true } } as never);
    // La mutation applique, sauf test contraire (elle renvoie désormais un bool).
    vi.mocked(setProfileStatus).mockResolvedValue(true as never);
  });

  it("publie un profil en attente et notifie la speakeuse", async () => {
    vi.mocked(getSpeakeuseContact).mockResolvedValue({
      name: "Marie",
      email: "marie@ex.fr",
      contactEmailOk: false,
      slug: null,
      status: "en_attente",
    });
    await expect(
      moderateProfileAction(fd({ profileId: "5", decision: "publie" })),
    ).rejects.toThrow("REDIRECT:/admin");
    expect(setProfileStatus).toHaveBeenCalledWith(5, "publie", 3, null);
    // Le cache de données de l'annuaire expire immédiatement : la fiche
    // publiée (ou masquée) se voit sans attendre le filet périodique.
    expect(updateTag).toHaveBeenCalledWith("annuaire");
    expect(sendBrevoEmail).toHaveBeenCalledTimes(1);
  });

  /**
   * Une fiche publiée s'affiche dans l'annuaire sous le nom de la personne —
   * sans nom, `SpeakeuseCard` retombe sur un libellé générique. La speakeuse ne
   * peut plus soumettre sans nom, mais la PUBLICATION est un geste orga distinct
   * qui n'en vérifiait rien : c'est ici que l'invariant doit tenir.
   */
  // La garde vit dans le SQL de `setProfileStatus`, qui renvoie alors `false` :
  // l'action ne fait que traduire ce refus pour l'orga, et n'envoie pas d'e-mail
  // annonçant une publication qui n'a pas eu lieu.
  it("publication refusée par la mutation (fiche sans nom) → message à l'orga, aucun e-mail", async () => {
    vi.mocked(getSpeakeuseContact).mockResolvedValue(contact({ name: null }));
    vi.mocked(setProfileStatus).mockResolvedValue(false as never);
    await expect(
      moderateProfileAction(fd({ profileId: "5", decision: "publie" })),
    ).rejects.toThrow("REDIRECT:/admin/speakeuses?err=nom");
    expect(sendBrevoEmail).not.toHaveBeenCalled();
  });

  it("sans nom, refuser reste possible (seule la publication est bloquée)", async () => {
    vi.mocked(getSpeakeuseContact).mockResolvedValue(contact({ name: null }));
    vi.mocked(setProfileStatus).mockResolvedValue(true as never);
    await expect(
      moderateProfileAction(fd({ profileId: "5", decision: "refuse", motif: "Nom manquant" })),
    ).rejects.toThrow("REDIRECT:/admin");
    expect(setProfileStatus).toHaveBeenCalledWith(5, "refuse", 3, "Nom manquant");
  });

  it("ne renvoie PAS d'e-mail si le statut ne change pas (revalidation)", async () => {
    vi.mocked(getSpeakeuseContact).mockResolvedValue({
      name: "Marie",
      email: "marie@ex.fr",
      contactEmailOk: false,
      slug: null,
      status: "publie",
    });
    await expect(
      moderateProfileAction(fd({ profileId: "5", decision: "publie" })),
    ).rejects.toThrow("REDIRECT:/admin");
    expect(setProfileStatus).toHaveBeenCalled();
    expect(sendBrevoEmail).not.toHaveBeenCalled();
  });

  it("refuse avec motif : transmet le motif à la base et à l'e-mail", async () => {
    vi.mocked(getSpeakeuseContact).mockResolvedValue({
      name: "Marie",
      email: "marie@ex.fr",
      contactEmailOk: false,
      slug: null,
      status: "en_attente",
    });
    await expect(
      moderateProfileAction(
        fd({ profileId: "5", decision: "refuse", motif: "Bio vide" }),
      ),
    ).rejects.toThrow("REDIRECT:/admin");
    expect(setProfileStatus).toHaveBeenCalledWith(5, "refuse", 3, "Bio vide");
    expect(buildModerationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ decision: "refuse", motif: "Bio vide" }),
    );
  });

  it("mettre en retrait (masque) : change le statut, sans e-mail", async () => {
    vi.mocked(getSpeakeuseContact).mockResolvedValue({
      name: "Marie",
      email: "marie@ex.fr",
      contactEmailOk: false,
      slug: null,
      status: "publie",
    });
    await expect(
      moderateProfileAction(fd({ profileId: "5", decision: "masque" })),
    ).rejects.toThrow("REDIRECT:/admin");
    expect(setProfileStatus).toHaveBeenCalledWith(5, "masque", 3, null);
    expect(sendBrevoEmail).not.toHaveBeenCalled();
  });

  it("un échec d'envoi d'e-mail ne casse pas la modération", async () => {
    vi.mocked(getSpeakeuseContact).mockResolvedValue({
      name: "Marie",
      email: "marie@ex.fr",
      contactEmailOk: false,
      slug: null,
      status: "en_attente",
    });
    vi.mocked(sendBrevoEmail).mockRejectedValueOnce(new Error("Brevo down"));
    // L'action redirige quand même (l'erreur e-mail est avalée).
    await expect(
      moderateProfileAction(fd({ profileId: "5", decision: "publie" })),
    ).rejects.toThrow("REDIRECT:/admin");
    expect(setProfileStatus).toHaveBeenCalled();
  });
});

describe("sendInvitationsAction — invitations migration", () => {
  it("refuse une non-orga (aucun envoi)", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "2", isOrga: false } } as never);
    await expect(sendInvitationsAction()).rejects.toThrow("REDIRECT:/connexion");
    expect(sendBrevoEmail).not.toHaveBeenCalled();
    expect(markInvited).not.toHaveBeenCalled();
  });

  it("si Brevo n'est pas configuré → /admin?invite=disabled, aucun envoi", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "3", isOrga: true } } as never);
    vi.mocked(isMagicLinkEnabled).mockReturnValueOnce(false);
    await expect(sendInvitationsAction()).rejects.toThrow(
      "REDIRECT:/admin/speakeuses?invite=disabled",
    );
    expect(getProfilesToInvite).not.toHaveBeenCalled();
    expect(sendBrevoEmail).not.toHaveBeenCalled();
  });

  it("envoie aux fiches à inviter puis les marque (idempotent)", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "3", isOrga: true } } as never);
    vi.mocked(getProfilesToInvite).mockResolvedValue([
      { id: 5, email: "a@b.fr", name: "Marie", isOrga: false },
      { id: 9, email: "c@d.fr", name: "Sandrine", isOrga: true },
    ]);
    await expect(sendInvitationsAction()).rejects.toThrow("REDIRECT:/admin/speakeuses?invited=2");
    expect(sendBrevoEmail).toHaveBeenCalledTimes(2);
    expect(markInvited).toHaveBeenCalledWith([5, 9]);
  });

  it("ne marque que les envois réussis et signale l'échec + sa raison", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "3", isOrga: true } } as never);
    vi.mocked(getProfilesToInvite).mockResolvedValue([
      { id: 5, email: "a@b.fr", name: "Marie", isOrga: false },
      { id: 9, email: "c@d.fr", name: "Sandrine", isOrga: true },
    ]);
    vi.mocked(sendBrevoEmail).mockRejectedValueOnce(new Error("bounce")); // 1er échoue
    await expect(sendInvitationsAction()).rejects.toThrow(
      "REDIRECT:/admin/speakeuses?invited=1&failed=1&err=bounce",
    );
    expect(markInvited).toHaveBeenCalledWith([9]);
  });

  it("tout échoue : invited=0 + failed=N + raison du 1er échec", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "3", isOrga: true } } as never);
    vi.mocked(getProfilesToInvite).mockResolvedValue([
      { id: 5, email: "a@b.fr", name: "Marie", isOrga: false },
      { id: 9, email: "c@d.fr", name: "Sandrine", isOrga: true },
    ]);
    vi.mocked(sendBrevoEmail).mockRejectedValue(new Error("API Key invalid"));
    await expect(sendInvitationsAction()).rejects.toThrow(
      "REDIRECT:/admin/speakeuses?invited=0&failed=2&err=API+Key+invalid",
    );
    expect(markInvited).toHaveBeenCalledWith([]);
  });
});
