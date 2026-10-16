import { describe, it, expect, vi, beforeEach } from "vitest";

// On garde le vrai toPublicSpeaker (frontière de données) ; on ne simule que la
// lecture base. db est simulé pour ne pas créer de pool réel.
vi.mock("@/lib/db", () => ({ pool: { query: vi.fn() } }));
vi.mock("@/lib/profiles", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/profiles")>();
  return { ...actual, getPublishedAnnuaire: vi.fn() };
});
vi.mock("@/lib/talks", () => ({ getPublicTalkTextByProfile: vi.fn() }));

import { getPublishedAnnuaire } from "@/lib/profiles";
import { getPublicTalkTextByProfile } from "@/lib/talks";
import { getSpeakerSearchItems } from "@/lib/search";
import { makeProfile } from "./test-helpers";

beforeEach(() => {
  vi.clearAllMocks();
  // Défaut : aucun texte de talk (les tests qui en ont besoin surchargent).
  vi.mocked(getPublicTalkTextByProfile).mockResolvedValue(new Map());
});

describe("getSpeakerSearchItems", () => {
  it("projette les speakeuses publiées en items (lien vers la fiche)", async () => {
    vi.mocked(getPublishedAnnuaire).mockResolvedValue([
      makeProfile({
        id: 12,
        poste: "CTO",
        entreprise: "Lab",
        regions: ["Occitanie"],
        langues: ["Anglais"],
      }),
      makeProfile({ id: 7, name: "Ada Lovelace" }),
    ] as never);

    const items = await getSpeakerSearchItems();
    expect(items).toMatchObject([
      {
        title: "Marie Curie",
        // zones et langues indexées : « Occitanie » remonte dans la recherche
        description: "CTO · Lab · Occitanie · Anglais",
        url: "/speakeuses/12",
        category: "Speakeuse",
      },
      {
        title: "Ada Lovelace",
        description: "",
        url: "/speakeuses/7",
        category: "Speakeuse",
      },
    ]);
  });

  it("une fiche au nom blanc a pour titre le repli calculé au bord, jamais du vide", async () => {
    vi.mocked(getPublishedAnnuaire).mockResolvedValue([
      makeProfile({ id: 4, name: "   ", titreProfil: "Spécialiste IA" }),
    ] as never);
    const [item] = await getSpeakerSearchItems();
    expect(item.title).toBe("Spécialiste IA");
  });

  it("indexe bio, secteurs/sujets et le texte des talks dans keywords (non affiché)", async () => {
    vi.mocked(getPublishedAnnuaire).mockResolvedValue([
      makeProfile({ id: 3, bio: "Passionnée de Kubernetes", secteurs: ["MedTech / Santé"] }),
    ] as never);
    vi.mocked(getPublicTalkTextByProfile).mockResolvedValue(
      new Map([[3, "Scaling avec Istio"]]),
    );
    const [item] = await getSpeakerSearchItems();
    expect(item.keywords).toContain("Kubernetes");
    expect(item.keywords).toContain("MedTech / Santé");
    expect(item.keywords).toContain("Istio");
    // …mais rien de tout ça dans l'aperçu affiché.
    expect(item.description).not.toContain("Kubernetes");
  });

  it("ne fuit aucun champ INTERNE (title/description/url/category/keywords seulement)", async () => {
    vi.mocked(getPublishedAnnuaire).mockResolvedValue([
      makeProfile({ id: 1, name: "X" }),
    ] as never);
    const [item] = await getSpeakerSearchItems();
    expect(Object.keys(item).sort()).toEqual([
      "category",
      "description",
      "keywords",
      "title",
      "url",
    ]);
    // Aucune métadonnée interne (e-mail, statut, userId…).
    const leaked = item as unknown as Record<string, unknown>;
    expect(leaked.userId).toBeUndefined();
    expect(leaked.contactEmailOk).toBeUndefined();
  });

  it("résiste à une panne base (renvoie [])", async () => {
    vi.mocked(getPublishedAnnuaire).mockRejectedValue(new Error("db down"));
    expect(await getSpeakerSearchItems()).toEqual([]);
  });
});
