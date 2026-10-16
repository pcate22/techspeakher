import { test, expect } from "@playwright/test";
import { exigerDecor, COMPTES } from "./decor";
import { seConnecter } from "./session";
import {
  creerMembre,
  effacerMembre,
  statutFiche,
  compteExiste,
  fermerBase,
  type MembreJetable,
} from "./comptes-jetables";

/**
 * LES PARCOURS QUI ÉCRIVENT — les premiers de la suite.
 *
 * 106 Server Actions, aucune jamais exécutée de bout en bout : c'était le plus
 * gros trou de l'audit (`docs/audit-e2e-parcours-2026-08.md`). On l'ouvre par
 * les deux écritures dont une régression coûterait le plus cher, et on les
 * couvre par PARCOURS — pas action par action, ni page par page.
 *
 * CHAQUE PARCOURS SUR SON PROPRE COMPTE (`e2e/comptes-jetables.ts`). Écrire dans
 * le décor partagé rendrait la suite dépendante de l'ordre d'exécution : publier
 * la fiche en attente ferait tomber `annuaire.spec.ts` au passage suivant, et
 * personne ne comprendrait pourquoi.
 *
 * ON VÉRIFIE EN BASE, PAS À L'ÉCRAN. Une page peut afficher « c'est fait »
 * pendant que l'écriture a échoué — c'est précisément le genre de panne qu'un
 * test de rendu laisse passer. Les assertions qui comptent lisent Postgres.
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

test.describe("Supprimer son compte (RGPD)", () => {
  /**
   * Irréversible, et c'est un DROIT : si l'effacement échoue en silence, la
   * personne croit ses données parties alors qu'elles sont toujours là.
   *
   * Le refus d'une mauvaise confirmation côté SERVEUR est déjà couvert en
   * unitaire (`actions-espace.test.ts`) — on ne le rejoue pas ici. Ce que seul
   * ce niveau voit : la ligne disparaît vraiment de la base, et la session
   * tombe avec elle.
   */
  test("le compte et sa fiche disparaissent réellement de la base", async ({
    context,
    page,
  }) => {
    jetable = await creerMembre({ nom: "Alexandra Test", fiche: "prete" });
    await seConnecter(context, { id: jetable.userId });

    await page.goto("/mon-espace/supprimer");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // Le geste réel : ouvrir la confirmation, réécrire son nom, valider.
    await page.getByRole("button", { name: /supprimer (mon |ton )?compte/i }).first().click();
    const champ = page.getByLabel(/réécris ton nom|réécris ton adresse/i);
    await expect(champ).toBeVisible();
    await champ.fill(jetable.nom);
    await page.getByRole("button", { name: /supprimer définitivement/i }).click();

    // On atterrit déconnectée, avec l'accusé de réception.
    await expect(page).toHaveURL(/\/connexion/);

    // LA VÉRITÉ EST EN BASE. Sans cette assertion, une action qui redirige sans
    // rien effacer passerait pour un succès.
    await expect
      .poll(() => compteExiste(jetable!.userId), { timeout: 10_000 })
      .toBe(false);
    expect(await statutFiche(jetable.userId)).toBeNull();
  });

  test("une saisie qui ne correspond pas laisse le compte intact", async ({
    context,
    page,
  }) => {
    jetable = await creerMembre({ nom: "Brigitte Test", fiche: "prete" });
    await seConnecter(context, { id: jetable.userId });

    await page.goto("/mon-espace/supprimer");
    await page.getByRole("button", { name: /supprimer (mon |ton )?compte/i }).first().click();
    await page.getByLabel(/réécris ton nom|réécris ton adresse/i).fill("n'importe quoi");

    // Le verrou tient à l'écran : le bouton refuse de partir.
    await expect(
      page.getByRole("button", { name: /supprimer définitivement/i }),
    ).toHaveAttribute("aria-disabled", "true");

    expect(await compteExiste(jetable.userId)).toBe(true);
  });
});

test.describe("Le parcours central : de la fiche à l'annuaire", () => {
  /**
   * LE SEUL PARCOURS QUI TRAVERSE LES TROIS RÔLES, et le cœur du produit : une
   * membre soumet sa fiche, une orga la valide, elle paraît dans l'annuaire
   * public. Trois espaces, deux Server Actions, une invariante de
   * confidentialité — et rien ne le suivait de bout en bout.
   *
   * Chaque étape est vérifiée EN BASE puis à l'écran, parce que les deux peuvent
   * diverger : une fiche marquée publiée qui ne paraît pas, ou l'inverse.
   */
  test("soumettre, faire valider, et paraître dans l'annuaire", async ({
    context,
    page,
    browser,
  }) => {
    jetable = await creerMembre({ nom: "Clémence Test", fiche: "prete" });
    expect(await statutFiche(jetable.userId)).toBe("brouillon");

    // ── 1. La membre soumet sa fiche ────────────────────────────────────────
    await seConnecter(context, { id: jetable.userId });
    await page.goto("/mon-espace/fiche");
    await page.getByRole("button", { name: /soumettre/i }).first().click();

    await expect
      .poll(() => statutFiche(jetable!.userId), { timeout: 10_000 })
      .toBe("en_attente");

    // Tant qu'elle attend, elle reste INVISIBLE du public : c'est la promesse
    // faite à toute personne qui remplit une fiche.
    const anonyme = await browser.newContext();
    const vueAnonyme = await anonyme.newPage();
    await vueAnonyme.goto("/speakeuses");
    await expect(vueAnonyme.getByText(jetable.nom)).toHaveCount(0);

    // ── 2. L'orga la valide depuis la fiche ─────────────────────────────────
    const cotéOrga = await browser.newContext();
    await seConnecter(cotéOrga, COMPTES.orga);
    const vueOrga = await cotéOrga.newPage();
    await vueOrga.goto(`/speakeuses/${jetable.profileId}`);
    await vueOrga.getByRole("button", { name: /^Publier$/ }).click();

    await expect
      .poll(() => statutFiche(jetable!.userId), { timeout: 10_000 })
      .toBe("publie");

    // ── 3. Elle paraît dans l'annuaire public ───────────────────────────────
    await vueAnonyme.goto("/speakeuses");
    await expect(vueAnonyme.getByText(jetable.nom).first()).toBeVisible();

    // Et son adresse reste hors de la page, publiée ou non.
    expect(await vueAnonyme.content()).not.toContain(jetable.email);

    await anonyme.close();
    await cotéOrga.close();
  });
});
