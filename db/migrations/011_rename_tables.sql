-- Migration — nomenclature : préfixes de domaine cohérents (open source).
-- À exécuter UNE fois dans l'éditeur SQL de Neon. Idempotent.
--
-- Renomme (préserve les données) :
--   talks               → speaker_talks   (+ colonne profile_id → speaker_profile_id)
--   memberships         → user_memberships
-- Les tables Auth.js (users, accounts, sessions, verification_token) et
-- speaker_profiles ne changent pas.

DO $$
BEGIN
  -- talks → speaker_talks
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_name = 'talks')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables
                     WHERE table_name = 'speaker_talks') THEN
    ALTER TABLE talks RENAME TO speaker_talks;
  END IF;

  -- profile_id → speaker_profile_id
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'speaker_talks' AND column_name = 'profile_id') THEN
    ALTER TABLE speaker_talks RENAME COLUMN profile_id TO speaker_profile_id;
  END IF;

  -- memberships → user_memberships
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_name = 'memberships')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables
                     WHERE table_name = 'user_memberships') THEN
    ALTER TABLE memberships RENAME TO user_memberships;
  END IF;
END $$;

-- Index renommé pour suivre (no-op s'il n'existe pas / déjà renommé).
ALTER INDEX IF EXISTS idx_talks_profile_id RENAME TO idx_speaker_talks_profile;
