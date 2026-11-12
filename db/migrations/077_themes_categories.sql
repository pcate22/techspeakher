-- 077 — Les anciens sujets deviennent des thèmes précis.
--
-- Les 11 sujets larges (« Cloud / DevOps / Infra »…) sont remplacés par des
-- sous-catégories rangées en catégories (src/data/domaines.ts). Chaque fiche
-- garde son sens : un ancien sujet devient un ou deux thèmes, « Autre » est
-- retiré (la fiche reste publiée, sans thème). La table est la même que
-- src/lib/reprise-sujets.ts ; un test garde les deux d'accord.
--
-- Idempotent : une valeur déjà nouvelle passe telle quelle, et le WHERE ne
-- touche que les fiches qui portent un libellé de la table (« Mobile » existe
-- avant et après : le réécrire à l'identique est sans effet).

UPDATE speaker_profiles
SET sujets = ARRAY(
  SELECT u.t
  FROM unnest(sujets) WITH ORDINALITY AS s(sujet, rang)
  CROSS JOIN LATERAL unnest(
    CASE s.sujet
        WHEN 'IA / Machine Learning / Data' THEN ARRAY['IA / Machine Learning', 'Data / BI']::text[]
        WHEN 'Développement web / Front-end' THEN ARRAY['Web / Front-end']::text[]
        WHEN 'Mobile' THEN ARRAY['Mobile']::text[]
        WHEN 'Cloud / DevOps / Infra' THEN ARRAY['Cloud', 'DevOps']::text[]
        WHEN 'Cybersécurité' THEN ARRAY['Cybersécurité']::text[]
        WHEN 'UX / Design / Accessibilité' THEN ARRAY['UX / UI', 'Accessibilité']::text[]
        WHEN 'Produit / Agilité' THEN ARRAY['Product management', 'Agilité']::text[]
        WHEN 'Leadership / Soft skills' THEN ARRAY['Leadership', 'Soft skills']::text[]
        WHEN 'Recherche / Académique (PhD)' THEN ARRAY['Recherche / PhD']::text[]
        WHEN 'Innovation / R&D' THEN ARRAY['R&D']::text[]
        WHEN 'Autre' THEN ARRAY[]::text[]
        ELSE ARRAY[s.sujet]
    END
  ) WITH ORDINALITY AS u(t, pos)
  GROUP BY u.t
  ORDER BY min(s.rang), min(u.pos)
)
WHERE sujets && ARRAY['IA / Machine Learning / Data', 'Développement web / Front-end', 'Mobile', 'Cloud / DevOps / Infra', 'Cybersécurité', 'UX / Design / Accessibilité', 'Produit / Agilité', 'Leadership / Soft skills', 'Recherche / Académique (PhD)', 'Innovation / R&D', 'Autre']::text[];
