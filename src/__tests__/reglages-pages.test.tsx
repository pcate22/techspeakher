import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

/**
 * Lot C4 — réglages de la plateforme : sommaire (une rangée par réglage,
 * valeur en sous-titre), sous-page mono-fonction, et garde-fous de l'action
 * (orga seulement, clé connue, entier borné).
 */

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
  redirect: vi.fn(),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth-guards", () => ({ requireOrgaId: vi.fn(async () => 1) }));
vi.mock("@/lib/reglages", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getReglages: vi.fn(),
  setReglage: vi.fn(),
}));

import { requireOrgaId } from "@/lib/auth-guards";
import { getReglages, setReglage, REGLAGES_DEFAUT } from "@/lib/reglages";
import ReglagesPage from "@/app/admin/reglages/page";
import ReglagePage from "@/app/admin/reglages/[cle]/page";
import { setReglageAction } from "@/app/admin/reglages/actions";
import { IDLE } from "@/lib/action-state";

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireOrgaId).mockResolvedValue(1);
  vi.mocked(getReglages).mockResolvedValue({ ...REGLAGES_DEFAUT, validation_fiche_jours: 10 });
});

const fd = (entries: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
};

describe("/admin/reglages — sommaire", () => {
  it("une rangée par réglage, valeur effective en sous-titre", async () => {
    render(await ReglagesPage());
    expect(screen.getByRole("heading", { level: 1, name: "Réglages" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /délai de validation d'une fiche/i }),
    ).toHaveAttribute("href", "/admin/reglages/validation_fiche_jours");
    expect(screen.getByText("10 jours")).toBeInTheDocument();
    expect(screen.getByText("7 jours")).toBeInTheDocument();
    expect(screen.getByText("180 jours")).toBeInTheDocument();
  });
});

describe("/admin/reglages/[cle] — sous-page mono-fonction", () => {
  it("champ pré-rempli avec la valeur effective, un seul CTA", async () => {
    render(
      await ReglagePage({ params: Promise.resolve({ cle: "validation_fiche_jours" }) }),
    );
    expect(
      screen.getByRole("heading", { level: 1, name: /délai de validation/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/nombre de jours/i)).toHaveValue(10);
    expect(screen.getAllByRole("button", { name: /enregistrer/i })).toHaveLength(1);
    expect(screen.getByRole("link", { name: /retour aux réglages/i })).toHaveAttribute(
      "href",
      "/admin/reglages",
    );
  });

  it("clé inconnue → notFound, y compris une clé du prototype", async () => {
    for (const cle of ["pouet", "toString"]) {
      await expect(
        ReglagePage({ params: Promise.resolve({ cle }) }),
      ).rejects.toThrow("NOT_FOUND");
    }
  });
});

describe("setReglageAction — garde-fous", () => {
  it("exige l'autorisation orga", async () => {
    vi.mocked(requireOrgaId).mockRejectedValue(new Error("REDIRECT"));
    await expect(
      setReglageAction(IDLE, fd({ cle: "validation_fiche_jours", valeur: "10" })),
    ).rejects.toThrow("REDIRECT");
    expect(setReglage).not.toHaveBeenCalled();
  });

  it("refuse une clé inconnue, y compris une clé du prototype (toString…)", async () => {
    for (const cle of ["pouet", "toString", "valueOf", "constructor"]) {
      const r = await setReglageAction(IDLE, fd({ cle, valeur: "10" }));
      expect(r.status).toBe("error");
    }
    expect(setReglage).not.toHaveBeenCalled();
  });

  it("refuse hors bornes ou non entier (1 à 365)", async () => {
    for (const valeur of ["0", "366", "3.5", "abc", ""]) {
      const r = await setReglageAction(IDLE, fd({ cle: "alerte_atelier_jours", valeur }));
      expect(r.status).toBe("error");
    }
    expect(setReglage).not.toHaveBeenCalled();
  });

  it("enregistre une valeur valide", async () => {
    const r = await setReglageAction(IDLE, fd({ cle: "alerte_atelier_jours", valeur: "14" }));
    expect(r.status).toBe("success");
    expect(setReglage).toHaveBeenCalledWith("alerte_atelier_jours", 14);
  });
});
