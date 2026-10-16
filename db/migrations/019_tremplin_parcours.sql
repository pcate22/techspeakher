-- Migration 019 — Parcours d'une participante (cf. docs/parcours-participante.md).
--
-- Une édition a trois phases : 1 accompagnement CFP et pitch (inscriptions +
-- ateliers), 2 finale du tremplin (soirée), 3 accompagnement montée sur scène
-- (post-finale, jusqu'à la conférence). Chaque inscription porte sa PHASE
-- D'ENTRÉE (à quel moment elle a rejoint le parcours) ; finalistes et podium
-- restent sur les colonnes existantes.
--
-- La PRÉSENCE se pointe atelier par atelier, en TRI-ÉTAT : « non renseignée »
-- par défaut (l'interface ne devine pas), « présente » / « absente » quand
-- l'orga pointe. « Venue aux ateliers » = présente à au moins un atelier
-- (dérivé, pas de colonne).

ALTER TABLE tremplin_registrations ADD COLUMN IF NOT EXISTS phase_entree TEXT NOT NULL
  DEFAULT 'cfp_et_pitch'
  CHECK (phase_entree IN ('cfp_et_pitch', 'finale', 'montee_sur_scene'));

ALTER TABLE tremplin_atelier_membres ADD COLUMN IF NOT EXISTS presence TEXT NOT NULL
  DEFAULT 'non_renseignee'
  CHECK (presence IN ('non_renseignee', 'presente', 'absente'));
