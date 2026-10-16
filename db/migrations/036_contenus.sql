-- Migration 036 — Contenus éditoriaux : publications (article = actualité) + pages.
-- Voir docs/conception-articles.md et docs/implementation-articles.md.
--
-- Un SEUL type polymorphe : une actualité est la vue-carte d'une publication,
-- pas un objet distinct (« article = actualité »). Le type 'page' partage la
-- même table (prose autonome à slug fixe, ex. « À propos »).
--
-- Idempotente : rejouable sans effet de bord.

CREATE TABLE IF NOT EXISTS contenus (
  id           SERIAL PRIMARY KEY,
  -- 'publication' (datée, listée, RSS) | 'page' (fixe, autonome)
  type         TEXT NOT NULL,
  -- slugify(titre) — JUMEAU SQL/TS de src/lib/slug.ts. Unique sur toute la
  -- table : pas de collision publication/page (routage /articles vs slug fixe).
  slug         TEXT NOT NULL UNIQUE,
  titre        TEXT NOT NULL,
  -- Teaser : carte + description RSS + meta description SEO.
  chapo        TEXT,
  -- Markdown brut. VIDE = publication d'annonce/lien (carte sans page dédiée).
  corps        TEXT NOT NULL DEFAULT '',
  image_url    TEXT,
  image_alt    TEXT,
  -- Champs de publication (NULL pour une page) :
  categorie    TEXT,   -- 'Meetup & Talk' | 'Interview' | 'Tremplin' | 'Communauté'
  tag          TEXT,   -- 'À venir' | 'En cours' | 'Passé'
  lien         TEXT,   -- lien interne (carte qui pointe ailleurs)
  lien_externe TEXT,   -- lien externe
  lien_label   TEXT,   -- libellé du lien externe
  statut       TEXT NOT NULL DEFAULT 'brouillon',   -- 'brouillon' | 'publie'
  -- Publication : date affichée + tri + RSS. Page : NULL.
  publie_le    DATE,
  maj_le       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT contenus_type_ck   CHECK (type IN ('publication', 'page')),
  CONSTRAINT contenus_statut_ck CHECK (statut IN ('brouillon', 'publie')),
  -- Une image sans texte alternatif est interdite (a11y non négociable) :
  -- défense en base, doublée par la validation Zod (src/lib/contenu-form.ts).
  CONSTRAINT contenus_img_alt_ck CHECK (image_url IS NULL OR image_alt IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_contenus_type_statut ON contenus (type, statut);
CREATE INDEX IF NOT EXISTS idx_contenus_publie_le   ON contenus (publie_le);
