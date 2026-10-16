import { describe, it, expect } from "vitest";
import Fuse from "fuse.js";
import {
  FUSE_OPTIONS,
  buildSearchList,
  rankResults,
  makeSnippet,
} from "@/lib/site-search";
import { searchIndex, type SearchItem } from "@/data/search-index";

const speaker = (over: Partial<SearchItem>): SearchItem => ({
  title: "Ada Lovelace",
  description: "",
  url: "/speakeuses/1",
  category: "Speakeuse",
  ...over,
});

/** Fabrique un résultat Fuse simulé (item + matches). */
const fuseResult = (item: SearchItem, matches: { key: string; value?: string; indices?: [number, number][] }[]) =>
  ({ item, matches }) as unknown as Parameters<typeof rankResults>[0][number];

describe("buildSearchList", () => {
  it("fusionne index éditorial + speakeuses et déduplique", () => {
    const list = buildSearchList([speaker({ url: "/speakeuses/1" })]);
    expect(list.length).toBe(searchIndex.length + 1);
    const keys = list.map((i) => `${i.url} ${i.title.toLowerCase()}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("makeSnippet", () => {
  it("surligne le terme trouvé", () => {
    const segs = makeSnippet("Passionnée de Kubernetes", [[14, 23]]);
    expect(segs.filter((s) => s.hit).map((s) => s.text)).toEqual(["Kubernetes"]);
    expect(segs.map((s) => s.text).join("")).toBe("Passionnée de Kubernetes");
  });

  it("garde un texte court entier, sans points de suspension", () => {
    const segs = makeSnippet("CTO chez Lab", [[0, 2]]);
    expect(segs.map((s) => s.text).join("")).toBe("CTO chez Lab");
    expect(segs.some((s) => s.text === "…")).toBe(false);
  });

  it("tronque un texte long autour du match avec des points de suspension", () => {
    const long = "a".repeat(200) + " Kubernetes " + "b".repeat(200);
    const start = long.indexOf("Kubernetes");
    const segs = makeSnippet(long, [[start, start + 9]]);
    const text = segs.map((s) => s.text).join("");
    expect(text.length).toBeLessThan(long.length);
    expect(text.startsWith("…")).toBe(true);
    expect(text.endsWith("…")).toBe(true);
    expect(segs.some((s) => s.hit && s.text === "Kubernetes")).toBe(true);
  });

  it("renvoie [] pour une valeur vide", () => {
    expect(makeSnippet("", [[0, 2]])).toEqual([]);
  });

  it("ne commence pas au milieu d'un mot (calage sur l'espace)", () => {
    const value = "word ".repeat(30) + "TARGET " + "tail ".repeat(30); // > 100 car.
    const start = value.indexOf("TARGET");
    const text = makeSnippet(value, [[start, start + 5]]).map((s) => s.text).join("");
    // Après le « … » de tête, on reprend sur un mot entier, pas un fragment.
    expect(text.startsWith("…word")).toBe(true);
    expect(text).toContain("TARGET");
  });
});

describe("rankResults — classement", () => {
  it("place les matchs sur un champ visible avant les matchs plein-texte caché", () => {
    const results = [
      fuseResult(speaker({ title: "Zoé", url: "/speakeuses/9" }), [{ key: "keywords", value: "kubernetes", indices: [[0, 9]] }]),
      fuseResult(speaker({ title: "Kube", url: "/speakeuses/8" }), [{ key: "title", value: "Kube", indices: [[0, 3]] }]),
    ];
    expect(rankResults(results, "kube").map((r) => r.item.title)).toEqual(["Kube", "Zoé"]);
  });

  it("préserve l'ordre de pertinence de Fuse dans un même groupe", () => {
    const results = [
      fuseResult(speaker({ title: "A", url: "/a" }), [{ key: "title", value: "Axyz", indices: [[0, 3]] }]),
      fuseResult(speaker({ title: "B", url: "/b" }), [{ key: "description", value: "Bxyz", indices: [[0, 3]] }]),
    ];
    expect(rankResults(results, "xyz").map((r) => r.item.title)).toEqual(["A", "B"]);
  });

  it("écarte les résultats sans fragment contigu significatif (lettres éparses)", () => {
    // « brain » aligné sur des lettres dispersées (b..r..a..i..n) → écarté ;
    // « Brain » contigu → gardé.
    const list = buildSearchList([
      speaker({ title: "Épars", url: "/speakeuses/10", keywords: "Product Manager, co-organisatrice, front-end" }),
      speaker({ title: "Nadia", url: "/speakeuses/11", keywords: "Talk : AI Brain Fry" }),
    ]);
    const titles = rankResults(new Fuse(list, FUSE_OPTIONS).search("brain", { limit: 20 }), "brain").map(
      (r) => r.item.title,
    );
    expect(titles).toContain("Nadia");
    expect(titles).not.toContain("Épars");
  });
});

describe("rankResults — extrait", () => {
  it("construit un extrait surligné depuis la description", () => {
    const results = [
      fuseResult(speaker({ title: "X", description: "Head of product" }), [
        { key: "description", value: "Head of product", indices: [[8, 14]] },
      ]),
    ];
    const [r] = rankResults(results, "product");
    expect(r.snippet?.some((s) => s.hit && s.text === "product")).toBe(true);
  });

  it("rend visible un match du plein-texte caché (keywords)", () => {
    const results = [
      fuseResult(speaker({ title: "Grace", description: "CTO", keywords: "experte Kubernetes et Istio" }), [
        { key: "keywords", value: "experte Kubernetes et Istio", indices: [[8, 17]] },
      ]),
    ];
    const [r] = rankResults(results, "Kubernetes");
    expect(r.snippet?.some((s) => s.hit && s.text === "Kubernetes")).toBe(true);
  });

  it("ne surligne QUE la requête, pas des fragments voisins (pas de confettis)", () => {
    // Le surlignage vient de la sous-chaîne réellement tapée, pas des index flous
    // de Fuse : « product » ne surligne que « Product », rien d'autre.
    const results = [
      fuseResult(speaker({ title: "X", description: "Product Docker Advocate" }), [
        { key: "description", value: "Product Docker Advocate", indices: [[0, 6], [9, 10]] },
      ]),
    ];
    const hits = rankResults(results, "product")[0].snippet?.filter((s) => s.hit) ?? [];
    expect(hits).toHaveLength(1);
    expect(hits[0].text).toBe("Product");
  });

  it("surligne le bon mot malgré un fragment flou voisin (repli accents/casse)", () => {
    // Fuse pourrait aligner « rachel » sur « V-ache » ; on surligne le vrai
    // « Rachel » présent dans le texte.
    const results = [
      fuseResult(
        speaker({ title: "FAQ jury", description: "Jury : Aurélie Vache, Rachel Dubois, Sophie" }),
        [{ key: "description", value: "Jury : Aurélie Vache, Rachel Dubois, Sophie", indices: [[15, 18]] }],
      ),
    ];
    const [r] = rankResults(results, "rachel");
    expect(r.snippet?.filter((s) => s.hit).map((s) => s.text)).toEqual(["Rachel"]);
  });

  it("pas d'extrait quand seul le titre matche (déjà affiché) → null", () => {
    const results = [
      fuseResult(speaker({ title: "Kubernetes" }), [{ key: "title", value: "Kubernetes", indices: [[0, 9]] }]),
    ];
    expect(rankResults(results, "Kubernetes")[0].snippet).toBeNull();
  });
});

describe("pertinence de bout en bout (Fuse + reclassement)", () => {
  function run(list: SearchItem[], q: string) {
    return rankResults(new Fuse(list, FUSE_OPTIONS).search(q, { limit: 20 }), q);
  }

  it("une speakeuse dont SEULE la bio matche ne passe pas devant la page qui affiche le terme", () => {
    const list = buildSearchList([
      speaker({ title: "Ada Lovelace", url: "/speakeuses/1", keywords: "conférencière au DevFest Toulouse" }),
    ]);
    const results = run(list, "DevFest");
    const adaRank = results.findIndex((r) => r.item.title === "Ada Lovelace");
    const pageRank = results.findIndex((r) => r.item.url === "/tremplin" && r.item.category === "Page");
    expect(pageRank).toBeGreaterThanOrEqual(0);
    expect(adaRank).toBeGreaterThan(pageRank);
  });

  it("retrouve une speakeuse par un terme de sa bio et l'affiche dans l'extrait", () => {
    const list = buildSearchList([
      speaker({ title: "Grace Hopper", url: "/speakeuses/2", keywords: "Kubernetes Istio observabilité" }),
    ]);
    const grace = run(list, "Kubernetes").find((r) => r.item.title === "Grace Hopper");
    expect(grace).toBeTruthy();
    expect(grace?.snippet?.some((s) => s.hit)).toBe(true);
  });

  it("« Cate » remonte la speakeuse Cateline en tête", () => {
    const list = buildSearchList([
      speaker({ title: "Cateline Puccetti", url: "/speakeuses/3", description: "Head of product" }),
    ]);
    expect(run(list, "Cate")[0]?.item.title).toBe("Cateline Puccetti");
  });
});
