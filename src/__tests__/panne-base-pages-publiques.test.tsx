import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

/**
 * QUAND LA BASE SE TAIT : chaque page publique doit répondre ce qu'elle veut
 * VRAIMENT dire, aux humains comme aux moteurs.
 *
 * Trois pages dynamiques réagissent différemment à une base injoignable, et la
 * différence est délibérée — mais elle ne l'était écrite nulle part, et rien ne
 * la gardait. Un jour, quelqu'un « harmonise » : il voit un 500 dans les logs,
 * trouve le `try/catch` de la page d'à côté, le recopie, et rend les fiches
 * désindexables à la prochaine panne sans qu'aucun test ne tombe.
 *
 * La règle qui les départage :
 *
 *   • `/[slug]` **rattrape → 404**. Ce segment capte TOUT chemin d'un seul
 *     niveau : sans filet, une base muette transformerait chaque faute de
 *     frappe du site en 500. La raison tient à sa PORTÉE, et ne se transpose
 *     pas aux deux autres.
 *
 *   • `/speakeuses/[id]` et `/articles/[slug]` **laissent remonter → 500**. Un
 *     404 est une AFFIRMATION (« ceci n'existe pas ») qui inviterait les
 *     moteurs à désindexer une fiche ou un article bien réels et publiés. Un
 *     500 dit « je ne peux pas répondre là » : ils repassent, le référencement
 *     survit.
 *
 *   • `/speakeuses` (la liste) **reste affichable**, mais distingue enfin la
 *     panne du vide : deux phrases, et un `noindex` posé UNIQUEMENT en panne.
 *     Le dépôt s'est déjà brûlé ici (2026-07-23 : annuaire vide servi alors que
 *     5 fiches étaient publiées) — le repli silencieux avait masqué la panne.
 */

// La page /speakeuses cache sa LECTURE (unstable_cache) : en test, passthrough
// sans mémoïsation — le vrai cache servirait le résultat d'un test au suivant.
vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...a: unknown[]) => unknown) => fn,
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  // On distingue les deux issues par le message : `notFound()` = 404 rendu,
  // toute autre erreur = 500 (l'erreur d'origine remonte au boundary Next).
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));
vi.mock("@/lib/contenus", () => ({ getContenuPublieBySlug: vi.fn() }));
vi.mock("@/lib/profiles", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/profiles")>();
  return {
    ...actual,
    getPublishedAnnuaire: vi.fn(),
    getProfileByHandle: vi.fn(),
    getProfilPublicByUserId: vi.fn(async () => null),
  };
});
vi.mock("@/lib/talks", () => ({
  getPublicTalksByProfileId: vi.fn(async () => []),
  getPublicTalkTextByProfile: vi.fn(async () => new Map()),
  getPublicTalkTitlesByProfile: vi.fn(async () => new Map()),
}));
vi.mock("@/lib/conference-speakers", () => ({
  getPublicSpeakersByConferenceEdition: vi.fn(async () => []),
}));
vi.mock("@/auth", () => ({ auth: vi.fn(async () => null) }));
vi.mock("@/app/admin/actions", () => ({ moderateProfileAction: vi.fn() }));

import { notFound } from "next/navigation";
import { getContenuPublieBySlug } from "@/lib/contenus";
import { getPublishedAnnuaire, getProfileByHandle } from "@/lib/profiles";
import PageEditoriale from "@/app/[slug]/page";
import FicheSpeakeuse from "@/app/speakeuses/[id]/page";
import Article from "@/app/articles/[slug]/page";
import { generateMetadata as annuaireMetadata } from "@/app/speakeuses/page";
import SpeakeusesFilter from "@/app/speakeuses/SpeakeusesFilter";

const PANNE = new Error("connect ECONNREFUSED 127.0.0.1:5432");

beforeEach(() => vi.clearAllMocks());

// `cleanup` APRÈS chaque test, pas avant : nettoyer en amont laisse le dernier
// rendu monté jusqu'au démontage de l'environnement, et React y flushe encore
// du travail — d'où un « window is not defined » remonté en erreur NON GÉRÉE.
// Vitest annonce alors « 3237 passed » ET sort en code 1 : la CI rougit sans
// qu'aucun test ne soit rouge.
afterEach(cleanup);

