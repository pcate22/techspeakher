import { describe, it, expect } from "vitest";
import Fuse from "fuse.js";
import { FUSE_OPTIONS, buildSearchList, rankResults } from "@/lib/site-search";
import { chercherReplie } from "@/lib/search-relevance";
import type { SearchItem } from "@/data/search-index";

const NBSP = "\u00A0";

/**
 * CE QU'ON TAPE DOIT TROUVER CE QUI EST ÉCRIT — bout en bout, à travers Fuse.
 *
 * `foldRecherche` seule ne suffisait pas, et c'est le piège de ce lot :
 * elle répare la correspondance exacte et le surlignage, mais Fuse indexe les
 * chaînes BRUTES et rend ses index de match sur elles. L'insécable du corpus
 * casse en deux le fragment CONTIGU que `longestRun` mesure, `rankResults`
 * passe alors sous `requiredRun`, et le résultat disparaît — alors que la
 * phrase cherchée est là, mot pour mot.
 *
 * Mesuré : « bénévoles tech speak her » ne rendait plus rien.
 *
 * Le test passe donc par le vrai corpus et le vrai classement, pas par la
 * fonction de repli : c'est le seul niveau où le défaut se voit.
 */
const chercher = (q: string, speakeuses: SearchItem[] = []) => {
  const fuse = new Fuse(buildSearchList(speakeuses), FUSE_OPTIONS);
  // La MÊME porte que SearchBar : un test qui appellerait `fuse.search`
  // directement ne verrait pas si la production oublie de replier.
  return rankResults(chercherReplie(fuse, q, 40), q, 8);
};

describe("recherche du site — l'espace tapée trouve l'espace typographique", () => {
  /** L'entrée que ces requêtes doivent atteindre, nommée : « il y a un résultat »
   *  passerait en trouvant n'importe quoi d'autre. */
  const FAQ = "Qui organise le Tremplin";

  it.each([
    "bénévoles tech speak her",
    "tech speak her",
    "qui organise le tremplin",
  ])("« %s » trouve la réponse de la FAQ", (q) => {
    const titres = chercher(q).map((r) => r.item.title);
    expect(titres.some((t) => t.includes(FAQ))).toBe(true);
  });

  /**
   * LE CAS QUE CE LOT A CRÉÉ : le nom est désormais servi avec une insécable
   * partout. Le sélectionner sur une page et le coller dans la recherche envoie
   * donc une requête à insécable — elle doit trouver exactement la même chose.
   */
  it.each(["tech" + NBSP + "speak'her", "bénévoles tech" + NBSP + "speak her"])(
    "« %s » collé depuis le site trouve autant que tapé au clavier",
    (colle) => {
      const tape = colle.replace(new RegExp(NBSP, "g"), " ");
      expect(chercher(colle).map((r) => r.item.url)).toEqual(
        chercher(tape).map((r) => r.item.url),
      );
    },
  );

  /** L'apostrophe tapée ou non ne doit rien changer. */
  it("« tech speak'her » et « tech speak her » rendent le même nombre de résultats", () => {
    expect(chercher("tech speak her").length).toBe(chercher("tech speak'her").length);
  });

  /**
   * Le repli des espaces est caractère pour caractère : les index de match
   * rendus par Fuse restent alignés sur le texte BRUT qu'on surligne. Un repli
   * qui changerait la longueur (retirer les diacritiques, par exemple) ferait
   * découper le surlignage au mauvais endroit.
   */
  it("le surlignage reste aligné sur le texte AFFICHÉ", () => {
    const liste = buildSearchList([]);
    const fuse = new Fuse(liste, FUSE_OPTIONS);
    let verifies = 0;
    for (const r of fuse.search("tremplin", { limit: 40 })) {
      for (const m of r.matches ?? []) {
        // `m.value` vient de l'INDEX (donc de `getFn`) ; le surlignage découpe
        // le champ BRUT de l'article. Comparer les deux est la seule assertion
        // qui tombe si le repli change la longueur des chaînes.
        const brut = (r.item as unknown as Record<string, string>)[m.key ?? ""];
        if (typeof brut !== "string") continue;
        expect((m.value ?? "").length).toBe(brut.length);
        for (const [, fin] of m.indices ?? []) expect(fin).toBeLessThan(brut.length);
        verifies += 1;
      }
    }
    // Silence ≠ succès : sans match, la boucle ne vérifierait rien.
    expect(verifies).toBeGreaterThan(0);
  });
});

/**
 * L'AUTRE MOITIÉ DU CORPUS : celle qui vient de la BASE.
 *
 * L'index statique est écrit à la main, en typographie soignée. `keywords`, lui,
 * est assemblé par `getSpeakerSearchItems` — un `join(" ")` de la bio, de la
 * ville, des sujets et du texte des talks, tous SAISIS librement dans
 * `/mon-espace`. Une bio écrite sur plusieurs lignes garde donc ses `\n`, et rien
 * en amont ne les replie (`search-contenus` a son `uneSeuleLigne`, ce chemin-ci
 * n'en a pas).
 *
 * CE QUI SE CASSE, MESURÉ. La speakeuse remonte quand même — le flou de Fuse
 * absorbe un caractère d'écart. Ce qui disparaît, c'est l'EXTRAIT SURLIGNÉ :
 * `foldedRanges` cherche la requête repliée dans le champ, ne l'y trouve plus, et
 * `buildSnippet` rend `null`. La speakeuse s'affiche alors avec son aperçu brut,
 * sans un mot de la phrase cherchée — précisément le « résultat qui remonte sans
 * qu'on comprenne pourquoi » que l'extrait existe pour éviter.
 */
describe("recherche du site — une bio écrite sur plusieurs lignes reste lisible", () => {
  /** La phrase cherchée, telle qu'on la tape : en espaces ordinaires. */
  const PHRASE = "systèmes distribués et leur observabilité";

  /** Une speakeuse dont la bio sépare « distribués » et « et leur » par `sep`. */
  const speakeuseAvec = (sep: string): SearchItem => ({
    title: "Ada Lovelace",
    description: "Ingénieure plateforme · Toulouse",
    url: "/speakeuses/1",
    category: "Speakeuse",
    // Assemblé comme en production : `[bio, ville, …].filter(Boolean).join(" ")`.
    keywords: [
      `J'outille des systèmes distribués${sep}et leur observabilité au quotidien.`,
      "Toulouse",
      "observabilité",
    ].join(" "),
  });

  /** Les morceaux surlignés de l'extrait, ou null quand il n'y en a pas. */
  const surligneAvec = (sep: string) => {
    const speakeuse = speakeuseAvec(sep);
    const r = chercher(PHRASE, [speakeuse]).find((x) => x.item.url === speakeuse.url);
    return r?.snippet?.filter((s) => s.hit).map((s) => s.text) ?? null;
  };

  it.each([
    ["\n", "un retour à la ligne"],
    ["\t", "une tabulation"],
    ["\u00A0", "une insécable"],
  ])(
    "la phrase à cheval sur %s (%s) reste surlignée dans l'extrait",
    (sep) => {
      // Le surlignage découpe le champ BRUT — c'est ce qui garde les index de
      // Fuse alignés sur le texte affiché. On retrouve donc le séparateur
      // d'origine dans l'extrait, pas l'espace ordinaire de la requête.
      expect(surligneAvec(sep)).toEqual([PHRASE.replace(" et leur", `${sep}et leur`)]);
    },
  );

  it("le même extrait qu'une bio écrite sur une seule ligne", () => {
    expect(surligneAvec("\n")?.map((s) => s.replace("\n", " "))).toEqual(surligneAvec(" "));
  });
});
