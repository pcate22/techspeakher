-- Migration 011 — Moissonneur CFP (scénario F de docs/faisabilite-import-talks.md)
-- Idempotente : rejouable sans effet de bord.

-- ─── talks : provenance d'un import (idempotence du re-sync) ───
-- source : 'manuel' | 'sessionize' | 'conference-hall'
ALTER TABLE talks ADD COLUMN IF NOT EXISTS source      TEXT NOT NULL DEFAULT 'manuel';
ALTER TABLE talks ADD COLUMN IF NOT EXISTS external_id TEXT;

-- 1 session externe = au plus 1 talk PAR PROFIL (une session peut avoir
-- plusieurs co-speakeuses, d'où profile_id dans la clé).
CREATE UNIQUE INDEX IF NOT EXISTS talks_profile_source_external_id_key
  ON talks (profile_id, source, external_id) WHERE external_id IS NOT NULL;

-- ─── speaker_profiles : consentement au moissonnage ───
-- 'aucun' : ignorée par le moissonneur ; 'suggestions' (défaut) : propositions
-- à confirmer ; 'auto' : ajout direct des matchs forts (réservé, pas encore
-- exposé dans l'UI).
ALTER TABLE speaker_profiles ADD COLUMN IF NOT EXISTS cfp_sync_mode TEXT NOT NULL DEFAULT 'suggestions';

-- ─── Registre d'événements moissonnés ───
-- endpoint : id d'endpoint public Sessionize (ou slug Conference Hall).
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

-- ─── Suggestions du moissonneur (confirmation un-clic par la speakeuse) ───
-- statut : 'proposee' | 'acceptee' | 'refusee' — une refusée reste en base
-- pour ne jamais être re-suggérée.
-- event_id en RESTRICT (pas CASCADE) : supprimer un événement effacerait la
-- mémoire des refus (« jamais re-suggérée »). Pour retirer un événement du
-- moissonnage : UPDATE cfp_events SET actif = FALSE.
CREATE TABLE IF NOT EXISTS talk_suggestions (
  id          SERIAL PRIMARY KEY,
  profile_id  INTEGER NOT NULL REFERENCES speaker_profiles(id) ON DELETE CASCADE,
  event_id    INTEGER NOT NULL REFERENCES cfp_events(id) ON DELETE RESTRICT,
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

-- Lecture chaude : suggestions en attente d'une speakeuse (espace membre).
CREATE INDEX IF NOT EXISTS idx_talk_suggestions_profile_statut
  ON talk_suggestions (profile_id, statut);

-- Si la table existait déjà avec l'ancien CASCADE : on corrige (idempotent).
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

-- ─── Alimenter le registre (exemple, à adapter puis exécuter à la main) ───
-- L'id d'endpoint Sessionize se trouve dans la page du site de la conférence
-- qui embarque le programme (script sessionize.com/api/v2/<ID>/view/...).
-- DO UPDATE (pas DO NOTHING) : relancer l'INSERT corrige les métadonnées sans
-- supprimer l'événement (la suppression est bloquée par les suggestions).
-- INSERT INTO cfp_events (nom, source, endpoint, url, ville, pays, date_debut)
-- VALUES ('DevFest Toulouse 2026', 'sessionize', 'REMPLACER_PAR_ID',
--         'https://devfesttoulouse.fr', 'Toulouse', 'France', '2026-11-19')
-- ON CONFLICT (source, endpoint) DO UPDATE SET
--   nom = EXCLUDED.nom, url = EXCLUDED.url, ville = EXCLUDED.ville,
--   pays = EXCLUDED.pays, date_debut = EXCLUDED.date_debut, actif = TRUE;
