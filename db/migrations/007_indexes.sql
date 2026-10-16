-- Migration — index sur les requêtes chaudes (perf).
-- À exécuter UNE fois dans l'éditeur SQL de Neon. Idempotent.
--   • idx_talks_profile_id      : FK lue à chaque fiche / espace (la plus chaude)
--   • idx_speaker_profiles_status : filtre annuaire / modération / rappels
--   • idx_users_name            : tri de l'annuaire (ORDER BY u.name)

CREATE INDEX IF NOT EXISTS idx_talks_profile_id ON talks (profile_id);
CREATE INDEX IF NOT EXISTS idx_speaker_profiles_status ON speaker_profiles (status);
CREATE INDEX IF NOT EXISTS idx_users_name ON users (name);
