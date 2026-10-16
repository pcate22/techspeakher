// @vitest-environment node
/**
 * Reprise sur réveil de Neon.
 *
 * Neon est un Postgres serverless : il se met en veille, et la première
 * connexion après la veille échoue. Sans reprise, ce réveil raté remonte
 * jusqu'à la page — et sur `/tremplin/[conf]/[annee]`, le premier visiteur
 * après un déploiement voyait un 500. Contexte : docs/google-ad-grants.md §4.
 *
 * La justification de sûreté (pourquoi la reprise n'enveloppe QUE l'acquisition,
 * et jamais l'exécution) vit dans `src/lib/db.ts`, avec les références au source
 * de `pg` qui l'établissent. Elle n'est pas recopiée ici : une seule copie fait
 * foi.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { estErreurDeConnexion, avecReprise } from "@/lib/db";

/**
 * Pose une base configurée pour la durée d'un `describe`, et rend l'environnement
 * intact ensuite. `resolveConnectionString` lit AUSSI `VERCEL_ENV` et
 * `PREVIEW_DATABASE_URL` : sans ce ménage, une machine où `VERCEL_ENV=preview`
 * est exporté fait tomber la suite sans rien apprendre sur le code. Même patron
 * que `db-connection.test.ts`.
 */
function avecBaseConfiguree({ reinitialiserModules = false } = {}) {
  const ENV = process.env;
  beforeEach(() => {
    process.env = { ...ENV, DATABASE_URL: "postgres://exemple/db" };
    delete process.env.VERCEL_ENV;
    delete process.env.PREVIEW_DATABASE_URL;
  });
  afterEach(() => {
    process.env = ENV;
    if (reinitialiserModules) vi.resetModules();
  });
}

function erreurPg(code: string, message = "boom"): Error & { code: string } {
  return Object.assign(new Error(message), { code });
}

describe("estErreurDeConnexion", () => {
  it("reconnaît les échecs d'établissement de connexion", () => {
    for (const code of ["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EHOSTUNREACH", "ECONNRESET"]) {
      expect(estErreurDeConnexion(erreurPg(code)), code).toBe(true);
    }
  });

  it("écarte les délais, qui ont DÉJÀ attendu la preuve qu'on cherche", () => {
    // `connectionTimeoutMillis` vaut 5 s : rejouer un délai d'établissement
    // porterait le pire cas d'une acquisition à ~16 s, donc une dégradation
    // plus lente que le délai lui-même, avec un risque de 504 avant la fin.
    expect(
      estErreurDeConnexion(new Error("Connection terminated due to connection timeout")),
    ).toBe(false);
    // Délai de file d'attente du pool : saturation, surtout pas un rejeu.
    expect(estErreurDeConnexion(new Error("timeout exceeded when trying to connect"))).toBe(
      false,
    );
  });

  it("écarte une chute de connexion ambiguë : l'instruction a pu partir", () => {
    // C'est LE cas à ne pas réessayer : un rejeu doublerait une écriture.
    expect(estErreurDeConnexion(new Error("Connection terminated unexpectedly"))).toBe(false);
  });

  it("écarte les erreurs SQL, qui doivent remonter immédiatement", () => {
    // 23505 = violation d'unicité, 42P01 = table inconnue, 57P01 = arrêt admin.
    for (const code of ["23505", "42P01", "57P01"]) {
      expect(estErreurDeConnexion(erreurPg(code)), code).toBe(false);
    }
    expect(estErreurDeConnexion(new Error("syntax error at or near"))).toBe(false);
  });

  it("écarte ce qui n'est pas une erreur", () => {
    expect(estErreurDeConnexion(null)).toBe(false);
    expect(estErreurDeConnexion("ECONNREFUSED")).toBe(false);
  });
});

