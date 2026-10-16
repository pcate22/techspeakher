// @vitest-environment node
// Request/FormData/File réels de Node : cf. api-media-contenu-image.test.ts.
import { revalidateTag } from "next/cache";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));
vi.mock("@/auth", () => ({ auth: vi.fn(), unstable_update: vi.fn() }));
// `getUploadedFile` reste réel (lecture pure de FormData) ; seul `uploadImage`
// (dépôt Blob) est mocké.
vi.mock("@/lib/media", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/media")>();
  return { ...actual, uploadImage: vi.fn() };
});
vi.mock("@/lib/users", () => ({ setUserImage: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ isRateLimited: vi.fn() }));

import { auth, unstable_update } from "@/auth";
import { uploadImage } from "@/lib/media";
import { setUserImage } from "@/lib/users";
import { isRateLimited } from "@/lib/rate-limit";
import { POST } from "@/app/api/mon-espace/avatar/route";
import { contenuFichier, requestWithFile } from "./test-helpers";

const membre = { user: { id: "1", isOrga: false } } as never;

function requeteAvecFichier(file: File | null): Request {
  return requestWithFile("http://localhost/api/mon-espace/avatar", file);
}

// Octets distincts : la comparaison de contenu voit un fichier substitué.
const image = new File([Uint8Array.from({ length: 10 }, (_, i) => i)], "moi.png", { type: "image/png" });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isRateLimited).mockReturnValue(false);
});

describe("POST /api/mon-espace/avatar", () => {
  it("401 pour une visiteuse anonyme, aucun upload tenté", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await POST(requeteAvecFichier(image));
    expect(res.status).toBe(401);
    expect(uploadImage).not.toHaveBeenCalled();
  });

  it("trop d'envois récents : 429, rien n'est tenté", async () => {
    vi.mocked(auth).mockResolvedValue(membre);
    vi.mocked(isRateLimited).mockReturnValue(true);
    const res = await POST(requeteAvecFichier(image));
    expect(res.status).toBe(429);
    expect(uploadImage).not.toHaveBeenCalled();
  });

  it("aucun fichier reçu : 400, rien n'est envoyé", async () => {
    vi.mocked(auth).mockResolvedValue(membre);
    const res = await POST(requeteAvecFichier(null));
    expect(res.status).toBe(400);
    expect(uploadImage).not.toHaveBeenCalled();
  });

  it("fichier valide : dépose la photo, l'applique au compte, rafraîchit le token, 200 avec l'URL", async () => {
    vi.mocked(auth).mockResolvedValue(membre);
    vi.mocked(uploadImage).mockResolvedValue({ url: "https://x.example/moi.png" });
    const res = await POST(requeteAvecFichier(image));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "https://x.example/moi.png" });
    // Dossier « avatars » distinct des images d'articles (dossier « contenus »).
    expect(uploadImage).toHaveBeenCalledExactlyOnceWith(expect.any(File), "avatars");
    const [recu] = vi.mocked(uploadImage).mock.calls[0];
    expect(await contenuFichier(recu)).toEqual(await contenuFichier(image));
    expect(setUserImage).toHaveBeenCalledWith(1, "https://x.example/moi.png");
    expect(unstable_update).toHaveBeenCalledWith({ user: { image: "https://x.example/moi.png" } });
    // La photo s'affiche sur la carte de l'annuaire ; route handler, donc
    // expiration DIFFÉRÉE (revalidateTag « max » : updateTag y est interdit).
    expect(revalidateTag).toHaveBeenCalledWith("annuaire", "max");
  });

  it("fichier refusé par uploadImage : 400 avec le message d'erreur, rien n'est écrit", async () => {
    vi.mocked(auth).mockResolvedValue(membre);
    vi.mocked(uploadImage).mockResolvedValue({ error: "Image trop lourde (4 Mo maximum)." });
    const res = await POST(requeteAvecFichier(image));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Image trop lourde (4 Mo maximum)." });
    expect(setUserImage).not.toHaveBeenCalled();
    expect(unstable_update).not.toHaveBeenCalled();
  });
});
