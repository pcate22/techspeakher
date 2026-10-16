// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";
/**
 * La synchro des adhésions, contre le `db/schema.sql` réel (PGlite, un vrai Postgres).
 *
 * Ce qui est gardé, par ordre de risque (`docs/principes-tests.md` § 5) :
 * - une adhésion SANS compte ne laisse aucune ligne (RGPD, minimisation) ;
 * - le rapprochement se fait contre TOUTES les adresses du compte
 *   (`users.email` et `accounts.email`), sans casse ;
 * - l'échéance s'enchaîne : renouveler tôt ne fait perdre aucun jour ;
 * - une adhésion qui disparaît de HelloAsso (remboursée) cesse de valoir ;
 * - une fiche en pause revient dès l'adhésion.
 */


const h = vi.hoisted(() => {
  const holder: { db: import("@electric-sql/pglite").PGlite | null } = { db: null };
  const pool = {
    query: async (text: string, params?: unknown[]) => {
      const r = await holder.db!.query(text, params);
      // node-postgres expose `rowCount` ; PGlite expose `affectedRows`.
      return { ...r, rowCount: (r as { affectedRows?: number }).affectedRows };
    },
  };
  return { holder, pool };
});

vi.mock("@/lib/db", () => ({ pool: h.pool }));

import { ajouterMois, enchainerEcheance } from "@/lib/adhesion";
import {
  synchroniserAdhesions,
  adhesionDuCompte,
  adhesionsPourOrga,
} from "@/lib/adhesions";

beforeAll(async () => {
  h.holder.db = new PGlite();
  await h.holder.db.exec(fs.readFileSync("db/schema.sql", "utf8"));
}, 60_000);

beforeEach(async () => {
  await h.holder.db!.exec(
    "TRUNCATE users, accounts, speaker_profiles, user_memberships RESTART IDENTITY CASCADE",
  );
});

const MAINTENANT = new Date("2026-10-15T12:00:00Z");

async function compte(email: string, opts: { fiche?: string; orga?: boolean } = {}) {
  const { rows } = await h.pool.query(
    `INSERT INTO users (name, email, is_orga) VALUES ($1, $2, $3) RETURNING id`,
    [email.split("@")[0], email, opts.orga ?? false],
  );
  const id = (rows[0] as { id: number }).id;
  if (opts.fiche)
    await h.pool.query(
      `INSERT INTO speaker_profiles ("userId", status, annuaire_retrait_le) VALUES ($1, $2, $3)`,
      [id, opts.fiche, opts.fiche === "en_pause" ? "2026-10-01T00:00:00Z" : null],
    );
  return id;
}

async function ligne(userId: number) {
  const { rows } = await h.pool.query(
    `SELECT source, started_at, expires_at, status, helloasso_item_id, relance_envoyee_le
       FROM user_memberships WHERE "userId" = $1`,
    [userId],
  );
  return rows[0] as
    | {
        source: string;
        started_at: Date;
        expires_at: Date;
        status: string;
        helloasso_item_id: string | number;
        relance_envoyee_le: Date | null;
      }
    | undefined;
}

const iso = (d: Date) => new Date(d).toISOString();

describe("ajouterMois / enchainerEcheance (pur)", () => {
  it("ajoute douze mois de date à date", () => {
    expect(ajouterMois(new Date("2026-10-15T08:00:00Z"), 12).toISOString()).toBe(
      "2027-10-15T08:00:00.000Z",
    );
  });

  it("borne au dernier jour du mois (31 janvier + 1 mois = 28 février)", () => {
    expect(ajouterMois(new Date("2027-01-31T00:00:00Z"), 1).toISOString()).toBe(
      "2027-02-28T00:00:00.000Z",
    );
  });

  it("une seule adhésion : du paiement à paiement + 12 mois", () => {
    expect(enchainerEcheance(["2026-10-15T00:00:00Z"])).toEqual({
      debut: new Date("2026-10-15T00:00:00Z"),
      fin: new Date("2027-10-15T00:00:00Z"),
    });
  });

  it("renouvelée avant l'échéance : les 12 mois partent de l'échéance en cours", () => {
    expect(enchainerEcheance(["2027-09-20T00:00:00Z", "2026-10-15T00:00:00Z"])).toEqual({
      debut: new Date("2026-10-15T00:00:00Z"),
      fin: new Date("2028-10-15T00:00:00Z"),
    });
  });

  it("renouvelée après l'échéance : une nouvelle adhésion part du paiement", () => {
    expect(enchainerEcheance(["2026-01-10T00:00:00Z", "2027-03-01T00:00:00Z"])).toEqual({
      debut: new Date("2027-03-01T00:00:00Z"),
      fin: new Date("2028-03-01T00:00:00Z"),
    });
  });
});

