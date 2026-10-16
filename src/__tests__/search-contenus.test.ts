import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Les contenus publiés comme source de la recherche (⌘K).
 *
 * Trois garde-fous portent le lot : rien de non publié (assuré par le SQL,
 * couvert en intégration), une destination INTERNE ou rien (une option de
 * combobox ne peut pas annoncer une sortie du site, RGAA 13.2), et la même
 * règle de destination que la carte d'actualité — jamais une deuxième copie.
 */
vi.mock("@/lib/contenus", () => ({ listContenusPourRecherche: vi.fn() }));

import { listContenusPourRecherche, type ContenuRecherche } from "@/lib/contenus";
import { getContenuSearchItems, APERCU_MAX } from "@/lib/search-contenus";

beforeEach(() => vi.clearAllMocks());

function contenu(over: Partial<ContenuRecherche> = {}): ContenuRecherche {
  return {
    type: "publication",
    slug: "une-actu",
    titre: "Une actu",
    chapo: "Une accroche.",
    categorie: "Communauté",
    extraitCorps: "",
    aCorps: false,
    publieLe: "2026-06-04",
    lien: null,
    lienExterne: null,
    lienLabel: null,
    ...over,
  };
}

const items = (liste: ContenuRecherche[]) => {
  vi.mocked(listContenusPourRecherche).mockResolvedValue(liste);
  return getContenuSearchItems();
};

describe("getContenuSearchItems — destination", () => {
  it("un corps mène à la page d'article", async () => {
    const [item] = await items([contenu({ slug: "interview", aCorps: true })]);
    expect(item.url).toBe("/articles/interview");
  });

  it("une page mène à sa route publique", async () => {
    const [item] = await items([contenu({ type: "page", slug: "plan-du-site", aCorps: true })]);
    expect(item.url).toBe("/plan-du-site");
  });

  it("sans corps, un lien interne fait la destination", async () => {
    const [item] = await items([contenu({ lien: "/tremplin" })]);
    expect(item.url).toBe("/tremplin");
  });

  it("le corps l'emporte sur le lien externe", async () => {
    // Même règle que la carte : l'interview se lit chez nous, LinkedIn reste
    // proposé en bas de l'article.
    const [item] = await items([
      contenu({ slug: "interview", aCorps: true, lienExterne: "https://linkedin.test/x" }),
    ]);
    expect(item.url).toBe("/articles/interview");
  });

  it("écarte un contenu dont la seule destination sort du site", async () => {
    // La palette est une liste d'options, pas de liens : elle ne peut pas
    // prévenir qu'on quitte le site (RGAA 13.2). L'annonce reste cliquable
    // là où elle est un vrai lien, sur /actualites et sur l'accueil.
    expect(await items([contenu({ lienExterne: "https://exemple.test/ailleurs" })])).toEqual([]);
  });

  it("écarte une page dont l'adresse est masquée par une route du code", async () => {
    // Le formulaire refuse ce slug depuis la garde des slugs réservés, mais une
    // page enregistrée avant elle mènerait à la page codée, pas à son contenu.
    expect(
      await items([contenu({ type: "page", slug: "a-propos", aCorps: true })]),
    ).toEqual([]);
  });

  it("écarte un contenu sans aucune destination", async () => {
    expect(await items([contenu()])).toEqual([]);
  });
});

