import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { verifierTurnstile, turnstileActif } from "@/lib/turnstile";

/**
 * Le contrat qui compte : refuser un jeton absent ou rejeté, rester INACTIF
 * sans clé (dev, CI, previews), et laisser passer si Cloudflare tombe — une
 * panne chez eux couperait sinon le seul canal de contact de l'association.
 */

function reponse(json: unknown, ok = true, status = 200) {
  return { ok, status, json: () => Promise.resolve(json) };
}

describe("turnstile", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret-de-test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  describe("turnstileActif", () => {
    it("est armé quand la clé secrète existe", () => {
      expect(turnstileActif()).toBe(true);
    });

    it("reste inactif sans clé secrète", () => {
      vi.stubEnv("TURNSTILE_SECRET_KEY", "");
      expect(turnstileActif()).toBe(false);
    });
  });

  describe("verifierTurnstile", () => {
    it("répond « inactif » sans clé secrète, sans appeler Cloudflare", async () => {
      vi.stubEnv("TURNSTILE_SECRET_KEY", "");
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      expect(await verifierTurnstile("un-jeton")).toBe("inactif");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it.each([
      ["absent", undefined],
      ["vide", "   "],
      ["d'un autre type", 42],
    ])("refuse un jeton %s sans appeler Cloudflare", async (_cas, jeton) => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      expect(await verifierTurnstile(jeton)).toBe("refuse");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("valide un jeton accepté par Cloudflare", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reponse({ success: true })));
      expect(await verifierTurnstile("bon-jeton")).toBe("valide");
    });

    it("refuse un jeton rejeté par Cloudflare", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          reponse({ success: false, "error-codes": ["timeout-or-duplicate"] }),
        ),
      );
      expect(await verifierTurnstile("jeton-rejoué")).toBe("refuse");
    });

    it("transmet le secret, le jeton et l'IP à Cloudflare", async () => {
      const fetchMock = vi.fn().mockResolvedValue(reponse({ success: true }));
      vi.stubGlobal("fetch", fetchMock);

      await verifierTurnstile("  bon-jeton  ", "203.0.113.7");

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
      expect(init.method).toBe("POST");
      const envoye = new URLSearchParams(init.body as URLSearchParams);
      expect(envoye.get("secret")).toBe("secret-de-test");
      expect(envoye.get("response")).toBe("bon-jeton");
      expect(envoye.get("remoteip")).toBe("203.0.113.7");
    });

    it("laisse l'IP de côté quand elle est inconnue", async () => {
      const fetchMock = vi.fn().mockResolvedValue(reponse({ success: true }));
      vi.stubGlobal("fetch", fetchMock);

      await verifierTurnstile("bon-jeton", "unknown");

      const envoye = new URLSearchParams(
        fetchMock.mock.calls[0][1].body as URLSearchParams,
      );
      expect(envoye.has("remoteip")).toBe(false);
    });

    it("laisse passer si Cloudflare est injoignable (échec ouvert)", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("réseau coupé")));
      expect(await verifierTurnstile("bon-jeton")).toBe("indisponible");
    });

    it("laisse passer sur une réponse en erreur de Cloudflare", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reponse({}, false, 502)));
      expect(await verifierTurnstile("bon-jeton")).toBe("indisponible");
    });
  });
});
