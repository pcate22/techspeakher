-- Migration — modération depuis la fiche + attestation.
-- À exécuter UNE fois dans l'éditeur SQL de Neon.
--   • is_woman     : attestation « être une femme » (communauté de femmes).
--   • submitted_at : date de soumission (file de modération, tri).
--   • refus_motif  : motif de refus expliqué à la speakeuse (envoyé par e-mail).

ALTER TABLE speaker_profiles
  ADD COLUMN IF NOT EXISTS is_woman     BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE speaker_profiles
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE speaker_profiles
  ADD COLUMN IF NOT EXISTS refus_motif  TEXT;
