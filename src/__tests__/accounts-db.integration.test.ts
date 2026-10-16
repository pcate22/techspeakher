import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { schemaForPgMem } from "./schema-pgmem";

/**
 * Tests d'intégration BDD du rattachement des comptes (« Mes connexions ») :
 * schéma réel (db/schema.sql) sur un Postgres en mémoire (pg-mem), vraies
 * fonctions d'accès de src/lib/accounts.ts. On vérifie qu'on lit bien les
 * providers rattachés et qu'on ne délie QUE le provider visé du BON compte.
 */

const h = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { newDb } = require("pg-mem");
  const mem = newDb();
  const pg = mem.adapters.createPg();
  const pool = new pg.Pool();
  return { mem, pool };
});

vi.mock("@/lib/db", () => ({ pool: h.pool }));

import {
  getLinkedProviders,
  unlinkProvider,
  isProbableDuplicateSignin,
  duplicateSigninRedirect,
  rafraichirJetonProvider,
  adresseFournisseurVerifiee,
} from "@/lib/accounts";

beforeAll(async () => {
  const schema = schemaForPgMem();
  await h.pool.query(schema);
});

beforeEach(async () => {
  await h.pool.query(`DELETE FROM accounts`);
  await h.pool.query(`DELETE FROM users`);
});

async function seedUser(email: string | null, name?: string): Promise<number> {
  const { rows } = await h.pool.query(
    `INSERT INTO users (email, name) VALUES ($1, $2) RETURNING id`,
    [email, name ?? null],
  );
  return (rows[0] as { id: number }).id;
}

async function seedAccount(userId: number, provider: string): Promise<void> {
  await h.pool.query(
    `INSERT INTO accounts ("userId", type, provider, "providerAccountId")
     VALUES ($1, 'oauth', $2, $3)`,
    [userId, provider, `${provider}-${userId}`],
  );
}

describe("getLinkedProviders", () => {
  it("renvoie les providers OAuth rattachés au compte, triés", async () => {
    const uid = await seedUser("a@ex.com");
    await seedAccount(uid, "linkedin");
    await seedAccount(uid, "google");
    expect(await getLinkedProviders(uid)).toEqual(["google", "linkedin"]);
  });

  it("renvoie une liste vide pour un compte sans OAuth (lien magique seul)", async () => {
    const uid = await seedUser("magic@ex.com");
    expect(await getLinkedProviders(uid)).toEqual([]);
  });
});

describe("unlinkProvider", () => {
  it("supprime le seul provider visé, sans toucher aux autres", async () => {
    const uid = await seedUser("b@ex.com");
    await seedAccount(uid, "google");
    await seedAccount(uid, "linkedin");
    await unlinkProvider(uid, "google");
    expect(await getLinkedProviders(uid)).toEqual(["linkedin"]);
  });

  it("ne délie que le compte concerné (pas le même provider d'une autre membre)", async () => {
    const moi = await seedUser("moi@ex.com");
    const autre = await seedUser("autre@ex.com");
    await seedAccount(moi, "google");
    await seedAccount(autre, "google");
    await unlinkProvider(moi, "google");
    expect(await getLinkedProviders(moi)).toEqual([]);
    expect(await getLinkedProviders(autre)).toEqual(["google"]);
  });
});

describe("isProbableDuplicateSignin — détection B (homonyme)", () => {
  const linkedin = { provider: "linkedin", providerAccountId: "li-new" };

  it("true : compte homonyme existant, e-mail différent, provider non rattaché", async () => {
    await seedUser("marie.perso@gmail.com", "Marie Dupont");
    expect(
      await isProbableDuplicateSignin({
        ...linkedin,
        email: "marie.pro@boite.com",
        name: "Marie Dupont",
      }),
    ).toBe(true);
  });

  it("true : homonyme aux accents et à la casse près (Élodie vs elodie)", async () => {
    await seedUser("elodie.perso@gmail.com", "Élodie Gauthier");
    expect(
      await isProbableDuplicateSignin({
        ...linkedin,
        email: "elodie.pro@boite.com",
        name: "elodie gauthier",
      }),
    ).toBe(true);
  });

  it("true : homonyme aux espaces près (bords + espaces multiples)", async () => {
    await seedUser("marie.perso@gmail.com", "Marie Dupont");
    expect(
      await isProbableDuplicateSignin({
        ...linkedin,
        email: "marie.pro@boite.com",
        name: "  Marie   Dupont ",
      }),
    ).toBe(true);
  });

  it("false : ce provider est déjà rattaché (reconnexion)", async () => {
    const uid = await seedUser("marie.perso@gmail.com", "Marie Dupont");
    await seedAccount(uid, "linkedin"); // providerAccountId = linkedin-<uid>
    const { rows } = await h.pool.query(
      `SELECT "providerAccountId" AS pid FROM accounts WHERE "userId" = $1`,
      [uid],
    );
    expect(
      await isProbableDuplicateSignin({
        provider: "linkedin",
        providerAccountId: (rows[0] as { pid: string }).pid,
        email: "peu.importe@x.com",
        name: "Marie Dupont",
      }),
    ).toBe(false);
  });

  it("false : e-mail déjà connu (Auth.js liera, pas de doublon)", async () => {
    await seedUser("marie@ex.com", "Marie Dupont");
    expect(
      await isProbableDuplicateSignin({ ...linkedin, email: "marie@ex.com", name: "Marie Dupont" }),
    ).toBe(false);
  });

  it("false : aucun homonyme", async () => {
    await seedUser("autre@ex.com", "Sophie Martin");
    expect(
      await isProbableDuplicateSignin({ ...linkedin, email: "marie@ex.com", name: "Marie Dupont" }),
    ).toBe(false);
  });

  it("false : nom absent (aucun indice pour deviner)", async () => {
    await seedUser("marie@ex.com", "Marie Dupont");
    expect(
      await isProbableDuplicateSignin({ ...linkedin, email: "x@ex.com", name: null }),
    ).toBe(false);
  });
});

