-- 052 — un sous-groupe peut avoir PLUSIEURS coachs, et n'a plus de nom.
--
-- Demande orga : « Ils n'ont pas besoin de noms, juste les participantes au sous
-- groupe et éventuellement une ou plusieurs coachs dedans ».
--
-- Deux limites du modèle tombent :
--
-- 1. `coach_user_id` n'acceptait QU'UNE coach. Une table de liaison la remplace.
-- 2. `libelle` était NOT NULL et saisi à la création (« Binôme 1 »…). Le
--    sous-groupe se désigne désormais par QUI est dedans (libellé dérivé, cf.
--    src/lib/sous-groupe-libelle.ts) : la colonne devient facultative. On ne la
--    supprime pas — l'ancien code l'écrit encore le temps de la bascule.
--
-- L'INVARIANT, TENU EN BASE : les coachs d'un sous-groupe sont un sous-ensemble
-- de celles de son ATELIER. La table porte donc `atelier_id`, avec deux clés
-- étrangères COMPOSITES : l'une vers le sous-groupe (id, atelier_id), l'autre
-- vers `tremplin_atelier_coachs` (atelier_id, user_id). Conséquences voulues :
--   * un id forgé, ou un compte qui n'est pas coach de l'atelier, est REFUSÉ par
--     la base, pas seulement par l'écran ;
--   * retirer une coach de l'atelier la retire de ses sous-groupes par CASCADE,
--     sans code applicatif à tenir en phase ;
--   * l'écran ne peut plus afficher une liste de cases INCOMPLÈTE (donc plus
--     effacer en silence une coach qu'il n'aurait pas montrée).
-- Poser cette contrainte coûte moins maintenant qu'après la livraison : ensuite
-- il faudrait une migration de plus ET une passe de réparation sur la prod.
--
-- REPRISE DE L'EXISTANT, sans rien ACCORDER. `tremplin_atelier_coachs` est une
-- table d'AUTORISATION : une ligne y ouvre l'espace coach de l'atelier (liste
-- nominative de toutes ses participantes, ses supports, le dépôt de documents).
-- Des sous-groupes portent un `coach_user_id` dont la coach n'est PAS inscrite
-- sur l'atelier — l'ancien modèle le permettait. On ne l'y inscrit PAS : ce
-- serait élargir l'accès à des données personnelles par script, alors que c'est
-- une décision d'orga. Ces coachs ne sont donc pas reprises, et l'écran du
-- sous-groupe le DIT, avec le geste à faire (cf. `coachHeriteNom`).
--
-- Idempotent, et rejoué à CHAQUE déploiement via db/sync-to-latest.sql : les
-- gardes sont donc par LIGNE (« ce sous-groupe n'a aucune coach reprise »)
-- plutôt que sur l'état global de la table — une garde « table vide » rendait la
-- reprise dépendante des autres sous-groupes, et pouvait ressusciter une coach
-- retirée depuis.

DO $$
BEGIN
  -- Cible de la FK composite vers le sous-groupe. `id` est déjà unique (PK) :
  -- cette contrainte ne restreint rien, elle rend le couple référençable.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tremplin_sous_groupes_id_atelier_uniq'
  ) THEN
    ALTER TABLE tremplin_atelier_sous_groupes
      ADD CONSTRAINT tremplin_sous_groupes_id_atelier_uniq UNIQUE (id, atelier_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS tremplin_sous_groupe_coachs (
  sous_groupe_id INTEGER NOT NULL,
  -- Dénormalisée, mais elle ne peut pas mentir : la première FK composite
  -- garantit qu'elle est bien l'atelier du sous-groupe.
  atelier_id     INTEGER NOT NULL,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (sous_groupe_id, user_id),
  FOREIGN KEY (sous_groupe_id, atelier_id)
    REFERENCES tremplin_atelier_sous_groupes (id, atelier_id) ON DELETE CASCADE,
  FOREIGN KEY (atelier_id, user_id)
    REFERENCES tremplin_atelier_coachs (atelier_id, user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sg_coachs_user
  ON tremplin_sous_groupe_coachs (user_id);

-- Reprise : la coach unique devient la première de la liste, MAIS seulement si
-- elle est déjà coach de l'atelier (la FK la refuserait de toute façon, et
-- l'inscrire d'office lui accorderait un accès — cf. l'en-tête). Gardé par
-- l'absence de coach reprise POUR CE sous-groupe, donc rejouable sans jamais
-- réintroduire une coach retirée depuis (le code met `coach_user_id` à NULL
-- quand il retire la dernière).
INSERT INTO tremplin_sous_groupe_coachs (sous_groupe_id, atelier_id, user_id)
SELECT sg.id, sg.atelier_id, sg.coach_user_id
  FROM tremplin_atelier_sous_groupes sg
  JOIN tremplin_atelier_coachs ac
    ON ac.atelier_id = sg.atelier_id AND ac.user_id = sg.coach_user_id
 WHERE sg.coach_user_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM tremplin_sous_groupe_coachs c WHERE c.sous_groupe_id = sg.id)
ON CONFLICT DO NOTHING;

DO $$
BEGIN
  -- Le nom n'est plus demandé : la colonne devient facultative.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'tremplin_atelier_sous_groupes'
       AND column_name = 'libelle' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE tremplin_atelier_sous_groupes ALTER COLUMN libelle DROP NOT NULL;
  END IF;
END $$;
