-- Synchronisation de la base au schéma courant — Tech Speak'Her.
--
-- À exécuter UNE fois dans l'éditeur SQL de Neon. SÛR et IDEMPOTENT :
-- tu peux le relancer sans risque, quel que soit l'état de ta base
-- (neuve, partiellement migrée, ou déjà à jour).
--
-- Il remplace l'enchaînement manuel des migrations 001/002/003 : il crée les
-- tables manquantes, renomme les anciennes colonnes seulement si nécessaire,
-- et ajoute les colonnes manquantes. C'est la référence pour mettre une base
-- existante au niveau de db/schema.sql.

-- ─── Tables (créées seulement si absentes) ───
-- Identique à db/schema.sql. CREATE TABLE IF NOT EXISTS n'altère PAS une table
-- déjà existante : les ALTER plus bas s'en chargent.

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(255),
  email         VARCHAR(255),
  "emailVerified" TIMESTAMPTZ,
  image         TEXT,
  is_orga       BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS accounts (
  id                  SERIAL PRIMARY KEY,
  "userId"            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type                VARCHAR(255) NOT NULL,
  provider            VARCHAR(255) NOT NULL,
  "providerAccountId" VARCHAR(255) NOT NULL,
  refresh_token       TEXT,
  access_token        TEXT,
  expires_at          BIGINT,
  id_token            TEXT,
  scope               TEXT,
  session_state       TEXT,
  token_type          TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id             SERIAL PRIMARY KEY,
  "userId"       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires        TIMESTAMPTZ NOT NULL,
  "sessionToken" VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS verification_token (
  identifier TEXT NOT NULL,
  expires    TIMESTAMPTZ NOT NULL,
  token      TEXT NOT NULL,
  PRIMARY KEY (identifier, token)
);

CREATE TABLE IF NOT EXISTS speaker_profiles (
  id           SERIAL PRIMARY KEY,
  "userId"     INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  titre_profil TEXT,
  poste        TEXT,
  entreprise   TEXT,
  bio          TEXT,
  website      TEXT,
  linkedin     TEXT,
  instagram    TEXT,
  secteurs     TEXT[] NOT NULL DEFAULT '{}',
  sujets       TEXT[] NOT NULL DEFAULT '{}',
  contact_email_ok BOOLEAN NOT NULL DEFAULT false,
  is_woman     BOOLEAN NOT NULL DEFAULT false,
  status       TEXT NOT NULL DEFAULT 'brouillon',
  published_at TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  validated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  validated_at TIMESTAMPTZ,
  refus_motif  TEXT,
  last_reminder_at TIMESTAMPTZ
);

-- ─── Renommages de tables (anciens noms → préfixes de domaine) ───
-- talks → speaker_talks (+ profile_id → speaker_profile_id) ; memberships →
-- user_memberships. Un RENAME de table n'entraîne NI ses contraintes NI sa
-- séquence SERIAL : on les renomme aussi, sinon le catalogue de la prod
-- divergerait pour toujours des noms de db/schema.sql (et toute future
-- migration nommée écrite contre schema.sql échouerait ou ne ferait rien).
DO $$
DECLARE
  c RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'talks') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'speaker_talks') THEN
      ALTER TABLE talks RENAME TO speaker_talks;
    ELSIF (SELECT count(*) FROM talks) = 0 THEN
      -- Table fantôme : un ancien sync (pré-renommage) rejoué sur une base déjà
      -- renommée recrée `talks` à vide. On ne supprime QUE si elle est vide.
      DROP TABLE talks;
    ELSE
      RAISE EXCEPTION 'talks ET speaker_talks existent avec des données : réconciliation manuelle requise';
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'speaker_talks' AND column_name = 'profile_id') THEN
    ALTER TABLE speaker_talks RENAME COLUMN profile_id TO speaker_profile_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'memberships') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_memberships') THEN
      ALTER TABLE memberships RENAME TO user_memberships;
    ELSIF (SELECT count(*) FROM memberships) = 0 THEN
      DROP TABLE memberships;
    ELSE
      RAISE EXCEPTION 'memberships ET user_memberships existent avec des données : réconciliation manuelle requise';
    END IF;
  END IF;

  -- Contraintes (PK, FK, UNIQUE, NOT NULL selon la version PG) et séquences :
  -- un RENAME de table ne les renomme pas ; on les aligne sur db/schema.sql
  -- (mêmes noms qu'une base créée à neuf), sinon le catalogue prod divergerait
  -- pour toujours et toute future migration nommée serait piégée.
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'speaker_talks') THEN
    FOR c IN SELECT conname FROM pg_constraint
              WHERE conrelid = 'speaker_talks'::regclass AND conname LIKE 'talks\_%' LOOP
      EXECUTE format(
        'ALTER TABLE speaker_talks RENAME CONSTRAINT %I TO %I', c.conname,
        replace(replace(c.conname, 'talks_profile_id', 'talks_speaker_profile_id'),
                'talks_', 'speaker_talks_'));
    END LOOP;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = 'talks_id_seq') THEN
    ALTER SEQUENCE talks_id_seq RENAME TO speaker_talks_id_seq;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_memberships') THEN
    FOR c IN SELECT conname FROM pg_constraint
              WHERE conrelid = 'user_memberships'::regclass AND conname LIKE 'memberships\_%' LOOP
      EXECUTE format(
        'ALTER TABLE user_memberships RENAME CONSTRAINT %I TO %I', c.conname,
        replace(c.conname, 'memberships_', 'user_memberships_'));
    END LOOP;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = 'memberships_id_seq') THEN
    ALTER SEQUENCE memberships_id_seq RENAME TO user_memberships_id_seq;
  END IF;

  -- Index : renommés seulement si la cible n'existe pas déjà (un ancien sync
  -- rejoué peut avoir recréé l'ancien nom → on le supprime alors plus bas
  -- par équivalence, jamais de plantage ici).
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_talks_profile_id')
     AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_speaker_talks_profile') THEN
    ALTER INDEX idx_talks_profile_id RENAME TO idx_speaker_talks_profile;
  END IF;
  -- L'index unique du moissonneur suit la table lors du RENAME : on aligne son
  -- nom (sinon le CREATE ... IF NOT EXISTS plus bas créerait un doublon).
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'talks_profile_source_external_id_key')
     AND NOT EXISTS (SELECT 1 FROM pg_indexes
                     WHERE indexname = 'speaker_talks_profile_source_external_id_key') THEN
    ALTER INDEX talks_profile_source_external_id_key
      RENAME TO speaker_talks_profile_source_external_id_key;
  END IF;
END $$;
-- Reliquat éventuel d'un ancien sync rejoué : doublon de l'index renommé.
DROP INDEX IF EXISTS idx_talks_profile_id;
DROP INDEX IF EXISTS talks_profile_source_external_id_key;

CREATE TABLE IF NOT EXISTS speaker_talks (
  id                 SERIAL PRIMARY KEY,
  speaker_profile_id INTEGER NOT NULL REFERENCES speaker_profiles(id) ON DELETE CASCADE,
  titre         TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'Conférence',
  conference    TEXT,
  ville         TEXT,
  pays          TEXT,
  date          TEXT,
  description   TEXT,
  lien_conf     TEXT,
  lien_slides   TEXT,
  lien_video    TEXT,
  lien_feedback TEXT
);

CREATE TABLE IF NOT EXISTS user_memberships (
  id         SERIAL PRIMARY KEY,
  "userId"   INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  source     TEXT NOT NULL DEFAULT 'manuel',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  status     TEXT NOT NULL DEFAULT 'active'
);

-- ─── users : rôle orga ───
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_orga BOOLEAN NOT NULL DEFAULT false;
-- Migration 017 — genre déclaratif facultatif (mixité de l'accompagnement).
-- Profil « animateur / coach » (cumulable avec orga ; speakeuse = profil dédié).
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_coach BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS genre TEXT
  CHECK (genre IN ('femme', 'homme', 'non_binaire') OR genre IS NULL);

-- ─── speaker_profiles : renommages conditionnels (anciens noms) ───
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'speaker_profiles' AND column_name = 'role_title')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'speaker_profiles' AND column_name = 'titre_profil') THEN
    ALTER TABLE speaker_profiles RENAME COLUMN role_title TO titre_profil;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'speaker_profiles' AND column_name = 'tags')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'speaker_profiles' AND column_name = 'sujets') THEN
    ALTER TABLE speaker_profiles RENAME COLUMN tags TO sujets;
  END IF;
END $$;

-- ─── speaker_profiles : colonnes manquantes ───
ALTER TABLE speaker_profiles ADD COLUMN IF NOT EXISTS titre_profil TEXT;
ALTER TABLE speaker_profiles ADD COLUMN IF NOT EXISTS poste        TEXT;
ALTER TABLE speaker_profiles ADD COLUMN IF NOT EXISTS entreprise   TEXT;
ALTER TABLE speaker_profiles ADD COLUMN IF NOT EXISTS bio          TEXT;
ALTER TABLE speaker_profiles ADD COLUMN IF NOT EXISTS website      TEXT;
ALTER TABLE speaker_profiles ADD COLUMN IF NOT EXISTS linkedin     TEXT;
ALTER TABLE speaker_profiles ADD COLUMN IF NOT EXISTS instagram    TEXT;
ALTER TABLE speaker_profiles ADD COLUMN IF NOT EXISTS sessionize_url      TEXT;
ALTER TABLE speaker_profiles ADD COLUMN IF NOT EXISTS conference_hall_url TEXT;
ALTER TABLE speaker_profiles ADD COLUMN IF NOT EXISTS secteurs     TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE speaker_profiles ADD COLUMN IF NOT EXISTS sujets       TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE speaker_profiles ADD COLUMN IF NOT EXISTS status       TEXT NOT NULL DEFAULT 'brouillon';
ALTER TABLE speaker_profiles ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE speaker_profiles ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE speaker_profiles ADD COLUMN IF NOT EXISTS validated_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE speaker_profiles ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ;
ALTER TABLE speaker_profiles ADD COLUMN IF NOT EXISTS contact_email_ok BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE speaker_profiles ADD COLUMN IF NOT EXISTS is_woman     BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE speaker_profiles ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE speaker_profiles ADD COLUMN IF NOT EXISTS refus_motif  TEXT;
ALTER TABLE speaker_profiles ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ;
ALTER TABLE speaker_profiles ADD COLUMN IF NOT EXISTS invited_at   TIMESTAMPTZ;
ALTER TABLE speaker_profiles ADD COLUMN IF NOT EXISTS migrated     BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE speaker_profiles ADD COLUMN IF NOT EXISTS cfp_sync_mode TEXT NOT NULL DEFAULT 'suggestions';
ALTER TABLE speaker_profiles ADD COLUMN IF NOT EXISTS ville   TEXT;
ALTER TABLE speaker_profiles ADD COLUMN IF NOT EXISTS regions TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE speaker_profiles ADD COLUMN IF NOT EXISTS langues TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE speaker_profiles ADD COLUMN IF NOT EXISTS moderation_notified_at TIMESTAMPTZ;
-- Slug fiche (URL lisible « nom-prenom », migration 044). L'index UNIQUE et le
-- backfill vivent plus bas, avec les autres index (le backfill exige l'index).
ALTER TABLE speaker_profiles ADD COLUMN IF NOT EXISTS slug TEXT;

-- ─── speaker_talks : renommages conditionnels (anciens noms) ───
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'speaker_talks' AND column_name = 'evenement')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'speaker_talks' AND column_name = 'conference') THEN
    ALTER TABLE speaker_talks RENAME COLUMN evenement TO conference;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'speaker_talks' AND column_name = 'lien')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'speaker_talks' AND column_name = 'lien_video') THEN
    ALTER TABLE speaker_talks RENAME COLUMN lien TO lien_video;
  END IF;
END $$;

-- ─── speaker_talks : colonnes manquantes ───
ALTER TABLE speaker_talks ADD COLUMN IF NOT EXISTS type          TEXT NOT NULL DEFAULT 'Conférence';
ALTER TABLE speaker_talks ADD COLUMN IF NOT EXISTS conference    TEXT;
ALTER TABLE speaker_talks ADD COLUMN IF NOT EXISTS ville         TEXT;
ALTER TABLE speaker_talks ADD COLUMN IF NOT EXISTS pays          TEXT;
-- date + description : présentes dans le CREATE TABLE mais oubliées ici, donc
-- absentes d'une table héritée de l'ancienne `talks`. addTalk écrit ces deux
-- colonnes : sans elles, tout ajout de talk échoue (migration 026).
ALTER TABLE speaker_talks ADD COLUMN IF NOT EXISTS date          TEXT;
ALTER TABLE speaker_talks ADD COLUMN IF NOT EXISTS description   TEXT;
ALTER TABLE speaker_talks ADD COLUMN IF NOT EXISTS lien_conf     TEXT;
ALTER TABLE speaker_talks ADD COLUMN IF NOT EXISTS lien_slides   TEXT;
ALTER TABLE speaker_talks ADD COLUMN IF NOT EXISTS lien_video    TEXT;
ALTER TABLE speaker_talks ADD COLUMN IF NOT EXISTS lien_feedback TEXT;
-- Provenance d'un import (moissonneur CFP) — migration 011_moissonneur_cfp.
ALTER TABLE speaker_talks ADD COLUMN IF NOT EXISTS source        TEXT NOT NULL DEFAULT 'manuel';
ALTER TABLE speaker_talks ADD COLUMN IF NOT EXISTS external_id   TEXT;

-- ─── Moissonneur CFP (migration 011_moissonneur_cfp.sql) ───
CREATE TABLE IF NOT EXISTS cfp_events (
  id          SERIAL PRIMARY KEY,
  nom         TEXT NOT NULL,
  source      TEXT NOT NULL,
  endpoint    TEXT NOT NULL,
  url         TEXT,
  ville       TEXT,
  pays        TEXT,
  date_debut  DATE,
  actif       BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (source, endpoint)
);

-- ─── Référence des conférences (migration 027) — AVANT talk_suggestions,
-- dont la FK la référence sur une base neuve. ───
CREATE TABLE IF NOT EXISTS conferences (
  id       SERIAL PRIMARY KEY,
  slug     TEXT NOT NULL UNIQUE,
  nom      TEXT NOT NULL,
  type     TEXT NOT NULL DEFAULT 'conference',  -- 'conference' | 'asso'
  ville    TEXT,
  pays     TEXT,
  site_url TEXT
);

