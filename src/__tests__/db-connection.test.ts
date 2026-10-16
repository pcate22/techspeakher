import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolveConnectionString } from "@/lib/db";

const ENV = process.env;

beforeEach(() => {
  process.env = { ...ENV };
  delete process.env.VERCEL_ENV;
  delete process.env.PREVIEW_DATABASE_URL;
  process.env.DATABASE_URL = "postgres://prod";
});

afterEach(() => {
  process.env = ENV;
});

describe("resolveConnectionString", () => {
  it("hors preview : utilise DATABASE_URL", () => {
    expect(resolveConnectionString()).toBe("postgres://prod");
  });

  it("preview avec PREVIEW_DATABASE_URL : utilise la base de preview", () => {
    process.env.VERCEL_ENV = "preview";
    process.env.PREVIEW_DATABASE_URL = "postgres://preview-branch";
    expect(resolveConnectionString()).toBe("postgres://preview-branch");
  });

  it("preview sans PREVIEW_DATABASE_URL : JAMAIS la prod → undefined (échec fermé)", () => {
    process.env.VERCEL_ENV = "preview";
    const cs = resolveConnectionString();
    expect(cs).toBeUndefined();
    expect(cs).not.toBe("postgres://prod"); // une preview ne tape jamais en prod
  });

  it("production : ignore PREVIEW_DATABASE_URL même si définie", () => {
    process.env.VERCEL_ENV = "production";
    process.env.PREVIEW_DATABASE_URL = "postgres://preview-branch";
    expect(resolveConnectionString()).toBe("postgres://prod");
  });
});
