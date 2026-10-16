import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CATEGORIES } from "@/data/categories-contenus";
import { categoryColors } from "@/components/SearchBar";

/**
 * La palette (⌘K) et ses DEUX sources en base : l'annuaire des speakeuses et
 * les contenus éditoriaux publiés. Ce qui se joue ici : les deux partent, et
 * l'une en panne laisse l'autre servir — la recherche est un confort, elle
 * dégrade au lieu de tomber.
 */
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const item = (over: Record<string, string>) => ({
  title: "",
  description: "",
  url: "/",
  category: "Page",
  ...over,
});

/** Réponses par URL ; une URL absente de la table part en échec réseau. */
function servir(par: Record<string, unknown[]>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const data = par[url];
      if (!data) throw new Error("réseau indisponible");
      return { ok: true, json: async () => data } as Response;
    }),
  );
}

/**
 * Le Fuse est mémoïsé au niveau du MODULE (construit une fois, à la 1re
 * recherche). Un import statique le partagerait entre tous les cas : le premier
 * figerait l'index et les stubs suivants ne serviraient à rien. On réimporte
 * donc le module à chaque cas, après `resetModules`.
 */
async function chercher(terme: string) {
  vi.resetModules();
  const { default: SearchBar } = await import("@/components/SearchBar");
  const u = userEvent.setup();
  render(<SearchBar />);
  await u.click(screen.getByRole("button", { name: /Rechercher/ }));
  await u.type(screen.getByRole("combobox"), terme);
  return u;
}

const optionsAffichees = () =>
  screen.queryAllByRole("option").map((o) => o.textContent ?? "");

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
beforeEach(() => vi.clearAllMocks());

describe("SearchBar — les deux sources en base", () => {
  it("interroge l'annuaire ET les contenus", async () => {
    servir({ "/api/search/speakeuses": [], "/api/search/contenus": [] });
    await chercher("rachel");
    await waitFor(() => {
      const appels = vi.mocked(fetch).mock.calls.map((c) => c[0]);
      expect(appels).toContain("/api/search/speakeuses");
      expect(appels).toContain("/api/search/contenus");
    });
  });

  it("trouve un article publié, avec sa catégorie en pastille", async () => {
    servir({
      "/api/search/speakeuses": [],
      "/api/search/contenus": [
        item({
          title: "Interview de Rachel Dubois",
          description: "Elle revient sans filtre sur son rapport à la scène.",
          url: "/articles/interview-de-rachel-dubois",
          category: "Behind the Scenes",
        }),
      ],
    });
    await chercher("rachel");
    await waitFor(() => {
      expect(optionsAffichees().join(" ")).toContain("Interview de Rachel Dubois");
    });
    expect(optionsAffichees().join(" ")).toContain("Behind the Scenes");
  });

  it("les contenus en panne laissent les speakeuses cherchables", async () => {
    // `/api/search/contenus` absent de la table → échec réseau.
    servir({
      "/api/search/speakeuses": [
        item({ title: "Margaux Ferrand", url: "/speakeuses/margaux", category: "Speakeuse" }),
      ],
    });
    await chercher("margaux");
    await waitFor(() => {
      expect(optionsAffichees().join(" ")).toContain("Margaux Ferrand");
    });
  });

  it("les deux sources en panne laissent les pages statiques cherchables", async () => {
    servir({});
    await chercher("conduite");
    await waitFor(() => {
      expect(optionsAffichees().join(" ")).toContain("Code de conduite");
    });
  });
});

describe("SearchBar — lisibilité d'une option", () => {
  it("nomme la catégorie au lecteur d'écran", async () => {
    // Sans ce complément, le nom accessible de l'option enchaîne la catégorie
    // et le titre : « Behind the Scenes Interview de Rachel Dubois ».
    servir({
      "/api/search/speakeuses": [],
      "/api/search/contenus": [
        item({
          title: "Interview de Rachel Dubois",
          url: "/articles/interview-de-rachel-dubois",
          category: "Behind the Scenes",
        }),
      ],
    });
    await chercher("rachel");
    await waitFor(() => expect(screen.queryAllByRole("option").length).toBeGreaterThan(0));
    // Le nom accessible d'une option est la concaténation de son contenu : le
    // complément y entre, et « Catégorie : » sépare l'étiquette du titre.
    const option = screen
      .getAllByRole("option")
      .find((o) => o.textContent?.includes("Interview de Rachel Dubois"));
    expect(option?.textContent).toContain("Catégorie\u00a0: Behind the Scenes");
  });

  it("offre une sortie vers les actualités, même sans résultat", async () => {
    // Les annonces dont le lien sort du site sont écartées de la palette
    // (RGAA 13.2) : sans ce lien, on croit qu'elles n'existent pas.
    servir({ "/api/search/speakeuses": [], "/api/search/contenus": [] });
    await chercher("introuvable-xyz");
    const sortie = screen.getByRole("link", { name: "Voir toutes les actualités" });
    expect(sortie).toHaveAttribute("href", "/actualites");
    // HORS de la listbox : elle n'admet que des enfants `role="option"`.
    expect(screen.getByRole("listbox").contains(sortie)).toBe(false);
  });
});

describe("SearchBar — pastilles de catégorie", () => {
  it("chaque catégorie affichable a sa couleur", () => {
    // Sans ça, une catégorie oubliée passe en gris neutre sans que rien
    // n'échoue. La couleur RENFORCE le mot, elle ne le remplace pas : la
    // catégorie est écrite en toutes lettres (RGAA 3.1).
    for (const categorie of ["Speakeuse", "Page", "FAQ", "Actualité", ...CATEGORIES]) {
      expect(categoryColors[categorie]).toBeTruthy();
    }
  });
});
