-- Migration 023 — retrait de la colonne morte `recompense` (contract).
-- Le rang de podium est désormais porté par `classement` (entier, migration 022,
-- backfillé depuis ce texte). Plus aucune lecture ni écriture ne référence
-- `recompense` : on la supprime. À exécuter APRÈS 022 (qui a backfillé).

ALTER TABLE tremplin_registrations DROP COLUMN IF EXISTS recompense;
