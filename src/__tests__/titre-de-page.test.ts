// @vitest-environment node
import { describe, it, expect } from "vitest";
import ts from "typescript";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fichiersSources } from "./copie-affichee";

/**
 * Cliquet : **un titre de page est un LITTÉRAL**.
 *
 * « Un titre nomme l'endroit, rien d'autre » (`docs/principes-conception-ui.md`,
 * « Ce qui se lit »). La règle a été payée deux fois en deux jours : la
 * pastille « Privé » dans le `h1` du profil, puis « À faire (5) » sur
 * `/admin/taches`, où le repère de page changeait de nom à chaque visite et
 * où, dès l'étape B, il aurait contredit le badge de l'onglet (l'un comptant
 * la vue filtrée, l'autre la vue complète).
 *
 * Corriger la page ne corrige pas la règle — c'est la leçon du registre des
 * erreurs, « vrai au niveau du composant, faux au niveau de l'écran ». Et une
 * garde DANS `ListPageTemplate` ne marcherait pas : au rendu, il ne peut pas
 * distinguer « Tremplin 2026 » de « À faire (5) » sans renifler la chaîne.
 *
 * D'où ce cliquet sur les SOURCES. Il tolère :
 *
 * - un littéral (`title="Récompenses"`) ;
 * - une expression simple qui NOMME une entité — `{edition.nom}`, `{a.titre}` :
 *   nommer l'endroit par la donnée qui l'identifie, c'est encore le nommer.
 *
 * Il refuse le calcul : gabarit, ternaire, concaténation, appel de fonction.
 * C'est là que le nombre et l'état s'invitent. Ils vivent dans `meta`, à côté.
 *
 * **La liste des exceptions est VIDE, et doit le rester** : les onze appelants
 * respectaient déjà la règle avant qu'on l'écrive. Un cliquet posé sur une
 * liste vide ne demande aucune migration — il interdit seulement la douzième.
 */

/**
 * Les deux seules dérogations, et elles sont légitimes : le titre y est
 * composé par un helper qui MET EN FORME UN NOM — `coachLabel(coach)`,
 * `libelleSousGroupe(...)`. Nommer l'endroit par la donnée qui l'identifie
 * reste le nommer ; ces appels ne peuvent pas introduire de compteur.
 *
 * Elles restent dans la liste plutôt qu'en exception du motif, pour la même
 * raison que les deux gabarits d'`Avatar` dans le cliquet typographique : un
 * motif sans exception à connaître est un motif qu'on peut appliquer sans le
 * relire. La liste ne peut que raccourcir.
 */
const RESTANTS = new Set<string>([
  "src/app/admin/tremplins/[edition]/ateliers/[atelier]/coachs/[userId]/page.tsx",
  "src/app/admin/tremplins/[edition]/ateliers/[atelier]/sous-groupes/[sg]/page.tsx",
]);

/**
 * Les gabarits qui rendent un `h1`, avec le NOM DE LEUR PROP.
 *
 * `SousPage` dit `titre` là où les deux autres disent `title` : la première
 * version de ce cliquet ne connaissait que `title` et n'inspectait donc RIEN
 * sur ses huit appelants — un titre calculé y restait vert (prouvé par
 * mutation, relecture du 2026-08-17). Le test « jamais à vide » ne pouvait pas
 * l'attraper : il OU-ait les trois noms, et `PageHero` suffisait au seuil.
 */
const GABARITS_DE_PAGE: Record<string, string> = {
  ListPageTemplate: "title",
  PageHero: "title",
  SousPage: "titre",
};

type Faute = { fichier: string; gabarit: string; forme: string };

function titresCalcules(rel: string): Faute[] {
  const code = readFileSync(resolve(process.cwd(), rel), "utf8");
  const src = ts.createSourceFile(rel, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: Faute[] = [];

  /**
   * Un identifiant est toléré s'il NOMME une entité — mais pas s'il a été
   * calculé deux lignes plus haut. `const t = \`À faire (${n})\`` puis
   * `title={t}` faisait rentrer par la fenêtre exactement la régression que le
   * cliquet ferme (prouvé par mutation, relecture du 2026-08-17). On résout
   * donc l'initialiseur dans le même fichier.
   */
  const initialiseurs = new Map<string, ts.Expression>();
  const collecte = (n: ts.Node) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      initialiseurs.set(n.name.text, n.initializer);
    }
    n.forEachChild(collecte);
  };
  collecte(src);

  /** L'expression réellement passée : un identifiant local est déplié. */
  const deplie = (e: ts.Expression): ts.Expression =>
    ts.isIdentifier(e) ? (initialiseurs.get(e.text) ?? e) : e;

  const visite = (n: ts.Node) => {
    if (ts.isJsxOpeningLikeElement(n)) {
      const nom = n.tagName.getText(src);
      const prop = GABARITS_DE_PAGE[nom];
      if (prop) {
        for (const attr of n.attributes.properties) {
          if (!ts.isJsxAttribute(attr) || attr.name.getText(src) !== prop) continue;
          const v = attr.initializer;
          if (!v) continue;
          // `title="Récompenses"` : un littéral, la forme canonique.
          if (ts.isStringLiteral(v)) continue;
          if (ts.isJsxExpression(v) && v.expression) {
            const e = deplie(v.expression);
            // `{"Récompenses"}`, `{edition.nom}`, `{titre}`, `{<>…</>}` :
            // nommer par la donnée qui identifie l'endroit reste nommer.
            if (
              ts.isStringLiteral(e) ||
              ts.isIdentifier(e) ||
              ts.isPropertyAccessExpression(e) ||
              ts.isJsxFragment(e) ||
              ts.isJsxElement(e)
            )
              continue;
            out.push({ fichier: rel, gabarit: nom, forme: e.getText(src).slice(0, 80) });
          }
        }
      }
    }
    n.forEachChild(visite);
  };
  visite(src);
  return out;
}

describe("titre de page — il nomme l'endroit, il ne le calcule pas", () => {
  const fautes = fichiersSources()
    .filter((rel) => rel.endsWith(".tsx") && !RESTANTS.has(rel))
    .flatMap(titresCalcules);

  // Un cliquet qui ne trouve aucun appelant rassure pour rien : si un gabarit
  // est renommé, ou si sa prop change de nom, ces tests tombent avant l'autre.
  const appelantsDe = (gabarit: string) =>
    fichiersSources().filter(
      (rel) =>
        rel.endsWith(".tsx") &&
        readFileSync(resolve(process.cwd(), rel), "utf8").includes(`<${gabarit}`),
    );

  it.each(Object.keys(GABARITS_DE_PAGE))(
    "le cliquet regarde bien les appelants de %s (jamais à vide)",
    (gabarit) => {
      // UN test par gabarit : la première version les OU-ait, si bien qu'un
      // gabarit devenu invisible au cliquet passait inaperçu.
      expect(appelantsDe(gabarit).length).toBeGreaterThan(0);
    },
  );

  it("aucun titre de page n'est calculé (ni compteur, ni état, ni ternaire)", () => {
    const lignes = fautes.map((f) => `${f.fichier} — <${f.gabarit} ${GABARITS_DE_PAGE[f.gabarit]}={${f.forme}}>`);
    expect(
      lignes,
      "Un titre de page nomme l'endroit, rien d'autre : le nombre et l'état " +
        "vivent dans `meta`, à côté du titre (principes UI, « Ce qui se lit »).\n" +
        lignes.join("\n"),
    ).toEqual([]);
  });
});
