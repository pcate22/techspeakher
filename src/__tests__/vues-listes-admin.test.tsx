import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

/**
 * Les tâches groupées du cockpit menaient au SOMMET d'une liste : « Donner une
 * date à 3 ateliers » ouvrait les quinze ateliers de l'édition, à charge de
 * retrouver les trois. Chacune mène désormais à sa VUE (`?vue=…`) : la liste
 * réduite à son sujet, avec un retour explicite vers tout.
 */

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
  redirect: vi.fn(),
  useSelectedLayoutSegment: vi.fn(() => null),
  // Le programme porte des formulaires d'action (monter / descendre) :
  // `InlineActionForm` rafraîchit la route au succès.
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/lib/auth-guards", () => ({ requireOrgaId: vi.fn(async () => 1) }));
vi.mock("@/lib/tremplin-admin", () => ({
  loadEditionOrNotFound: vi.fn(async () => ({
    editionId: 3,
    edition: { id: 3, nom: "Tremplin 2026", finaleDate: null },
  })),
}));
// Les fonctions PURES du module restent réelles (tri, libellés de phase) : la
// page s'en sert pour ordonner et titrer.
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

import {
  getAteliersByEdition,
  getAtelierMembersByEdition,
  getSousGroupesByEdition,
  getTaillesCohortesByEdition,
} from "@/lib/tremplin-ateliers";
import { loadEditionOrNotFound } from "@/lib/tremplin-admin";
import AteliersIndex from "@/app/admin/tremplins/[edition]/ateliers/page";

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