describe("synchroniserAdhesions", () => {
  it("rapproche par l'adresse du compte, sans casse, et écrit l'échéance", async () => {
    const id = await compte("Lea@Exemple.fr");
    const res = await synchroniserAdhesions(
      [{ itemId: 1, date: "2026-10-15T08:00:00Z", emails: ["lea@exemple.fr"] }],
      MAINTENANT,
    );
    expect(res).toMatchObject({ comptes: 1, sansCompte: 0 });
    const l = await ligne(id);
    expect(l).toMatchObject({ source: "helloasso", status: "active" });
    expect(Number(l!.helloasso_item_id)).toBe(1);
    expect(iso(l!.started_at)).toBe("2026-10-15T08:00:00.000Z");
    expect(iso(l!.expires_at)).toBe("2027-10-15T08:00:00.000Z");
  });

  it("rapproche aussi par l'adresse d'un compte Google ou LinkedIn relié", async () => {
    const id = await compte("lea@exemple.fr");
    await h.pool.query(
      `INSERT INTO accounts ("userId", type, provider, "providerAccountId", email)
       VALUES ($1, 'oidc', 'google', 'g1', 'Lea.Pro@Gmail.com')`,
      [id],
    );
    await synchroniserAdhesions(
      [{ itemId: 7, date: "2026-10-15T08:00:00Z", emails: ["lea.pro@gmail.com"] }],
      MAINTENANT,
    );
    expect(await ligne(id)).toBeDefined();
  });

  it("une adhésion sans compte ne laisse AUCUNE ligne en base", async () => {
    await compte("autre@exemple.fr");
    const res = await synchroniserAdhesions(
      [
        { itemId: 2, date: "2026-10-15T08:00:00Z", emails: ["inconnue@exemple.fr"] },
        { itemId: 3, date: "2026-10-15T08:00:00Z", emails: [] },
      ],
      MAINTENANT,
    );
    expect(res).toMatchObject({ comptes: 0, articlesRelies: 0, sansCompte: 2 });
    const { rows } = await h.pool.query(`SELECT count(*)::int AS n FROM user_memberships`);
    expect((rows[0] as Record<string, unknown>).n).toBe(0);
  });

  it("enchaîne les adhésions d'un même compte et garde le dernier article", async () => {
    const id = await compte("lea@exemple.fr");
    const res = await synchroniserAdhesions(
      [
        { itemId: 10, date: "2026-10-15T00:00:00Z", emails: ["lea@exemple.fr"] },
        { itemId: 11, date: "2027-09-20T00:00:00Z", emails: ["lea@exemple.fr"] },
      ],
      MAINTENANT,
    );
    const l = await ligne(id);
    expect(iso(l!.expires_at)).toBe("2028-10-15T00:00:00.000Z");
    expect(Number(l!.helloasso_item_id)).toBe(11);
    // Deux articles, un compte : les articles reliés s'additionnent aux
    // « sans compte » pour faire les articles lus.
    expect(res).toMatchObject({ articles: 2, comptes: 1, articlesRelies: 2, sansCompte: 0 });
  });

  it("rejouée à l'identique, ne change rien (idempotente)", async () => {
    const id = await compte("lea@exemple.fr");
    const a = [{ itemId: 1, date: "2026-10-15T08:00:00Z", emails: ["lea@exemple.fr"] }];
    await synchroniserAdhesions(a, MAINTENANT);
    await h.pool.query(`UPDATE user_memberships SET relance_envoyee_le = now()`);
    await synchroniserAdhesions(a, MAINTENANT);
    const l = await ligne(id);
    expect(iso(l!.expires_at)).toBe("2027-10-15T08:00:00.000Z");
    // Même échéance : la relance déjà envoyée pour elle reste notée.
    expect(l!.relance_envoyee_le).not.toBeNull();
  });

  it("une échéance qui change efface la relance (une nouvelle partira avant la nouvelle échéance)", async () => {
    const id = await compte("lea@exemple.fr");
    await synchroniserAdhesions(
      [{ itemId: 1, date: "2025-11-01T00:00:00Z", emails: ["lea@exemple.fr"] }],
      MAINTENANT,
    );
    await h.pool.query(`UPDATE user_memberships SET relance_envoyee_le = now()`);
    await synchroniserAdhesions(
      [
        { itemId: 1, date: "2025-11-01T00:00:00Z", emails: ["lea@exemple.fr"] },
        { itemId: 2, date: "2026-10-10T00:00:00Z", emails: ["lea@exemple.fr"] },
      ],
      MAINTENANT,
    );
    expect((await ligne(id))!.relance_envoyee_le).toBeNull();
  });

  it("une adhésion HelloAsso qui disparaît (remboursée) passe en expirée", async () => {
    const id = await compte("lea@exemple.fr");
    await synchroniserAdhesions(
      [{ itemId: 1, date: "2026-10-15T08:00:00Z", emails: ["lea@exemple.fr"] }],
      MAINTENANT,
    );
    await compte("autre@exemple.fr");
    await synchroniserAdhesions(
      [{ itemId: 9, date: "2026-10-15T08:00:00Z", emails: ["autre@exemple.fr"] }],
      MAINTENANT,
    );
    expect((await ligne(id))!.status).toBe("expired");
  });

  it("une adhésion saisie à la main n'est remplacée que par une échéance plus tardive", async () => {
    const id = await compte("lea@exemple.fr");
    await h.pool.query(
      `INSERT INTO user_memberships ("userId", source, started_at, expires_at)
       VALUES ($1, 'manuel', '2026-01-01', '2030-01-01')`,
      [id],
    );
    await synchroniserAdhesions(
      [{ itemId: 1, date: "2026-10-15T08:00:00Z", emails: ["lea@exemple.fr"] }],
      MAINTENANT,
    );
    expect(await ligne(id)).toMatchObject({ source: "manuel" });
    // …et la synchro ne l'expire pas non plus quand HelloAsso ne la connaît pas.
    await synchroniserAdhesions([], MAINTENANT);
    expect(await ligne(id)).toMatchObject({ source: "manuel", status: "active" });
  });

  it("une fiche en pause revient dès l'adhésion, préavis effacé", async () => {
    const id = await compte("lea@exemple.fr", { fiche: "en_pause" });
    const res = await synchroniserAdhesions(
      [{ itemId: 1, date: "2026-10-15T08:00:00Z", emails: ["lea@exemple.fr"] }],
      MAINTENANT,
    );
    expect(res.fichesReprises).toBe(1);
    const { rows } = await h.pool.query(
      `SELECT status, annuaire_retrait_le FROM speaker_profiles WHERE "userId" = $1`,
      [id],
    );
    expect(rows[0] as Record<string, unknown>).toMatchObject({ status: "publie", annuaire_retrait_le: null });
  });

  it("une fiche publiée sous préavis voit son préavis effacé à l'adhésion", async () => {
    const id = await compte("lea@exemple.fr", { fiche: "publie" });
    await h.pool.query(
      `UPDATE speaker_profiles SET annuaire_retrait_le = '2026-11-01' WHERE "userId" = $1`,
      [id],
    );
    await synchroniserAdhesions(
      [{ itemId: 1, date: "2026-10-15T08:00:00Z", emails: ["lea@exemple.fr"] }],
      MAINTENANT,
    );
    const { rows } = await h.pool.query(
      `SELECT annuaire_retrait_le FROM speaker_profiles WHERE "userId" = $1`,
      [id],
    );
    expect((rows[0] as Record<string, unknown>).annuaire_retrait_le).toBeNull();
  });

  it("une adhésion échue ne reprend pas une fiche en pause", async () => {
    const id = await compte("lea@exemple.fr", { fiche: "en_pause" });
    await synchroniserAdhesions(
      [{ itemId: 1, date: "2025-01-01T00:00:00Z", emails: ["lea@exemple.fr"] }],
      MAINTENANT,
    );
    const { rows } = await h.pool.query(
      `SELECT status FROM speaker_profiles WHERE "userId" = $1`,
      [id],
    );
    expect((rows[0] as Record<string, unknown>).status).toBe("en_pause");
  });
});

