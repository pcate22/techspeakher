// @vitest-environment node
/**
 * Reprise `cfp_events` → `conferences` + `conference_editions` (migration 027,
 * dupliquée dans sync-to-latest.sql) : le point le plus délicat du lot 1.
 *
 * Aucun test existant ne sait tester ça : les tests d'intégration chargent
 * `db/schema.sql` (déjà au NOUVEL état) et le drift-test exécute chaque fichier
 * une fois sur base VIERGE. Ici on construit une base LEGACY par DDL inline
 * (l'état d'une prod pré-027 : talk_suggestions → cfp_events), on la peuple,
 * puis on exécute le SQL de prod (sync-to-latest 2×, et 027 sur une base
 * jumelle) et on vérifie :
 *   - remap 1-1 de talk_suggestions.event_id (par clé naturelle source+endpoint) ;
 *   - mémoire des refus préservée (une refusée reste refusée, jamais re-suggérée) ;
 *   - FK repointée vers conference_editions (même nom, RESTRICT) ;
 *   - idempotence : 2e passage = no-op (gardé par la CIBLE de la FK) ;
 *   - année extraite SEULEMENT en suffixe du nom (« DevFest 2026 Toulouse »
 *     reste tel quel — jamais « DevFest 2026 Toulouse 2026 ») ;
 *   - deux événements de même nom SANS année : légitimes, pas d'exception ;
 *   - collision (deux endpoints → même conf/année) : exception explicite ;
 *   - libellé recomposé par getActiveCfpEvents identique à l'ancien nom.
 */
import { describe, it, expect, vi } from "vitest";

// PGlite (wasm) + exécution du sync complet : bien au-delà des 5 s par défaut.
const TIMEOUT = 60_000;
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const syncSql = readFileSync(resolve(process.cwd(), "db/sync-to-latest.sql"), "utf8");
const migrationSql = readFileSync(
  resolve(process.cwd(), "db/migrations/027_conferences.sql"),
  "utf8",
);

// Adaptateur pool → PGlite (affectedRows → rowCount), pointé sur la base du
// test courant via `current`, pour exécuter les vraies requêtes des libs.
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

import { getActiveCfpEvents } from "@/lib/cfp-suggestions";

/** DDL d'une base LEGACY minimale (état prod pré-027, migrations 001→026). */
const LEGACY_DDL = `
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  email VARCHAR(255),
  is_orga BOOLEAN NOT NULL DEFAULT false
);
CREATE TABLE speaker_profiles (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE speaker_talks (
  id SERIAL PRIMARY KEY,
  speaker_profile_id INTEGER NOT NULL REFERENCES speaker_profiles(id) ON DELETE CASCADE,
  titre TEXT NOT NULL
);
CREATE TABLE cfp_events (
  id SERIAL PRIMARY KEY,
  nom TEXT NOT NULL,
  source TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  url TEXT,
  ville TEXT,
  pays TEXT,
  date_debut DATE,
  actif BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (source, endpoint)
);
CREATE TABLE talk_suggestions (
  id SERIAL PRIMARY KEY,
  profile_id INTEGER NOT NULL REFERENCES speaker_profiles(id) ON DELETE CASCADE,
  event_id INTEGER NOT NULL REFERENCES cfp_events(id) ON DELETE RESTRICT,
  external_id TEXT NOT NULL,
  titre TEXT NOT NULL,
  description TEXT,
  date TEXT,
  conference TEXT,
  ville TEXT,
  pays TEXT,
  lien_conf TEXT,
  statut TEXT NOT NULL DEFAULT 'proposee',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profile_id, event_id, external_id)
);
CREATE TABLE tremplin_editions (
  id SERIAL PRIMARY KEY,
  nom TEXT NOT NULL,
  annee INTEGER NOT NULL
);
`;

/** Peuple la base legacy : 4 événements + 3 suggestions (proposee/refusee/acceptee). */
async function seedLegacy(db: PGlite) {
  await db.exec(`
    INSERT INTO users (name, email) VALUES ('Clara', 'c@ex.fr');
    INSERT INTO speaker_profiles ("userId") VALUES (1);
    INSERT INTO cfp_events (nom, source, endpoint, url, ville, pays, date_debut, actif) VALUES
      ('DevFest Toulouse 2026', 'sessionize', 'ep-devfest', 'https://devfest.example', 'Toulouse', 'France', '2026-11-19', TRUE),
      ('DevFest 2026 Toulouse', 'sessionize', 'ep-patho', 'https://patho.example', 'Toulouse', 'France', NULL, TRUE),
      ('Meetup Cloud', 'sessionize', 'ep-cloud-a', NULL, 'Toulouse', 'France', NULL, FALSE),
      ('Meetup Cloud', 'sessionize', 'ep-cloud-b', NULL, 'Toulouse', 'France', NULL, TRUE);
    INSERT INTO talk_suggestions (profile_id, event_id, external_id, titre, statut) VALUES
      (1, 1, 's-prop', 'Talk proposé', 'proposee'),
      (1, 1, 's-refu', 'Talk refusé', 'refusee'),
      (1, 2, 's-acc',  'Talk accepté', 'acceptee');
  `);
}

/** Photographie suggestions + éditions pour comparer avant/après re-exécution. */
async function snapshot(db: PGlite) {
  const suggestions = await db.query(
    `SELECT id, event_id, statut FROM talk_suggestions ORDER BY id`,
  );
  const editions = await db.query(
    `SELECT id, source, endpoint, annee, actif FROM conference_editions ORDER BY id`,
  );
  const conferences = await db.query(`SELECT id, slug, nom FROM conferences ORDER BY id`);
  return {
    suggestions: suggestions.rows,
    editions: editions.rows,
    conferences: conferences.rows,
  };
}

