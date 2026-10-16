// @vitest-environment node
/**
 * Backfill `speaker_talks` (plat) → `talk_occurrences` (migration 044, dupliquée
 * dans sync-to-latest.sql) : le point délicat du split identité / occurrences.
 *
 * Même approche que migration-conferences.integration.test.ts : les tests
 * d'intégration chargent `db/schema.sql` (déjà au NOUVEL état) et le drift-test
 * exécute chaque fichier sur base vierge — aucun ne rejoue le backfill sur des
 * données legacy. Ici on construit une base LEGACY par DDL inline (l'état d'une
 * prod pré-044 : speaker_talks à plat, avec conference/date/liens/edition_id),
 * on la peuple, puis on exécute le SQL de prod (sync-to-latest 2×, et 044 sur
 * une base jumelle) et on vérifie :
 *   - un talk DONNÉ (au moins une donnée d'événement) → UNE occurrence complète ;
 *   - un sujet proposé pur (aucune donnée d'événement) → ZÉRO occurrence ;
 *   - conference_id RÉTRO-REMPLI depuis l'édition reliée (déterministe) ;
 *   - un talk texte libre (edition_id NULL) → occurrence SANS conference_id
 *     (aucun matching par nom : risque de faux positif) ;
 *   - source d'identité normalisée ('sessionize' → 'manuel', 'tremplin' gardé),
 *     la provenance moisson survivant sur l'occurrence ;
 *   - idempotence : 2e passage = no-op (aucune occurrence dupliquée).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";

// PGlite (wasm) + sync complet : bien au-delà des 5 s par défaut.
const TIMEOUT = 60_000;

const syncSql = readFileSync(resolve(process.cwd(), "db/sync-to-latest.sql"), "utf8");
const migrationSql = readFileSync(
  resolve(process.cwd(), "db/migrations/044_talk_occurrences.sql"),
  "utf8",
);

/** DDL d'une base LEGACY minimale (état prod pré-044 : talks à plat). */
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
CREATE TABLE conferences (
  id       SERIAL PRIMARY KEY,
  slug     TEXT NOT NULL UNIQUE,
  nom      TEXT NOT NULL,
  type     TEXT NOT NULL DEFAULT 'conference',
  ville    TEXT,
  pays     TEXT,
  site_url TEXT
);
CREATE TABLE conference_editions (
  id             SERIAL PRIMARY KEY,
  conference_id  INTEGER NOT NULL REFERENCES conferences(id) ON DELETE RESTRICT,
  type           TEXT NOT NULL DEFAULT 'edition',
  nom            TEXT,
  annee          INTEGER,
  date_debut     DATE,
  date_fin       DATE,
  ville          TEXT,
  pays           TEXT,
  lieu           TEXT,
  url            TEXT,
  source         TEXT,
  endpoint       TEXT,
  actif          BOOLEAN NOT NULL DEFAULT FALSE,
  meetup_id      TEXT UNIQUE
);
CREATE TABLE speaker_talks (
  id                SERIAL PRIMARY KEY,
  speaker_profile_id INTEGER NOT NULL REFERENCES speaker_profiles(id) ON DELETE CASCADE,
  titre         TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'Conférence',
  conference    TEXT,
  ville         TEXT,
  pays          TEXT,
  date          TEXT,
  description   TEXT,
  lien_conf     TEXT,
  lien_slides   TEXT,
  lien_video    TEXT,
  lien_feedback TEXT,
  source        TEXT NOT NULL DEFAULT 'manuel',
  external_id   TEXT,
  edition_id    INTEGER REFERENCES conference_editions(id) ON DELETE SET NULL
);
`;

/** Peuple la base legacy : 4 talks aux profils différents. */
async function seedLegacy(db: PGlite): Promise<void> {
  await db.exec(`
    INSERT INTO users (name, email) VALUES ('Montaine', 'm@example.org');
    INSERT INTO speaker_profiles ("userId") VALUES (1);
    INSERT INTO conferences (slug, nom, ville, pays) VALUES ('devoxx', 'Devoxx', 'Paris', 'France');
    INSERT INTO conference_editions (conference_id, annee, ville, pays, url)
      VALUES (1, 2026, 'Paris', 'France', 'https://devoxx.fr');
    -- 1. Talk moissonné relié à une édition (source = provenance moisson).
    INSERT INTO speaker_talks
      (speaker_profile_id, titre, conference, ville, pays, date, lien_slides, source, external_id, edition_id)
      VALUES (1, 'Charmer les dragons', 'Devoxx 2026', 'Paris', 'France', '2026-04', 'https://slides.example/1', 'sessionize', 'ext-1', 1);
    -- 2. Talk texte libre historique (aucun lien à la référence).
    INSERT INTO speaker_talks
      (speaker_profile_id, titre, conference, date)
      VALUES (1, 'Non-Dev : lire du code', 'Meetup IA Innovateur', '2026-05');
    -- 3. Sujet proposé pur : AUCUNE donnée d'événement.
    INSERT INTO speaker_talks (speaker_profile_id, titre, type)
      VALUES (1, 'Mon futur talk', 'Sujet proposé');
    -- 4. Proposition Tremplin (masquée de l'annuaire) sans donnée d'événement.
    INSERT INTO speaker_talks (speaker_profile_id, titre, source)
      VALUES (1, 'Sujet du Tremplin', 'tremplin');
  `);
}

interface OccRow {
  talk_id: number;
  speaker_profile_id: number;
  conference_id: number | null;
  edition_id: number | null;
  conference: string | null;
  ville: string | null;
  date: string | null;
  lien_slides: string | null;
  source: string;
  external_id: string | null;
}

async function occurrences(db: PGlite): Promise<OccRow[]> {
  const r = await db.query(
    `SELECT talk_id, speaker_profile_id, conference_id, edition_id, conference,
            ville, date, lien_slides, source, external_id
       FROM talk_occurrences ORDER BY talk_id, id`,
  );
  return r.rows as OccRow[];
}

/** Vérifications communes aux deux chemins (sync-to-latest et migration 044). */
async function verifieBackfill(db: PGlite): Promise<void> {
  const occs = await occurrences(db);
  // Talks 1 et 2 donnés → une occurrence chacun ; 3 et 4 (sujets) → zéro.
  expect(occs.map((o) => o.talk_id)).toEqual([1, 2]);

  const [moissonne, libre] = occs;
  // Talk relié : conference_id rétro-rempli depuis l'édition, tout suit.
  expect(moissonne.conference_id).toBe(1);
  expect(moissonne.edition_id).toBe(1);
  expect(moissonne.conference).toBe("Devoxx 2026");
  expect(moissonne.ville).toBe("Paris");
  expect(moissonne.date).toBe("2026-04");
  expect(moissonne.lien_slides).toBe("https://slides.example/1");
  // La provenance moisson vit sur l'occurrence (idempotence du re-sync).
  expect(moissonne.source).toBe("sessionize");
  expect(moissonne.external_id).toBe("ext-1");
  expect(moissonne.speaker_profile_id).toBe(1);

  // Talk texte libre : mention gardée, AUCUN rapprochement par nom.
  expect(libre.conference_id).toBeNull();
  expect(libre.edition_id).toBeNull();
  expect(libre.conference).toBe("Meetup IA Innovateur");
  expect(libre.date).toBe("2026-05");
  expect(libre.source).toBe("manuel");

  // Identité : source normalisée — la moisson redevient 'manuel', le marqueur
  // 'tremplin' (visibilité) survit.
  const src = await db.query(`SELECT id, source FROM speaker_talks ORDER BY id`);
  expect(src.rows).toEqual([
    { id: 1, source: "manuel" },
    { id: 2, source: "manuel" },
    { id: 3, source: "manuel" },
    { id: 4, source: "tremplin" },
  ]);
}

describe("migration 044 — backfill speaker_talks → talk_occurrences", () => {
  it(
    "sync-to-latest sur base legacy : backfill complet, puis 2e passage no-op",
    async () => {
      const db = new PGlite();
      await db.exec(LEGACY_DDL);
      await seedLegacy(db);

      await db.exec(syncSql);
      await verifieBackfill(db);

      // Idempotence : rejouer le sync ne doublonne aucune occurrence.
      await db.exec(syncSql);
      const apres = await occurrences(db);
      expect(apres).toHaveLength(2);
      await db.close();
    },
    TIMEOUT,
  );

  it(
    "le fichier de migration 044 seul produit le même état (base jumelle)",
    async () => {
      const db = new PGlite();
      await db.exec(LEGACY_DDL);
      await seedLegacy(db);

      await db.exec(migrationSql);
      await verifieBackfill(db);

      // Rejouable sans effet de bord (IF NOT EXISTS + garde NOT EXISTS).
      await db.exec(migrationSql);
      expect(await occurrences(db)).toHaveLength(2);
      await db.close();
    },
    TIMEOUT,
  );

  it(
    "ON DELETE : supprimer un talk emporte ses occurrences ; supprimer une édition les préserve (SET NULL)",
    async () => {
      const db = new PGlite();
      await db.exec(LEGACY_DDL);
      await seedLegacy(db);
      await db.exec(migrationSql);

      // Supprimer l'édition : l'occurrence reste, le libellé texte survit.
      await db.exec(`DELETE FROM conference_editions WHERE id = 1`);
      const [apresEdition] = await occurrences(db);
      expect(apresEdition.edition_id).toBeNull();
      expect(apresEdition.conference_id).toBe(1); // la conf, elle, existe encore
      expect(apresEdition.conference).toBe("Devoxx 2026");

      // Supprimer le talk : ses occurrences partent en cascade.
      await db.exec(`DELETE FROM speaker_talks WHERE id = 1`);
      const restantes = await occurrences(db);
      expect(restantes.map((o) => o.talk_id)).toEqual([2]);
      await db.close();
    },
    TIMEOUT,
  );
});
