-- Migration 027 — Référence partagée des conférences (éditions + lieux).
-- Voir docs/conception-registre-conferences.md et
-- docs/implementation-registre-conferences.md (lot 1).
--
-- ⚠️ PROCÉDURE DE DÉPLOIEMENT (fenêtre ancien code / base migrée) :
--   1. merger sur main un jour SANS moisson imminente (cron 07:00 UTC) ;
--   2. jouer CE fichier dans Neon (console SQL) ;
--   3. vérifier immédiatement que le déploiement Vercel du merge est terminé
--      (l'ancien code ne peut pas confirmer une suggestion pendant ~2 min :
--      acceptable, aucune perte de données).
--
-- Idempotente : rejouable sans effet de bord. La reprise de cfp_events est
-- gardée par la CIBLE de la FK talk_suggestions_event_id_fkey (seul marqueur
-- fiable : les SERIAL de cfp_events et conference_editions se chevauchent, un
-- re-remap corromprait la mémoire des refus).
--
-- cfp_events est CONSERVÉE (plus écrite) le temps de la bascule ; une
-- migration ultérieure la retirera de schema.sql + sync-to-latest en même
-- temps (drift-test).

-- ─── 1. Référence : organisateur récurrent + événement daté ───

-- L'organisateur récurrent : une MARQUE de conférence OU une ASSO/communauté.
CREATE TABLE IF NOT EXISTS conferences (
  id       SERIAL PRIMARY KEY,
  slug     TEXT NOT NULL UNIQUE,
  nom      TEXT NOT NULL,
  -- 'conference' | 'asso'
  type     TEXT NOT NULL DEFAULT 'conference',
  ville    TEXT,
  pays     TEXT,
  site_url TEXT
);

