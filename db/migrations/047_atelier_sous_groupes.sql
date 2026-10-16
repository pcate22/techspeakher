-- 047 — ateliers : lieu physique, fenêtre de dates, nature ; sous-groupes.
--
-- Trois manques constatés sur le coaching DevFest 2026 (cf.
-- docs/conception-sous-groupes-ateliers.md) :
--  - OÙ  : un lieu physique, en plus du lien visio (présentiel / visio / hybride) ;
--  - QUAND : une fenêtre de dates (`date` = début, `date_fin` = fin) au lieu d'une
--    date unique, pour les activités « à faire entre deux ateliers » ;
--  - SUIVI : les revues croisées / points individuels ne sont PAS éclatés en une
--    session par personne ; on suit la réalisation par SOUS-GROUPE (fait + date).
--
-- Le sous-groupe généralise le binôme (duo, trio, ou une participante + sa coach) :
-- un coach optionnel (NULL = autonome), un lien « comment se retrouver », une date
-- de réalisation `fait_le` (NULL = pas encore fait). Le membre d'atelier pointe son
-- sous-groupe (`sous_groupe_id`, NULL = pas encore rangée).
--
-- Additif et idempotent. No-op sur base déjà à jour. Appliqué au déploiement via
-- db/sync-to-latest.sql (bloc identique).

ALTER TABLE tremplin_ateliers ADD COLUMN IF NOT EXISTS date_fin DATE;
ALTER TABLE tremplin_ateliers ADD COLUMN IF NOT EXISTS lieu TEXT;
ALTER TABLE tremplin_ateliers ADD COLUMN IF NOT EXISTS nature TEXT NOT NULL
  DEFAULT 'collectif'
  CHECK (nature IN ('collectif', 'sous_groupes'));

-- Fenêtre cohérente : la fin ne précède pas le début (garde nommée, idempotente).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tremplin_ateliers_fenetre_coherente'
  ) THEN
    ALTER TABLE tremplin_ateliers ADD CONSTRAINT tremplin_ateliers_fenetre_coherente
      CHECK (date_fin IS NULL OR date IS NULL OR date_fin >= date);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS tremplin_atelier_sous_groupes (
  id            SERIAL PRIMARY KEY,
  atelier_id    INTEGER NOT NULL REFERENCES tremplin_ateliers(id) ON DELETE CASCADE,
  libelle       TEXT NOT NULL,
  coach_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,  -- NULL = autonome (sans coach)
  lien_visio    TEXT,                                             -- « comment se retrouver »
  fait_le       DATE                                              -- réalisation ; NULL = pas encore fait
);
CREATE INDEX IF NOT EXISTS idx_sous_groupes_atelier ON tremplin_atelier_sous_groupes (atelier_id);

ALTER TABLE tremplin_atelier_membres
  ADD COLUMN IF NOT EXISTS sous_groupe_id INTEGER
  REFERENCES tremplin_atelier_sous_groupes(id) ON DELETE SET NULL;
