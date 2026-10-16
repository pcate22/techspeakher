-- Migration — date du dernier e-mail de rappel envoyé à la speakeuse.
-- À exécuter UNE fois dans l'éditeur SQL de Neon.
-- Sert au cron de rappel (tous les 6 mois) pour ne pas renvoyer trop souvent.

ALTER TABLE speaker_profiles
  ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ;
