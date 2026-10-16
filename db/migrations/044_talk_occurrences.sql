-- Migration 044 — Un talk (identité) peut être donné dans PLUSIEURS conférences.
-- Voir docs/conception-talk-multi-conferences.md.
--
-- speaker_talks devient la table d'IDENTITÉ (titre, type, description, source) ;
-- les données « par événement » vivent dans une nouvelle table talk_occurrences
-- (une intervention = une conférence datée, avec ses liens propres). Chaque
-- occurrence est rattachée au REGISTRE existant (conferences + conference_editions,
-- migration 027) par conference_id ET edition_id.
--
-- DÉPLOIEMENT — appliquée AUTOMATIQUEMENT via db/sync-to-latest.sql (bloc
--   identique, en fin de fichier) : le workflow vercel-deploy.yml lance
--   `npm run db:migrate` AVANT de livrer le code. Aucune manip Neon manuelle.
--   Cette migration est EXPAND-ONLY (elle n'enlève AUCUNE colonne de
--   speaker_talks) : conforme à la règle expand/contract d'exploitation.md, le
--   schéma passe avant le code sans fenêtre où l'ancien code lirait une base
--   amputée. Les colonnes devenues mortes (conference, ville, pays, date,
--   lien_*, edition_id, external_id) seront retirées par une migration CONTRACT
--   ultérieure, une fois le nouveau code déployé et vérifié.
--
-- Idempotente : rejouable sans effet de bord à chaque déploiement (IF NOT EXISTS
-- + backfill gardé par NOT EXISTS sur talk_occurrences.talk_id).

-- ─── 1. Table des occurrences ───
CREATE TABLE IF NOT EXISTS talk_occurrences (
  id                 SERIAL PRIMARY KEY,
  talk_id            INTEGER NOT NULL REFERENCES speaker_talks(id) ON DELETE CASCADE,
  -- Dénormalisé depuis le talk parent : nécessaire à l'index d'idempotence du
  -- moissonneur (un index unique partiel ne peut pas traverser deux tables).
  -- L'invariant occurrence.profil = talk.profil est garanti par le code.
  speaker_profile_id INTEGER NOT NULL REFERENCES speaker_profiles(id) ON DELETE CASCADE,
  -- Lien de premier ordre au registre : la conférence (marque) et son édition.
  conference_id INTEGER REFERENCES conferences(id) ON DELETE SET NULL,
  edition_id    INTEGER REFERENCES conference_editions(id) ON DELETE SET NULL,
  -- Libellé figé (SNAPSHOT du nom au save) : affichage + rescapé du SET NULL ;
  -- porte aussi la mention texte des talks libres HISTORIQUES (legacy).
  conference    TEXT,
  ville         TEXT,
  pays          TEXT,
  date          TEXT,
  lien_conf     TEXT,
  lien_slides   TEXT,
  lien_video    TEXT,
  lien_feedback TEXT,
  -- Provenance moisson de l'occurrence : 'manuel' | 'sessionize' | 'conference-hall'
  source        TEXT NOT NULL DEFAULT 'manuel',
  external_id   TEXT
);

CREATE INDEX IF NOT EXISTS idx_talk_occurrences_talk
  ON talk_occurrences (talk_id);
CREATE INDEX IF NOT EXISTS idx_talk_occurrences_conference
  ON talk_occurrences (conference_id);
CREATE INDEX IF NOT EXISTS idx_talk_occurrences_edition
  ON talk_occurrences (edition_id);
-- Idempotence du moissonneur : une session externe = au plus une occurrence par
-- profil (remplace, au niveau occurrence, speaker_talks_profile_source_external_id_key).
CREATE UNIQUE INDEX IF NOT EXISTS talk_occurrences_profile_source_external_id_key
  ON talk_occurrences (speaker_profile_id, source, external_id)
  WHERE external_id IS NOT NULL;

-- ─── 2. Backfill : chaque talk DÉJÀ DONNÉ devient une occurrence ───
-- Un talk sans aucune donnée d'événement (sujet proposé pur) reste à ZÉRO
-- occurrence. conference_id est rétro-rempli depuis l'édition déjà reliée
-- (déterministe) ; les talks texte-libre historiques (edition_id NULL) restent
-- sans conference_id (aucun matching par nom : risque de faux positif).
INSERT INTO talk_occurrences
  (talk_id, speaker_profile_id, conference_id, edition_id, conference, ville, pays,
   date, lien_conf, lien_slides, lien_video, lien_feedback, source, external_id)
SELECT t.id, t.speaker_profile_id, e.conference_id, t.edition_id, t.conference,
       t.ville, t.pays, t.date, t.lien_conf, t.lien_slides, t.lien_video,
       t.lien_feedback, t.source, t.external_id
  FROM speaker_talks t
  LEFT JOIN conference_editions e ON e.id = t.edition_id
 WHERE NOT EXISTS (SELECT 1 FROM talk_occurrences o WHERE o.talk_id = t.id)
   AND (t.conference IS NOT NULL OR t.ville IS NOT NULL OR t.pays IS NOT NULL
     OR t.date IS NOT NULL OR t.edition_id IS NOT NULL OR t.external_id IS NOT NULL
     OR t.lien_conf IS NOT NULL OR t.lien_slides IS NOT NULL
     OR t.lien_video IS NOT NULL OR t.lien_feedback IS NOT NULL);

-- ─── 3. speaker_talks.source ne garde que le sens « visibilité » ───
-- La provenance moisson est désormais portée par l'occurrence ; au niveau
-- identité, seul 'tremplin' (masquage annuaire jusqu'à confirmation) est utile.
UPDATE speaker_talks SET source = 'manuel'
 WHERE source NOT IN ('manuel', 'tremplin');
