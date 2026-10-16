import { describe, it, expect } from "vitest";
import { searchIndex, dedupeSearchItems, type SearchItem } from "@/data/search-index";
import { CATEGORIES } from "@/data/categories-contenus";
import { faq, editionEditoriale } from "@/data/tremplin";
import { foldRecherche } from "@/lib/normalise-recherche";

/** Clé d'identité affichée d'un item (ce qui fait qu'on le perçoit en doublon).
 *  Même repli que la dédup (casse + accents). */
const identity = (i: SearchItem) => `${i.url} ${foldRecherche(i.title.trim())}`;

describe("searchIndex", () => {
  it("contient toutes les pages statiques", () => {
    const pages = searchIndex.filter((i) => i.category === "Page");
    const urls = pages.map((p) => p.url);
    expect(urls).toContain("/");
    expect(urls).toContain("/a-propos");
    expect(urls).toContain("/tremplin");
    expect(urls).toContain("/speakeuses");
    expect(urls).toContain("/actualites");
    expect(urls).toContain("/partenaires");
    expect(urls).toContain("/contact");
  });

  it("ne contient PAS de speakeuses statiques (elles viennent de la base)", () => {
    // L'index statique ne couvre que le contenu éditorial ; les speakeuses sont
    // injectées au runtime depuis l'annuaire en base (cf. getSpeakerSearchItems).
    const indexed = searchIndex.filter((i) => i.category === "Speakeuse");
    expect(indexed).toHaveLength(0);
  });

  it("ne contient AUCUNE actualité : elles viennent de la base", () => {
    // Le défaut que ce lot corrige : l'index était bâti sur la graine du dépôt,
    // donc une actualité publiée depuis l'éditeur restait introuvable, et celles
    // qui étaient indexées menaient toutes à la LISTE, pas à leur article.
    // Elles arrivent désormais par /api/search/contenus.
    const editoriales = new Set<string>(["Actualité", ...CATEGORIES]);
    expect(searchIndex.filter((i) => editoriales.has(i.category))).toEqual([]);
  });

  it("ne garde que ce qui vit dans le code : pages et FAQ", () => {
    const categories = new Set(searchIndex.map((i) => i.category));
    expect([...categories].sort()).toEqual(["FAQ", "Page"]);
  });

  it("ne contient AUCUN doublon (même url + même titre)", () => {
    const keys = searchIndex.map(identity);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("contient toutes les FAQ", () => {
    const indexed = searchIndex.filter((i) => i.category === "FAQ");
    expect(indexed).toHaveLength(faq.length);
  });

  it("la FAQ pointe la page de SON édition (l'ancre #faq ne vit que là)", () => {
    // Le lien a déjà été une ancre morte (/tremplin#faq, dette P1) : les
    // réponses sont l'éditorial d'une édition, le lien suit editionEditoriale.
    for (const i of searchIndex.filter((x) => x.category === "FAQ")) {
      expect(i.url).toBe(
        `/tremplin/${editionEditoriale.confSlug}/${editionEditoriale.annee}#faq`,
      );
    }
  });

  it("chaque item a un titre, une description et une URL", () => {
    for (const item of searchIndex) {
      expect(item.title).toBeTruthy();
      expect(item.description).toBeTruthy();
      expect(item.url).toMatch(/^\//);
      expect(item.category).toBeTruthy();
    }
  });

  it("aucune URL n'est vide ou undefined", () => {
    for (const item of searchIndex) {
      expect(item.url.length).toBeGreaterThan(0);
    }
  });
});

describe("dedupeSearchItems", () => {
  const item = (over: Partial<SearchItem>): SearchItem => ({
    title: "T",
    description: "",
    url: "/x",
    category: "Page",
    ...over,
  });

  it("fusionne deux items de même url + titre en gardant la catégorie prioritaire", () => {
    const out = dedupeSearchItems([
      item({ title: "Interview de Rachel Dubois", url: "/actualites", category: "Actualité" }),
      item({ title: "Interview de Rachel Dubois", url: "/actualites", category: "Behind the Scenes" }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].category).toBe("Behind the Scenes");
  });

  it("garde des items distincts quand l'url diffère", () => {
    const out = dedupeSearchItems([
      item({ title: "Actualités", url: "/actualites", category: "Page" }),
      item({ title: "Interview de Rachel Dubois", url: "/actualites", category: "Behind the Scenes" }),
    ]);
    expect(out).toHaveLength(2);
  });

  it("ignore les accents dans le titre (Élodie = Elodie)", () => {
    const out = dedupeSearchItems([
      item({ title: "Interview d'Élodie", url: "/actualites", category: "Actualité" }),
      item({ title: "Interview d'Elodie", url: "/actualites", category: "Behind the Scenes" }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].category).toBe("Behind the Scenes");
  });

  it("ignore la casse et les espaces de bord dans le titre", () => {
    const out = dedupeSearchItems([
      item({ title: "Qui compose le jury ?", url: "/tremplin#faq", category: "FAQ" }),
      item({ title: "  qui compose le jury ?  ", url: "/tremplin#faq", category: "FAQ" }),
    ]);
    expect(out).toHaveLength(1);
  });

  it("préserve l'ordre d'insertion de la première occurrence", () => {
    const out = dedupeSearchItems([
      item({ title: "A", url: "/a" }),
      item({ title: "B", url: "/b", category: "Actualité" }),
      item({ title: "B", url: "/b", category: "Behind the Scenes" }),
      item({ title: "C", url: "/c" }),
    ]);
    expect(out.map((i) => i.title)).toEqual(["A", "B", "C"]);
    expect(out[1].category).toBe("Behind the Scenes");
  });
});
