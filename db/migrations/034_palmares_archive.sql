-- Migration 034 — Archive du palmarès (avant retrait de « sujet »).
--
-- Fige le titre primé des inscriptions CLASSÉES dans une colonne d'archive
-- dédiée, indépendante du talk. Objectif : le palmarès (a minima les gagnantes
-- du T1, saisies orga sans compte ni talk) survit à la suppression / au
-- renommage du talk, et au retrait de la colonne `sujet` (migration 035).
--
-- ADDITIVE et idempotente : rien ne lit encore `titre_palmares` → aucun impact
-- sur la prod. À jouer AVANT le déploiement du code qui bascule les lectures
-- sur le talk pitché (la 035 destructive se joue APRÈS ce déploiement).

ALTER TABLE tremplin_registrations
  ADD COLUMN IF NOT EXISTS titre_palmares TEXT;

-- Gèle l'archive pour toute inscription classée (podium). `sujet` porte alors le
-- titre affiché (miroir du talk, ou libre pour les finalistes seed sans talk).
-- On ne remplit que les archives encore vides (idempotent).
UPDATE tremplin_registrations
   SET titre_palmares = sujet
 WHERE classement IS NOT NULL
   AND titre_palmares IS NULL
   AND sujet IS NOT NULL
   AND btrim(sujet) <> '';
