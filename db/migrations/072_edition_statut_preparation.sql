-- 072 — Une édition du Tremplin naît en préparation, et son statut est une
-- liste fermée.
--
-- Pourquoi : le code connaît cinq statuts depuis que `preparation` existe
-- (src/lib/tremplin-statut.ts), la base en ignorait tout — `DEFAULT 'ouvert'`,
-- aucun CHECK, et un commentaire resté à quatre valeurs. Or le mode opératoire
-- réel de l'orga passe par l'éditeur SQL de Neon : une édition créée à la main,
-- sans statut, naissait **publique**, annoncée avant qu'on ait décidé de
-- l'annoncer. Le défaut devient `preparation` (invisible du public) et le CHECK
-- ferme la liste sur les cinq valeurs que le code sait lire, quel que soit le
-- chemin d'écriture.
--
-- Le défaut ne touche que les INSERT à venir : les éditions déjà en base
-- gardent leur statut. Les cinq valeurs sont exactement celles écrites par
-- l'application depuis toujours (bornées par `isEditionStatut`), donc rien à
-- redresser avant d'ajouter la contrainte.
--
-- Idempotent : rejouable sans effet la deuxième fois.
--
-- SI L'ADD CONSTRAINT LÈVE au déploiement, c'est qu'une ligne porte un statut
-- hors liste — une faute de frappe passée par l'éditeur Neon, précisément le
-- mode opératoire que cette migration vient border. `sync-to-latest.sql` étant
-- rejoué AVANT chaque livraison, la livraison reste bloquée tant que ce n'est
-- pas réglé. C'est le bon comportement (mieux vaut refuser que redresser une
-- donnée en silence). Le diagnostic tient en une ligne :
--   SELECT DISTINCT statut FROM tremplin_editions;
-- puis corriger à la main vers l'une des cinq valeurs.

ALTER TABLE tremplin_editions ALTER COLUMN statut SET DEFAULT 'preparation';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tremplin_editions_statut_ck'
  ) THEN
    ALTER TABLE tremplin_editions
      ADD CONSTRAINT tremplin_editions_statut_ck
      CHECK (statut IN ('preparation', 'ouvert', 'en_cours', 'clos', 'archive'));
  END IF;
END $$;
