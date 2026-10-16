import { describe, it, expect, afterEach, vi } from "vitest";
import { isAuthorizedCron } from "@/lib/cron-auth";

describe("isAuthorizedCron", () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });

  it("refuse si CRON_SECRET n'est pas défini, ET le dit dans les logs", () => {
    // 2026-10-15 : la variable manquait en production. Tous les crons
    // répondaient 401 sans rien écrire : la panne était invisible.
    delete process.env.CRON_SECRET;
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(isAuthorizedCron("Bearer x")).toBe(false);
    expect(err).toHaveBeenCalledWith(expect.stringContaining("CRON_SECRET absent"));
    err.mockRestore();
  });

  it("un mauvais jeton se dit aussi, sans jamais écrire le jeton reçu", () => {
    process.env.CRON_SECRET = "s3cr3t";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(isAuthorizedCron("Bearer nope")).toBe(false);
    expect(warn).toHaveBeenCalled();
    expect(String(warn.mock.calls[0][0])).not.toContain("nope");
    warn.mockRestore();
  });

  it("refuse un mauvais jeton", () => {
    process.env.CRON_SECRET = "s3cr3t";
    expect(isAuthorizedCron("Bearer nope")).toBe(false);
    expect(isAuthorizedCron(null)).toBe(false);
  });

  it("accepte le bon jeton", () => {
    process.env.CRON_SECRET = "s3cr3t";
    expect(isAuthorizedCron("Bearer s3cr3t")).toBe(true);
  });
});
