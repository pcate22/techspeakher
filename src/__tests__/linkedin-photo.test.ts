import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/accounts", () => ({ getProviderAccess: vi.fn(), getLinkedProviders: vi.fn() }));
vi.mock("@/auth.config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/auth.config")>();
  return { ...actual, isLinkedInEnabled: vi.fn() };
});
vi.mock("@/lib/media", () => ({ uploadImageDepuisUrl: vi.fn() }));

import { getProviderAccess, getLinkedProviders } from "@/lib/accounts";
import { isLinkedInEnabled } from "@/auth.config";
import { uploadImageDepuisUrl } from "@/lib/media";
import {
  photoLinkedInReprenable,
  jetonUtilisable,
  photoDeUserinfo,
  reprendrePhotoLinkedIn,
  HOTES_PHOTO_LINKEDIN,
} from "@/lib/linkedin-photo";

const MAINTENANT = 1_800_000_000;

function reponse(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(MAINTENANT * 1000);
  vi.stubGlobal("fetch", vi.fn());
  vi.mocked(isLinkedInEnabled).mockReturnValue(true);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("photoLinkedInReprenable — la règle, à un seul endroit", () => {
  it("vrai quand LinkedIn est rattaché ET configuré", async () => {
    vi.mocked(getLinkedProviders).mockResolvedValue(["google", "linkedin"]);
    expect(await photoLinkedInReprenable(7)).toBe(true);
  });

  it("faux sans rattachement : il n'y a aucune photo à aller chercher", async () => {
    vi.mocked(getLinkedProviders).mockResolvedValue(["google"]);
    expect(await photoLinkedInReprenable(7)).toBe(false);
  });

  it("faux si LinkedIn quitte la configuration, même rattaché — et la base n'est même pas lue", async () => {
    // Une ligne `accounts` survit au retrait des identifiants en env : sans ce
    // garde, le bouton s'afficherait pour un provider hors service.
    vi.mocked(isLinkedInEnabled).mockReturnValue(false);
    expect(await photoLinkedInReprenable(7)).toBe(false);
    expect(getLinkedProviders).not.toHaveBeenCalled();
  });
});

describe("jetonUtilisable", () => {
  it("faux sans jeton", () => {
    expect(jetonUtilisable(null, MAINTENANT)).toBe(false);
  });

  it("vrai quand le provider n'annonce aucune échéance (LinkedIn tranchera)", () => {
    expect(jetonUtilisable({ expiresAt: null }, MAINTENANT)).toBe(true);
  });

  it("faux pour un jeton expiré, ou qui expire dans la minute", () => {
    expect(jetonUtilisable({ expiresAt: MAINTENANT - 1 }, MAINTENANT)).toBe(false);
    expect(jetonUtilisable({ expiresAt: MAINTENANT + 30 }, MAINTENANT)).toBe(false);
  });

  it("vrai pour un jeton qui tient encore", () => {
    expect(jetonUtilisable({ expiresAt: MAINTENANT + 3600 }, MAINTENANT)).toBe(true);
  });
});

describe("photoDeUserinfo", () => {
  it("lit l'URL de photo", () => {
    expect(photoDeUserinfo({ picture: "https://media.licdn.com/x.jpg" })).toBe(
      "https://media.licdn.com/x.jpg",
    );
  });

  it.each([null, undefined, "texte", 42, {}, { picture: null }, { picture: 42 }, { picture: "  " }])(
    "null pour une réponse sans photo exploitable : %j",
    (entree) => {
      expect(photoDeUserinfo(entree)).toBeNull();
    },
  );
});

describe("reprendrePhotoLinkedIn", () => {
  it("aucun jeton conservé : une reconnexion, et LinkedIn n'est même pas appelé", async () => {
    vi.mocked(getProviderAccess).mockResolvedValue(null);
    expect(await reprendrePhotoLinkedIn(7)).toEqual({ ok: false, raison: "reconnexion" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("jeton expiré : une reconnexion, sans appel inutile", async () => {
    vi.mocked(getProviderAccess).mockResolvedValue({
      accessToken: "vieux",
      expiresAt: MAINTENANT - 10,
    });
    expect(await reprendrePhotoLinkedIn(7)).toEqual({ ok: false, raison: "reconnexion" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("le jeton du COMPTE part en Bearer, et c'est le seul lu", async () => {
    vi.mocked(getProviderAccess).mockResolvedValue({ accessToken: "jeton-7", expiresAt: null });
    vi.mocked(fetch).mockResolvedValue(reponse(200, { picture: "https://media.licdn.com/p.jpg" }));
    vi.mocked(uploadImageDepuisUrl).mockResolvedValue({ url: "https://blob/avatars/a.jpg" });

    await reprendrePhotoLinkedIn(7);

    expect(getProviderAccess).toHaveBeenCalledWith(7, "linkedin");
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: "Bearer jeton-7",
    });
  });

  it("401 / 403 : jeton révoqué côté LinkedIn → reconnexion", async () => {
    vi.mocked(getProviderAccess).mockResolvedValue({ accessToken: "x", expiresAt: null });
    for (const status of [401, 403]) {
      vi.mocked(fetch).mockResolvedValue(reponse(status));
      expect(await reprendrePhotoLinkedIn(7)).toEqual({ ok: false, raison: "reconnexion" });
    }
  });

  it("panne LinkedIn : un échec qui se dit, JAMAIS une demande de reconnexion", async () => {
    vi.mocked(getProviderAccess).mockResolvedValue({ accessToken: "x", expiresAt: null });
    vi.mocked(fetch).mockResolvedValue(reponse(500));
    const r = await reprendrePhotoLinkedIn(7);
    expect(r).toMatchObject({ ok: false, raison: "echec" });
  });

  it("profil LinkedIn sans photo : un message, aucun dépôt", async () => {
    vi.mocked(getProviderAccess).mockResolvedValue({ accessToken: "x", expiresAt: null });
    vi.mocked(fetch).mockResolvedValue(reponse(200, { sub: "abc" }));
    const r = await reprendrePhotoLinkedIn(7);
    expect(r).toMatchObject({ ok: false, raison: "echec" });
    expect(uploadImageDepuisUrl).not.toHaveBeenCalled();
  });

  it("succès : la photo est COPIÉE chez nous (dossier avatars, hôtes LinkedIn), et c'est NOTRE url qui revient", async () => {
    vi.mocked(getProviderAccess).mockResolvedValue({ accessToken: "x", expiresAt: null });
    vi.mocked(fetch).mockResolvedValue(
      reponse(200, { picture: "https://media.licdn.com/dms/image/signee.jpg" }),
    );
    vi.mocked(uploadImageDepuisUrl).mockResolvedValue({
      url: "https://blob.example/avatars/moi.jpg",
    });

    const r = await reprendrePhotoLinkedIn(7);

    expect(uploadImageDepuisUrl).toHaveBeenCalledWith(
      "https://media.licdn.com/dms/image/signee.jpg",
      { dossier: "avatars", hotesAutorises: HOTES_PHOTO_LINKEDIN },
    );
    // L'URL LinkedIn (signée, périssable) ne ressort JAMAIS d'ici : c'est ce
    // qui faisait retomber l'avatar sur les initiales des semaines plus tard.
    expect(r).toEqual({ ok: true, url: "https://blob.example/avatars/moi.jpg" });
  });

  it("dépôt refusé : le message du dépôt remonte tel quel", async () => {
    vi.mocked(getProviderAccess).mockResolvedValue({ accessToken: "x", expiresAt: null });
    vi.mocked(fetch).mockResolvedValue(reponse(200, { picture: "https://media.licdn.com/p.jpg" }));
    vi.mocked(uploadImageDepuisUrl).mockResolvedValue({ error: "Image trop lourde (4 Mo maximum)." });

    expect(await reprendrePhotoLinkedIn(7)).toEqual({
      ok: false,
      raison: "echec",
      message: "Image trop lourde (4 Mo maximum).",
    });
  });
});
