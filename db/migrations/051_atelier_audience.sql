-- 051 — QUI voit un atelier : un choix EXCLUSIF, à la place de deux
-- interrupteurs qui se contredisaient.
--
-- `ouvert_a_toutes` (booléen) et la liste nominative
-- (`tremplin_atelier_membres`) étaient indépendants, et le plus permissif
-- gagnait EN SILENCE : désigner les participantes d'une phase sur un atelier
-- resté ouvert à toutes ne changeait rien pour personne.
--
-- `audience` répond à la question une seule fois :
--   selection = les inscrites nommément désignées (défaut : un atelier neuf
--               n'est visible de personne tant qu'on ne l'a pas dit) ;
--   phase     = les inscrites rattachées à la phase DE L'ATELIER ;
--   toutes    = toute inscrite à l'édition.
--
-- EXPAND / CONTRACT : la migration passe AVANT la livraison du code (cf.
-- docs/exploitation.md §Règle expand/contract), donc `ouvert_a_toutes` RESTE —
-- l'ancien code la lit encore pendant la bascule. Le nouveau code la tient à
-- jour en miroir de `audience`. Sa suppression fera l'objet d'une migration à
-- part (tracée dans docs/dette-technique.md), une fois la livraison passée.
--
-- Idempotent : garde sur l'existence de la colonne ; le backfill vit DANS la
-- garde (jamais rejoué, un choix manuel ultérieur ne sera pas écrasé).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'tremplin_ateliers' AND column_name = 'audience'
  ) THEN
    ALTER TABLE tremplin_ateliers
      ADD COLUMN audience TEXT NOT NULL DEFAULT 'selection'
                 CHECK (audience IN ('selection', 'phase', 'toutes'));

    -- Reprise à l'identique de l'existant : ouvert → toutes, sinon sélection.
    UPDATE tremplin_ateliers SET audience = 'toutes' WHERE ouvert_a_toutes = true;

    -- SAUF les ateliers de la préparation à la conférence, que la migration 046
    -- a semés « ouverts à toutes » par erreur : ils ne concernent QUE la cohorte
    -- de leur phase, c'est même leur raison d'être. On les rétablit dans ce
    -- qu'ils sont — c'est le défaut signalé par l'orga, pas une décision neuve.
    UPDATE tremplin_ateliers
       SET audience = 'phase'
     WHERE phase = 'montee_sur_scene' AND ouvert_a_toutes = true;

    -- Le miroir suit, pour l'instant de bascule où l'ancien code lit encore.
    UPDATE tremplin_ateliers SET ouvert_a_toutes = (audience = 'toutes');
  END IF;
END $$;
