-- Migration 039 — Localisation de résidence structurée (Base Adresse Nationale).
-- La ville existe déjà (texte libre) ; on la fiabilise via l'autocomplétion BAN
-- (api-adresse.data.gouv.fr) et on stocke, en plus, le code postal, le code
-- INSEE de la commune, et la RÉGION DE RÉSIDENCE dérivée de la commune.
--
-- Attention : `region_residence` est DISTINCTE de `regions` (= zones
-- d'intervention / déplacement, choisies à la main). Une speakeuse née à
-- Toulouse mais disponible partout coche `regions = {Toute la France}` ;
-- `region_residence = Occitanie` décrit seulement où elle réside.
-- Idempotente.
ALTER TABLE speaker_profiles
  ADD COLUMN IF NOT EXISTS code_postal      TEXT,
  ADD COLUMN IF NOT EXISTS code_insee       TEXT,
  ADD COLUMN IF NOT EXISTS region_residence TEXT;