-- L'événement daté : une ÉDITION de conf OU un MEETUP d'asso. Porte la date,
-- le lieu, et (pour les confs) les champs de moisson (ex-cfp_events).
CREATE TABLE IF NOT EXISTS conference_editions (
  id             SERIAL PRIMARY KEY,
  -- RESTRICT : supprimer un organisateur qui a des événements est un geste
  -- conscient (cohérent avec « on désactive, on ne supprime pas »).
  conference_id  INTEGER NOT NULL REFERENCES conferences(id) ON DELETE RESTRICT,
  -- 'edition' (conf) | 'meetup' (asso)
  type           TEXT NOT NULL DEFAULT 'edition',
  -- Titre de l'événement : NULL pour une édition (libellé = conf.nom + annee) ;
  -- titre du meetup pour un meetup (deux meetups d'une asso restent distincts).
  nom            TEXT,
  annee          INTEGER,
  date_debut     DATE,
  date_fin       DATE,
  ville          TEXT,
  pays           TEXT,
  lieu           TEXT,
  url            TEXT,
  -- Moisson (nullable : un événement connu n'est pas forcément moissonné) :
  source         TEXT,
  endpoint       TEXT,
  actif          BOOLEAN NOT NULL DEFAULT FALSE,
  -- Provenance communauté : membre ayant ajouté l'événement (info admin).
  propose_par    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  -- Sync meetups Toulouse Tech Hub : id Meetup = clé d'idempotence.
  meetup_id      TEXT UNIQUE,
  -- Une édition « sessionize sans endpoint » (ou l'inverse) ferait lever le
  -- cron en silence : interdit par construction.
  CONSTRAINT conf_editions_source_endpoint_coherents
    CHECK ((source IS NULL) = (endpoint IS NULL))
);

-- ─── 2. Index ───
-- Idempotence de moisson : index PARTIEL obligatoire — un UNIQUE inline avec
-- des NULLs ne matche jamais dans ON CONFLICT (NULLs jamais égaux).
CREATE UNIQUE INDEX IF NOT EXISTS conf_editions_source_endpoint_key
  ON conference_editions (source, endpoint) WHERE endpoint IS NOT NULL;
-- Éditions annuelles uniques par conf ; les meetups (annee NULL) non contraints.
CREATE UNIQUE INDEX IF NOT EXISTS conf_editions_conf_annee
  ON conference_editions (conference_id, annee) WHERE annee IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conf_editions_conference
  ON conference_editions (conference_id);
CREATE INDEX IF NOT EXISTS idx_conf_editions_date_debut
  ON conference_editions (date_debut);

-- ─── 3. Reprise cfp_events → conferences + conference_editions (UNE fois) ───
DO $$
BEGIN
  IF to_regclass('cfp_events') IS NOT NULL
     AND (SELECT confrelid::regclass::text FROM pg_constraint
           WHERE conname = 'talk_suggestions_event_id_fkey') = 'cfp_events' THEN

    -- 3a. Garde anti-collision : deux cfp_events AVEC suffixe d'année → même
    --     (conf, année) ⇒ stop. (Deux événements de même nom SANS année sont
    --     légitimes : annee NULL n'est pas contrainte par l'index partiel.)
    IF EXISTS (
      SELECT 1 FROM cfp_events
      WHERE substring(nom FROM '\s((19|20)\d{2})$') IS NOT NULL
      GROUP BY regexp_replace(nom, '\s+(19|20)\d{2}$', ''),
               substring(nom FROM '\s((19|20)\d{2})$')
      HAVING count(*) > 1
    ) THEN
      RAISE EXCEPTION 'cfp_events : doublon conf/année, réconciliation manuelle requise';
    END IF;

    -- 3b. Conférences (nom débarrassé du suffixe année ; slug dérivé).
    --     site_url volontairement NULL : cfp_events.url est une URL d'ÉDITION
    --     (posée sur l'édition en 3c) ; le site de la conf viendra de l'UI orga.
    INSERT INTO conferences (slug, nom, ville, pays)
    SELECT DISTINCT
      trim(BOTH '-' FROM lower(regexp_replace(
        translate(regexp_replace(nom, '\s+(19|20)\d{2}$', ''),
                  'àâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ',
                  'aaaeeeeiioouuucAAAEEEEIIOOUUUC'),
        '[^a-zA-Z0-9]+', '-', 'g'))),
      regexp_replace(nom, '\s+(19|20)\d{2}$', ''), ville, pays
      FROM cfp_events
    ON CONFLICT (slug) DO NOTHING;

    -- 3c. Une édition PAR ligne cfp_events (1-1). annee posée SEULEMENT si le
    --     nom finit par l'année (sinon NULL → le libellé recomposé reste
    --     l'ancien nom à l'identique, jamais « DevFest 2026 Toulouse 2026 »).
    --     actif copié explicitement (le défaut a changé : FALSE).
    INSERT INTO conference_editions
      (conference_id, annee, date_debut, ville, pays, url, source, endpoint, actif)
    SELECT c.id, substring(e.nom FROM '\s((19|20)\d{2})$')::int,
           e.date_debut, e.ville, e.pays, e.url, e.source, e.endpoint, e.actif
      FROM cfp_events e
      JOIN conferences c ON c.nom = regexp_replace(e.nom, '\s+(19|20)\d{2}$', '')
    ON CONFLICT (source, endpoint) WHERE endpoint IS NOT NULL DO NOTHING;

    -- 3c-bis. Garde loud-fail : TOUTE ligne cfp_events doit avoir son édition.
    --     (Une collision de slug en 3b — casse/accents — laisserait des lignes
    --     orphelines et le remap 3d pointerait la MAUVAISE édition en silence,
    --     les SERIAL des deux tables se chevauchant.)
    IF EXISTS (
      SELECT 1 FROM cfp_events e
      LEFT JOIN conference_editions ce
        ON ce.source = e.source AND ce.endpoint = e.endpoint
      WHERE ce.id IS NULL
    ) THEN
      RAISE EXCEPTION 'cfp_events : ligne sans édition correspondante (collision de slug ?), réconciliation manuelle';
    END IF;

    -- 3d. DROP FK → remap par clé naturelle (source, endpoint) → ADD FK.
    --     L'ordre est impératif : tant que la FK pointe cfp_events, écrire des
    --     ids d'éditions la violerait. Même nom de contrainte (drift-test),
    --     RESTRICT (mémoire des refus).
    ALTER TABLE talk_suggestions DROP CONSTRAINT talk_suggestions_event_id_fkey;
    UPDATE talk_suggestions s SET event_id = ce.id
      FROM cfp_events e
      JOIN conference_editions ce
        ON ce.source = e.source AND ce.endpoint = e.endpoint
     WHERE s.event_id = e.id;
    ALTER TABLE talk_suggestions ADD CONSTRAINT talk_suggestions_event_id_fkey
      FOREIGN KEY (event_id) REFERENCES conference_editions(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- ─── 4. Colonnes de rattachement (nullable, sans backfill) ───
-- Un talk / une édition de Tremplin PEUT pointer un événement de la référence.
ALTER TABLE speaker_talks ADD COLUMN IF NOT EXISTS edition_id
  INTEGER REFERENCES conference_editions(id) ON DELETE SET NULL;
-- « conference_edition_id » (pas « edition_id ») : dans le domaine Tremplin,
-- edition_id désigne déjà l'édition de Tremplin.
ALTER TABLE tremplin_editions ADD COLUMN IF NOT EXISTS conference_edition_id
  INTEGER REFERENCES conference_editions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_speaker_talks_edition ON speaker_talks (edition_id);
