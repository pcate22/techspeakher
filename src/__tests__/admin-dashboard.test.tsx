import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((p: string) => {
    throw new Error(`REDIRECT:${p}`);
  }),
}));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/profiles", () => ({
  getProfilesPubliesSansNom: vi.fn(async () => []),
  getPendingProfiles: vi.fn(),
  getProfilesEnSommeilBrefs: vi.fn(async () => []),
}));
vi.mock("@/lib/contact-message", () => ({ countPendingContactMessages: vi.fn(async () => 0) }));
vi.mock("@/lib/conference-propositions", () => ({
  resumeFilePropositions: vi.fn(async () => ({ attend: false })),
}));
vi.mock("@/lib/tremplin-editions", () => ({
  listEditions: vi.fn(),
  aujourdhuiParis: vi.fn(() => "2026-07-10"),
}));
vi.mock("@/lib/tremplin-ateliers", () => ({
  getAteliersByEdition: vi.fn(),
  getAtelierMembersByEdition: vi.fn(),
}));
vi.mock("@/lib/tremplin-coachs", () => ({ getCoachsByEdition: vi.fn() }));
vi.mock("@/lib/tremplin-recompenses", () => ({ getRecompensesByEdition: vi.fn() }));
vi.mock("@/lib/tremplin-photos", () => ({
  getPhotosByEdition: vi.fn(),
  getPhotoTagsByEdition: vi.fn(),
  photoPubliable: vi.fn(() => true),
}));
vi.mock("@/lib/tremplin-registrations", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getRegistrationsByEdition: vi.fn(),
}));
vi.mock("@/lib/articles-membres", () => ({ listArticlesEnRelecture: vi.fn(async () => []) }));
vi.mock("@/lib/auth-guards", () => ({
  requireOrgaPage: vi.fn(),
  // Le banc joue une ORGA : l'écran « À faire » (désormais membre) lit la
  // session lui-même, et `chargerTaches` n'ouvre l'association qu'à elle.
  getSession: vi.fn(async () => ({ user: { id: "1", isOrga: true } })),
}));

import { auth } from "@/auth";
import { getPendingProfiles, getProfilesEnSommeilBrefs } from "@/lib/profiles";
import { listEditions } from "@/lib/tremplin-editions";
import { getAteliersByEdition, getAtelierMembersByEdition } from "@/lib/tremplin-ateliers";
import { getCoachsByEdition } from "@/lib/tremplin-coachs";
import { getRecompensesByEdition } from "@/lib/tremplin-recompenses";
import {
  getPhotosByEdition,
  getPhotoTagsByEdition,
  photoPubliable,
} from "@/lib/tremplin-photos";
import { getRegistrationsByEdition } from "@/lib/tremplin-registrations";
import { requireOrgaPage } from "@/lib/auth-guards";
import AdminPage, { metadata } from "@/app/admin/page";
import AFaire from "@/app/mon-espace/a-faire/page";

afterEach(cleanup);

const orga = { user: { id: "1", isOrga: true } } as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue(orga);
  vi.mocked(getPendingProfiles).mockResolvedValue([]);
  vi.mocked(getProfilesEnSommeilBrefs).mockResolvedValue([]);
  vi.mocked(listEditions).mockResolvedValue([]);
  vi.mocked(getAteliersByEdition).mockResolvedValue([]);
  vi.mocked(getAtelierMembersByEdition).mockResolvedValue(new Map());
  vi.mocked(getCoachsByEdition).mockResolvedValue(new Map());
  vi.mocked(getRecompensesByEdition).mockResolvedValue([]);
  vi.mocked(getPhotosByEdition).mockResolvedValue([]);
  vi.mocked(getPhotoTagsByEdition).mockResolvedValue(new Map());
  vi.mocked(getRegistrationsByEdition).mockResolvedValue([]);
  // Reposée explicitement : `clearAllMocks` efface les appels, pas les
  // implémentations — un cas qui la fait dépendre des tags la laisserait ainsi
  // pour tous les suivants.
  vi.mocked(photoPubliable).mockReturnValue(true);
});

/**
 * Le `<title>` vit dans l'objet `metadata`, que `render(await AdminPage())` ne
 * rend jamais : il était resté à « Tableau de bord orga » pendant que la page
 * affichait « Espace organisatrices », et le `queryByText` du test ci-dessous
 * ne pouvait pas le voir (relecture du 2026-08-16). Un favori et un onglet de
 * navigateur portent ce nom-là.
 */
