-- 049 — nature des ateliers en SOUS-GROUPES du coaching DevFest Toulouse 2026.
--
-- Backfill de DONNÉES (pas de schéma). La migration 047 a introduit
-- `nature ('collectif' | 'sous_groupes')` avec un DEFAULT 'collectif', et la 046
-- avait créé les séances du coaching 2026 avant qu'elle existe : les quatre
-- activités qui se font en sous-groupes sont donc restées `collectif` en base.
--
-- Conséquence concrète, et raison de cette migration : ce sont exactement les
-- ateliers pour lesquels la fiche « événement » a été refondue (lot C). Tant
-- qu'ils sont marqués `collectif`, l'admin leur réclame un coach d'atelier, un
-- lieu, et le pointage des présences — trois demandes qui n'ont aucun sens pour
-- une revue croisée en duo, et précisément les fausses alertes que le lot
-- supprime. Sans cette reprise, le lot est invisible sur les cas qui l'ont
-- motivé.
--
-- Les quatre titres viennent de la migration 046 et sont nommés comme des
-- activités de sous-groupe dans docs/conception-sous-groupes-ateliers.md : un
-- duo de speakeuses pour les revues croisées, une participante et sa coach pour
-- les points individuels.
--
-- On ne touche QUE la nature : ni les dates (le jour exact se cale dans l'admin,
-- la description dit déjà la semaine), ni les sous-groupes eux-mêmes (composition
-- nominative = organisation interne, jamais committée — règle RGPD de CLAUDE.md).
--
-- Édition ciblée par son identité publique (conf_slug, annee). Idempotent : la
-- garde sur `nature` rend le rejeu sans écriture, et un atelier repassé à
-- `collectif` depuis l'admin serait re-basculé — assumé, c'est un backfill de
-- correction, pas un réglage. No-op sur base vierge ou sans l'édition 2026.
-- Appliqué au déploiement via db/sync-to-latest.sql (bloc identique).

UPDATE tremplin_ateliers a
   SET nature = 'sous_groupes'
  FROM tremplin_editions ed
 WHERE a.edition_id = ed.id
   AND ed.conf_slug = 'devfest-toulouse'
   AND ed.annee = 2026
   AND ed.deleted_at IS NULL
   AND a.nature <> 'sous_groupes'
   AND a.titre IN (
     'Revue croisée entre speakeuses (1)',
     'Revue croisée entre speakeuses (2)',
     'Point individuel avec ta coach (1)',
     'Point individuel avec ta coach (2)'
   );