describe("getContenuSearchItems — ce qu'on affiche", () => {
  it("prend la catégorie du contenu comme pastille", async () => {
    const [item] = await items([
      contenu({ aCorps: true, categorie: "Behind the Scenes" }),
    ]);
    expect(item.category).toBe("Behind the Scenes");
  });

  it("replie sur « Actualité » ou « Page » quand la catégorie manque", async () => {
    const [actu] = await items([contenu({ aCorps: true, categorie: null })]);
    expect(actu.category).toBe("Actualité");
    const [page] = await items([contenu({ type: "page", aCorps: true, categorie: null })]);
    expect(page.category).toBe("Page");
  });

  it("porte la date À PART, jamais fondue dans l'aperçu", async () => {
    // La date est une DONNÉE, pas de la prose : concaténée dans l'aperçu, elle
    // devient cherchable (taper « juin » remonterait tout ce qui paraît en
    // juin) et l'extrait surligné peut la faire disparaître selon la requête.
    const [item] = await items([
      contenu({ aCorps: true, chapo: "Le chapô.", publieLe: "2026-06-04" }),
    ]);
    expect(item.description).toBe("Le chapô.");
    expect(item.date).toBe("4 juin 2026");
    expect(item.dateISO).toBe("2026-06-04");
  });

  it("laisse la date absente quand le contenu n'en a pas", async () => {
    const [item] = await items([
      contenu({ aCorps: true, chapo: "Le chapô.", publieLe: null }),
    ]);
    expect(item.date).toBeUndefined();
    expect(item.dateISO).toBeUndefined();
  });

  it("sans chapô, prend le début du corps en texte brut, coupé sur un mot", async () => {
    // La fixture est choisie pour que le 160ᵉ caractère tombe EN PLEIN MOT :
    // avec une espace pile à la limite, la recherche de frontière ne fait rien
    // et une implémentation qui coupe à l'aveugle passerait le test.
    const corps = `## Titre\n\nRachel Dubois pratique le produit depuis plus de vingt-cinq annees et revient sans filtre sur son rapport a la scene, sur le choix des conferences internationales.`;
    const attendu = corps.replace("## Titre\n\n", "Titre ");
    expect(attendu[APERCU_MAX]).not.toBe(" "); // sinon le cas ne prouve rien
    const [item] = await items([
      contenu({ aCorps: true, chapo: null, extraitCorps: corps }),
    ]);
    expect(item.description.endsWith("…")).toBe(true);
    expect(item.description).not.toContain("##");
    // Le budget est tenu : sans ça, changer APERCU_MAX ne casserait rien.
    expect(item.description.length).toBeLessThanOrEqual(APERCU_MAX);
    // La coupe tombe sur une frontière de mot, et AUSSI LOIN QUE POSSIBLE :
    // un aperçu bien plus court satisferait le seul test de préfixe.
    const garde = item.description.slice(0, -1);
    expect(attendu.startsWith(garde)).toBe(true);
    expect(attendu[garde.length]).toBe(" ");
    expect(garde.length).toBeGreaterThan(APERCU_MAX - 20);
  });

  it("omet le plein-texte caché quand l'aperçu montre déjà tout le corps", async () => {
    // La raison d'être de la branche : sans elle, le même texte part deux fois
    // sur le réseau et Fuse le scanne deux fois à chaque frappe.
    const [item] = await items([
      contenu({ aCorps: true, chapo: null, extraitCorps: "Un corps court." }),
    ]);
    expect(item.description).toBe("Un corps court.");
    expect(item.keywords).toBeUndefined();
  });

  it("replie sur l'adresse quand il n'y a ni chapô ni corps", async () => {
    // Une option amputée de sa deuxième ligne perd son repère visuel et ne dit
    // pas ce qu'on va ouvrir. L'adresse tient sur une ligne et le dit.
    const [item] = await items([
      contenu({ type: "page", slug: "plan-du-site", aCorps: false, chapo: null }),
    ]);
    expect(item.description).toBe("/plan-du-site");
  });

  it("indexe le corps en plein-texte caché, sans syntaxe Markdown", async () => {
    const [item] = await items([
      contenu({ aCorps: true, extraitCorps: "Un **mot** dans [le corps](https://x.test)." }),
    ]);
    expect(item.keywords).toBe("Un mot dans le corps.");
  });

  it("garde le titre du contenu", async () => {
    const [item] = await items([contenu({ aCorps: true, titre: "Interview de Rachel Dubois" })]);
    expect(item.title).toBe("Interview de Rachel Dubois");
  });
});

describe("getContenuSearchItems — dégradation", () => {
  it("une base indisponible rend une liste vide, jamais une erreur", async () => {
    vi.mocked(listContenusPourRecherche).mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(getContenuSearchItems()).resolves.toEqual([]);
  });
});
