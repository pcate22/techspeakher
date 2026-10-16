-- Migration 026 — colonnes `date` et `description` sur speaker_talks.
-- Ces colonnes existaient dans schema.sql (CREATE TABLE) mais avaient été
-- oubliées du bloc `ADD COLUMN IF NOT EXISTS` de sync-to-latest.sql. Une base
-- dont speaker_talks a été héritée de l'ancienne table `talks` (renommée) peut
-- donc ne pas les avoir : dans ce cas, tout ajout de talk échoue, car addTalk
-- écrit `date` et `description`. Idempotent (IF NOT EXISTS).

ALTER TABLE speaker_talks ADD COLUMN IF NOT EXISTS date        TEXT;
ALTER TABLE speaker_talks ADD COLUMN IF NOT EXISTS description TEXT;
