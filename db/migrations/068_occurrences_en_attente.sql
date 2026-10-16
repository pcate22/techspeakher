-- Migration 068 — La saisie de la speakeuse survit à la validation orga.
--
-- Avant : une conférence absente du répertoire BLOQUAIT le formulaire (« choisis
-- dans la liste »), la speakeuse partait la proposer ailleurs et perdait sa
-- saisie ; il fallait tout retaper une fois la conférence validée.
-- Après : l'occurrence est enregistrée TOUT DE SUITE, rattachée à la proposition
-- (`proposition_id`) au lieu du répertoire. À la validation, l'orga la rattache à
-- la vraie édition et `proposition_id` retombe à NULL — la saisie passe en ligne
-- telle quelle, sans re-saisie.
--
-- Invariant tenu par les lectures publiques (une seule condition à connaître) :
--   proposition_id IS NOT NULL  ⇔  en attente ou écartée  ⇒  jamais publique.
--
-- Idempotente.

-- Une proposition n'est plus SUPPRIMÉE à l'arbitrage : elle change de statut.
-- Sans ça, les occurrences pointeraient une ligne disparue, et « écartée » ne se
-- distinguerait plus de « jamais proposée ».
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

-- RESTRICT (ni CASCADE ni SET NULL) : supprimer une proposition derrière laquelle
-- des saisies attendent est un geste conscient. Un SET NULL rendrait l'occurrence
-- indiscernable d'une saisie libre historique — donc PUBLIQUE, sans validation.
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
