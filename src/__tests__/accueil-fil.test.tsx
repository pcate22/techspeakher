import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";

expect.extend(toHaveNoViolations);

/**
 * L'Accueil connecté = LE FIL, PUR (conception v2 §4, lot N2 — maquette v5.1
 * validée) : un seul flux antichronologique de faits incarnés, ZÉRO carte
 * personnelle, fin de fil « Tu es à jour ✓ ». L'ancien hub est redistribué
 * (fiche → « Ma fiche publique », rôle → « Mon profil »).
 */

vi.mock("next/navigation", () => ({
  redirect: vi.fn((p: string) => {
    throw new Error(`REDIRECT:${p}`);
  }),
  // ReactionRow (client) rafraîchit via le router après un bravo réussi.
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/agenda-public", () => ({ getScenesRecentes: vi.fn(async () => []) }));
vi.mock("@/lib/fil-communaute", () => ({ getNouvellesVenues: vi.fn(async () => []) }));
vi.mock("@/lib/contenus", () => ({ listPublicationsRecentes: vi.fn(async () => []) }));
vi.mock("@/lib/users", () => ({
  getCompte: vi.fn(async () => ({ name: "Ada Lovelace", genre: null })),
}));
vi.mock("@/lib/profiles", () => ({ getProfileByUserId: vi.fn(async () => null) }));
vi.mock("@/lib/reactions", () => ({ getReactionsPourFil: vi.fn(async () => new Map()) }));
vi.mock("@/app/mon-espace/actions", () => ({ reactionAction: vi.fn() }));

import { auth } from "@/auth";
import { getProfileByUserId } from "@/lib/profiles";
import { getReactionsPourFil } from "@/lib/reactions";
import { getScenesRecentes } from "@/lib/agenda-public";
import { getNouvellesVenues } from "@/lib/fil-communaute";
import { listPublicationsRecentes } from "@/lib/contenus";
import Accueil from "@/app/mon-espace/page";

afterEach(cleanup);

const rendu = async () => render(await Accueil());

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ user: { id: "1", name: "Ada Lovelace" } } as never);
  vi.mocked(getScenesRecentes).mockResolvedValue([]);
  vi.mocked(getNouvellesVenues).mockResolvedValue([]);
  vi.mocked(listPublicationsRecentes).mockResolvedValue([]);
  vi.mocked(getProfileByUserId).mockResolvedValue(null);
  vi.mocked(getReactionsPourFil).mockResolvedValue(new Map());
});

const uneScene = {
  occurrenceId: 9,
  date: "2026-08-05",
  conference: "DevFest",
  conferenceCle: "texte:devfest",
  conferenceLibelle: "DevFest",
  region: "Occitanie",
  ville: "Toulouse",
  pays: null,
  lienConf: null,
  talkTitre: "Debugger sans pleurer",
  talkType: "Conférence",
  speakeuseNom: "Léa Marchand",
  speakeuseHref: "/speakeuses/lea",
  profileId: 5,
  image: null,
};

const uneVenue = {
  profileId: 7,
  nom: "Salomé D.",
  href: "/speakeuses/salome",
  titreProfil: "Dev backend",
  image: null,
  date: "2026-08-06",
};

const uneActu: Record<string, unknown> = {
  id: 40,
  type: "publication",
  slug: "tremplin-2026",
  titre: "Le Tremplin 2026 est lancé",
  chapo: "Les candidatures sont ouvertes.",
  corps: "x",
  lien: null,
  lienExterne: null,
  lienLabel: null,
  statut: "publie",
  publieLe: "2026-08-04",
};

