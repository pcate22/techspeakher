import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/contact-message", () => ({
  parseContactMessage: vi.fn(),
  createContactMessage: vi.fn(),
  countRecentMessagesFromEmail: vi.fn(async () => 0),
}));
vi.mock("@/lib/profiles", () => ({ getSpeakeuseContact: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  isRateLimited: vi.fn(() => false),
  clientIp: vi.fn(() => "1.2.3.4"),
}));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

import {
  parseContactMessage,
  createContactMessage,
  countRecentMessagesFromEmail,
} from "@/lib/contact-message";
import { getSpeakeuseContact } from "@/lib/profiles";
import { isRateLimited } from "@/lib/rate-limit";
import { sendMessageAction } from "@/app/speakeuses/[id]/contact/actions";
import { fd } from "./test-helpers";

const validMsg = {
  ok: true as const,
  data: {
    motif: "conference",
    nom: "Org X",
    email: "org@event.fr",
    message: "Tu viens parler ?",
  },
};

const joignable = {
  name: "Marie",
  email: "marie@ex.fr",
  contactEmailOk: true,
  status: "publie" as const,
  slug: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(parseContactMessage).mockReturnValue(validMsg as never);
  vi.mocked(isRateLimited).mockReturnValue(false);
  vi.mocked(countRecentMessagesFromEmail).mockResolvedValue(0);
});

describe("sendMessageAction — mise en file de modération (pas de relais direct)", () => {
  it("refuse une saisie invalide (motif/champs)", async () => {
    vi.mocked(parseContactMessage).mockReturnValue({
      ok: false,
      errors: { motif: "Choisis un motif de contact." },
    } as never);
    const res = await sendMessageAction({}, fd({ profileId: "5" }));
    expect(res.ok).not.toBe(true);
    expect(res.errors?.motif).toBeTruthy();
    expect(createContactMessage).not.toHaveBeenCalled();
  });

  it("refuse si la speakeuse n'est pas publiée", async () => {
    vi.mocked(getSpeakeuseContact).mockResolvedValue({
      ...joignable,
      status: "en_attente",
    });
    const res = await sendMessageAction({}, fd({ profileId: "5" }));
    expect(res.ok).not.toBe(true);
    expect(createContactMessage).not.toHaveBeenCalled();
  });

  it("refuse si le contact e-mail n'est pas activé", async () => {
    vi.mocked(getSpeakeuseContact).mockResolvedValue({
      ...joignable,
      contactEmailOk: false,
    });
    const res = await sendMessageAction({}, fd({ profileId: "5" }));
    expect(res.ok).not.toBe(true);
    expect(createContactMessage).not.toHaveBeenCalled();
  });

  it("bloque au-delà du rate-limit (aucune écriture)", async () => {
    vi.mocked(getSpeakeuseContact).mockResolvedValue(joignable);
    vi.mocked(isRateLimited).mockReturnValue(true);
    const res = await sendMessageAction({}, fd({ profileId: "5" }));
    expect(res.ok).not.toBe(true);
    expect(res.errors?.message).toBeTruthy();
    expect(createContactMessage).not.toHaveBeenCalled();
  });

  it("bloque au-delà du plafond durable (compteur Postgres)", async () => {
    vi.mocked(getSpeakeuseContact).mockResolvedValue(joignable);
    vi.mocked(countRecentMessagesFromEmail).mockResolvedValue(10);
    const res = await sendMessageAction({}, fd({ profileId: "5" }));
    expect(res.ok).not.toBe(true);
    expect(res.errors?.message).toBeTruthy();
    expect(createContactMessage).not.toHaveBeenCalled();
  });

  it("persiste le message en attente, SANS envoyer d'e-mail immédiat", async () => {
    vi.mocked(getSpeakeuseContact).mockResolvedValue(joignable);
    vi.mocked(createContactMessage).mockResolvedValue(42);
    const res = await sendMessageAction({}, fd({ profileId: "5" }));
    expect(res.ok).toBe(true);
    expect(createContactMessage).toHaveBeenCalledTimes(1);
    const arg = vi.mocked(createContactMessage).mock.calls[0][0];
    expect(arg).toMatchObject({
      profileId: 5,
      motif: "conference",
      senderName: "Org X",
      senderEmail: "org@event.fr",
    });
  });

  it("si l'enregistrement échoue → message d'erreur propre", async () => {
    vi.mocked(getSpeakeuseContact).mockResolvedValue(joignable);
    vi.mocked(createContactMessage).mockRejectedValue(new Error("db down"));
    const res = await sendMessageAction({}, fd({ profileId: "5" }));
    expect(res.ok).not.toBe(true);
    expect(res.errors?.message).toBeTruthy();
  });
});