describe("base injoignable — l'attrape-tout amortit (404)", () => {
  it("/[slug] rend un 404 plutôt que de planter", async () => {
    vi.mocked(getContenuPublieBySlug).mockRejectedValue(PANNE);
    // Sans le filet, CHAQUE URL inconnue du site tomberait en 500 pendant une
    // panne — c'est la raison d'être de ce rattrapage, et elle lui est propre.
    await expect(
      PageEditoriale({ params: Promise.resolve({ slug: "plan-du-site" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });
});

describe("base injoignable — les pages de CONTENU laissent remonter (500)", () => {
  it("/speakeuses/[id] propage la panne au lieu d'affirmer que la fiche n'existe pas", async () => {
    vi.mocked(getProfileByHandle).mockRejectedValue(PANNE);
    await expect(
      FicheSpeakeuse({ params: Promise.resolve({ id: "5" }) }),
    ).rejects.toThrow(/ECONNREFUSED/);
    // LE POINT DE TOUT LE FICHIER : un 404 ici dirait aux moteurs de retirer de
    // l'index la fiche d'une speakeuse réelle et publiée.
    expect(notFound).not.toHaveBeenCalled();
  });

  it("/articles/[slug] propage la panne au lieu d'affirmer que l'article n'existe pas", async () => {
    vi.mocked(getContenuPublieBySlug).mockRejectedValue(PANNE);
    await expect(
      Article({ params: Promise.resolve({ slug: "un-article" }) }),
    ).rejects.toThrow(/ECONNREFUSED/);
    expect(notFound).not.toHaveBeenCalled();
  });

  it("le 404 reste réservé à ce qu'il affirme : la base a répondu, la fiche est absente", async () => {
    vi.mocked(getProfileByHandle).mockResolvedValue(null);
    await expect(
      FicheSpeakeuse({ params: Promise.resolve({ id: "999" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });
});

describe("annuaire — la panne se voit, et elle ne se grave pas dans l'index", () => {
  it("base muette : noindex", async () => {
    vi.mocked(getPublishedAnnuaire).mockRejectedValue(PANNE);
    const meta = await annuaireMetadata();
    expect(meta.robots).toMatchObject({ index: false });
  });

  it("annuaire légitimement vide : indexable", async () => {
    // Un site neuf n'a rien à cacher aux moteurs : c'est un annuaire à venir,
    // pas une panne. Sans cette moitié-là, on désindexerait un lancement.
    vi.mocked(getPublishedAnnuaire).mockResolvedValue([]);
    const meta = await annuaireMetadata();
    expect(meta.robots).toBeUndefined();
  });

  it("annuaire peuplé : indexable", async () => {
    vi.mocked(getPublishedAnnuaire).mockResolvedValue([]);
    const meta = await annuaireMetadata();
    expect(meta.robots).toBeUndefined();
    expect(meta.alternates?.canonical).toBe("/speakeuses");
  });
});

describe("annuaire — deux vides, deux phrases", () => {
  it("en panne : l'annuaire REVIENT (il existe déjà)", () => {
    render(<SpeakeusesFilter profiles={[]} indisponible />);
    expect(screen.getByText(/revient dans un instant/i)).toBeInTheDocument();
  });

  it("réellement vide : l'annuaire ARRIVE (rien n'est encore publié)", () => {
    render(<SpeakeusesFilter profiles={[]} />);
    expect(screen.getByText(/arrive bientôt/i)).toBeInTheDocument();
  });

  /**
   * La distinction ne vaut que si les deux phrases restent DIFFÉRENTES : les
   * rapprocher au fil des retouches ramènerait le défaut d'origine, où une
   * panne se donnait l'air d'un site en construction.
   */
  it("les deux phrases restent distinctes", () => {
    render(<SpeakeusesFilter profiles={[]} indisponible />);
    expect(screen.queryByText(/arrive bientôt/i)).toBeNull();
  });
});
