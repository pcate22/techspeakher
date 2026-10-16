-- Migration — profils speakeuses : champs séparés + taxonomie à deux axes.
-- À exécuter UNE fois dans l'éditeur SQL de Neon (table speaker_profiles déjà créée).
-- (Pour une base neuve, db/schema.sql contient déjà la version à jour.)

ALTER TABLE speaker_profiles RENAME COLUMN role_title TO titre_profil;
ALTER TABLE speaker_profiles ADD COLUMN IF NOT EXISTS poste TEXT;
ALTER TABLE speaker_profiles RENAME COLUMN tags TO sujets;
ALTER TABLE speaker_profiles ADD COLUMN IF NOT EXISTS secteurs TEXT[] NOT NULL DEFAULT '{}';
