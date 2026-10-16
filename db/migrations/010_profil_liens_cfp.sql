-- Migration — profil : liens vers les plateformes de CFP (Sessionize, Conference Hall).
-- Lien sortant sur la fiche publique ; pas d'import automatique (étude
-- docs/faisabilite-import-talks.md). À exécuter UNE fois dans l'éditeur SQL de Neon.

ALTER TABLE speaker_profiles ADD COLUMN IF NOT EXISTS sessionize_url      TEXT;
ALTER TABLE speaker_profiles ADD COLUMN IF NOT EXISTS conference_hall_url TEXT;
