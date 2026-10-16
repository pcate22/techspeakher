-- Migration 012 — Localisation et langues de la speakeuse.
-- Idempotente, additive.
--   ville   : ville de résidence (niveau ville, pas d'adresse : RGPD).
--   regions : zones où elle se déplace (voir REGIONS dans src/data/domaines.ts).
--   langues : langues d'intervention (voir LANGUES).
ALTER TABLE speaker_profiles ADD COLUMN IF NOT EXISTS ville   TEXT;
ALTER TABLE speaker_profiles ADD COLUMN IF NOT EXISTS regions TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE speaker_profiles ADD COLUMN IF NOT EXISTS langues TEXT[] NOT NULL DEFAULT '{}';