describe("synchroniserAdhesions — défauts trouvés en revue (2026-10-15)", () => {
  it("un préavis en cours RESTE posé si l'adhésion finit avant la date annoncée (sinon : un préavis par jour)", async () => {
    // L'adhésion court encore (« à jour ») mais finit avant la sortie
    // annoncée : effacer le préavis à chaque synchro le faisait repartir le
    // lendemain, avec une date qui reculait chaque jour.
    const id = await compte("lea@exemple.fr", { fiche: "publie" });
    await h.pool.query(
      `UPDATE speaker_profiles SET annuaire_retrait_le = '2026-11-14T12:00:00Z' WHERE "userId" = $1`,
      [id],
    );
    await synchroniserAdhesions(
      [{ itemId: 1, date: "2025-11-01T00:00:00Z", emails: ["lea@exemple.fr"] }],
      MAINTENANT,
    );
    const { rows } = await h.pool.query(
      `SELECT annuaire_retrait_le FROM speaker_profiles WHERE "userId" = $1`,
      [id],
    );
    expect((rows[0] as Record<string, unknown>).annuaire_retrait_le).not.toBeNull();
  });

  it("un article qui passe d'un compte à un autre ne bloque pas la synchro", async () => {
    const a = await compte("a@exemple.fr");
    await h.pool.query(
      `INSERT INTO accounts ("userId", type, provider, "providerAccountId", email)
       VALUES ($1, 'oidc', 'google', 'g1', 'foo@x.fr')`,
      [a],
    );
    const article = [{ itemId: 42, date: "2026-10-15T08:00:00Z", emails: ["foo@x.fr"] }];
    await synchroniserAdhesions(article, MAINTENANT);
    // Un compte B naît plus tard sur cette adresse : elle prime.
    const b = await compte("foo@x.fr");
    await expect(synchroniserAdhesions(article, MAINTENANT)).resolves.toMatchObject({ comptes: 1 });
    expect((await ligne(b))!.status).toBe("active");
    expect((await ligne(a))!.status).toBe("expired");
  });

  it("une liste HelloAsso VIDE alors que des adhésions HelloAsso sont actives : refus, rien n'expire", async () => {
    // Un slug changé ou une anomalie de l'API rendrait 200 et `data: []` :
    // tout expirer couperait la protection de la conservation et lancerait
    // des préavis à toutes les membres.
    const id = await compte("lea@exemple.fr");
    await synchroniserAdhesions(
      [{ itemId: 1, date: "2026-10-15T08:00:00Z", emails: ["lea@exemple.fr"] }],
      MAINTENANT,
    );
    await expect(synchroniserAdhesions([], MAINTENANT)).rejects.toThrow(/vide/);
    expect((await ligne(id))!.status).toBe("active");
  });

  it("une fiche en pause revient aussi avec une adhésion saisie à la main", async () => {
    const id = await compte("lea@exemple.fr", { fiche: "en_pause" });
    await h.pool.query(
      `INSERT INTO user_memberships ("userId", source, expires_at) VALUES ($1, 'manuel', '2030-01-01')`,
      [id],
    );
    expect((await synchroniserAdhesions([], MAINTENANT)).fichesReprises).toBe(1);
  });

  it("une fiche sans nom de compte revient AUSSI : la pause est un aller-retour, pas une publication", async () => {
    // La cohorte migrée a des fiches publiées sans nom. Exiger un nom au
    // retour les coinçait en pause à vie, contre la promesse de l'écran.
    const id = await compte("lea@exemple.fr", { fiche: "en_pause" });
    await h.pool.query(`UPDATE users SET name = '  ' WHERE id = $1`, [id]);
    const res = await synchroniserAdhesions(
      [{ itemId: 1, date: "2026-10-15T08:00:00Z", emails: ["lea@exemple.fr"] }],
      MAINTENANT,
    );
    expect(res.fichesReprises).toBe(1);
  });

  it("la garde de la liste vide ne compte que les adhésions encore à jour (la dernière remboursée, puis plus rien)", async () => {
    const id = await compte("lea@exemple.fr");
    await synchroniserAdhesions(
      [{ itemId: 1, date: "2024-01-01T00:00:00Z", emails: ["lea@exemple.fr"] }],
      MAINTENANT,
    );
    // Échue depuis longtemps, encore marquée active : une liste vide est alors
    // légitime, et refuser bloquerait la synchro à vie.
    await expect(synchroniserAdhesions([], MAINTENANT)).resolves.toMatchObject({ expirees: 1 });
    expect((await ligne(id))!.status).toBe("expired");
  });
});

