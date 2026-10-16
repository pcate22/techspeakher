-- Migration 020 — Photos : tags libres + consentement par tag
-- (cf. docs/photos-tremplin.md). tremplin_photo_personnes passe du tag
-- « inscription de l'édition » au tag « personne » : inscription, compte de
-- la plateforme (jurée, coach…) ou nom libre — avec « consentement
-- recueilli » PAR TAG pour les personnes hors inscription. Les lignes
-- existantes (des inscriptions) restent couvertes par le consentement
-- self-service `registration.public` : aucun backfill nécessaire.

ALTER TABLE tremplin_photo_personnes DROP CONSTRAINT IF EXISTS tremplin_photo_personnes_pkey;
ALTER TABLE tremplin_photo_personnes ADD COLUMN IF NOT EXISTS id SERIAL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tremplin_photo_personnes_pkey'
  ) THEN
    ALTER TABLE tremplin_photo_personnes ADD CONSTRAINT tremplin_photo_personnes_pkey PRIMARY KEY (id);
  END IF;
END $$;
ALTER TABLE tremplin_photo_personnes ALTER COLUMN registration_id DROP NOT NULL;
ALTER TABLE tremplin_photo_personnes ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE tremplin_photo_personnes ADD COLUMN IF NOT EXISTS nom_libre TEXT;
ALTER TABLE tremplin_photo_personnes ADD COLUMN IF NOT EXISTS consentement BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE tremplin_photo_personnes ADD COLUMN IF NOT EXISTS consentement_le TIMESTAMPTZ;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'photo_personne_identite'
  ) THEN
    ALTER TABLE tremplin_photo_personnes ADD CONSTRAINT photo_personne_identite CHECK (
      registration_id IS NOT NULL OR user_id IS NOT NULL OR nom_libre IS NOT NULL
    );
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS idx_photo_personnes_reg_unique
  ON tremplin_photo_personnes (photo_id, registration_id) WHERE registration_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_photo_personnes_user_unique
  ON tremplin_photo_personnes (photo_id, user_id) WHERE user_id IS NOT NULL;
