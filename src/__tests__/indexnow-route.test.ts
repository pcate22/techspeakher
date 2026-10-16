import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/app/sitemap", () => ({
  default: vi.fn(async () => [{ url: "https://techspeakher.fr/" }]),
}));

import { GET } from "@/app/api/indexnow/route";

function req(authHeader?: string): Request {
  return new Request(
    "http://localhost/api/indexnow",
    authHeader ? { headers: { authorization: authHeader } } : {},
  );
}

const saved = {
  rev: process.env.REVALIDATE_SECRET,
  key: process.env.INDEXNOW_KEY,
};

beforeEach(() => {
  process.env.REVALIDATE_SECRET = "s3cret";
  process.env.INDEXNOW_KEY = "abc123";
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 200 })),
  );
});
afterEach(() => {
  if (saved.rev === undefined) delete process.env.REVALIDATE_SECRET;
  else process.env.REVALIDATE_SECRET = saved.rev;
  if (saved.key === undefined) delete process.env.INDEXNOW_KEY;
  else process.env.INDEXNOW_KEY = saved.key;
  vi.unstubAllGlobals();
});

describe("GET /api/indexnow", () => {
  it("500 si REVALIDATE_SECRET absent", async () => {
    delete process.env.REVALIDATE_SECRET;
    const res = await GET(req("Bearer s3cret") as never);
    expect(res.status).toBe(500);
  });

  it("401 si mauvais secret", async () => {
    const res = await GET(req("Bearer wrong") as never);
    expect(res.status).toBe(401);
  });

  it("500 si INDEXNOW_KEY absent (clé en env, plus en dur)", async () => {
    delete process.env.INDEXNOW_KEY;
    const res = await GET(req("Bearer s3cret") as never);
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/INDEXNOW_KEY/);
  });

  it("soumet le sitemap et renvoie 200", async () => {
    const res = await GET(req("Bearer s3cret") as never);
    expect(res.status).toBe(200);
    expect((await res.json()).submitted).toBe(1);
  });
});