describe("lectures pour les écrans", () => {
  it("adhesionDuCompte : les dates, le statut et la source", async () => {
    const id = await compte("lea@exemple.fr");
    expect(await adhesionDuCompte(id)).toBeNull();
    await synchroniserAdhesions(
      [{ itemId: 1, date: "2026-10-15T08:00:00Z", emails: ["lea@exemple.fr"] }],
      MAINTENANT,
    );
    expect(await adhesionDuCompte(id)).toEqual({
      startedAt: "2026-10-15T08:00:00.000Z",
      expiresAt: "2027-10-15T08:00:00.000Z",
      status: "active",
      source: "helloasso",
    });
  });

  it("adhesionsPourOrga : les comptes rapprochés, par échéance, avec l'état de la fiche", async () => {
    const a = await compte("a@exemple.fr", { fiche: "publie" });
    await compte("b@exemple.fr");
    await synchroniserAdhesions(
      [
        { itemId: 1, date: "2026-10-15T08:00:00Z", emails: ["b@exemple.fr"] },
        { itemId: 2, date: "2026-02-01T08:00:00Z", emails: ["a@exemple.fr"] },
      ],
      MAINTENANT,
    );
    const liste = await adhesionsPourOrga();
    expect(liste.map((l) => l.email)).toEqual(["a@exemple.fr", "b@exemple.fr"]);
    expect(liste[0]).toMatchObject({ userId: a, ficheStatus: "publie", source: "helloasso" });
  });
});
