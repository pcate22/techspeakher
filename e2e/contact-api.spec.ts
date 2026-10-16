import { test, expect } from "@playwright/test";

/**
 * LES GARDE-FOUS SERVEUR de `/api/contact` — la SEULE écriture que le site
 * ouvre aux anonymes, donc sa seule surface d'abus.
 *
 * `contact.spec.ts` n'exerce que la validation CÔTÉ CLIENT : exactement celle
 * qu'un `curl` contourne. La validation serveur et le plafond anti-spam ne
 * vivaient qu'en unitaire (`contact-api.test.ts`), sur la fonction isolée —
 * jamais sur le vrai câblage HTTP, là où se décide ce qui protège la boîte de
 * l'association et son quota d'e-mails.
 *
 * Testable SANS `BREVO_API_KEY` : les deux gardes se prononcent avant tout
 * appel à Brevo. L'envoi réussi, lui, demande un bouchon (lot suivant).
 *
 * CHAQUE TEST SON IP, ET C'EST STRUCTUREL. Le compteur anti-abus est indexé sur
 * `x-forwarded-for` (`clientIp`, rate-limit.ts) et vit dans la MÉMOIRE du
 * serveur, partagée par tous les workers et tous les projets Playwright. Deux
 * tests qui partagent une IP se volent leur quota : le premier jet de ce
 * fichier plafonnait déjà en arrivant sur le projet `mobile`, parce que le
 * projet `chromium` avait épuisé le seau juste avant. Une IP par cas, et le
 * fichier est hors du projet mobile (rien ici ne dépend du viewport).
 */

const message = (extra: Record<string, unknown> = {}) => ({
  name: "Amélie",
  email: "amelie@example.org",
  subject: "general",
  message: "Bonjour, je découvre la communauté.",
  ...extra,
});

/** Une IP de documentation (RFC 5737), unique par cas de test. */
const ip = (n: number) => `203.0.113.${n}`;

const REFUS = [
  { cas: "nom vide", corps: message({ name: "" }) },
  { cas: "nom démesuré", corps: message({ name: "x".repeat(201) }) },
  { cas: "e-mail invalide", corps: message({ email: "pas-un-email" }) },
  { cas: "message vide", corps: message({ message: "   " }) },
  // Le sujet est une liste FERMÉE côté serveur : il finit dans l'objet de
  // l'e-mail envoyé à l'association.
  { cas: "sujet hors liste", corps: message({ subject: "pirate" }) },
];

test.describe("Garde-fous serveur de /api/contact", () => {
  REFUS.forEach(({ cas, corps }, i) => {
    test(`refuse ${cas} (400), même sans passer par le formulaire`, async ({ request }) => {
      const res = await request.post("/api/contact", {
        data: corps,
        headers: { "x-forwarded-for": ip(10 + i) },
      });
      expect(res.status()).toBe(400);
      expect(await res.json()).toHaveProperty("error");
    });
  });

  test("un corps qui n'est pas du JSON est refusé (400)", async ({ request }) => {
    const res = await request.post("/api/contact", {
      data: "pas du json",
      headers: { "content-type": "application/json", "x-forwarded-for": ip(50) },
    });
    expect(res.status()).toBe(400);
  });

  /**
   * Le plafond anti-spam : 5 messages par minute et par IP. Sans lui, la boîte
   * de l'association est à la merci d'un script.
   */
  test("plafonne les envois répétés (429)", async ({ request }, testInfo) => {
    // UNE IP PAR TENTATIVE. Le seau se vide au bout d'une minute, pas entre
    // deux essais : rejoué sur la MÊME IP, un second passage trouverait le
    // quota déjà consommé et échouerait sur « le premier message passe » — un
    // échec garanti, et trompeur. La CI rejoue jusqu'à deux fois (`retries`),
    // donc le cas se poserait au premier aléa.
    const envoyer = () =>
      request.post("/api/contact", {
        data: message(),
        headers: { "x-forwarded-for": ip(200 + testInfo.retry) },
      });

    const codes: number[] = [];
    for (let i = 0; i < 7; i++) codes.push((await envoyer()).status());

    expect(codes, `codes obtenus : ${codes.join(", ")}`).toContain(429);
    // Le plafond ne se déclenche pas au premier message : une visiteuse
    // légitime doit pouvoir écrire.
    expect(codes[0], `codes obtenus : ${codes.join(", ")}`).not.toBe(429);
  });
});
