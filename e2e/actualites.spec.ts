import { test, expect } from "@playwright/test";

/**
 * Agnostique aux données : la liste est alimentée par la base, vide en CI. On
 * garde-fou le SHELL (filtres, région de liste, interaction) sans dépendre d'un
 * contenu seedé. Le comportement piloté par les données est couvert en unitaire
 * (actualites-page.test.tsx) et en intégration (contenus-db.integration.test.ts).
 */
test.describe("Page actualités", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/actualites");
  });

  test("affiche les filtres de catégorie", async ({ page }) => {
    // Des boutons à deux états dans un groupe étiqueté, pas des onglets : le
    // motif `tablist`/`tab` promettrait un clavier (flèches, tabpanel) absent.
    const groupe = page.getByRole("group", { name: /catégorie/i });
    await expect(groupe).toBeVisible();
    await expect(groupe.getByRole("button", { name: "Tout" })).toBeVisible();
    await expect(groupe.getByRole("button", { name: "Tremplin" })).toBeVisible();
    // La région de liste est présente (contenu selon la base).
    await expect(page.locator("section[aria-label='Liste des actualités']")).toBeVisible();
  });

  test("sélectionner une catégorie l'enfonce, et relâche « Tout »", async ({ page }) => {
    const groupe = page.getByRole("group", { name: /catégorie/i });
    const tremplin = groupe.getByRole("button", { name: "Tremplin" });
    await tremplin.click();
    await expect(tremplin).toHaveAttribute("aria-pressed", "true");
    await expect(groupe.getByRole("button", { name: "Tout" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  test("annonce le résultat du filtrage dans une région de statut", async ({ page }) => {
    // Présente dès le premier rendu, quel que soit le contenu de la base : une
    // région insérée après coup n'est pas annoncée de façon fiable.
    await expect(page.getByRole("status")).toBeAttached();
  });

  test("les liens externes s'ouvrent dans un nouvel onglet", async ({ page }) => {
    const externalLinks = page.locator("section[aria-label='Liste des actualités'] a[target='_blank']");
    const count = await externalLinks.count();
    for (let i = 0; i < count; i++) {
      await expect(externalLinks.nth(i)).toHaveAttribute("rel", /noopener/);
    }
  });
});
