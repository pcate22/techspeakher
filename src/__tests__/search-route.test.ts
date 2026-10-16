import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/search", () => ({ getSpeakerSearchItems: vi.fn() }));
vi.mock("@/lib/search-contenus", () => ({ getContenuSearchItems: vi.fn() }));

import { getSpeakerSearchItems } from "@/lib/search";
import { getContenuSearchItems } from "@/lib/search-contenus";
import { GET } from "@/app/api/search/speakeuses/route";
import { GET as GETContenus } from "@/app/api/search/contenus/route";
import { ENTETES_CACHE_RECHERCHE } from "@/lib/search-cache";

beforeEach(() => vi.clearAllMocks());

describe("GET /api/search/speakeuses", () => {
  it("renvoie les items de recherche en JSON", async () => {
    vi.mocked(getSpeakerSearchItems).mockResolvedValue([
      { title: "Marie", description: "CTO", url: "/speakeuses/1", category: "Speakeuse" },
    ]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      { title: "Marie", description: "CTO", url: "/speakeuses/1", category: "Speakeuse" },
    ]);
  });

  it("expose l'en-tête de cache partagé, à l'identique", async () => {
    // L'en-tête EXACT, pas un fragment : un « private » à la place de
    // « public » tuerait le cache CDN des deux sources sans rien casser ici.
    vi.mocked(getSpeakerSearchItems).mockResolvedValue([]);
    const res = await GET();
    expect(res.headers.get("cache-control")).toBe(ENTETES_CACHE_RECHERCHE["Cache-Control"]);
    expect(res.headers.get("cache-control")).toBe(
      "public, s-maxage=300, stale-while-revalidate=600",
    );
  });

  it("frontière de données : la route ne renvoie QUE ce que la lib fournit (pas d'enrichissement)", async () => {
    // Garde-fou anti-fuite : si un jour on « ajoute un champ pour le front »
    // côté handler, ce test le détecte. La route est un simple passe-plat.
    const item = { title: "X", description: "", url: "/speakeuses/9", category: "Speakeuse" };
    vi.mocked(getSpeakerSearchItems).mockResolvedValue([item]);
    const [got] = await (await GET()).json();
    expect(Object.keys(got).sort()).toEqual(["category", "description", "title", "url"]);
  });
});

describe("GET /api/search/contenus", () => {
  it("renvoie les contenus publiés en JSON", async () => {
    const item = {
      title: "Interview de Rachel Dubois",
      description: "Une accroche.",
      url: "/articles/interview-de-rachel-dubois",
      category: "Behind the Scenes",
      keywords: "Le début du corps.",
    };
    vi.mocked(getContenuSearchItems).mockResolvedValue([item]);
    const res = await GETContenus();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([item]);
  });

  it("expose le MÊME en-tête de cache que l'autre source", async () => {
    vi.mocked(getContenuSearchItems).mockResolvedValue([]);
    vi.mocked(getSpeakerSearchItems).mockResolvedValue([]);
    const [contenus, speakeuses] = [await GETContenus(), await GET()];
    expect(contenus.headers.get("cache-control")).toBe(
      speakeuses.headers.get("cache-control"),
    );
    expect(contenus.headers.get("cache-control")).toBe(
      ENTETES_CACHE_RECHERCHE["Cache-Control"],
    );
  });

  it("passe-plat : la route n'ajoute aucun champ", async () => {
    const item = { title: "X", description: "", url: "/articles/x", category: "Actualité" };
    vi.mocked(getContenuSearchItems).mockResolvedValue([item]);
    const [got] = await (await GETContenus()).json();
    expect(Object.keys(got).sort()).toEqual(["category", "description", "title", "url"]);
  });
});
