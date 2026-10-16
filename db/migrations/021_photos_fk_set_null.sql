-- Migration 021 — Photos : FK compte/inscription en ON DELETE SET NULL
-- (cf. docs/photos-tremplin.md §4, arbitrage tranché : « défaut sûr »).
--
-- Avant : les tags photo (tremplin_photo_personnes) pointaient vers un compte
-- (user_id) ou une inscription (registration_id) en ON DELETE CASCADE. Si une
-- personne taguée SANS accord (donc bloquante) supprimait son compte, ou si
-- l'orga retirait son inscription, son tag disparaissait — et si c'était le
-- seul tag bloquant, la photo redevenait publiable alors qu'elle pouvait
-- encore montrer cette personne.
--
-- Après : ON DELETE SET NULL. Le tag SUBSISTE, orphelin et anonyme (label
-- « Personne n° … »), et reste bloquant tant que « consentement recueilli »
-- n'est pas coché sur ce tag. Retirer une personne DÉPUBLIE donc ses photos —
-- l'orga tranche ensuite (recueillir l'accord, ou retirer le tag / la photo).
--
-- Le CHECK d'identité (au moins une des trois identités non nulle) devient
-- impossible à tenir après SET NULL, il est donc retiré : la garde « un tag a
-- une identité à la CRÉATION » reste applicative (addPhotoTag), et le SET NULL
-- est le seul chemin vers un tag orphelin.

ALTER TABLE tremplin_photo_personnes DROP CONSTRAINT IF EXISTS photo_personne_identite;

ALTER TABLE tremplin_photo_personnes
  DROP CONSTRAINT IF EXISTS tremplin_photo_personnes_registration_id_fkey;
ALTER TABLE tremplin_photo_personnes
  ADD CONSTRAINT tremplin_photo_personnes_registration_id_fkey
  FOREIGN KEY (registration_id) REFERENCES tremplin_registrations(id) ON DELETE SET NULL;

ALTER TABLE tremplin_photo_personnes
  DROP CONSTRAINT IF EXISTS tremplin_photo_personnes_user_id_fkey;
ALTER TABLE tremplin_photo_personnes
  ADD CONSTRAINT tremplin_photo_personnes_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
