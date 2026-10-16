// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

/**
 * VRAIS tests d'intégration de la DUPLICATION d'édition contre un vrai moteur
 * Postgres (PGlite), en complément de la suite pg-mem
 * (`tremplin-db.integration.test.ts`) : les garanties centrales de
 * `duplicateEdition` — invariant RGPD (aucune donnée personnelle ne traverse)
 * et rejet du doublon (conf, année) par l'index UNIQUE avec ROLLBACK — reposent
 * sur le comportement réel du moteur (index, transaction, DEFAULT/CHECK de
 * `phase`), que pg-mem ÉMULE seulement. L'atomicité de `withTransaction`
 * elle-même est épinglée par `db-transaction.test.ts`.
 *
 * Le SEED de la source passe par du SQL direct (les données personnelles ne
 * sont pas le sujet testé) ; le code TESTÉ (duplicateEdition et les lectures)
 * passe par les vraies libs.
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
  // Même sémantique que la vraie withTransaction, sur la connexion PGlite.
  const withTransaction = async <T>(fn: (client: typeof pool) => Promise<T>): Promise<T> => {
    await pool.query("BEGIN");
    try {
      const result = await fn(pool);
      await pool.query("COMMIT");
      return result;
    } catch (e) {
      await pool.query("ROLLBACK").catch(() => {});
      throw e;
    }
  };
  return { holder, pool, withTransaction };
});

vi.mock("@/lib/db", () => ({ pool: h.pool, withTransaction: h.withTransaction }));

import { duplicateEdition } from "@/lib/tremplin-duplicate";
import { createEdition, getEditionById, listEditions } from "@/lib/tremplin-editions";
import { createAtelier, getAteliersByEdition } from "@/lib/tremplin-ateliers";

beforeAll(async () => {
  h.holder.db = new PGlite();
  await h.holder.db.exec(fs.readFileSync("db/schema.sql", "utf8"));
}, 60_000);

beforeEach(async () => {
  // CASCADE purge ateliers, inscriptions, photos, documents, récompenses, jury.
  await h.holder.db!.exec("TRUNCATE tremplin_editions, users RESTART IDENTITY CASCADE");
});

async function countFor(table: string, editionId: number): Promise<number> {
  const { rows } = await h.pool.query(
    `SELECT count(*)::int AS n FROM ${table} WHERE edition_id = $1`,
    [editionId],
  );
  return (rows[0] as { n: number }).n;
}

/** Source « pleine » : édition + 2 ateliers (un par phase, tout renseigné) +
 *  une inscription, une récompense, un juré, une photo et un document. */
async function sourcePleine(): Promise<number> {
  const editionId = await createEdition({
    nom: "Tremplin 2026",
    annee: 2026,
    confSlug: "devfest-toulouse",
    statut: "en_cours",
    description: "Première édition : 12 inscrites, 3 gagnantes.",
    confNom: "DevFest Toulouse 2026",
    confDate: "2026-11-19",
    confLien: "https://devfesttoulouse.fr/",
    finaleDate: "2026-06-04",
    finaleLieu: "Toulouse",
    inscriptionsDebut: "2026-03-12",
    inscriptionsFin: "2026-04-17",
  });
  await createAtelier(editionId, {
    ordre: 1, titre: "Pitch et CFP", date: "2026-04-01", heureDebut: "12:45",
    heureFin: "13:45", description: "Prépa CFP", lienVisio: "https://visio.example.fr",
    coachs: "Lucile, Marie",
  });
  await createAtelier(editionId, {
    ordre: 2, titre: "Prépa scène", date: "2026-09-01", heureDebut: "12:45",
    heureFin: "13:45", description: "Après la soirée", lienVisio: null,
    coachs: null, phase: "montee_sur_scene",
  });
  await h.pool.query(
    `INSERT INTO tremplin_registrations (edition_id, participante_nom, statut, public)
     VALUES ($1, 'Camille', 'acceptee', true)`,
    [editionId],
  );
  await h.pool.query(
    `INSERT INTO tremplin_recompenses (edition_id, intitule) VALUES ($1, 'Talk en meetup')`,
    [editionId],
  );
  await h.pool.query(
    `INSERT INTO tremplin_jury (edition_id, nom, email) VALUES ($1, 'Durand', 'a@b.fr')`,
    [editionId],
  );
  await h.pool.query(
    `INSERT INTO tremplin_photos (edition_id, url) VALUES ($1, 'https://x.fr/p.jpg')`,
    [editionId],
  );
  await h.pool.query(
    `INSERT INTO tremplin_documents (edition_id, titre, lien) VALUES ($1, 'Charte', 'https://x.fr/c')`,
    [editionId],
  );
  return editionId;
}

describe("duplication d'une édition (vrai Postgres)", () => {
  it("copie le squelette (phase comprise), vide l'événementiel, zéro donnée personnelle", async () => {
    const sourceId = await sourcePleine();

    const newId = await duplicateEdition(sourceId, {
      confSlug: "devfest-toulouse", annee: 2027, nom: "Tremplin DevFest Toulouse 2027",
      confNom: "DevFest", confLieu: "Toulouse", confLien: "https://devfesttoulouse.fr/",
    });
    expect(newId).not.toBeNull();

    const copie = await getEditionById(newId!);
    expect(copie).toMatchObject({
      confSlug: "devfest-toulouse", annee: 2027, statut: "preparation",
      description: null, confDate: null, finaleDate: null, finaleLieu: null,
      inscriptionsDebut: null, inscriptionsFin: null,
    });

    const ateliers = await getAteliersByEdition(newId!);
    expect(ateliers.map((a) => [a.titre, a.phase])).toEqual([
      ["Pitch et CFP", "cfp_et_pitch"],
      ["Prépa scène", "montee_sur_scene"], // le CHECK réel accepte la phase copiée
    ]);
    for (const a of ateliers) {
      expect(a.date).toBeNull();
      expect(a.heureDebut).toBeNull();
      expect(a.lienVisio).toBeNull();
      expect(a.coachs).toBeNull(); // noms de personnes : jamais recopiés
    }

    // Invariant RGPD sur moteur réel : rien ne traverse.
    for (const table of [
      "tremplin_registrations",
      "tremplin_recompenses",
      "tremplin_jury",
      "tremplin_photos",
      "tremplin_documents",
    ]) {
      expect(await countFor(table, newId!)).toBe(0);
      expect(await countFor(table, sourceId)).toBe(1); // la source, elle, est pleine
    }
  });

  it("doublon (conf, année) : l'index UNIQUE réel rejette (23505), rollback, rien créé", async () => {
    const sourceId = await sourcePleine();
    const editionsAvant = (await listEditions()).length;
    const { rows } = await h.pool.query(`SELECT count(*)::int AS n FROM tremplin_ateliers`);
    const ateliersAvant = (rows[0] as { n: number }).n;

    await expect(
      duplicateEdition(sourceId, {
        confSlug: "devfest-toulouse", annee: 2026, // déjà pris par la source
        nom: "Doublon", confNom: null, confLieu: null, confLien: null,
      }),
    ).rejects.toMatchObject({ code: "23505" }); // le code que l'action retraduit

    expect((await listEditions()).length).toBe(editionsAvant);
    const { rows: apres } = await h.pool.query(`SELECT count(*)::int AS n FROM tremplin_ateliers`);
    expect((apres[0] as { n: number }).n).toBe(ateliersAvant); // aucun atelier orphelin
  });
});
