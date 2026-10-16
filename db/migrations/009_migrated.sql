-- Migration — drapeau « profil issu de la migration de l'annuaire ».
-- À exécuter UNE fois dans l'éditeur SQL de Neon. Idempotent.
--
-- Les fiches migrées sont pré-remplies mais ne doivent PAS être publiques tant
-- que la speakeuse ne les a pas validées (soumises) et l'orga publiées. Elles
-- repassent donc en 'brouillon'. Le flag `migrated` sert à cibler les
-- invitations (le statut ne les distingue plus d'un nouveau brouillon).

ALTER TABLE speaker_profiles
  ADD COLUMN IF NOT EXISTS migrated BOOLEAN NOT NULL DEFAULT false;

-- ─── One-shot : à exécuter MAINTENANT pour les 15 fiches déjà seedées ───
-- (à ce stade, les seules fiches 'publie' sont les fiches migrées.)
-- Décommente et exécute une fois :
-- UPDATE speaker_profiles
--    SET migrated = true,
--        status = 'brouillon',
--        published_at = NULL, validated_at = NULL, validated_by = NULL
--  WHERE status = 'publie';
