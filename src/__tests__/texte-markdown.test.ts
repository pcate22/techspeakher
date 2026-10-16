import { describe, it, expect } from "vitest";
import { texteBrut, couperSurUnMot } from "@/lib/texte-markdown";

/**
 * Markdown → texte brut, pour l'INDEXATION et l'aperçu de la recherche (pas
 * pour le rendu : les articles passent par react-markdown + rehype-sanitize).
 * Volontairement naïve — ce qu'on lui demande, c'est de ne pas faire remonter
 * de syntaxe dans un aperçu, et de ne pas faire matcher « ## » ou « http » sur
 * une recherche de mots.
 */
describe("texteBrut", () => {
  it("retire les marqueurs de titre en gardant le texte", () => {
    expect(texteBrut("## Peux-tu te présenter ?")).toBe("Peux-tu te présenter ?");
    expect(texteBrut("# Titre\n\nUn paragraphe.")).toBe("Titre Un paragraphe.");
  });

  it("retire l'emphase sans manger le mot", () => {
    expect(texteBrut("Elle est **vraiment** _là_.")).toBe("Elle est vraiment là.");
    // Un souligné à l'intérieur d'un mot n'est pas de l'emphase.
    expect(texteBrut("le champ lien_externe")).toBe("le champ lien_externe");
  });

  it("garde le libellé d'un lien et jette son URL", () => {
    expect(texteBrut("Voir [le programme](https://tremplin.example/2026).")).toBe(
      "Voir le programme.",
    );
  });

  it("retire une image en entier, alt compris", () => {
    expect(texteBrut("Avant ![Rachel sur scène](/photos/rachel.jpg) après")).toBe(
      "Avant après",
    );
  });

  it("retire les blocs de code et le code en ligne", () => {
    expect(texteBrut("Avant\n\n```ts\nconst x = 1;\n```\n\nAprès")).toBe("Avant Après");
    expect(texteBrut("La fonction `toCarteActu` décide.")).toBe("La fonction toCarteActu décide.");
  });

  it("retire un bloc de code JAMAIS REFERMÉ", () => {
    // Cas SYSTÉMATIQUE, pas une coquille d'autrice : le corps arrive tronqué à
    // 600 caractères par SQL, donc toute clôture ``` au-delà est coupée. Sans
    // cette règle, deux backticks partent en code en ligne et le troisième
    // reste dans l'aperçu.
    expect(texteBrut("Avant\n\n```ts\nconst x = 1;\n\nSuite du texte.")).toBe("Avant");
  });

  it("garde le libellé d'un lien dont le libellé contient des crochets", () => {
    // Sinon la regex renonce et c'est l'URL ENTIÈRE qui atterrit dans l'aperçu
    // et dans l'index — exactement ce que ce module existe pour éviter.
    expect(texteBrut("Voir [libellé [imbriqué]](https://x.test) fin")).toBe(
      "Voir libellé [imbriqué] fin",
    );
  });

  it("retire un filet horizontal, serré comme espacé", () => {
    expect(texteBrut("Avant\n\n---\n\nAprès")).toBe("Avant Après");
    expect(texteBrut("Avant\n\n- - -\n\nAprès")).toBe("Avant Après");
    expect(texteBrut("Avant\n\n***\n\nAprès")).toBe("Avant Après");
    expect(texteBrut("Avant\n\n___\n\nAprès")).toBe("Avant Après");
  });

  it("garde une astérisque isolée à l'intérieur d'un passage en gras", () => {
    // « 3 * 4 » dans un texte en gras : la multiplication disparaissait et le
    // « ** » de fermeture remontait dans l'aperçu.
    expect(texteBrut("**Prix : 3 * 4 €**")).toBe("Prix : 3 * 4 €");
    expect(texteBrut("***gras italique***")).toBe("gras italique");
  });

  it("retire les marqueurs de citation et de liste", () => {
    expect(texteBrut("> Une citation\n\n- premier\n- second\n\n1. un")).toBe(
      "Une citation premier second un",
    );
  });

  it("préserve les espaces insécables de la typographie française", () => {
    // `\s+` naïf les écraserait : l'aperçu d'un article se lirait alors
    // autrement que partout ailleurs (cf. `uneSeuleLigne`, lib/format).
    expect(texteBrut("## Peux-tu te présenter ?\n\nOui !")).toBe(
      "Peux-tu te présenter ? Oui !",
    );
  });

  it("normalise les blancs et rend une chaîne vide sans matière", () => {
    expect(texteBrut("Trop   d'espaces\n\n\net de lignes")).toBe("Trop d'espaces et de lignes");
    expect(texteBrut("")).toBe("");
    expect(texteBrut("   \n\n  ")).toBe("");
    expect(texteBrut("```\ncode seul\n```")).toBe("");
  });
});

