-- 074 — Les adhésions HelloAsso entrent dans la plateforme, et l'annuaire
-- devient réservé aux membres (derrière FLAG_ADHESIONS, éteint par défaut).
--
-- Conception : docs/conception-adhesions-helloasso.md (validée le 2026-10-15).
--
-- - `user_memberships.helloasso_item_id` : l'article HelloAsso qui a posé
--   l'échéance, une TRACE pour le retrouver dans HelloAsso. Volontairement
--   SANS index unique : l'idempotence vient du recalcul complet, et un article
--   peut changer de compte (une adresse qui passe d'un compte à un autre) —
--   l'unicité bloquait alors toute la synchro (revue du 2026-10-15). Ni
--   montant, ni nom, ni réponses au formulaire ne sont copiés (minimisation).
-- - `user_memberships.relance_envoyee_le` : la relance avant échéance part une
--   fois par échéance (remise à NULL quand l'échéance change).
-- - `accounts.email` : l'adresse que Google ou LinkedIn a donnée à la
--   connexion. Auth.js ne la garde pas ; sans elle, une adhésion payée avec
--   l'adresse d'un compte relié était introuvable. Adresses VÉRIFIÉES par le
--   fournisseur : personne ne réclame une adhésion en tapant une adresse.
-- - `speaker_profiles.annuaire_retrait_le` : la date annoncée par le préavis.
--   NULL = aucun préavis en cours. Une fiche ne passe jamais en pause sans
--   cette date, posée trente jours plus tôt par un e-mail.
-- - `speaker_profiles.status` gagne `en_pause` : hors annuaire faute
--   d'adhésion. Distinct de `masque` (décision d'orga ou de la personne) :
--   la fiche revient toute seule dès l'adhésion.
--
-- Idempotent : rejouable sans effet la deuxième fois.

ALTER TABLE user_memberships ADD COLUMN IF NOT EXISTS helloasso_item_id BIGINT;
ALTER TABLE user_memberships ADD COLUMN IF NOT EXISTS relance_envoyee_le TIMESTAMPTZ;

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS email TEXT;

ALTER TABLE speaker_profiles ADD COLUMN IF NOT EXISTS annuaire_retrait_le TIMESTAMPTZ;

-- La liste fermée s'élargit : on remplace la contrainte (même nom) plutôt que
-- d'en empiler une seconde, qui refuserait `en_pause`.
ALTER TABLE speaker_profiles DROP CONSTRAINT IF EXISTS speaker_profiles_status_ck;
ALTER TABLE speaker_profiles
  ADD CONSTRAINT speaker_profiles_status_ck
  CHECK (status IN ('brouillon', 'en_attente', 'publie', 'refuse', 'masque', 'en_pause'));
