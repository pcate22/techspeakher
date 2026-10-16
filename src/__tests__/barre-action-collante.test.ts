// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * LA BARRE D'ONGLETS RECOUVRAIT LE BOUTON « ENREGISTRER ».
 *
 * Mesuré en navigateur, 393×852 : sur `/mon-espace/profil/[section]`, le bouton
 * occupait y=783→827 et la barre d'onglets (`fixed`, `z-40`) y=795→852. Il
 * restait 12 px cliquables sur 44, et `elementFromPoint` au centre du bouton
 * renvoyait l'onglet « Agenda » : appuyer sur « Enregistrer » CHANGEAIT DE PAGE
 * et perdait la saisie. Sur la page « infos » d'un atelier, le bouton était
 * recouvert à 100 %.
 *
 * Pourquoi personne ne l'avait vu : les barres d'action collantes existaient
 * avant la barre d'onglets, le dégagement de `globals.css` ne visait que le
 * `footer`, et chaque revue ne regardait qu'un côté de la collision. Aucun écran
 * connecté n'est rendu en navigateur par la CI, donc rien ne mesurait.
 *
 * Ce fichier ne mesure pas (jsdom n'a pas de mise en page) : il tient
 * l'INVARIANT DE STRUCTURE qui rend la mesure inutile — une seule mécanique,
 * une seule source pour la hauteur de la barre, et interdiction de recoller un
 * `sticky bottom-*` à la main à côté d'elle.
 */

const RACINE = resolve(process.cwd(), "src");

function fichiersSources(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...fichiersSources(p));
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

const relatif = (f: string) => f.slice(f.indexOf("src/"));
const globals = () => readFileSync(join(RACINE, "app/globals.css"), "utf8");

describe("barre d'action collante — jamais sous la barre d'onglets", () => {
  /**
   * LE test du lot : un `sticky bottom-…` posé à la main ignore la barre
   * d'onglets, et c'est exactement comme les quatre premiers sont arrivés. On
   * passe par la classe partagée, qui porte le dégagement.
   */
  it("aucune barre collante en bas ne se pose à la main (classe partagée obligatoire)", () => {
    const offenders: string[] = [];
    for (const f of fichiersSources(RACINE)) {
      readFileSync(f, "utf8")
        .split("\n")
        .forEach((ligne, i) => {
          const m = ligne.match(/\bsticky\b[^"'`]*\bbottom-(?!auto)[\w[\]./-]+/);
          if (m) offenders.push(`${relatif(f)}:${i + 1} → ${m[0]}`);
        });
    }
    expect(
      offenders,
      "Une barre d'action collante en bas doit utiliser `barre-action-collante` " +
        "(globals.css), qui la place AU-DESSUS de la barre d'onglets. Posée à la " +
        "main, elle passe dessous et son bouton devient inactivable :\n" +
        offenders.join("\n"),
    ).toEqual([]);
  });

  /** La classe existe, et elle décale bien la barre de la hauteur des onglets. */
  it("la classe partagée dérive son décalage de la hauteur de la barre d'onglets", () => {
    const css = globals();
    expect(css).toMatch(/\.barre-action-collante\s*\{/);
    // Le décalage mobile se DÉRIVE de la variable, jamais d'un nombre recopié :
    // c'est ce qui garantit qu'il suit si la barre change de hauteur. Seule ou
    // dans un `calc()` — la barre coiffe les onglets bord à bord depuis qu'elle
    // a perdu son contour de carte, donc il n'y a plus de retrait à ajouter.
    const regleMobile = css.match(
      /\.barre-action-collante[^}]*bottom:[^;]*var\(--hauteur-onglets\)/,
    );
    expect(
      regleMobile,
      "`.barre-action-collante` doit décaler son `bottom` de `var(--hauteur-onglets)`",
    ).not.toBeNull();
  });

  /**
   * La hauteur de la barre est écrite UNE fois. Elle l'était deux fois — la
   * valeur en dur dans le dégagement du footer — et un `min-h-14` changé d'un
   * côté aurait laissé l'autre en place, sans que rien ne le dise.
   */
  it("la hauteur de la barre d'onglets a une source unique", () => {
    const css = globals();
    expect(css).toMatch(/--hauteur-onglets:/);
    // Aucun autre endroit ne recopie le calcul (hauteur + bordure + encoche iOS).
    const enDur = [...css.matchAll(/calc\(\s*3\.5rem\s*\+\s*1px/g)];
    expect(
      enDur.length,
      "La hauteur de la barre d'onglets est recopiée en dur : passer par `--hauteur-onglets`",
    ).toBe(1);
  });

  /**
   * Le focus non masqué (WCAG 2.4.11), l'autre moitié du défaut : en tabulant,
   * le navigateur amenait l'élément focalisé au bas du scrollport, là où
   * l'attendaient les 57 px de la barre. `scroll-padding-top` était posé, pas
   * son pendant bas. Mesuré : 3 arrêts masqués sur 22 sur `/mon-espace`, dont
   * « Modifier mes infos » à 100 %.
   */
  it("le défilement réserve la hauteur de la barre en bas comme en haut", () => {
    const css = globals();
    expect(css).toMatch(/scroll-padding-top:/);
    const bas = css.match(/scroll-padding-bottom:\s*var\(--hauteur-onglets\)/);
    expect(
      bas,
      "`scroll-padding-bottom: var(--hauteur-onglets)` manque : un élément qui " +
        "prend le focus atterrit sous la barre d'onglets",
    ).not.toBeNull();
  });

  /**
   * Le dégagement ne vaut que là où la barre existe. Elle est en `xl:hidden` :
   * à partir de 1280 px il n'y a rien à dégager, et décaler la barre d'action
   * y créerait un trou.
   */
  it("le dégagement suit le point de rupture de la barre (moins de 1280 px)", () => {
    const css = globals();
    const bloc = css.match(/@media\s*\(max-width:\s*1279px\)\s*\{[\s\S]*?\n\}/);
    expect(bloc, "Le bloc @media (max-width: 1279px) du dégagement manque").not.toBeNull();
    const texte = bloc![0];
    for (const attendu of [
      "footer",
      ".barre-action-collante",
      "scroll-padding-bottom",
    ]) {
      expect(texte, `« ${attendu} » doit être dégagé dans le même bloc @media`).toContain(
        attendu,
      );
    }
  });

  /**
   * Le dégagement s'accroche à `[data-bottom-nav]`. C'est le SEUL point
   * d'accroche : renommer ou retirer l'attribut tue silencieusement les quatre
   * règles, et rien d'autre ne le vérifiait (la revue l'a montré par mutation —
   * supprimer l'attribut laissait les 9 tests de `BottomNav` au vert).
   */
  it("la barre d'onglets porte l'attribut dont dépend tout le dégagement", () => {
    const nav = readFileSync(join(RACINE, "components/BottomNav.tsx"), "utf8");
    expect(nav, "`data-bottom-nav` est le point d'accroche du dégagement").toContain(
      "data-bottom-nav",
    );
    // La hauteur déclarée doit rester celle du CSS (3.5rem). Elle vit dans la
    // classe PARTAGÉE des onglets (`onglet-barre.ts`, lot N1) — une seule
    // écriture pour les quatre onglets-liens et le déclencheur ➕.
    const onglet = readFileSync(join(RACINE, "components/onglet-barre.ts"), "utf8");
    expect(onglet, "La hauteur de la barre doit rester `min-h-14` (= 3.5rem)").toContain(
      "min-h-14",
    );
    const occurrences = [...globals().matchAll(/\[data-bottom-nav\]/g)];
    expect(
      occurrences.length,
      "Chaque règle de dégagement se garde sur `[data-bottom-nav]`",
    ).toBeGreaterThanOrEqual(3);
  });
});
