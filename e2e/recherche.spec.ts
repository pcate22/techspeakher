import { test, expect, type Page } from "@playwright/test";

/**
 * LA RECHERCHE DU SITE (la loupe), DE BOUT EN BOUT.
 *
 * Elle n'avait aucun test E2E alors qu'elle est joignable depuis TOUTES les
 * pages, sur les deux tailles d'écran, et qu'elle est l'une des rares surfaces
 * publiques vraiment interactives. Le composant est couvert en jsdom
 * (`search-bar.test.tsx`), mais jsdom n'implémente pas `<dialog>` : la palette
 * y est ouverte à la main par un repli (`d.setAttribute("open")`, cf.
 * SearchBar). Or c'est justement le `<dialog>` natif qui porte l'inertie de la
 * page, l'Échap et la RESTITUTION DU FOCUS — les trois choses pour lesquelles
 * ce pattern a été choisi. Elles ne se vérifient qu'ici.
 *
 * AGNOSTIQUE AUX DONNÉES, et testable dès aujourd'hui sans base : la palette
 * fusionne l'index STATIQUE du code avec les sources base
 * (`buildSearchList`, `site-search.ts`). Sans Postgres, les deux appels API
 * renvoient `[]` et l'index statique répond seul — c'est exactement le repli
 * prévu, et il vaut la peine d'être gardé.
 */

/** Un terme de l'index STATIQUE (pages du site), donc toujours répondant. */
const TERME = "conduite";
const CIBLE = "/code-de-conduite";

/** La loupe VISIBLE : le header en pose deux (desktop et mobile). */
const loupe = (page: Page) =>
  page.getByRole("button", { name: /^Rechercher/ }).filter({ visible: true });

const palette = (page: Page) => page.getByRole("dialog", { name: /rechercher sur le site/i });
const champ = (page: Page) => page.getByRole("combobox", { name: /rechercher sur le site/i });

test.describe("Recherche du site", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("la loupe ouvre la palette et donne le focus au champ", async ({ page }) => {
    await expect(palette(page)).toBeHidden();
    await loupe(page).click();
    await expect(palette(page)).toBeVisible();
    await expect(champ(page)).toBeFocused();
  });

  test("saisir un terme remonte des résultats, et les annonce", async ({ page }) => {
    await loupe(page).click();
    await champ(page).fill(TERME);

    const options = palette(page).getByRole("option");
    await expect(options.first()).toBeVisible();
    const nombre = await options.count();

    // Le nombre est ANNONCÉ : la listbox qui se remplit ne l'est pas d'elle-même.
    await expect(palette(page).getByRole("status")).toHaveText(
      new RegExp(`^${nombre} résultats?$`),
    );
    // On voit POURQUOI le résultat remonte : le terme cherché est dans ce que
    // l'option affiche. (Le surlignage `<mark>` ne concerne que l'EXTRAIT ; un
    // résultat trouvé par son titre n'en porte pas — c'est `makeSnippet` qui
    // est en charge, et il a ses propres tests.)
    await expect(options.first()).toContainText(new RegExp(TERME, "i"));
  });

  test("le clavier seul parcourt les résultats et ouvre le bon", async ({ page }) => {
    await loupe(page).click();
    await champ(page).fill(TERME);
    await expect(palette(page).getByRole("option").first()).toBeVisible();

    // La sélection se lit sur `aria-activedescendant` (le focus reste au champ).
    await page.keyboard.press("ArrowDown");
    const premiere = palette(page).getByRole("option").first();
    await expect(premiere).toHaveAttribute("aria-selected", "true");

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`${CIBLE}$`));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("Échap ferme la palette et rend le focus à la loupe", async ({ page }) => {
    await loupe(page).click();
    await expect(palette(page)).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(palette(page)).toBeHidden();
    // La restitution du focus est la raison d'être du `<dialog>` natif ici :
    // sans elle, la navigation clavier repart du haut de la page.
    await expect(loupe(page)).toBeFocused();
  });

  test("une recherche sans réponse le dit, sans laisser la liste ouverte", async ({
    page,
  }) => {
    await loupe(page).click();
    await champ(page).fill("zzzzzzqwxyz");
    await expect(palette(page).getByText(/aucun résultat pour/i)).toBeVisible();
    await expect(palette(page).getByRole("option")).toHaveCount(0);
    // La porte de sortie reste offerte même quand rien ne répond.
    await expect(
      palette(page).getByRole("link", { name: /voir toutes les actualités/i }),
    ).toBeVisible();
  });

  test("la palette s'ouvre depuis n'importe quelle page", async ({ page }) => {
    await page.goto("/mentions-legales");
    await loupe(page).click();
    await expect(palette(page)).toBeVisible();
  });
});
