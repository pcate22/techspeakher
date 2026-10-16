-- Lot N4 (docs/conception-lot-n4-reactions.md) : Bravo 👏 sur les cartes du fil.
--
-- Un applaudissement NOMINATIF (membre × carte), interne à l'espace
-- connecté. Les cartes du fil sont DÉRIVÉES (jamais stockées) : un bravo
-- référence sa ligne source — exactement une des trois (contrainte CHECK),
-- et la suppression de la source emporte ses bravos (CASCADE). Le retrait
-- rétroactif (fiche retirée, contenu dépublié) PURGE côté code.
--
-- Index uniques : la CIBLE d'abord — le même index sert l'unicité (un bravo
-- par membre et par carte), la lecture du fil (filtre par cible) et les
-- cascades FK.

CREATE TABLE IF NOT EXISTS bravos (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  occurrence_id INTEGER REFERENCES talk_occurrences(id) ON DELETE CASCADE,
  profile_id INTEGER REFERENCES speaker_profiles(id) ON DELETE CASCADE,
  contenu_id INTEGER REFERENCES contenus(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bravos_cible_ck CHECK (
    (occurrence_id IS NOT NULL)::int + (profile_id IS NOT NULL)::int
      + (contenu_id IS NOT NULL)::int = 1
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS bravos_occurrence_uq
  ON bravos (occurrence_id, user_id) WHERE occurrence_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS bravos_profile_uq
  ON bravos (profile_id, user_id) WHERE profile_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS bravos_contenu_uq
  ON bravos (contenu_id, user_id) WHERE contenu_id IS NOT NULL;

-- Cascade du donneur (compte supprimé = ses bravos partent).
CREATE INDEX IF NOT EXISTS idx_bravos_user ON bravos (user_id);
