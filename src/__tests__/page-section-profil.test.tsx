import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";

expect.extend(toHaveNoViolations);

/**
 * Lot I — « Ma fiche » et ses sections.
 *
 * Deux écrans, une règle : une page = un rôle. « Ma fiche » montre ce que le
 * PUBLIC lit — le contenu réel, pas une liste de noms de rubriques — avec un
 * crayon par section ; la page d'une section n'édite QU'ELLE. Ce fichier tient
 * les gardes (hors session, sans fiche, clé inventée) et le fait que chaque
 * partie de la fiche reste atteignable, y compris vide.
 */

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
  redirect: vi.fn((p: string) => {
    throw new Error(`REDIRECT:${p}`);
  }),
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/profiles", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/profiles")>();
  return { ...actual, getProfileByUserId: vi.fn() };
});
vi.mock("@/lib/users", async (importOriginal) => ({
  // Le VRAI critère : recopié ici, il ne suivrait pas un changement de règle.
  peutCreerFiche: (await importOriginal<typeof import("@/lib/users")>()).peutCreerFiche,
  getCompte: vi.fn(async () => ({ name: "Léa Dubois" })),
}));
// La section identité propose la reprise de photo LinkedIn seulement si
// LinkedIn est rattaché : la page lit donc les providers du compte.
vi.mock("@/lib/accounts", () => ({ getLinkedProviders: vi.fn(async () => []) }));
vi.mock("@/lib/talks", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  // L'espace perso lit la vue COMPLÈTE (contrat de la lib) : la lecture publique
  // excluait les propositions issues du backfill Tremplin, invisibles à leur
  // propre autrice.
  getTalksByProfileId: vi.fn(async () => []),
  // Lu avec les talks, pour les fenêtres « Une date » (2026-10-15).
  getOccurrenceSuggestions: vi.fn(async () => ({ registre: [], villes: [], pays: [] })),
}));
vi.mock("@/app/mon-espace/fiche/[section]/SectionForm", () => ({
  default: ({ cle }: { cle: string }) => <form data-testid="form-section">{cle}</form>,
}));
vi.mock("@/app/mon-espace/ProfileForm", () => ({
  default: () => <form data-testid="assistant">assistant de création</form>,
}));

import { auth } from "@/auth";
import { getProfileByUserId } from "@/lib/profiles";
import MaFiche from "@/app/mon-espace/fiche/page";
import SectionDeMaFiche, {
  generateMetadata,
} from "@/app/mon-espace/fiche/[section]/page";
import { makeFiche } from "./test-helpers";

afterEach(cleanup);

const fiche = makeFiche;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({
    user: { id: "7", name: "Léa", isOrga: false },
  } as never);
  vi.mocked(getProfileByUserId).mockResolvedValue(fiche());
});

const sommaire = () => MaFiche({ searchParams: Promise.resolve({}) });
const section = (cle: string) =>
  SectionDeMaFiche({ params: Promise.resolve({ section: cle }) });

