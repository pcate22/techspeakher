import { describe, it, expect } from "vitest";
import { activeMention, filterMentions, insertMention, type MentionItem } from "@/lib/mention";

describe("activeMention — détection du jeton sous le curseur", () => {
  it("aucune mention dans un texte sans @", () => {
    expect(activeMention("bonjour", 7)).toBeNull();
  });

  it("« @ » seul en début de texte ouvre une mention vide", () => {
    expect(activeMention("@", 1)).toEqual({ query: "", start: 0, end: 1 });
  });

  it("capture la saisie après @ précédé d'une espace", () => {
    expect(activeMention("Merci @mont", 11)).toEqual({ query: "mont", start: 6, end: 11 });
  });

  it("gère le curseur au milieu du jeton", () => {
    // « Merci @mo|nt » : curseur après « mo ».
    expect(activeMention("Merci @mont", 9)).toEqual({ query: "mo", start: 6, end: 9 });
  });

  it("se ferme dès qu'une espace suit (mention terminée)", () => {
    expect(activeMention("Merci @mont ", 12)).toBeNull();
  });

  it("ne déclenche pas sur une adresse e-mail (@ collé à un mot)", () => {
    expect(activeMention("ecris a@b.com", 8)).toBeNull();
  });

  it("déclenche après un caractère ouvrant (parenthèse)", () => {
    expect(activeMention("(@au", 4)).toEqual({ query: "au", start: 1, end: 4 });
  });

  it("prend le @ le plus proche du curseur", () => {
    // deux jetons : « @a … @bc| »
    expect(activeMention("@a @bc", 6)).toEqual({ query: "bc", start: 3, end: 6 });
  });
});

describe("filterMentions — recherche annuaire", () => {
  const items: MentionItem[] = [
    { name: "Montaine Marteau", href: "/speakeuses/montaine-marteau" },
    { name: "Aurélie Vache", href: "/speakeuses/aurelie-vache" },
    { name: "Marie Durand", href: "/speakeuses/marie-durand" },
  ];

  it("insensible aux accents et à la casse", () => {
    expect(filterMentions(items, "aurelie").map((i) => i.name)).toEqual(["Aurélie Vache"]);
  });

  it("fait remonter d'abord les noms qui COMMENCENT par la saisie", () => {
    // « mar » : « Marie » (préfixe) avant « Montaine Marteau » (contient « Mar »).
    expect(filterMentions(items, "mar").map((i) => i.name)).toEqual([
      "Marie Durand",
      "Montaine Marteau",
    ]);
  });

  it("« @ » seul renvoie les premières speakeuses (bornées)", () => {
    expect(filterMentions(items, "", 2)).toHaveLength(2);
  });

  it("renvoie du vide si rien ne matche", () => {
    expect(filterMentions(items, "zzz")).toEqual([]);
  });
});

describe("insertMention — insertion du lien Markdown", () => {
  it("remplace le jeton @ par un lien vers la fiche et pose le curseur après", () => {
    const texte = "Merci @mont pour l'atelier";
    const m = activeMention(texte, 11)!;
    const { value, caret } = insertMention(texte, m.start, m.end, {
      name: "Montaine Marteau",
      href: "/speakeuses/montaine-marteau",
    });
    expect(value).toBe("Merci [Montaine Marteau](/speakeuses/montaine-marteau) pour l'atelier");
    expect(value.slice(caret)).toBe(" pour l'atelier");
  });
});
