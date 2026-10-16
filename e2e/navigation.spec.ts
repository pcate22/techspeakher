import { test, expect, type Page } from "@playwright/test";

async function openMobileMenuIfNeeded(page: Page) {
  const burger = page.getByRole("button", { name: /ouvrir le menu/i });
  if (await burger.isVisible()) await burger.click();
}

const pages = [
  { path: "/", title: "Tech Speak'Her" },
  { path: "/a-propos", title: "À propos" },
  { path: "/tremplin", title: "Tremplin" },
  { path: "/speakeuses", title: "Annuaire" },
  { path: "/agenda", title: "Agenda" },
  { path: "/actualites", title: "Actualités" },
  { path: "/partenaires", title: "Partenaires" },
  { path: "/kit-de-communication", title: "Kit de communication" },
  { path: "/contact", title: "Contact" },
  { path: "/mentions-legales", title: "Mentions légales" },
  { path: "/code-de-conduite", title: "Code de conduite" },
  { path: "/adherer", title: "Adhérer" },
  { path: "/benevole", title: "Devenir bénévole" },
];

/**
 * Un titre se reconnaît à ses MOTS, pas au caractère d'espace qui les sépare :
 * « Tech Speak'Her » porte une insécable pour ne pas se couper en fin de ligne,
 * et les libellés à venir en porteront d'autres. `\s` couvre les deux (U+00A0
 * compris) ; les métacaractères de l'intitulé sont échappés au passage.
 */
const motsDuTitre = (titre: string) =>
  new RegExp(titre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"), "i");

test.describe("Navigation entre les pages", () => {
  for (const page of pages) {
    test(`${page.path} se charge et contient le titre`, async ({ page: p }) => {
      const response = await p.goto(page.path);
      expect(response?.status()).toBe(200);
      await expect(p).toHaveTitle(motsDuTitre(page.title));
    });
  }

  test("la page 404 affiche un message d'erreur", async ({ page }) => {
    await page.goto("/page-inexistante");
    await expect(page.getByText("Page introuvable")).toBeVisible();
    await expect(page.getByRole("link", { name: /retour à l'accueil/i })).toBeVisible();
  });

  test("le header contient tous les liens de navigation", async ({ page }) => {
    await page.goto("/");
    await openMobileMenuIfNeeded(page);
    const nav = page.getByRole("navigation").last();
    // « À propos » vit au pied de page depuis le 2026-10-15.
    await expect(nav.getByRole("link", { name: /à propos/i })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: /tremplin/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /^speakeuses$/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /actualités/i })).toBeVisible();
    // Les façons de s'engager vivent sous « Nous rejoindre » (2026-10-15) :
    // un menu déroulant sur ordinateur, un groupe titré dans le tiroir mobile.
    const rejoindre = nav.getByRole("button", { name: "Nous rejoindre" });
    if (await rejoindre.isVisible()) await rejoindre.click();
    await expect(nav.getByRole("link", { name: /adhérer/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /devenir bénévole/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /devenir partenaire/i })).toBeVisible();
  });

  test("cliquer sur un lien du header navigue vers la bonne page", async ({ page }) => {
    await page.goto("/");
    await openMobileMenuIfNeeded(page);
    const nav = page.getByRole("navigation").last();
    await nav.getByRole("link", { name: /^agenda$/i }).click();
    await expect(page).toHaveURL("/agenda");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("le footer contient les liens de navigation et mentions légales", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator("footer");
    await expect(footer.getByRole("link", { name: /mentions légales/i })).toBeVisible();
    await expect(footer.getByRole("link", { name: /linkedin/i })).toBeVisible();
  });

  test("le lien skip-to-content fonctionne au focus", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: /aller au contenu principal/i });
    await expect(skipLink).toBeFocused();
  });

  test("/code-de-conduite a les landmarks RGAA requis", async ({ page }) => {
    await page.goto("/code-de-conduite");
    await expect(page.getByRole("heading", { level: 1, name: /code de conduite/i })).toBeVisible();
    // Liste des règles (le fil d'Ariane ajoute aussi une liste dans <main>).
    await expect(
      page.getByRole("region", { name: /les règles/i }).getByRole("list"),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: /un problème/i })).toBeVisible();
  });

  test("/connexion mène à la page d'adhésion", async ({ page }) => {
    await page.goto("/connexion");
    await expect(page.getByRole("main").getByRole("link", { name: /adhérer/i })).toHaveAttribute("href", "/adherer");
  });

  test("/a-propos mène à la page d'adhésion", async ({ page }) => {
    await page.goto("/a-propos");
    await expect(page.getByRole("main").getByRole("link", { name: "adhésion", exact: true })).toHaveAttribute("href", "/adherer");
  });

  test("la page /tremplin contient un lien vers la charte", async ({ page }) => {
    await page.goto("/tremplin");
    await expect(page.locator("main").getByRole("link", { name: /code de conduite/i })).toBeVisible();
  });

  test("la page /actualites contient un lien vers la charte", async ({ page }) => {
    await page.goto("/actualites");
    await expect(page.locator("main").getByRole("link", { name: /code de conduite/i })).toBeVisible();
  });

  test("la page /a-propos contient un lien vers la charte", async ({ page }) => {
    await page.goto("/a-propos");
    await expect(page.locator("main").getByRole("link", { name: /code de conduite/i })).toBeVisible();
  });
});
