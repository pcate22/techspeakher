import { describe, it, expect, vi, beforeEach } from "vitest";

// importOriginal : on garde les helpers PURS réels (speakeuseHref, toPublicSpeaker)
// et on ne mocke que les lectures base (annuaire, résolution de fiche).
// Passthrough sans mémoïsation : le vrai unstable_cache servirait le résultat
// d'un test au suivant (les mocks changent de valeur par test).
vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...a: unknown[]) => unknown) => fn,
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}));
vi.mock("@/lib/profiles", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/profiles")>();
  return {
    ...actual,
    getPublishedAnnuaire: vi.fn(),
    getProfileByHandle: vi.fn(),
  };
});
vi.mock("@/lib/talks", () => ({
  getTalksByProfileId: vi.fn(async () => []),
  getPublicTalksByProfileId: vi.fn(async () => []),
  getPublicTalkTextByProfile: vi.fn(async () => new Map()),
  getPublicTalkTitlesByProfile: vi.fn(async () => new Map()),
}));
vi.mock("@/lib/contenus", () => ({
  listArticlesPublies: vi.fn(async () => []),
  listPagesPubliees: vi.fn(async () => []),
}));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/app/admin/actions", () => ({ moderateProfileAction: vi.fn() }));

import { getPublishedAnnuaire, getProfileByHandle } from "@/lib/profiles";
import sitemap from "@/app/sitemap";
import { generateMetadata } from "@/app/speakeuses/[id]/page";
import { generateMetadata as annuaireGenerateMetadata } from "@/app/speakeuses/page";
import { buildSpeakerPersonLd } from "@/lib/speaker-jsonld";
import { makeProfile } from "./test-helpers";

beforeEach(() => vi.clearAllMocks());

const baseProfile = makeProfile({
  id: 5,
  titreProfil: "Spécialiste IA",
  isWoman: true,
  updatedAt: "2026-06-01T00:00:00Z",
});

describe("sitemap", () => {
  it("inclut une entrée par fiche publiée", async () => {
    vi.mocked(getPublishedAnnuaire).mockResolvedValue([
      { ...baseProfile, id: 5, status: "publie" },
      { ...baseProfile, id: 9, status: "publie" },
    ]);
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls).toContain("https://techspeakher.fr/speakeuses/5");
    expect(urls).toContain("https://techspeakher.fr/speakeuses/9");
    // garde aussi les routes statiques
    expect(urls).toContain("https://techspeakher.fr/speakeuses");
  });

  it("reste résilient si la base est indisponible", async () => {
    vi.mocked(getPublishedAnnuaire).mockRejectedValue(new Error("db down"));
    const entries = await sitemap();
    expect(entries.length).toBeGreaterThan(0); // routes statiques au moins
  });
});

describe("annuaire /speakeuses — visibilité locale (speaker/conférencière Toulouse)", () => {
  /**
   * Les métadonnées de l'annuaire sont désormais CALCULÉES : la page pose
   * `noindex` quand la base se tait, pour qu'un incident passager cesse de
   * pouvoir faire enregistrer un annuaire vide. Les assertions de référencement
   * ci-dessous portent sur le cas nominal — base joignable.
   */
  let annuaireMetadata: Awaited<ReturnType<typeof annuaireGenerateMetadata>>;
  beforeEach(async () => {
    vi.mocked(getPublishedAnnuaire).mockResolvedValue([]);
    annuaireMetadata = await annuaireGenerateMetadata();
  });

  it("title cible le duo speakeuses + conférencières et l'ancrage Toulouse", () => {
    const title = String(annuaireMetadata.title);
    expect(title).toMatch(/speakeuses/i);
    expect(title).toMatch(/conférencières/i);
    expect(title).toMatch(/Toulouse/i);
    // Garde le terme « Annuaire » : le smoke test E2E de navigation vérifie que
    // le <title> de /speakeuses matche /Annuaire/i (e2e/navigation.spec.ts).
    expect(title).toMatch(/Annuaire/i);
  });

  it("description couvre conférencières, speakers femmes, et la portée nationale (Toulouse = origine, France = couverture)", () => {
    const desc = String(annuaireMetadata.description);
    expect(desc).toMatch(/conférencières/i);
    expect(desc).toMatch(/speakers femmes/i);
    // Toulouse reste (origine de la communauté) MAIS la couverture est nationale :
    // l'annuaire a des speakeuses partout en France, pas seulement à Toulouse.
    expect(desc).toMatch(/Toulouse/i);
    expect(desc).toMatch(/France/i);
  });

  it("keywords couvrent la longue traîne locale ET nationale", () => {
    const kw = (annuaireMetadata.keywords as string[]).join(" | ").toLowerCase();
    // local (communauté née à Toulouse)
    expect(kw).toContain("conférencières tech toulouse");
    expect(kw).toContain("speakeuses toulouse");
    expect(kw).toContain("femmes speakers toulouse");
    // national (speakeuses partout en France)
    expect(kw).toContain("speakeuses tech france");
    expect(kw).toContain("conférencières tech france");
  });

  it("canonical stable sur /speakeuses", () => {
    expect(annuaireMetadata.alternates?.canonical).toBe("/speakeuses");
  });
});

