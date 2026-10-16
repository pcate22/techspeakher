-- 062 — « Tech Speak'Her » cesse de se couper en fin de ligne DANS LA BASE
-- (migration de DONNÉES).
--
-- Le nom de l'association est servi avec une espace INSÉCABLE partout dans le
-- site, pour qu'il ne se coupe pas entre « Tech » et « Speak'Her » au bout d'une
-- ligne. Les contenus, eux, viennent de la table `contenus` : la liste
-- `/actualites`, l'extrait de l'accueil et les pages d'article la lisent.
--
-- Les fixtures du dépôt ont été corrigées (`src/data/actualites.ts`, les corps
-- des blocs 045 et 047 de `db/sync-to-latest.sql`), mais elles n'atteignent PAS
-- une base déjà en ligne : les seeds sont gardés par `ON CONFLICT (slug) DO
-- NOTHING`, et depuis les migrations 059/060 par une trace dans
-- `seeds_appliques`. Autrement dit, la prod garde ses lignes telles quelles, et
-- le nom continue de s'y couper — sur la liste publique la plus lue.
--
-- D'où cette normalisation, qui remplace l'espace ordinaire par une insécable
-- dans les seuls champs affichés en prose.
--
-- POURQUOI UNE SEULE FOIS. Les contenus s'éditent dans l'admin. Une réécriture
-- rejouée à chaque déploiement corrigerait certes la typographie, mais elle
-- toucherait indéfiniment du texte écrit par l'orga, sans qu'elle l'ait demandé
-- ni puisse s'y soustraire. `sync-to-latest.sql` fait converger le SCHÉMA et pose
-- les seeds ; il ne réécrit pas la prose des autres. La trace `seeds_appliques`
-- — le mécanisme posé par la migration 059 — borne donc ce passage à une fois.
--
-- Les deux apostrophes circulent dans le corpus : la droite (U+0027) dans les
-- titres et chapôs, la courbe (U+2019) dans le verbatim de l'interview 047.
-- Les deux graphies sont traitées, sinon la moitié du corpus reste dehors.
--
-- Idempotent de toute façon : une seconde exécution ne trouverait plus d'espace
-- ordinaire à remplacer.

BEGIN;

-- Les espaces et apostrophes sont écrites en ÉCHAPPEMENTS Postgres (`E'…'`),
-- jamais en littéral : une insécable et une espace ordinaire sont indiscernables
-- à la relecture, et c'est précisément leur différence qu'on manipule ici.
UPDATE contenus
   SET titre = replace(replace(titre, E'Tech Speak\u0027Her', E'Tech\u00A0Speak\u0027Her'),
                                      E'Tech Speak\u2019Her', E'Tech\u00A0Speak\u2019Her'),
       chapo = replace(replace(chapo, E'Tech Speak\u0027Her', E'Tech\u00A0Speak\u0027Her'),
                                      E'Tech Speak\u2019Her', E'Tech\u00A0Speak\u2019Her'),
       corps = replace(replace(corps, E'Tech Speak\u0027Her', E'Tech\u00A0Speak\u0027Her'),
                                      E'Tech Speak\u2019Her', E'Tech\u00A0Speak\u2019Her')
 WHERE NOT EXISTS (SELECT 1 FROM seeds_appliques WHERE cle = '062_nom_insecable_contenus')
   AND (titre LIKE E'%Tech Speak\u0027Her%' OR titre LIKE E'%Tech Speak\u2019Her%'
     OR chapo LIKE E'%Tech Speak\u0027Her%' OR chapo LIKE E'%Tech Speak\u2019Her%'
     OR corps LIKE E'%Tech Speak\u0027Her%' OR corps LIKE E'%Tech Speak\u2019Her%');

-- Passé : on ne réécrira plus la prose de l'orga, même si elle retape le nom
-- avec une espace ordinaire.
INSERT INTO seeds_appliques (cle) VALUES ('062_nom_insecable_contenus')
ON CONFLICT (cle) DO NOTHING;

COMMIT;
