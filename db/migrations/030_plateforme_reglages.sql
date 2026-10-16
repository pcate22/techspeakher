-- Migration 030 — Réglages de la plateforme (lot C4, cf.
-- docs/conception-technique-tableaux-de-bord.md). Table clé-valeur : une ligne
-- par réglage MODIFIÉ seulement — les valeurs par défaut vivent dans le code
-- (src/lib/reglages.ts), pas de seed.

CREATE TABLE IF NOT EXISTS plateforme_reglages (
  cle        TEXT PRIMARY KEY,
  valeur     TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
