import { test, expect } from "@playwright/test";

/**
 * Le carrousel de verbatims, en VRAI navigateur : jsdom ne mesure rien, donc
 * c'est ici — et seulement ici — qu'on vérifie que la piste défile pour de bon
 * et que la citation suivante arrive bien à l'écran.
 *
 * Les deux pages qui donnent la parole passent la MÊME batterie : le bloc est
 * le même composant sur la même donnée, seul l'habillage de section diffère.
 *
 * Agnostique aux données : on ne compte rien en dur, on compare les pastilles
 * aux citations présentes.
 */

const PISTE = /verbatims du premier tremplin/i;
const PAGES = ["/", "/tremplin"];

for (const chemin of PAGES) test.describe(`Verbatims — ${chemin}`, () => {
  test("une pastille par verbatim, la première à l'écran", async ({ page }) => {
    await page.goto(chemin);
    const piste = page.getByRole("group", { name: PISTE });
    const citations = piste.getByRole("listitem");
    const pastilles = page.getByRole("button", { name: /^Verbatim \d+ sur \d+$/ });
    const nombre = await citations.count();
    expect(nombre).toBeGreaterThan(1);
    await expect(pastilles).toHaveCount(nombre);
    await expect(page.getByRole("status")).toHaveText(`Verbatim 1 sur ${nombre}`);
  });

  test("la flèche fait défiler la piste jusqu'au verbatim suivant", async ({ page }) => {
    await page.goto(chemin);
    const piste = page.getByRole("group", { name: PISTE });
    const depart = await piste.evaluate((el) => el.scrollLeft);
    expect(depart).toBe(0);

    await page.getByRole("button", { name: /verbatim suivant/i }).click();
    await expect(page.getByRole("status")).toHaveText(/Verbatim 2 sur/);
    // La piste a VRAIMENT bougé : sans ça, seules les pastilles auraient changé
    // et la citation affichée mentirait.
    await expect
      .poll(() => piste.evaluate((el) => el.scrollLeft))
      .toBeGreaterThan(0);

    await page.getByRole("button", { name: /verbatim précédent/i }).click();
    await expect(page.getByRole("status")).toHaveText(/Verbatim 1 sur/);
    await expect.poll(() => piste.evaluate((el) => el.scrollLeft)).toBe(0);
  });

  test("rien ne défile tout seul (WCAG 2.2.2)", async ({ page }) => {
    await page.goto(chemin);
    const etat = page.getByRole("status");
    await expect(etat).toHaveText(/Verbatim 1 sur/);
    // Un défilement automatique volerait la lecture d'une citation en cours :
    // deux secondes plus tard, on est toujours sur le même verbatim.
    await page.waitForTimeout(2000);
    await expect(etat).toHaveText(/Verbatim 1 sur/);
  });

  test("la piste défile au clavier, sans souris ni doigt", async ({ page }) => {
    await page.goto(chemin);
    const piste = page.getByRole("group", { name: PISTE });
    await piste.focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("status")).toHaveText(/Verbatim 2 sur/);
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByRole("status")).toHaveText(/Verbatim 1 sur/);
  });
});
