-- Migration 018 — Récompenses du Tremplin, attribuables et suivies.
--
-- Sépare deux notions confondues dans tremplin_registrations.recompense :
-- le PODIUM (mérite de la soirée, immuable, reste sur l'inscription) et la
-- RÉCOMPENSE (présentation au DevFest, talk en meetup, coaching CFP…),
-- attribuable librement à n'importe quelle participante de l'édition, avec
-- un motif quand elle est transmise (ex. 1ʳᵉ déjà retenue via le CFP).
--
-- Pas d'UNIQUE (edition_id, rang) : la plupart des récompenses n'ont pas de
-- rang (meetup proposé à toutes, coaching des prises au CFP), et un même
-- rang peut en ouvrir plusieurs.
--
-- `statut` + `evenement_le` : suivi dans le temps de l'organisation de
-- l'événement qui en découle (le meetup est-il calé ? a-t-il eu lieu ?).

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
