-- 073 — Les statuts de fiche et d'adhésion deviennent des listes fermées.
--
-- Pourquoi : même carence que la 072, à l'échelle des deux colonnes dont les
-- lecteurs échouent OUVERT sur un statut inconnu (P0-8 de la dette) :
--
-- - `speaker_profiles.status` : `src/lib/tremplin-public.ts` lit
--   `NOT IN ('masque', 'refuse')` — un statut hors liste FAIT APPARAÎTRE bio,
--   LinkedIn et site perso dans la galerie publique. C'est la table la plus
--   sensible du schéma côté RGPD.
-- - `user_memberships.status` : `src/lib/comptes-inactifs.ts` lit
--   `<> 'active'` — un statut hors liste range le compte dans la cohorte de
--   SUPPRESSION. Et cette table n'a AUCUNE porte applicative : elle se tient à
--   la main dans l'éditeur SQL de Neon, précisément le chemin d'écriture qui
--   produit des fautes de frappe.
--
-- La faute est refusée à l'écriture par la base ; les lecteurs restent en
-- l'état (corriger chaque lecture en positif laisserait la prochaine lecture
-- refaire la faute). Miroirs TS : PROFILE_STATUSES
-- (src/lib/profile-status.ts) et MEMBERSHIP_STATUSES
-- (src/lib/membership-status.ts), tenus ensemble par
-- `listes-fermees-sql.integration.test.ts`.
--
-- Rien à redresser avant les contraintes : côté fiches, les cinq valeurs sont
-- celles que l'application écrit depuis toujours (bornées par le type
-- `ProfileStatus`) ; côté adhésions, les lignes existantes ont été posées à la
-- main — si l'une porte autre chose que 'active'/'expired', l'ADD CONSTRAINT
-- lève, et c'est le bon comportement (cf. ci-dessous).
--
-- Idempotent : rejouable sans effet la deuxième fois.
--
-- SI L'ADD CONSTRAINT LÈVE au déploiement, c'est qu'une ligne porte un statut
-- hors liste — une faute de frappe passée par l'éditeur Neon, précisément le
-- mode opératoire que cette migration vient border. `sync-to-latest.sql` étant
-- rejoué AVANT chaque livraison, la livraison reste bloquée tant que ce n'est
-- pas réglé. Mieux vaut refuser que redresser une donnée en silence. Le
-- diagnostic tient en une ligne par table :
--   SELECT DISTINCT status FROM speaker_profiles;
--   SELECT DISTINCT status FROM user_memberships;
-- puis corriger à la main vers l'une des valeurs de la liste.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'speaker_profiles_status_ck'
  ) THEN
    ALTER TABLE speaker_profiles
      ADD CONSTRAINT speaker_profiles_status_ck
      CHECK (status IN ('brouillon', 'en_attente', 'publie', 'refuse', 'masque'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_memberships_status_ck'
  ) THEN
    ALTER TABLE user_memberships
      ADD CONSTRAINT user_memberships_status_ck
      CHECK (status IN ('active', 'expired'));
  END IF;
END $$;
