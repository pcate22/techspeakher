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
vi.mock("@/lib/users", () => ({
  setUserName: vi.fn(),
  getUserById: vi.fn(),
  getCompte: vi.fn(),
  peutCreerFiche: (g: string | null | undefined) => g !== "homme",
}));

import { auth } from "@/auth";
import {
  getProfileByUserId,
  publierFiche,
  upsertProfile,
  submitForValidation,
} from "@/lib/profiles";
import { setUserName, getCompte } from "@/lib/users";
import { publierFicheExpressAction } from "@/app/mon-espace/actions";
import { THEMES } from "@/data/domaines";

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
  vi.mocked(getCompte).mockResolvedValue({
    name: "Léa Martin",
    genre: null,
    image: null,
  });
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
    expect(r.errors?.nom).toBe("Indique ton prénom et ton nom.");
    rienEcrit();
  });

  it("aucun thème valide → « Choisis au moins un thème. »", async () => {
    const r = await publierFicheExpressAction({}, form({ nom: "Léa Martin", sujets: ["x"] }));
    expect(r.errors?.sujets).toBe("Choisis au moins un thème.");
    rienEcrit();
  });

  it("douze thèmes → les douze sont écrits (même règle que la fiche complète)", async () => {
    const douze = THEMES.slice(0, 12);
    await expect(
      publierFicheExpressAction({}, form({ nom: "Léa Martin", sujets: douze })),
    ).rejects.toThrow("REDIRECT:/mon-espace?ok=fiche_publiee");
    expect(publierFiche).toHaveBeenCalledWith(7, "publie", expect.objectContaining({ sujets: douze }));
  });

  it("nom du compte → publiée, attestation et contact posés", async () => {
    await expect(
      publierFicheExpressAction({}, form({ nom: "Léa Martin", sujets: [THEME, "x"] })),
    ).rejects.toThrow("REDIRECT:/mon-espace?ok=fiche_publiee");
    // Le nom s'écrit DANS la transaction de `publierFiche`, jamais avant.
    expect(publierFiche).toHaveBeenCalledWith(7, "publie", {
      nom: "Léa Martin",
      sujets: [THEME],
      slug: "lea-martin",
    });
    expect(setUserName).not.toHaveBeenCalled();
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

  it("compte « homme » → /mon-espace, rien d'écrit (POST direct)", async () => {
    vi.mocked(getCompte).mockResolvedValue({ name: "Paul", genre: "homme", image: null } as never);
    await expect(
      publierFicheExpressAction({}, form({ nom: "Paul", sujets: THEME })),
    ).rejects.toThrow("REDIRECT:/mon-espace");
    rienEcrit();
  });

  it("slug pris entre la vérification et l'écriture → second essai", async () => {
    vi.mocked(publierFiche)
      .mockRejectedValueOnce(Object.assign(new Error("dup"), { code: "23505" }))
      .mockResolvedValueOnce(true);
    await expect(
      publierFicheExpressAction({}, form({ nom: "Léa Martin", sujets: THEME })),
    ).rejects.toThrow("REDIRECT:/mon-espace?ok=fiche_publiee");
    expect(publierFiche).toHaveBeenCalledTimes(2);
  });

  it("deux collisions → message, pas d'erreur serveur", async () => {
    vi.mocked(publierFiche).mockRejectedValue(
      Object.assign(new Error("dup"), { code: "23505" }),
    );
    const r = await publierFicheExpressAction({}, form({ nom: "Léa Martin", sujets: THEME }));
    expect(r.errors?.form).toBeTruthy();
    expect(publierFiche).toHaveBeenCalledTimes(2);
  });
});
