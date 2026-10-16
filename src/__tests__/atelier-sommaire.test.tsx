import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

/**
 * Lot C — la fiche atelier est un ÉVÉNEMENT : ses FAITS d'abord (quand / où /
 * qui / avancement, dérivés par `atelierEtat`), puis une rangée par fonction
 * vers sa sous-page. Les alertes ne sonnent que là où il y a un manque réel :
 * un atelier en sous-groupes ne réclame ni présences, ni coach, ni lien
 * d'atelier. (La dérivation elle-même est prouvée dans atelier-etat.test.ts ;
 * ici on vérifie le RENDU et le routage.)
 */

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
  redirect: vi.fn(),
}));
vi.mock("@/lib/auth-guards", () => ({ requireOrgaId: vi.fn(async () => 1) }));
vi.mock("@/lib/tremplin-editions", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getEditionById: vi.fn(),
}));
vi.mock("@/lib/tremplin-ateliers", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getAteliersByEdition: vi.fn(),
  getAtelierMembers: vi.fn(async () => []),
  getAtelierPresences: vi.fn(async () => []),
  getCohorteAtelier: vi.fn(async () => []),
  getSousGroupesByAtelier: vi.fn(async () => []),
}));
vi.mock("@/lib/tremplin-coachs", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getCoachsByAtelier: vi.fn(async () => []),
}));
vi.mock("@/lib/tremplin-documents", () => ({ countDocumentsByAtelier: vi.fn(async () => 0) }));
vi.mock("@/lib/tremplin-registration-phases", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getPhaseMembersOuVide: vi.fn(async () => new Map()),
}));
vi.mock("@/lib/tremplin-registrations", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  // Le compte, pas l'inventaire : la fiche n'affiche qu'un nombre (et ne
  // charge donc plus les e-mails des inscrites).
  countRegistrationsByEdition: vi.fn(async () => 3),
}));

import { getEditionById } from "@/lib/tremplin-editions";
import {
  getAteliersByEdition,
  getAtelierMembers,
  getAtelierPresences,
  getCohorteAtelier,
  getSousGroupesByAtelier,
} from "@/lib/tremplin-ateliers";
import { getCoachsByAtelier } from "@/lib/tremplin-coachs";
import FicheAtelier from "@/app/admin/tremplins/[edition]/ateliers/[atelier]/page";
import { makeSousGroupe } from "./test-helpers";

afterEach(cleanup);

const edition = { id: 3, nom: "Tremplin 2026", statut: "en_cours" } as never;

/** Atelier PASSÉ par défaut (2026-07-13) : le cas où l'on pointe. */
const atelier = (o: object = {}) =>
  ({
    id: 10,
    editionId: 3,
    ordre: 0,
    titre: "Pitcher son talk",
    date: "2026-07-13",
    dateFin: null,
    heureDebut: "18:30",
    heureFin: "20:00",
    description: null,
    lieu: null,
    lienVisio: null,
    coachs: null,
    phase: "cfp_et_pitch",
    nature: "collectif",
    audience: "selection" as const,
    ...o,
  }) as never;

const rendu = async () =>
  render(
    await FicheAtelier({
      params: Promise.resolve({ edition: "3", atelier: "10" }),
    }),
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getEditionById).mockResolvedValue(edition);
  vi.mocked(getAteliersByEdition).mockResolvedValue([atelier()]);
  vi.mocked(getAtelierMembers).mockResolvedValue([]);
  vi.mocked(getAtelierPresences).mockResolvedValue([]);
  vi.mocked(getCoachsByAtelier).mockResolvedValue([]);
  vi.mocked(getSousGroupesByAtelier).mockResolvedValue([]);
});

