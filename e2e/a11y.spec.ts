import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  PAGES_PUBLIQUES,
  PAGES_AVEC_DONNEES,
  PAGES_MEMBRE,
  PAGES_ORGA,
} from "./pages-publiques";
import { exigerDecor, COMPTES } from "./decor";
import { seConnecter } from "./session";

/**
 * Gate RGAA / WCAG AA en VRAI navigateur (axe-core) : la conformité est
 * obligatoire. Contrairement au scan jsdom (a11y-axe.test.tsx), un vrai rendu
 * permet à axe d'évaluer le CONTRASTE, les couleurs, les landmarks et l'ordre
 * réel du DOM. Une régression d'accessibilité sur une page publique fait
 * échouer la CI.
 *
 * Périmètre : les pages publiques (agnostiques aux données, annuaire vide en CI).
 * On cible les règles WCAG 2.0/2.1 niveaux A et AA (socle du RGAA). L'audit RGAA
 * COMPLET (navigation clavier, lecteur d'écran, focus) reste un contrôle manuel
 * documenté ; ce test garantit le sous-ensemble automatisable, sans régression.
 */


/**
 * WCAG 2.2 A/AA entre dans le socle. La porte s'arrêtait à 2.1 ; mesuré sur les
 * 13 pages à 390 et 1280 px, le niveau 2.2 passe déjà sans une seule violation.
 * L'apport principal est `target-size` (2.5.8) — et il applique les EXCEPTIONS
 * de la norme, ce qu'un relevé de tailles brutes ne fait pas : un lien en ligne
 * dans une phrase, ou espacé d'au moins 24 px de ses voisins, est conforme même
 * sous le seuil. Sans ces exceptions on « corrige » du conforme.
 */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"];

/**
 * LES REPÈRES, en plus du socle WCAG.
 *
 * axe classe les règles de landmark en « best-practice », donc hors des tags
 * ci-dessus : 59 pages avaient fini par poser un second `<main>` à l'intérieur
 * de celui du layout racine sans que rien ne tombe. Mesuré en navigateur :
 * trois violations par page concernée, et « aller au contenu principal » qui
 * devient ambigu pour une lectrice d'écran.
 *
 * On les nomme UNE À UNE plutôt que d'ouvrir tout `best-practice` : le reste du
 * lot mêle des conseils de style à des défauts réels, et une porte qu'on
 * n'arrive pas à tenir finit désactivée.
 *
 * La règle ESLint `no-restricted-syntax` (eslint.config.mjs) tient la même
 * chose côté sources, sur TOUTES les pages — celles qui demandent une base
 * incluses, et dès la frappe.
 */
const REGLES_REPERES = [
  "landmark-main-is-top-level",
  "landmark-no-duplicate-main",
  "landmark-no-duplicate-banner",
  "landmark-no-duplicate-contentinfo",
  "landmark-unique",
];

/**
 * DEUX PASSES, et surtout PAS `withTags(…).withRules(…)` à la chaîne.
 *
 * `withRules` écrase le `runOnly` posé par `withTags` (« Cannot be used with
 * AxeBuilder#withTags », dist/index.js) : enchaîner les deux ne cumule rien, ça
 * REMPLACE tout le socle WCAG par les cinq règles de repères. La porte passe au
 * vert en ayant cessé de vérifier ce pour quoi elle existe — le plus dangereux
 * des états, parce qu'il est indiscernable du succès.
 */
/** Une passe axe, avec de quoi vérifier qu'elle a réellement tourné. */
async function passe(
  builder: AxeBuilder,
): Promise<{ violations: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"]; total: number }> {
  const r = await builder.analyze();
  return {
    violations: r.violations,
    // Combien de règles axe a réellement évaluées, tous verdicts confondus.
    total: r.violations.length + r.passes.length + r.incomplete.length + r.inapplicable.length,
  };
}

const lisible = (violations: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"]) =>
  violations.map((v) => `${v.id} (${v.impact}) : ${v.help} [${v.nodes.length}]`).join("\n");

/** L'audit d'une page, identique quel que soit son besoin en données. */
async function auditer(page: import("@playwright/test").Page, chemin: string) {
  const res = await page.goto(chemin);
  expect(res?.status()).toBe(200);

  const socle = await passe(new AxeBuilder({ page }).withTags(TAGS));
  const reperes = await passe(new AxeBuilder({ page }).withRules(REGLES_REPERES));

  // SILENCE ≠ SUCCÈS : une passe qui n'évalue presque rien passerait au vert
  // sans rien garder. On exige qu'elle ait vraiment travaillé.
  expect(socle.total, "le socle WCAG n'a évalué presque aucune règle").toBeGreaterThan(50);
  expect(reperes.total, "les règles de repères ont disparu").toBe(REGLES_REPERES.length);

  expect(socle.violations, lisible(socle.violations)).toEqual([]);
  expect(reperes.violations, lisible(reperes.violations)).toEqual([]);
}

test.describe("RGAA / WCAG AA — pages publiques (axe)", () => {
  for (const chemin of PAGES_PUBLIQUES) {
    test(`${chemin} n'a aucune violation WCAG A/AA`, async ({ page }) => {
      await auditer(page, chemin);
    });
  }
});

/**
 * LES PAGES PEUPLÉES. Même porte, même exigence — mais sur du contenu réel :
 * une carte de speakeuse, un portrait, une galerie de participantes. C'est là
 * que se logent le contraste et les libellés de lien, et rien ne les avait
 * jamais regardés en vrai navigateur.
 */
test.describe("RGAA / WCAG AA — pages peuplées (axe)", () => {
  test.beforeEach(async ({ request }) => {
    await exigerDecor(request);
  });

  for (const chemin of PAGES_AVEC_DONNEES) {
    test(`${chemin} n'a aucune violation WCAG A/AA`, async ({ page }) => {
      await auditer(page, chemin);
    });
  }
});

/**
 * LES ESPACES CONNECTÉS — la dette « résiduelle » de `dette-technique.md`
 * (« scan axe des pages connectées : nécessite l'auth en E2E »). Elle tenait
 * uniquement à l'absence de session et de base en CI : les deux sont là.
 */
for (const [role, chemins] of [
  ["membre", PAGES_MEMBRE],
  ["orga", PAGES_ORGA],
] as const) {
  test.describe(`RGAA / WCAG AA — espace ${role} (axe)`, () => {
    test.beforeEach(async ({ request, context }) => {
      await exigerDecor(request);
      await seConnecter(context, COMPTES[role]);
    });

    for (const chemin of chemins) {
      test(`${chemin} n'a aucune violation WCAG A/AA`, async ({ page }) => {
        await auditer(page, chemin);
      });
    }
  });
}
