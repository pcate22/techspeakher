-- Migration 037 — provenance et preuve du consentement à la diffusion (RGPD).
--
-- Le journal `tremplin_consent_log` disait QUE le consentement a changé et
-- QUAND ; il ne disait pas SUR QUELLE BASE (la personne elle-même ? un
-- formulaire d'inscription clausé ? un e-mail ?) ni OÙ retrouver la preuve.
-- Sans ça, publier une participante recueillie hors plateforme (Tremplin 1)
-- repose sur un simple interrupteur orga non tracé. On enrichit chaque entrée :
--
--   base        : origine du consentement (démontrabilité, art. 7.1 RGPD).
--                 'self' = la personne dans son espace (preuve = l'horodatage) ;
--                 sinon recueil externe attesté par l'orga.
--   preuve_lien : lien vers la source d'un recueil externe (formulaire archivé,
--                 fil d'e-mail dans un espace restreint). Jamais un binaire,
--                 jamais public. NULL pour un consentement self-service.
--
-- Additive et rétro-compatible : les entrées existantes prennent base='self'
-- (le toggle self-service ou le geste orga « en son nom » d'aujourd'hui) et
-- preuve_lien NULL. Cf. docs/conception-autorisation-diffusion.md.

ALTER TABLE tremplin_consent_log
  ADD COLUMN IF NOT EXISTS base TEXT NOT NULL DEFAULT 'self'
    CHECK (base IN ('self', 'formulaire_inscription', 'email', 'autre'));

ALTER TABLE tremplin_consent_log
  ADD COLUMN IF NOT EXISTS preuve_lien TEXT;
