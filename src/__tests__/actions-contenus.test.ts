import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((p: string) => {
    throw new Error(`REDIRECT:${p}`);
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
// Seuls les accès DB sont mockés ; parseContenuForm et slugify (purs) restent réels.
vi.mock("@/lib/contenus", () => ({
  createContenu: vi.fn(),
  updateContenu: vi.fn(),
  setStatut: vi.fn(),
  deleteContenu: vi.fn(),
}));
import { auth } from "@/auth";
import { createContenu, updateContenu, setStatut, deleteContenu } from "@/lib/contenus";
import {
  createContenuAction,
  updateContenuAction,
  deleteContenuAction,
} from "@/app/admin/contenus/actions";
import { fd } from "./test-helpers";

const orga = { user: { id: "1", isOrga: true } } as never;
const membre = { user: { id: "2", isOrga: false } } as never;
const idle = { status: "idle" as const };

beforeEach(() => vi.clearAllMocks());

describe("createContenuAction", () => {
  it("refuse une non-orga (pas d'écriture)", async () => {
    vi.mocked(auth).mockResolvedValue(membre);
    await expect(
      createContenuAction(idle, fd({ type: "publication", titre: "Mon actu" })),
    ).rejects.toThrow("REDIRECT:/connexion");
    expect(createContenu).not.toHaveBeenCalled();
  });

  it("orga + valide : crée puis redirige vers l'éditeur", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(createContenu).mockResolvedValue({ ok: true, id: 7, slug: "mon-actu" });
    await expect(
      createContenuAction(idle, fd({ type: "publication", titre: "Mon actu", chapo: "Hop" })),
    ).rejects.toThrow("REDIRECT:/admin/contenus/publication/mon-actu?cree=1");
    expect(createContenu).toHaveBeenCalledTimes(1);
  });

  it("orga + titre vide : erreur, pas d'écriture", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    const r = await createContenuAction(idle, fd({ type: "publication", titre: "" }));
    expect(r.status).toBe("error");
    expect(createContenu).not.toHaveBeenCalled();
  });

  it("orga + slug déjà pris : erreur (reste en place)", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(createContenu).mockResolvedValue({ ok: false, reason: "slug" });
    const r = await createContenuAction(idle, fd({ type: "publication", titre: "Doublon" }));
    expect(r.status).toBe("error");
  });
});

describe("updateContenuAction", () => {
  it("refuse une non-orga", async () => {
    vi.mocked(auth).mockResolvedValue(membre);
    await expect(
      updateContenuAction(idle, fd({ contenuId: "7", type: "publication", slug: "x", titre: "Y" })),
    ).rejects.toThrow("REDIRECT:/connexion");
    expect(updateContenu).not.toHaveBeenCalled();
  });

  it("orga + slug inchangé : reste en place (succès, pas de redirection)", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(updateContenu).mockResolvedValue({ ok: true, slug: "mon-actu" });
    const r = await updateContenuAction(
      idle,
      fd({ contenuId: "7", type: "publication", slug: "mon-actu", titre: "Mon actu" }),
    );
    expect(r.status).toBe("success");
    expect(updateContenu).toHaveBeenCalledWith(7, expect.objectContaining({ titre: "Mon actu" }));
  });

  it("orga + titre changé (slug différent) : redirige vers la nouvelle adresse", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(updateContenu).mockResolvedValue({ ok: true, slug: "nouveau-titre" });
    await expect(
      updateContenuAction(
        idle,
        fd({ contenuId: "7", type: "publication", slug: "ancien", titre: "Nouveau Titre" }),
      ),
    ).rejects.toThrow("REDIRECT:/admin/contenus/publication/nouveau-titre?renomme=1");
  });

  it("orga + slug en conflit : erreur", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(updateContenu).mockResolvedValue({ ok: false, reason: "slug" });
    const r = await updateContenuAction(
      idle,
      fd({ contenuId: "7", type: "publication", slug: "x", titre: "Occupé" }),
    );
    expect(r.status).toBe("error");
  });

  it("intention « publier » : enregistre PUIS publie, redirige avec confirmation", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(updateContenu).mockResolvedValue({ ok: true, slug: "mon-actu" });
    await expect(
      updateContenuAction(
        idle,
        fd({ contenuId: "7", type: "publication", slug: "mon-actu", titre: "Mon actu", intention: "publier" }),
      ),
    ).rejects.toThrow("REDIRECT:/admin/contenus/publication/mon-actu?publie=1");
    // Enregistrement d'abord, puis publication (pas de contenu périmé).
    expect(updateContenu).toHaveBeenCalledWith(7, expect.objectContaining({ titre: "Mon actu" }));
    expect(setStatut).toHaveBeenCalledWith(7, "publie");
  });

  it("intention « depublier » : enregistre PUIS repasse en brouillon", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(updateContenu).mockResolvedValue({ ok: true, slug: "mon-actu" });
    await expect(
      updateContenuAction(
        idle,
        fd({ contenuId: "7", type: "publication", slug: "mon-actu", titre: "Mon actu", intention: "depublier" }),
      ),
    ).rejects.toThrow("REDIRECT:/admin/contenus/publication/mon-actu?brouillon=1");
    expect(setStatut).toHaveBeenCalledWith(7, "brouillon");
  });

  it("intention « enregistrer » : sauvegarde seule, aucun changement de statut", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(updateContenu).mockResolvedValue({ ok: true, slug: "mon-actu" });
    const r = await updateContenuAction(
      idle,
      fd({ contenuId: "7", type: "publication", slug: "mon-actu", titre: "Mon actu", intention: "enregistrer" }),
    );
    expect(r.status).toBe("success");
    expect(setStatut).not.toHaveBeenCalled();
  });
});

// L'upload d'image (lot 6) est maintenant une route API, pas une Server
// Action : voir api-media-contenu-image.test.ts.

describe("deleteContenuAction", () => {
  it("refuse une non-orga", async () => {
    vi.mocked(auth).mockResolvedValue(membre);
    await expect(
      deleteContenuAction(fd({ contenuId: "7", type: "publication", slug: "x" })),
    ).rejects.toThrow("REDIRECT:/connexion");
    expect(deleteContenu).not.toHaveBeenCalled();
  });

  it("orga : supprime puis redirige vers le hub", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    await expect(
      deleteContenuAction(fd({ contenuId: "7", type: "publication", slug: "x" })),
    ).rejects.toThrow("REDIRECT:/actualites?supprime=1");
    expect(deleteContenu).toHaveBeenCalledWith(7);
  });
});
