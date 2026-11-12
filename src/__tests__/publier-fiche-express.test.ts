import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Publication express : la décision « en ligne » ou « en relecture » se prend
 * côté serveur seulement, et une fiche existante n'est jamais réécrite par ce
 * parcours (ni republiée, ni dépubliée).
 */

vi.mock("next/navigation", () => ({
  redirect: vi.fn((p: string) => {
    throw new Error(`REDIRECT:${p}`);
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("@/auth", () => ({ auth: vi.fn(), signOut: vi.fn() }));
vi.mock("@/lib/profiles", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/profiles")>();
  return {
    ...actual,
    getProfileByUserId: vi.fn(),
    publierFiche: vi.fn(async () => true),
    upsertProfile: vi.fn(),
    submitForValidation: vi.fn(),
    deriveAvailableSlug: vi.fn(async () => "lea-martin"),
  };
});
vi.mock("@/lib/users", () => ({ setUserName: vi.fn(), getUserById: vi.fn() }));

import { auth } from "@/auth";
import {
  getProfileByUserId,
  publierFiche,
  upsertProfile,
  submitForValidation,
} from "@/lib/profiles";
import { setUserName, getUserById } from "@/lib/users";
import { publierFicheExpressAction } from "@/app/mon-espace/actions";

const THEME = "Accessibilité";

function form(champs: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(champs))
    for (const x of Array.isArray(v) ? v : [v]) fd.append(k, x);
  return fd;
}

function rienEcrit() {
  expect(publierFiche).not.toHaveBeenCalled();
  expect(setUserName).not.toHaveBeenCalled();
  expect(upsertProfile).not.toHaveBeenCalled();
  expect(submitForValidation).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ user: { id: "7" } } as never);
  vi.mocked(getProfileByUserId).mockResolvedValue(null);
  vi.mocked(getUserById).mockResolvedValue({
    id: 7,
    name: "Léa Martin",
    email: "lea@example.org",
  } as never);
});

describe("publierFicheExpressAction", () => {
  it("sans session → /connexion, rien d'écrit", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    await expect(
      publierFicheExpressAction({}, form({ nom: "Léa Martin", sujets: THEME })),
    ).rejects.toThrow("REDIRECT:/connexion");
    rienEcrit();
  });

  it("nom vide → erreur sur le nom, rien d'écrit", async () => {
    const r = await publierFicheExpressAction({}, form({ nom: "   ", sujets: THEME }));
    expect(r.errors?.nom).toBeTruthy();
    rienEcrit();
  });

  it("aucun thème valide → « Choisis au moins un thème »", async () => {
    const r = await publierFicheExpressAction({}, form({ nom: "Léa Martin", sujets: ["x"] }));
    expect(r.errors?.sujets).toBe("Choisis au moins un thème");
    rienEcrit();
  });

  it("nom du compte → publiée, attestation et contact posés", async () => {
    await expect(
      publierFicheExpressAction({}, form({ nom: "Léa Martin", sujets: [THEME, "x"] })),
    ).rejects.toThrow("REDIRECT:/mon-espace?ok=fiche_publiee");
    expect(publierFiche).toHaveBeenCalledWith(7, "publie", {
      sujets: [THEME],
      slug: "lea-martin",
    });
    expect(setUserName).toHaveBeenCalledWith(7, "Léa Martin");
  });

  it("nom modifié → en relecture", async () => {
    await expect(
      publierFicheExpressAction({}, form({ nom: "Léa M.", sujets: THEME })),
    ).rejects.toThrow("REDIRECT:/mon-espace?ok=fiche_envoyee");
    expect(vi.mocked(publierFiche).mock.calls[0][1]).toBe("en_attente");
  });

  it("fiche existante (déjà publiée) → /mon-espace, aucune écriture", async () => {
    vi.mocked(getProfileByUserId).mockResolvedValue({ status: "publie" } as never);
    await expect(
      publierFicheExpressAction({}, form({ nom: "Autre nom", sujets: THEME })),
    ).rejects.toThrow("REDIRECT:/mon-espace");
    rienEcrit();
  });

  it("un champ statut forgé est ignoré", async () => {
    await expect(
      publierFicheExpressAction(
        {},
        form({ nom: "Léa M.", sujets: THEME, statut: "publie", status: "publie" }),
      ),
    ).rejects.toThrow("REDIRECT:/mon-espace?ok=fiche_envoyee");
    expect(vi.mocked(publierFiche).mock.calls[0][1]).toBe("en_attente");
  });
});
