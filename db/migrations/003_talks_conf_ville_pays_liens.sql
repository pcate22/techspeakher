-- Migration — talks : type, conférence/ville/pays séparés, liens multiples.
-- À exécuter UNE fois dans l'éditeur SQL de Neon.

ALTER TABLE talks RENAME COLUMN evenement TO conference;
ALTER TABLE talks RENAME COLUMN lien TO lien_video;

ALTER TABLE talks ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'Conférence';
ALTER TABLE talks ADD COLUMN IF NOT EXISTS ville TEXT;
ALTER TABLE talks ADD COLUMN IF NOT EXISTS pays TEXT;
ALTER TABLE talks ADD COLUMN IF NOT EXISTS lien_conf TEXT;
ALTER TABLE talks ADD COLUMN IF NOT EXISTS lien_slides TEXT;
ALTER TABLE talks ADD COLUMN IF NOT EXISTS lien_feedback TEXT;
