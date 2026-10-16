import { test, expect } from "@playwright/test";
import { PAGES_PUBLIQUES } from "./pages-publiques";

/**
 * DEUX DÉFAUTS TYPOGRAPHIQUES QUI NE SE VOIENT QU'AU RENDU, une visite par page.
 *
 * 1. LES MOTS COLLÉS. Un nœud de texte qui suit un élément en ligne et se
 *    poursuit à la ligne suivante perd son espace de tête à la compilation :
 *    `<strong>meetups</strong>\net rencontres,` rend « meetupset rencontres ».
 *
 * 2. LE NOM QUI SE COUPE. En JSX, un saut de ligne entre deux mots se replie en
 *    espace SÉCABLE : « Tech Speak'Her » écrit sur deux lignes source se coupe en
 *    fin de ligne à l'écran.
 *
 * Ils partagent leur raison d'être jugés ICI plutôt que sur les sources. Le
 * premier passe sous le type-check, sous ESLint et sous les tests qui lisent des
 * littéraux, puisque l'espace EST dans la source : vérifié, avec
 * `<span>en sécurité</span> pour` suivi de `prendre la parole` à la ligne, le HTML
 * servi par `next build && next start` contient `en sécurité</span>pour prendre
 * la parole` — alors que la même source passée à `tsc --jsx react` ou au binding
 * SWC seul conserve l'espace. Deux relectures s'y sont laissé prendre et ont
 * conclu que le code était bon. Le second est l'exact symétrique : une garde
 * écrite côté sources voit « Tech » et « Speak'Her » sur deux lignes et les croit
 * séparés par rien — deux pages du dépôt étaient dans ce cas, et une première
 * version de ce garde-fou les a laissées passer.
 *
 * Le DOM, lui, ne ment pas : il porte l'espace réellement servie. Une seule
 * visite par page suffit à lire les deux, et les rejouer en « mobile »
 * doublerait le coût sans ajouter de signal — le HTML sérialisé ne dépend pas du
 * viewport.
 *
 * Le remède du premier est un `{" "}` explicite, celui du second une INSÉCABLE ;
 * les deux sont déjà la convention du dépôt.
 */
test.describe("Typographie au rendu", () => {
  for (const chemin of PAGES_PUBLIQUES) {
    test(`${chemin} : aucun mot collé, et le nom tient sur une ligne`, async (
      { page },
      testInfo,
    ) => {
      testInfo.skip(testInfo.project.name !== "chromium", "indépendant du viewport");

      const res = await page.goto(chemin);
      expect(res?.status()).toBe(200);

      const { colles, secables } = await page.evaluate(() => {
        // Ponctuation qui suit un mot sans espace, plus les signes qui ouvrent
        // ou ferment (parenthèses, guillemets, apostrophe française).
        const COLLE_OK = /^[\s,.;:!?)\]}»…%°'’/-]/;
        const colles: string[] = [];

        const enLigne = "main :is(strong, em, b, i, a, span, code, abbr)";
        for (const el of Array.from(document.querySelectorAll(enLigne))) {
          const suivant = el.nextSibling;
          if (!suivant || suivant.nodeType !== Node.TEXT_NODE) continue;
          const texte = suivant.textContent ?? "";
          if (texte.length === 0 || COLLE_OK.test(texte)) continue;
          // Le dernier mot de l'élément, collé au premier du texte suivant.
          const avant = (el.textContent ?? "").trim().split(/\s+/).pop() ?? "";
          const apres = texte.trim().split(/\s+/)[0] ?? "";
          colles.push(`${avant}${apres}`);
        }

        // Une espace SÉCABLE : tout blanc SAUF ceux qui interdisent la coupure
        // (insécable, fine insécable, espace chiffre, liant sans chasse). Le
        // complément plutôt qu'une liste à tenir à jour : la propriété testée est
        // « le navigateur peut couper ici », et elle se définit par exclusion.
        const SECABLE = /Tech[^\S\u00A0\u202F\u2007\uFEFF]+Speak/gi;

        // Le TEXTE RENDU, concaténé : `document.body` contient aussi la charge
        // RSC de Next dans des <script>, où le nom apparaît sérialisé sans jamais
        // être affiché — le juger reviendrait à corriger du JSON. La
        // CONCATÉNATION importe : nœud par nœud, `Tech <strong>Speak'Her</strong>`
        // reste invisible alors que la visiteuse, elle, voit bien une espace
        // sécable entre les deux mots.
        const it = document.createNodeIterator(document.body, NodeFilter.SHOW_TEXT, {
          acceptNode: (n) =>
            n.parentElement?.closest("script, style, noscript, template")
              ? NodeFilter.FILTER_REJECT
              : NodeFilter.FILTER_ACCEPT,
        });
        let rendu = "";
        let n: Node | null;
        while ((n = it.nextNode())) rendu += n.textContent ?? "";

        const secables: string[] = [];
        const releve = (texte: string, ou: string) => {
          for (const m of texte.matchAll(SECABLE)) {
            secables.push(`${ou} : …${texte.slice(Math.max(0, m.index - 30), m.index + 40).trim()}…`);
          }
        };
        releve(rendu, "corps");
        // Le titre de l'onglet passe à la ligne dans les résultats de recherche
        // et les partages : il se coupe comme le reste. `alt` et `aria-label`
        // sont volontairement HORS de cette garde — ils portent la graphie des
        // statuts, et ne sont jamais mis en page.
        releve(document.title, "titre");
        return { colles, secables };
      });

      expect(
        colles,
        `Mots collés au rendu (ajouter {" "} après l'élément en ligne) :\n  - ${colles.join("\n  - ")}`,
      ).toEqual([]);

      expect(
        secables,
        "« Tech Speak'Her » servi avec une espace sécable : le nom se coupe en " +
          "fin de ligne. Poser une INSÉCABLE (U+00A0), sur UNE seule ligne source " +
          "— un retour à la ligne en JSX rend une espace ordinaire :\n  - " +
          secables.join("\n  - "),
      ).toEqual([]);
    });
  }
});
