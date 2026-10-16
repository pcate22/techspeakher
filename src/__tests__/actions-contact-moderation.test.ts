import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((p: string) => {
    throw new Error(`REDIRECT:${p}`);
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/contact-message", () => ({
  setContactMessageStatus: vi.fn(async () => 1),
  getContactMessageById: vi.fn(),
  markMessagesNotified: vi.fn(),
}));
vi.mock("@/lib/profiles", () => ({ getSpeakeuseContact: vi.fn() }));
vi.mock("@/lib/magic-link", () => ({ isMagicLinkEnabled: vi.fn(() => true) }));
vi.mock("@/lib/email", () => ({ sendBrevoEmail: vi.fn() }));
vi.mock("@/lib/digest-email", () => ({
  buildSpeakeuseDigestEmail: vi.fn(() => ({ subject: "s", textContent: "t" })),
}));

import { auth } from "@/auth";
import {
  setContactMessageStatus,
  getContactMessageById,
  markMessagesNotified,
} from "@/lib/contact-message";
import { getSpeakeuseContact } from "@/lib/profiles";
import { sendBrevoEmail } from "@/lib/email";
import { revalidatePath } from "next/cache";
import { moderateContactMessageAction } from "@/app/admin/actions";
import { fd } from "./test-helpers";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getContactMessageById).mockResolvedValue({
    id: 7,
    profileId: 1,
    motif: "conference",
    senderName: "Paul",
    senderEmail: "paul@x.fr",
    body: "Salut",
    status: "transmis",
    createdAt: "2026-07-01",
    moderatedBy: 3,
    moderatedAt: "2026-07-01",
    notifiedAt: null,
    speakeuseName: "Marie",
  } as never);
  vi.mocked(getSpeakeuseContact).mockResolvedValue({
    name: "Marie",
    email: "marie@ex.fr",
    contactEmailOk: true,
    status: "publie",
    slug: null,
  });
});

describe("moderateContactMessageAction — autorisation", () => {
  it("refuse une non-orga (redirige, aucune écriture)", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "2", isOrga: false } } as never);
    await expect(
      moderateContactMessageAction(fd({ messageId: "7", decision: "transmis" })),
    ).rejects.toThrow("REDIRECT:/connexion");
    expect(setContactMessageStatus).not.toHaveBeenCalled();
    expect(sendBrevoEmail).not.toHaveBeenCalled();
  });
});

describe("moderateContactMessageAction — décision orga", () => {
  beforeEach(() => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "3", isOrga: true } } as never);
  });

  it("transmet un message ET prévient la speakeuse par e-mail immédiatement", async () => {
    await expect(
      moderateContactMessageAction(fd({ messageId: "7", decision: "transmis" })),
    ).rejects.toThrow("REDIRECT:/admin/messages");
    expect(setContactMessageStatus).toHaveBeenCalledWith(7, "transmis", 3);
    expect(sendBrevoEmail).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendBrevoEmail).mock.calls[0][0].to).toBe("marie@ex.fr");
    expect(markMessagesNotified).toHaveBeenCalledWith([7]);
    expect(revalidatePath).toHaveBeenCalledWith("/admin/messages");
  });

  it("ne renvoie PAS d'e-mail si le message était déjà traité (course / double-clic)", async () => {
    vi.mocked(setContactMessageStatus).mockResolvedValueOnce(0);
    await expect(
      moderateContactMessageAction(fd({ messageId: "7", decision: "transmis" })),
    ).rejects.toThrow("REDIRECT:/admin/messages");
    expect(sendBrevoEmail).not.toHaveBeenCalled();
    expect(markMessagesNotified).not.toHaveBeenCalled();
  });

  it("rejette un message SANS envoyer d'e-mail", async () => {
    await expect(
      moderateContactMessageAction(fd({ messageId: "7", decision: "rejete" })),
    ).rejects.toThrow("REDIRECT:/admin/messages");
    expect(setContactMessageStatus).toHaveBeenCalledWith(7, "rejete", 3);
    expect(sendBrevoEmail).not.toHaveBeenCalled();
  });

  it("ne marque pas notifié si l'envoi échoue (le cron rattrapera)", async () => {
    vi.mocked(sendBrevoEmail).mockRejectedValueOnce(new Error("Brevo down"));
    await expect(
      moderateContactMessageAction(fd({ messageId: "7", decision: "transmis" })),
    ).rejects.toThrow("REDIRECT:/admin/messages");
    expect(setContactMessageStatus).toHaveBeenCalledWith(7, "transmis", 3);
    expect(markMessagesNotified).not.toHaveBeenCalled();
  });

  it("ignore une décision invalide (aucune écriture)", async () => {
    await expect(
      moderateContactMessageAction(fd({ messageId: "7", decision: "supprime" })),
    ).rejects.toThrow("REDIRECT:/admin/messages");
    expect(setContactMessageStatus).not.toHaveBeenCalled();
  });
});
