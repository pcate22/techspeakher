-- Lot N4, correction (retours de Cateline sur le fil réel) : la table des
-- réactions prend son NOM JUSTE et son préfixe de domaine.
--
-- 1. `bravos` → `fil_reactions` : le geste porte TROIS mots selon la carte
--    (« Bravo » sur une scène, « Bienvenue » sur une arrivée, « Merci » sur
--    un article de membre — objectif : se motiver, un mot faux démotive), et
--    le préfixe dit le domaine comme `tremplin_*`.
-- 2. Purge des réactions posées sur une actualité de l'ASSOCIATION : une
--    réaction va à une PERSONNE pour son geste, et une annonce signée
--    Tech Speak'Her n'a personne à féliciter.
--
-- Idempotent : le renommage ne joue que si l'ancien nom existe et que le
-- nouveau manque (une base née de schema.sql a déjà fil_reactions).

DO $$
BEGIN
  IF to_regclass('fil_reactions') IS NULL AND to_regclass('bravos') IS NOT NULL THEN
    ALTER TABLE bravos RENAME TO fil_reactions;
    ALTER INDEX bravos_occurrence_uq RENAME TO fil_reactions_occurrence_uq;
    ALTER INDEX bravos_profile_uq RENAME TO fil_reactions_profile_uq;
    ALTER INDEX bravos_contenu_uq RENAME TO fil_reactions_contenu_uq;
    ALTER INDEX idx_bravos_user RENAME TO idx_fil_reactions_user;
    ALTER TABLE fil_reactions RENAME CONSTRAINT bravos_cible_ck TO fil_reactions_cible_ck;
  END IF;
END $$;

DELETE FROM fil_reactions r
 USING contenus c
 WHERE r.contenu_id = c.id
   AND c.auteur_user_id IS NULL;