describe("Accueil — le fil, pur", () => {
  it("hors session → /connexion", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    await expect(rendu()).rejects.toThrow("REDIRECT:/connexion");
  });

  it("salue par le prénom (lu en base, jamais du JWT figé)", async () => {
    await rendu();
    expect(screen.getByRole("heading", { name: /bonjour ada/i })).toBeInTheDocument();
  });

  it("fusionne les trois sources en cartes incarnées, la plus récente d'abord", async () => {
    vi.mocked(getScenesRecentes).mockResolvedValue([uneScene]);
    vi.mocked(getNouvellesVenues).mockResolvedValue([uneVenue]);
    vi.mocked(listPublicationsRecentes).mockResolvedValue([uneActu as never]);
    await rendu();
    const liens = within(screen.getByRole("list")).getAllByRole("link");
    // 06/08 venue, 05/08 scène, 04/08 actu.
    expect(liens.map((l) => l.getAttribute("href"))).toEqual([
      "/speakeuses/salome",
      "/speakeuses/lea",
      "/articles/tremplin-2026",
    ]);
    // Le fait vit SUR LA CARTE (dans le lien) — le sr-only du bouton Bravo
    // répète le nom, donc l'assertion vise le lien, jamais la page entière.
    expect(liens[1]).toHaveTextContent(/sur scène/i);
    expect(liens[0]).toHaveTextContent(/a rejoint l'annuaire/i);
    expect(liens[2]).toHaveTextContent(/le tremplin 2026 est lancé/i);
  });

  it("chaque carte DIT sa destination, et l'asso ne répète pas son logo", async () => {
    vi.mocked(getScenesRecentes).mockResolvedValue([uneScene]);
    vi.mocked(listPublicationsRecentes).mockResolvedValue([uneActu as never]);
    const { container } = await rendu();
    expect(screen.getByText("Voir sa fiche")).toBeInTheDocument();
    expect(screen.getByText("Lire l'article")).toBeInTheDocument();
    // Le picto TSH répété alourdissait chaque ligne (retour de Cateline).
    expect(container.querySelector('img[src*="logo-icon"]')).toBeNull();
  });

  it("l'intitulé VA À LA LIGNE sous le texte : un téléphone n'a pas deux colonnes", async () => {
    vi.mocked(getScenesRecentes).mockResolvedValue([uneScene]);
    await rendu();
    const intitule = screen.getByText("Voir sa fiche");
    // Un bloc (il prend sa ligne), et DANS la colonne de texte — pas à côté
    // d'elle, où il écrasait le titre du talk (retour de Cateline).
    expect(intitule.className).toMatch(/\bblock\b/);
    expect(intitule.parentElement).toHaveTextContent("Léa Marchand");
    expect(intitule.parentElement).toHaveTextContent("Debugger sans pleurer");
  });

  it("la date passe à la ligne ENTIÈRE : « 6 » et « août 2026 » restent ensemble", async () => {
    // Un nom long pousse la première ligne au-delà de la largeur d'un
    // téléphone, et la date s'y coupait en deux (retour de Cateline).
    vi.mocked(getNouvellesVenues).mockResolvedValue([
      { ...uneVenue, nom: "Cateline PUCCETTI" },
    ]);
    await rendu();
    // Dans LA CARTE : le sr-only du bouton répète le fait, il ne se met pas
    // en page.
    const carte = within(screen.getByRole("list")).getByRole("link");
    const date = within(carte).getByText(/6 août 2026/);
    expect(date.className).toMatch(/whitespace-nowrap/);
    // ET l'espace séparateur reste DEHORS : c'est LUI la coupure autorisée.
    // Avalé par l'insécable, la date se soude à ce qui précède et la ligne
    // sort de l'écran (mesuré : 75 px de débordement sur 180 px de colonne) —
    // la coupure disparaissait, remplacée par pire. jsdom ne met rien en
    // page : c'est CETTE structure qui porte la garantie.
    expect(date.textContent?.startsWith("·")).toBe(true);
    // Le fait, lui, reste sécable : une phrase qui passe à la ligne se lit,
    // et l'en-tête garde deux lignes au lieu de trois sur un téléphone.
    expect(within(carte).getByText(/a rejoint l'annuaire/).className).not.toMatch(
      /whitespace-nowrap/,
    );
    // La ligne se lit toujours pareil, espaces compris.
    expect(within(carte).getByText(/Cateline PUCCETTI/).parentElement)
      .toHaveTextContent("Cateline PUCCETTI · a rejoint l'annuaire · 6 août 2026");
  });

  it("le fil se termine par « Tu es à jour » : pas d'archive, pas de « voir plus »", async () => {
    vi.mocked(getScenesRecentes).mockResolvedValue([uneScene]);
    await rendu();
    expect(screen.getByText(/tu es à jour/i)).toBeInTheDocument();
    expect(screen.queryByText(/voir plus|voir tout/i)).toBeNull();
  });

  it("fil vide : une phrase qui dit ce que le fil racontera, jamais un écran mort", async () => {
    await rendu();
    expect(screen.getByText(/le fil s'anime avec la communauté/i)).toBeInTheDocument();
  });

  it("ZÉRO carte personnelle : ni module fiche, ni complétude, ni tremplin", async () => {
    vi.mocked(getScenesRecentes).mockResolvedValue([uneScene]);
    await rendu();
    expect(screen.queryByText(/ma fiche/i)).toBeNull();
    expect(screen.queryByText(/fiche complétée/i)).toBeNull();
    expect(screen.queryByText(/soumettre/i)).toBeNull();
    expect(screen.queryByText(/à venir/i)).toBeNull();
  });

  it("chaque carte porte sa rangée, ancrée, avec le compteur nominatif (lot N4)", async () => {
    vi.mocked(getNouvellesVenues).mockResolvedValue([uneVenue]);
    vi.mocked(getReactionsPourFil).mockResolvedValue(
      new Map([["venue-7", { nb: 2, premiere: "Ada L.", moi: false }]]),
    );
    await rendu();
    // Une ARRIVÉE s'accueille : « Bienvenue », pas « Bravo » (elle n'a rien
    // accompli — retour de Cateline, objectif : se motiver).
    expect(screen.getByRole("button", { name: /^Bienvenue/ })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/Ada L. et 1 autre/);
    expect(document.getElementById("carte-venue-7")).toBeTruthy();
  });

  it("l'actualité de l'ASSO n'a AUCUNE rangée (une réaction va à une personne)", async () => {
    vi.mocked(listPublicationsRecentes).mockResolvedValue([uneActu as never]);
    await rendu();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("l'article d'une MEMBRE, lui, s'applaudit : la carte est incarnée", async () => {
    vi.mocked(listPublicationsRecentes).mockResolvedValue([
      { ...uneActu, auteurNom: "Nawel B.", auteurUserId: 3 } as never,
    ]);
    await rendu();
    expect(screen.getByRole("button", { name: /^Bravo/ })).toBeInTheDocument();
  });

  it("une SCÈNE s'applaudit : « Bravo » (le mot juste pour la chose difficile)", async () => {
    vi.mocked(getScenesRecentes).mockResolvedValue([uneScene]);
    await rendu();
    expect(screen.getByRole("button", { name: /^Bravo/ })).toBeInTheDocument();
  });

  it("SA carte : le compteur (canal de réception), AUCUN bouton", async () => {
    vi.mocked(getNouvellesVenues).mockResolvedValue([uneVenue]);
    vi.mocked(getProfileByUserId).mockResolvedValue({ id: 7 } as never);
    vi.mocked(getReactionsPourFil).mockResolvedValue(
      new Map([["venue-7", { nb: 1, premiere: "Ada L.", moi: false }]]),
    );
    await rendu();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(/Ada L./);
  });

  it("axe : aucune violation", async () => {
    vi.mocked(getScenesRecentes).mockResolvedValue([uneScene]);
    vi.mocked(getNouvellesVenues).mockResolvedValue([uneVenue]);
    vi.mocked(getReactionsPourFil).mockResolvedValue(
      new Map([["venue-7", { nb: 2, premiere: "Ada L.", moi: true }]]),
    );
    const { container } = await rendu();
    expect(await axe(container)).toHaveNoViolations();
  });
});
