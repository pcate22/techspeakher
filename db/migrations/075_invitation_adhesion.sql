-- 075 — L'invitation à adhérer, envoyée une seule fois par fiche en ligne.
--
-- À l'ouverture des adhésions (2026-10-15), Cateline veut écrire aux
-- titulaires d'une fiche publiée qui n'ont pas encore adhéré. L'envoi part
-- d'un bouton orga (`/admin/adhesions/inviter`), par lots : cette date, posée
-- APRÈS chaque envoi réussi, empêche d'écrire deux fois à la même personne
-- (second clic, lot repris après une coupure). NULL = jamais invitée.
-- Cf. docs/conception-adhesions-helloasso.md § 6.
--
-- Idempotent : rejouable sans effet la deuxième fois.

ALTER TABLE speaker_profiles ADD COLUMN IF NOT EXISTS adhesion_invitee_le TIMESTAMPTZ;
