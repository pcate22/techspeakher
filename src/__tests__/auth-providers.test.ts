import { describe, it, expect, afterEach } from "vitest";
import {
  buildProviders,
  isGoogleEnabled,
  isLinkedInEnabled,
} from "@/auth.config";

/**
 * On n'active un provider OAuth que si ses variables d'env sont présentes.
 * Sinon Auth.js renvoie une erreur « Configuration » pour TOUTES les requêtes
 * (un provider sans clientId/secret fait échouer la validation globale).
 */
describe("buildProviders — providers selon l'environnement", () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });

  it("aucun provider si aucune variable n'est définie", () => {
    delete process.env.AUTH_GOOGLE_ID;
    delete process.env.AUTH_GOOGLE_SECRET;
    delete process.env.AUTH_LINKEDIN_ID;
    delete process.env.AUTH_LINKEDIN_SECRET;
    expect(buildProviders()).toHaveLength(0);
  });

  it("active Google seul si seules les variables Google sont définies", () => {
    process.env.AUTH_GOOGLE_ID = "gid";
    process.env.AUTH_GOOGLE_SECRET = "gsecret";
    delete process.env.AUTH_LINKEDIN_ID;
    delete process.env.AUTH_LINKEDIN_SECRET;
    expect(buildProviders()).toHaveLength(1);
  });

  it("active Google + LinkedIn si les deux sont configurés", () => {
    process.env.AUTH_GOOGLE_ID = "gid";
    process.env.AUTH_GOOGLE_SECRET = "gsecret";
    process.env.AUTH_LINKEDIN_ID = "lid";
    process.env.AUTH_LINKEDIN_SECRET = "lsecret";
    expect(buildProviders()).toHaveLength(2);
  });

  it("isGoogleEnabled / isLinkedInEnabled reflètent les variables d'env", () => {
    process.env.AUTH_GOOGLE_ID = "gid";
    process.env.AUTH_GOOGLE_SECRET = "gsecret";
    delete process.env.AUTH_LINKEDIN_ID;
    delete process.env.AUTH_LINKEDIN_SECRET;
    expect(isGoogleEnabled()).toBe(true);
    expect(isLinkedInEnabled()).toBe(false);
  });

  it("isGoogleEnabled false si le secret manque", () => {
    process.env.AUTH_GOOGLE_ID = "gid";
    delete process.env.AUTH_GOOGLE_SECRET;
    expect(isGoogleEnabled()).toBe(false);
  });
});
