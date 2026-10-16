import { test, expect } from "@playwright/test";

/**
 * Smoke de CONCURRENCE (montée de charge, version automatisable en CI) :
 * plusieurs requêtes simultanées sur les pages publiques doivent toutes
 * répondre 200. Reproduit, à petite échelle et sans infra externe, le cas
 * « plusieurs personnes ouvrent la même page en même temps » (ex. la veille
 * d'un atelier). Ce n'est PAS un test de débit fin (k6/artillery contre un
 * déploiement, avec base réelle) : ici on garde-fou l'absence de casse sous
 * accès concurrents, en CI.
 */

const RAFALE = 20;

test.describe("Concurrence — pages publiques sous accès simultanés", () => {
  test(`${RAFALE} requêtes simultanées sur /speakeuses (chemin BDD) → toutes 200`, async ({
    request,
  }) => {
    const reps = await Promise.all(
      Array.from({ length: RAFALE }, () => request.get("/speakeuses")),
    );
    for (const r of reps) expect(r.status()).toBe(200);
  });

  test(`${RAFALE} requêtes simultanées sur / (accueil) → toutes 200`, async ({
    request,
  }) => {
    const reps = await Promise.all(
      Array.from({ length: RAFALE }, () => request.get("/")),
    );
    for (const r of reps) expect(r.status()).toBe(200);
  });

  test("rafale mixte multi-pages en parallèle → toutes 200", async ({ request }) => {
    const chemins = ["/", "/speakeuses", "/tremplin", "/actualites", "/contact"];
    // Chaque page demandée en parallèle, 4 fois : mélange réaliste de trafic.
    const reps = await Promise.all(
      Array.from({ length: 4 }, () => chemins)
        .flat()
        .map((c) => request.get(c)),
    );
    for (const r of reps) expect(r.status()).toBe(200);
  });
});
