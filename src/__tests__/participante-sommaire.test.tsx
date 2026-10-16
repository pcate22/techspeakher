import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

/**
 * Lot C3c — la fiche participante devient un SOMMAIRE (une page = une
 * fonction) : une rangée par fonction avec l'état actuel en sous-titre, et des
 * sous-pages qui portent les formulaires (testées dans
 * participante-sous-pages.test.tsx).
 */

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
  redirect: vi.fn(),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/auth-guards", () => ({ requireOrgaId: vi.fn(async () => 1) }));
vi.mock("@/lib/tremplin-editions", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getEditionById: vi.fn(),
}));
vi.mock("@/lib/tremplin-registrations", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getRegistrationsByEdition: vi.fn(),
  getRegistrationTalkId: vi.fn(async () => null),
}));
vi.mock("@/lib/tremplin-registration-phases", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getPhaseMembersByEdition: vi.fn(async () => new Map()),
}));
vi.mock("@/lib/tremplin-documents", () => ({ getDocumentsByEdition: vi.fn(async () => []) }));
vi.mock("@/lib/tremplin-ateliers", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getAteliersByEdition: vi.fn(async () => []),
  getAtelierMembersByEdition: vi.fn(async () => new Map()),
}));
vi.mock("@/lib/tremplin-coachs", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getCoachsByRegistration: vi.fn(async () => []),
}));
vi.mock("@/lib/tremplin-recompenses", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getRecompensesByRegistration: vi.fn(async () => []),
}));

import { getEditionById } from "@/lib/tremplin-editions";
import { getRegistrationsByEdition } from "@/lib/tremplin-registrations";
import FicheParticipante from "@/app/admin/tremplins/[edition]/participantes/[registration]/page";

afterEach(cleanup);

const edition = { id: 3, nom: "Tremplin 2026", statut: "en_cours" } as never;
const registration = (o: object = {}) =>
  ({
    id: 7,
    editionId: 3,
    userId: null,
    userName: null,
    userEmail: null,
    participanteNom: "Ada Lovelace",
    participanteRole: "Dev",
    participanteLinkedin: null,
    statut: "acceptee",
    talkTitre: null,
    finalePresente: false,
    public: false,
    classement: null,
    titrePalmares: null,
    bio: null,
    siteWeb: null,
    photoUrl: null,
    phaseEntree: "cfp_et_pitch",
    ...o,
  }) as never;

const rendu = async () =>
  render(
    await FicheParticipante({
      params: Promise.resolve({ edition: "3", registration: "7" }),
    }),
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getEditionById).mockResolvedValue(edition);
  vi.mocked(getRegistrationsByEdition).mockResolvedValue([registration()]);
});

describe("fiche participante — sommaire", () => {
  it("chaque fonction est atteignable par un lien vers sa sous-page", async () => {
    await rendu();
    const base = "/admin/tremplins/3/participantes/7";
    const hrefs = screen
      .getAllByRole("link")
      .map((l) => l.getAttribute("href"));
    for (const sousPage of [
      "parcours",
      "classement",
      "recompenses",
      "coaching",
      "ateliers",
      "documents",
      "compte",
      "visibilite",
      "retrait",
    ]) {
      expect(hrefs).toContain(`${base}/${sousPage}`);
    }
    // Le sommaire ne porte aucun formulaire (édition sur les sous-pages).
    expect(screen.queryByRole("button", { name: /enregistrer/i })).toBeNull();
  });

  it("les sous-titres reflètent l'état : sans compte (signalé), masquée", async () => {
    await rendu();
    expect(screen.getByText(/sans compte relié/i)).toBeInTheDocument();
    expect(screen.getAllByText(/masquée du public/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/aucune phase pour l'instant/i)).toBeInTheDocument();
  });

  it("gagnante archivée (classée SANS talk) : son titre primé s'affiche, pas « À définir »", async () => {
    vi.mocked(getRegistrationsByEdition).mockResolvedValue([
      registration({
        classement: 2,
        finalePresente: true,
        talkTitre: null,
        titrePalmares: "Défier un GAFAM dans l'auto",
      }),
    ]);
    await rendu();
    // Le titre primé archivé apparaît (en-tête ET ligne « Talk pitché »),
    // marqué comme archive, et la ligne n'est plus « À définir ».
    expect(screen.getAllByText(/défier un gafam dans l'auto/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/titre primé archivé/i)).toBeInTheDocument();
    expect(screen.queryByText(/à définir/i)).toBeNull();
  });

  it("inscription inconnue → notFound", async () => {
    vi.mocked(getRegistrationsByEdition).mockResolvedValue([]);
    await expect(rendu()).rejects.toThrow("NOT_FOUND");
  });
});
