-- Migration 014 — journal de consentement Tremplin (RGPD, append-only).
-- À exécuter UNE fois dans l'éditeur SQL de Neon. Idempotent.
--
-- Pourquoi : le champ `public_consent_at` ne garde QUE le consentement courant
-- (effacé au retrait). Pour pouvoir DÉMONTRER un consentement passé même après
-- retrait (exigence RGPD), on trace chaque changement dans un journal append-only.
-- On n'y écrit jamais d'UPDATE/DELETE applicatif : uniquement des INSERT.
CREATE TABLE IF NOT EXISTS tremplin_consent_log (
  id              SERIAL PRIMARY KEY,
  registration_id INTEGER NOT NULL REFERENCES tremplin_registrations(id) ON DELETE CASCADE,
  action          TEXT NOT NULL CHECK (action IN ('accorde', 'retire')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_consent_log_registration ON tremplin_consent_log (registration_id);
