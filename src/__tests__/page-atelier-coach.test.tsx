import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";

expect.extend(toHaveNoViolations);

/**
 * LA page d'un atelier, côté coach.
 *
 * La garde est la LISTE elle-même : `getCoachAteliers` ne renvoie que les
 * ateliers que ce compte anime dans cette édition. Un atelier qu'elle n'anime
 * pas est donc introuvable — pas de fuite d'existence, et rien à re-vérifier
 * ailleurs. C'est ce que ce fichier verrouille.
 */

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/lib/auth-guards", () => ({ requireCoachId: vi.fn(async () => 7) }));
vi.mock("@/lib/tremplin-editions", () => ({
  getEditionById: vi.fn(async () => ({ id: 2, nom: "Tremplin 2026" })),
}));
vi.mock("@/lib/tremplin-coachs", () => ({
  getCoachAteliers: vi.fn(),
  getCoachDocuments: vi.fn(async () => []),
  getCoachAtelierMembres: vi.fn(async () => new Map()),
}));
vi.mock("@/app/mon-espace/coaching/actions", () => ({ deleteOwnDocumentAction: vi.fn() }));
vi.mock("@/app/mon-espace/coaching/CoachDepotDialog", () => ({
  default: () => <button type="button">Déposer un document</button>,
}));

import {
  getCoachAteliers,
  getCoachDocuments,
  getCoachAtelierMembres,
} from "@/lib/tremplin-coachs";
import AtelierCoache from "@/app/mon-espace/coaching/[edition]/ateliers/[atelier]/page";

afterEach(cleanup);

const atelier = (o: object = {}) =>
  ({
    id: 10,
    titre: "Pitcher son talk",
    date: "2026-09-01",
    dateFin: null,
    heureDebut: "18:30",
    heureFin: "20:00",
    lieu: "BPCE, Toulouse",
    lienVisio: null,
    audience: "selection" as const,
    ...o,
  }) as never;

const rendu = () =>
  AtelierCoache({ params: Promise.resolve({ edition: "2", atelier: "10" }) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCoachAteliers).mockResolvedValue([atelier()]);
  vi.mocked(getCoachDocuments).mockResolvedValue([]);
  vi.mocked(getCoachAtelierMembres).mockResolvedValue(new Map());
});

describe("Page d'un atelier — coach", () => {
  it("ouvre la séance qu'elle anime : quand, où, avec qui", async () => {
    vi.mocked(getCoachAtelierMembres).mockResolvedValue(
      new Map([[10, ["Léa Dubois", "Manon Girard"]]]) as never,
    );
    render(await rendu());
    expect(
      screen.getByRole("heading", { level: 1, name: /pitcher son talk/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Léa Dubois, Manon Girard/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /déposer un document/i })).toBeInTheDocument();
  });

  /**
   * Sans nom à afficher, la coach lit QUI est concerné — l'audience de la
   * séance — plutôt qu'un « aucune participante » qui ne lui apprend rien sur
   * le monde à qui elle va parler.
   */
  it("sans participante désignée, la séance dit quand même qui elle concerne", async () => {
    render(await rendu());
    expect(screen.getByText(/une sélection de participantes/i)).toBeInTheDocument();
  });

  it("ses dépôts, et seulement ceux de CETTE séance", async () => {
    vi.mocked(getCoachDocuments).mockResolvedValue([
      { id: 1, atelierId: 10, registrationId: null, titre: "Trame commune", lien: "https://ex.org/a", contenu: null, estAuteur: true },
      { id: 2, atelierId: 99, registrationId: null, titre: "Support d'une autre séance", lien: "https://ex.org/b", contenu: null, estAuteur: true },
    ] as never);
    render(await rendu());
    expect(screen.getByRole("link", { name: /trame commune/i })).toBeInTheDocument();
    expect(screen.queryByText(/support d'une autre séance/i)).toBeNull();
  });

  // ── La garde ──────────────────────────────────────────────────────────────

  it("un atelier qu'elle N'ANIME PAS : introuvable (aucune fuite d'existence)", async () => {
    vi.mocked(getCoachAteliers).mockResolvedValue([atelier({ id: 42 })]);
    await expect(rendu()).rejects.toThrow("NOT_FOUND");
  });

  it("aucune mission dans cette édition : introuvable", async () => {
    vi.mocked(getCoachAteliers).mockResolvedValue([]);
    await expect(rendu()).rejects.toThrow("NOT_FOUND");
  });

  it("id non entier dans l'URL : introuvable", async () => {
    await expect(
      AtelierCoache({ params: Promise.resolve({ edition: "2", atelier: "abc" }) }),
    ).rejects.toThrow("NOT_FOUND");
  });

  it("aucune violation a11y (axe)", async () => {
    const { container } = render(await rendu());
    expect(await axe(container)).toHaveNoViolations();
  });
});