describe("fiche atelier — les faits d'abord", () => {
  it("quand / où / qui : les faits sont nommés en tête", async () => {
    await rendu();
    expect(screen.getByText("Quand")).toBeInTheDocument();
    expect(screen.getByText("Où")).toBeInTheDocument();
    expect(screen.getByText("Qui")).toBeInTheDocument();
    // La date se lit dans les FAITS, et de nouveau sous « Informations » (une
    // rangée de sommaire montre une valeur, pas une liste de champs).
    expect(screen.getAllByText(/13 juil\. 2026/).length).toBeGreaterThan(0);
  });

  it("chaque rangée de gestion montre une VALEUR, jamais un inventaire de champs", async () => {
    await rendu();
    const infos = screen.getByRole("link", { name: /informations/i });
    expect(infos).not.toHaveTextContent(/titre, dates, horaires/i);
    expect(infos).toHaveTextContent(/13 juil\. 2026/);
  });

  it("ni ouvert ni participante : « visible de personne » (la vraie alerte)", async () => {
    await rendu();
    expect(screen.getByText(/visible de personne/i)).toBeInTheDocument();
  });

  it("ouvert à toutes : le public réel de l'édition est chiffré", async () => {
    vi.mocked(getAteliersByEdition).mockResolvedValue([atelier({ audience: "toutes" as const })]);
    await rendu();
    expect(screen.getByText(/ouvert à toutes \(3 inscrites\)/i)).toBeInTheDocument();
  });

  it("collectif passé : l'avancement compte les présences pointées", async () => {
    vi.mocked(getAtelierMembers).mockResolvedValue([5, 6] as never);
    // Le TOTAL vient de la cohorte (qui l'atelier concerne), pas du nombre de
    // lignes déjà créées : sur une audience de phase il n'y en a aucune tant
    // que personne n'a été pointé.
    vi.mocked(getCohorteAtelier).mockResolvedValue([5, 6]);
    vi.mocked(getAtelierPresences).mockResolvedValue([
      { registrationId: 5, presence: "non_renseignee" },
      { registrationId: 6, presence: "presente" },
    ] as never);
    await rendu();
    expect(screen.getByText("Avancement")).toBeInTheDocument();
    expect(screen.getByText(/1 pointée sur 2 · 1 présence à pointer/i)).toBeInTheDocument();
  });

  it("atelier À VENIR : aucun avancement réclamé (fini la fausse alerte)", async () => {
    vi.mocked(getAteliersByEdition).mockResolvedValue([atelier({ date: "2099-01-01" })]);
    vi.mocked(getAtelierMembers).mockResolvedValue([5] as never);
    vi.mocked(getAtelierPresences).mockResolvedValue([
      { registrationId: 5, presence: "non_renseignee" },
    ] as never);
    await rendu();
    expect(screen.queryByText("Avancement")).toBeNull();
  });

  it("atelier sans date : l'état est dit une fois, en clair", async () => {
    vi.mocked(getAteliersByEdition).mockResolvedValue([atelier({ date: null })]);
    await rendu();
    expect(screen.getAllByText(/date à définir/i).length).toBeGreaterThan(0);
  });
});

