import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

/**
 * Lot C3a — hub d'édition en vue « À faire sur cette édition » : le moteur de
 * tâches (C1) filtré sur l'édition remplace les rangées domaines à compteurs
 * (la navigation vit dans la sous-nav du layout).
 */

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
  redirect: vi.fn((p: string) => {
    throw new Error(`REDIRECT:${p}`);
  }),
}));
vi.mock("@/lib/auth-guards", () => ({ requireOrgaId: vi.fn(async () => 1) }));
vi.mock("@/lib/tremplin-editions", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getEditionById: vi.fn(),
  aujourdhuiParis: vi.fn(() => "2026-07-10"),
  listConferences: vi.fn(async () => []),
}));
vi.mock("@/lib/tremplin-ateliers", async (importOriginal) => ({
  // Module partiellement mocké : `trierAteliersParDate` (pur) reste réel —
  // le hub s'en sert pour dériver le prochain rendez-vous.
  ...(await importOriginal<object>()),
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
vi.mock("@/app/admin/tremplins/[edition]/DuplicateEditionDialog", () => ({
  default: () => <button type="button">Dupliquer</button>,
}));

import { getEditionById } from "@/lib/tremplin-editions";
import { getAteliersByEdition } from "@/lib/tremplin-ateliers";
import AdminEdition from "@/app/admin/tremplins/[edition]/page";

afterEach(cleanup);

const edition = {
  id: 3,
  nom: "Tremplin 2026",
  annee: 2026,
  confSlug: "devfest-toulouse",
  statut: "en_cours",
  description: null,
  confNom: "DevFest",
  confLieu: "Toulouse",
  confDate: null,
  confLien: null,
  finaleDate: null,
  finaleLieu: null,
  inscriptionsDebut: null,
  inscriptionsFin: null,
  deletedAt: null,
} as never;

const rendu = async () =>
  render(
    await AdminEdition({
      params: Promise.resolve({ edition: "3" }),
      searchParams: Promise.resolve({}),
    }),
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getEditionById).mockResolvedValue(edition);
});

describe("/admin/tremplins/[edition] — hub « À faire »", () => {
  it("état calme : « Tout roule » + À faire présent", async () => {
    await rendu();
    expect(
      screen.getByRole("heading", { name: /à faire sur cette édition/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/tout roule/i)).toBeInTheDocument();
  });

  it("hub franc (lot F) : la navigation vit en grandes lignes de section", async () => {
    await rendu();
    expect(
      screen.getByRole("heading", { name: /gérer l'édition/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ateliers/i })).toHaveAttribute(
      "href",
      "/admin/tremplins/3/ateliers",
    );
    expect(screen.getByRole("link", { name: /participantes/i })).toHaveAttribute(
      "href",
      "/admin/tremplins/3/participantes",
    );
    expect(screen.getByRole("link", { name: /photos/i })).toHaveAttribute(
      "href",
      "/admin/tremplins/3/photos",
    );
    expect(screen.getByRole("link", { name: /ressources/i })).toHaveAttribute(
      "href",
      "/admin/tremplins/3/ressources",
    );
  });

  it("dérive les tâches de CETTE édition (lien direct vers l'écran d'action)", async () => {
    vi.mocked(getAteliersByEdition).mockResolvedValue([
      {
        id: 10,
        ordre: 1,
        titre: "Pitcher",
        date: "2026-07-13",
        dateFin: null,
        nature: "collectif",
        lienVisio: null,
        coachs: "Ada",
      } as never,
    ]);
    await rendu();
    const lien = screen.getByRole("link", { name: /ajouter le lien visio/i });
    expect(lien).toHaveAttribute("href", "/admin/tremplins/3/ateliers/10/visio");
    expect(screen.queryByText(/tout roule/i)).toBeNull();
  });

  it("prochain rendez-vous (lot B) : LA carte en tête + programme résumé en une ligne", async () => {
    vi.mocked(getAteliersByEdition).mockResolvedValue([
      {
        id: 11,
        ordre: 1,
        titre: "Déjà passé",
        date: "2026-07-01",
        dateFin: null,
        nature: "collectif",
        lienVisio: "https://meet.exemple.fr/x",
        coachs: "Ada",
      },
      {
        id: 12,
        ordre: 2,
        titre: "Lancement et structure du talk",
        date: "2026-09-01",
        dateFin: null,
        heureDebut: "18:00",
        heureFin: "20:20",
        lieu: "BPCE, Toulouse",
        nature: "collectif",
        lienVisio: "https://meet.exemple.fr/y",
        coachs: "Ada",
      },
    ] as never);
    await rendu();
    expect(
      screen.getByRole("heading", { name: /prochain rendez-vous/i }),
    ).toBeInTheDocument();
    // La carte porte le PREMIER à venir (pas le passé), avec heures et lieu.
    const carte = screen.getByText("Lancement et structure du talk").closest("a")!;
    expect(carte).toHaveAttribute("href", "/admin/tremplins/3/ateliers/12");
    expect(screen.getByText(/18:00–20:20/)).toBeInTheDocument();
    expect(screen.getByText(/BPCE, Toulouse/)).toBeInTheDocument();
    // Programme résumé : à venir · passés, avec le lien vers la liste.
    expect(screen.getByText(/1 atelier à venir/)).toBeInTheDocument();
    expect(screen.getByText(/1 passé/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /voir les ateliers/i })).toHaveAttribute(
      "href",
      "/admin/tremplins/3/ateliers",
    );
  });

  it("fenêtre en cours : l'activité à période reste le prochain rendez-vous jusqu'à sa fin", async () => {
    vi.mocked(getAteliersByEdition).mockResolvedValue([
      {
        id: 13,
        ordre: 1,
        titre: "Revue croisée",
        date: "2026-07-07",
        dateFin: "2026-07-13", // aujourd'hui mocké : 2026-07-10 → en cours
        nature: "sous_groupes",
        lienVisio: null,
        coachs: null,
      },
    ] as never);
    await rendu();
    expect(screen.getByText("Revue croisée")).toBeInTheDocument();
    expect(screen.getByText(/du 7 au 13 juil\. 2026/)).toBeInTheDocument();
    // Le libellé vient de `NATURE_ATELIER_COURT` (une notion, un mot, partout) :
    // on vérifie la notion, pas sa casse.
    expect(screen.getByText(/en sous-groupes/i)).toBeInTheDocument();
  });

  it("réglages de l'édition en bas : sommaire une rangée = une fonction (rare, discret)", async () => {
    await rendu();
    expect(screen.getByRole("heading", { level: 1, name: "Tremplin 2026" })).toBeInTheDocument();
    // Le « une fois » vit dans un sommaire : Informations / Statut / Retrait.
    expect(screen.getByRole("link", { name: /informations/i })).toHaveAttribute(
      "href",
      "/admin/tremplins/3/infos",
    );
    expect(screen.getByRole("link", { name: /statut/i })).toHaveAttribute(
      "href",
      "/admin/tremplins/3/statut",
    );
    expect(screen.getByRole("link", { name: /suppression/i })).toHaveAttribute(
      "href",
      "/admin/tremplins/3/retrait",
    );
    // Plus de zone danger étalée ni de modale fourre-tout sur le hub.
    expect(screen.queryByRole("button", { name: /supprimer/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /modifier l'édition/i })).toBeNull();
  });

  it("l'en-tête donne le pouls : conf, statut, finale — sans détail interne", async () => {
    await rendu();
    expect(screen.getAllByText(/finale sans date/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/réglage manuel/i)).toBeNull();
  });

  it("édition en préparation : tâche calme « Ouvrir … » vers la sous-page statut", async () => {
    vi.mocked(getEditionById).mockResolvedValue({ ...(edition as object), statut: "preparation" } as never);
    await rendu();
    const lien = screen.getByRole("link", { name: /ouvrir au public l'édition «\u00a0tremplin 2026\u00a0»/i });
    expect(lien).toHaveAttribute("href", "/admin/tremplins/3/statut");
    expect(screen.queryByText(/tout roule/i)).toBeNull();
  });
});
