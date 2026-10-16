import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";

expect.extend(toHaveNoViolations);

/**
 * LA page d'un atelier, côté participante. Les trois rôles ont enfin la même
 * règle que l'orga : une carte d'agenda mène à une PAGE, plus à une ancre au
 * milieu d'une liste de quinze.
 *
 * Ce qui se teste ici et nulle part ailleurs : les DEUX gardes, dans l'ordre.
 * Être inscrite à l'édition, puis que CET atelier lui soit visible — un atelier
 * réservé à d'autres reste introuvable, ses supports avec.
 */

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
  redirect: vi.fn((p: string) => {
    throw new Error(`REDIRECT:${p}`);
  }),
  // `SousGroupeDetail` passe par InlineActionForm (client) → useRouter.
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/tremplin-editions", () => ({
  getEditionById: vi.fn(async () => ({ id: 2, nom: "Tremplin 2026" })),
}));
vi.mock("@/lib/tremplin-registrations", () => ({ getRegistrationByUser: vi.fn() }));
vi.mock("@/lib/tremplin-ateliers", () => ({
  getAtelierById: vi.fn(),
  getAtelierMembers: vi.fn(async () => []),
  getMesSousGroupes: vi.fn(async () => []),
}));
vi.mock("@/lib/tremplin-documents", () => ({ getSharedDocuments: vi.fn(async () => []) }));
vi.mock("@/app/mon-espace/tremplin/actions", () => ({ setMonSousGroupeFaitLeAction: vi.fn() }));

import { auth } from "@/auth";
import { getRegistrationByUser } from "@/lib/tremplin-registrations";
import {
  getAtelierById,
  getAtelierMembers,
  getMesSousGroupes,
} from "@/lib/tremplin-ateliers";
import { getSharedDocuments } from "@/lib/tremplin-documents";
import MonAtelier, {
  generateMetadata,
} from "@/app/mon-espace/tremplin/[edition]/ateliers/[atelier]/page";
import { makeMonSousGroupe } from "./test-helpers";

afterEach(cleanup);

const atelier = (o: object = {}) =>
  ({
    id: 10,
    editionId: 2,
    ordre: 1,
    titre: "Lancement et structure du talk",
    date: "2026-09-01",
    dateFin: null,
    heureDebut: "18:30",
    heureFin: "20:00",
    description: null,
    lieu: "BPCE, Toulouse",
    lienVisio: null,
    coachs: "Sofia Nguyen",
    phase: "cfp_et_pitch",
    nature: "collectif",
    audience: "toutes" as const,
    ...o,
  }) as never;

const rendu = () =>
  MonAtelier({ params: Promise.resolve({ edition: "2", atelier: "10" }) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({
    user: { id: "7", name: "Léa", isOrga: false },
  } as never);
  vi.mocked(getRegistrationByUser).mockResolvedValue({ id: 5 } as never);
  vi.mocked(getAtelierById).mockResolvedValue(atelier());
  vi.mocked(getAtelierMembers).mockResolvedValue([]);
  vi.mocked(getMesSousGroupes).mockResolvedValue([]);
  vi.mocked(getSharedDocuments).mockResolvedValue([]);
});