describe("duplicateSigninRedirect", () => {
  it("redirige vers l'écran de doublon en cas d'homonyme", async () => {
    await seedUser("marie.perso@gmail.com", "Marie Dupont");
    expect(
      await duplicateSigninRedirect({
        account: { type: "oidc", provider: "linkedin", providerAccountId: "li-new" },
        email: "marie.pro@boite.com",
        name: "Marie Dupont",
        skip: false,
      }),
    ).toBe("/connexion/deja-un-compte?methode=linkedin");
  });

  it("skip = true court-circuite (liaison / choix explicite)", async () => {
    await seedUser("marie.perso@gmail.com", "Marie Dupont");
    expect(
      await duplicateSigninRedirect({
        account: { type: "oidc", provider: "linkedin", providerAccountId: "li-new" },
        email: "marie.pro@boite.com",
        name: "Marie Dupont",
        skip: true,
      }),
    ).toBeNull();
  });

  it("fait passer le lien magique par la détection (homonyme → redirige)", async () => {
    await seedUser("marie.perso@gmail.com", "Marie Dupont");
    expect(
      await duplicateSigninRedirect({
        account: { type: "email", provider: "email", providerAccountId: "marie@x.com" },
        email: "marie.pro@boite.com",
        name: "Marie Dupont",
        skip: false,
      }),
    ).toBe("/connexion/deja-un-compte?methode=email");
  });

  it("laisse passer un lien magique sans nom (aucun indice à comparer)", async () => {
    await seedUser("marie.perso@gmail.com", "Marie Dupont");
    expect(
      await duplicateSigninRedirect({
        account: { type: "email", provider: "email", providerAccountId: "x@x.com" },
        email: "x@x.com",
        name: null,
        skip: false,
      }),
    ).toBeNull();
  });
});

describe("rafraichirJetonProvider — garde l'adresse du fournisseur", () => {
  // Auth.js ne garde pas l'adresse d'un compte Google ou LinkedIn relié : sans
  // elle, une adhésion HelloAsso faite avec cette adresse est introuvable
  // (docs/conception-adhesions-helloasso.md § 1).
  const lire = async (uid: number) =>
    (
      await h.pool.query(`SELECT email, access_token FROM accounts WHERE "userId" = $1`, [uid])
    ).rows[0] as { email: string | null; access_token: string };

  it("écrit l'adresse donnée par le fournisseur avec le jeton", async () => {
    const uid = await seedUser("lea@perso.fr");
    await seedAccount(uid, "google");
    await rafraichirJetonProvider({
      userId: uid,
      provider: "google",
      providerAccountId: `google-${uid}`,
      accessToken: "t1",
      expiresAt: null,
      email: "lea.pro@gmail.com",
    });
    expect(await lire(uid)).toEqual({ email: "lea.pro@gmail.com", access_token: "t1" });
  });

  it("garde l'adresse connue quand le fournisseur n'en donne pas", async () => {
    const uid = await seedUser("lea@perso.fr");
    await seedAccount(uid, "linkedin");
    const base = { userId: uid, provider: "linkedin", providerAccountId: `linkedin-${uid}`, expiresAt: null };
    await rafraichirJetonProvider({ ...base, accessToken: "t1", email: "lea@pro.fr" });
    await rafraichirJetonProvider({ ...base, accessToken: "t2", email: null });
    expect(await lire(uid)).toEqual({ email: "lea@pro.fr", access_token: "t2" });
  });
});

describe("adresseFournisseurVerifiee — seule une adresse vérifiée rattache une adhésion", () => {
  it("garde l'adresse vérifiée, ou celle d'un fournisseur qui ne dit rien", () => {
    expect(adresseFournisseurVerifiee({ email: "a@x.fr", email_verified: true })).toBe("a@x.fr");
    expect(adresseFournisseurVerifiee({ email: "a@x.fr" })).toBe("a@x.fr");
  });

  it("écarte une adresse que le fournisseur dit NON vérifiée, ou absente", () => {
    expect(adresseFournisseurVerifiee({ email: "a@x.fr", email_verified: false })).toBeNull();
    expect(adresseFournisseurVerifiee({})).toBeNull();
    expect(adresseFournisseurVerifiee(null)).toBeNull();
  });
});
