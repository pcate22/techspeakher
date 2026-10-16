-- Migration 015 — ateliers restreints (coaching post-soirée) : coachs + membres.
-- À exécuter UNE fois dans l'éditeur SQL de Neon. Idempotent.
--
-- Un atelier peut désormais avoir des coachs (noms) et une liste de
-- participantes. AUCUN membre = atelier OUVERT à toutes (ateliers de prépa
-- actuels). ≥1 membre = atelier RESTREINT : visible seulement par ses membres
-- (coaching individuel = un atelier avec une seule participante).
ALTER TABLE tremplin_ateliers ADD COLUMN IF NOT EXISTS coachs TEXT;

CREATE TABLE IF NOT EXISTS tremplin_atelier_membres (
  atelier_id      INTEGER NOT NULL REFERENCES tremplin_ateliers(id) ON DELETE CASCADE,
  registration_id INTEGER NOT NULL REFERENCES tremplin_registrations(id) ON DELETE CASCADE,
  PRIMARY KEY (atelier_id, registration_id)
);
CREATE INDEX IF NOT EXISTS idx_atelier_membres_registration ON tremplin_atelier_membres (registration_id);
