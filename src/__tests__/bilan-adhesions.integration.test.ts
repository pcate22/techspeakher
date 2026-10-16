// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

/**
 * Le bilan de la dernière synchro HelloAsso, gardé en base : Vercel ne garde
 * qu'une heure de logs (Hobby), et la ligne `[adhesions]` du cron du soir
 * avait disparu quand on venait la lire (Cateline, 2026-10-15). Ce qui est
 * gardé : des COMPTEURS seulement, jamais une adresse ; une écriture ratée ne
 * fait jamais échouer la synchro ; une valeur illisible se lit « aucun bilan ».
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

import { enregistrerBilanAdhesions, lireBilanAdhesions } from "@/lib/bilan-adhesions";
import { getReglages } from "@/lib/reglages";

beforeAll(async () => {
  h.holder.db = new PGlite();
  await h.holder.db.exec(fs.readFileSync("db/schema.sql", "utf8"));
}, 60_000);
beforeEach(async () => {
  await h.holder.db!.exec("TRUNCATE plateforme_reglages");
});

const LE = new Date("2026-10-15T17:00:05Z");
const BILAN = { articles: 3, comptes: 1, articlesRelies: 1, sansCompte: 2, expirees: 0, fichesReprises: 0 };

describe("bilan de la dernière synchro des adhésions", () => {
  it("rien d'enregistré : null", async () => {
    expect(await lireBilanAdhesions()).toBeNull();
  });

  it("enregistre puis relit les compteurs, la date et l'origine", async () => {
    await enregistrerBilanAdhesions(BILAN, "cron", LE);
    expect(await lireBilanAdhesions()).toEqual({
      le: "2026-10-15T17:00:05.000Z",
      origine: "cron",
      resultat: BILAN,
    });
  });

  it("le dernier passage remplace le précédent", async () => {
    await enregistrerBilanAdhesions(BILAN, "cron", LE);
    await enregistrerBilanAdhesions("non_configuree", "manuelle", new Date("2026-10-15T18:00:00Z"));
    expect(await lireBilanAdhesions()).toMatchObject({ origine: "manuelle", resultat: "non_configuree" });
  });

  it("garde une erreur, tronquée, sans rien d'autre", async () => {
    await enregistrerBilanAdhesions({ erreur: "x".repeat(500) }, "notification", LE);
    const b = await lireBilanAdhesions();
    expect(b!.resultat).toEqual({ erreur: "x".repeat(200) });
  });

  it("ne garde QUE les compteurs, même si on lui passe plus", async () => {
    await enregistrerBilanAdhesions(
      { ...BILAN, email: "lea@exemple.fr" } as unknown as typeof BILAN,
      "cron",
      LE,
    );
    const brut = await h.holder.db!.query<{ valeur: string }>(
      `SELECT valeur FROM plateforme_reglages WHERE cle = 'adhesions_derniere_synchro'`,
    );
    expect(brut.rows[0].valeur).not.toContain("@");
  });

  it("une valeur illisible se lit « aucun bilan », sans lever", async () => {
    await h.holder.db!.query(
      `INSERT INTO plateforme_reglages (cle, valeur) VALUES ('adhesions_derniere_synchro', '{pas du json')`,
    );
    expect(await lireBilanAdhesions()).toBeNull();
  });

  it("un bilan d'avant `articlesRelies` le déduit des articles lus", async () => {
    const { articlesRelies: _, ...ancien } = BILAN;
    await h.holder.db!.query(
      `INSERT INTO plateforme_reglages (cle, valeur) VALUES ('adhesions_derniere_synchro', $1)`,
      [JSON.stringify({ le: LE.toISOString(), origine: "cron", resultat: ancien })],
    );
    expect((await lireBilanAdhesions())!.resultat).toMatchObject({ articlesRelies: 1 });
  });

  it("une date illisible se lit « aucun bilan »", async () => {
    await h.holder.db!.query(
      `INSERT INTO plateforme_reglages (cle, valeur) VALUES ('adhesions_derniere_synchro', $1)`,
      [JSON.stringify({ le: "hier", origine: "cron", resultat: BILAN })],
    );
    expect(await lireBilanAdhesions()).toBeNull();
  });

  it("une base en panne à la lecture se lit « aucun bilan » : la page reste debout", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const q = vi.spyOn(h.pool, "query").mockRejectedValueOnce(new Error("base"));
    await expect(lireBilanAdhesions()).resolves.toBeNull();
    q.mockRestore();
  });

  it("n'abîme pas les réglages chiffrés qui partagent la table", async () => {
    await enregistrerBilanAdhesions(BILAN, "cron", LE);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await getReglages();
    expect(warn).not.toHaveBeenCalled();
  });

  it("une base en panne à l'écriture ne lève pas (la synchro a déjà eu lieu)", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const q = vi.spyOn(h.pool, "query").mockRejectedValueOnce(new Error("base"));
    await expect(enregistrerBilanAdhesions(BILAN, "cron", LE)).resolves.toBeUndefined();
    q.mockRestore();
    expect(err).toHaveBeenCalled();
  });
});
