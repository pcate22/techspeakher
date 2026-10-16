-- Migration 029 — lieu de la conférence (cf. docs/conception-conference-lieu.md).
--
-- Une conférence RÉCURRENTE (DevFest, Devoxx, Agile Tour…) porte une marque et,
-- pour les marques multi-instances, un lieu : une VILLE (DevFest Toulouse) OU un
-- PAYS (Devoxx France). L'année, elle, est l'édition — jamais le nom de la conf.
-- `conf_lieu` (optionnel : Mix-IT, Agile on the Beach n'en ont pas) stocke ce lieu.
--
-- Correctif de l'existant : la 1re édition avait « DevFest Toulouse 2026 » comme
-- nom de conf (année collée). On la ramène à la marque « DevFest » + lieu
-- « Toulouse ». Le slug (devfest-toulouse) et l'année (2026) sont inchangés.

ALTER TABLE tremplin_editions ADD COLUMN IF NOT EXISTS conf_lieu TEXT;

UPDATE tremplin_editions
   SET conf_nom = 'DevFest', conf_lieu = 'Toulouse'
 WHERE conf_slug = 'devfest-toulouse' AND conf_nom = 'DevFest Toulouse 2026';
