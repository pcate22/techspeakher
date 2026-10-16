-- Migration 032 — Talk mis en avant rattaché à une inscription au Tremplin.
--
-- La proposition de talk / sujet d'une participante devient un vrai talk
-- (speaker_talks), rattaché à son inscription. Cela réutilise la machinerie de
-- l'annuaire : le talk vit sur son profil speakeuse et le préremplit, l'orga
-- peut le créer/éditer avant même que la personne ait réclamé son compte.
-- NULL = aucun talk rattaché. ON DELETE SET NULL : supprimer le talk délie
-- l'inscription sans la supprimer.

ALTER TABLE tremplin_registrations
  ADD COLUMN IF NOT EXISTS talk_id INTEGER REFERENCES speaker_talks(id) ON DELETE SET NULL;
