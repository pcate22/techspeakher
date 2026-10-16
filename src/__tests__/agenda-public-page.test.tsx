import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";

expect.extend(toHaveNoViolations);

/**
 * La page publique `/agenda` et son extrait sur la home.
 *
 * Depuis le 2026-08-16, `/agenda` est un HORIZON GLISSANT : il porte ce qui
 * vient, plus un aperçu PERMANENT du passé récent et les portes vers les
 * comptes rendus d'année. Le passé complet vit sur `/agenda/[annee]`.
 */

vi.mock("@/lib/agenda-public", async (importOriginal) => ({
  // Seules les LECTURES sont mockées : le tri, le découpage et le groupement
  // (purs) restent réels — c'est la logique que la page consomme.
  ...(await importOriginal<object>()),
  getScenesPubliques: vi.fn(),
  getScenesHorizon: vi.fn(),
  getApercuPasse: vi.fn(),
  getAnneesArchive: vi.fn(),
}));
vi.mock("@/lib/tremplin-statut", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  aujourdhuiParis: vi.fn(() => "2026-07-31"),
}));
vi.mock("@/lib/profiles", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  countPublishedProfiles: vi.fn(async () => 12),
}));

import {
  getScenesPubliques,
  getScenesHorizon,
  getApercuPasse,
  getAnneesArchive,
  type ScenePublique,
} from "@/lib/agenda-public";
import AgendaPublic from "@/app/agenda/page";
import Home from "@/app/page";

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  // Défauts sobres : chaque test ne pose que ce qu'il éprouve.
  vi.mocked(getScenesHorizon).mockResolvedValue([]);
  vi.mocked(getApercuPasse).mockResolvedValue([]);
  vi.mocked(getAnneesArchive).mockResolvedValue([]);
});

const scene = (o: Partial<ScenePublique> & { date: string }): ScenePublique => ({
  occurrenceId: 1,
  conference: "DevFest Toulouse",
  conferenceCle: "devfest-toulouse",
  conferenceLibelle: "DevFest Toulouse",
  ville: "Toulouse",
  region: "Occitanie",
  pays: null,
  lienConf: null,
  talkTitre: "Accessibilité sans excuse",
  talkType: "Conférence",
  speakeuseNom: "Léa Dubois",
  image: null,
  speakeuseHref: "/speakeuses/lea-dubois",
  profileId: 5,
  ...o,
});

/**
 * La page lit ses filtres dans l'URL : un rendu sans paramètre est la vue NUE.
 * Ce que ce niveau ne peut PAS prouver, c'est que Next branche bien
 * `searchParams` sur l'adresse réelle — c'est le rôle d'`e2e/agenda.spec.ts`,
 * qui navigue vraiment vers `/agenda?ville=…` (principes-tests §2 : un test qui
 * se fournit son propre `prop` ne teste pas le montage).
 */
const rendreAgenda = async (params: Record<string, string> = {}) =>
  render(await AgendaPublic({ searchParams: Promise.resolve(params) }));

