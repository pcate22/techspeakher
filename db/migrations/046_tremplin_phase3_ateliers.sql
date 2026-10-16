-- 046 — Ateliers de la phase 3 (montée sur scène) du Tremplin DevFest Toulouse 2026.
--
-- Backfill de DONNÉES (pas de schéma). Alimente la phase 3 (« préparation à la
-- conférence », enum phase = 'montee_sur_scene') avec les 10 séances du coaching
-- DevFest 2026, ouvertes à toutes → visibles dans le « parcours » de la page
-- publique d'édition et dans l'espace des inscrites.
--
-- GÉNÉRIQUE, aucune donnée personnelle : ni les binômes de participantes ni
-- l'affectation nominative des coachs ne figurent ici (organisation interne,
-- gérée dans l'admin — « Qui participe » + coachs — jamais committée, cf.
-- docs/conception-phases-tremplin.md §8 et la règle RGPD de CLAUDE.md).
--
-- Édition ciblée par son identité publique (conf_slug, annee). Les séances
-- hebdomadaires (« semaine du … ») restent « à dater » (date NULL) : le jour
-- exact se fixe dans l'admin ; l'ordre porte la chronologie. Les présentielles
-- datées le sont après la finale du 4 juin (cohérence date ↔ phase).
--
-- Idempotent : garde NOT EXISTS par (edition_id, titre) → rejouable sans
-- doublon. No-op sur base vierge ou sans l'édition 2026 (le JOIN sur l'édition
-- ne ramène alors aucune ligne). Appliqué au déploiement via db/sync-to-latest.sql
-- (bloc identique, en fin de fichier).

INSERT INTO tremplin_ateliers
       (edition_id, ordre, titre, date, heure_debut, heure_fin, description, phase, ouvert_a_toutes)
SELECT ed.id, v.ordre, v.titre, v.date, v.heure_debut, v.heure_fin, v.description,
       'montee_sur_scene', true
  FROM tremplin_editions ed
  CROSS JOIN (VALUES
    (6,  'Lancement et structure du talk', DATE '2026-09-01', TIME '18:00', TIME '20:20',
         $d$Présentiel de 2h20. On lance la préparation à la conférence et on pose la structure du talk complet, du fil conducteur aux grands blocs.$d$),
    (7,  'Revue croisée entre speakeuses (1)', NULL, NULL, NULL,
         $d$Visio de 30 min, semaine du 7 au 13 septembre. Retour croisé avec une autre speakeuse sur l'avancement du talk.$d$),
    (8,  'Point individuel avec ta coach (1)', NULL, NULL, NULL,
         $d$Visio de 30 min, semaine du 14 au 18 septembre. Échange individuel avec ta coach sur ton talk.$d$),
    (9,  'Réussir ses slides', NULL, NULL, NULL,
         $d$Visio d'1h, semaine du 21 au 25 septembre ou du 5 au 9 octobre (à confirmer). Concevoir des slides clairs, au service du propos.$d$),
    (10, 'Répétition sur le fond', DATE '2026-09-29', TIME '18:00', TIME '20:20',
         $d$Présentiel de 2h20. Répétition centrée sur le fond, la clarté du message et l'enchaînement des idées.$d$),
    (11, 'Revue croisée entre speakeuses (2)', NULL, NULL, NULL,
         $d$Visio de 30 min, semaine du 30 septembre au 16 octobre. Deuxième retour croisé avec une autre speakeuse.$d$),
    (12, 'Répétition chronométrée', DATE '2026-10-20', TIME '18:00', TIME '20:20',
         $d$Présentiel de 2h20. Répétition dans le format et le temps de la conférence, chronomètre en main.$d$),
    (13, 'Générale et préparation mentale', DATE '2026-10-27', TIME '18:00', TIME '20:20',
         $d$Présentiel. Filage général du talk et préparation mentale avant la scène.$d$),
    (14, 'Point individuel avec ta coach (2)', NULL, NULL, NULL,
         $d$Visio de 30 min, semaine du 28 octobre au 18 novembre. Deuxième échange individuel avec ta coach.$d$),
    (15, 'Débrief', DATE '2026-11-24', NULL, NULL,
         $d$Visio d'1h, mardi 24 novembre (horaire à confirmer). Retour d'expérience après la conférence.$d$)
  ) AS v(ordre, titre, date, heure_debut, heure_fin, description)
 WHERE ed.conf_slug = 'devfest-toulouse' AND ed.annee = 2026 AND ed.deleted_at IS NULL
   AND NOT EXISTS (
     SELECT 1 FROM tremplin_ateliers a
      WHERE a.edition_id = ed.id AND a.titre = v.titre
   );
