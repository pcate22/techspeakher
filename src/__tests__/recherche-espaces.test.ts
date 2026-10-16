import { describe, it, expect } from "vitest";
import { foldRecherche, plierEspaces } from "@/lib/normalise-recherche";
import { searchIndex } from "@/data/search-index";

const NBSP = "\u00A0";

/**
 * QUELLE ESPACE A ÉTÉ TAPÉE NE REGARDE PAS LA RECHERCHE.
 *
 * `foldRecherche` existe pour qu'on trouve « Élodie » en tapant « elodie » :
 * elle range la casse et les diacritiques. L'espace lui échappait.
 *
 * Or le corpus en contient : la typographie française met une INSÉCABLE avant
 * `! ? : ;` et dans les noms qui ne doivent pas se couper. `search-index.ts`
 * indexe les réponses de la FAQ (`description: f.a`), donc ces insécables sont
 * déjà dans ce qu'on fouille — alors que le clavier d'une visiteuse produit une
 * espace ordinaire. `normalize("NFD")` ne les décompose PAS (seul NFKD le fait),
 * donc les deux chaînes divergent silencieusement.
 *
 * Conséquence : « Tremplin ? » ou « Tech Speak'Her » tapés normalement ratent la
 * correspondance exacte et retombent sur le flou de Fuse, avec une pénalité de
 * score — donc plus bas dans la liste, voire hors seuil.
 */
describe("foldRecherche — l'espace tapée vaut l'espace typographique", () => {
  it("ramène l'insécable à une espace ordinaire", () => {
    expect(foldRecherche(`Tech${NBSP}Speak'Her`)).toBe(foldRecherche("Tech Speak'Her"));
    expect(foldRecherche(`Le Tremplin${NBSP}?`)).toBe(foldRecherche("Le Tremplin ?"));
  });

  it.each([
    ["\u202F", "fine insécable"],
    ["\u2009", "espace fine"],
    ["\u2002", "demi-cadratin"],
    ["\u2003", "cadratin"],
    ["\u200B", "chasse nulle"],
    ["\t", "tabulation"],
    ["\n", "retour à la ligne"],
  ])("range aussi %s (%s), qu'un copier-coller ou la base amènent", (blanc) => {
    expect(foldRecherche(`Tremplin${blanc}: c'est parti`)).toBe(
      foldRecherche("Tremplin : c'est parti"),
    );
  });

  it("garde son travail d'origine : casse et diacritiques", () => {
    expect(foldRecherche("Élodie")).toBe(foldRecherche("elodie"));
    expect(foldRecherche("DevFest")).toBe("devfest");
  });

  /**
   * LE CORPUS RÉEL.
   *
   * Une insécable dans l'index est SANS DANGER depuis que la requête passe par
   * le même repli (`chercherReplie`) : les deux côtés se rejoignent. Ce qui
   * resterait inatteignable, c'est un blanc que `plierEspaces` NE couvre pas :
   * il survivrait d'un seul côté et casserait le fragment contigu que
   * `longestRun` mesure.
   *
   * Depuis que `ESPACES_SOURCE` s'appuie sur `\s`, un seul blanc reste dehors, et
   * c'est délibéré : U+2060 (liant de mots) JOINT au lieu de séparer, le replier
   * fabriquerait une espace qui n'existe pas. C'est donc exactement lui que cette
   * assertion cherche — dans les trois champs indexés, `keywords` compris, qui
   * porte le plein-texte et n'était pas regardé.
   */
  it("aucun blanc du corpus n'échappe au repli", () => {
    const survivants = searchIndex
      .flatMap((i) => [i.title, i.description, i.keywords])
      .filter((t): t is string => typeof t === "string")
      .flatMap((t) =>
        [...plierEspaces(t)]
          .filter((c) => c !== " " && /[\s\u200b\u2060\ufeff]/.test(c))
          .map((c) => `U+${c.codePointAt(0)!.toString(16).padStart(4, "0")} dans « ${t.slice(0, 50)} »`),
      );

    expect(
      survivants,
      `Blanc indexé que \`plierEspaces\` ne ramène pas à une espace ordinaire :\n${survivants.join("\n")}`,
    ).toEqual([]);
  });
});
