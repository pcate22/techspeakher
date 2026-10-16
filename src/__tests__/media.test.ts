import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { putMock } = vi.hoisted(() => ({ putMock: vi.fn() }));
vi.mock("@vercel/blob", () => ({ put: putMock }));

import { uploadImage, uploadImageDepuisUrl } from "@/lib/media";

const SIGNATURES: Record<string, number[]> = {
  "image/png": [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  "image/jpeg": [0xff, 0xd8, 0xff, 0xdb],
  "image/webp": [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50],
  "image/avif": [0, 0, 0, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66],
};

/** Fichier avec une VRAIE signature binaire du type déclaré (contenu plausible). */
function makeFile(bytes: number, type: string, name = "photo.png"): File {
  const head = SIGNATURES[type] ?? [];
  const buf = new Uint8Array(Math.max(bytes, head.length));
  buf.set(head, 0);
  return new File([buf], name, { type });
}

beforeEach(() => vi.clearAllMocks());

describe("uploadImage", () => {
  it("refuse un type MIME non pris en charge (aucun appel à put)", async () => {
    const r = await uploadImage(makeFile(10, "application/pdf"));
    expect(r).toEqual({ error: expect.any(String) });
    expect(putMock).not.toHaveBeenCalled();
  });

  it("refuse un fichier de plus de 4 Mo (aucun appel à put)", async () => {
    const r = await uploadImage(makeFile(4 * 1024 * 1024 + 1, "image/png"));
    expect(r).toEqual({ error: expect.any(String) });
    expect(putMock).not.toHaveBeenCalled();
  });

  it("accepte un fichier exactement à la limite de 4 Mo", async () => {
    putMock.mockResolvedValue({ url: "https://x.example/y.png" });
    const r = await uploadImage(makeFile(4 * 1024 * 1024, "image/png"));
    expect(r).toEqual({ url: "https://x.example/y.png" });
  });

  it("accepte un PNG valide, dépose en accès public, renvoie l'URL du blob", async () => {
    putMock.mockResolvedValue({ url: "https://xyz.public.blob.vercel-storage.com/contenus/abc.png" });
    const r = await uploadImage(makeFile(1000, "image/png"));
    expect(r).toEqual({ url: "https://xyz.public.blob.vercel-storage.com/contenus/abc.png" });
    expect(putMock).toHaveBeenCalledTimes(1);
    const [nom, , options] = putMock.mock.calls[0];
    expect(options).toEqual({ access: "public" });
    expect(nom).toMatch(/^contenus\/[0-9a-f-]+\.png$/);
  });

  it.each(["image/jpeg", "image/webp", "image/avif"])("accepte le type %s", async (type) => {
    putMock.mockResolvedValue({ url: "https://x.example/y" });
    const r = await uploadImage(makeFile(500, type));
    expect(r).toEqual({ url: "https://x.example/y" });
  });

  it("ne réutilise jamais le nom du fichier client (nom généré serveur)", async () => {
    putMock.mockResolvedValue({ url: "https://x.example/y" });
    await uploadImage(makeFile(100, "image/png", "../../etc/mot-de-passe.png"));
    const [nom] = putMock.mock.calls[0];
    expect(nom).not.toContain("mot-de-passe");
    expect(nom).not.toContain("..");
  });

  it("refuse un fichier vide (aucun appel à put)", async () => {
    const r = await uploadImage(new File([], "vide.png", { type: "image/png" }));
    expect(r).toEqual({ error: expect.any(String) });
    expect(putMock).not.toHaveBeenCalled();
  });

  it("refuse un contenu qui ne correspond pas au type MIME déclaré (déclaratif contourné)", async () => {
    // `type: "image/png"` mais contenu HTML : le champ File.type ne suffit pas.
    const faux = new File([new TextEncoder().encode("<html><script>alert(1)</script>")], "x.png", {
      type: "image/png",
    });
    const r = await uploadImage(faux);
    expect(r).toEqual({ error: expect.any(String) });
    expect(putMock).not.toHaveBeenCalled();
  });

  it("range le fichier dans le dossier demandé (avatars vs contenus)", async () => {
    putMock.mockResolvedValue({ url: "https://x.example/y" });
    await uploadImage(makeFile(100, "image/png"), "avatars");
    const [nom] = putMock.mock.calls[0];
    expect(nom).toMatch(/^avatars\/[0-9a-f-]+\.png$/);
  });

  it("propage une erreur du service de stockage sans la masquer", async () => {
    putMock.mockRejectedValue(new Error("Service indisponible"));
    await expect(uploadImage(makeFile(100, "image/png"))).rejects.toThrow("Service indisponible");
  });
});

/**
 * Reprise d'une image HÉBERGÉE AILLEURS (photo LinkedIn). Deux choses à tenir :
 * la requête sortante part d'une URL qu'on n'a pas écrite (d'où la liste
 * blanche d'hôtes, et le refus de tout ce qui n'est pas https), et le contenu
 * récupéré subit EXACTEMENT les mêmes contrôles qu'un fichier envoyé à la main.
 */
describe("uploadImageDepuisUrl", () => {
  /** Réponse HTTP portant une vraie signature binaire du type annoncé. */
  function reponseImage(type = "image/png", octets = 500): Response {
    const head = SIGNATURES[type] ?? [];
    const buf = new Uint8Array(Math.max(octets, head.length));
    buf.set(head, 0);
    return new Response(buf, { status: 200, headers: { "content-type": type } });
  }

  const OPTIONS = { dossier: "avatars", hotesAutorises: ["licdn.com"] } as const;

  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it("refuse un hôte hors liste blanche : AUCUNE requête n'est faite", async () => {
    const r = await uploadImageDepuisUrl("https://ailleurs.example/photo.png", OPTIONS);
    expect(r).toEqual({ error: expect.any(String) });
    expect(fetch).not.toHaveBeenCalled();
    expect(putMock).not.toHaveBeenCalled();
  });

  it("refuse un hôte qui RESSEMBLE à un hôte autorisé (suffixe collé)", async () => {
    const r = await uploadImageDepuisUrl("https://malicdn.com/photo.png", OPTIONS);
    expect(r).toEqual({ error: expect.any(String) });
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    "http://media.licdn.com/photo.png",
    "file:///etc/passwd",
    "https://127.0.0.1/photo.png",
    "pas-une-url",
  ])("refuse %s sans rien tenter", async (url) => {
    const r = await uploadImageDepuisUrl(url, OPTIONS);
    expect(r).toEqual({ error: expect.any(String) });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("accepte un sous-domaine de l'hôte autorisé et dépose dans le bon dossier", async () => {
    vi.mocked(fetch).mockResolvedValue(reponseImage());
    putMock.mockResolvedValue({ url: "https://blob.example/avatars/a.png" });

    const r = await uploadImageDepuisUrl("https://media.licdn.com/dms/x.png", OPTIONS);

    expect(r).toEqual({ url: "https://blob.example/avatars/a.png" });
    const [nom] = putMock.mock.calls[0];
    expect(nom).toMatch(/^avatars\/[0-9a-f-]+\.png$/);
  });

  it("refuse de suivre une redirection (elle sortirait de la liste blanche)", async () => {
    vi.mocked(fetch).mockResolvedValue(reponseImage());
    await uploadImageDepuisUrl("https://media.licdn.com/x.png", OPTIONS);
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect((init as RequestInit).redirect).toBe("error");
  });

  it("refuse un contenu qui n'est pas une image, malgré un content-type d'image", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(new TextEncoder().encode("<html><script>alert(1)</script>"), {
        status: 200,
        headers: { "content-type": "image/png" },
      }),
    );
    const r = await uploadImageDepuisUrl("https://media.licdn.com/x.png", OPTIONS);
    expect(r).toEqual({ error: expect.any(String) });
    expect(putMock).not.toHaveBeenCalled();
  });

  it("refuse un contenu de plus de 4 Mo", async () => {
    vi.mocked(fetch).mockResolvedValue(reponseImage("image/png", 4 * 1024 * 1024 + 1));
    const r = await uploadImageDepuisUrl("https://media.licdn.com/x.png", OPTIONS);
    expect(r).toEqual({ error: expect.any(String) });
    expect(putMock).not.toHaveBeenCalled();
  });

  it("réseau en échec ou réponse en erreur : un message, jamais une exception", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("timeout"));
    expect(await uploadImageDepuisUrl("https://media.licdn.com/x.png", OPTIONS)).toEqual({
      error: expect.any(String),
    });

    vi.mocked(fetch).mockResolvedValueOnce(new Response("", { status: 404 }));
    expect(await uploadImageDepuisUrl("https://media.licdn.com/x.png", OPTIONS)).toEqual({
      error: expect.any(String),
    });
    expect(putMock).not.toHaveBeenCalled();
  });

  it("corps interrompu APRÈS des en-têtes valides : un message, jamais une exception", async () => {
    // La Server Action rejetait, et l'écran restait muet : aucun message, aucune
    // erreur — la personne cliquait dans le vide.
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "image/png" }),
      arrayBuffer: async () => {
        throw new Error("connexion coupée");
      },
    } as unknown as Response);

    expect(await uploadImageDepuisUrl("https://media.licdn.com/x.png", OPTIONS)).toEqual({
      error: expect.any(String),
    });
    expect(putMock).not.toHaveBeenCalled();
  });

  it("taille ANNONCÉE hors bornes : refus avant de charger le corps", async () => {
    const arrayBuffer = vi.fn();
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      headers: new Headers({
        "content-type": "image/png",
        "content-length": String(4 * 1024 * 1024 + 1),
      }),
      arrayBuffer,
    } as unknown as Response);

    expect(await uploadImageDepuisUrl("https://media.licdn.com/x.png", OPTIONS)).toEqual({
      error: expect.any(String),
    });
    expect(arrayBuffer).not.toHaveBeenCalled();
  });
});
