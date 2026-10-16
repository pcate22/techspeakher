-- Migration 028 — suppression d'une édition (cf. docs/conception-suppression-edition.md).
--
-- Une édition PUBLIÉE supprimée devient un « tombstone » : ses données (perso
-- comprises) sont effacées, mais la coquille (nom, conf, année) est gardée pour
-- que l'URL publique réponde « Cette édition a été supprimée » (page hors index)
-- au lieu d'un 404 cassé. `deleted_at` NON NULL marque ce tombstone. Une édition en
-- préparation, elle, est supprimée pour de bon (pas d'URL à préserver).

ALTER TABLE tremplin_editions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