/** Cible actuelle de la FK talk_suggestions_event_id_fkey. */
async function fkTarget(db: PGlite): Promise<string> {
  const r = await db.query<{ target: string }>(
    `SELECT confrelid::regclass::text AS target FROM pg_constraint
      WHERE conname = 'talk_suggestions_event_id_fkey'`,
  );
  return r.rows[0]?.target ?? "(absente)";
}

/** L'édition correspondant à un endpoint (clé naturelle du remap). */
async function editionIdOf(db: PGlite, endpoint: string): Promise<number> {
  const r = await db.query<{ id: number }>(
    `SELECT id FROM conference_editions WHERE endpoint = $1`,
    [endpoint],
  );
  return r.rows[0].id;
}

for (const [label, sql] of [
  ["sync-to-latest.sql", syncSql],
  ["migrations/027_conferences.sql", migrationSql],
] as const) {
  describe(`reprise legacy via ${label}`, () => {
    it("remappe 1-1, préserve les refus, repointe la FK (RESTRICT)", async () => {
      const db = new PGlite();
      await db.exec(LEGACY_DDL);
      await seedLegacy(db);

      await db.exec(sql);

      // Conférences dérivées : année extraite SEULEMENT en suffixe.
      const confs = await db.query<{ nom: string }>(
        `SELECT nom FROM conferences ORDER BY nom`,
      );
      expect(confs.rows.map((c) => c.nom)).toEqual([
        "DevFest 2026 Toulouse", // pathologique : pas de suffixe → nom intact
        "DevFest Toulouse",
        "Meetup Cloud",
      ]);

      // Éditions : une par ligne cfp_events (1-1), actif copié explicitement.
      const eds = await db.query<{ endpoint: string; annee: number | null; actif: boolean }>(
        `SELECT endpoint, annee, actif FROM conference_editions ORDER BY endpoint`,
      );
      expect(eds.rows).toEqual([
        { endpoint: "ep-cloud-a", annee: null, actif: false },
        { endpoint: "ep-cloud-b", annee: null, actif: true },
        { endpoint: "ep-devfest", annee: 2026, actif: true },
        { endpoint: "ep-patho", annee: null, actif: true },
      ]);

      // Remap par clé naturelle : les suggestions de l'événement 1 (ep-devfest)
      // pointent l'édition ep-devfest, celle de l'événement 2 → ep-patho.
      const devfestEd = await editionIdOf(db, "ep-devfest");
      const pathoEd = await editionIdOf(db, "ep-patho");
      const sugg = await db.query<{ external_id: string; event_id: number; statut: string }>(
        `SELECT external_id, event_id, statut FROM talk_suggestions ORDER BY id`,
      );
      expect(sugg.rows).toEqual([
        { external_id: "s-prop", event_id: devfestEd, statut: "proposee" },
        { external_id: "s-refu", event_id: devfestEd, statut: "refusee" },
        { external_id: "s-acc", event_id: pathoEd, statut: "acceptee" },
      ]);

      // FK repointée, même nom, RESTRICT (la mémoire des refus reste protégée).
      expect(await fkTarget(db)).toBe("conference_editions");
      const restrict = await db.query<{ confdeltype: string }>(
        `SELECT confdeltype FROM pg_constraint WHERE conname = 'talk_suggestions_event_id_fkey'`,
      );
      expect(restrict.rows[0].confdeltype).toBe("r");
      await db.close();
    }, TIMEOUT);

    it("rejoué une 2e fois : no-op strict (gardé par la cible de la FK)", async () => {
      const db = new PGlite();
      await db.exec(LEGACY_DDL);
      await seedLegacy(db);

      await db.exec(sql);
      const avant = await snapshot(db);
      await db.exec(sql);
      const apres = await snapshot(db);

      expect(apres).toEqual(avant);
      await db.close();
    }, TIMEOUT);

    it("collision : deux endpoints → même (conf, année) ⇒ exception explicite", async () => {
      const db = new PGlite();
      await db.exec(LEGACY_DDL);
      await db.exec(`
        INSERT INTO cfp_events (nom, source, endpoint) VALUES
          ('DevFest Toulouse 2026', 'sessionize', 'ep-a'),
          ('DevFest Toulouse 2026', 'sessionize', 'ep-b');
      `);

      await expect(db.exec(sql)).rejects.toThrow(/doublon conf\/année/);
      await db.close();
    }, TIMEOUT);
  });
}

describe("getActiveCfpEvents après reprise (contrat CfpEvent préservé)", () => {
  it("recompose le libellé (nom + année en suffixe seulement) et le fallback ville/pays", async () => {
    const db = new PGlite();
    await db.exec(LEGACY_DDL);
    await seedLegacy(db);
    await db.exec(syncSql);
    h.holder.db = db;

    const events = await getActiveCfpEvents();
    // Actifs uniquement (ep-cloud-a est inactif), triés par id d'édition.
    expect(events.map((e) => e.nom).sort()).toEqual([
      "DevFest 2026 Toulouse", // libellé INCHANGÉ (année pas en suffixe)
      "DevFest Toulouse 2026", // libellé recomposé = identique à l'ancien nom
      "Meetup Cloud",
    ]);
    const devfest = events.find((e) => e.endpoint === "ep-devfest")!;
    expect(devfest.source).toBe("sessionize");
    expect(devfest.ville).toBe("Toulouse"); // fallback édition → conf
    expect(devfest.pays).toBe("France");
    expect(devfest.dateDebut).toBe("2026-11-19");
    expect(devfest.url).toBe("https://devfest.example");
    await db.close();
  }, TIMEOUT);
});
