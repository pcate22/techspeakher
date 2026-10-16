import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

/**
 * Supprimer un atelier depuis LA LISTE : jusqu'ici il fallait ouvrir la fiche,
 * descendre au sommaire, ouvrir la page de retrait, cliquer, puis confirmer
 * dans une modale — cinq écrans pour retirer un doublon créé deux minutes plus
 * tôt.
 *
 * La rangée se glisse vers la gauche et découvre sa poubelle : DEUX actions,
 * quoi que porte l'atelier (décision produit du 01/08 — un atelier n'est pas
 * assez critique pour qu'on fasse retaper son titre). Ce qui tient à la place :
 * la rangée dit déjà ce que l'atelier porte, et la confirmation redit ce qui
 * est parti avec lui.
 */

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
  redirect: vi.fn(),
  useSelectedLayoutSegment: vi.fn(() => null),
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/lib/auth-guards", () => ({ requireOrgaId: vi.fn(async () => 1) }));
vi.mock("@/lib/tremplin-admin", () => ({
  loadEditionOrNotFound: vi.fn(async () => ({
    editionId: 3,
    edition: { id: 3, nom: "Tremplin 2026", finaleDate: null },
  })),
}));
vi.mock("@/lib/tremplin-ateliers", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getAteliersByEdition: vi.fn(),
  getAtelierMembersByEdition: vi.fn(async () => new Map()),
  getSousGroupesByEdition: vi.fn(async () => new Map()),
  getTaillesCohortesByEdition: vi.fn(async () => new Map()),
}));
vi.mock("@/lib/tremplin-registrations", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  countRegistrationsByEdition: vi.fn(async () => 3),
}));
vi.mock("@/lib/tremplin-documents", () => ({
  countDocumentsByEdition: vi.fn(async () => new Map()),
}));
vi.mock("@/lib/tremplin-coachs", () => ({ getCoachsByEdition: vi.fn(async () => new Map()) }));
vi.mock("@/lib/tremplin-statut", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  aujourdhuiParis: vi.fn(() => "2026-07-10"),
}));
vi.mock("@/app/admin/tremplins/[edition]/AddAtelierDialog", () => ({
  default: () => <button type="button">Ajouter un atelier</button>,
}));

import { getAteliersByEdition, getAtelierMembersByEdition } from "@/lib/tremplin-ateliers";
import { countDocumentsByEdition } from "@/lib/tremplin-documents";
import AteliersIndex from "@/app/admin/tremplins/[edition]/ateliers/page";

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

const atelier = (o: Partial<Record<string, unknown>> = {}) =>
  ({
    id: 1,
    editionId: 3,
    ordre: 1,
    titre: "Atelier",
    date: "2026-08-05",
    dateFin: null,
    heureDebut: null,
    heureFin: null,
    description: null,
    lieu: null,
    lienVisio: null,
    coachs: null,
    phase: "cfp_et_pitch",
    nature: "collectif",
    audience: "toutes" as const,
    ...o,
  }) as never;

const rendu = async (vue?: string) =>
  render(
    await AteliersIndex({
      params: Promise.resolve({ edition: "3" }),
      searchParams: Promise.resolve(vue ? { vue } : {}),
    }),
  );

describe("Ateliers — la poubelle au bout du glissement", () => {
  beforeEach(() => {
    vi.mocked(getAteliersByEdition).mockResolvedValue([
      atelier({ id: 1, titre: "Atelier créé en double" }),
      atelier({ id: 2, titre: "Répétition générale" }),
    ]);
  });

  it("chaque rangée porte une poubelle qui la NOMME", async () => {
    await rendu();
    expect(
      screen.getByRole("button", { name: "Supprimer : Atelier créé en double" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Supprimer : Répétition générale" }),
    ).toBeInTheDocument();
  });

  it("la rangée reste d'abord un lien vers la fiche de l'atelier", async () => {
    await rendu();
    expect(screen.getByRole("link", { name: /atelier créé en double/i })).toHaveAttribute(
      "href",
      "/admin/tremplins/3/ateliers/1",
    );
  });

  it("le geste est ANNONCÉ : rien ne se découvre par tâtonnement", async () => {
    await rendu();
    expect(screen.getByText(/glisse une rangée vers la gauche/i)).toBeInTheDocument();
  });

  it("atelier INVESTI : sa poubelle supprime aussi, sans détour par une autre page", async () => {
    vi.mocked(getAtelierMembersByEdition).mockResolvedValue(
      new Map([[2, [{ registrationId: 9, presence: "non_renseignee" }]]]) as never,
    );
    vi.mocked(countDocumentsByEdition).mockResolvedValue(new Map([[2, 2]]));
    await rendu();
    expect(
      screen.getByRole("button", { name: "Supprimer : Répétition générale" }),
    ).toBeInTheDocument();
    // Aucune poubelle-lien : plus de page à traverser pour confirmer.
    expect(screen.queryByRole("link", { name: /^supprimer : / })).toBeNull();
  });

  it("la rangée dit ce que l'atelier porte AVANT le geste (le filet qui reste)", async () => {
    vi.mocked(getAtelierMembersByEdition).mockResolvedValue(
      new Map([[2, [{ registrationId: 9, presence: "non_renseignee" }]]]) as never,
    );
    vi.mocked(countDocumentsByEdition).mockResolvedValue(new Map([[2, 2]]));
    await rendu();
    expect(screen.getByRole("link", { name: /^répétition générale/i })).toHaveTextContent(
      /2 supports/i,
    );
  });

  it("le PROGRAMME garde ses flèches et se passe du glissement", async () => {
    // Deux gestes horizontaux concurrents sur la même rangée (glisser pour
    // supprimer, monter/descendre d'un rang) : le programme reste au clavier.
    await rendu("programme");
    expect(screen.queryByRole("button", { name: /^supprimer : /i })).toBeNull();
    expect(screen.getAllByRole("button", { name: /descendre/i }).length).toBeGreaterThan(0);
  });
});