describe("/agenda — l'horizon de la communauté", () => {
  it("les prochaines dates, groupées par mois", async () => {
    vi.mocked(getScenesHorizon).mockResolvedValue([
      scene({ occurrenceId: 1, date: "2026-09-10", talkTitre: "Tester sans peur" }),
      scene({ occurrenceId: 2, date: "2026-11-19" }),
    ]);
    await rendreAgenda();
    expect(screen.getByRole("heading", { name: /^à venir$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /septembre 2026/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /novembre 2026/i })).toBeInTheDocument();
  });

  it("dit combien d'interventions elle porte", async () => {
    // La page n'annonçait RIEN : on ignorait s'il restait deux dates ou
    // quarante (§3.1 de l'audit). Un fait énoncé sert la visiteuse, et donne
    // une phrase que les moteurs de réponse savent citer.
    vi.mocked(getScenesHorizon).mockResolvedValue([
      scene({ occurrenceId: 1, date: "2026-09-10" }),
      scene({ occurrenceId: 2, date: "2026-11-19" }),
    ]);
    await rendreAgenda();
    expect(screen.getByText(/2 interventions annoncées à ce jour/i)).toBeInTheDocument();
  });

  it("chaque intervention mène à la fiche de celle qui la porte", async () => {
    vi.mocked(getScenesHorizon).mockResolvedValue([scene({ date: "2026-11-19" })]);
    await rendreAgenda();
    // La date complète vit dans le NOM du lien : l'`aria-label` remplace le
    // contenu, et l'en-tête « novembre 2026 » n'accompagne pas le lien dans une
    // navigation par liens.
    const lien = screen.getByRole("link", {
      name: /19 novembre 2026.*accessibilité sans excuse.*léa dubois/i,
    });
    expect(lien).toHaveAttribute("href", "/speakeuses/lea-dubois");
    expect(within(lien).getByText(/devfest toulouse · toulouse/i)).toBeInTheDocument();
    // À l'écran, sous « NOVEMBRE 2026 », la carte n'ajoute que le jour.
    expect(within(lien).getByText(/jeudi 19/i)).toBeInTheDocument();
    expect(within(lien).queryByText(/19 novembre 2026/)).toBeNull();
  });

  it("le mois reste à l'écran en défilant, calé sous les barres du site", async () => {
    vi.mocked(getScenesHorizon).mockResolvedValue([scene({ date: "2026-11-19" })]);
    await rendreAgenda();
    const titre = screen.getByRole("heading", { name: /novembre 2026/i });
    // Calé sur la hauteur des deux barres du site, via le token partagé
    // `--spacing-barres` de globals.css (jamais une valeur réécrite ici).
    expect(titre).toHaveClass("sticky", "top-barres");
  });

  it("une carte qui prend le focus passe SOUS le mois collant, jamais derrière", async () => {
    vi.mocked(getScenesHorizon).mockResolvedValue([scene({ date: "2026-11-19" })]);
    await rendreAgenda();
    // Le `scroll-padding-top` du site ne réserve que ses deux barres : la bande
    // de mois s'ajoute par-dessus, et le lien tabulé se glissait dessous
    // (WCAG 2.4.11). La marge va sur le LIEN, seul à être la cible du focus, et
    // vaut SA HAUTEUR : une marge de quatre fois la bande posait le lien
    // focalisé si bas que le mois PRÉCÉDENT s'affichait au-dessus de lui.
    const lien = screen.getByRole("link", { name: /19 novembre 2026/i });
    expect(lien).toHaveClass("scroll-mt-bande-mois");
  });

  it("une annonce imprécise se contente de son en-tête de tranche", async () => {
    vi.mocked(getScenesHorizon).mockResolvedValue([
      scene({ date: "2026", talkTitre: "Tester ce qui compte" }),
    ]);
    await rendreAgenda();
    // Un seul « courant 2026 » visible : l'en-tête. La carte ne le répète pas.
    expect(screen.getAllByText(/courant 2026/i)).toHaveLength(1);
    // Mais le lien, lui, l'annonce (aria-label).
    expect(
      screen.getByRole("link", { name: /courant 2026.*tester ce qui compte/i }),
    ).toBeInTheDocument();
  });

  it("l'aperçu du passé s'affiche MÊME quand l'horizon est plein", async () => {
    // C'est le sens de « glissant » : l'horizon glisse dans les deux sens. Sans
    // cette permanence, la page serait nue en creux de saison, et l'archive
    // resterait invisible tant qu'aucune date n'est annoncée.
    vi.mocked(getScenesHorizon).mockResolvedValue([
      scene({ occurrenceId: 1, date: "2026-09-10" }),
      scene({ occurrenceId: 2, date: "2026-11-19" }),
    ]);
    vi.mocked(getApercuPasse).mockResolvedValue([
      scene({ occurrenceId: 3, date: "2026-05-02", talkTitre: "Talk du printemps" }),
    ]);
    vi.mocked(getAnneesArchive).mockResolvedValue([{ annee: 2026, nombre: 4 }]);
    await rendreAgenda();
    expect(screen.getByRole("heading", { name: /déjà en scène/i })).toBeInTheDocument();
    expect(screen.getByText(/talk du printemps/i)).toBeInTheDocument();
  });

  it("n'annonce JAMAIS une carte qu'elle ne montre pas", async () => {
    // LE DÉFAUT DE PROD DU 18/08, relevé sur une impression de la vraie page :
    // « 2 interventions depuis 2025. Voici la plus récente. » au-dessus de RIEN.
    // L'archive comptait deux dates au mois près (elle juge sur la fin de
    // période), l'aperçu emprunté au fil connecté n'acceptait qu'un jour exact.
    // La cause est soldée dans `getApercuPasse` ; ce test garde l'ÉCRAN, pour le
    // jour où l'aperçu revient vide pour une autre raison.
    vi.mocked(getScenesHorizon).mockResolvedValue([scene({ date: "2026-09-10" })]);
    vi.mocked(getApercuPasse).mockResolvedValue([]);
    vi.mocked(getAnneesArchive).mockResolvedValue([{ annee: 2025, nombre: 2 }]);
    await rendreAgenda();
    expect(screen.getByText(/2 interventions depuis 2025/i)).toBeInTheDocument();
    expect(screen.queryByText(/plus récente/i)).toBeNull();
    expect(screen.queryByText(/plus récentes/i)).toBeNull();
  });

  it("accorde sa phrase sur ce qu'elle montre vraiment", async () => {
    vi.mocked(getScenesHorizon).mockResolvedValue([scene({ date: "2026-09-10" })]);
    vi.mocked(getApercuPasse).mockResolvedValue([
      scene({ occurrenceId: 3, date: "2025-11", talkTitre: "Mois clos" }),
      scene({ occurrenceId: 4, date: "2025", talkTitre: "Année close" }),
    ]);
    vi.mocked(getAnneesArchive).mockResolvedValue([{ annee: 2025, nombre: 2 }]);
    await rendreAgenda();
    expect(screen.getByText(/voici les plus récentes/i)).toBeInTheDocument();
    // Et les deux cartes sont là : une date au mois près s'affiche, comme sur
    // `/agenda/[annee]` — c'est tout l'objet du correctif.
    expect(screen.getByText(/mois clos/i)).toBeInTheDocument();
    expect(screen.getByText(/année close/i)).toBeInTheDocument();
  });

  it("annonce le TOTAL de l'archive, et ouvre une porte par année", async () => {
    // Mémoire complète (décision du 16/08) : l'ancien plafond de douze cachait
    // les deux tiers de l'archive sans le dire. Le total affiché et un lien par
    // année sont ce qui rend la troncature silencieuse impossible à rejouer.
    vi.mocked(getAnneesArchive).mockResolvedValue([
      { annee: 2026, nombre: 9 },
      { annee: 2025, nombre: 14 },
      { annee: 2024, nombre: 3 },
    ]);
    await rendreAgenda();
    expect(screen.getByText(/26 interventions depuis 2024/i)).toBeInTheDocument();
    for (const annee of [2026, 2025, 2024]) {
      expect(screen.getByRole("link", { name: new RegExp(`^${annee},`) })).toHaveAttribute(
        "href",
        `/agenda/${annee}`,
      );
    }
  });

  it("AUCUN SEUIL : une année à une seule intervention garde sa porte", async () => {
    // Le passé se remplit à retardement, à mesure que les speakeuses complètent
    // leur fiche : masquer une année maigre reviendrait à cacher la page
    // pendant précisément la période où elle grandit.
    vi.mocked(getAnneesArchive).mockResolvedValue([{ annee: 2023, nombre: 1 }]);
    await rendreAgenda();
    expect(screen.getByRole("link", { name: /^2023, 1 intervention$/ })).toHaveAttribute(
      "href",
      "/agenda/2023",
    );
  });

  it("ids DOM uniques, horizon et archive confondus", async () => {
    vi.mocked(getScenesHorizon).mockResolvedValue([
      scene({ occurrenceId: 2, date: "2026-07-31", talkTitre: "Fin juillet à venir" }),
    ]);
    vi.mocked(getApercuPasse).mockResolvedValue([
      scene({ occurrenceId: 1, date: "2026-07-03", talkTitre: "Début juillet passé" }),
    ]);
    vi.mocked(getAnneesArchive).mockResolvedValue([{ annee: 2026, nombre: 1 }]);
    const { container } = await rendreAgenda();
    const ids = [...container.querySelectorAll("[id]")].map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("le passé vient APRÈS les dates à venir", async () => {
    vi.mocked(getScenesHorizon).mockResolvedValue([scene({ date: "2026-11-19" })]);
    vi.mocked(getAnneesArchive).mockResolvedValue([{ annee: 2025, nombre: 2 }]);
    await rendreAgenda();
    const titres = screen
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent);
    expect(titres.indexOf("À venir")).toBeLessThan(titres.indexOf("Déjà en scène"));
  });

  it("aucune date annoncée : on dit ce qui EST, et on renvoie à l'annuaire", async () => {
    await rendreAgenda();
    expect(
      screen.getByRole("heading", { name: /les prochaines dates arrivent/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /déjà en scène/i })).toBeNull();
  });

  it("base indisponible : la page s'affiche quand même", async () => {
    vi.mocked(getScenesHorizon).mockRejectedValue(new Error("db down"));
    await rendreAgenda();
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("aucune violation a11y (axe)", async () => {
    vi.mocked(getScenesHorizon).mockResolvedValue([scene({ date: "2026-11-19" })]);
    vi.mocked(getApercuPasse).mockResolvedValue([
      scene({ occurrenceId: 2, date: "2025-11-20" }),
    ]);
    vi.mocked(getAnneesArchive).mockResolvedValue([{ annee: 2025, nombre: 5 }]);
    const { container } = await rendreAgenda();
    expect(await axe(container)).toHaveNoViolations();
  });
});

/**
 * L'ENTRÉE DE L'AGENDA (lot 1) : la recherche, les trois facettes, et le résumé
 * qui nomme le filtre actif.
 *
 * Ce que ces tests gardent, et qui n'était gardé nulle part : qu'une commande
 * ANNONCE son rendement (on ne clique pas dans le vide), qu'un filtre posé dans
 * l'URL arrive jusqu'à la liste, que le résumé dise SUR QUOI il a filtré, et
 * qu'un filtre gouverne la page entière plutôt que la seule section du haut.
 */
describe("/agenda — l'entrée : recherche et facettes", () => {
  /** Trois dates : deux à Toulouse (même conférence, deux libellés), une à Paris. */
  const horizonVarie = () => [
    scene({ occurrenceId: 1, date: "2026-09-10", talkTitre: "Tester sans peur" }),
    scene({
      occurrenceId: 2,
      date: "2026-09-24",
      conference: "DevFest",
      talkTitre: "Des tableaux de bord qu'on lit vraiment",
    }),
    scene({
      occurrenceId: 3,
      date: "2026-11-19",
      ville: "Paris",
      region: "Île-de-France",
      conference: "Devoxx France 2026",
      conferenceCle: "devoxx-france",
      conferenceLibelle: "Devoxx France",
      talkTitre: "Migrer sans réveiller personne",
      speakeuseNom: "Aïcha Benali",
      speakeuseHref: "/speakeuses/aicha-benali",
    }),
  ];

  it("chaque option annonce ce qu'elle rend", async () => {
    // Repris de `134onstage` (§4.4 de l'audit) : une facette qui n'annonce pas
    // son rendement fait cliquer dans le vide.
    vi.mocked(getScenesHorizon).mockResolvedValue(horizonVarie());
    await rendreAgenda();
    const villes = screen.getByRole("combobox", { name: "Ville" });
    expect(
      within(villes).getByRole("option", { name: "Toutes les villes (3)" }),
    ).toBeInTheDocument();
    expect(within(villes).getByRole("option", { name: "Paris (1)" })).toBeInTheDocument();
    expect(
      within(villes).getByRole("option", { name: "Toulouse (2)" }),
    ).toBeInTheDocument();
    // Et la conférence est nommée par le REGISTRE : « DevFest » et « DevFest
    // Toulouse » sont une seule entrée, à deux interventions.
    const confs = screen.getByRole("combobox", { name: "Conférence" });
    expect(
      within(confs).getByRole("option", { name: "DevFest Toulouse (2)" }),
    ).toBeInTheDocument();
  });

  it("le formulaire renvoie sur l'adresse de la page", async () => {
    // Sans quoi l'état ne vivrait pas dans l'URL, et le lien partagé — qui est
    // le produit (§4.5) — ne dirait rien de ce qu'on regarde.
    vi.mocked(getScenesHorizon).mockResolvedValue(horizonVarie());
    const { container } = await rendreAgenda();
    expect(container.querySelector("form")).toHaveAttribute("action", "/agenda");
  });

  it("un filtre de l'URL filtre la liste, et le résumé le NOMME", async () => {
    vi.mocked(getScenesHorizon).mockResolvedValue(horizonVarie());
    await rendreAgenda({ ville: "paris" });
    expect(screen.getByText(/Migrer sans réveiller personne/)).toBeInTheDocument();
    expect(screen.queryByText(/Tester sans peur/)).toBeNull();
    // « ou en ligne » n'est pas un ornement : le compte inclut les visios, donc
    // le libellé doit le dire (décision du 17/08).
    expect(
      screen.getByText("1 intervention annoncée à Paris ou en ligne."),
    ).toBeInTheDocument();
  });

  it("les deux libellés d'une même conférence se filtrent ENSEMBLE", async () => {
    // Le défaut mesuré en prod : une facette bâtie sur le libellé figé aurait
    // listé « DevFest » et « DevFest Toulouse » séparément (§4.1).
    vi.mocked(getScenesHorizon).mockResolvedValue(horizonVarie());
    await rendreAgenda({ conference: "devfest-toulouse" });
    expect(screen.getByText(/Tester sans peur/)).toBeInTheDocument();
    expect(screen.getByText(/tableaux de bord/)).toBeInTheDocument();
    expect(screen.queryByText(/Migrer sans réveiller personne/)).toBeNull();
  });

  it("la recherche libre trouve un NOM, sans facette dédiée", async () => {
    // Décision du 17/08 : aucune facette « intervenante » (l'annuaire le fait
    // mieux), mais chercher un nom reste possible.
    vi.mocked(getScenesHorizon).mockResolvedValue(horizonVarie());
    await rendreAgenda({ q: "aicha" });
    expect(screen.getByText(/Migrer sans réveiller personne/)).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Intervenante" })).toBeNull();
    expect(
      screen.getByText("1 intervention annoncée correspondant à ta recherche « aicha »."),
    ).toBeInTheDocument();
  });

  it("une commande sans choix à faire ne s'affiche pas", async () => {
    // « Les filtres raffinent, et disparaissent quand il n'y a qu'une famille »
    // (checklist COGA) : une seule ville au programme = aucune décision à
    // prendre, donc aucune commande à lire.
    vi.mocked(getScenesHorizon).mockResolvedValue([
      scene({ occurrenceId: 1, date: "2026-09-10" }),
      scene({ occurrenceId: 2, date: "2026-09-24" }),
    ]);
    await rendreAgenda();
    expect(screen.queryByRole("combobox", { name: "Ville" })).toBeNull();
    expect(screen.getByRole("searchbox", { name: "Rechercher" })).toBeInTheDocument();
  });

  it("un filtre qui ne ramène rien : la page le dit, et garde sa commande à jour", async () => {
    vi.mocked(getScenesHorizon).mockResolvedValue(horizonVarie());
    await rendreAgenda({ ville: "lyon" });
    // Capitale en tête : un slug d'URL brut au milieu d'une phrase française se
    // remarquait (revue d'écran du 18/08). L'accent perdu par `slugify` ne se
    // rattrape pas, le minuscule si.
    expect(
      screen.getByText("Aucune intervention annoncée à Lyon ou en ligne."),
    ).toBeInTheDocument();
    // La commande montre la valeur en cours : sans cette option, elle
    // afficherait « Toutes les villes » au-dessus d'une page vide.
    expect(screen.getByRole("combobox", { name: "Ville" })).toHaveValue("lyon");
    // Et une seule porte pour effacer, dans la barre.
    expect(screen.getAllByRole("link", { name: "Tout effacer" })).toHaveLength(1);
  });

  it("sans aucune date à venir, la page n'offre aucun filtre", async () => {
    await rendreAgenda();
    expect(screen.queryByRole("searchbox", { name: "Rechercher" })).toBeNull();
    expect(
      screen.getByRole("heading", { name: /les prochaines dates arrivent/i }),
    ).toBeInTheDocument();
  });

  it("un filtre gouverne la page entière : l'aperçu du passé s'y plie, ses portes restent", async () => {
    vi.mocked(getScenesHorizon).mockResolvedValue(horizonVarie());
    vi.mocked(getApercuPasse).mockResolvedValue([
      scene({ occurrenceId: 8, date: "2026-05-02", talkTitre: "Talk du printemps" }),
    ]);
    vi.mocked(getAnneesArchive).mockResolvedValue([{ annee: 2026, nombre: 4 }]);
    await rendreAgenda({ ville: "paris" });
    // Trois cartes du passé qui ignorent le filtre contrediraient la commande.
    expect(screen.queryByText(/Talk du printemps/)).toBeNull();
    // L'année, elle, est un AUTRE document : sa porte et son compte restent.
    expect(screen.getByRole("link", { name: "2026, 4 interventions" })).toHaveAttribute(
      "href",
      "/agenda/2026",
    );
  });

  it("une vue filtrée ne déclare RIEN aux moteurs, la page nue déclare tout", async () => {
    // Le `canonical` d'une vue filtrée pointe la page nue : un balisage servi là
    // prétendrait décrire `/agenda` en n'y listant qu'une date sur quarante
    // (revue du 18/08). Le document décrit, c'est la page nue — et elle le
    // déclare en entier.
    vi.mocked(getScenesHorizon).mockResolvedValue(horizonVarie());
    const filtree = await rendreAgenda({ ville: "paris" });
    expect(filtree.container.querySelector('script[type="application/ld+json"]')).toBeNull();
    cleanup();

    const { container } = await rendreAgenda();
    const bloc = container.querySelector('script[type="application/ld+json"]');
    expect(bloc?.textContent).toContain("Migrer sans réveiller personne");
    expect(bloc?.textContent).toContain("Tester sans peur");
  });

  it("horizon vide MAIS filtre posé : la barre reste, avec sa porte de sortie", async () => {
    // Un lien partagé `?ville=toulouse` ouvert en creux de saison rendait une
    // page sans commande, sans « Tout effacer » et sans un seul lien vers
    // l'agenda nu — un cul-de-sac, sur une page plus pauvre que `/agenda`
    // (revue du 18/08).
    vi.mocked(getAnneesArchive).mockResolvedValue([{ annee: 2026, nombre: 4 }]);
    await rendreAgenda({ ville: "toulouse" });
    expect(screen.getByRole("searchbox", { name: "Rechercher" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tout effacer" })).toHaveAttribute(
      "href",
      "/agenda",
    );
  });

  it("aucune violation a11y sur une page filtrée (axe)", async () => {
    vi.mocked(getScenesHorizon).mockResolvedValue(horizonVarie());
    vi.mocked(getAnneesArchive).mockResolvedValue([{ annee: 2025, nombre: 5 }]);
    const { container } = await rendreAgenda({ ville: "toulouse", q: "tester" });
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Home — extrait « Bientôt en scène »", () => {
  it("montre les 3 prochaines dates et renvoie à l'agenda", async () => {
    vi.mocked(getScenesPubliques).mockResolvedValue([
      scene({ occurrenceId: 1, date: "2026-09-10", talkTitre: "Un" }),
      scene({ occurrenceId: 2, date: "2026-09-24", talkTitre: "Deux" }),
      scene({ occurrenceId: 3, date: "2026-10-01", talkTitre: "Trois" }),
      scene({ occurrenceId: 4, date: "2026-11-19", talkTitre: "Quatre" }),
    ]);
    render(await Home());
    const bloc = screen.getByRole("region", { name: /bientôt en scène/i });
    expect(within(bloc).getAllByRole("listitem")).toHaveLength(3);
    expect(within(bloc).getByText("Un")).toBeInTheDocument();
    expect(within(bloc).queryByText("Quatre")).toBeNull();
    expect(
      within(bloc).getByRole("link", { name: /voir tout l'agenda/i }),
    ).toHaveAttribute("href", "/agenda");
  });

  it("le lien « voir tout l'agenda » vient APRÈS les cartes, pas avant", async () => {
    vi.mocked(getScenesPubliques).mockResolvedValue([
      scene({ occurrenceId: 1, date: "2026-09-10", talkTitre: "Un" }),
    ]);
    render(await Home());
    const bloc = screen.getByRole("region", { name: /bientôt en scène/i });
    const positions = [...bloc.querySelectorAll("li, a")].map((el) =>
      el.textContent?.includes("Voir tout l'agenda") ? "lien" : "carte",
    );
    expect(positions.indexOf("lien")).toBeGreaterThan(positions.lastIndexOf("carte"));
  });

  it("plus de 3 speakeuses sur la date la plus proche : l'extrait tourne, sans jamais avancer une date plus lointaine", async () => {
    vi.mocked(getScenesPubliques).mockResolvedValue([
      scene({ occurrenceId: 1, date: "2026-09-10", talkTitre: "Un", speakeuseNom: "Amina" }),
      scene({ occurrenceId: 2, date: "2026-09-10", talkTitre: "Deux", speakeuseNom: "Bilal" }),
      scene({ occurrenceId: 3, date: "2026-09-10", talkTitre: "Trois", speakeuseNom: "Chloé" }),
      scene({ occurrenceId: 4, date: "2026-09-10", talkTitre: "Quatre", speakeuseNom: "Diane" }),
      scene({ occurrenceId: 5, date: "2026-11-19", talkTitre: "Cinq", speakeuseNom: "Elsa" }),
    ]);
    render(await Home());
    const bloc = screen.getByRole("region", { name: /bientôt en scène/i });
    expect(within(bloc).getAllByRole("listitem")).toHaveLength(3);
    // La date lointaine n'avance jamais devant la date la plus proche.
    expect(within(bloc).queryByText("Cinq")).toBeNull();
  });

  it("hors tranche de mois, la carte ne réserve aucune bande collante", async () => {
    vi.mocked(getScenesPubliques).mockResolvedValue([
      scene({ date: "2026-09-10", talkTitre: "Un" }),
    ]);
    render(await Home());
    const bloc = screen.getByRole("region", { name: /bientôt en scène/i });
    expect(within(bloc).getByRole("link", { name: /un/i })).not.toHaveClass(
      "scroll-mt-bande-mois",
    );
  });

  it("aucune date à venir : pas de cadre vide sur la home", async () => {
    vi.mocked(getScenesPubliques).mockResolvedValue([
      scene({ date: "2025-11-20" }),
    ]);
    render(await Home());
    expect(screen.queryByRole("region", { name: /bientôt en scène/i })).toBeNull();
  });

  it("une date passée ne s'affiche jamais sous « bientôt »", async () => {
    vi.mocked(getScenesPubliques).mockResolvedValue([
      scene({ occurrenceId: 1, date: "2025-11-20", talkTitre: "Vieux talk" }),
      scene({ occurrenceId: 2, date: "2026-11-19", talkTitre: "Talk à venir" }),
    ]);
    render(await Home());
    const bloc = screen.getByRole("region", { name: /bientôt en scène/i });
    expect(within(bloc).getByText("Talk à venir")).toBeInTheDocument();
    expect(within(bloc).queryByText("Vieux talk")).toBeNull();
  });
});

/**
 * LE NOM SAISI PAR UNE MEMBRE, RENDU SANS SE COUPER.
 *
 * `conference` et `talkTitre` viennent de ce qu'une speakeuse tape dans son
 * espace : elle écrit « Meetup Tech Speak'Her » au clavier, donc en espace
 * ordinaire, et `/agenda` l'affiche tel quel. Le nom s'y coupait en fin de
 * ligne sur mobile.
 *
 * La correction est un repli d'AFFICHAGE : rien n'est réécrit en base, la saisie
 * de la membre lui reste intacte. On le vérifie donc au RENDU, pas sur la
 * fonction — c'est le seul niveau où la visiteuse voit la différence.
 */
describe("agenda public — le nom tapé par une membre ne se coupe pas", () => {
  const NBSP = "\u00A0";
  const TSH = `Tech${NBSP}Speak'Her`;

  beforeEach(() => {
    vi.mocked(getScenesHorizon).mockResolvedValue([
      scene({
        date: "2026-09-10",
        // Exactement ce qu'une membre tape : deux espaces ORDINAIRES.
        conference: "Meetup Tech Speak'Her",
        talkTitre: "Retour d'expérience Tech Speak'Her",
      }),
    ]);
  });

  it("l'affiche avec une insécable, dans le lieu comme dans le titre", async () => {
    await rendreAgenda();

    // Sur le texte RENDU BRUT, et non via `getByText` : son normaliseur replie
    // les blancs avant de comparer, donc une insécable et une espace ordinaire
    // s'y valent — un test écrit ainsi ne pourrait PAS voir ce défaut.
    //
    // Les <script> en sont EXCLUS, comme le fait déjà `e2e/mots-colles.spec.ts` :
    // le corps porte aussi la charge RSC de Next et, depuis le lot 3, les
    // données structurées de l'agenda. Le nom y est sérialisé pour être
    // APPARIÉ par des machines, donc en espace ordinaire (règle du registre :
    // les données passent par `ASSOCIATION.nom`), et jamais affiché. Le juger
    // reviendrait à corriger du JSON qui ne se coupe sur aucune ligne.
    const rendu = [...document.body.childNodes]
      .flatMap(function texte(n: Node): string[] {
        if (n.nodeType === Node.ELEMENT_NODE) {
          const balise = (n as Element).tagName.toLowerCase();
          if (["script", "style", "noscript", "template"].includes(balise)) return [];
        }
        return n.childNodes.length
          ? [...n.childNodes].flatMap(texte)
          : [n.textContent ?? ""];
      })
      .join("");
    expect(rendu).toContain(`Meetup ${TSH}`);
    expect(rendu).toContain(`Retour d'expérience ${TSH}`);
    // Et plus une seule espace sécable dans le nom, où qu'il soit affiché.
    expect(rendu).not.toContain("Tech Speak'Her");
  });

  /**
   * Le nom accessible du lien, lui, garde la graphie des STATUTS : il est LU
   * par une synthèse vocale, jamais mis en page. Même règle que `alt`.
   */
  it("laisse le nom accessible du lien en espace ordinaire", async () => {
    await rendreAgenda();
    const lien = screen.getByRole("link", { name: /Retour d'expérience/ });
    expect(lien.getAttribute("aria-label")).toContain("Tech Speak'Her");
  });
});
