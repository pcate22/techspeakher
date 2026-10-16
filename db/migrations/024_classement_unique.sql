-- Migration 024 — un seul rang de podium par édition.
-- La dérivation publique de l'origine d'un transfert repose sur l'unicité de
-- `classement` par édition (classement = rang) ; on l'enforce. Index PARTIEL
-- (WHERE classement IS NOT NULL) : les non classées (NULL) ne se gênent pas.
-- À exécuter APRÈS 022 (backfill de classement).

CREATE UNIQUE INDEX IF NOT EXISTS idx_registrations_classement_unique
  ON tremplin_registrations (edition_id, classement) WHERE classement IS NOT NULL;
