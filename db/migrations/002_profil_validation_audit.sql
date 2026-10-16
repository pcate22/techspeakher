-- Migration — rôle orga + audit de validation des profils (qui valide, quand).
-- À exécuter UNE fois dans l'éditeur SQL de Neon.

-- Rôle orga (modération) sur la table des comptes.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_orga BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE speaker_profiles
  ADD COLUMN IF NOT EXISTS validated_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE speaker_profiles
  ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ;

-- (Optionnel) Désigner une orga, par e-mail :
-- UPDATE users SET is_orga = true WHERE email = 'cateline.puccetti@…';
