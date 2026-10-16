import { test, expect } from "@playwright/test";

// L'annuaire lit la base (profils publiés). En CI il n'y a pas de base de
// données : la page s'affiche alors vide (« L'annuaire arrive bientôt »). Ces
// tests vérifient donc la structure de la page, pas un contenu précis — le
// filtrage et les cartes sont couverts par le test unitaire filters.test.tsx.
test.describe("Page speakeuses (annuaire)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/speakeuses");
  });

  test("la page annuaire se charge avec son titre et sa liste", async ({
    page,
  }) => {
    await expect(
      page.getByRole("heading", { level: 1, name: /annuaire/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: /liste des speakeuses/i }),
    ).toBeVisible();
  });

  test("propose de créer / gérer sa fiche", async ({ page }) => {
    await expect(
      page.getByRole("link", { name: /créer \/ gérer ma fiche/i }),
    ).toBeVisible();
  });
});
