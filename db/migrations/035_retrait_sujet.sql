-- Migration 035 — Retrait définitif de l'ancien système « sujet ».
--
-- Le titre pitché est désormais lu DIRECTEMENT depuis le talk (`talk_id →
-- speaker_talks.titre`) partout où il s'affiche (galerie, coach, admin) ; le
-- palmarès lit l'archive figée `titre_palmares` (migration 034). Plus besoin de
-- la colonne `sujet` ni des triggers de miroir (migration 033).
--
-- ⚠️ DESTRUCTIVE : à jouer UNIQUEMENT APRÈS le déploiement du code qui lit le
--    titre depuis le talk / l'archive (sinon 500 sur galerie/palmarès/admin/
--    coach). La 034 (archive) doit avoir été jouée AVANT.

DROP TRIGGER IF EXISTS trg_registration_sujet_from_talk ON tremplin_registrations;
DROP TRIGGER IF EXISTS trg_talk_titre_to_sujet ON speaker_talks;
DROP FUNCTION IF EXISTS tremplin_sujet_from_talk();
DROP FUNCTION IF EXISTS tremplin_propagate_talk_titre();

ALTER TABLE tremplin_registrations DROP COLUMN IF EXISTS sujet;
