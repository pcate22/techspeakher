import { defineConfig, devices } from "@playwright/test";
import { E2E_AUTH_SECRET } from "./e2e/session";

/**
 * Specs INDÉPENDANTES DU VIEWPORT : elles n'ouvrent aucune page (fixture
 * `request`) ou ne jugent que des codes HTTP et des en-têtes. Les rejouer en
 * « mobile » double le coût pour un signal strictement identique — même
 * raisonnement que le `testInfo.skip` déjà posé dans `mots-colles.spec.ts`.
 */
const INDEPENDANT_DU_VIEWPORT = [
  /concurrence\.spec\.ts/,
  /contrat-http\.spec\.ts/,
  /auth\.spec\.ts/,
  // Celui-ci en plus d'une économie : le plafond anti-abus vit dans la mémoire
  // du serveur, partagée par les deux projets. Le rejouer viderait le quota
  // d'un seau déjà consommé et ferait échouer le second passage.
  /contact-api\.spec\.ts/,
];

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      testIgnore: INDEPENDANT_DU_VIEWPORT,
    },
  ],
  webServer: {
    command: "npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    /**
     * Le serveur de test doit partager le secret des sessions avec les workers,
     * sinon les sessions fabriquées par `e2e/session.ts` sont indéchiffrables —
     * et les gardes d'accès redeviennent intestables (la panne exacte dans
     * laquelle `auth.spec.ts` a vécu jusqu'ici).
     */
    env: { ...process.env, AUTH_SECRET: E2E_AUTH_SECRET },
  },
});
