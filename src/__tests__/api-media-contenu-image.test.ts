// @vitest-environment node
// Request/FormData/File réels de Node (undici) : sous jsdom, le `File` global
// diffère de celui reconstruit par `Request.formData()` (deux réalités), et
// `instanceof File` échouerait pour une raison d'environnement de test, pas
// de logique. Cf. docs/dette-technique.md (pragma déjà utilisé pour ce cas).
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
// `getUploadedFile` reste réel (lecture pure de FormData) ; seul `uploadImage`
// (dépôt Blob) est mocké.
vi.mock("@/lib/media", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/media")>();
  return { ...actual, uploadImage: vi.fn() };
});

import { auth } from "@/auth";
import { uploadImage } from "@/lib/media";
import { POST } from "@/app/api/admin/contenus/image/route";
import { contenuFichier, requestWithFile } from "./test-helpers";

const orga = { user: { id: "1", isOrga: true } } as never;
const membre = { user: { id: "2", isOrga: false } } as never;

beforeEach(() => vi.clearAllMocks());

function requeteAvecFichier(file: File | null): Request {
  return requestWithFile("http://localhost/api/admin/contenus/image", file);
}

// Octets distincts : la comparaison de contenu voit un fichier substitué.
const image = new File([Uint8Array.from({ length: 10 }, (_, i) => i)], "photo.png", { type: "image/png" });

describe("POST /api/admin/contenus/image", () => {
  it("403 pour une membre connectée non-orga, aucun upload tenté", async () => {
    vi.mocked(auth).mockResolvedValue(membre);
    const res = await POST(requeteAvecFichier(image));
    expect(res.status).toBe(403);
    expect(uploadImage).not.toHaveBeenCalled();
  });

  it("401 pour une visiteuse anonyme", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await POST(requeteAvecFichier(image));
    expect(res.status).toBe(401);
  });

  it("400 si aucun fichier n'est reçu", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    const res = await POST(requeteAvecFichier(null));
    expect(res.status).toBe(400);
    expect(uploadImage).not.toHaveBeenCalled();
  });

  it("orga + fichier valide : 200 avec l'URL renvoyée par uploadImage", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(uploadImage).mockResolvedValue({ url: "https://x.example/y.png" });
    const res = await POST(requeteAvecFichier(image));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "https://x.example/y.png" });
    expect(uploadImage).toHaveBeenCalledExactlyOnceWith(expect.any(File));
    const [recu] = vi.mocked(uploadImage).mock.calls[0];
    expect(await contenuFichier(recu)).toEqual(await contenuFichier(image));
  });

  it("orga + fichier refusé par uploadImage : 400 avec le message d'erreur", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(uploadImage).mockResolvedValue({ error: "Image trop lourde (4 Mo maximum)." });
    const res = await POST(requeteAvecFichier(image));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Image trop lourde (4 Mo maximum)." });
  });
});
