-- 067 — CONSERVATION DES COMPTES : avertir, puis supprimer.
--
-- Limitation de la conservation (RGPD art. 5-1-e) : un compte sans signe de vie
-- depuis deux ans reçoit un avertissement, puis est supprimé s'il ne se réveille
-- pas. Voir docs/conception-conservation-comptes.md.
--
-- Pourquoi une colonne : les sessions sont en JWT, la table `sessions` de
-- l'adapter n'est jamais alimentée, et RIEN en base ne disait quand quelqu'un
-- était passé. La règle était donc inapplicable.
--
-- `last_seen_at` est posée à `now()` pour TOUT LE MONDE : on ne date pas une
-- inactivité qu'on n'a jamais mesurée. La première suppression possible est donc
-- dans deux ans, et chaque suppression repose sur des faits observés.
--
-- `suppression_annoncee_le` est le verrou du préavis : aucune suppression sans
-- avertissement envoyé, et un signe de vie la remet à NULL (sinon une inactivité
-- future supprimerait sans que la personne ait eu sa chance).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suppression_annoncee_le TIMESTAMPTZ;

-- DEFAULT : un compte créé par une voie qui ne passe pas par la connexion
-- (invitation Tremplin, rattachement orga) naîtrait sinon sans mesure, donc
-- « dormant depuis toujours ».
ALTER TABLE users ALTER COLUMN last_seen_at SET DEFAULT now();

UPDATE users SET last_seen_at = now() WHERE last_seen_at IS NULL;

COMMENT ON COLUMN users.last_seen_at IS
  'Dernier passage (callback jwt, écriture au plus hebdomadaire). Sert la conservation des comptes.';
COMMENT ON COLUMN users.suppression_annoncee_le IS
  'Envoi de l''avertissement de suppression pour inactivité (NULL = jamais averti, ou réveillé depuis).';
