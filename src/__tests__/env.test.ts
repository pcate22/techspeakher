import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkEnv } from "@/lib/env";

const KEYS = [
  "VERCEL_ENV",
  "DATABASE_URL",
  "PREVIEW_DATABASE_URL",
  "AUTH_SECRET",
  "BREVO_API_KEY",
  "AUTH_GOOGLE_ID",
  "AUTH_GOOGLE_SECRET",
  "FLAG_ADHESIONS",
  "CRON_SECRET",
];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of KEYS) saved[k] = process.env[k];
  // Baseline non-preview par défaut (les cas preview le fixent explicitement).
  delete process.env.VERCEL_ENV;
  delete process.env.PREVIEW_DATABASE_URL;
  delete process.env.FLAG_ADHESIONS;
  delete process.env.CRON_SECRET;
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.restoreAllMocks();
});

describe("checkEnv", () => {
  it("signale les variables requises manquantes", () => {
    delete process.env.DATABASE_URL;
    delete process.env.AUTH_SECRET;
    const { missing } = checkEnv();
    expect(missing).toContain("DATABASE_URL");
    expect(missing).toContain("AUTH_SECRET");
  });

  it("signale les recommandées absentes en warning (pas en missing)", () => {
    process.env.DATABASE_URL = "postgres://x";
    process.env.AUTH_SECRET = "s";
    delete process.env.BREVO_API_KEY;
    const { missing, warnings } = checkEnv();
    expect(missing).toEqual([]);
    expect(warnings).toContain("BREVO_API_KEY");
    // Sans elle, Vercel ne peut lancer aucun cron (2026-10-15).
    expect(warnings).toContain("CRON_SECRET");
  });

  it("ne lève jamais (non bloquant) et traite le vide comme absent", () => {
    process.env.DATABASE_URL = "   ";
    process.env.AUTH_SECRET = "s";
    expect(() => checkEnv()).not.toThrow();
    expect(checkEnv().missing).toContain("DATABASE_URL");
  });

  it("en preview : exige PREVIEW_DATABASE_URL, pas DATABASE_URL (même si présente)", () => {
    process.env.VERCEL_ENV = "preview";
    process.env.AUTH_SECRET = "s";
    process.env.DATABASE_URL = "postgres://prod"; // présente mais IGNORÉE en preview
    const { missing } = checkEnv();
    expect(missing).toContain("PREVIEW_DATABASE_URL");
    expect(missing).not.toContain("DATABASE_URL");
  });

  it("en preview correctement configurée : rien ne manque", () => {
    process.env.VERCEL_ENV = "preview";
    process.env.AUTH_SECRET = "s";
    process.env.PREVIEW_DATABASE_URL = "postgres://preview";
    expect(checkEnv().missing).toEqual([]);
  });

  it("logue les feature flags actifs (visibilité au démarrage)", () => {
    process.env.DATABASE_URL = "postgres://x";
    process.env.AUTH_SECRET = "s";
    process.env.FLAG_ADHESIONS = "1";
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    checkEnv();
    expect(info).toHaveBeenCalledWith(expect.stringContaining("adhesions"));
  });
});
