-- Migration 038 — Drapeau de diffusion RSS des contenus.
-- Voir docs/conception-articles.md : le seed des ANCIENNES actualités ne doit
-- PAS repartir dans le flux RSS (donc pas de repost LinkedIn automatique).
-- `au_flux` = false pour le contenu importé/historique, true (défaut) pour tout
-- ce qui est publié via l'admin à partir de maintenant.
-- Idempotente.
ALTER TABLE contenus ADD COLUMN IF NOT EXISTS au_flux BOOLEAN NOT NULL DEFAULT TRUE;
