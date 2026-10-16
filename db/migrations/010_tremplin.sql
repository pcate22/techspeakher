-- Migration — socle Tremplin (Phase A, lot A1).
-- À exécuter UNE fois dans l'éditeur SQL de Neon. Idempotent.
--
-- Périmètre volontairement minimal (objectif prioritaire §13 de
-- docs/tremplin-implementation.md) : permettre aux participantes du Tremplin 1
-- de retrouver leurs documents (supports d'atelier + retour jury en liens).
-- Les tables de l'édition « live » (atelier_animatrices, atelier_presences,
-- podium, lots, audit_events) viendront en Phase B.

-- Édition Tremplin (rattachée à une conférence majeure).
-- statut : 'ouvert' | 'en_cours' | 'clos' | 'archive'
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

-- Inscription : lien (participante × édition). "userId" nullable pour les
-- enregistrements saisis par l'orga (reprise Tremplin 1, pré-saisie), rattachés
-- à un compte plus tard. statut : 'en_attente' | 'acceptee' | 'refusee'
CREATE TABLE IF NOT EXISTS tremplin_registrations (
  id              SERIAL PRIMARY KEY,
  edition_id      INTEGER NOT NULL REFERENCES tremplin_editions(id) ON DELETE CASCADE,
  "userId"        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  participante_nom      TEXT,
  participante_role     TEXT,
  participante_linkedin TEXT,
  statut          TEXT NOT NULL DEFAULT 'en_attente',
  sujet           TEXT,
  finale_presente BOOLEAN,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- liée à un compte OU saisie à la main (jamais ni l'un ni l'autre).
  CONSTRAINT registration_identite CHECK (
    "userId" IS NOT NULL OR participante_nom IS NOT NULL
  ),
  -- une personne (avec compte) ne s'inscrit qu'une fois par édition.
  -- NULL distincts (défaut PG) → plusieurs saisies orga par édition restent OK.
  UNIQUE (edition_id, "userId")
);

-- Atelier : session de coaching d'une édition. Le NOMBRE d'ateliers est libre
-- (= nombre de lignes). heure_debut/heure_fin en TIME (interprétées Europe/Paris).
CREATE TABLE IF NOT EXISTS tremplin_ateliers (
  id           SERIAL PRIMARY KEY,
  edition_id   INTEGER NOT NULL REFERENCES tremplin_editions(id) ON DELETE CASCADE,
  ordre        INTEGER NOT NULL DEFAULT 0,
  titre        TEXT NOT NULL,
  date         DATE,
  heure_debut  TIME,
  heure_fin    TIME,
  description  TEXT,
  lien_visio   TEXT
);

-- Documents & ressources. Portée :
--   atelier_id défini      → doc de travail d'un atelier (partagé) ;
--   registration_id défini → doc individuel & privé (retour jury, vidéo, note) ;
--   les deux NULL          → ressource générale de l'édition.
-- (atelier_id / registration_id mutuellement exclusifs : garanti côté lib.)
-- Un document a au moins un support : un lien OU du contenu texte.
-- type : 'support_atelier' | 'feedback_jury' | 'video_pitch' | 'note' | 'autre'
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

-- ─── Index (requêtes chaudes) ───
CREATE INDEX IF NOT EXISTS idx_registrations_edition   ON tremplin_registrations (edition_id);
CREATE INDEX IF NOT EXISTS idx_registrations_user      ON tremplin_registrations ("userId");
CREATE INDEX IF NOT EXISTS idx_tremplin_ateliers_edition ON tremplin_ateliers (edition_id);
CREATE INDEX IF NOT EXISTS idx_documents_edition       ON tremplin_documents (edition_id);
CREATE INDEX IF NOT EXISTS idx_documents_atelier       ON tremplin_documents (atelier_id);
CREATE INDEX IF NOT EXISTS idx_documents_registration  ON tremplin_documents (registration_id);
