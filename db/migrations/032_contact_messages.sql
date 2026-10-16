-- Migration 032 — Contact modéré des speakeuses.
-- Idempotente, additive. À exécuter UNE fois dans l'éditeur SQL de Neon.
--
-- Tout message envoyé via le formulaire de contact d'une fiche est mis en file
-- (status 'en_attente'), relu par une orga (transmis / rejeté) puis, s'il est
-- transmis, signalé à la speakeuse par le digest quotidien (notified_at).
--   reason  : motif de contact (voir src/data/contact-motifs.ts)
--   status  : 'en_attente' | 'transmis' | 'rejete'
-- Historique conservé (audit / récidive). Cascade avec la fiche speakeuse.

CREATE TABLE IF NOT EXISTS contact_messages (
  id           SERIAL PRIMARY KEY,
  profile_id   INTEGER NOT NULL REFERENCES speaker_profiles(id) ON DELETE CASCADE,
  reason       TEXT NOT NULL,
  sender_name  TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  body         TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'en_attente',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  moderated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  moderated_at TIMESTAMPTZ,
  notified_at  TIMESTAMPTZ
);

-- File de modération (orga) : messages en attente, triés par date.
CREATE INDEX IF NOT EXISTS idx_contact_messages_status
  ON contact_messages (status);
-- Vue « Mes messages » d'une speakeuse.
CREATE INDEX IF NOT EXISTS idx_contact_messages_profile_status
  ON contact_messages (profile_id, status);

-- Jalon du digest : décision de modération de profil déjà annoncée à la
-- speakeuse (symétrique de contact_messages.notified_at). Sans lui, le digest
-- ne peut pas distinguer une décision « déjà annoncée » d'une « à annoncer ».
ALTER TABLE speaker_profiles
  ADD COLUMN IF NOT EXISTS moderation_notified_at TIMESTAMPTZ;
