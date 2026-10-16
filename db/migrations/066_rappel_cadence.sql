-- 066 — LA SPEAKEUSE CHOISIT LA FRÉQUENCE DE SES RAPPELS.
--
-- Deux e-mails POUSSENT sur une fiche : le rappel de mise à jour des fiches
-- publiées (cron quotidien) et la relance des brouillons en sommeil (orga).
-- Aucun des deux ne se refusait : la seule sortie était de supprimer son compte.
--
-- La distinction qui justifie cette colonne : un RAPPEL, c'est nous qui
-- poussons, et ça revient ; une NOTIFICATION (lien de connexion, décision sur la
-- fiche, message reçu) annonce un fait et s'arrête. On ne coupe jamais la
-- seconde, on doit pouvoir régler la première.
--
-- En toutes lettres plutôt qu'en nombre de jours : un « 0 » pour « aucun » se
-- lit trop facilement comme « tout le temps », et la base dit ici elle-même ce
-- que le choix signifie. NULL = rien de choisi, donc le délai réglé par
-- l'équipe s'applique — et le comportement d'avant cette migration est
-- reconduit à l'identique pour tout le monde.
--
-- Voir docs/conception-cadence-rappels.md.

ALTER TABLE speaker_profiles
  ADD COLUMN IF NOT EXISTS rappel_cadence TEXT;

ALTER TABLE speaker_profiles
  DROP CONSTRAINT IF EXISTS speaker_profiles_rappel_cadence_check;

ALTER TABLE speaker_profiles
  ADD CONSTRAINT speaker_profiles_rappel_cadence_check
  CHECK (rappel_cadence IS NULL
      OR rappel_cadence IN ('mensuel', 'bimestriel', 'semestriel', 'aucun'));

COMMENT ON COLUMN speaker_profiles.rappel_cadence IS
  'Fréquence acceptée des rappels sur la fiche (NULL = délai réglé par l''équipe). Ne concerne jamais les e-mails de compte.';
