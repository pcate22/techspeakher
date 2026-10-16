-- Migration 040 — Un article (contenu) peut être rattaché à une édition de
-- conférence du répertoire (conference_editions). La page article liste alors
-- automatiquement les speakeuses PUBLIÉES de l'annuaire ayant un talk sur cette
-- édition (speaker_talks.edition_id) — plus de line-up codé en dur. NULL =
-- article non rattaché. ON DELETE SET NULL : supprimer une édition ne casse pas
-- l'article, il perd juste sa liste. Idempotente.
ALTER TABLE contenus ADD COLUMN IF NOT EXISTS conference_edition_id
  INTEGER REFERENCES conference_editions(id) ON DELETE SET NULL;
