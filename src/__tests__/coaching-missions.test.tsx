import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

/**
 * « Mes coachings » listait les éditions où l'on anime. Avec UNE seule mission —
 * le cas courant — ce n'était pas un choix mais un péage d'un tap avant le
 * travail réel : une page entière pour une rangée « Tremplin 2026 · 4 ateliers ».
 *
 * Règle posée : aucune page de l'espace n'existe pour désigner une édition.
 * L'onglet mène au travail ; la liste ne s'affiche que là où il y a vraiment à
 * choisir. (« Mes documents » n'a jamais fait choisir : il aplatit en sections.)
 */

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  notFound: vi.fn(),
}));
vi.mock("@/lib/auth-guards", () => ({ requireCoachId: vi.fn(async () => 7) }));
vi.mock("@/lib/tremplin-coachs", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getCoachEditions: vi.fn(),
}));

import { getCoachEditions } from "@/lib/tremplin-coachs";
import MesCoachings from "@/app/mon-espace/coaching/page";

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

const mission = (editionId: number, nom: string) =>
  ({ editionId, nom, nbAteliers: 4, nbCoachees: 0 }) as never;

describe("Mes coachings — pas de page pour désigner une édition", () => {
  it("une seule mission : on va DIRECTEMENT au travail", async () => {
    vi.mocked(getCoachEditions).mockResolvedValue([mission(2, "Tremplin 2026")]);
    await expect(MesCoachings()).rejects.toThrow("REDIRECT:/mon-espace/coaching/2");
  });

  it("plusieurs missions : la liste existe, elle a alors un vrai rôle", async () => {
    vi.mocked(getCoachEditions).mockResolvedValue([
      mission(1, "Tremplin 2025"),
      mission(2, "Tremplin 2026"),
    ]);
    render(await MesCoachings());
    expect(screen.getByRole("link", { name: /tremplin 2025/i })).toHaveAttribute(
      "href",
      "/mon-espace/coaching/1",
    );
    expect(screen.getByRole("link", { name: /tremplin 2026/i })).toHaveAttribute(
      "href",
      "/mon-espace/coaching/2",
    );
  });

  it("aucune mission : on l'explique, on ne redirige pas dans le vide", async () => {
    vi.mocked(getCoachEditions).mockResolvedValue([]);
    render(await MesCoachings());
    expect(screen.getByText(/aucune mission/i)).toBeInTheDocument();
  });
});