describe("/admin — le titre de l'onglet", () => {
  it("porte le même nom que la page, entier", () => {
    expect(metadata.title).toMatch(/espace organisatrices/i);
    expect(metadata.title).not.toMatch(/tableau de bord/i);
  });
});

describe("/admin — l'espace organisatrices", () => {
  it("passe par la garde de page partagée (règle prouvée dans auth-guards)", async () => {
    await AdminPage();
    expect(requireOrgaPage).toHaveBeenCalled();
  });

  it("état vide : « Tout roule » + accès Speakeuses et Tremplins", async () => {
    render(await AdminPage());
    // UN seul nom pour ce territoire (audit C7), et le mot ENTIER : « orga »
    // est une troncature qui suppose le vocabulaire de la maison.
    expect(
      screen.getByRole("heading", { name: /espace organisatrices/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/tableau de bord/i)).toBeNull();
    expect(screen.getByText(/tout roule/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /speakeuses/i })).toHaveAttribute(
      "href",
      "/admin/speakeuses",
    );
    expect(screen.getByRole("link", { name: /tremplins/i })).toHaveAttribute(
      "href",
      "/admin/tremplins",
    );
  });

  it("l'espace organisatrices renvoie vers « À faire » avec le compte (notifs séparées de Gérer)", async () => {
    vi.mocked(getPendingProfiles).mockResolvedValue([
      { id: 7, name: "Ada Lovelace", submittedAt: "2026-07-01T00:00:00Z" } as never,
    ]);
    render(await AdminPage());
    const rangée = screen.getByRole("link", { name: /à faire \(1\)/i });
    // La nouvelle adresse, directement : le 308 est pour les vieux liens.
    expect(rangée).toHaveAttribute("href", "/mon-espace/a-faire?vue=association");
    expect(screen.queryByText(/tout roule/i)).toBeNull();
  });

  it("un nom BLANC au chargement retombe sur le libellé sans nom (trim au bord)", async () => {
    // « Valider la fiche de    » : le blanc passait le ternaire du libellé —
    // le chargement livre un nom réel ou rien (passe justesse du 2026-08-22).
    vi.mocked(getPendingProfiles).mockResolvedValue([
      { id: 7, name: "   ", submittedAt: null } as never,
    ]);
    render(await AFaire({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText(/Valider une fiche speakeuse/)).toBeInTheDocument();
  });

  it("« À faire » dérive et affiche les tâches : datées puis résolubles calmes", async () => {
    vi.mocked(getPendingProfiles).mockResolvedValue([
      { id: 7, name: "Ada Lovelace", submittedAt: "2026-07-01T00:00:00Z" } as never,
    ]);
    vi.mocked(listEditions).mockResolvedValue([
      { id: 1, nom: "Tremplin 2026", statut: "en_cours", finaleDate: null } as never,
    ]);
    vi.mocked(getAteliersByEdition).mockResolvedValue([
      { id: 10, titre: "Pitcher", date: "2026-07-13", lienVisio: null, coachs: null } as never,
    ]);
    vi.mocked(getCoachsByEdition).mockResolvedValue(new Map([[10, [{ id: 1 } as never]]]));
    vi.mocked(getAtelierMembersByEdition).mockResolvedValue(
      new Map([[10, [{ registrationId: 5, presence: "non_renseignee" }]]]),
    );
    vi.mocked(getRegistrationsByEdition).mockResolvedValue([
      { id: 5, userId: null, participanteNom: "Manon Girard" } as never,
    ]);

    render(await AFaire({ searchParams: Promise.resolve({}) }));
    const liens = screen.getAllByRole("link");
    const libelles = liens.map((l) => l.textContent ?? "");
    // Datée (visio à 3 j) avant la fiche (J+6), puis la calme (sans compte).
    const iVisio = libelles.findIndex((t) => t.includes("Ajouter le lien visio de « Pitcher »"));
    const iFiche = libelles.findIndex((t) => t.includes("Valider la fiche d'Ada Lovelace"));
    // Une seule sans compte : la tâche la NOMME (pas « 1 participante »).
    const iCompte = libelles.findIndex((t) => t.includes("Relier Manon Girard à un compte"));
    expect(iVisio).toBeGreaterThan(-1);
    expect(iFiche).toBeGreaterThan(iVisio);
    expect(iCompte).toBeGreaterThan(iFiche);
    // Les tâches mènent directement à l'écran d'action (atelier, fiche, compte).
    expect(liens[iVisio]).toHaveAttribute("href", "/admin/tremplins/1/ateliers/10/visio");
    expect(liens[iFiche]).toHaveAttribute("href", "/speakeuses/7");
    expect(liens[iCompte]).toHaveAttribute(
      "href",
      "/admin/tremplins/1/participantes/5/compte",
    );
    // Pas d'état vide quand il y a des tâches.
    expect(screen.queryByText(/tout roule/i)).toBeNull();
  });

  it("les éditions archivées ne produisent aucune tâche", async () => {
    vi.mocked(listEditions).mockResolvedValue([
      { id: 2, nom: "Tremplin 2024", statut: "archive", finaleDate: "2024-06-01" } as never,
    ]);
    render(await AdminPage());
    expect(getAteliersByEdition).not.toHaveBeenCalled();
    expect(screen.getByText(/tout roule/i)).toBeInTheDocument();
  });
});

/**
 * LA RANGÉE « À faire » du tableau de bord — elle compte les GESTES.
 *
 * C'est la surface qui contredisait le plus franchement la règle du
 * 2026-08-17 : son compte ET son drapeau lisaient `taches.length` brut. Avec
 * un constat et rien d'autre, elle annonçait « 1 action en attente » et
 * s'allumait, pendant que le point de l'onglet — même liste, même règle —
 * restait éteint. Deux surfaces d'un même produit qui se contredisent.
 *
 * Le décor part de la BASE, comme le reste du fichier : c'est le seul moyen de
 * vérifier que le tri des photos (`chargerEditionEntrees`) et le compte de la
 * rangée parlent bien de la même chose.
 */
describe("/admin — la rangée « À faire » ne s'allume que pour ce qu'un geste referme", () => {
  /** Une édition active avec UNE photo, bloquée par les tags donnés. */
  const editionAvecPhoto = (tags: { registrationId: number | null; couverte: boolean }[]) => {
    vi.mocked(listEditions).mockResolvedValue([
      { id: 1, nom: "Tremplin 2026", statut: "en_cours", finaleDate: null } as never,
    ]);
    vi.mocked(getPhotosByEdition).mockResolvedValue([{ id: 9 } as never]);
    vi.mocked(getPhotoTagsByEdition).mockResolvedValue(new Map([[9, tags as never]]));
    // La vraie règle, rejouée : une photo est publiable quand TOUS ses tags
    // sont couverts. La mocker à un booléen fixe rendrait le test aveugle au
    // tri (tag d'inscription ou non) qu'il existe pour juger.
    vi.mocked(photoPubliable).mockImplementation((t) => t.every((x) => x.couverte));
  };

  const rangee = () => screen.getByRole("link", { name: /à faire/i });

  it("un constat seul : « Tout roule », et rien ne s'allume", async () => {
    // Une photo bloquée par la SEULE inscrite qui y figure : sa couverture est
    // son réglage de visibilité à elle. L'orga n'a aucun geste à poser.
    editionAvecPhoto([{ registrationId: 55, couverte: false }]);
    render(await AdminPage());
    // « Rien en attente. Tout roule. » : l'état d'arrivée reste atteignable.
    expect(rangee().textContent).toMatch(/rien en attente/i);
    expect(rangee().textContent).not.toMatch(/1 action en attente/i);
    // Le libellé de la rangée ne prend pas de compte non plus.
    expect(rangee().textContent).not.toMatch(/\(1\)/);
  });

  it("la MÊME photo, identifiée hors inscription : « 1 action en attente »", async () => {
    // La case « Accord recueilli » se coche dans l'app : c'est un travail.
    editionAvecPhoto([{ registrationId: null, couverte: false }]);
    render(await AdminPage());
    expect(rangee().textContent).toMatch(/1 action en attente/i);
  });

  it("un geste et un constat : la rangée compte UN", async () => {
    editionAvecPhoto([{ registrationId: 55, couverte: false }]);
    vi.mocked(getPendingProfiles).mockResolvedValue([
      { id: 7, name: "Ada Lovelace", submittedAt: "2026-07-01" } as never,
    ]);
    render(await AdminPage());
    expect(rangee().textContent).toMatch(/1 action en attente/i);
    expect(rangee().textContent).not.toMatch(/2 actions/i);
  });
});
