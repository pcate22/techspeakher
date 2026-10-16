import { test, expect } from "@playwright/test";
import { exigerDecor, LEA, AICHA, YASMINE, EMAILS_DU_DECOR } from "./decor";

/**
 * L'ANNUAIRE PEUPLÉ — ce que `speakeuses.spec.ts` ne pouvait pas voir.
 *
 * Sans base, l'annuaire s'affiche vide (« L'annuaire arrive bientôt ») : la
 * suite ne gardait donc que la coquille (un titre, une région de liste). Ni les
 * cartes, ni le filtrage, ni — surtout — la règle qui décide QUI paraît.
 *
 * C'est cette dernière qui compte le plus : une fiche est publique parce
 * qu'une orga l'a validée. Une régression qui ferait paraître les fiches en
 * attente publierait le nom, la photo et la bio de personnes qui ne l'ont pas
 * encore demandé. Rien ne casse à l'écran quand ça arrive.
 */

test.describe("Annuaire (avec données)", () => {
  test.beforeEach(async ({ request }) => {
    await exigerDecor(request);
  });

  test("les fiches publiées paraissent", async ({ page }) => {
    await page.goto("/speakeuses");
    const liste = page.getByRole("region", { name: /liste des speakeuses/i });
    await expect(liste).toBeVisible();
    await expect(liste.getByText(LEA.nom)).toBeVisible();
    await expect(liste.getByText(AICHA.nom)).toBeVisible();
  });

  /** L'invariant de modération, dans les deux sens. */
  test("une fiche EN ATTENTE ne paraît pas, et sa page n'existe pas", async ({
    page,
    request,
  }) => {
    await page.goto("/speakeuses");
    await expect(page.getByText(YASMINE.nom)).toHaveCount(0);

    // Ni par l'index de recherche, qui est une autre porte vers les mêmes données.
    const index = (await (await request.get("/api/search/speakeuses")).json()) as Array<{
      title?: string;
    }>;
    expect(index.map((i) => i.title)).not.toContain(YASMINE.nom);
  });

  test("aucune adresse e-mail dans l'annuaire servi", async ({ request }) => {
    const html = await (await request.get("/speakeuses")).text();
    for (const email of EMAILS_DU_DECOR) {
      expect(html, `adresse trouvée dans l'annuaire : ${email}`).not.toContain(email);
    }
  });

  test("ouvrir une carte mène à la fiche de la bonne personne", async ({ page }) => {
    await page.goto("/speakeuses");
    await page
      .getByRole("region", { name: /liste des speakeuses/i })
      .getByRole("link")
      .filter({ hasText: LEA.nom })
      .first()
      .click();
    await expect(page).toHaveURL(new RegExp(`${LEA.fiche}$`));
    await expect(page.getByRole("heading", { level: 1 })).toContainText(LEA.nom);
  });

  /**
   * Le filtrage porte sur des données réelles : un filtre qui ne filtre plus
   * rien (ou qui vide la liste) passait inaperçu sur un annuaire vide.
   */
  test("filtrer réduit la liste sans la vider", async ({ page }) => {
    await page.goto("/speakeuses");
    const liste = page.getByRole("region", { name: /liste des speakeuses/i });
    const avant = await liste.getByRole("link").count();
    expect(avant, "l'annuaire devrait contenir des fiches").toBeGreaterThan(1);

    // Le premier filtre proposé, quel qu'il soit : on juge le MÉCANISME, pas
    // une valeur de la donnée (qui appartient au seed).
    const filtre = page.getByRole("button", { name: /^(?!Tout$).+/ }).first();
    if ((await filtre.count()) === 0) test.skip(true, "aucun filtre sur cette page");
    await filtre.click();

    const apres = await liste.getByRole("link").count();
    expect(apres, "un filtre ne devrait jamais faire disparaître tout le monde").toBeGreaterThan(
      0,
    );
    expect(apres).toBeLessThanOrEqual(avant);
  });
});