const atelier = (o: Partial<Record<string, unknown>> = {}) =>
  ({
    id: 1,
    editionId: 3,
    ordre: 1,
    titre: "Atelier",
    date: "2026-05-05",
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

describe("Ateliers — vue « À dater »", () => {
  beforeEach(() => {
    vi.mocked(getAteliersByEdition).mockResolvedValue([
      atelier({ id: 1, titre: "Lancement du talk", date: "2026-05-05" }),
      atelier({ id: 2, titre: "Écrire son abstract", date: null }),
      atelier({ id: 3, titre: "Répétition générale", date: null, phase: "montee_sur_scene" }),
    ]);
  });

  it("ne garde QUE les ateliers sans date, toutes phases confondues", async () => {
    await rendu("a-dater");
    expect(screen.getByRole("link", { name: /écrire son abstract/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /répétition générale/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /lancement du talk/i })).toBeNull();
  });

  it("dit ce qu'on regarde et laisse revenir à tout d'un tap", async () => {
    await rendu("a-dater");
    expect(screen.getByText(/à dater/i)).toBeInTheDocument();
    expect(screen.getByText(/2 ateliers sur 3/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /voir tous les ateliers/i }),
    ).toHaveAttribute("href", "/admin/tremplins/3/ateliers");
  });

  it("sans vue, la liste reste entière et sans bandeau", async () => {
    await rendu();
    expect(screen.getByRole("link", { name: /lancement du talk/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /voir tous les ateliers/i })).toBeNull();
  });

  it("une clé de vue inventée est ignorée : la liste entière, sans bandeau menteur", async () => {
    await rendu("nawak");
    expect(screen.getByRole("link", { name: /lancement du talk/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /voir tous les ateliers/i })).toBeNull();
  });

  it("tâche déjà réglée : la vue dit ce qui EST vrai, sans « 0 atelier »", async () => {
    vi.mocked(getAteliersByEdition).mockResolvedValue([
      atelier({ id: 1, titre: "Lancement du talk", date: "2026-05-05" }),
    ]);
    await rendu("a-dater");
    expect(screen.getByText(/tous les ateliers ont une date/i)).toBeInTheDocument();
    expect(screen.queryByText(/\b0 atelier/)).toBeNull();
  });
});

/**
 * Requêtes ANCRÉES (`/^titre/`) dans ce qui suit : depuis que chaque rangée
 * porte une poubelle nominative (« Supprimer : <titre> »), un nom de rangée non
 * ancré désigne deux éléments.
 */
describe("Ateliers — vue « Présences à pointer »", () => {
  it("garde les ateliers PASSÉS dont des présences restent à renseigner", async () => {
    vi.mocked(getAteliersByEdition).mockResolvedValue([
      atelier({ id: 1, titre: "Atelier passé à pointer", date: "2026-05-05" }),
      atelier({ id: 2, titre: "Atelier passé pointé", date: "2026-05-06" }),
      atelier({ id: 3, titre: "Atelier à venir", date: "2026-09-01" }),
      // Nature « sous-groupes » : la réalisation vit par sous-groupe, aucune
      // présence à pointer — la tâche l'ignore, la vue aussi.
      atelier({ id: 4, titre: "Duo autonome", date: "2026-05-07", nature: "sous_groupes" }),
    ]);
    vi.mocked(getAtelierMembersByEdition).mockResolvedValue(
      new Map([
        [1, [{ registrationId: 10, presence: "non_renseignee" }]],
        [2, [{ registrationId: 10, presence: "presente" }]],
        [3, [{ registrationId: 10, presence: "non_renseignee" }]],
        [4, [{ registrationId: 10, presence: "non_renseignee" }]],
      ]) as never,
    );
    await rendu("presences");
    expect(screen.getByRole("link", { name: /^atelier passé à pointer/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^atelier passé pointé/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /^atelier à venir/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /^duo autonome/i })).toBeNull();
  });

  /**
   * Revue post-prod du 31/07 : la vue doit rejouer AUSSI la péremption
   * post-finale de la tâche (`presencesPerimees`). Sinon, cas mixte : la tâche
   * compte 1 atelier à pointer, la vue en montre 2 — dont l'« histoire » que le
   * cockpit a décidé de ne plus réclamer après la finale.
   */
  it("finale passée : les présences d'AVANT-finale sont de l'histoire, la vue les tait aussi", async () => {
    vi.mocked(loadEditionOrNotFound).mockResolvedValue({
      editionId: 3,
      edition: { id: 3, nom: "Tremplin 2026", finaleDate: "2026-06-01" },
    } as never);
    vi.mocked(getAteliersByEdition).mockResolvedValue([
      atelier({ id: 1, titre: "Atelier d'avant finale", date: "2026-05-20" }),
      atelier({ id: 2, titre: "Atelier d'après finale", date: "2026-07-01" }),
    ]);
    vi.mocked(getAtelierMembersByEdition).mockResolvedValue(
      new Map([
        [1, [{ registrationId: 10, presence: "non_renseignee" }]],
        [2, [{ registrationId: 10, presence: "non_renseignee" }]],
      ]) as never,
    );
    await rendu("presences");
    expect(screen.getByRole("link", { name: /^atelier d'après finale/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^atelier d'avant finale/i })).toBeNull();
    expect(screen.getByText(/1 atelier sur 2/)).toBeInTheDocument();
  });
});

describe("Ateliers — la RÉPARTITION se lit dès la liste", () => {
  /**
   * Le manque que l'orga ne voyait nulle part : il fallait ouvrir chaque
   * sous-groupe un par un pour savoir s'il restait quelqu'un à placer — et,
   * faute de cette vue, un sous-groupe a fini par être créé comme un ATELIER de
   * plus. La rangée doit donc le dire sans qu'on l'ouvre.
   */
  it("annonce combien de participantes restent à ranger", async () => {
    vi.mocked(getAteliersByEdition).mockResolvedValue([
      atelier({ id: 1, titre: "Revue croisée", date: "2026-09-01", nature: "sous_groupes" }),
    ]);
    // 4 participantes concernées, 2 déjà rangées dans les sous-groupes.
    vi.mocked(getTaillesCohortesByEdition).mockResolvedValue(new Map([[1, 4]]));
    vi.mocked(getSousGroupesByEdition).mockResolvedValue(
      new Map([[1, { total: 1, faits: 0, avecCoach: 0, ranges: 2 }]]) as never,
    );
    await rendu();
    expect(screen.getByRole("link", { name: /^revue croisée/i })).toHaveTextContent(
      /2 participantes à ranger/i,
    );
  });

  it("atelier collectif : aucune mention de rangement", async () => {
    vi.mocked(getAteliersByEdition).mockResolvedValue([
      atelier({ id: 1, titre: "Répétition", date: "2026-09-01" }),
    ]);
    await rendu();
    expect(screen.queryByText(/à ranger/i)).toBeNull();
  });
});

describe("Ateliers — vue « Programme » (la cadence, avant les dates)", () => {
  /**
   * Ce que l'orga conçoit d'abord : « on a surtout un ordre d'atelier dans une
   * phase de préparation ». Le programme montre donc les séances PAR PHASE, dans
   * leur ordre — datées ou pas. Une séance non datée y garde son rang, au lieu
   * de tomber dans le tas « à dater » de l'agenda.
   */
  beforeEach(() => {
    vi.mocked(getAteliersByEdition).mockResolvedValue([
      atelier({ id: 3, titre: "Réussir ses slides", phase: "montee_sur_scene", ordre: 8, date: null }),
      atelier({ id: 1, titre: "Écrire son sujet", phase: "cfp_et_pitch", ordre: 2, date: null }),
      atelier({ id: 2, titre: "Trouver son angle", phase: "cfp_et_pitch", ordre: 1, date: null }),
    ]);
  });

  it("une section par phase, nommée par ce qu'elle est", async () => {
    await rendu("programme");
    expect(screen.getByText(/Préparation au CFP \(2\)/)).toBeInTheDocument();
    expect(screen.getByText(/Préparation à la conférence \(1\)/)).toBeInTheDocument();
    // Plus aucun repère de calendrier : la phase n'est pas une conséquence des dates.
    expect(screen.queryByText(/Avant la soirée|Après la soirée/)).toBeNull();
  });

  it("les séances portent leur RANG dans la phase, dans l'ordre", async () => {
    await rendu("programme");
    const rangs = screen
      .getAllByRole("link")
      .map((l) => l.textContent ?? "")
      .filter((t) => /^\d+\./.test(t.trim()));
    expect(rangs[0]).toMatch(/1\.\s*Trouver son angle/);
    expect(rangs[1]).toMatch(/2\.\s*Écrire son sujet/);
    expect(rangs[2]).toMatch(/1\.\s*Réussir ses slides/);
  });

  it("chaque flèche NOMME sa séance (quinze « ↑ » ne s'annoncent pas)", async () => {
    await rendu("programme");
    expect(
      screen.getByRole("button", { name: /descendre.*trouver son angle.*rang 1 sur 2/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /monter.*écrire son sujet.*rang 2 sur 2/i }),
    ).toBeInTheDocument();
  });

  /**
   * En bout de phase, la flèche est ABSENTE plutôt qu'inerte : un bouton qui ne
   * produit rien se clique quand même. Et « descendre » la dernière du CFP ne
   * doit surtout pas la faire glisser dans l'autre phase.
   */
  it("aucune flèche vers l'extérieur de la phase", async () => {
    await rendu("programme");
    expect(screen.queryByRole("button", { name: /monter.*trouver son angle/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /descendre.*écrire son sujet/i })).toBeNull();
    // Séance seule dans sa phase : ni monter ni descendre.
    expect(screen.queryByRole("button", { name: /réussir ses slides/i })).toBeNull();
  });

  it("une phase vide se dit, elle ne disparaît pas du parcours", async () => {
    vi.mocked(getAteliersByEdition).mockResolvedValue([
      atelier({ id: 1, titre: "Écrire son sujet", phase: "cfp_et_pitch", ordre: 1 }),
    ]);
    await rendu("programme");
    expect(screen.getByText(/Préparation à la conférence \(0\)/)).toBeInTheDocument();
    expect(screen.getByText(/aucune séance dans cette phase/i)).toBeInTheDocument();
  });

  it("le retour mène à l'agenda, et l'agenda mène au programme", async () => {
    await rendu("programme");
    expect(screen.getByRole("link", { name: /revenir à l'agenda/i })).toHaveAttribute(
      "href",
      "/admin/tremplins/3/ateliers",
    );
    cleanup();
    await rendu();
    expect(screen.getByRole("link", { name: /programme par phase/i })).toHaveAttribute(
      "href",
      "/admin/tremplins/3/ateliers?vue=programme",
    );
  });
});
