// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * La porte de la notification HelloAsso. Non signée par HelloAsso : la clé
 * dans l'URL écarte le bruit, et la relecture par l'API (testée dans
 * `passe-adhesions.test.ts`) fait le reste.
 */

const m = vi.hoisted(() => ({ traiter: vi.fn() }));
vi.mock("@/lib/passe-adhesions", () => ({ traiterNotificationHelloAsso: m.traiter }));

import { POST } from "@/app/api/helloasso/notification/route";

const SECRET = "s3cr3t-de-test";
const req = (token: string | null, body: unknown = { eventType: "Order", data: { id: 1 } }, ip = "1.1.1.1") =>
  new Request(
    `https://techspeakher.fr/api/helloasso/notification${token === null ? "" : `?token=${token}`}`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: typeof body === "string" ? body : JSON.stringify(body),
    },
  );

describe("POST /api/helloasso/notification", () => {
  beforeEach(() => {
    process.env.HELLOASSO_WEBHOOK_SECRET = SECRET;
    m.traiter.mockReset().mockResolvedValue("synchronisee");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    delete process.env.HELLOASSO_WEBHOOK_SECRET;
  });

  it("refuse sans clé, avec une mauvaise clé, ou quand aucune clé n'est configurée", async () => {
    expect((await POST(req(null))).status).toBe(401);
    expect((await POST(req("mauvaise"))).status).toBe(401);
    delete process.env.HELLOASSO_WEBHOOK_SECRET;
    expect((await POST(req(SECRET))).status).toBe(401);
    expect(m.traiter).not.toHaveBeenCalled();
  });

  it("avec la clé : passe le corps au traitement et répond 200", async () => {
    const res = await POST(req(SECRET, {}, "2.2.2.2"));
    expect(res.status).toBe(200);
    expect(m.traiter).toHaveBeenCalledWith({});
  });

  it("corps illisible : 400, rien n'est traité", async () => {
    expect((await POST(req(SECRET, "{pas du json", "3.3.3.3"))).status).toBe(400);
    expect(m.traiter).not.toHaveBeenCalled();
  });

  it("une panne de l'API HelloAsso répond 500 (le rattrapage du soir reprendra)", async () => {
    m.traiter.mockRejectedValue(new Error("HelloAsso 503"));
    expect((await POST(req(SECRET, {}, "4.4.4.4"))).status).toBe(500);
  });

  it("limite le débit par IP", async () => {
    let dernier = 200;
    for (let i = 0; i < 40; i++) dernier = (await POST(req(SECRET, {}, "5.5.5.5"))).status;
    expect(dernier).toBe(429);
  });
});
