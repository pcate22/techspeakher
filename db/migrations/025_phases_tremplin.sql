-- Migration 025 — les phases comme colonne vertébrale (cf. docs/conception-phases-tremplin.md).
--
-- 1) `phase` sur l'atelier : avant la soirée (prépa CFP) / après (prépa
--    conférence). La finale (soirée) n'a pas d'atelier.
-- 2) Appartenance MULTI-PHASE d'une inscription (rosters différents par phase ;
--    phase 2 dépend de la phase 1, phase 3 indépendante). La phase 2 reste
--    pilotée par `finale_presente` ; cette table gère 1 et 3.
-- 3) Jury d'une édition (personnes sans compte) : nom/prénom/fonction/entreprise
--    PUBLICS (accord recueilli), e-mail INTERNE.

ALTER TABLE tremplin_ateliers ADD COLUMN IF NOT EXISTS phase TEXT NOT NULL
  DEFAULT 'cfp_et_pitch'
  CHECK (phase IN ('cfp_et_pitch', 'montee_sur_scene'));

CREATE TABLE IF NOT EXISTS tremplin_registration_phases (
  registration_id INTEGER NOT NULL REFERENCES tremplin_registrations(id) ON DELETE CASCADE,
  phase           TEXT NOT NULL
                  CHECK (phase IN ('cfp_et_pitch', 'finale', 'montee_sur_scene')),
  PRIMARY KEY (registration_id, phase)
);

CREATE TABLE IF NOT EXISTS tremplin_jury (
  id          SERIAL PRIMARY KEY,
  edition_id  INTEGER NOT NULL REFERENCES tremplin_editions(id) ON DELETE CASCADE,
  nom         TEXT NOT NULL,
  prenom      TEXT,
  fonction    TEXT,
  entreprise  TEXT,
  email       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_jury_edition ON tremplin_jury (edition_id);

-- Reprise de l'existant : on dérive l'appartenance des inscriptions déjà en base
-- depuis `phase_entree` (colonne mono-phase historique). Toute entrée en phase 1
-- ou 2, et toute finaliste, appartient à la phase 1 (phase 2 ⊂ phase 1) ; une
-- entrée « montée sur scène » appartient à la phase 3. Idempotent.
INSERT INTO tremplin_registration_phases (registration_id, phase)
SELECT id, 'cfp_et_pitch' FROM tremplin_registrations
 WHERE phase_entree IN ('cfp_et_pitch', 'finale') OR finale_presente = true
ON CONFLICT DO NOTHING;
INSERT INTO tremplin_registration_phases (registration_id, phase)
SELECT id, 'montee_sur_scene' FROM tremplin_registrations
 WHERE phase_entree = 'montee_sur_scene'
ON CONFLICT DO NOTHING;
