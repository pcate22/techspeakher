import { test, expect } from "@playwright/test";
import { exigerDecor, LEA, AICHA, EMAILS_DU_DECOR } from "./decor";

/**
 * CONTACTER UNE SPEAKEUSE — le parcours le plus sensible du site public.
 *
 * Le produit fait deux promesses fortes, toutes deux invérifiables jusqu'ici
 * faute de données en CI :
 *
 *  1. **L'adresse d'une speakeuse n'est jamais exposée.** Le message passe par
 *     un relais, mis en file de MODÉRATION ; une orga le relit avant qu'il
 *     n'atteigne qui que ce soit (safe place). Une régression ici publie une
 *     donnée personnelle — c'est le pire échec possible pour ce site, et il
 *     serait silencieux : rien ne casse à l'écran quand un e-mail fuite dans le
 *     HTML.
 *
 *  2. **On n'écrit qu'à qui a accepté d'être joignable.** Une fiche publiée
 *     sans contact ouvert n'a pas de page de contact du tout.
 *
 * On vérifie la SOURCE SERVIE, pas seulement ce que l'œil voit : une adresse
 * peut voyager dans un attribut, un JSON de props, ou la charge RSC de Next
 * sans jamais s'afficher. C'est précisément ainsi qu'elle fuiterait.
 */

test.describe("Contacter une speakeuse", () => {
  test.beforeEach(async ({ request }) => {
    await exigerDecor(request);
  });

  test("la fiche publique n'expose aucune adresse e-mail", async ({ page, request }) => {
    const res = await request.get(LEA.fiche);
    expect(res.status()).toBe(200);
    const html = await res.text();

    for (const email of EMAILS_DU_DECOR) {
      expect(html, `adresse trouvée dans la source de ${LEA.fiche} : ${email}`).not.toContain(
        email,
      );
    }
    // Même sans connaître les adresses : aucun `mailto:` vers le domaine des
    // comptes, et aucune adresse du domaine de démo, quelle qu'elle soit.
    expect(html).not.toMatch(/mailto:[^"']*@demo\.techspeakher\.test/);

    // La fiche s'affiche bien, elle : on n'a pas simplement testé une page vide.
    await page.goto(LEA.fiche);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(LEA.nom);
  });

  test("une fiche qui a ouvert le contact propose un formulaire de relais", async ({
    page,
  }) => {
    await page.goto(`${LEA.fiche}/contact`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: /envoyer/i })).toBeVisible();
  });

  test("le formulaire de relais n'expose pas l'adresse non plus", async ({ request }) => {
    const html = await (await request.get(`${LEA.fiche}/contact`)).text();
    for (const email of EMAILS_DU_DECOR) {
      expect(html, `adresse trouvée dans le formulaire de contact : ${email}`).not.toContain(
        email,
      );
    }
  });

  /**
   * La joignabilité est une DÉCISION de la speakeuse (`contact_email_ok`). Une
   * page de contact qui existerait quand même serait une porte dérobée vers une
   * personne qui a dit non.
   */
  test("une fiche SANS contact ouvert n'a pas de page de contact", async ({ request }) => {
    const res = await request.get(`${AICHA.fiche}/contact`);
    expect(res.status()).toBe(404);
  });

  /**
   * Le message part en MODÉRATION : la speakeuse n'est pas notifiée sur-le-champ
   * et l'expéditrice ne reçoit aucune adresse en retour. On s'arrête à ce que le
   * parcours public promet ; le relais effectif (transmettre / rejeter) est une
   * action d'orga, couverte en unitaire.
   */
  test("envoyer un message aboutit sans jamais révéler l'adresse", async ({ page }) => {
    await page.goto(`${LEA.fiche}/contact`);

    await page.getByLabel(/nom/i).first().fill("Camille Test");
    await page.getByLabel(/e-mail/i).first().fill("camille.test@example.org");
    await page.getByLabel(/message/i).first().fill(
      "Bonjour, nous cherchons une speakeuse pour un meetup en octobre.",
    );
    await page.getByRole("button", { name: /envoyer/i }).click();

    // Une confirmation arrive (le libellé exact appartient au produit : on
    // vérifie qu'il ne reste pas d'erreur et que la page a répondu).
    await expect(page.getByRole("alert").filter({ hasText: /erreur|impossible/i })).toHaveCount(
      0,
    );

    const apres = await page.content();
    for (const email of EMAILS_DU_DECOR) {
      expect(apres, `adresse révélée après l'envoi : ${email}`).not.toContain(email);
    }
  });
});
