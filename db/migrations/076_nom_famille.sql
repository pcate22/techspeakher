-- 076 — Le nom de famille désigné par la membre, pour l'afficher en capitales.
--
-- Le compte ne porte qu'un nom complet (`name`) : l'affichage devine que le nom
-- de famille est tout ce qui suit le premier mot (« Asma TABERKOKT »). Quand
-- c'est faux (prénom composé sans trait d'union : « Marie Anne Dupont »), la
-- membre désigne ici son nom de famille, qui doit terminer `name`. NULL = la
-- règle par défaut suffit. Cf. src/lib/nom-famille.ts.
--
-- Idempotent : rejouable sans effet la deuxième fois.

ALTER TABLE users ADD COLUMN IF NOT EXISTS nom_famille VARCHAR(255);
