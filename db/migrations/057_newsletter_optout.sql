-- 057 — SE DÉSABONNER de la lettre d'information sans perdre le service.
--
-- Deux canaux, deux régimes, et c'est tout l'objet de cette colonne :
--   • le SERVICE (lien de connexion, décision de publication, message reçu,
--     rappel de mise à jour) part de la plateforme et ne se refuse pas : c'est
--     ce pour quoi le compte existe ;
--   • la LETTRE D'INFORMATION (nouveautés, vie de l'association) part de Brevo
--     et se refuse en un clic, sans que rien d'autre s'arrête.
--
-- Modèle OPT-OUT : l'absence de date vaut abonnement (communication d'une
-- association à ses membres, intérêt légitime). La date sert deux choses : ne
-- plus synchroniser la personne vers Brevo, et pouvoir dire QUAND elle s'est
-- désabonnée si elle le demande.

ALTER TABLE users ADD COLUMN IF NOT EXISTS newsletter_optout_at TIMESTAMPTZ;

COMMENT ON COLUMN users.newsletter_optout_at IS
  'Désabonnement de la lettre d''information (NULL = abonnée). Les e-mails de service ne sont jamais concernés.';
