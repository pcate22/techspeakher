// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

/**
 * L'abonnement à la lettre d'information, et la promesse qui va avec : refuser
 * le marketing ne coupe RIEN d'autre. Le test tient les deux sens (se
 * désabonner, se réabonner) et le retour de Brevo par adresse.
 */

const h = vi.hoisted(() => {
  const holder: { db: import("@electric-sql/pglite").PGlite | null } = { db: null };
  const pool = {
    query: async (text: string, params?: unknown[]) => {
      const r = await holder.db!.query(text, params);
      return { ...r, rowCount: (r as { affectedRows?: number }).affectedRows };
    },
  };
  return { holder, pool };
});
vi.mock("@/lib/db", () => ({ pool: h.pool }));

import { desabonnerParEmail, estAbonnee, setAbonnement } from "@/lib/newsletter";

beforeAll(async () => {
  h.holder.db = new PGlite();
  await h.holder.db.exec(fs.readFileSync("db/schema.sql", "utf8"));
}, 60_000);

beforeEach(async () => {
  await h.holder.db!.exec("TRUNCATE users RESTART IDENTITY CASCADE");
});

async function compte(email: string): Promise<number> {
  const { rows } = await h.holder.db!.query<{ id: number }>(
    `INSERT INTO users (email) VALUES ($1) RETURNING id`,
    [email],
  );
  return rows[0].id;
}

describe("abonnement (opt-out)", () => {
  it("un compte neuf est abonné, sans rien avoir à cocher", async () => {
    const id = await compte("neuve@ex.fr");
    expect(await estAbonnee(id)).toBe(true);
  });

  it("se désabonner, puis se réabonner", async () => {
    const id = await compte("membre@ex.fr");

    await setAbonnement(id, false);
    expect(await estAbonnee(id)).toBe(false);

    await setAbonnement(id, true);
    expect(await estAbonnee(id)).toBe(true);
  });

  it("un réabonnement efface la date du refus (elle ne dit plus rien de vrai)", async () => {
    const id = await compte("membre@ex.fr");
    await setAbonnement(id, false);
    await setAbonnement(id, true);

    const { rows } = await h.holder.db!.query<{ newsletter_optout_at: Date | null }>(
      `SELECT newsletter_optout_at FROM users WHERE id = $1`,
      [id],
    );
    expect(rows[0].newsletter_optout_at).toBeNull();
  });

  it("un compte inconnu ne passe pas pour abonné", async () => {
    expect(await estAbonnee(999)).toBe(false);
  });
});

describe("desabonnerParEmail — le retour de Brevo", () => {
  it("désabonne, quelle que soit la casse de l'adresse", async () => {
    const id = await compte("Membre@Ex.fr");

    expect(await desabonnerParEmail("membre@ex.FR")).toBe(1);
    expect(await estAbonnee(id)).toBe(false);
  });

  it("reste sans effet sur une adresse inconnue (contact écosystème)", async () => {
    await compte("membre@ex.fr");
    expect(await desabonnerParEmail("partenaire@ailleurs.fr")).toBe(0);
  });

  it("est rejouable : un second passage ne change rien", async () => {
    await compte("membre@ex.fr");

    expect(await desabonnerParEmail("membre@ex.fr")).toBe(1);
    expect(await desabonnerParEmail("membre@ex.fr")).toBe(0);
  });
});