describe("« Ma fiche » — ce que le public lit, avec un crayon par section", () => {
  /**
   * Le cœur du lot : on ne liste plus des NOMS de rubriques avec un résumé, on
   * montre la fiche. Une liste de noms obligeait à ouvrir chaque section pour
   * savoir ce qu'elle contenait — exactement ce qu'on vient de corriger sur les
   * sous-groupes, et pour la même raison.
   */
  it("rend le CONTENU de la fiche, pas des noms de rubriques", async () => {
    render(await sommaire());
    expect(screen.getByText("Léa Dubois")).toBeInTheDocument();
    expect(screen.getByText(/développeuse plateforme/i)).toBeInTheDocument();
    expect(screen.getByText(/dix ans de systèmes distribués/i)).toBeInTheDocument();
    expect(screen.getByText("Industrie / Manufacturing")).toBeInTheDocument();
    expect(screen.getByText("Cloud / DevOps / Infra")).toBeInTheDocument();
    expect(screen.getByText("Occitanie")).toBeInTheDocument();
    expect(screen.getByText("Français")).toBeInTheDocument();
  });

  /**
   * LA RANGÉE ENTIÈRE de chaque partie est le lien vers sa page. C'était un
   * crayon isolé à droite du titre : cible de 44 px mais séparée de son titre par
   * jusqu'à 500 px de vide, et six contrôles visuellement identiques dont
   * l'unicité ne vivait que dans l'`aria-label` (interdit par les principes §6).
   */
  it("chaque partie est une rangée-lien vers SA page, nommée par son titre", async () => {
    render(await sommaire());
    const attendus: [RegExp, string][] = [
      [/qui tu es/i, "/mon-espace/fiche/identite"],
      [/tes secteurs/i, "/mon-espace/fiche/secteurs"],
      [/tes sujets/i, "/mon-espace/fiche/sujets"],
      [/où tu interviens/i, "/mon-espace/fiche/interventions"],
      [/où te trouver/i, "/mon-espace/fiche/contact"],
      [/ton attestation/i, "/mon-espace/fiche/attestation"],
    ];
    for (const [nom, href] of attendus) {
      expect(screen.getByRole("link", { name: nom }), String(nom)).toHaveAttribute("href", href);
    }
    // Et les talks, hors registre, cessent d'être un cul-de-sac : sans talk, le
    // lien mène à la CRÉATION — « Ajouter » et non « Modifier ».
    expect(screen.getByRole("link", { name: /tes talks.*ajouter/i })).toHaveAttribute(
      "href",
      "/mon-espace/talks/nouveau",
    );
  });

  /**
   * Une section VIDE ne rend rien sur la fiche publique : sans traitement, son
   * crayon disparaîtrait et la section deviendrait inéditable. On dit alors ce
   * qui manque, à la forme POSITIVE (« Aucun secteur choisi »), et le crayon
   * reste.
   */
  it("une partie vide reste atteignable, et dit ce qui manque à la forme positive", async () => {
    vi.mocked(getProfileByUserId).mockResolvedValue(
      fiche({ secteurs: [], sujets: [], regions: [], langues: [] }),
    );
    render(await sommaire());
    expect(screen.getByText(/aucun secteur choisi/i)).toBeInTheDocument();
    expect(screen.getByText(/aucune zone ni langue choisie/i)).toBeInTheDocument();
    // Le VERBE suit l'état : on n'« ajoute » pas ce qui existe, on ne « modifie »
    // pas ce qui manque.
    expect(screen.getByRole("link", { name: /tes secteurs.*ajouter/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /qui tu es.*modifier/i })).toBeInTheDocument();
    // Forme positive : pas de « ne … pas », pas de « 0 secteur ».
    expect(document.body.textContent).not.toMatch(/\b0 (secteur|sujet|région|langue)/i);
  });

  /** L'attestation ne s'affiche PAS sur la fiche publique : sans rangée propre,
   * elle serait inéditable — le bug que sa page d'édition a corrigé. */
  it("l'attestation, invisible du public, a sa rangée ET c'est DIT", async () => {
    render(await sommaire());
    expect(screen.getByRole("link", { name: /ton attestation/i })).toHaveAttribute(
      "href",
      "/mon-espace/fiche/attestation",
    );
    // L'écran promet « ta fiche telle qu'on la lit » : ce qui reste privé se dit.
    expect(screen.getByText(/visible par toi seule/i)).toBeInTheDocument();
  });

  /**
   * L'écran ressemble maintenant à la fiche finie, donc « ce que les orgas
   * voient » se lit comme un CONSTAT. Sur cinq statuts, quatre ne sont pas dans
   * l'annuaire — et « En retrait » en est l'inverse.
   */
  it("dit le STATUT en mots, et adapte la promesse", async () => {
    render(await sommaire());
    expect(screen.getByText(/publiée/i)).toBeInTheDocument();
    expect(screen.getByText(/telle que les organisatrices la lisent/i)).toBeInTheDocument();
    cleanup();

    vi.mocked(getProfileByUserId).mockResolvedValue(fiche({ status: "en_attente" }));
    render(await sommaire());
    expect(screen.getByText(/en attente/i)).toBeInTheDocument();
    expect(screen.getByText(/une fois validée/i)).toBeInTheDocument();
  });

  /** « Envoyer un message » est le geste d'une VISITEUSE : en vue propriétaire
   * c'était le plus gros bouton de l'écran, et il menait à un formulaire pour
   * s'écrire à soi-même. */
  it("aucun bouton pour s'écrire à soi-même : on décrit le canal", async () => {
    render(await sommaire());
    expect(screen.queryByRole("link", { name: /envoyer un message/i })).toBeNull();
    expect(screen.getByText(/messages par e-mail/i)).toBeInTheDocument();
  });

  it("donne l'ADRESSE publique, à partager", async () => {
    render(await sommaire());
    expect(
      screen.getByRole("link", { name: /techspeakher\.fr\/speakeuses\/lea-dubois/i }),
    ).toHaveAttribute("href", "/speakeuses/lea-dubois");
  });

  it("« Ma fiche » ne porte AUCUN formulaire (elle montre, elle n'édite pas)", async () => {
    const { container } = render(await sommaire());
    expect(container.querySelector("form")).toBeNull();
  });

  /**
   * Sans fiche, il n'y a rien à montrer : c'est l'assistant qui a le bon rôle —
   * lui seul recueille l'attestation.
   */
  it("sans fiche : l'assistant de création, pas une fiche vide", async () => {
    vi.mocked(getProfileByUserId).mockResolvedValue(null);
    render(await sommaire());
    expect(screen.getByTestId("assistant")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /qui tu es/i })).toBeNull();
  });

  it("hors session : direction la connexion", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    await expect(sommaire()).rejects.toThrow("REDIRECT:/connexion");
  });

  /** UN SEUL `h1` par page : la page porte « Ma fiche speakeuse », donc le nom
   * ne peut pas en être un deuxième — deux titres de niveau 1 cassent le plan du
   * document, et un lecteur d'écran en annonce deux pour un seul écran. */
  it("un seul titre de niveau 1", async () => {
    render(await sommaire());
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  /** Chaque en-tête de partie dit déjà « Tes secteurs » : répéter « Secteurs »
   * juste en dessous est du bruit. */
  it("aucun titre répété au-dessus des mêmes contenus", async () => {
    render(await sommaire());
    expect(screen.getByText(/tes secteurs/i)).toBeInTheDocument();
    expect(screen.queryByText("Secteurs")).toBeNull();
    expect(screen.queryByText("Sujets")).toBeNull();
    // « Où tu interviens » garde SES étiquettes : deux listes distinctes dans un
    // même bloc, elles ne se devinent pas. « Régions » et non « Intervient » —
    // qui parlait d'elle à la troisième personne sous un titre en « tu ».
    expect(screen.getByText("Régions")).toBeInTheDocument();
    expect(screen.getByText("Langues")).toBeInTheDocument();
  });

  it("aucune violation a11y (axe)", async () => {
    const { container } = render(await sommaire());
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("La page d'UNE section", () => {
  it("ouvre la section demandée, son titre et son aide en tête", async () => {
    render(await section("secteurs"));
    expect(
      screen.getByRole("heading", { level: 1, name: /tes secteurs/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/les organisatrices filtrent l'annuaire avec/i)).toBeInTheDocument();
    expect(screen.getByTestId("form-section")).toHaveTextContent("secteurs");
  });

  it("une clé inventée est introuvable (le registre ne devine jamais)", async () => {
    for (const cle of ["constructor", "__proto__", "inconnue"]) {
      await expect(section(cle), cle).rejects.toThrow("NOT_FOUND");
    }
  });

  it("sans fiche : on repart de l'assistant plutôt que d'éditer du vide", async () => {
    vi.mocked(getProfileByUserId).mockResolvedValue(null);
    await expect(section("secteurs")).rejects.toThrow("REDIRECT:/mon-espace/fiche");
  });

  it("hors session : direction la connexion", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    await expect(section("secteurs")).rejects.toThrow("REDIRECT:/connexion");
  });

  it("le titre de page nomme la section, et reste hors moteurs", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ section: "contact" }) });
    expect(meta.title).toMatch(/Où te trouver/);
    expect(meta.robots).toMatchObject({ index: false });
  });

  it("aucune violation a11y (axe)", async () => {
    const { container } = render(await section("identite"));
    expect(await axe(container)).toHaveNoViolations();
  });

  /**
   * CE QUE LA PERSONNE APPREND DE SON GESTE. Après « Enregistrer », la fiche
   * était muette : focus retombé sur `body`, régions vives VIDES, aucun texte.
   * Sur un lecteur d'écran, rien ne se passait. La section est nommée dans
   * l'adresse de retour, et `ConfirmationBanner` la dit — région montée vide
   * puis remplie (seule forme réellement annoncée), focus porté dessus.
   */
  it("dit QUELLE section vient d'être enregistrée", async () => {
    render(await MaFiche({ searchParams: Promise.resolve({ ok: "secteurs" }) }));
    // On attend le TEXTE, pas la région : `ConfirmationBanner` monte la région
    // vide puis la remplit, et c'est précisément ce qui la rend annonçable — une
    // région déjà pleine au montage n'est lue par aucun lecteur d'écran.
    const annonce = await screen.findByText(/Tes secteurs.+c'est enregistré/);
    expect(annonce).toHaveAttribute("role", "status");
    // Et le focus est porté dessus (« confirmation focalisée », checklist COGA).
    expect(annonce).toHaveFocus();
  });

  it("chaque section a son propre message, jamais un « enregistré » anonyme", async () => {
    render(await MaFiche({ searchParams: Promise.resolve({ ok: "contact" }) }));
    expect(await screen.findByText(/Où te trouver.+c'est enregistré/)).toBeInTheDocument();
  });

  /** Une clé inventée dans l'URL n'annonce rien : on ne confirme pas un geste
   * qui n'a pas eu lieu. */
  it("une clé de section inconnue n'annonce rien", async () => {
    render(await MaFiche({ searchParams: Promise.resolve({ ok: "inventee" }) }));
    expect(screen.queryByText(/c'est enregistré/)).toBeNull();
  });
});
