-- 060 — Les seeds de contenu 045 et 047 se posent UNE fois (migration de DONNÉES).
--
-- `db/sync-to-latest.sql` est rejoué à CHAQUE déploiement. Deux seeds
-- d'articles n'étaient gardés que par `ON CONFLICT (slug) DO NOTHING`, ce qui
-- ne tient que tant qu'une ligne porte ce slug :
--
--  - SUPPRIMER l'article dans l'admin le faisait revenir au déploiement suivant.
--    Une demande de retrait (RGPD art. 17) s'annulait toute seule ;
--  - le RENOMMER libère le slug (`updateContenu` le dérive du titre) : le seed
--    réinsérait un doublon qui, à date de publication égale, gagne l'affichage
--    public (`ORDER BY publie_le DESC NULLS LAST, id DESC`).
--
-- La migration 059 a posé le mécanisme (`seeds_appliques`) pour le récit 2025.
-- Celle-ci l'étend aux deux seeds antérieurs. La garde elle-même vit dans les
-- blocs 045 et 047 de `sync-to-latest.sql` : elle porte sur le REJEU, ce qu'une
-- migration ne fait jamais. Ce fichier écrit les traces qui la rendent effective.
--
-- L'ORDRE EST LE POINT DÉLICAT. Une trace écrite APRÈS le seed qu'elle garde
-- arrive trop tard : au premier rejeu du nouveau fichier, la prod n'a pas encore
-- de trace, la garde est donc encore ouverte, le seed se repose une dernière
-- fois — et cet état-là se fige. Une suppression demandée la veille
-- ressusciterait, cette fois pour de bon. Les traces s'écrivent donc AVANT le
-- premier seed gardé, en tête de `sync-to-latest.sql`.
--
-- Base VIERGE ou base EN LIGNE se distinguent sans ambiguïté par `EXISTS (SELECT
-- 1 FROM contenus)` : dans le fichier de sync, ce test précède le premier
-- `INSERT INTO contenus`, donc la table est encore vide sur une base neuve (qui
-- doit recevoir les articles) et déjà peuplée sur toute base déployée (dont
-- l'état courant fait foi, suppressions comprises).
--
-- Ce que ça NE change PAS : le corps de l'interview reste piloté par le repo
-- (`ON CONFLICT DO UPDATE SET corps`, choix assumé de la migration 047 — un long
-- verbatim s'édite en PR). Tant que la ligne existe, elle repasse par cet
-- `ON CONFLICT`. La garde change le sort d'une suppression, jamais celui d'une
-- édition.
--
-- Aucune colonne touchée. Idempotent. Bloc identique dans db/sync-to-latest.sql.

CREATE TABLE IF NOT EXISTS seeds_appliques (
  cle         TEXT PRIMARY KEY,
  applique_le TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO seeds_appliques (cle)
SELECT v.cle
  FROM (VALUES ('045_article_heberger_slides'), ('047_interview_rachel_dubois')) AS v(cle)
 WHERE EXISTS (SELECT 1 FROM contenus)
ON CONFLICT (cle) DO NOTHING;
