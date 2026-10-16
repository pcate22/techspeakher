-- Migration 017 — Coachs reliés aux comptes de la plateforme + genre déclaratif.
--
-- Un coach d'atelier est un COMPTE (pas forcément une speakeuse publiée, pas
-- forcément une femme) : liaison n-n atelier ↔ users, invitable par e-mail
-- comme les participantes. `tremplin_ateliers.coachs` (texte libre) reste en
-- affichage de secours pour l'historique.
--
-- users.genre : facultatif, déclaratif (femme / homme / non_binaire, NULL =
-- non renseigné) — finalité : statistiques de mixité de l'accompagnement.

-- Profil « animateur / coach » (cumulable avec orga ; speakeuse = profil dédié).
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_coach BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS genre TEXT
  CHECK (genre IN ('femme', 'homme', 'non_binaire') OR genre IS NULL);

CREATE TABLE IF NOT EXISTS tremplin_atelier_coachs (
  atelier_id INTEGER NOT NULL REFERENCES tremplin_ateliers(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (atelier_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_atelier_coachs_user ON tremplin_atelier_coachs (user_id);

-- Coaching INDIVIDUEL : un coach assigné directement à une participante
-- (complète les coachs d'atelier ; l'assignation reste un geste orga).
CREATE TABLE IF NOT EXISTS tremplin_registration_coachs (
  registration_id INTEGER NOT NULL REFERENCES tremplin_registrations(id) ON DELETE CASCADE,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (registration_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_registration_coachs_user ON tremplin_registration_coachs (user_id);