describe("avecReprise", () => {
  // La reprise ne s'arme que s'il y a une base à réveiller (cf. dernier bloc).
  avecBaseConfiguree();

  it("rend la valeur sans réessayer quand le premier essai passe", async () => {
    const fn = vi.fn(async () => "ok");
    await expect(avecReprise(fn, 0)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("réessaie un réveil raté, puis réussit", async () => {
    let essais = 0;
    const fn = vi.fn(async () => {
      essais += 1;
      if (essais === 1) throw erreurPg("ECONNREFUSED");
      return "réveillé";
    });
    await expect(avecReprise(fn, 0)).resolves.toBe("réveillé");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("abandonne après les tentatives prévues, en propageant la dernière erreur", async () => {
    const fn = vi.fn(async () => {
      throw erreurPg("ETIMEDOUT", "toujours endormi");
    });
    await expect(avecReprise(fn, 0)).rejects.toThrow("toujours endormi");
    // Un essai initial + deux reprises.
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("ne réessaie JAMAIS une erreur SQL", async () => {
    const fn = vi.fn(async () => {
      throw erreurPg("23505", "doublon");
    });
    await expect(avecReprise(fn, 0)).rejects.toThrow("doublon");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("aucune base à réveiller = échec immédiat", () => {
  // Ce bloc pose lui-même la présence ou l'absence de chaîne, cas par cas :
  // c'est son sujet. Il a besoin du même ménage que les autres sur VERCEL_ENV
  // et PREVIEW_DATABASE_URL, que `resolveConnectionString` lit aussi.
  const ENV = process.env;
  beforeEach(() => {
    process.env = { ...ENV };
    delete process.env.VERCEL_ENV;
    delete process.env.PREVIEW_DATABASE_URL;
  });
  afterEach(() => {
    process.env = ENV;
  });

  it("sans chaîne de connexion, on renonce au premier essai", async () => {
    // En CI, au build et en test, aucune base n'est configurée : réessayer
    // n'attend rien de plus qu'un échec certain, et retarde d'autant la
    // dégradation propre des pages. Mesuré : 1,1 s ajoutée PAR requête, soit
    // ~4,5 s sur l'accueil, assez pour faire déborder une suite d'intégration.
    delete process.env.DATABASE_URL;
    const fn = vi.fn(async () => {
      throw Object.assign(new Error("endormie"), { code: "ECONNREFUSED" });
    });
    await expect(avecReprise(fn, 0)).rejects.toThrow("endormie");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("avec une chaîne de connexion, la reprise reste active", async () => {
    process.env.DATABASE_URL = "postgres://exemple/db";
    let essais = 0;
    const fn = vi.fn(async () => {
      essais += 1;
      if (essais === 1) throw Object.assign(new Error("veille"), { code: "ECONNREFUSED" });
      return "réveillée";
    });
    await expect(avecReprise(fn, 0)).resolves.toBe("réveillée");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe("enveloppe de pool.connect (faux pool préposé avant l'import)", () => {
  avecBaseConfiguree({ reinitialiserModules: true });

  // L'enveloppe appelle `avecReprise` sans paramètre, donc avec l'attente réelle
  // (375 ms puis 750 ms) : sans horloge feinte, ce bloc dormait 1,89 s à chaque
  // `npm run test`, soit 99 % du temps de test du fichier, en CI comme en local.
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  /** Lance l'acquisition et vide les attentes de reprise sans dormir. */
  async function sansDormir<T>(promesse: Promise<T>): Promise<T> {
    const vidage = vi.runAllTimersAsync();
    const res = await promesse;
    await vidage;
    return res;
  }

  /**
   * Le module enveloppe le pool porté par `globalThis`. En y posant un faux
   * pool AVANT l'import, on tient la seule prise fiable sur l'enveloppe : une
   * fois posée, `connectDirect` a capturé la méthode, et espionner le prototype
   * n'y change plus rien.
   */
  async function chargerAvecFauxPool(connect: () => Promise<unknown>) {
    const g = globalThis as unknown as Record<string, unknown>;
    delete g.pgConnectEnveloppe;
    // On garde la référence AVANT l'import : le faux pool et le pool exporté
    // sont le MÊME objet, donc comparer `p.query` à `faux.query` après coup
    // comparerait l'objet à lui-même et ne prouverait rien.
    const queryOriginale = vi.fn();
    const faux = { connect, query: queryOriginale };
    g.pgPool = faux;
    vi.resetModules();
    const mod = await import("@/lib/db");
    return { queryOriginale, pool: mod.pool as unknown as typeof faux };
  }

  it("réessaie un réveil raté, puis rend le client", async () => {
    let essais = 0;
    const client = { release: vi.fn() };
    const { pool: p } = await chargerAvecFauxPool(async () => {
      essais += 1;
      if (essais === 1) throw Object.assign(new Error("veille"), { code: "ECONNREFUSED" });
      return client;
    });
    await expect(sansDormir(p.connect() as Promise<unknown>)).resolves.toBe(client);
    expect(essais).toBe(2);
  });

  it("sert aussi la forme à rappel, celle qu'utilise pool.query en interne", async () => {
    let essais = 0;
    const client = { release: vi.fn() };
    const { pool: p } = await chargerAvecFauxPool(async () => {
      essais += 1;
      if (essais === 1) throw Object.assign(new Error("veille"), { code: "ECONNREFUSED" });
      return client;
    });
    const recu = await sansDormir(
      new Promise((resolve, reject) => {
        (p.connect as unknown as (cb: (e?: Error, c?: unknown) => void) => void)((e, c) =>
          e ? reject(e) : resolve(c),
        );
      }),
    );
    expect(recu).toBe(client);
    expect(essais).toBe(2);
  });

  it("rend les TROIS arguments du contrat pg-pool : (err, client, done)", async () => {
    // `pool.query` ne lit que les deux premiers, mais le pool est exporté : un
    // appelant tiers qui écrit `pool.connect((err, client, done) => …)` recevait
    // un `done` indéfini, donc un client jamais rendu au pot.
    const client = { release: vi.fn() };
    const { pool: p } = await chargerAvecFauxPool(async () => client);
    const args = await sansDormir(
      new Promise<unknown[]>((resolve) => {
        (p.connect as unknown as (cb: (...a: unknown[]) => void) => void)((...a) =>
          resolve(a),
        );
      }),
    );
    expect(args[1]).toBe(client);
    expect(args[2]).toBe(client.release);
  });

  it("rend un done inerte quand l'acquisition échoue : il n'y a rien à rendre", async () => {
    const { pool: p } = await chargerAvecFauxPool(async () => {
      throw Object.assign(new Error("endormie"), { code: "ECONNREFUSED" });
    });
    const args = await sansDormir(
      new Promise<unknown[]>((resolve) => {
        (p.connect as unknown as (cb: (...a: unknown[]) => void) => void)((...a) =>
          resolve(a),
        );
      }),
    );
    expect((args[0] as Error).message).toBe("endormie");
    expect(args[1]).toBeUndefined();
    // Appelable, et sans effet : un `done` absent ferait planter l'appelant.
    expect(() => (args[2] as () => void)()).not.toThrow();
  });

  it("ne se pose qu'une fois : les tentatives ne se multiplient pas", async () => {
    let essais = 0;
    const { pool: p } = await chargerAvecFauxPool(async () => {
      essais += 1;
      throw Object.assign(new Error("endormie"), { code: "ECONNREFUSED" });
    });
    // Ré-évaluation du module, pool repris depuis globalThis : sans le drapeau,
    // une enveloppe s'emboîterait et 3 tentatives deviendraient 9.
    vi.resetModules();
    await import("@/lib/db");

    essais = 0;
    await expect(sansDormir(p.connect() as Promise<unknown>)).rejects.toThrow("endormie");
    expect(essais).toBe(3);
  });

  it("laisse pool.query à pg-pool, qui seul pose l'écouteur d'erreur", async () => {
    // Réimplémenter `pool.query` ferait perdre le `client.once('error', …)` que
    // pg-pool pose sur le client sorti du pot : `pg` émet 'error' quand la
    // socket meurt, et sans écouteur cet emit lève une exception NON RATTRAPÉE,
    // donc un process qui tombe au lieu d'un 500. Et comme seule l'acquisition
    // est reprise, une instruction déjà partie n'est jamais rejouée.
    const { queryOriginale, pool: p } = await chargerAvecFauxPool(async () => ({
      release: vi.fn(),
    }));
    expect(p.query).toBe(queryOriginale);
  });
});