CREATE TABLE IF NOT EXISTS conference_editions (
  id             SERIAL PRIMARY KEY,
  conference_id  INTEGER NOT NULL REFERENCES conferences(id) ON DELETE RESTRICT,
  type           TEXT NOT NULL DEFAULT 'edition', -- 'edition' | 'meetup'
  nom            TEXT,
  annee          INTEGER,
  date_debut     DATE,
  date_fin       DATE,
  ville          TEXT,
  pays           TEXT,
  lieu           TEXT,
  url            TEXT,
  source         TEXT,
  endpoint       TEXT,
  actif          BOOLEAN NOT NULL DEFAULT FALSE,
  propose_par    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  meetup_id      TEXT UNIQUE,
  CONSTRAINT conf_editions_source_endpoint_coherents
    CHECK ((source IS NULL) = (endpoint IS NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS conf_editions_source_endpoint_key
  ON conference_editions (source, endpoint) WHERE endpoint IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS conf_editions_conf_annee
  ON conference_editions (conference_id, annee) WHERE annee IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conf_editions_conference
  ON conference_editions (conference_id);
CREATE INDEX IF NOT EXISTS idx_conf_editions_date_debut
  ON conference_editions (date_debut);

CREATE TABLE IF NOT EXISTS talk_suggestions (
  id          SERIAL PRIMARY KEY,
  profile_id  INTEGER NOT NULL REFERENCES speaker_profiles(id) ON DELETE CASCADE,
  -- Depuis la migration 027 : l'événement est une conference_edition.
  event_id    INTEGER NOT NULL REFERENCES conference_editions(id) ON DELETE RESTRICT,
  external_id TEXT NOT NULL,
  titre       TEXT NOT NULL,
  description TEXT,
  date        TEXT,
  conference  TEXT,
  ville       TEXT,
  pays        TEXT,
  lien_conf   TEXT,
  statut      TEXT NOT NULL DEFAULT 'proposee',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profile_id, event_id, external_id)
);

-- Corrige un éventuel ancien CASCADE sur event_id (base PRÉ-027 uniquement :
-- après la reprise ci-dessous, confdeltype = 'r', bloc no-op) : RESTRICT.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conname = 'talk_suggestions_event_id_fkey' AND c.confdeltype = 'c'
  ) THEN
    ALTER TABLE talk_suggestions DROP CONSTRAINT talk_suggestions_event_id_fkey;
    ALTER TABLE talk_suggestions ADD CONSTRAINT talk_suggestions_event_id_fkey
      FOREIGN KEY (event_id) REFERENCES cfp_events(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- ─── Migration 027 : reprise cfp_events → conferences + conference_editions.
-- UNE seule fois : gardée par la CIBLE de la FK (les SERIAL des deux tables se
-- chevauchent, un re-remap corromprait la mémoire des refus). Sur base neuve
-- (FK déjà → conference_editions) comme sur base déjà migrée : no-op. ───
DO $$
BEGIN
  IF to_regclass('cfp_events') IS NOT NULL
     AND (SELECT confrelid::regclass::text FROM pg_constraint
           WHERE conname = 'talk_suggestions_event_id_fkey') = 'cfp_events' THEN

    -- Garde anti-collision : deux cfp_events AVEC suffixe d'année → même
    -- (conf, année) ⇒ stop (deux événements de même nom SANS année : légitimes).
    IF EXISTS (
      SELECT 1 FROM cfp_events
      WHERE substring(nom FROM '\s((19|20)\d{2})$') IS NOT NULL
      GROUP BY regexp_replace(nom, '\s+(19|20)\d{2}$', ''),
               substring(nom FROM '\s((19|20)\d{2})$')
      HAVING count(*) > 1
    ) THEN
      RAISE EXCEPTION 'cfp_events : doublon conf/année, réconciliation manuelle requise';
    END IF;

    -- Conférences (nom sans le suffixe année ; slug dérivé ; site_url NULL :
    -- cfp_events.url est une URL d'édition, posée sur l'édition ci-dessous).
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

    -- Une édition PAR ligne cfp_events (1-1). annee posée SEULEMENT si le nom
    -- finit par l'année (sinon NULL → libellé recomposé = ancien nom, intact).
    INSERT INTO conference_editions
      (conference_id, annee, date_debut, ville, pays, url, source, endpoint, actif)
    SELECT c.id, substring(e.nom FROM '\s((19|20)\d{2})$')::int,
           e.date_debut, e.ville, e.pays, e.url, e.source, e.endpoint, e.actif
      FROM cfp_events e
      JOIN conferences c ON c.nom = regexp_replace(e.nom, '\s+(19|20)\d{2}$', '')
    ON CONFLICT (source, endpoint) WHERE endpoint IS NOT NULL DO NOTHING;

    -- Garde loud-fail : TOUTE ligne cfp_events doit avoir son édition (une
    -- collision de slug laisserait le remap pointer la MAUVAISE édition).
    IF EXISTS (
      SELECT 1 FROM cfp_events e
      LEFT JOIN conference_editions ce
        ON ce.source = e.source AND ce.endpoint = e.endpoint
      WHERE ce.id IS NULL
    ) THEN
      RAISE EXCEPTION 'cfp_events : ligne sans édition correspondante (collision de slug ?), réconciliation manuelle';
    END IF;

    -- DROP FK → remap par clé naturelle → ADD FK (même nom, RESTRICT).
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

-- Rattachements à la référence (migration 027) : nullable, sans backfill.
ALTER TABLE speaker_talks ADD COLUMN IF NOT EXISTS edition_id
  INTEGER REFERENCES conference_editions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_speaker_talks_edition ON speaker_talks (edition_id);

-- ─── Tremplin (Phase A — socle, cf. db/migrations/010_tremplin.sql) ───
CREATE TABLE IF NOT EXISTS tremplin_editions (
  id           SERIAL PRIMARY KEY,
  nom          TEXT NOT NULL,
  annee        INTEGER NOT NULL,
  statut       TEXT NOT NULL DEFAULT 'ouvert',
  description  TEXT,
  conf_nom     TEXT,
  conf_date    DATE,
  conf_lien    TEXT,
  finale_date  DATE,
  finale_lieu  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tremplin_registrations (
  id              SERIAL PRIMARY KEY,
  edition_id      INTEGER NOT NULL REFERENCES tremplin_editions(id) ON DELETE CASCADE,
  "userId"        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  participante_nom      TEXT,
  participante_role     TEXT,
  participante_linkedin TEXT,
  statut          TEXT NOT NULL DEFAULT 'en_attente',
  sujet           TEXT,  -- legacy : retiré plus bas (DROP COLUMN, migration 035) ; conservé ici pour le backfill idempotent titre_palmares
  finale_presente BOOLEAN,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT registration_identite CHECK (
    "userId" IS NOT NULL OR participante_nom IS NOT NULL
  ),
  UNIQUE (edition_id, "userId")
);

CREATE TABLE IF NOT EXISTS tremplin_ateliers (
  id           SERIAL PRIMARY KEY,
  edition_id   INTEGER NOT NULL REFERENCES tremplin_editions(id) ON DELETE CASCADE,
  ordre        INTEGER NOT NULL DEFAULT 0,
  titre        TEXT NOT NULL,
  date         DATE,
  heure_debut  TIME,
  heure_fin    TIME,
  description  TEXT,
  lien_visio   TEXT,
  coachs       TEXT
);
CREATE TABLE IF NOT EXISTS tremplin_atelier_membres (
  atelier_id      INTEGER NOT NULL REFERENCES tremplin_ateliers(id) ON DELETE CASCADE,
  registration_id INTEGER NOT NULL REFERENCES tremplin_registrations(id) ON DELETE CASCADE,
  PRIMARY KEY (atelier_id, registration_id)
);

-- Migration 017 — coachs reliés aux comptes de la plateforme.
CREATE TABLE IF NOT EXISTS tremplin_atelier_coachs (
  atelier_id INTEGER NOT NULL REFERENCES tremplin_ateliers(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (atelier_id, user_id)
);

CREATE TABLE IF NOT EXISTS tremplin_documents (
  id              SERIAL PRIMARY KEY,
  edition_id      INTEGER NOT NULL REFERENCES tremplin_editions(id) ON DELETE CASCADE,
  atelier_id      INTEGER REFERENCES tremplin_ateliers(id) ON DELETE CASCADE,
  registration_id INTEGER REFERENCES tremplin_registrations(id) ON DELETE CASCADE,
  auteur_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  type            TEXT NOT NULL DEFAULT 'autre',
  titre           TEXT NOT NULL,
  lien            TEXT,
  contenu         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT document_a_un_support CHECK (lien IS NOT NULL OR contenu IS NOT NULL)
);

-- ─── Tremplin Phase 2b — pages d'édition publiques (cf. migration 012) ───
ALTER TABLE tremplin_editions ADD COLUMN IF NOT EXISTS conf_slug TEXT;
UPDATE tremplin_editions SET conf_slug = 'devfest-toulouse'
 WHERE conf_slug IS NULL AND annee = 2026;
ALTER TABLE tremplin_registrations ADD COLUMN IF NOT EXISTS public            BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE tremplin_registrations ADD COLUMN IF NOT EXISTS public_consent_at TIMESTAMPTZ;
ALTER TABLE tremplin_registrations ADD COLUMN IF NOT EXISTS recompense        TEXT;
ALTER TABLE tremplin_registrations ADD COLUMN IF NOT EXISTS bio               TEXT;
ALTER TABLE tremplin_registrations ADD COLUMN IF NOT EXISTS site_web          TEXT;
ALTER TABLE tremplin_registrations ADD COLUMN IF NOT EXISTS photo_url         TEXT;
-- Migration 032 — talk mis en avant rattaché à l'inscription (speaker_talks).
ALTER TABLE tremplin_registrations ADD COLUMN IF NOT EXISTS talk_id INTEGER REFERENCES speaker_talks(id) ON DELETE SET NULL;
-- Migration 015 — coachs sur les ateliers (la table membres est créée plus haut).
ALTER TABLE tremplin_ateliers ADD COLUMN IF NOT EXISTS coachs TEXT;
-- Migration 016 — dates d'inscriptions (état « ouvertes » dérivé de la date du jour).
ALTER TABLE tremplin_editions ADD COLUMN IF NOT EXISTS inscriptions_debut DATE;
ALTER TABLE tremplin_editions ADD COLUMN IF NOT EXISTS inscriptions_fin   DATE;

CREATE TABLE IF NOT EXISTS tremplin_photos (
  id          SERIAL PRIMARY KEY,
  edition_id  INTEGER NOT NULL REFERENCES tremplin_editions(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  legende     TEXT,
  kind        TEXT NOT NULL DEFAULT 'autre',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tremplin_photo_personnes (
  photo_id        INTEGER NOT NULL REFERENCES tremplin_photos(id) ON DELETE CASCADE,
  registration_id INTEGER NOT NULL REFERENCES tremplin_registrations(id) ON DELETE CASCADE,
  PRIMARY KEY (photo_id, registration_id)
);
CREATE TABLE IF NOT EXISTS tremplin_consent_log (
  id              SERIAL PRIMARY KEY,
  registration_id INTEGER NOT NULL REFERENCES tremplin_registrations(id) ON DELETE CASCADE,
  action          TEXT NOT NULL CHECK (action IN ('accorde', 'retire')),
  base            TEXT NOT NULL DEFAULT 'self'
                  CHECK (base IN ('self', 'formulaire_inscription', 'email', 'autre')),
  preuve_lien     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Migration 037 — provenance + preuve du consentement (bases existantes).
ALTER TABLE tremplin_consent_log
  ADD COLUMN IF NOT EXISTS base TEXT NOT NULL DEFAULT 'self'
    CHECK (base IN ('self', 'formulaire_inscription', 'email', 'autre'));
ALTER TABLE tremplin_consent_log
  ADD COLUMN IF NOT EXISTS preuve_lien TEXT;

-- ─── Contact modéré des speakeuses ───
CREATE TABLE IF NOT EXISTS contact_messages (
  id           SERIAL PRIMARY KEY,
  profile_id   INTEGER NOT NULL REFERENCES speaker_profiles(id) ON DELETE CASCADE,
  reason       TEXT NOT NULL,
  sender_name  TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  body         TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'en_attente',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  moderated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  moderated_at TIMESTAMPTZ,
  notified_at  TIMESTAMPTZ
);

-- ─── Index (requêtes chaudes) ───
CREATE UNIQUE INDEX IF NOT EXISTS idx_editions_conf_annee ON tremplin_editions (conf_slug, annee);
CREATE INDEX IF NOT EXISTS idx_speaker_talks_profile ON speaker_talks (speaker_profile_id);
CREATE INDEX IF NOT EXISTS idx_speaker_profiles_status ON speaker_profiles (status);
-- Slug fiche (migration 044) : index UNIQUE puis backfill idempotent. NULL
-- multiple autorisé (Postgres) : les fiches sans nom restent sans slug.
CREATE UNIQUE INDEX IF NOT EXISTS idx_speaker_profiles_slug ON speaker_profiles (slug);
WITH base AS (
  SELECT sp.id,
         trim(BOTH '-' FROM lower(regexp_replace(
           translate(u.name,
                     'àâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ',
                     'aaaeeeeiioouuucAAAEEEEIIOOUUUC'),
           '[^a-zA-Z0-9]+', '-', 'g'))) AS base
    FROM speaker_profiles sp
    JOIN users u ON u.id = sp."userId"
   WHERE sp.slug IS NULL
     AND u.name IS NOT NULL
),
candidat AS (
  SELECT id, base,
         row_number() OVER (PARTITION BY base ORDER BY id) AS rang
    FROM base
   WHERE base <> ''
)
UPDATE speaker_profiles sp
   SET slug = CASE
                -- Base tout en chiffres : « /speakeuses/1234 » serait résolu
                -- comme un id (jamais comme un slug) → on suffixe l'id pour
                -- garantir au moins une non-chiffre.
                WHEN c.base ~ '^[0-9]+$' THEN c.base || '-' || sp.id
                WHEN c.rang = 1
                     AND NOT EXISTS (
                       SELECT 1 FROM speaker_profiles x WHERE x.slug = c.base
                     )
                THEN c.base
                ELSE c.base || '-' || sp.id
              END
  FROM candidat c
 WHERE sp.id = c.id
   AND sp.slug IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_name ON users (name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS speaker_talks_profile_source_external_id_key
  ON speaker_talks (speaker_profile_id, source, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_talk_suggestions_profile_statut
  ON talk_suggestions (profile_id, statut);
CREATE INDEX IF NOT EXISTS idx_contact_messages_status
  ON contact_messages (status);
CREATE INDEX IF NOT EXISTS idx_contact_messages_profile_status
  ON contact_messages (profile_id, status);
CREATE INDEX IF NOT EXISTS idx_registrations_edition   ON tremplin_registrations (edition_id);
CREATE INDEX IF NOT EXISTS idx_registrations_user      ON tremplin_registrations ("userId");
CREATE INDEX IF NOT EXISTS idx_tremplin_ateliers_edition ON tremplin_ateliers (edition_id);
CREATE INDEX IF NOT EXISTS idx_documents_edition       ON tremplin_documents (edition_id);
CREATE INDEX IF NOT EXISTS idx_documents_atelier       ON tremplin_documents (atelier_id);
CREATE INDEX IF NOT EXISTS idx_documents_registration  ON tremplin_documents (registration_id);
CREATE INDEX IF NOT EXISTS idx_tremplin_photos_edition      ON tremplin_photos (edition_id);
CREATE INDEX IF NOT EXISTS idx_photo_personnes_registration ON tremplin_photo_personnes (registration_id);
CREATE INDEX IF NOT EXISTS idx_consent_log_registration     ON tremplin_consent_log (registration_id);
CREATE INDEX IF NOT EXISTS idx_atelier_membres_registration ON tremplin_atelier_membres (registration_id);
CREATE INDEX IF NOT EXISTS idx_atelier_coachs_user ON tremplin_atelier_coachs (user_id);
CREATE TABLE IF NOT EXISTS tremplin_registration_coachs (
  registration_id INTEGER NOT NULL REFERENCES tremplin_registrations(id) ON DELETE CASCADE,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (registration_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_registration_coachs_user ON tremplin_registration_coachs (user_id);

-- Migration 018 — récompenses attribuables et suivies (distinctes du podium).
CREATE TABLE IF NOT EXISTS tremplin_recompenses (
  id            SERIAL PRIMARY KEY,
  edition_id    INTEGER NOT NULL REFERENCES tremplin_editions(id) ON DELETE CASCADE,
  intitule      TEXT NOT NULL,
  detail        TEXT,
  rang          INTEGER,
  beneficiaire_registration_id INTEGER REFERENCES tremplin_registrations(id) ON DELETE SET NULL,
  motif         TEXT,
  statut        TEXT NOT NULL DEFAULT 'a_organiser'
                CHECK (statut IN ('a_organiser', 'planifiee', 'realisee')),
  evenement_le  DATE,
  attribuee_le  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recompenses_edition ON tremplin_recompenses (edition_id);
CREATE INDEX IF NOT EXISTS idx_recompenses_beneficiaire
  ON tremplin_recompenses (beneficiaire_registration_id);

-- Migration 019 — parcours : phase d'entrée + présence aux ateliers (tri-état).
ALTER TABLE tremplin_registrations ADD COLUMN IF NOT EXISTS phase_entree TEXT NOT NULL
  DEFAULT 'cfp_et_pitch'
  CHECK (phase_entree IN ('cfp_et_pitch', 'finale', 'montee_sur_scene'));
ALTER TABLE tremplin_atelier_membres ADD COLUMN IF NOT EXISTS presence TEXT NOT NULL
  DEFAULT 'non_renseignee'
  CHECK (presence IN ('non_renseignee', 'presente', 'absente'));

-- Migration 020 — photos : tags libres + consentement par tag.
ALTER TABLE tremplin_photo_personnes ADD COLUMN IF NOT EXISTS id SERIAL;
-- Le DROP de l'ancienne clé (photo_id, registration_id) est DANS la garde : hors
-- d'elle, chaque déploiement retirait la clé primaire pour la reposer aussitôt,
-- soit un index unique reconstruit à chaque fois sur toute la table, et une
-- fenêtre sans clé primaire au milieu de la transaction de migration.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'tremplin_photo_personnes'::regclass
       AND contype = 'p'
       AND (SELECT array_agg(attname::text ORDER BY attname::text)
              FROM pg_attribute
             WHERE attrelid = conrelid AND attnum = ANY (conkey)) = ARRAY['id']
  ) THEN
    ALTER TABLE tremplin_photo_personnes DROP CONSTRAINT IF EXISTS tremplin_photo_personnes_pkey;
    ALTER TABLE tremplin_photo_personnes ADD CONSTRAINT tremplin_photo_personnes_pkey PRIMARY KEY (id);
  END IF;
END $$;
ALTER TABLE tremplin_photo_personnes ALTER COLUMN registration_id DROP NOT NULL;
ALTER TABLE tremplin_photo_personnes ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE tremplin_photo_personnes ADD COLUMN IF NOT EXISTS nom_libre TEXT;
ALTER TABLE tremplin_photo_personnes ADD COLUMN IF NOT EXISTS consentement BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE tremplin_photo_personnes ADD COLUMN IF NOT EXISTS consentement_le TIMESTAMPTZ;
-- La contrainte `photo_personne_identite` de la 020 n'est PAS reprise ici : la
-- 021 la supprime vingt lignes plus bas, et la revalider à chaque rejeu coûtait
-- un déploiement entier. Ce fichier décrit l'état CIBLE, pas l'histoire.
-- Pourquoi, en détail : src/__tests__/sync-rejeu-avec-donnees.integration.test.ts.
CREATE UNIQUE INDEX IF NOT EXISTS idx_photo_personnes_reg_unique
  ON tremplin_photo_personnes (photo_id, registration_id) WHERE registration_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_photo_personnes_user_unique
  ON tremplin_photo_personnes (photo_id, user_id) WHERE user_id IS NOT NULL;

-- Migration 021 — photos : FK compte/inscription en ON DELETE SET NULL.
-- Supprimer le compte (ou retirer l'inscription) d'une personne taguée NE
-- supprime plus son tag en cascade — ce qui aurait republié la photo alors
-- qu'elle peut encore montrer cette personne. Le tag subsiste, orphelin et
-- anonyme, et reste bloquant tant que « consentement recueilli » n'est pas
-- coché. Le CHECK d'identité est retiré (un orphelin n'a plus d'identité) :
-- la garde « un tag a une identité à la CRÉATION » reste applicative
-- (addPhotoTag) — le SET NULL est le seul chemin vers un tag orphelin.
-- CE DROP EST PORTEUR, pas un vestige : une base figée avant la 021 porte
-- encore la contrainte, et le SET NULL ci-dessous y rend l'effacement d'un
-- compte IMPOSSIBLE (RGPD art. 17). Le retirer comme « code mort » casserait
-- cette base sans bruit — un cas du test ci-dessus le verrouille.
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

-- Migration 022 — classement structuré + raison de transfert publique.
-- `classement` (entier) structure le rang de podium (ex-texte libre `recompense`)
-- pour trier, compter et apparier au barème / dériver l'origine d'un transfert ;
-- backfill best-effort depuis `recompense`. `transfert_raison` : raison PUBLIQUE
-- énumérée (sans nom) ; le `motif` texte libre reste interne.
ALTER TABLE tremplin_registrations ADD COLUMN IF NOT EXISTS classement INTEGER;
UPDATE tremplin_registrations
   SET classement = CASE
     WHEN recompense ~ '^\s*1' THEN 1
     WHEN recompense ~ '^\s*2' THEN 2
     WHEN recompense ~ '^\s*3' THEN 3
     ELSE NULL
   END
 WHERE classement IS NULL AND recompense IS NOT NULL;
ALTER TABLE tremplin_recompenses ADD COLUMN IF NOT EXISTS transfert_raison TEXT
  CHECK (transfert_raison IS NULL OR transfert_raison IN ('cfp_officiel', 'autre'));

-- Migration 023 — retrait de la colonne morte `recompense` (contract, APRÈS le
-- backfill de `classement` ci-dessus).
ALTER TABLE tremplin_registrations DROP COLUMN IF EXISTS recompense;

-- Migration 024 — un seul rang de podium par édition (invariant de la
-- dérivation d'origine des transferts). APRÈS le backfill de `classement`.
CREATE UNIQUE INDEX IF NOT EXISTS idx_registrations_classement_unique
  ON tremplin_registrations (edition_id, classement) WHERE classement IS NOT NULL;

-- Migration 025 — phases : phase de l'atelier, appartenance multi-phase, jury.
ALTER TABLE tremplin_ateliers ADD COLUMN IF NOT EXISTS phase TEXT NOT NULL
  DEFAULT 'cfp_et_pitch'
  CHECK (phase IN ('cfp_et_pitch', 'montee_sur_scene'));

-- Migration 047 — ateliers : lieu physique, fenêtre de dates, nature ; table des
-- sous-groupes ; rattachement des membres à un sous-groupe. Additif, idempotent.
-- Cf. docs/conception-sous-groupes-ateliers.md. Bloc IDENTIQUE à db/migrations/047.
ALTER TABLE tremplin_ateliers ADD COLUMN IF NOT EXISTS date_fin DATE;
ALTER TABLE tremplin_ateliers ADD COLUMN IF NOT EXISTS lieu TEXT;
ALTER TABLE tremplin_ateliers ADD COLUMN IF NOT EXISTS nature TEXT NOT NULL
  DEFAULT 'collectif'
  CHECK (nature IN ('collectif', 'sous_groupes'));
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tremplin_ateliers_fenetre_coherente'
  ) THEN
    ALTER TABLE tremplin_ateliers ADD CONSTRAINT tremplin_ateliers_fenetre_coherente
      CHECK (date_fin IS NULL OR date IS NULL OR date_fin >= date);
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS tremplin_atelier_sous_groupes (
  id            SERIAL PRIMARY KEY,
  atelier_id    INTEGER NOT NULL REFERENCES tremplin_ateliers(id) ON DELETE CASCADE,
  libelle       TEXT NOT NULL,
  coach_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  lien_visio    TEXT,
  fait_le       DATE
);
CREATE INDEX IF NOT EXISTS idx_sous_groupes_atelier ON tremplin_atelier_sous_groupes (atelier_id);
ALTER TABLE tremplin_atelier_membres
  ADD COLUMN IF NOT EXISTS sous_groupe_id INTEGER
  REFERENCES tremplin_atelier_sous_groupes(id) ON DELETE SET NULL;
CREATE TABLE IF NOT EXISTS tremplin_registration_phases (
  registration_id INTEGER NOT NULL REFERENCES tremplin_registrations(id) ON DELETE CASCADE,
  phase           TEXT NOT NULL
                  CHECK (phase IN ('cfp_et_pitch', 'finale', 'montee_sur_scene')),
  PRIMARY KEY (registration_id, phase)
);
CREATE TABLE IF NOT EXISTS tremplin_jury (
  id          SERIAL PRIMARY KEY,
  edition_id  INTEGER NOT NULL REFERENCES tremplin_editions(id) ON DELETE CASCADE,
  nom         TEXT NOT NULL,
  prenom      TEXT,
  fonction    TEXT,
  entreprise  TEXT,
  email       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_jury_edition ON tremplin_jury (edition_id);
-- Reprise de l'existant : appartenance dérivée de `phase_entree` (phase 2 ⊂
-- phase 1). Idempotent (ON CONFLICT).
INSERT INTO tremplin_registration_phases (registration_id, phase)
SELECT id, 'cfp_et_pitch' FROM tremplin_registrations
 WHERE phase_entree IN ('cfp_et_pitch', 'finale') OR finale_presente = true
ON CONFLICT DO NOTHING;
INSERT INTO tremplin_registration_phases (registration_id, phase)
SELECT id, 'montee_sur_scene' FROM tremplin_registrations
 WHERE phase_entree = 'montee_sur_scene'
ON CONFLICT DO NOTHING;

-- Migration 027 — conférence partenaire d'un Tremplin pointée dans la
-- référence (conference_edition_id : edition_id désigne l'édition de Tremplin).
ALTER TABLE tremplin_editions ADD COLUMN IF NOT EXISTS conference_edition_id
  INTEGER REFERENCES conference_editions(id) ON DELETE SET NULL;

-- Migration 028 — suppression d'édition : tombstone d'une édition publiée
-- (données effacées, coquille gardée pour l'URL). Idempotent.
ALTER TABLE tremplin_editions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Migration 029 — lieu de la conférence (ville OU pays) + correctif du nom
-- (l'année est l'édition, jamais le nom de la conf récurrente). Idempotent.
ALTER TABLE tremplin_editions ADD COLUMN IF NOT EXISTS conf_lieu TEXT;
-- Correction ponctuelle du nom historique (garde : conf_slug/conf_nom existent
-- déjà en prod via 010/012 ; l'anti-drift et le test « reprise legacy » partent
-- de tables minimales où ces colonnes peuvent manquer).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'tremplin_editions' AND column_name = 'conf_nom'
  ) THEN
    UPDATE tremplin_editions
       SET conf_nom = 'DevFest', conf_lieu = 'Toulouse'
     WHERE conf_slug = 'devfest-toulouse' AND conf_nom = 'DevFest Toulouse 2026';
  END IF;
END $$;

-- Migration 030 — réglages de la plateforme : table clé-valeur (défauts dans
-- le code, pas de seed). Idempotent.
CREATE TABLE IF NOT EXISTS plateforme_reglages (
  cle        TEXT PRIMARY KEY,
  valeur     TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Migration 031 — « ouvert à toutes » : propriété EXPLICITE de l'atelier
-- (opt-in), plus d'implicite « aucun membre = ouvert ». Les ateliers existants
-- sans membre étaient ouverts DE FAIT : on préserve leur comportement une
-- seule fois (backfill dans le même garde : jamais rejoué, une refermeture
-- manuelle ultérieure ne sera pas écrasée). Idempotent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'tremplin_ateliers' AND column_name = 'ouvert_a_toutes'
  ) THEN
    ALTER TABLE tremplin_ateliers
      ADD COLUMN ouvert_a_toutes BOOLEAN NOT NULL DEFAULT false;
    UPDATE tremplin_ateliers a
       SET ouvert_a_toutes = true
     WHERE NOT EXISTS (
       SELECT 1 FROM tremplin_atelier_membres m WHERE m.atelier_id = a.id
     );
  END IF;
END $$;

-- ─── (Optionnel) Te désigner orga, pour tester la modération ───
-- Remplace par TON adresse (celle utilisée pour te connecter) :
-- UPDATE users SET is_orga = true WHERE email = 'ton-email@exemple.fr';
-- (Pense à te reconnecter après : le rôle est lu à la connexion.)

-- ─── Palmarès figé + retrait de « sujet » (migrations 034 & 035) ───
-- Le titre pitché est désormais lu directement depuis le talk (`talk_id →
-- speaker_talks.titre`) ; le palmarès lit l'archive figée `titre_palmares`.
-- Plus de colonne `sujet` ni de trigger de miroir.
-- 034 (additive) : archive du palmarès.
ALTER TABLE tremplin_registrations ADD COLUMN IF NOT EXISTS titre_palmares TEXT;
-- Backfill gardé par l'existence de `sujet` : au 2e passage (colonne déjà
-- droppée par la 035 ci-dessous), le bloc est sauté → idempotent.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'tremplin_registrations' AND column_name = 'sujet') THEN
    UPDATE tremplin_registrations
       SET titre_palmares = sujet
     WHERE classement IS NOT NULL
       AND titre_palmares IS NULL
       AND sujet IS NOT NULL
       AND btrim(sujet) <> '';
  END IF;
END $$;
-- 035 (destructive) : retrait des triggers de miroir et de la colonne sujet.
DROP TRIGGER IF EXISTS trg_registration_sujet_from_talk ON tremplin_registrations;
DROP TRIGGER IF EXISTS trg_talk_titre_to_sujet ON speaker_talks;
DROP FUNCTION IF EXISTS tremplin_sujet_from_talk();
DROP FUNCTION IF EXISTS tremplin_propagate_talk_titre();
ALTER TABLE tremplin_registrations DROP COLUMN IF EXISTS sujet;

-- 036 : contenus éditoriaux (publications = article/actualité + pages).
CREATE TABLE IF NOT EXISTS contenus (
  id           SERIAL PRIMARY KEY,
  type         TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE,
  titre        TEXT NOT NULL,
  chapo        TEXT,
  corps        TEXT NOT NULL DEFAULT '',
  image_url    TEXT,
  image_alt    TEXT,
  categorie    TEXT,
  tag          TEXT,
  lien         TEXT,
  lien_externe TEXT,
  lien_label   TEXT,
  statut       TEXT NOT NULL DEFAULT 'brouillon',
  publie_le    DATE,
  maj_le       TIMESTAMPTZ NOT NULL DEFAULT now(),
  au_flux      BOOLEAN NOT NULL DEFAULT TRUE,        -- au flux RSS ? (seed historique = false)
  CONSTRAINT contenus_type_ck   CHECK (type IN ('publication', 'page')),
  CONSTRAINT contenus_statut_ck CHECK (statut IN ('brouillon', 'publie')),
  CONSTRAINT contenus_img_alt_ck CHECK (image_url IS NULL OR image_alt IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_contenus_type_statut ON contenus (type, statut);
CREATE INDEX IF NOT EXISTS idx_contenus_publie_le   ON contenus (publie_le);

-- 038 : drapeau de diffusion RSS. Sur une base où `contenus` existe déjà (036),
-- le CREATE TABLE ci-dessus est un no-op : il faut l'ALTER pour ajouter la colonne.
ALTER TABLE contenus ADD COLUMN IF NOT EXISTS au_flux BOOLEAN NOT NULL DEFAULT TRUE;

-- 039 : localisation de résidence structurée (BAN). `region_residence` est
-- distincte de `regions` (zones d'intervention). Idempotente.
ALTER TABLE speaker_profiles
  ADD COLUMN IF NOT EXISTS code_postal      TEXT,
  ADD COLUMN IF NOT EXISTS code_insee       TEXT,
  ADD COLUMN IF NOT EXISTS region_residence TEXT;

-- 040 : un article peut pointer une édition de conférence du répertoire. La page
-- article liste alors automatiquement les speakeuses publiées ayant un talk sur
-- cette édition (speaker_talks.edition_id). NULL = non rattaché. Idempotent.
ALTER TABLE contenus ADD COLUMN IF NOT EXISTS conference_edition_id
  INTEGER REFERENCES conference_editions(id) ON DELETE SET NULL;

-- 041 : propositions de conférences par les membres (modération). Une conf
-- proposée n'entre dans le répertoire qu'après validation orga. Idempotent.
CREATE TABLE IF NOT EXISTS conference_propositions (
  id           SERIAL PRIMARY KEY,
  nom          TEXT NOT NULL,
  annee        INTEGER,
  ville        TEXT,
  url          TEXT,
  endpoint     TEXT,
  propose_par  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 042 : line-up DevFest Toulouse 2026 — backfill de DONNÉES (pas de schéma).
-- Relie les talks déjà en base à l'édition « DevFest Toulouse 2026 » pour que
-- /devfest-toulouse et l'article rattaché listent les speakeuses publiées (via
-- speaker_talks.edition_id). Ponctuel ET idempotent : chaque écriture est gardée
-- pour ne jamais réécrire un choix orga ultérieur ; toute pose d'edition_id passe
-- par JOIN sur l'édition (édition absente ⇒ 0 ligne, jamais de NULL, l'état se
-- rattrape au déploiement suivant). Aucune donnée personnelle (e-mail). No-op sur
-- base vierge (tests). Détail : db/migrations/042_*.sql.

-- Garantir l'édition (index UNIQUE partiel conf_editions_conf_annee → ON CONFLICT).
INSERT INTO conference_editions (conference_id, type, annee, date_debut, ville, pays, url)
SELECT c.id, 'edition', 2026, DATE '2026-11-19', 'Toulouse', 'France', 'https://devfesttoulouse.fr'
  FROM conferences c
 WHERE c.slug = 'devfest-toulouse'
ON CONFLICT (conference_id, annee) WHERE annee IS NOT NULL DO NOTHING;

-- Talks confirmés du programme officiel (Leïla, Géraldine, Cateline, Asma) :
-- sélection par attributs, sans id en dur. lower(trim(...)) tolère casse/espaces.
-- JOIN + edition_id IS NULL = sûr (édition absente ⇒ 0 ligne, jamais de NULL).
UPDATE speaker_talks st
   SET edition_id = ce.id
  FROM conference_editions ce
  JOIN conferences c ON c.id = ce.conference_id
 WHERE c.slug = 'devfest-toulouse'
   AND ce.annee = 2026
   AND st.edition_id IS NULL
   AND st.source = 'manuel'
   AND lower(trim(st.conference)) IN ('devfest', 'devfest toulouse')
   AND st.date LIKE '2026%';

-- Montaine Marteau : talk DevFest 2026 absent de la base, on le crée. Profil
-- résolu par le NOM (attribut stable), pas par PK brute (sync-to-latest.sql est
-- rejoué sur toute base : un id en dur pourrait désigner quelqu'un d'autre).
-- Édition jointe (pas d'orphelin si l'édition manque) ; idempotence gardée sur
-- l'identité stable (profil + édition), pas le titre. Résumé = abstract public.
INSERT INTO speaker_talks
       (speaker_profile_id, titre, type, conference, ville, pays, date, description, source, edition_id)
SELECT sp.id,
       'Construisez le dashboard qui répond à vos questions',
       'Quickie / Lightning', 'DevFest Toulouse', 'Toulouse', 'France', '2026-11-19',
       $desc$Vous, votre équipe, votre direction : le même dashboard sous les yeux. Personne n'y trouve toutes ses réponses. Et chacun y cherche des infos différentes. La version qui conviendrait à tout le monde ? Avec l'abonnement premium qui est hors budget. À force d'ouvrir dix onglets pour savoir où on en était, j'ai créé le dashboard adapté à mes besoins. Je manage, je ne code pas. Depuis, je l'utilise tous les jours et j'en ai fait d'autres. Je partagerai trois dashboards que je me suis construits : une timeline multi-projets, un daily enrichi des infos Git, un suivi d'équipe sur mesure. Puis la méthode : MCP + vibe-coding. Non-devs : ce qu'on peut réaliser sans coder. Devs : les outils que l'on peut développer à côté de la prod. Vous repartirez avec une question : quel dashboard vous manque vraiment. Et la méthode pour le construire.$desc$,
       'manuel', ce.id
  FROM speaker_profiles sp
  JOIN users u ON u.id = sp."userId"
  JOIN conferences c ON c.slug = 'devfest-toulouse'
  JOIN conference_editions ce ON ce.conference_id = c.id AND ce.annee = 2026
 WHERE lower(u.name) = 'montaine marteau'
   AND NOT EXISTS (
     SELECT 1 FROM speaker_talks st2
      WHERE st2.speaker_profile_id = sp.id
        AND st2.edition_id = ce.id
   );

-- 043 : Sandrine Berger et Camille Ghibaudo (correction de la promotion 042).
--
-- Sandrine : acceptée au CFP (talk confirmé) mais ne l'a jamais saisi sur sa fiche.
-- Sa seule trace en base était sa proposition Tremplin ; on n'en fait PAS un talk
-- confirmé (elle reste un artefact Tremplin, masqué du public). On INSÈRE plutôt
-- son vrai talk DevFest comme talk manuel relié à l'édition (comme Montaine), avec
-- son résumé officiel. Profil résolu par le nom ; idempotent (NOT EXISTS profil +
-- édition) ; édition jointe (pas d'orphelin si l'édition manque).
INSERT INTO speaker_talks
       (speaker_profile_id, titre, type, conference, ville, pays, date, description, source, edition_id)
SELECT sp.id,
       'L''IA à l''épreuve du monde physique',
       'Conférence', 'DevFest Toulouse', 'Toulouse', 'France', '2026-11-19',
       $desc$On entend partout que Claude code votre site et que ChatGPT rédige vos contrats. Mais une IA qui comprend vraiment la physique ? Ça, c'est une autre histoire. Et 2026 le confirme : pendant que NVIDIA construit des usines à données synthétiques, physiciens et roboticiens se ruent sur la simulation.

Ici, le vrai goulot d'étranglement n'est pas l'algorithme. Je le sais parce que j'ai passé des mois à entraîner des agents RL à piloter une aile, et le modèle, c'était la partie facile. Tout le travail était ailleurs : leur construire un monde assez fidèle pour qu'ils apprennent quelque chose d'utile. Car contrairement au texte, la réalité physique ne se scrape pas.

C'est de là que part ce talk. On verra pourquoi chaque donnée physique coûte si cher, pourquoi on ne peut pas scaler comme avec les LLMs, et quelles réponses émergent aujourd'hui, des surrogates aux données synthétiques en passant par le transfer learning et les neural operators. Le tout autour d'un même fil rouge, le compromis fidélité contre coût, sans cacher ce qui reste encore ouvert.

Le public repartira en sachant exactement où se trouve le vrai chantier, l'un des problèmes les plus fascinants du moment. Parce que ce monde simulé, fidèle et entraînable, il reste à construire. Peut-être par l'un d'entre eux.$desc$,
       'manuel', ce.id
  FROM speaker_profiles sp
  JOIN users u ON u.id = sp."userId"
  JOIN conferences c ON c.slug = 'devfest-toulouse'
  JOIN conference_editions ce ON ce.conference_id = c.id AND ce.annee = 2026
 WHERE lower(u.name) = 'sandrine berger'
   AND NOT EXISTS (
     SELECT 1 FROM speaker_talks st2
      WHERE st2.speaker_profile_id = sp.id AND st2.edition_id = ce.id
   );

-- Camille Ghibaudo : sa proposition Tremplin (#26) EST son talk DevFest (salle des
-- communautés). On la promeut en talk confirmé + relié. Gardes : source='tremplin'
-- (promotion unique) + JOIN sur l'édition (édition absente ⇒ 0 ligne). Plus de garde
-- status='publie' : l'affichage public (status='publie', conference-speakers.ts) reste
-- le seul gardien du consentement ; la garde forçait sinon un redéploiement après la
-- publication de la fiche. FORMAT (type) : « Conférence » (confirmé par l'orga).
UPDATE speaker_talks st
   SET source = 'manuel', type = 'Conférence', conference = 'DevFest Toulouse',
       date = '2026-11-19', ville = 'Toulouse', pays = 'France', edition_id = ce.id
  FROM conference_editions ce
  JOIN conferences c ON c.id = ce.conference_id
 WHERE c.slug = 'devfest-toulouse' AND ce.annee = 2026
   AND st.id = 26 AND st.source = 'tremplin';
   -- Camille Ghibaudo, talk Tremplin (salle des communautés)

-- ─── Occurrences d'un talk (migration 044, EXPAND-only) ───
-- speaker_talks = identité ; une occurrence = une fois où le talk a été donné,
-- rattachée au registre (conference_id + edition_id). Cf.
-- docs/conception-talk-multi-conferences.md. Définition IDENTIQUE à schema.sql
-- (drift-test). Le backfill et la normalisation de source sont idempotents.
-- PLACÉ EN FIN DE FICHIER, APRÈS le bloc 043 (Sandrine/Camille) : ces inserts
-- écrivent encore les colonnes plates legacy de speaker_talks ; le backfill doit
-- passer derrière eux pour leur créer leur occurrence (même ordre qu'en prod :
-- migration 043 puis 044).
CREATE TABLE IF NOT EXISTS talk_occurrences (
  id                 SERIAL PRIMARY KEY,
  talk_id            INTEGER NOT NULL REFERENCES speaker_talks(id) ON DELETE CASCADE,
  speaker_profile_id INTEGER NOT NULL REFERENCES speaker_profiles(id) ON DELETE CASCADE,
  conference_id INTEGER REFERENCES conferences(id) ON DELETE SET NULL,
  edition_id    INTEGER REFERENCES conference_editions(id) ON DELETE SET NULL,
  conference    TEXT,
  ville         TEXT,
  pays          TEXT,
  date          TEXT,
  lien_conf     TEXT,
  lien_slides   TEXT,
  lien_video    TEXT,
  lien_feedback TEXT,
  source        TEXT NOT NULL DEFAULT 'manuel',
  external_id   TEXT
);
CREATE INDEX IF NOT EXISTS idx_talk_occurrences_talk ON talk_occurrences (talk_id);
CREATE INDEX IF NOT EXISTS idx_talk_occurrences_conference ON talk_occurrences (conference_id);
CREATE INDEX IF NOT EXISTS idx_talk_occurrences_edition ON talk_occurrences (edition_id);
CREATE UNIQUE INDEX IF NOT EXISTS talk_occurrences_profile_source_external_id_key
  ON talk_occurrences (speaker_profile_id, source, external_id) WHERE external_id IS NOT NULL;

-- Backfill : chaque talk déjà donné devient une occurrence (idempotent : gardé
-- par NOT EXISTS). conference_id déduit de l'édition ; talks libres historiques
-- laissés sans conference_id (aucun matching par nom).
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

-- speaker_talks.source ne garde que le sens « visibilité » ('manuel' | 'tremplin').
UPDATE speaker_talks SET source = 'manuel'
 WHERE source NOT IN ('manuel', 'tremplin');

-- ─── Traces des SEEDS de contenu déjà posés une fois (migration 059) ───
--
-- `sync-to-latest.sql` est rejoué à CHAQUE déploiement. Un seed de contenu gardé
-- par le seul `ON CONFLICT (slug) DO NOTHING` ne tient que tant qu'une ligne
-- porte ce slug : supprimer l'article dans l'admin le fait revenir au
-- déploiement suivant (une demande de retrait s'annule toute seule), et le
-- RENOMMER libère le slug — le seed réinsère alors un doublon qui, à date de
-- publication égale, gagne l'affichage public (`ORDER BY … id DESC`).
--
-- Un seed se pose UNE fois. Cette table dit lesquels sont passés. Elle est
-- créée ICI parce que les seeds gardés la lisent plus bas.
CREATE TABLE IF NOT EXISTS seeds_appliques (
  cle         TEXT PRIMARY KEY,
  applique_le TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RATTRAPAGE D'UNE BASE DÉJÀ EN LIGNE, avant tout seed gardé.
--
-- La prod tourne depuis des mois : les articles y sont, et aucune trace, puisque
-- le mécanisme arrive avec ce déploiement. Sans ce rattrapage, le tout premier
-- rejeu verrait les gardes encore ouvertes, reposerait les seeds UNE dernière
-- fois exactement comme avant, puis figerait cet état. Une suppression demandée
-- la veille (RGPD art. 17) ressusciterait au déploiement, et cette fois pour de
-- bon — dans un fichier qui affirme par ailleurs la respecter.
--
-- Base VIERGE ou base EN LIGNE se distinguent ici sans ambiguïté : l'INSERT
-- ci-dessous est le premier `INSERT INTO contenus` du fichier, donc `contenus`
-- est encore vide sur une base neuve, et déjà peuplée sur toute base déployée.
INSERT INTO seeds_appliques (cle)
SELECT v.cle
  FROM (VALUES ('045_article_heberger_slides'), ('047_interview_rachel_dubois')) AS v(cle)
 WHERE EXISTS (SELECT 1 FROM contenus)
ON CONFLICT (cle) DO NOTHING;

-- 045 — Article « Où héberger tes slides ? » (contenu éditorial, migration de DONNÉES).
--
-- Publie le premier article d'accompagnement (aide au choix d'un hébergement de
-- slides). Idempotent (ON CONFLICT slug DO NOTHING) : rejouable, ne réécrit jamais
-- une version éditée ensuite via l'admin. Hors flux RSS (au_flux = FALSE) :
-- l'article est lisible sur le site, sa diffusion se déclenche depuis l'admin.
-- Le formulaire de talk renvoie vers lui dès qu'il est publié (getAideSlidesHref,
-- résolu par le slug 'ou-heberger-tes-slides'). No-op sur base vierge (tests).
INSERT INTO contenus (type, slug, titre, chapo, corps, statut, publie_le, au_flux)
SELECT
  'publication',
  'ou-heberger-tes-slides',
  $t$Où héberger tes slides ?$t$,
  $chapo$Tu as fini ton talk. Les lumières se rallument, la salle se vide, et tes slides restent là, sur ton écran. Reste une question toute bête, et pas si technique : où les poser, et jusqu'où les ouvrir ? Les partager, c'est prolonger ton talk. C'est aussi les rendre publiques. Voici de quoi choisir tranquillement, à ton rythme. Il n'y a pas de mauvaise réponse.$chapo$,
  $corps$## D'abord, pourquoi les partager ?

Parce qu'on te les réclame. Dans la salle, il y avait des femmes et des hommes, souvent beaucoup d'hommes. Celles et ceux qui étaient là veulent revenir sur une idée, une référence, un schéma. Celles et ceux qui ont raté ta session veulent la rattraper. Et la plupart des confs te le demandent : ça fait partie du deal.

Et puis il y a l'autre raison, plus discrète. Des slides en ligne, ça te fait exister au-delà de la salle. Ça te référence, ça ramène vers toi, ça travaille pour toi pendant que tu fais autre chose.

Un mot quand même, parce qu'il compte : partager, c'est rendre public. Une fois en ligne, tes slides se lisent par n'importe qui. C'est tout leur intérêt. C'est aussi ce qui fait hésiter. On en reparle plus bas.

## Les regarder, ou les emporter ?

Ça se joue sur un détail qu'on oublie souvent : la façon dont les gens vont y accéder.

Première option, tes slides s'affichent directement dans la page. On les feuillette sur place, sans rien télécharger, sans te quitter. C'est fluide, ça garde le monde chez toi, et c'est ce que fait une visionneuse (l'iframe de SpeakerDeck, par exemple).

Deuxième option, tu donnes un fichier, souvent un PDF, que la personne emporte. Pratique pour garder une copie sous le coude. Mais là, le fichier t'échappe et part vivre sa vie.

La plupart des plateformes te laissent choisir : montrer sans laisser télécharger, ou les deux. À toi de voir ce que tu as envie d'offrir. Et le PDF reste la valeur sûre : tout le monde l'ouvre, il garde ta mise en page au millimètre, il se regarde aussi bien qu'il se télécharge.

## Alors, où les poser ?

Il n'y a pas de bon endroit dans l'absolu. Juste des compromis, et quatre questions pour t'y retrouver : le lien tiendra-t-il dans deux ans ? Peux-tu repartir avec ton audience si tu changes d'avis ? Combien de place ça mange ? Et qu'est-ce que tu gardes sous ton contrôle ?

**Chez toi, ou chez un hébergeur français** (OVH, Infomaniak…). Tu maîtrises tout, tu emportes tout, rien ne bouge sans ton accord. Le revers : les fichiers s'accumulent et finissent par gonfler ton hébergement, et c'est toi qui gères la maintenance, les renouvellements, les certificats.

**SpeakerDeck.** Fait pour les slides, l'embed s'intègre tout seul. Le gratuit suffit souvent, mais il plafonne (autour de dix dépôts par jour, une centaine en tout), et ça vit chez eux.

**Notist.** Une page qui rassemble tous tes talks, comme un vrai portfolio de speaker. C'est beau et confortable. Mais les fonctions qui font la différence sont payantes, et l'abonnement revient chaque année.

**Canva.** Si tes slides y sont déjà nées, tu peux les publier et les partager sans rien déménager. En échange, tout reste accroché à ton compte.

**Google Slides.** Tu l'as sous la main, le partage est instantané. Surveille juste le réglage du lien, qui peut laisser passer une version modifiable : exporte en PDF pour figer ce que tu montres.

D'autres portes existent (GitHub Pages, Notion…), la grille de lecture reste la même. Et rien n'est gravé : tu changes d'endroit quand tu veux, tu mets ton lien à jour, et voilà.

## « Et si on me copie ? »

Posons-la, cette peur, parce qu'elle est légitime, surtout au début. Oui, le plagiat existe. Des slides recopiées telles quelles, une illustration reprise sans un mot de crédit jusque dans une formation payante, un talk rejoué ailleurs. Ça arrive pour de vrai.

La vraie question n'est pas de savoir si ça peut arriver. C'est de le mettre en face de ce que le partage t'apporte. Et là, celles qui partagent depuis des années sont plutôt sereines : à la longue, ça leur a bien plus rapporté que coûté. Trois raisons reviennent, toujours les mêmes.

Ce qui fait ton talk, c'est toi, sur scène. Ta manière de raconter, tes exemples, ta voix. Rien de tout ça ne rentre dans un fichier.

Une copie trop littérale se voit vite. Surtout si ta patte graphique est reconnaissable : ta signature visuelle te protège plus que tu ne crois.

Et puis, on avance toutes sur les épaules de celles d'avant. On s'inspire, on se répond, rien n'est jamais tout neuf. C'est comme ça que ça marche, et c'est très bien ainsi.

Prendre le risque au sérieux, ce n'est pas se taire. C'est partager en gardant la main.

## Garder la main, justement

Trois gestes simples, et ton travail est protégé sans rien verrouiller.

Signe tes slides. Ton nom, ton pseudo, l'adresse de ta fiche, sur la première et la dernière. On te retrouve, on sait que c'est toi.

Dis comment on peut te réutiliser. La reprise est la bienvenue, tant qu'on te cite. Une licence Creative Commons « BY » l'écrit en une ligne, et te donne un appui le jour où on t'oublie.

Et garde ta patte. Une charte qu'on reconnaît, c'est ta meilleure protection : on ne te copie pas sans que ça se voie. Le PDF aide aussi, plus dur à réécrire qu'un fichier source.

## Et Tech Speak'Her, dans tout ça ?

Tu te demandes peut-être pourquoi on ne les héberge pas nous-mêmes, tes slides. C'est un choix. D'autres le font déjà très bien, gratuitement, depuis longtemps. On préfère te laisser libre de tes outils plutôt que de t'attacher aux nôtres.

Notre place est ailleurs. Elle est là : rassembler tes talks et leurs liens au même endroit, et t'aider à être vue dans l'annuaire, là où on cherche des speakeuses à programmer, à interviewer, à faire monter sur scène.

Alors où que tu poses tes slides, il reste un dernier geste, le plus important : colle le lien sur ta fiche. Et si tu n'en as pas encore, c'est le moment. On la construit ensemble.$corps$,
  'publie',
  CURRENT_DATE,
  FALSE
 WHERE NOT EXISTS (SELECT 1 FROM seeds_appliques WHERE cle = '045_article_heberger_slides')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO seeds_appliques (cle) VALUES ('045_article_heberger_slides')
ON CONFLICT (cle) DO NOTHING;

-- ─── Titres de séances lisibles (migration 050) ───
-- « (1) » en fin de titre se lit comme un badge de compteur sur une carte
-- d'agenda ; on écrit ce que c'est : « (séance 1) ». Idempotent (le motif « (N) »
-- en fin de titre n'existe plus après passage). Bloc identique à
-- db/migrations/050_titres_seances_lisibles.sql.
--
-- ⚠️ PLACÉ AVANT le seed 046 et le bloc 049, et c'est essentiel (défaut constaté
-- en prod le 01/08 : 3 exemplaires de chacune des 4 séances en duo). Le seed 046
-- se garde par TITRE ; tant que ce renommage tournait APRÈS lui, chaque
-- déploiement rejouait la séquence « le seed cherche "(1)", ne le trouve plus —
-- il a été renommé au déploiement précédent — et réinsère », soit 4 doublons de
-- plus à chaque mise en prod. Renommer D'ABORD rend le titre STABLE : le seed
-- compare alors des « (séance N) » à des « (séance N) », et ne trouve rien à
-- créer. Les blocs 046 et 049 ci-dessous portent donc les titres d'ARRIVÉE.
UPDATE tremplin_ateliers
   SET titre = regexp_replace(titre, '\((\d+)\)$', '(séance \1)')
 WHERE titre ~ '\(\d+\)$';

-- ─── Ateliers de la phase 3 (montée sur scène) — Tremplin DevFest Toulouse 2026 (migration 046) ───
-- Backfill de DONNÉES (pas de schéma) : les 10 séances du coaching DevFest 2026,
-- en phase 'montee_sur_scene', ouvertes à toutes (parcours public). GÉNÉRIQUE,
-- aucune donnée personnelle (ni binômes ni coachs nominatifs — gérés dans
-- l'admin, hors git). Bloc issu de db/migrations/046_tremplin_phase3_ateliers.sql,
-- aux titres près : ils portent ici la forme d'ARRIVÉE « (séance N) », celle que
-- le renommage 050 ci-dessus vient de garantir en base.
-- Idempotent ; no-op sur base vierge ou sans l'édition 2026 (le JOIN sur
-- l'édition ne ramène alors aucune ligne).
--
-- ⚠️ DEUX gardes, et la seconde compte autant que la première :
--   1. par (edition_id, titre) : pas de doublon d'une séance déjà semée ;
--   2. SEED UNIQUE — on n'ensemence QUE si l'édition ne porte encore AUCUN
--      atelier de la phase 3. Sans elle, la garde par titre suffit à recréer
--      une séance que l'orga vient de supprimer exprès (séance annulée) : le
--      titre n'existe plus, donc le seed le réinsère au déploiement suivant.
--      Le projet a déjà payé ce piège (migration 048 : il a fallu RETIRER une
--      ligne du seed pour que « Réussir ses slides » ne renaisse pas). Un seed
--      amorce une édition vide ; il n'entretient pas un programme vivant.
INSERT INTO tremplin_ateliers
       (edition_id, ordre, titre, date, heure_debut, heure_fin, description, phase, ouvert_a_toutes)
SELECT ed.id, v.ordre, v.titre, v.date, v.heure_debut, v.heure_fin, v.description,
       'montee_sur_scene', true
  FROM tremplin_editions ed
  CROSS JOIN (VALUES
    (6,  'Lancement et structure du talk', DATE '2026-09-01', TIME '18:00', TIME '20:20',
         $d$Présentiel de 2h20. On lance la préparation à la conférence et on pose la structure du talk complet, du fil conducteur aux grands blocs.$d$),
    (7,  'Revue croisée entre speakeuses (séance 1)', NULL, NULL, NULL,
         $d$Visio de 30 min, semaine du 7 au 13 septembre. Retour croisé avec une autre speakeuse sur l'avancement du talk.$d$),
    (8,  'Point individuel avec ta coach (séance 1)', NULL, NULL, NULL,
         $d$Visio de 30 min, semaine du 14 au 18 septembre. Échange individuel avec ta coach sur ton talk.$d$),
    -- (9) « Réussir ses slides » RETIRÉ du seed (migration 048) : doublon de
    -- l'atelier « Préparer ses slides de conférence » créé à la main par l'orga
    -- avant la migration 046. Le retirer d'ICI est indispensable : le garde
    -- NOT EXISTS par titre le recréerait à chaque déploiement après sa suppression.
    (10, 'Répétition sur le fond', DATE '2026-09-29', TIME '18:00', TIME '20:20',
         $d$Présentiel de 2h20. Répétition centrée sur le fond, la clarté du message et l'enchaînement des idées.$d$),
    (11, 'Revue croisée entre speakeuses (séance 2)', NULL, NULL, NULL,
         $d$Visio de 30 min, semaine du 30 septembre au 16 octobre. Deuxième retour croisé avec une autre speakeuse.$d$),
    (12, 'Répétition chronométrée', DATE '2026-10-20', TIME '18:00', TIME '20:20',
         $d$Présentiel de 2h20. Répétition dans le format et le temps de la conférence, chronomètre en main.$d$),
    (13, 'Générale et préparation mentale', DATE '2026-10-27', TIME '18:00', TIME '20:20',
         $d$Présentiel. Filage général du talk et préparation mentale avant la scène.$d$),
    (14, 'Point individuel avec ta coach (séance 2)', NULL, NULL, NULL,
         $d$Visio de 30 min, semaine du 28 octobre au 18 novembre. Deuxième échange individuel avec ta coach.$d$),
    (15, 'Débrief', DATE '2026-11-24', NULL, NULL,
         $d$Visio d'1h, mardi 24 novembre (horaire à confirmer). Retour d'expérience après la conférence.$d$)
  ) AS v(ordre, titre, date, heure_debut, heure_fin, description)
 WHERE ed.conf_slug = 'devfest-toulouse' AND ed.annee = 2026 AND ed.deleted_at IS NULL
   AND NOT EXISTS (
     SELECT 1 FROM tremplin_ateliers a
      WHERE a.edition_id = ed.id AND a.titre = v.titre
   )
   AND NOT EXISTS (
     SELECT 1 FROM tremplin_ateliers a
      WHERE a.edition_id = ed.id AND a.phase = 'montee_sur_scene'
   );

-- ─── Retrait du doublon « Réussir ses slides » (migration 048) ───
-- Doublon du « Préparer ses slides de conférence » créé à la main par l'orga
-- (arbitrage 2026-07-30 : on garde le sien). Ne supprime que s'il est resté
-- VIDE (ni participante, ni support, ni sous-groupe). Le seed 046 ci-dessus a
-- perdu sa ligne (9) : l'atelier ne se recrée pas au déploiement suivant.
-- Bloc IDENTIQUE à db/migrations/048_retire_doublon_slides.sql. Idempotent.
DO $$
DECLARE
  a_id INTEGER;
  occupe BOOLEAN;
BEGIN
  SELECT a.id INTO a_id
    FROM tremplin_ateliers a
    JOIN tremplin_editions ed ON ed.id = a.edition_id
   WHERE ed.conf_slug = 'devfest-toulouse' AND ed.annee = 2026
     AND a.titre = 'Réussir ses slides';
  IF a_id IS NULL THEN RETURN; END IF;

  occupe := EXISTS (SELECT 1 FROM tremplin_atelier_membres m WHERE m.atelier_id = a_id)
    OR EXISTS (SELECT 1 FROM tremplin_documents d WHERE d.atelier_id = a_id)
    OR (to_regclass('tremplin_atelier_sous_groupes') IS NOT NULL AND EXISTS (
          SELECT 1 FROM tremplin_atelier_sous_groupes sg WHERE sg.atelier_id = a_id));
  IF occupe THEN
    RAISE NOTICE 'migration 048 : « Réussir ses slides » (id %) est investi, suppression refusée.', a_id;
    RETURN;
  END IF;

  DELETE FROM tremplin_ateliers WHERE id = a_id;
END $$;

-- ─── Nature « sous-groupes » des quatre activités en duo (migration 049) ───
-- La 047 a introduit `nature` avec un DEFAULT 'collectif' ; la 046 avait créé les
-- séances du coaching 2026 avant elle. Les revues croisées et les points
-- individuels sont donc restés `collectif`, si bien que l'admin leur réclamait un
-- coach d'atelier, un lieu et le pointage des présences — les fausses alertes que
-- la fiche « événement » (lot C) supprime, sur les cas mêmes qui l'ont motivée.
-- Nature SEULE : ni dates (calées dans l'admin), ni composition des sous-groupes
-- (nominatif, jamais committé). Bloc issu de
-- db/migrations/049_nature_ateliers_sous_groupes.sql, aux titres près : comme le
-- seed 046, il cible la forme d'ARRIVÉE « (séance N) », que le renommage 050
-- placé en tête de séquence a déjà garantie. Idempotent.
UPDATE tremplin_ateliers a
   SET nature = 'sous_groupes'
  FROM tremplin_editions ed
 WHERE a.edition_id = ed.id
   AND ed.conf_slug = 'devfest-toulouse'
   AND ed.annee = 2026
   AND ed.deleted_at IS NULL
   AND a.nature <> 'sous_groupes'
   AND a.titre IN (
     'Revue croisée entre speakeuses (séance 1)',
     'Revue croisée entre speakeuses (séance 2)',
     'Point individuel avec ta coach (séance 1)',
     'Point individuel avec ta coach (séance 2)'
   );

-- 047 : corps de l'article « Interview de Rachel Dubois » (23/03/26) — backfill de
-- DONNÉES. Corps Markdown complet (questions en titres « ## », réponses en texte).
-- ON CONFLICT (slug) DO UPDATE SET corps : en prod ne touche QUE le corps (métadonnée
-- = seed src/data/actualites.ts) ; base neuve = insert complet. Corps piloté par le
-- repo (garde IS DISTINCT, pas d'écriture inutile). Détail : db/migrations/047_*.sql.
-- Catégorie et chapô sont ceux d'AUJOURD'HUI (« Behind the Scenes », chapô sans
-- renvoi LinkedIn) et non ceux de mars : ce script exprime l'état CIBLE, il ne
-- rejoue pas l'histoire. Le bloc 058 plus bas rattrape les bases déjà en ligne.
INSERT INTO contenus
  (type, slug, titre, chapo, corps, categorie, tag, lien_externe, lien_label,
   statut, publie_le, au_flux)
SELECT
  'publication',
  'interview-de-rachel-dubois',
  'Interview de Rachel Dubois',
  $chapo$« On t'a prise parce que t'étais la seule fille. » Notre première interview Behind the Scenes.$chapo$,
  $corps$_Première interview de notre série Behind the Scenes. Rachel Dubois pratique le produit depuis plus de 25 ans. Elle revient sans filtre sur son rapport à la scène, sur le choix des conférences et sur la place des femmes dans la tech. Propos recueillis par Cateline Puccetti pour Tech Speak’Her._

## Peux-tu nous raconter qui tu es dans la tech et ce que tu fais au quotidien ?

Je m’identifie dans la tech, plutôt côté produit. J’ai fait un peu de développement en début de carrière, mais cela reste anecdotique par rapport au produit, que je pratique depuis plus de 25 ans. Je suis très orientée produit et business. Ce qui m’intéresse, c’est une question très simple : comment faire pour que les logiciels soient réellement utilisés.

## Comment décrirais-tu ton rapport à la prise de parole aujourd’hui ?

Ça va mieux ! Mais cela reste une petite torture auto-infligée. Une petite violence nécessaire qui me fait grandir à chaque fois. Le positif reste supérieur au stress. C’est plus facile aujourd’hui, notamment grâce à de meilleures techniques de préparation, de gestion du stress et à ma capacité à me convaincre d’y aller. Mais il y a toujours ce moment de speed juste avant de monter sur scène. Encore à Devoxx, j’ai perdu mon latin au début, et malgré ça, c’était chouette. J’ai des copines qui font du théâtre, et le trac est toujours là après 20 ans.

## Comment la prise de parole est-elle entrée dans ton parcours ?

La première fois, c’était de façon forcée et pas forcément consentie. J’étais toute jeune. En 2008, lors d’un des tout premiers Agile Tour, on m’a forcé la main. Je ne l’ai pas très bien vécu, et j’ai opposé un refus assez frontal le jour J. La personne voulait me pousser pour de mauvaises raisons : « t’es une fille », « l’agilité est à la mode »… Bref.

La vraie première fois est arrivée quelques mois plus tard, à Bordeaux, lors d’un Agile Tour (Agile Tour Bordeaux). Il y avait très peu de femmes dans la tech, dans le produit, dans l’agile. Cette fois, j’ai volontairement soumis une idée. Le talk a été sélectionné. J’ai ressenti une énorme pression. J’étais arrivée avec des slides, mais au final, je les ai trouvées hyper tristes. Il n’y avait pas vraiment de narratif. Le jour J, dans un grand amphi, j’ai eu de gros doutes. J’ai fait des erreurs. J’ai dépassé le temps. Mais c’était fait. Et surtout, j’ai ressenti une immense fierté. Puis un des organisateurs m’a dit :

> On t’a prise parce que t’étais la seule fille.

Ça m’a donné la rage. Et surtout l’envie de faire entendre davantage de voix de femmes sur scène. À l’époque, nous étions trois ou cinq. Beaucoup plus aujourd’hui.

## Qu’est-ce qui t’a semblé le plus difficile dans ce parcours de prise de parole ?

Beaucoup de choses se sont facilitées avec le temps. Un vrai changement s’est opéré le jour où j’ai commencé à travailler pour Spotify, où j’étais la seule Française. Je n’avais plus besoin de prouver.

Mais dans toutes les conférences, il y a une constante très marquante : le comportement d’une partie de l’audience quand tu es une femme sur scène. Il y aura presque toujours ce mec qui n’accepte pas, qui interrompt, qui pose son point de vue en plein talk pour montrer que ce n’est pas carré. Qu’ils ont une plus grande bite que les autres. Devant toute la salle.

J’ai dû faire pas mal de psychothérapie pour travailler ma légitimité. J’ai aussi pratiqué l’improvisation, l’absurde.

En Angleterre, certaines conférences rappellent dès le début que ce type de comportement n’est pas toléré. Ce n’est pas encore le cas en France. Cela m’a d’ailleurs beaucoup motivée à devenir animatrice et organisatrice de conférences, pour que les femmes puissent se sentir en sécurité.

Il y a encore trop de conférences sans parité.

Ma grande motivation reste ma fille. On m’a souvent dit que l’informatique, ce n’était pas pour les nanas. Je veux qu’elle comprenne qu’elle peut tout faire. Et j’essaie aussi d’éduquer mon fils. La tech reste un milieu très validiste, très blanc, très occidental. Les personnes transgenres restent largement invisibilisées en France. Le handicap, c’est pareil.

J’ai un respect immense pour Aurélie Vache, qui est extraordinairement intelligente et qui a un courage énorme de monter sur scène.

## Peux-tu nous raconter une prise de parole qui t’a particulièrement marquée, et pourquoi ?

C’est ça le problème, il y en a vraiment plein. Il y en a plein, plein, plein. Il y en a plusieurs, mais je finirai par celle qui m’a le plus marquée. Une qui m’a vachement marquée, c’est la première fois où je suis allée parler en Angleterre, à Agile on the Beach, parce que c’est une conférence dont je rêvais depuis des années et qui est vraiment difficile d’accès. Ça m’a énormément touchée. Et puis tu parles en anglais, en Angleterre, au bout du monde, c’est trop rigolo. Ça m’a super touchée aussi quand on m’a invitée à Devoxx et qu’ils m’ont fait le coup de la petite salle bleue. Je ne m’attendais pas du tout à me retrouver dans l’amphi complet de Devoxx. Énorme claque. Mais la prise de parole qui m’a le plus marquée, c’est celle de Tech.rocks 2023, en décembre 2023.

## Pourquoi ?

Parce que je travaillais chez Spotify à l’époque. Le 4 décembre, donc 48 heures avant la conférence, Spotify fait une vague de layoffs. Je perds tout le monde du jour au lendemain. Je me retrouve la dernière. Ça a été d’une violence incroyable. Je me dis : je ne vais pas aller faire une conférence où je dois parler de comment on fait de l’innovation chez Spotify. Je contacte Tech.rocks, je leur dis que je ne le sens pas du tout. Ils ne m’ont mis aucune pression. Ils m’ont dit : viens quand même. Même si tu ne montes pas sur scène. Je viens. Le jour J, ils me redemandent si je veux parler. Je me dis que ça va mieux. Je monte sur scène. À un moment du talk, je parle à quel point ce qui compte dans cette démarche d’innovation, ce sont les gens. Et là, j’ai une vague d’émotion. Sur scène. Je suis limite à pleurer.

Et la salle a été d’une bienveillance incroyable. Il y a eu une espèce de feedback hyper touchant, hyper soutenant. Ça m’a redonné confiance. Je me suis sentie portée. J’ai essuyé mes larmes et j’ai terminé mon talk. Et c’était cool, parce que j’ai pu donner un talk très sincère de ce que je pensais. Respectueux de la boîte que j’aimais malgré tout. Sans cacher l’émotion d’avoir perdu tous les gens que je connaissais. C’est un talk qui m’a énormément émue.

## Finalement, on comprend que le choix de la conférence et des organisateurs joue un rôle énorme. Qu’est-ce qui est déterminant pour toi dans le choix d’une conférence ?

Clairement, il y a des conférences que je ne ferai jamais, même pour tout l’or du monde. Et puis il y a des conférences… je suis tellement contente de les avoir faites.

Il y a une toute petite conférence, même quand je ne veux plus faire de conférences, quand je n’ai plus d’énergie, il suffit qu’ils me disent « viens » et je viens : Agile Pays Basque. C’est une petite conférence, pas connue, peut-être 150 personnes maximum. Mais l’ambiance est incroyable. C’est presque familial. Tu peux y aller avec tes enfants. À une époque, on faisait des grillades sur le parking, tu vas à la plage, tu apprends à surfer… Il y a un tel bon esprit chez ces gens-là que tu as trop envie d’y aller, même quand tu n’as pas l’énergie.

Après, il y a aussi des conférences connues pour leurs standards d’inclusion. Par exemple Mix-IT, qui a des standards très élevés sur la diversité, la protection des femmes, l’inclusion.

Et puis il y a des conférences où je me suis déjà sentie mal à l’aise ou pas en sécurité. Je les ai faites une fois. Je ne les referai pas.

Il y a aussi des fois où je me suis trompée. J’avais un a priori négatif sur certaines conférences, et en fait, j’étais très contente de m’apercevoir que je me trompais. On a tous des a priori, des croyances. Il ne faut pas hésiter à se remettre en question là-dessus.

## Quel conseil donnerais-tu à une femme qui hésite à se lancer aujourd’hui ?

1. **Il ne faut pas hésiter, mais il ne faut pas partir seule.** Partir avec une communauté, c’est extrêmement important. Aujourd’hui, il existe plein de choses pour ça. Des tremplins, des dispositifs pour aider les gens à se lancer. Il y a aussi plein de communautés qui peuvent soutenir.
2. **Ensuite, bien choisir sa conférence.** Regarder s’il existe une charte de comportement. S’il n’y en a pas, c’est déjà plutôt un mauvais signal. Regarder aussi le line-up des éditions précédentes : est-ce qu’il y a des femmes ? Est-ce que la représentativité est OK pour nous ? Je connais des speakers qui refusent des conférences uniquement pour cette raison. Et ils ont raison.
3. **Puis écouter son feeling.** Pendant toute la phase de préparation, on échange avec les organisateurs. On peut très vite sentir si l’état d’esprit est bon ou pas. Si on ne se sent pas en sécurité, on dit non. Il y a plein de conférences. Il ne faut jamais l’oublier.
4. **Et surtout, ne pas oublier une chose essentielle : les conférences ont besoin des speakers autant que l’inverse.** On a un pouvoir énorme. C’est nous qui amenons la valeur, la qualité, les contenus. Donc il ne faut pas hésiter à choisir.

## Tu inverses complètement la posture. Là où beaucoup de personnes se demandent « est-ce que je vais être acceptée ? », toi tu dis plutôt « c’est à nous de choisir ».

Oui, complètement. Les conférences, si elles n’ont pas de speakers, elles n’ont rien. Donc ce pouvoir, il est de notre côté. On est en capacité de proposer des contenus de qualité, pertinents, intelligents. C’est nous qui amenons la valeur.

On peut aussi faire grandir les conférences en donnant du feedback. Dire quand une conférence n’est pas au niveau de la parité, de l’inclusion. Signaler quand certains comportements ne sont pas acceptables.

Et il faut aussi que, collectivement, on ose dire quand une conférence n’est pas au niveau.

## Finalement, ce que tu dis, c’est qu’il ne faut pas renoncer à choisir la bonne conférence, même quand on débute.

C’est ça. Il ne faut pas renoncer. Et il ne faut pas oublier certaines réalités aussi…

La plupart des conférences ne proposent pas de rémunération aux speakers, ni même de prise en charge des frais. Alors que dans la plupart des cas, elles sont payantes. Donc au minimum, il faut poser la question.

« Est-ce que c’est une conférence communautaire ou pas ? »

Quand c’est communautaire, je ne demande pas d’argent, mais au moins la prise en charge des frais de déplacement, c’est la moindre des choses.

Quand c’est commercial, c’est différent. Parce que préparer une conférence, ça prend énormément de temps. Et il ne faut pas oublier qu’une journée de conférence, pour un indépendant, c’est une journée de chiffre d’affaires en moins.

Et les femmes, en particulier, ne doivent pas hésiter à demander.

## Même sur la question financière, tu as une posture très claire.

Oui, parce qu’il y a un truc qu’il ne faut pas oublier.

Quand tu es speaker et que tu n’es pas rémunérée, au minimum tu dois être défrayée. Les conférences sont payantes. Elles vendent des billets. Et en face, on te dit : « oui, mais tu as le billet gratuit », « t’as de la chance de parler, on te donne de l’audience ».

Heureusement. C’est moi qui viens parler. C’est moi qui t’amène de l’audience. Je ne vais pas payer pour travailler. Quand je parle dans une conférence, moi je perds une journée de chiffre d’affaires. Donc je suis déjà gentille de ne pas te faire payer. Quand je fais des conférences privées pour des entreprises, c’est beaucoup plus cher que ça.

Et la plupart du temps, ce n’est même pas complètement vrai qu’on te fait une « pub gratuite ». Parce qu’en réalité, on te demande aussi de faire la promotion de la conférence.

## Donc il faut demander.

Évidemment qu’il faut demander. Si une femme ne le demande pas, on ne va pas lui proposer. Les hommes, eux, demandent beaucoup plus systématiquement. Au pire, on te dit non. Mais si tu ne demandes pas, tu n’auras rien.

Moi, en tant qu’organisatrice, je vois très bien qui demande la prise en charge : ce sont majoritairement des hommes. Ou des femmes très aguerries, qui ont l’habitude du circuit. Donc il faut demander.

## C’est un peu comme les augmentations de salaire.

Ouais, vraiment. Vraiment.

## Quelque part, ça crédibilise aussi la démarche.

Bien sûr. Tu ne demandes pas une faveur. Tu demandes quelque chose de parfaitement normal. Préparer une conférence, c’est énormément de travail. Et économiquement, ça a un impact réel. Si on ne demande pas, on ne nous proposera rien.

## Tu as déjà refusé des conférences pour ces raisons ?

Oui, complètement. Il y a une conférence à Grenoble qui m’avait invitée. J’ai dit OK au début, puis j’ai creusé. Ils ne prenaient pas les frais de déplacement, pas l’hébergement, rien. Et les billets étaient chers. On me donnait un ticket… mais seulement pour le jour où je parlais. Si je voulais assister aux autres jours, je devais payer.

Là, j’ai dit non. Je ne vais pas venir pour travailler gratuitement, payer en plus, et ne même pas pouvoir profiter de la conférence.

Du coup, je n’y suis pas allée. Et maintenant, ils ont changé. Aujourd’hui, ils donnent le ticket pour les deux jours.

## Et aujourd’hui, concrètement, comment ça se passe quand tu es invitée ?

Là par exemple, je vais à Dresde, en Allemagne. La conférence me plaît bien, mais c’est très loin. Je ne m’étais pas rendu compte à quel point. Mais ils sont sympas, ils prennent une partie des frais. Donc j’y vais.

## C’est hyper intéressant. Je pense que les speakeuses en devenir auront plein de tips à récupérer de tout ce que tu racontes.

Et on va les accompagner dans le groupe en plus, donc c’est trop cool quoi. (NDLR : avec le Tremplin Tech Speak’Her & DevFest Toulouse 2026.)

## Comment tu vois la suite de ton parcours de prise de parole aujourd’hui ?

L’année dernière, j’ai fait pas mal de conférences parce que je lançais ma boîte, donc je voulais aussi en profiter pour rencontrer des gens. C’était un investissement personnel intéressant, mais pas forcément le plus intelligent usage de mon temps.

Du coup cette année, j’ai décidé de faire moins de conférences, et de vraiment me concentrer sur celles qui me plaisent profondément. Faire plus de conférences techniques. Moins de conférences généralistes, management, agilité, etc.

Et puis quitte à se balader, autant aller se balader à l’étranger. Donc j’ai priorisé les conférences à l’étranger. Je trouve ça plus rigolo.

## En anglais… en allemand aussi ?

En allemand, je suis une quiche. Donc tout en anglais.

J’ai un pari quand même avec une copine d’arriver à faire une conférence en espagnol. On verra ce que ça donne. Et idéalement, j’aimerais bien arriver à faire un jour une conférence en japonais… juste pour pouvoir justifier le fait que j’aille à Tokyo. Mais ça, c’est pas réaliste du tout.

## Tu as des notions de japonais ?

Oui, mais pas suffisamment pour faire une conférence.

L’espagnol c’est beaucoup plus facile parce que je l’ai déjà pratiqué, j’étais quasiment bilingue à une époque. J’ai vécu une grosse partie de mon enfance en Amérique du Sud. Donc c’est juste à remettre en route.

Le japonais, il faut vraiment que je bosse pour de vrai.

## Et tu penses continuer longtemps ?

Oui. Je pense que je continuerai toute ma vie à faire des conférences. Parce que c’est vraiment important d’aller écouter les gens en conférence. J’adore ça. J’aimerais bien faire certaines conférences en tant qu’auditrice aussi.

Et puis préparer un sujet de conférence, ça t’oblige à te poser, à réfléchir à ton état de l’art sur un sujet. C’est hyper bon intellectuellement. Ça te fait progresser.

## En parlant de formation, est-ce que tu as des ressources à conseiller ?

Il y en a un sur la prise de parole en public, le côté storytelling… je crois qu’il s’appelle d’ailleurs « Storytelling » (NDLR : voir les indispensables conseillés par Rachel en fin d’article).

Après, il y a des choses vraiment géniales pour la prise de parole.

Moi je trouve que le théâtre d’impro, c’est une des meilleures écoles de l’univers pour apprendre à gérer. Quoi qu’il arrive, ça se passera bien.

Il y a aussi une super association qui s’appelle Toastmasters International. C’est une association qui existe partout dans le monde. Il y en a à Toulouse, il y en a à Paris. Ce sont des gens qui s’entraînent à prendre la parole en public sur n’importe quel sujet. Ils ont des techniques, c’est très bien structuré, et c’est assez fun.

## Et les coachs ?

Il y a aussi des coachs de prise de parole en public. Mais ça coûte cher. Moi j’aimerais bien en prendre un pour corriger certains tics que j’ai en présentation. Mais il faut mettre 5 000 ou 6 000 euros. Ça vaut le coup, je critique pas du tout. Mais c’est un investissement. C’est pour corriger des tics de langage, de préparation, d’animation.

## Pour passer un cap finalement ?

Oui. Quand tu veux monter d’un niveau, il y a des choses que tu apprends sur le terrain, mais qui ne sont pas « propres ». Avec un coach, tu peux aller beaucoup plus loin. Par exemple, si je voulais faire un TEDx, je passerais par un coach. Parce que ce n’est pas encore assez propre.

## Tu te lances aussi des défis ?

Oui. Par exemple à Devoxx, j’ai proposé un talk de 15 minutes. Je n’ai jamais fait de format aussi court. C’est une expérimentation. Et ça m’oblige à écrire différemment, à parler différemment, à raconter différemment. C’est un gros défi.

## D’autres astuces ?

Oui. Il y a des conférences qui proposent des formats type « forum ouvert ». Tu peux proposer un sujet au dernier moment, le tester, recevoir du feedback. C’est super bien pour commencer.

Et puis… s’inscrire à un tremplin.

## Tu proposes aussi des formats pour s’entraîner ?

Oui. On a un atelier avec Montaine Marteau à Devoxx, un atelier de deux heures sur la prise de parole. Ça s’appelle « Pitcher ton produit ». On l’avait fait pour le DevFest de Nantes (GDG Nantes).

L’idée, c’est d’emprunter des techniques du marketing, du produit, de la vente, pour apprendre à présenter ses sujets techniques. À pitcher, à défendre ses idées. Et c’est assez marrant.

## Et ça a bien marché ?

Oui, ça nous a vachement surpris. On pensait avoir une vingtaine de personnes… et la salle était blindée. On a dû refuser du monde. On a eu des super feedbacks. Les gens ont vraiment kiffé. Du coup on l’a reproposé à Devoxx.

## C’est vrai que savoir se vendre, même dans des métiers très techniques, c’est clé.

Oui. Les gens ne savent pas le faire, parce qu’on ne leur apprend pas.

## Un petit mot de la fin ?

Si t’es une fille et que t’as des choses à dire, n’hésite pas à l’ouvrir très grand et à le dire. Et si t’as peur de le faire toute seule, viens. Il y a plein d’associations comme nous. On va serrer les rangs derrière toi. Et tu vas y arriver. On a besoin de beaucoup plus de femmes. Le monde a besoin de beaucoup plus de femmes au pouvoir. Ça fait 15 000 ou 20 000 ans de leadership masculin. On voit ce que ça donne. Ça suffit.

## Les ressources indispensables pour Rachel Dubois

- **Talk Like TED**, de Carmine Gallo. Décryptage concret des talks TED (structure, émotion, simplicité). Utile pour structurer une keynote qui marque.
- **Confessions of a Public Speaker**, de Scott Berkun. Pas théorique du tout : du terrain, des erreurs, des situations réelles. De quoi éviter les illusions du « speaker parfait ».
- **The Art of Public Speaking**, de Dale Carnegie. Un classique. Basique mais structurant. Un peu daté, mais utile pour les fondamentaux.
- **Made to Stick**, de Chip Heath & Dan Heath. Pourquoi certaines idées restent et d’autres meurent. Framework clé : SUCCES (Simple, Unexpected, Concrete, etc.).
- **Resonate**, de Nancy Duarte. La structure narrative des grandes présentations. Très sous-estimé alors que c’est l’un des meilleurs.
- **The Storytelling Animal**, de Jonathan Gottschall. Pourquoi le cerveau humain pense en histoires.

_Encore un grand merci à Rachel Dubois de s’être prêtée au jeu pour cette interview sans filtre. Behind the Scenes, par Cateline Puccetti (plume Cateline Sola) pour Tech Speak’Her._$corps$,
  'Behind the Scenes',
  'Passé',
  'https://www.linkedin.com/pulse/behind-scenes-avec-rachel-dubois-ta-prise-parce-que-t%C3%A9tais-3m3de/',
  'Lire sur LinkedIn',
  'publie',
  DATE '2026-03-23',
  FALSE
-- POSÉ une fois : une fois la trace écrite, la ligne absente reste absente — une
-- suppression dans l'admin tient au déploiement suivant. Tant qu'elle EXISTE, la
-- ligne repasse par l'`ON CONFLICT` ci-dessous, donc le corps reste piloté par
-- le repo. La garde change le sort d'une SUPPRESSION, jamais celui d'une édition.
 WHERE NOT EXISTS (SELECT 1 FROM seeds_appliques WHERE cle = '047_interview_rachel_dubois')
    OR EXISTS (SELECT 1 FROM contenus WHERE slug = 'interview-de-rachel-dubois')
-- Le CORPS est piloté par le repo : ON CONFLICT DO UPDATE le (re)pose tant qu'il
-- DIFFÈRE du texte ci-dessus (garde IS DISTINCT : pas d'écriture inutile au rejeu).
-- Conséquence assumée : éditer CETTE interview se fait dans le repo (PR), pas dans
-- l'éditeur web — une modif faite dans l'éditeur serait réécrite au déploiement.
-- Chapô/lien/tag ne sont touchés QUE sur une base neuve (insert) ; en prod (ligne
-- déjà seedée) seul le corps est posé, la métadonnée reste celle du seed.
ON CONFLICT (slug) DO UPDATE
  SET corps = EXCLUDED.corps,
      maj_le = now()
  WHERE contenus.corps IS DISTINCT FROM EXCLUDED.corps;

INSERT INTO seeds_appliques (cle) VALUES ('047_interview_rachel_dubois')
ON CONFLICT (cle) DO NOTHING;

-- 051 — QUI voit un atelier : un choix EXCLUSIF, à la place de deux
-- interrupteurs qui se contredisaient.
--
-- `ouvert_a_toutes` (booléen) et la liste nominative
-- (`tremplin_atelier_membres`) étaient indépendants, et le plus permissif
-- gagnait EN SILENCE : désigner les participantes d'une phase sur un atelier
-- resté ouvert à toutes ne changeait rien pour personne.
--
-- `audience` répond à la question une seule fois :
--   selection = les inscrites nommément désignées (défaut : un atelier neuf
--               n'est visible de personne tant qu'on ne l'a pas dit) ;
--   phase     = les inscrites rattachées à la phase DE L'ATELIER ;
--   toutes    = toute inscrite à l'édition.
--
-- EXPAND / CONTRACT : la migration passe AVANT la livraison du code (cf.
-- docs/exploitation.md §Règle expand/contract), donc `ouvert_a_toutes` RESTE —
-- l'ancien code la lit encore pendant la bascule. Le nouveau code la tient à
-- jour en miroir de `audience`. Sa suppression fera l'objet d'une migration à
-- part (tracée dans docs/dette-technique.md), une fois la livraison passée.
--
-- Idempotent : garde sur l'existence de la colonne ; le backfill vit DANS la
-- garde (jamais rejoué, un choix manuel ultérieur ne sera pas écrasé).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'tremplin_ateliers' AND column_name = 'audience'
  ) THEN
    ALTER TABLE tremplin_ateliers
      ADD COLUMN audience TEXT NOT NULL DEFAULT 'selection'
                 CHECK (audience IN ('selection', 'phase', 'toutes'));

    -- Reprise à l'identique de l'existant : ouvert → toutes, sinon sélection.
    UPDATE tremplin_ateliers SET audience = 'toutes' WHERE ouvert_a_toutes = true;

    -- SAUF les ateliers de la préparation à la conférence, que la migration 046
    -- a semés « ouverts à toutes » par erreur : ils ne concernent QUE la cohorte
    -- de leur phase, c'est même leur raison d'être. On les rétablit dans ce
    -- qu'ils sont — c'est le défaut signalé par l'orga, pas une décision neuve.
    UPDATE tremplin_ateliers
       SET audience = 'phase'
     WHERE phase = 'montee_sur_scene' AND ouvert_a_toutes = true;

    -- Le miroir suit, pour l'instant de bascule où l'ancien code lit encore.
    UPDATE tremplin_ateliers SET ouvert_a_toutes = (audience = 'toutes');
  END IF;
END $$;

-- 052 — un sous-groupe peut avoir PLUSIEURS coachs, et n'a plus de nom.
--
-- Demande orga : « Ils n'ont pas besoin de noms, juste les participantes au sous
-- groupe et éventuellement une ou plusieurs coachs dedans ».
--
-- Deux limites du modèle tombent :
--
-- 1. `coach_user_id` n'acceptait QU'UNE coach. Une table de liaison la remplace.
-- 2. `libelle` était NOT NULL et saisi à la création (« Binôme 1 »…). Le
--    sous-groupe se désigne désormais par QUI est dedans (libellé dérivé, cf.
--    src/lib/sous-groupe-libelle.ts) : la colonne devient facultative. On ne la
--    supprime pas — l'ancien code l'écrit encore le temps de la bascule.
--
-- L'INVARIANT, TENU EN BASE : les coachs d'un sous-groupe sont un sous-ensemble
-- de celles de son ATELIER. La table porte donc `atelier_id`, avec deux clés
-- étrangères COMPOSITES : l'une vers le sous-groupe (id, atelier_id), l'autre
-- vers `tremplin_atelier_coachs` (atelier_id, user_id). Conséquences voulues :
--   * un id forgé, ou un compte qui n'est pas coach de l'atelier, est REFUSÉ par
--     la base, pas seulement par l'écran ;
--   * retirer une coach de l'atelier la retire de ses sous-groupes par CASCADE,
--     sans code applicatif à tenir en phase ;
--   * l'écran ne peut plus afficher une liste de cases INCOMPLÈTE (donc plus
--     effacer en silence une coach qu'il n'aurait pas montrée).
-- Poser cette contrainte coûte moins maintenant qu'après la livraison : ensuite
-- il faudrait une migration de plus ET une passe de réparation sur la prod.
--
-- REPRISE DE L'EXISTANT, sans rien ACCORDER. `tremplin_atelier_coachs` est une
-- table d'AUTORISATION : une ligne y ouvre l'espace coach de l'atelier (liste
-- nominative de toutes ses participantes, ses supports, le dépôt de documents).
-- Des sous-groupes portent un `coach_user_id` dont la coach n'est PAS inscrite
-- sur l'atelier — l'ancien modèle le permettait. On ne l'y inscrit PAS : ce
-- serait élargir l'accès à des données personnelles par script, alors que c'est
-- une décision d'orga. Ces coachs ne sont donc pas reprises, et l'écran du
-- sous-groupe le DIT, avec le geste à faire (cf. `coachHeriteNom`).
--
-- Idempotent, et rejoué à CHAQUE déploiement via db/sync-to-latest.sql : les
-- gardes sont donc par LIGNE (« ce sous-groupe n'a aucune coach reprise »)
-- plutôt que sur l'état global de la table — une garde « table vide » rendait la
-- reprise dépendante des autres sous-groupes, et pouvait ressusciter une coach
-- retirée depuis.

DO $$
BEGIN
  -- Cible de la FK composite vers le sous-groupe. `id` est déjà unique (PK) :
  -- cette contrainte ne restreint rien, elle rend le couple référençable.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tremplin_sous_groupes_id_atelier_uniq'
  ) THEN
    ALTER TABLE tremplin_atelier_sous_groupes
      ADD CONSTRAINT tremplin_sous_groupes_id_atelier_uniq UNIQUE (id, atelier_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS tremplin_sous_groupe_coachs (
  sous_groupe_id INTEGER NOT NULL,
  -- Dénormalisée, mais elle ne peut pas mentir : la première FK composite
  -- garantit qu'elle est bien l'atelier du sous-groupe.
  atelier_id     INTEGER NOT NULL,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (sous_groupe_id, user_id),
  FOREIGN KEY (sous_groupe_id, atelier_id)
    REFERENCES tremplin_atelier_sous_groupes (id, atelier_id) ON DELETE CASCADE,
  FOREIGN KEY (atelier_id, user_id)
    REFERENCES tremplin_atelier_coachs (atelier_id, user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sg_coachs_user
  ON tremplin_sous_groupe_coachs (user_id);

-- Reprise : la coach unique devient la première de la liste, MAIS seulement si
-- elle est déjà coach de l'atelier (la FK la refuserait de toute façon, et
-- l'inscrire d'office lui accorderait un accès — cf. l'en-tête). Gardé par
-- l'absence de coach reprise POUR CE sous-groupe, donc rejouable sans jamais
-- réintroduire une coach retirée depuis (le code met `coach_user_id` à NULL
-- quand il retire la dernière).
INSERT INTO tremplin_sous_groupe_coachs (sous_groupe_id, atelier_id, user_id)
SELECT sg.id, sg.atelier_id, sg.coach_user_id
  FROM tremplin_atelier_sous_groupes sg
  JOIN tremplin_atelier_coachs ac
    ON ac.atelier_id = sg.atelier_id AND ac.user_id = sg.coach_user_id
 WHERE sg.coach_user_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM tremplin_sous_groupe_coachs c WHERE c.sous_groupe_id = sg.id)
ON CONFLICT DO NOTHING;

DO $$
BEGIN
  -- Le nom n'est plus demandé : la colonne devient facultative.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'tremplin_atelier_sous_groupes'
       AND column_name = 'libelle' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE tremplin_atelier_sous_groupes ALTER COLUMN libelle DROP NOT NULL;
  END IF;
END $$;

-- 053 — un article peut porter une vidéo, à regarder OU à lire. La vignette
-- affichée en haut de l'article se DÉRIVE de cette URL (src/lib/youtube.ts),
-- pas d'une deuxième saisie. Idempotent.
ALTER TABLE contenus ADD COLUMN IF NOT EXISTS video_url TEXT;

-- 065 — la taille de l'image déposée, pour que le titre de l'article cesse de
-- sauter au chargement : avec `width`/`height` sur la balise, le navigateur
-- connaît la proportion avant le téléchargement. NULL = inconnue (image
-- antérieure à la mesure) ; l'affichage retombe alors sur l'ancien
-- comportement. Idempotent.
ALTER TABLE contenus ADD COLUMN IF NOT EXISTS image_width  INT;
ALTER TABLE contenus ADD COLUMN IF NOT EXISTS image_height INT;

-- 054 — La FICHE COACH : créditer une accompagnante sans l'enrôler dans
-- l'annuaire des speakeuses (deux finalités, deux fiches). Rattachée au COMPTE,
-- donc à l'e-mail par lequel l'orga invite déjà les coachs. `public` est le
-- consentement à être citée : horodaté, révocable seul, défaut fermé, et la
-- suppression du compte emporte la fiche par CASCADE. Idempotent.
CREATE TABLE IF NOT EXISTS coach_profiles (
  "userId"          INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  role              TEXT,
  lien              TEXT,
  public            BOOLEAN NOT NULL DEFAULT false,
  public_consent_at TIMESTAMPTZ
);
ALTER TABLE coach_profiles ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE coach_profiles ADD COLUMN IF NOT EXISTS lien TEXT;
ALTER TABLE coach_profiles ADD COLUMN IF NOT EXISTS public BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE coach_profiles ADD COLUMN IF NOT EXISTS public_consent_at TIMESTAMPTZ;

-- 055 — Un consentement PAR PHASE pour les speakeuses nommées. `registrations.
-- public` a été recueilli pour la galerie des finalistes ; la cohorte de la
-- phase 3 la déborde (participantes retenues au CFP sans passer par la finale).
-- Défaut fermé, AUCUN backfill : reprendre l'existant réutiliserait justement le
-- consentement de galerie que cette colonne sépare. Idempotent.
ALTER TABLE tremplin_registration_phases
  ADD COLUMN IF NOT EXISTS public BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE tremplin_registration_phases
  ADD COLUMN IF NOT EXISTS public_consent_at TIMESTAMPTZ;

-- 056 — « Cet atelier sera visible sur le site public » devient une PHRASE que
-- l'orga coche, au lieu d'une conséquence déduite de l'audience. La 051 avait
-- fusionné les deux pour tuer un réglage IMPLICITE (pointer une présence
-- publiait la séance et son lieu) ; l'explicite ne rejoue pas ce défaut, et le
-- lieu ne sort plus du DTO public. Reprise à l'identique de l'état actuel :
-- personne n'entre ni ne sort de la vitrine du fait de cette migration.
-- Backfill DANS la garde (jamais rejoué) → un choix manuel tient. Idempotent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'tremplin_ateliers' AND column_name = 'au_programme_public'
  ) THEN
    ALTER TABLE tremplin_ateliers
      ADD COLUMN au_programme_public BOOLEAN NOT NULL DEFAULT false;
    UPDATE tremplin_ateliers SET au_programme_public = (audience <> 'selection');
  END IF;
END $$;

-- 057 — désabonnement de la LETTRE D'INFORMATION (Brevo), sans toucher aux
-- e-mails de SERVICE. NULL = abonnée (opt-out). Idempotent.
ALTER TABLE users ADD COLUMN IF NOT EXISTS newsletter_optout_at TIMESTAMPTZ;

-- 058 : la catégorie « Interview » devient « Behind the Scenes » (notre marque,
-- affichée sur la chip du type de contenu). Backfill de DONNÉES, rejouable : chaque
-- UPDATE est gardé par la valeur qu'il remplace. Détail : db/migrations/058_*.sql.

UPDATE contenus
   SET categorie = 'Behind the Scenes', maj_le = now()
 WHERE categorie = 'Interview';

-- L'interview de Rachel Dubois se lit désormais sur SA page d'article (elle a un
-- corps, cf. migration 047) : le chapô n'a plus à renvoyer le lecteur sur
-- LinkedIn, qui reste proposé en bas de l'article. Gardé sur le texte EXACT issu
-- du seed (espaces insécables comprises) : un chapô réécrit par une orga n'est
-- jamais écrasé.
UPDATE contenus
   SET chapo = $chapo$« On t'a prise parce que t'étais la seule fille. » Notre première interview Behind the Scenes.$chapo$,
       maj_le = now()
 WHERE slug = 'interview-de-rachel-dubois'
   AND chapo = $ancien$« On t'a prise parce que t'étais la seule fille. » Première interview Behind the Scenes, sur LinkedIn.$ancien$;

-- 059 — Récit « DevFest Toulouse 2025 : ça a marché ! ». Le texte vivait en dur
-- dans le JSX de /devfest-toulouse : la page du Tremplin 2025 ne pouvait pas s'en
-- servir, et le corriger demandait un déploiement. Il devient un CONTENU rattaché
-- à la conférence répertoriée (conference_edition_id, migration 040), éditable
-- dans /admin/contenus. Posé UNE fois (trace ci-dessous), donc jamais réécrit ni
-- ressuscité. No-op si l'édition 2025 est absente (base vierge).
-- Détail : db/migrations/059_recit_devfest_2025.sql.
--
-- La table `seeds_appliques` est créée plus haut (les seeds gardés la lisent).
INSERT INTO contenus
  (type, slug, titre, chapo, corps, categorie, tag, statut, publie_le, au_flux,
   conference_edition_id)
SELECT
  'publication',
  'devfest-toulouse-2025-ca-a-marche',
  $t$DevFest Toulouse 2025 : ça a marché !$t$,
  $chapo$2025 était déjà un tremplin : c'est là que Cateline a fait son premier talk en conférence.$chapo$,
  $corps$En 2025, le DevFest Toulouse nous a ouvert les portes de sa salle des communautés. Sandrine Berger y a présenté Tech Speak'Her et Cateline Puccetti a fait un talk de 35 minutes, salle pleine, lors d'une journée qui a rassemblé 1 200 personnes au Diagora à Labège.

La salle des communautés, elle, fait une cinquantaine de places. Elle était pleine à craquer : certaines personnes ont écouté debout, d'autres depuis l'extérieur.

La session de questions-réponses qui a suivi a été riche, autant sur la communauté que sur le talk.

Elle était primo-speakeuse. Ça lui a permis de se lancer, de monter sur une scène et d'oser faire son premier talk en conférence.

Résultat : ça a tellement cartonné que c'est le DevFest qui nous a proposé de renouveler l'expérience en 2026.

C'est pour aller encore plus loin qu'on a lancé le Tremplin.

## Pour aller voir

Aucun replay : la salle des communautés n'était pas filmée en 2025.

- [Tech Speak'Her sur devfesttoulouse.fr](https://devfesttoulouse.fr/conferenciers/tech-speakher/)
- [Les retours sur Openfeedback](https://openfeedback.io/devfest-toulouse-2025/2025-11-13/1057177)
- [Les speakeuses de la communauté](/speakeuses)$corps$,
  'Communauté',
  'Passé',
  'publie',
  DATE '2025-11-13',
  FALSE,
  ce.id
FROM conference_editions ce
  JOIN conferences c ON c.id = ce.conference_id
WHERE c.slug = 'devfest-toulouse' AND ce.annee = 2025
  AND NOT EXISTS (SELECT 1 FROM seeds_appliques WHERE cle = '059_recit_devfest_2025')
ORDER BY ce.id
LIMIT 1
ON CONFLICT (slug) DO NOTHING;

-- Posé : on ne le reposera plus, quoi qu'il advienne de l'article ensuite. La
-- trace n'est écrite que si l'édition de conférence EXISTE — sinon le seed
-- n'avait rien à insérer, et une base qui la gagne plus tard doit encore
-- pouvoir le recevoir.
INSERT INTO seeds_appliques (cle)
SELECT '059_recit_devfest_2025'
  FROM conference_editions ce
  JOIN conferences c ON c.id = ce.conference_id
 WHERE c.slug = 'devfest-toulouse' AND ce.annee = 2025
 LIMIT 1
ON CONFLICT (cle) DO NOTHING;

-- 060 — les seeds 045 et 047 se posent UNE fois. La garde porte sur le REJEU :
-- elle vit donc DANS leurs blocs, et le rattrapage d'une base déjà en ligne AVANT
-- eux (les deux plus haut dans ce fichier). Détail : db/migrations/060_*.sql.

-- 061 : les speakeuses écrivent (lot N3, docs/conception-lot-n3-articles.md).
-- L'autrice d'un contenu (lien vivant + nom figé, zéro anonymisation — droits
-- cédés à l'asso) et le statut de relecture. Idempotent.
ALTER TABLE contenus
  ADD COLUMN IF NOT EXISTS auteur_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS auteur_nom TEXT,
  ADD COLUMN IF NOT EXISTS relecture_motif TEXT;
ALTER TABLE contenus DROP CONSTRAINT IF EXISTS contenus_statut_ck;
ALTER TABLE contenus
  ADD CONSTRAINT contenus_statut_ck
  CHECK (statut IN ('brouillon', 'en_relecture', 'publie'));
CREATE INDEX IF NOT EXISTS idx_contenus_auteur ON contenus (auteur_user_id);

-- 062 — « Tech Speak'Her » cesse de se couper en fin de ligne DANS LA BASE.
--
-- Le nom est servi avec une insécable partout dans le site ; les contenus, eux,
-- viennent de `contenus` (liste `/actualites`, extrait de l'accueil, pages
-- d'article). Corriger les fixtures du dépôt n'atteint PAS une base déjà en
-- ligne : les seeds sont gardés par `ON CONFLICT (slug) DO NOTHING` et par une
-- trace dans `seeds_appliques`. La prod garderait donc un nom qui se coupe, sur
-- la liste publique la plus lue.
--
-- UNE SEULE FOIS : ce fichier fait converger le schéma et pose les seeds, il ne
-- réécrit pas indéfiniment la prose que l'orga saisit dans l'admin. D'où la même
-- trace que les seeds gardés. Détail : db/migrations/062_*.sql.
--
-- Espaces et apostrophes en ÉCHAPPEMENTS (`E'…'`) : une insécable et une espace
-- ordinaire sont indiscernables à la relecture, et c'est leur différence qu'on
-- manipule. Les deux apostrophes circulent dans le corpus — la droite dans les
-- titres, la courbe dans le verbatim de l'interview 047.
UPDATE contenus
   SET titre = replace(replace(titre, E'Tech Speak\u0027Her', E'Tech\u00A0Speak\u0027Her'),
                                      E'Tech Speak\u2019Her', E'Tech\u00A0Speak\u2019Her'),
       chapo = replace(replace(chapo, E'Tech Speak\u0027Her', E'Tech\u00A0Speak\u0027Her'),
                                      E'Tech Speak\u2019Her', E'Tech\u00A0Speak\u2019Her'),
       corps = replace(replace(corps, E'Tech Speak\u0027Her', E'Tech\u00A0Speak\u0027Her'),
                                      E'Tech Speak\u2019Her', E'Tech\u00A0Speak\u2019Her')
 WHERE NOT EXISTS (SELECT 1 FROM seeds_appliques WHERE cle = '062_nom_insecable_contenus')
   AND (titre LIKE E'%Tech Speak\u0027Her%' OR titre LIKE E'%Tech Speak\u2019Her%'
     OR chapo LIKE E'%Tech Speak\u0027Her%' OR chapo LIKE E'%Tech Speak\u2019Her%'
     OR corps LIKE E'%Tech Speak\u0027Her%' OR corps LIKE E'%Tech Speak\u2019Her%');

INSERT INTO seeds_appliques (cle) VALUES ('062_nom_insecable_contenus')
ON CONFLICT (cle) DO NOTHING;

-- 063 + 064 : les RÉACTIONS sur les cartes du fil (lot N4, docs/conception-lot-n4-reactions.md).
-- Un applaudissement nominatif (membre × carte dérivée → ligne source),
-- exactement une cible, cascades. La 064 pose le PRÉFIXE DE DOMAINE
-- (bravos → fil_reactions) : le renommage joue AVANT la création — une base
-- déjà en 063 est renommée, jamais doublée. Idempotent.
-- Détail : db/migrations/063_bravos.sql et 064_fil_reactions.sql.
DO $$
BEGIN
  IF to_regclass('fil_reactions') IS NULL AND to_regclass('bravos') IS NOT NULL THEN
    ALTER TABLE bravos RENAME TO fil_reactions;
    ALTER INDEX bravos_occurrence_uq RENAME TO fil_reactions_occurrence_uq;
    ALTER INDEX bravos_profile_uq RENAME TO fil_reactions_profile_uq;
    ALTER INDEX bravos_contenu_uq RENAME TO fil_reactions_contenu_uq;
    ALTER INDEX idx_bravos_user RENAME TO idx_fil_reactions_user;
    ALTER TABLE fil_reactions RENAME CONSTRAINT bravos_cible_ck TO fil_reactions_cible_ck;
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS fil_reactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  occurrence_id INTEGER REFERENCES talk_occurrences(id) ON DELETE CASCADE,
  profile_id INTEGER REFERENCES speaker_profiles(id) ON DELETE CASCADE,
  contenu_id INTEGER REFERENCES contenus(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fil_reactions_cible_ck CHECK (
    (occurrence_id IS NOT NULL)::int + (profile_id IS NOT NULL)::int
      + (contenu_id IS NOT NULL)::int = 1
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS fil_reactions_occurrence_uq
  ON fil_reactions (occurrence_id, user_id) WHERE occurrence_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS fil_reactions_profile_uq
  ON fil_reactions (profile_id, user_id) WHERE profile_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS fil_reactions_contenu_uq
  ON fil_reactions (contenu_id, user_id) WHERE contenu_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fil_reactions_user ON fil_reactions (user_id);

-- 064 (suite) : une réaction va à une PERSONNE — purge de celles posées sur
-- une actualité de l'association. Idempotent.
DELETE FROM fil_reactions r
 USING contenus c
 WHERE r.contenu_id = c.id
   AND c.auteur_user_id IS NULL;

-- 065 : date exacte du talk DevFest Toulouse 2026 de Leïla Gazeilles (donnée
-- restée imprécise, "courant 2026" au lieu du 19 novembre dans l'agenda
-- public). Ponctuelle et idempotente : ne touche que sa propre occurrence, et
-- seulement si la date n'est pas déjà au format exact AAAA-MM-JJ. Détail :
-- db/migrations/065_date_talk_leila_devfest.sql.
UPDATE talk_occurrences o
   SET date = '2026-11-19'
  FROM speaker_talks t
  JOIN speaker_profiles sp ON sp.id = t.speaker_profile_id
  JOIN users u ON u.id = sp."userId",
       conferences c
  JOIN conference_editions ce ON ce.conference_id = c.id
 WHERE o.talk_id = t.id
   AND o.edition_id = ce.id
   AND c.slug = 'devfest-toulouse'
   AND ce.annee = 2026
   AND lower(u.name) = 'leïla gazeilles'
   AND o.date !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$';

-- 066 : la speakeuse choisit la FRÉQUENCE de ses rappels de fiche (rappel de
-- mise à jour des publiées, relance des brouillons en sommeil). NULL = rien de
-- choisi, donc le délai réglé par l'équipe s'applique : la migration ne change
-- le comportement de personne. Les e-mails de compte (connexion, modération,
-- message reçu) restent hors de portée de ce réglage, exprès. Détail :
-- db/migrations/066_rappel_cadence.sql.
ALTER TABLE speaker_profiles
  ADD COLUMN IF NOT EXISTS rappel_cadence TEXT;

ALTER TABLE speaker_profiles
  DROP CONSTRAINT IF EXISTS speaker_profiles_rappel_cadence_check;

ALTER TABLE speaker_profiles
  ADD CONSTRAINT speaker_profiles_rappel_cadence_check
  CHECK (rappel_cadence IS NULL
      OR rappel_cadence IN ('mensuel', 'bimestriel', 'semestriel', 'aucun'));

-- 067 : conservation des comptes (avertir, puis supprimer). `last_seen_at` est
-- posée à now() pour tout le monde — on ne date pas une inactivité qu'on n'a
-- jamais mesurée, donc la première suppression possible est dans deux ans.
-- Détail : db/migrations/067_conservation_comptes.sql.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suppression_annoncee_le TIMESTAMPTZ;

-- DEFAULT : un compte créé par une voie qui ne passe pas par la connexion
-- (invitation Tremplin, rattachement orga) naîtrait sinon sans mesure, donc
-- « dormant depuis toujours ».
ALTER TABLE users ALTER COLUMN last_seen_at SET DEFAULT now();

UPDATE users SET last_seen_at = now() WHERE last_seen_at IS NULL;

-- 068 : la saisie de la speakeuse survit à la validation orga. Une occurrence
-- dont la conférence est encore en proposition s'enregistre TOUT DE SUITE et
-- pointe la proposition ; elle reste hors de tout affichage public tant que
-- `proposition_id` est renseigné, et passe en ligne telle quelle à la validation
-- (l'orga pose conference_id/edition_id, proposition_id retombe à NULL).
-- Corollaire : une proposition n'est plus supprimée à l'arbitrage (des saisies la
-- référencent), elle change de statut. Idempotent. Détail :
-- db/migrations/068_occurrences_en_attente.sql.
ALTER TABLE conference_propositions
  ADD COLUMN IF NOT EXISTS statut TEXT NOT NULL DEFAULT 'en_attente';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'conference_propositions_statut_ck'
  ) THEN
    ALTER TABLE conference_propositions
      ADD CONSTRAINT conference_propositions_statut_ck
      CHECK (statut IN ('en_attente', 'validee', 'refusee'));
  END IF;
END $$;

ALTER TABLE talk_occurrences
  ADD COLUMN IF NOT EXISTS proposition_id INTEGER
  REFERENCES conference_propositions(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_talk_occurrences_proposition
  ON talk_occurrences (proposition_id);

-- Une saisie en attente ne PEUT PAS pointer aussi le répertoire : la
-- contradiction (`proposition_id` ET `conference_id` renseignés) est ce qui
-- rendrait une occurrence non validée visible sur les pages qui filtrent par
-- `edition_id`/`conference_id` au lieu de `proposition_id`. Deux lectures
-- publiques sont dans ce cas (`conference-speakers.ts`) : aujourd'hui elles
-- sont sûres parce que l'écriture laisse ces colonnes à NULL, demain c'est un
-- CHECK qui le garantit, pas la mémoire de la personne qui écrira le prochain
-- writer. « Empêcher vaut mieux que tester » (docs/principes-tests.md).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'talk_occurrences_attente_hors_registre_ck'
  ) THEN
    ALTER TABLE talk_occurrences
      ADD CONSTRAINT talk_occurrences_attente_hors_registre_ck
      CHECK (proposition_id IS NULL OR (conference_id IS NULL AND edition_id IS NULL));
  END IF;
END $$;

-- 069 : fenêtre d'une édition cohérente. `date_fin` devient la donnée qui
-- borne ce qu'une édition lègue à la date d'un talk (dateLegueeParEdition) :
-- multi-jours lègue le mois, jamais un faux jour précis. La base garantit la
-- cohérence de la fenêtre quel que soit le chemin d'écriture. Miroir de
-- db/migrations/069_editions_fenetre_coherente.sql.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'conference_editions_fenetre_ck'
  ) THEN
    ALTER TABLE conference_editions
      ADD CONSTRAINT conference_editions_fenetre_ck
      CHECK (date_fin IS NULL OR (date_debut IS NOT NULL AND date_fin >= date_debut));
  END IF;
END $$;

-- 070 : la photo Google quitte les avatars (plus aucun chemin ne l'écrit, et
-- les URLs de provider — signées, périssables — laissaient l'avatar retomber
-- sur les initiales). La photo de profil se choisit maintenant dans la fiche et
-- vit chez nous. Idempotent : une seconde exécution ne trouve plus rien.
-- Détail : db/migrations/070_purge_avatars_google.sql.
-- Gardée sur l'existence de la colonne : une base d'AVANT `users.image` (les
-- fixtures de reprise legacy en ont) doit traverser ce fichier sans exploser.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'users' AND column_name = 'image') THEN
    UPDATE users SET image = NULL WHERE image LIKE '%googleusercontent.com%';
  END IF;
END $$;

-- 071 : la photo LinkedIn quitte les avatars, elle aussi — les URLs
-- `media.licdn.com` déjà en base étaient signées, donc en sursis. Plus aucun
-- chemin ne les écrit depuis la 070 ; celle-ci solde l'historique. Idempotent.
-- Même garde sur l'existence de la colonne que la 070 (bases legacy).
-- Détail : db/migrations/071_purge_avatars_linkedin.sql.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'users' AND column_name = 'image') THEN
    UPDATE users SET image = NULL WHERE image LIKE '%licdn.com%';
  END IF;
END $$;

-- 072 : une édition du Tremplin naît en préparation, et son statut est une
-- liste fermée. Le code connaît cinq statuts, la base en ignorait tout
-- (`DEFAULT 'ouvert'`, aucun CHECK) : une édition créée à la main dans
-- l'éditeur Neon naissait PUBLIQUE. Le défaut ne touche que les INSERT à venir.
-- Miroir de db/migrations/072_edition_statut_preparation.sql.
-- Même garde sur l'existence de la colonne que les 070/071 : une base legacy
-- (les fixtures de reprise en ont une `tremplin_editions` réduite à id/nom/
-- annee) doit traverser ce fichier sans exploser.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'tremplin_editions' AND column_name = 'statut') THEN
    RETURN;
  END IF;

  ALTER TABLE tremplin_editions ALTER COLUMN statut SET DEFAULT 'preparation';

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tremplin_editions_statut_ck'
  ) THEN
    ALTER TABLE tremplin_editions
      ADD CONSTRAINT tremplin_editions_statut_ck
      CHECK (statut IN ('preparation', 'ouvert', 'en_cours', 'clos', 'archive'));
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 072 : la géographie d'une occurrence devient exploitable.
--
-- Une fiche stocke `code_insee` + `region_residence` (Base Adresse Nationale) ;
-- une occurrence ne portait qu'un `ville` en texte libre. Filtrer l'agenda sur
-- « Toulouse » marchait, sur « Occitanie » non — et taper « Occitanie » ne
-- remontait rien, en silence (audit de l'agenda §4.2).
--
-- Deux colonnes NULLABLES, sans contrainte : la BAN est un service tiers (une
-- saisie ne doit jamais échouer parce qu'il est indisponible) et ne couvre que
-- la France (hors de France, elles restent vides et la règle d'affichage range
-- l'intervention en « International »). L'absence de valeur EST une information.
--
-- Détail : db/migrations/072_occurrences_geographie.sql.
ALTER TABLE talk_occurrences
  ADD COLUMN IF NOT EXISTS code_insee TEXT,
  ADD COLUMN IF NOT EXISTS region     TEXT;

CREATE INDEX IF NOT EXISTS talk_occurrences_region_idx
  ON talk_occurrences (region)
  WHERE region IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 073 : les statuts de fiche et d'adhésion deviennent des listes fermées.
--
-- Même carence que la 072, sur les deux colonnes dont les lecteurs échouent
-- OUVERT : un statut inconnu sur `speaker_profiles.status` passait le
-- `NOT IN ('masque', 'refuse')` de tremplin-public.ts (fiche EXPOSÉE dans la
-- galerie publique) ; sur `user_memberships.status`, le `<> 'active'` de
-- comptes-inactifs.ts (compte rangé dans la cohorte de SUPPRESSION). Les
-- adhésions n'ont AUCUNE porte applicative (éditeur Neon), d'où le refus à
-- l'écriture par la base plutôt qu'une lecture corrigée en positif.
-- Si l'ADD CONSTRAINT lève : une ligne porte un statut hors liste — diagnostic
-- et redressement à la main, détail en tête de la migration.
-- Miroir de db/migrations/073_statuts_listes_fermees.sql.
-- Même garde sur l'existence des colonnes que le bloc 072 : une base legacy
-- réduite (le patron des fixtures de reprise) doit traverser ce fichier sans
-- exploser — chaque contrainte attend SA colonne.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'speaker_profiles' AND column_name = 'status')
     AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'speaker_profiles_status_ck'
  ) THEN
    ALTER TABLE speaker_profiles
      ADD CONSTRAINT speaker_profiles_status_ck
      CHECK (status IN ('brouillon', 'en_attente', 'publie', 'refuse', 'masque'));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'user_memberships' AND column_name = 'status')
     AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_memberships_status_ck'
  ) THEN
    ALTER TABLE user_memberships
      ADD CONSTRAINT user_memberships_status_ck
      CHECK (status IN ('active', 'expired'));
  END IF;
END $$;

-- ─── 074 — Adhésions HelloAsso, annuaire réservé aux membres ───
-- Miroir de db/migrations/074_adhesions_helloasso.sql (raisons en tête du
-- fichier). Vient APRÈS le bloc 073 : il remplace la contrainte de statut de
-- fiche que celui-ci pose, pour y ajouter `en_pause`.
ALTER TABLE user_memberships ADD COLUMN IF NOT EXISTS helloasso_item_id BIGINT;
ALTER TABLE user_memberships ADD COLUMN IF NOT EXISTS relance_envoyee_le TIMESTAMPTZ;
-- Une première version de la 074 posait un index UNIQUE sur l'article : il
-- bloquait la synchro quand un article change de compte. Jamais en prod, mais
-- une preview ou une base locale a pu le recevoir.
DROP INDEX IF EXISTS user_memberships_helloasso_item_id_key;

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS email TEXT;

ALTER TABLE speaker_profiles ADD COLUMN IF NOT EXISTS annuaire_retrait_le TIMESTAMPTZ;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'speaker_profiles' AND column_name = 'status') THEN
    ALTER TABLE speaker_profiles DROP CONSTRAINT IF EXISTS speaker_profiles_status_ck;
    ALTER TABLE speaker_profiles
      ADD CONSTRAINT speaker_profiles_status_ck
      CHECK (status IN ('brouillon', 'en_attente', 'publie', 'refuse', 'masque', 'en_pause'));
  END IF;
END $$;

-- ─── 075 — Invitation à adhérer, une fois par fiche ───
-- Miroir de db/migrations/075_invitation_adhesion.sql.
ALTER TABLE speaker_profiles ADD COLUMN IF NOT EXISTS adhesion_invitee_le TIMESTAMPTZ;
