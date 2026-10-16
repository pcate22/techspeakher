-- Migration — préférence de contact par e-mail (relais via formulaire).
-- À exécuter UNE fois dans l'éditeur SQL de Neon.
-- La speakeuse peut être contactée par e-mail (jamais affiché, relayé) ET/OU LinkedIn.

ALTER TABLE speaker_profiles
  ADD COLUMN IF NOT EXISTS contact_email_ok BOOLEAN NOT NULL DEFAULT false;
