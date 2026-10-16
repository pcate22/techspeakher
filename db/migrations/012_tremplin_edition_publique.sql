-- Migration 012 — Tremplin Phase 2b : pages d'édition publiques pilotées par la BDD.
-- À exécuter UNE fois dans l'éditeur SQL de Neon. Idempotent.
-- Conception : docs/tremplin-edition-publique.md.

-- Édition : identifiant d'URL de la conf (ex. devfest-toulouse).
-- Une édition est identifiée publiquement par (conf_slug, annee).
ALTER TABLE tremplin_editions ADD COLUMN IF NOT EXISTS conf_slug TEXT;
-- Backfill des éditions existantes (la reprise 2026 = DevFest Toulouse).
UPDATE tremplin_editions SET conf_slug = 'devfest-toulouse'
 WHERE conf_slug IS NULL AND annee = 2026;
CREATE UNIQUE INDEX IF NOT EXISTS idx_editions_conf_annee
  ON tremplin_editions (conf_slug, annee);

-- Inscription : consentement de publication (opt-in, horodaté), données de
-- galerie et récompense. Le nom/sujet existent déjà (participante_nom, sujet).
ALTER TABLE tremplin_registrations ADD COLUMN IF NOT EXISTS public            BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE tremplin_registrations ADD COLUMN IF NOT EXISTS public_consent_at TIMESTAMPTZ;
ALTER TABLE tremplin_registrations ADD COLUMN IF NOT EXISTS recompense        TEXT;
ALTER TABLE tremplin_registrations ADD COLUMN IF NOT EXISTS bio               TEXT;
ALTER TABLE tremplin_registrations ADD COLUMN IF NOT EXISTS site_web          TEXT;
ALTER TABLE tremplin_registrations ADD COLUMN IF NOT EXISTS photo_url         TEXT;

-- Photos de groupe (podium, soirée) + inventaire « qui est sur quelle photo »
-- (droit à l'image : permet le retrait ciblé). Une photo n'est publiée que si
-- toutes ses personnes taguées ont consenti (règle appliquée côté lib).
CREATE TABLE IF NOT EXISTS tremplin_photos (
  id          SERIAL PRIMARY KEY,
  edition_id  INTEGER NOT NULL REFERENCES tremplin_editions(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  legende     TEXT,
  kind        TEXT NOT NULL DEFAULT 'autre',   -- 'podium' | 'soiree' | 'autre'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tremplin_photo_personnes (
  photo_id        INTEGER NOT NULL REFERENCES tremplin_photos(id) ON DELETE CASCADE,
  registration_id INTEGER NOT NULL REFERENCES tremplin_registrations(id) ON DELETE CASCADE,
  PRIMARY KEY (photo_id, registration_id)
);
CREATE INDEX IF NOT EXISTS idx_tremplin_photos_edition       ON tremplin_photos (edition_id);
CREATE INDEX IF NOT EXISTS idx_photo_personnes_registration  ON tremplin_photo_personnes (registration_id);
