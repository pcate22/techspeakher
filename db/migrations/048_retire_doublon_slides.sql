-- 048 — retire le doublon « Réussir ses slides » (Tremplin DevFest 2026).
--
-- La migration 046 a ensemencé « Réussir ses slides » alors que l'orga avait
-- déjà créé à la main « Préparer ses slides de conférence » (réservé, coach
-- reliée) pour la même séance. Arbitrage orga (2026-07-30) : on garde l'atelier
-- créé à la main, on supprime celui du seed.
--
-- GARDES : on ne supprime que s'il est resté VIDE — aucune participante,
-- aucun support, aucun sous-groupe (table absente avant la migration 047 :
-- le bloc to_regclass la traite comme vide). Un atelier investi entre-temps
-- n'est jamais supprimé silencieusement. Idempotent (0 ligne au 2ᵉ passage).
--
-- ⚠️ Le seed 046 de db/sync-to-latest.sql est AUSSI amendé (ligne retirée) :
-- sans cela, son garde « NOT EXISTS par titre » recréerait l'atelier au
-- déploiement suivant la suppression.

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
