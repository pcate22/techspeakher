import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { isRateLimited, clientIp, isMagicLinkThrottled } from "@/lib/rate-limit";

describe("isRateLimited", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });
  afterEach(() => vi.useRealTimers());

  it("autorise jusqu'à la limite puis bloque", () => {
    const key = `t1:${Math.random()}`;
    // limite = 3 / fenêtre
    expect(isRateLimited(key, 3, 60_000)).toBe(false); // 1
    expect(isRateLimited(key, 3, 60_000)).toBe(false); // 2
    expect(isRateLimited(key, 3, 60_000)).toBe(false); // 3
    expect(isRateLimited(key, 3, 60_000)).toBe(true); // 4 → dépasse
  });

  it("réinitialise après la fenêtre", () => {
    const key = `t2:${Math.random()}`;
    expect(isRateLimited(key, 1, 1_000)).toBe(false);
    expect(isRateLimited(key, 1, 1_000)).toBe(true);
    vi.setSystemTime(2_000); // au-delà de la fenêtre
    expect(isRateLimited(key, 1, 1_000)).toBe(false);
  });

  it("compte séparément par clé", () => {
    const a = `t3a:${Math.random()}`;
    const b = `t3b:${Math.random()}`;
    expect(isRateLimited(a, 1, 60_000)).toBe(false);
    expect(isRateLimited(a, 1, 60_000)).toBe(true);
    // une autre clé n'est pas affectée
    expect(isRateLimited(b, 1, 60_000)).toBe(false);
  });
});

describe("isMagicLinkThrottled", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });
  afterEach(() => vi.useRealTimers());

  it("bloque après 3 demandes pour la même adresse", () => {
    const ip = `9.9.9.${Math.floor(Math.random() * 1000)}`;
    const email = `me${Math.random()}@ex.fr`;
    expect(isMagicLinkThrottled(ip, email)).toBe(false);
    expect(isMagicLinkThrottled(ip, email)).toBe(false);
    expect(isMagicLinkThrottled(ip, email)).toBe(false);
    expect(isMagicLinkThrottled(ip, email)).toBe(true); // 4e
  });

  it("insensible à la casse de l'adresse", () => {
    const ip = `8.8.8.${Math.floor(Math.random() * 1000)}`;
    const base = `Foo${Math.random()}@Ex.FR`;
    isMagicLinkThrottled(ip, base);
    isMagicLinkThrottled(ip, base.toLowerCase());
    isMagicLinkThrottled(ip, base.toUpperCase());
    // 4e demande (même adresse normalisée) → bloquée
    expect(isMagicLinkThrottled(ip, base)).toBe(true);
  });
});

describe("clientIp", () => {
  it("prend la première IP de x-forwarded-for", () => {
    const h = new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(clientIp(h)).toBe("1.2.3.4");
  });
  it("retombe sur 'unknown' sans en-tête", () => {
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