describe("fiche generateMetadata — indexation", () => {
  it("fiche publiée : indexable, titre + canonical dédiés", async () => {
    vi.mocked(getProfileByHandle).mockResolvedValue({
      ...baseProfile,
      status: "publie",
    });
    const meta = await generateMetadata({ params: Promise.resolve({ id: "5" }) });
    expect(meta.robots).toMatchObject({ index: true });
    expect(String(meta.title)).toMatch(/Marie Curie/);
    expect(meta.alternates?.canonical).toBe("/speakeuses/5");
  });

  it("fiche non publiée : noindex", async () => {
    vi.mocked(getProfileByHandle).mockResolvedValue({
      ...baseProfile,
      status: "en_attente",
    });
    const meta = await generateMetadata({ params: Promise.resolve({ id: "5" }) });
    expect(meta.robots).toMatchObject({ index: false });
  });

  it("fiche au nom blanc : title et description disent le repli UNE fois, sans le répéter", async () => {
    // nomAffiche retombe sur le titre du profil : le suffixe « · titre » et
    // l'accroche le répéteraient mot pour mot dans l'onglet et sur Google.
    vi.mocked(getProfileByHandle).mockResolvedValue(
      makeProfile({ id: 5, status: "publie", name: "   ", titreProfil: "Spécialiste IA", isWoman: true }),
    );
    const meta = await generateMetadata({ params: Promise.resolve({ id: "5" }) });
    expect(meta.title).toBe("Spécialiste IA | Tech Speak'Her");
    expect(String(meta.description)).not.toMatch(/Spécialiste IA[\s\S]*Spécialiste IA/);
  });

  it("profil introuvable : noindex (fallback)", async () => {
    vi.mocked(getProfileByHandle).mockResolvedValue(null);
    const meta = await generateMetadata({ params: Promise.resolve({ id: "999" }) });
    expect(meta.robots).toMatchObject({ index: false });
  });
});

describe("fiche — JSON-LD Person homeLocation (recherche par ville)", () => {
  it("fiche publiée avec ville : homeLocation porte la ville (addressLocality)", () => {
    const ld = buildSpeakerPersonLd(
      makeProfile({ id: 7, status: "publie", ville: "Nantes", isWoman: true }),
    );
    expect(ld).not.toBeNull();
    expect(ld?.homeLocation).toMatchObject({
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Nantes",
        addressCountry: "FR",
      },
    });
  });

  it("fiche publiée sans ville : pas de homeLocation (champ optionnel)", () => {
    const ld = buildSpeakerPersonLd(
      makeProfile({ id: 7, status: "publie", ville: null, isWoman: true }),
    );
    expect(ld).not.toBeNull();
    expect(ld?.homeLocation).toBeUndefined();
  });

  it("nom blanc : le Person porte le repli calculé au bord, jamais une chaîne vide", () => {
    // Cohérence des données structurées : l'ItemList de /speakeuses lit déjà
    // `nomAffiche` — le Person de la fiche doit épeler le MÊME nom.
    const ld = buildSpeakerPersonLd(
      makeProfile({ id: 7, status: "publie", name: "   ", titreProfil: "Spécialiste IA", isWoman: true }),
    );
    expect(ld?.name).toBe("Spécialiste IA");
  });

  it("fiche non publiée : aucun JSON-LD Person (noindex des brouillons/attente)", () => {
    const ld = buildSpeakerPersonLd(
      makeProfile({ id: 7, status: "en_attente", ville: "Paris", isWoman: true }),
    );
    expect(ld).toBeNull();
  });
});