describe("fiche atelier — en sous-groupes : plus de fausses alertes", () => {
  const sousGroupes = () => {
    vi.mocked(getAteliersByEdition).mockResolvedValue([
      atelier({ nature: "sous_groupes", date: "2026-07-07", dateFin: "2026-07-13" }),
    ]);
    vi.mocked(getSousGroupesByAtelier).mockResolvedValue([
      makeSousGroupe({ id: 1, faitLe: "2026-07-10", membres: [1, 2] }),
      makeSousGroupe({ id: 2, membres: [3] }),
    ] as never);
    // Quatre participantes CONCERNÉES (l'audience), trois rangées : il en reste UNE.
    vi.mocked(getAtelierMembers).mockResolvedValue([1, 2, 3, 4] as never);
    vi.mocked(getCohorteAtelier).mockResolvedValue([1, 2, 3, 4]);
  };

  it("le lien d'atelier n'est pas réclamé (il vit par sous-groupe)", async () => {
    sousGroupes();
    await rendu();
    expect(screen.queryByRole("link", { name: /lien de connexion/i })).toBeNull();
    expect(screen.getByText(/à préciser \(par sous-groupe\)/i)).toBeInTheDocument();
  });

  it("sans coach : « autonome », jamais « à trouver » — et la MÊME chose partout", async () => {
    sousGroupes();
    await rendu();
    // Le QUI et la rangée « Coachs » racontaient deux histoires différentes
    // (« autonome » sous « Par sous-groupe ») : ils sont désormais dérivés du
    // même état, donc le mot apparaît aux deux endroits.
    expect(screen.getAllByText(/autonome/i)).toHaveLength(2);
    expect(screen.getByRole("link", { name: /coachs/i })).toHaveTextContent(/autonome/i);
    expect(screen.queryByText(/coach à trouver/i)).toBeNull();
  });

  it("l'avancement compte les sous-groupes, jamais les présences", async () => {
    sousGroupes();
    vi.mocked(getAtelierPresences).mockResolvedValue([
      { registrationId: 1, presence: "non_renseignee" },
    ] as never);
    await rendu();
    expect(screen.getByText(/1 faite sur 2/i)).toBeInTheDocument();
    expect(screen.queryByText(/présence/i)).toBeNull();
  });

  it("« qui participe » et « comment c'est réparti » : deux rangées, deux pages", async () => {
    sousGroupes();
    await rendu();
    const base = "/admin/tremplins/3/ateliers/10";
    expect(screen.getByRole("link", { name: /^participantes/i })).toHaveAttribute(
      "href",
      `${base}/presences`,
    );
    expect(screen.getByRole("link", { name: /sous-groupes/i })).toHaveAttribute(
      "href",
      `${base}/sous-groupes`,
    );
  });

  it("la rangée « Sous-groupes » dit le RESTE À RANGER, pas seulement un compte", async () => {
    // Le manque que rien n'affichait : 4 participantes, 3 rangées, 1 oubliée.
    sousGroupes();
    await rendu();
    // Le DÉNOMINATEUR est écrit : la rangée « Participantes » juste au-dessus
    // compte, elle, toutes les inscrites d'un atelier ouvert à toutes.
    expect(screen.getByRole("link", { name: /sous-groupes/i })).toHaveTextContent(
      /1 à ranger sur 4/i,
    );
  });

  it("le reste à ranger se lit aussi dans le QUI (fait de l'atelier)", async () => {
    sousGroupes();
    await rendu();
    expect(screen.getByText(/1 participante à ranger/i)).toBeInTheDocument();
  });
});

describe("fiche atelier — routage vers les sous-pages", () => {
  it("une rangée par fonction, chacune vers sa sous-page", async () => {
    await rendu();
    const base = "/admin/tremplins/3/ateliers/10";
    expect(screen.getByRole("link", { name: /informations/i })).toHaveAttribute(
      "href",
      `${base}/infos`,
    );
    expect(screen.getByRole("link", { name: /coachs/i })).toHaveAttribute(
      "href",
      `${base}/coachs`,
    );
    expect(screen.getByRole("link", { name: /lien de connexion/i })).toHaveAttribute(
      "href",
      `${base}/visio`,
    );
    expect(
      screen.getByRole("link", { name: /participantes et présences/i }),
    ).toHaveAttribute("href", `${base}/presences`);
    expect(screen.getByRole("link", { name: /supports/i })).toHaveAttribute(
      "href",
      `${base}/documents`,
    );
  });

  it("l'ordre suit le remplissage : Informations d'abord", async () => {
    await rendu();
    expect(screen.getAllByRole("link")[0]).toHaveTextContent(/informations/i);
  });

  it("la phase (nommée par ce qu'elle est) et la nature situent l'atelier", async () => {
    await rendu();
    expect(
      screen.getByText(/Préparation au CFP · Rendez-vous collectif/),
    ).toBeInTheDocument();
  });

  it("la suppression a sa page, en fin de sommaire (destructif = hors des réglages)", async () => {
    await rendu();
    const suppression = screen.getByRole("link", { name: /supprimer l'atelier/i });
    expect(suppression).toHaveAttribute("href", "/admin/tremplins/3/ateliers/10/retrait");
    const liens = screen.getAllByRole("link");
    expect(liens[liens.length - 1]).toBe(suppression);
  });

  it("atelier collectif : aucune rangée « Sous-groupes » (rien à répartir)", async () => {
    await rendu();
    expect(screen.queryByRole("link", { name: /^sous-groupes/i })).toBeNull();
  });

  it("le sommaire ne porte aucun formulaire (une page = une fonction)", async () => {
    await rendu();
    expect(screen.queryByRole("button", { name: /enregistrer/i })).toBeNull();
  });

  it("atelier inconnu → notFound", async () => {
    vi.mocked(getAteliersByEdition).mockResolvedValue([]);
    await expect(rendu()).rejects.toThrow("NOT_FOUND");
  });
});
