-- 072 — La géographie d'une occurrence devient exploitable.
--
-- POURQUOI (docs/audit-ux-agenda-2026-08.md §4.2)
-- Une FICHE de speakeuse saisit sa commune via la Base Adresse Nationale et
-- stocke `code_insee` + `region_residence`. Une OCCURRENCE, elle, ne portait
-- qu'un `ville` en TEXTE LIBRE. Conséquence mesurée : filtrer l'agenda sur
-- « Toulouse » était possible, sur « Occitanie » non — et taper « Occitanie »
-- n'aurait rien remonté, en silence. Deux surfaces sœurs, deux géographies.
--
-- CE QUE CETTE MIGRATION FAIT, ET NE FAIT PAS
-- Elle AJOUTE deux colonnes nullables. Elle ne touche à aucune donnée existante
-- et ne contraint rien :
--
--   • la BAN est un service TIERS. Une speakeuse doit pouvoir enregistrer sa
--     date même quand il ne répond pas — une dépendance externe n'a pas à faire
--     échouer la saisie de quelqu'un. Ces colonnes restent alors vides, et le
--     rattrapage (scripts/rattraper-geographie-occurrences.mjs) les remplira.
--   • la BAN ne couvre que la FRANCE. Bruxelles, Genève ou Montréal gardent une
--     ville en texte et ces deux colonnes vides ; la règle d'affichage
--     (`src/lib/lieu-occurrence.ts`) les range en « International ».
--
-- Une colonne NOT NULL, ou une contrainte sur le format du code INSEE, aurait
-- donc bloqué des cas parfaitement légitimes. L'absence de valeur EST une
-- information ici, pas un défaut de saisie.
--
-- Rejouable : ADD COLUMN IF NOT EXISTS, aucune écriture de donnée.

ALTER TABLE talk_occurrences ADD COLUMN IF NOT EXISTS code_insee TEXT;
ALTER TABLE talk_occurrences ADD COLUMN IF NOT EXISTS region     TEXT;

-- Les facettes de l'agenda lisent la région en travers de toutes les fiches
-- publiées : sans index, chaque affichage la recalcule sur l'ensemble de la
-- table. Partiel — une occurrence sans région n'a pas à peser dans l'index.
CREATE INDEX IF NOT EXISTS talk_occurrences_region_idx
  ON talk_occurrences (region)
  WHERE region IS NOT NULL;
