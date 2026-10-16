import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";

/**
 * L'espace coaching d'une édition. Deux corrections d'usage :
 *
 * 1. Il enchaînait des cartes — ateliers puis coachées — sans jamais dire où
 *    commençait quoi. La rangée du hub promettait « les speakeuses que
 *    j'accompagne » et l'on tombait sur des ateliers. Les deux groupes sont
 *    maintenant TITRÉS, et les COACHÉES viennent d'abord.
 * 2. Le fil d'Ariane offrait « Mes coachings », page qui — avec une seule
 *    mission, le cas courant — redirige ICI : le maillon revenait donc sur la
 *    page courante.
 */

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));
vi.mock("@/lib/auth-guards", () => ({ requireCoachId: vi.fn(async () => 7) }));
vi.mock("@/lib/tremplin-editions", () => ({
  getEditionById: vi.fn(async () => ({ id: 2, nom: "Tremplin 2026" })),
}));
vi.mock("@/lib/tremplin-coachs", () => ({
  getCoachAteliers: vi.fn(async () => []),
  getCoachCoachees: vi.fn(async () => []),
  getCoachDocuments: vi.fn(async () => []),
  getCoachAtelierMembres: vi.fn(async () => new Map()),
}));
vi.mock("@/app/mon-espace/coaching/actions", () => ({ deleteOwnDocumentAction: vi.fn() }));
vi.mock("@/app/mon-espace/coaching/CoachDepotDialog", () => ({
  default: () => <button type="button">Déposer un document</button>,
}));

import { getCoachAteliers, getCoachCoachees } from "@/lib/tremplin-coachs";
import CoachingEdition from "@/app/mon-espace/coaching/[edition]/page";

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

const atelier = (id: number, titre: string) =>
  ({
    id,
    titre,
    date: "2026-05-05",
    dateFin: null,
    heureDebut: null,
    heureFin: null,
    lieu: null,
    lienVisio: null,
    audience: "toutes" as const,
  }) as never;

const rendu = async () =>
  render(await CoachingEdition({ params: Promise.resolve({ edition: "2" }) }));

describe("Espace coaching d'une édition", () => {
  beforeEach(() => {
    vi.mocked(getCoachAteliers).mockResolvedValue([
      atelier(11, "Pitcher son talk"),
    ]);
    vi.mocked(getCoachCoachees).mockResolvedValue([
      { registrationId: 5, nom: "Ada Lovelace", sujet: "Les compilateurs" },
    ]);
  });

  /**
   * Le hub dit « Mes coachées », cette page disait « Tes coachées » : le même
   * ensemble, nommé de deux façons entre le lien et sa destination — de quoi
   * douter d'être arrivée au bon endroit (relecture du 2026-08-16, F10). Un
   * seul patron sur l'écran, « Mes + nom courant », possessif VRAI.
   */
  it("les coachées viennent AVANT les ateliers, et les deux titres suivent le MÊME patron", async () => {
    await rendu();
    const titres = screen
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent);
    expect(titres).toEqual(["Mes coachées", "Mes ateliers"]);
  });

  it("chaque coachée est nommée sous son groupe (le nom suffit, le groupe le dit)", async () => {
    await rendu();
    const groupe = screen.getByRole("region", { name: /mes coachées/i });
    expect(
      within(groupe).getByRole("heading", { level: 3, name: "Ada Lovelace" }),
    ).toBeInTheDocument();
  });

  it("chaque séance mène à SA page (une carte mène à une page, pas à une ancre)", async () => {
    await rendu();
    expect(
      screen.getByRole("link", { name: /pitcher son talk/i }),
    ).toHaveAttribute("href", "/mon-espace/coaching/2/ateliers/11");
  });

  it("le fil ne repasse plus par « Mes coachings » (qui reviendrait ici)", async () => {
    await rendu();
    expect(screen.queryByRole("link", { name: /mes coachings/i })).toBeNull();
    expect(screen.getByRole("link", { name: /mon espace/i })).toHaveAttribute(
      "href",
      "/mon-espace",
    );
  });

  it("un groupe vide ne laisse pas de titre orphelin", async () => {
    vi.mocked(getCoachCoachees).mockResolvedValue([]);
    await rendu();
    expect(screen.queryByRole("heading", { name: /mes coachées/i })).toBeNull();
    expect(
      screen.getByRole("heading", { name: /mes ateliers/i }),
    ).toBeInTheDocument();
  });

  it("aucune mission dans cette édition : introuvable (pas de fuite d'existence)", async () => {
    vi.mocked(getCoachAteliers).mockResolvedValue([]);
    vi.mocked(getCoachCoachees).mockResolvedValue([]);
    await expect(rendu()).rejects.toThrow("NOT_FOUND");
  });
});
