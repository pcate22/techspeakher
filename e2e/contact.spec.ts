import { test, expect } from "@playwright/test";

test.describe("Page contact", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/contact");
  });

  test("affiche le formulaire de contact", async ({ page }) => {
    await expect(page.getByLabel(/nom/i)).toBeVisible();
    await expect(page.getByLabel(/e-mail/i)).toBeVisible();
    await expect(page.getByLabel(/sujet/i)).toBeVisible();
    await expect(page.getByLabel(/message/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /envoyer/i })).toBeVisible();
  });

  test("affiche les erreurs de validation si soumission vide", async ({ page }) => {
    await page.getByRole("button", { name: /envoyer/i }).click();

    // Erreurs visibles
    await expect(page.getByText(/le nom est obligatoire/i)).toBeVisible();
    await expect(page.getByText(/l'e-mail est obligatoire/i)).toBeVisible();
    await expect(page.getByText(/le message est obligatoire/i)).toBeVisible();

    // Bandeau d'erreur avec role=alert
    await expect(page.getByText(/veuillez corriger/i)).toBeVisible();
  });

  test("valide le format de l'e-mail", async ({ page }) => {
    await page.getByLabel(/nom/i).fill("Test");
    await page.getByLabel(/e-mail/i).fill("pas-un-email");
    await page.getByLabel(/message/i).fill("Un message");
    await page.getByRole("button", { name: /envoyer/i }).click();

    await expect(page.getByText(/l'adresse e-mail n'est pas valide/i)).toBeVisible();
  });

  test("les champs en erreur ont aria-invalid", async ({ page }) => {
    await page.getByRole("button", { name: /envoyer/i }).click();

    await expect(page.getByLabel(/nom/i)).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel(/e-mail/i)).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel(/message/i)).toHaveAttribute("aria-invalid", "true");
  });
});