/**
 * L'aperçu d'un contenu sans chapô part du corps, lui-même tronqué en SQL : la
 * coupe tombe au milieu d'un mot. On retaille sur la dernière espace, sinon
 * l'aperçu se lit comme un bug d'affichage.
 */
describe("couperSurUnMot", () => {
  it("laisse passer un texte plus court que la limite", () => {
    expect(couperSurUnMot("Un texte court.", 100)).toBe("Un texte court.");
  });

  it("coupe sur la dernière espace et suffixe une ellipse", () => {
    expect(couperSurUnMot("Rachel Dubois pratique le produit", 20)).toBe("Rachel Dubois…");
  });

  it("coupe net quand le premier mot dépasse déjà la limite", () => {
    // Aucune espace avant la limite : mieux vaut couper que rendre la chaîne
    // entière (l'aperçu déborderait).
    expect(couperSurUnMot("anticonstitutionnellement", 10)).toBe("anticonst…");
  });

  it("garde le point d'interrogation et l'exclamation, qui portent le sens", () => {
    // « Prête à monter sur scène ? Voici… » rogné en « Prête à monter sur
    // scène… » transforme une accroche en affirmation en suspens.
    expect(couperSurUnMot("Prête à monter sur scène ? Voici comment", 27)).toBe(
      "Prête à monter sur scène ?…",
    );
  });

  it("ne laisse pas de ponctuation collée à l'ellipse", () => {
    expect(couperSurUnMot("Elle revient sans filtre, sur la scène", 26)).toBe(
      "Elle revient sans filtre…",
    );
  });

  /**
   * LA TYPOGRAPHIE DU SITE, DANS L'APERÇU.
   *
   * Le corpus met une INSÉCABLE devant `! ? : ;` et dans « Tech Speak'Her ».
   * `lastIndexOf(" ")` ne la voyait pas : il reculait jusqu'à l'espace ORDINAIRE
   * précédente et rendait tout ce qui suit. Ici l'aperçu s'arrêtait sur
   * « raconte le », un article en suspens, alors qu'il y avait la place de dire
   * de QUOI il s'agit.
   */
  it("coupe sur une insécable comme sur une espace ordinaire", () => {
    const NBSP = "\u00A0";
    const texte = `Rachel Dubois raconte le Tremplin${NBSP}Tech${NBSP}Speak'Her et la suite`;

    // La limite tombe au milieu de « Speak'Her » : la dernière frontière de mot
    // avant elle est l'insécable qui précède, pas l'espace d'avant « Tremplin ».
    const coupe = couperSurUnMot(texte, 44);

    expect(coupe).toBe(`Rachel Dubois raconte le Tremplin${NBSP}Tech…`);
    expect(coupe.length).toBeLessThanOrEqual(44);
  });

  it("rend une chaîne vide telle quelle", () => {
    expect(couperSurUnMot("", 10)).toBe("");
  });

  it("ne dépasse jamais la limite, quelle qu'elle soit", () => {
    const texte = "Un texte d'exemple assez long pour être coupé partout.";
    for (let max = 0; max <= 40; max++) {
      expect(couperSurUnMot(texte, max).length).toBeLessThanOrEqual(Math.max(max, 0));
    }
    expect(couperSurUnMot("abc", 0)).toBe("");
  });

  it("ne coupe pas un emoji en deux", () => {
    // Une coupe brute tombe entre les deux moitiés d'un caractère hors du plan
    // de base : le navigateur afficherait « \uFFFD ».
    const coupe = couperSurUnMot("😀".repeat(100), 21);
    expect(coupe).not.toMatch(/[\uD800-\uDBFF]$/);
    expect(coupe.endsWith("…")).toBe(true);
  });

  it("garde de la matière plutôt que de rendre une ellipse toute seule", () => {
    // Quand tout ce qui précède la coupe est de la ponctuation, le rognage
    // vidait la chaîne et l'aperçu se réduisait à « … », qui ne dit rien.
    expect(couperSurUnMot("-------- suite", 6)).not.toBe("…");
  });
});
