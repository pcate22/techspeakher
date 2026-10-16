-- Migration 016 — dates d'inscriptions d'une édition (ouverture automatique).
-- À exécuter UNE fois dans l'éditeur SQL de Neon. Idempotent.
--
-- Avec ces dates, l'état « Inscriptions ouvertes / à venir / closes » affiché
-- publiquement est DÉRIVÉ de la date du jour (plus besoin de basculer le statut
-- à la main au bon moment). Sans dates, le statut manuel continue de faire foi.
ALTER TABLE tremplin_editions ADD COLUMN IF NOT EXISTS inscriptions_debut DATE;
ALTER TABLE tremplin_editions ADD COLUMN IF NOT EXISTS inscriptions_fin   DATE;
