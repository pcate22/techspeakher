import { test, expect, type Page } from "@playwright/test";
import { exigerDecor } from "./decor";
import { seConnecter } from "./session";
import {
  creerMembre,
  effacerMembre,
  fermerBase,
  pool,
  type MembreJetable,
} from "./comptes-jetables";

/**
 * L'inscription express de bout en bout : un compte sans fiche arrive sur
 * Bienvenue, donne son nom, choisit deux thèmes dans deux catégories et publie.
 * Le statut dépend du nom : celui du compte garde la fiche en ligne tout de
 * suite, un nom retapé la fait relire. Les deux cas se jouent ici parce que la
 * décision se prend côté serveur, à partir du nom lu en base : aucun test
 * unitaire ne voit le formulaire, l'action et la redirection ensemble.
 *
 * Chaque test a son compte jetable, créé sans fiche (`fiche: "aucune"`).
 */

let jetable: MembreJetable | null = null;

test.beforeEach(async ({ request }) => {
  await exigerDecor(request);
});

test.afterEach(async () => {
  await effacerMembre(jetable);
  jetable = null;
});

test.afterAll(async () => {
  await fermerBase();
});

/** Les boutons de catégorie et les cases sont pilotés par React : on attend qu'il ait repris la main. */
async function attendreHydratation(page: Page) {
  await page.waitForFunction(() => {
    const el = document.querySelector("#bienvenue-nom");
    return !!el && Object.keys(el).some((k) => k.startsWith("__react"));
  });
}

/**
 * Un clic puis une attente, plutôt que `check()` : la case est contrôlée par
 * React, et `check()` relit son état dans la foulée du clic, avant le rendu
 * qui la coche. Sous charge, il conclut à tort que le clic n'a rien fait.
 */
async function cocher(page: Page, theme: string) {
  const caseTheme = page.getByRole("checkbox", { name: theme });
  await caseTheme.click();
  await expect(caseTheme).toBeChecked();
}

async function remplirBienvenue(page: Page, nom: string) {
  await page.goto("/mon-espace");
  await expect(page).toHaveURL(/\/mon-espace\/bienvenue$/);
  await attendreHydratation(page);

  const champ = page.getByLabel("Comment t'appelles-tu ?");
  await champ.fill(nom);
  await page.getByRole("button", { name: "Continuer" }).click();

  await expect(page.getByRole("heading", { name: "De quoi parles-tu ?" })).toBeVisible();
  await page.getByRole("button", { name: "Développement", exact: true }).click();
  await cocher(page, "Back-end");
  await page.getByRole("button", { name: "Design", exact: true }).click();
  await cocher(page, "Accessibilité");
  await expect(page.getByText("Tes thèmes (2) : Back-end, Accessibilité")).toBeVisible();

  await page.getByRole("button", { name: "Publier ma fiche" }).click();
}

async function ficheEnBase(userId: number) {
  const { rows } = await pool().query(
    `SELECT status, sujets FROM speaker_profiles WHERE "userId" = $1`,
    [userId],
  );
  return rows[0] as { status: string; sujets: string[] } | undefined;
}

test("nom du compte gardé : la fiche est en ligne, puis un talk avec son titre seul", async ({
  page,
  context,
}) => {
  jetable = await creerMembre({ nom: "Inès Express" });
  await seConnecter(context, { id: jetable.userId });

  await remplirBienvenue(page, "Inès Express");

  await expect(page).toHaveURL(/\/mon-espace\?ok=fiche_publiee$/);
  await expect(page.getByText("Ta fiche est en ligne.")).toBeVisible();
  const fiche = await ficheEnBase(jetable.userId);
  expect(fiche?.status).toBe("publie");
  expect([...(fiche?.sujets ?? [])].sort()).toEqual(["Accessibilité", "Back-end"]);

  await page.getByRole("link", { name: "Ajoute un talk" }).click();
  await expect(page).toHaveURL(/\/mon-espace\/talks\/nouveau$/);
  await page.getByLabel("Titre du talk").fill("Mon premier talk express");
  await page.getByRole("button", { name: "Enregistrer" }).click();

  await expect(page).toHaveURL(/\/mon-espace\/talks\/\d+$/);
  await expect(page.getByText("Mon premier talk express").first()).toBeVisible();
});

test("nom retapé : la fiche part en relecture", async ({ page, context }) => {
  jetable = await creerMembre({ nom: "Jeanne Compte" });
  await seConnecter(context, { id: jetable.userId });

  await remplirBienvenue(page, "Jeanne Scène");

  await expect(page).toHaveURL(/\/mon-espace\?ok=fiche_envoyee$/);
  await expect(page.getByText("Ta fiche est envoyée.", { exact: false })).toBeVisible();
  expect((await ficheEnBase(jetable.userId))?.status).toBe("en_attente");
});
