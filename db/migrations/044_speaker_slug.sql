-- Migration 044 — URL personnalisée des fiches speakeuses (slug façon LinkedIn).
-- Une fiche vivait à /speakeuses/{id} (id numérique) : peu parlant à partager.
-- On ajoute un slug lisible « nom-prenom », UNIQUE, qui devient l'URL canonique
-- (l'ancien id numérique continue de rediriger vers le slug, côté app).
--
-- Le slug est dérivé du nom via la MÊME expression SQL que la migration 027
-- (jumelle de slugify() dans src/lib/slug.ts : translate accents → non-alphanum
-- → '-' → lower → trim '-'). Un index UNIQUE garantit l'unicité ; Postgres
-- autorise plusieurs NULL (un brouillon sans nom reste sans slug).
-- Idempotente.
ALTER TABLE speaker_profiles
  ADD COLUMN IF NOT EXISTS slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_speaker_profiles_slug
  ON speaker_profiles (slug);

-- Backfill : chaque profil sans slug ayant un nom de compte reçoit « base »
-- (nom slugifié) si elle est libre ; sinon (homonymes, ou base déjà prise par
-- un run précédent) « base-{id} » — l'id étant unique, aucune collision d'index.
-- Le row_number départage les homonymes traités dans le même passage.
WITH base AS (
  SELECT sp.id,
         trim(BOTH '-' FROM lower(regexp_replace(
           translate(u.name,
                     'àâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ',
                     'aaaeeeeiioouuucAAAEEEEIIOOUUUC'),
           '[^a-zA-Z0-9]+', '-', 'g'))) AS base
    FROM speaker_profiles sp
    JOIN users u ON u.id = sp."userId"
   WHERE sp.slug IS NULL
     AND u.name IS NOT NULL
),
candidat AS (
  SELECT id, base,
         row_number() OVER (PARTITION BY base ORDER BY id) AS rang
    FROM base
   WHERE base <> ''
)
UPDATE speaker_profiles sp
   SET slug = CASE
                -- Base tout en chiffres : « /speakeuses/1234 » serait résolu
                -- comme un id (jamais comme un slug) → on suffixe l'id pour
                -- garantir au moins une non-chiffre.
                WHEN c.base ~ '^[0-9]+$' THEN c.base || '-' || sp.id
                WHEN c.rang = 1
                     AND NOT EXISTS (
                       SELECT 1 FROM speaker_profiles x WHERE x.slug = c.base
                     )
                THEN c.base
                ELSE c.base || '-' || sp.id
              END
  FROM candidat c
 WHERE sp.id = c.id
   AND sp.slug IS NULL;