describe("Page d'un atelier — participante", () => {
  it("ouvre la séance : quand, où, avec qui", async () => {
    render(await rendu());
    expect(
      screen.getByRole("heading", { level: 1, name: /lancement et structure du talk/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/BPCE, Toulouse/)).toBeInTheDocument();
    expect(screen.getByText(/Sofia Nguyen/)).toBeInTheDocument();
  });

  it("ses supports, et seulement ceux de CETTE séance", async () => {
    vi.mocked(getSharedDocuments).mockResolvedValue([
      { id: 1, atelierId: 10, titre: "Trame d'abstract", lien: "https://ex.org/a", contenu: null },
      { id: 2, atelierId: 99, titre: "Support d'une autre séance", lien: "https://ex.org/b", contenu: null },
    ] as never);
    render(await rendu());
    expect(screen.getByRole("link", { name: /trame d'abstract/i })).toBeInTheDocument();
    expect(screen.queryByText(/support d'une autre séance/i)).toBeNull();
  });

  it("son sous-groupe quand la séance se fait en duo, rien sinon", async () => {
    vi.mocked(getMesSousGroupes).mockResolvedValue([
      makeMonSousGroupe({ nbCoachs: 0, coachNoms: [], coMembres: ["Camille"] }),
    ] as never);
    render(await rendu());
    expect(screen.getByRole("heading", { name: /ton sous-groupe/i })).toBeInTheDocument();
    expect(screen.getByText(/camille/i)).toBeInTheDocument();
  });

  /**
   * « éventuellement une ou plusieurs coachs dedans » : la base n'en acceptait
   * qu'une. L'espace de la participante NOMME les siennes, au pluriel quand il y
   * en a plusieurs, sans jamais montrer d'e-mail.
   */
  it("son sous-groupe nomme SES coachs, au pluriel quand elles sont deux", async () => {
    vi.mocked(getMesSousGroupes).mockResolvedValue([
      makeMonSousGroupe({ nbCoachs: 2, coachNoms: ["Sofia Nguyen", "Lucile Martin"], coMembres: ["Camille"] }),
    ] as never);
    render(await rendu());
    expect(screen.getByText(/coachs/i)).toBeInTheDocument();
    expect(screen.getByText(/Sofia Nguyen et Lucile Martin/)).toBeInTheDocument();
  });

  /** Un point individuel avec sa coach : dire ce qui EST (un tête-à-tête),
   * jamais un « tu es seule » anxiogène pour un 1-1 voulu. */
  it("une seule coach et personne d'autre : un tête-à-tête, pas une solitude", async () => {
    vi.mocked(getMesSousGroupes).mockResolvedValue([
      makeMonSousGroupe({ nbCoachs: 1, coachNoms: ["Sofia Nguyen"], coMembres: [] }),
    ] as never);
    render(await rendu());
    expect(screen.getByText(/en tête-à-tête avec ta coach/i)).toBeInTheDocument();
    expect(screen.queryByText(/tu es seule/i)).toBeNull();
  });

  it("séance collective : pas de cadre « sous-groupe » vide", async () => {
    render(await rendu());
    expect(screen.queryByRole("heading", { name: /ton sous-groupe/i })).toBeNull();
  });

  // ── Les gardes ────────────────────────────────────────────────────────────

  it("hors session : direction la connexion", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    await expect(rendu()).rejects.toThrow("REDIRECT:/connexion");
  });

  it("non inscrite à l'édition : introuvable (aucune fuite de support)", async () => {
    vi.mocked(getRegistrationByUser).mockResolvedValue(null as never);
    await expect(rendu()).rejects.toThrow("NOT_FOUND");
  });

  it("atelier RÉSERVÉ à d'autres : introuvable, même inscrite à l'édition", async () => {
    vi.mocked(getAtelierById).mockResolvedValue(atelier({ audience: "selection" as const }));
    vi.mocked(getAtelierMembers).mockResolvedValue([404] as never); // pas son inscription (5)
    await expect(rendu()).rejects.toThrow("NOT_FOUND");
  });

  it("atelier réservé DONT elle est membre : visible", async () => {
    vi.mocked(getAtelierById).mockResolvedValue(atelier({ audience: "selection" as const }));
    vi.mocked(getAtelierMembers).mockResolvedValue([5] as never);
    render(await rendu());
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("atelier d'une AUTRE édition : introuvable (la lecture est scopée)", async () => {
    vi.mocked(getAtelierById).mockResolvedValue(null as never);
    await expect(rendu()).rejects.toThrow("NOT_FOUND");
  });

  it("id non entier dans l'URL : introuvable", async () => {
    await expect(
      MonAtelier({ params: Promise.resolve({ edition: "2", atelier: "abc" }) }),
    ).rejects.toThrow("NOT_FOUND");
  });

  /**
   * Une panne de lecture n'a pas le droit de se déguiser en réponse.
   * `getAtelierMembers` alimente `atelierVisiblePour` : se rabattre sur `[]`
   * ferait décider l'autorisation sur une liste vide obtenue par erreur. Et
   * répondre « aucun support » quand la table est injoignable, c'est affirmer
   * faux. Dans les deux cas l'erreur doit remonter.
   */
  it("membres injoignables : l'erreur remonte, l'autorisation ne se décide pas sur un repli", async () => {
    vi.mocked(getAtelierById).mockResolvedValue(atelier({ audience: "selection" as const }));
    vi.mocked(getAtelierMembers).mockRejectedValue(new Error("DB down"));
    await expect(rendu()).rejects.toThrow("DB down");
  });

  it("supports injoignables : l'erreur remonte plutôt que d'affirmer qu'il n'y en a aucun", async () => {
    vi.mocked(getSharedDocuments).mockRejectedValue(new Error("DB down"));
    await expect(rendu()).rejects.toThrow("DB down");
  });

  /**
   * Le sous-groupe, lui, EST optionnel : la migration 047 n'est pas forcément
   * jouée. La séance s'affiche quand même — mais la panne se journalise, elle
   * ne s'avale pas.
   */
  it("sous-groupes injoignables : la séance s'affiche, et la panne est journalisée", async () => {
    const erreur = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(getMesSousGroupes).mockRejectedValue(new Error("relation absente"));
    render(await rendu());
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /ton sous-groupe/i })).toBeNull();
    expect(erreur).toHaveBeenCalled();
    erreur.mockRestore();
  });

  it("aucune violation a11y (axe)", async () => {
    const { container } = render(await rendu());
    expect(await axe(container)).toHaveNoViolations();
  });

  /**
   * RGAA 8.6 : un titre de page qui dit de quoi il s'agit. « Mon atelier »
   * répété quinze fois ne distingue rien dans une barre d'onglets ni dans un
   * historique. Le nom de l'édition, lui, est public — aucune fuite à le dire.
   */
  it("le titre nomme l'édition, et la page reste hors moteurs", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ edition: "2" }) });
    expect(meta.title).toMatch(/Tremplin 2026/);
    expect(meta.robots).toMatchObject({ index: false });
  });
});
