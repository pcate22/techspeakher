-- Migration — date d'envoi de l'invitation (migration annuaire).
-- À exécuter UNE fois dans l'éditeur SQL de Neon. Idempotent.
-- Sert à n'envoyer l'invitation qu'UNE fois par speakeuse (anti-double-envoi).

ALTER TABLE speaker_profiles
  ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ;
