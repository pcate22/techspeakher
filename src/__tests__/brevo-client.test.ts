import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@getbrevo/brevo", () => ({
  BrevoClient: class {
    constructor(public opts: { apiKey: string }) {}
  },
}));

const ORIGINAL = process.env.BREVO_API_KEY;

beforeEach(() => vi.resetModules());
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.BREVO_API_KEY;
  else process.env.BREVO_API_KEY = ORIGINAL;
});

describe("brevoClient", () => {
  it("lève si BREVO_API_KEY est absent", async () => {
    delete process.env.BREVO_API_KEY;
    const { brevoClient } = await import("@/lib/brevo-client");
    expect(() => brevoClient()).toThrow(/BREVO_API_KEY/);
  });

  it("renvoie un singleton quand la clé est présente", async () => {
    process.env.BREVO_API_KEY = "xkeysib-test";
    const { brevoClient } = await import("@/lib/brevo-client");
    const a = brevoClient();
    const b = brevoClient();
    expect(a).toBe(b);
  });
});
