-- Lot N3 (docs/conception-lot-n3-articles.md) : les speakeuses écrivent.
--
-- L'autrice d'un contenu : le LIEN VIVANT (auteur_user_id → photo, fiche) et
-- le NOM FIGÉ à la publication (auteur_nom, patron « snapshot » des
-- conférences). Zéro anonymisation (tranché le 2026-08-08) : la membre cède
-- ses droits de publication à Tech Speak'Her — l'article reste signé après
-- retrait de fiche ou suppression de compte (le SET NULL n'efface que le
-- lien vivant, jamais le nom sur l'œuvre). FK sur users, pas sur
-- speaker_profiles : TOUTE membre écrit, avec ou sans fiche.
--
-- La relecture : le statut 'en_relecture' entre brouillon et publie (même
-- modèle que la fiche), et le motif d'un renvoi.

ALTER TABLE contenus
  ADD COLUMN IF NOT EXISTS auteur_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS auteur_nom TEXT,
  ADD COLUMN IF NOT EXISTS relecture_motif TEXT;

ALTER TABLE contenus DROP CONSTRAINT IF EXISTS contenus_statut_ck;
ALTER TABLE contenus
  ADD CONSTRAINT contenus_statut_ck
  CHECK (statut IN ('brouillon', 'en_relecture', 'publie'));

CREATE INDEX IF NOT EXISTS idx_contenus_auteur ON contenus (auteur_user_id);
