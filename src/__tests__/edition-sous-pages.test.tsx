import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * Sous-pages mono-fonction du hub d'édition (« une page = une fonction »,
 * hiérarchie par fréquence : le « une fois » quitte le hub) : Informations
 * (champs éditoriaux), Statut (c'est ici qu'on ouvre), Retrait (danger).
 */

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
  redirect: vi.fn(),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/auth-guards", () => ({ requireOrgaId: vi.fn(async () => 1) }));
vi.mock("@/lib/conferences", () => ({ listEditionOptions: vi.fn(async () => []) }));
vi.mock("@/lib/tremplin-editions", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getEditionById: vi.fn(),
  aujourdhuiParis: vi.fn(() => "2026-07-10"),
  getEditionDeletionCounts: vi.fn(async () => ({ nbParticipantes: 0, nbAteliers: 1, nbPhotos: 0, total: 1 })),
}));
vi.mock("@/lib/tremplin-ateliers", () => ({
  getAteliersByEdition: vi.fn(async () => []),
  getAtelierMembersByEdition: vi.fn(async () => new Map()),
}));
vi.mock("@/lib/tremplin-coachs", () => ({ getCoachsByEdition: vi.fn(async () => new Map()) }));
vi.mock("@/lib/tremplin-recompenses", () => ({ getRecompensesByEdition: vi.fn(async () => []) }));
vi.mock("@/lib/tremplin-photos", () => ({
  getPhotosByEdition: vi.fn(async () => []),
  getPhotoTagsByEdition: vi.fn(async () => new Map()),
  photoPubliable: vi.fn(() => true),
}));
vi.mock("@/lib/tremplin-registrations", () => ({
  getRegistrationsByEdition: vi.fn(async () => []),
}));
vi.mock("@/app/admin/tremplins/actions", () => ({
  updateEditionAction: vi.fn(),
  setEditionStatutAction: vi.fn(),
  deleteEditionAction: vi.fn(),
}));

import { getEditionById, getEditionDeletionCounts } from "@/lib/tremplin-editions";
import InfosEdition from "@/app/admin/tremplins/[edition]/infos/page";
import StatutEdition from "@/app/admin/tremplins/[edition]/statut/page";
import RetraitEdition from "@/app/admin/tremplins/[edition]/retrait/page";

afterEach(cleanup);

const params = Promise.resolve({ edition: "3" });
const edition = {
  id: 3,
  nom: "Tremplin 2026",
  annee: 2026,
  confSlug: "devfest-toulouse",
  statut: "preparation",
  description: null,
  confNom: "DevFest",
  confLieu: "Toulouse",
  confDate: null,
  confLien: null,
  finaleDate: "2026-11-12",
  finaleLieu: null,
  inscriptionsDebut: null,
  inscriptionsFin: null,
  deletedAt: null,
} as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getEditionById).mockResolvedValue(edition);
});

const retour = () => screen.getByRole("link", { name: /retour à l'édition/i });

describe("sous-pages du hub d'édition — une page, une fonction", () => {
  it("infos : champs éditoriaux pré-remplis, SANS le statut ; URL publique gelée", async () => {
    render(await InfosEdition({ params }));
    expect(screen.getByRole("heading", { level: 1, name: /informations/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/nom de l'édition/i)).toHaveValue("Tremplin 2026");
    expect(screen.getByLabelText(/conférence \(sans la ville/i)).toHaveValue("DevFest");
    // Libellé exact : une date renseignée affiche aussi un bouton « Effacer »
    // dont l'aria-label contient le libellé (une regex matcherait les deux).
    expect(screen.getByLabelText("Date de la soirée finale (optionnel)")).toHaveValue("2026-11-12");
    // Le statut a sa propre sous-page.
    expect(screen.queryByLabelText(/statut/i)).toBeNull();
    expect(screen.getByText(/renommer la conférence ne la change pas/i)).toBeInTheDocument();
    expect(retour()).toHaveAttribute("href", "/admin/tremplins/3");
  });

  it("statut : sélecteur pré-rempli + visibilité expliquée (c'est ici qu'on ouvre)", async () => {
    render(await StatutEdition({ params }));
    expect(screen.getByRole("heading", { level: 1, name: /statut/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/statut de l'édition/i)).toHaveValue("preparation");
    expect(screen.getAllByText(/invisible du public/i).length).toBeGreaterThanOrEqual(1);
    expect(retour()).toBeInTheDocument();
  });

  // Palier 3 des deux côtés : « en préparation » efface plus qu'une édition
  // publiée (hard delete cascadant), le statut ne dégrade pas le garde-fou.
  // Le palier se lit sur l'EFFET : un brouillon qui ne porte rien n'emporte
  // rien en partant, lui imposer une saisie serait du rite, pas un filet.
  it("retrait : une édition VIDE se supprime sans rien retaper", async () => {
    const u = userEvent.setup();
    vi.mocked(getEditionDeletionCounts).mockResolvedValueOnce({
      nbParticipantes: 0,
      nbAteliers: 0,
      nbPhotos: 0,
      total: 0,
    });
    render(await RetraitEdition({ params, searchParams: Promise.resolve({}) }));
    await u.click(screen.getByRole("button", { name: /supprimer cette édition/i }));
    expect(screen.queryByLabelText(/réécris le nom de l’édition/i)).toBeNull();
    expect(
      screen.getByRole("button", { name: /supprimer définitivement/i }),
    ).toHaveAttribute("aria-disabled", "false");
  });

  it("retrait : périmètre chiffré + type-to-confirm, même en préparation", async () => {
    const u = userEvent.setup();
    render(await RetraitEdition({ params, searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("heading", { level: 1, name: /suppression/i })).toBeInTheDocument();
    expect(screen.getByText(/supprime définitivement/i)).toBeInTheDocument();

    await u.click(screen.getByRole("button", { name: /supprimer cette édition/i }));
    expect(screen.getByLabelText(/réécris le nom de l’édition/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /supprimer définitivement/i }),
    ).toHaveAttribute("aria-disabled", "true");
  });
});
