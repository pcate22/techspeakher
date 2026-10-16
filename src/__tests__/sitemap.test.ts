// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Le sitemap DÉRIVE les URLs d'édition du Tremplin (dette P1) : écrites en
 * dur, une nouvelle édition n'y entrait pas seule, et une édition supprimée
 * (tombstone `noindex`) y serait restée listée.
 *
 * La sous-page « montée sur scène » ne s'y liste que si l'édition a un
 * chapitre 2 à montrer — MÊME prédicat que le 404 de la page
 * (`aUnChapitreMonteeSurScene`, source unique) : un sitemap qui pointe des
 * 404 fait exactement ce que le prédicat existe pour empêcher.
 */

vi.mock("@/lib/profiles", () => ({
  getPublishedAnnuaire: vi.fn().mockResolvedValue([]),
  speakeuseHref: vi.fn(),
}));
vi.mock("@/lib/contenus", () => ({
  listArticlesPublies: vi.fn().mockResolvedValue([]),
  listPagesPubliees: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/agenda-public", () => ({ getAnneesArchive: vi.fn().mockResolvedValue([]) }));
const listEditionsPubliques = vi.fn();
vi.mock("@/lib/tremplin-editions", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/tremplin-editions")>();
  return {
    ...actual,
    listEditionsPubliques: (...a: unknown[]) => listEditionsPubliques(...a),
  };
});
const getPublicEdition = vi.fn();
vi.mock("@/lib/tremplin-public", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/tremplin-public")>();
  return { ...actual, getPublicEdition: (...a: unknown[]) => getPublicEdition(...a) };
});

import sitemap from "@/app/sitemap";
import { BASE_URL } from "@/constants/site";

beforeEach(() => {
  listEditionsPubliques.mockReset();
  getPublicEdition.mockReset();
});

const urls = async () => (await sitemap()).map((r) => r.url);

const editionRef = (annee: number, confSlug: string | null = "devfest-toulouse") => ({
  id: annee,
  annee,
  confSlug,
  nom: `Tremplin ${annee}`,
  statut: "archive",
  deletedAt: null,
});

/** DTO public minimal : seul ce que le prédicat du chapitre 2 lit compte. */
const dto = (o: { ateliers?: { phase: string }[]; accompagnees?: unknown[] }) => ({
  ateliers: o.ateliers ?? [],
  accompagnees: o.accompagnees ?? [],
});

describe("sitemap — les URLs d'édition Tremplin viennent de la base", () => {
  it("liste chaque édition publique, et la montée sur scène de celles qui ont le chapitre", async () => {
    listEditionsPubliques.mockResolvedValue([
      editionRef(2027, "sunny-tech"),
      editionRef(2026),
    ]);
    getPublicEdition.mockImplementation((conf: string) =>
      Promise.resolve(
        conf === "devfest-toulouse"
          ? dto({ ateliers: [{ phase: "montee_sur_scene" }] })
          : dto({}),
      ),
    );
    const u = await urls();
    expect(u).toContain(`${BASE_URL}/tremplin/sunny-tech/2027`);
    expect(u).toContain(`${BASE_URL}/tremplin/devfest-toulouse/2026`);
    expect(u).toContain(`${BASE_URL}/tremplin/devfest-toulouse/2026/montee-sur-scene`);
    // Sunny Tech 2027 a une page d'édition, mais rien à montrer en chapitre 2.
    expect(u).not.toContain(`${BASE_URL}/tremplin/sunny-tech/2027/montee-sur-scene`);
  });

  it("base injoignable : le reste du sitemap survit, sans URL d'édition", async () => {
    listEditionsPubliques.mockRejectedValue(new Error("Neon dort"));
    const u = await urls();
    expect(u).toContain(`${BASE_URL}/tremplin`);
    expect(u).toContain(`${BASE_URL}/speakeuses`);
    expect(u.filter((x) => x.match(/\/tremplin\/.+/))).toEqual([]);
  });
});
