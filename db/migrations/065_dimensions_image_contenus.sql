-- 065 — la taille de l'image déposée, pour que le titre de l'article cesse de
-- sauter au chargement.
--
-- Une image n'est enregistrée que par son URL : rien ne dit sa proportion. En
-- tête d'article, elle s'affiche à sa taille naturelle (nos visuels sont des
-- cartes à lire, un cadre imposé les banderait), donc le navigateur ne peut
-- réserver aucune place tant que l'image n'est pas arrivée : le titre et le
-- corps glissent vers le bas quand elle s'affiche. C'est la dette notée dans
-- docs/dette-technique.md.
--
-- Deux colonnes suffisent : avec `width`/`height` sur la balise, le navigateur
-- connaît la proportion AVANT le téléchargement et garde la place au bon
-- format. Les cartes, elles, n'en ont pas besoin — leur cadre de ratio fixe
-- réserve déjà la hauteur.
--
-- NULLABLE, et ça compte : les images déjà déposées n'ont pas été mesurées. Une
-- taille inconnue est un état normal, pas une anomalie — l'affichage retombe
-- alors sur le comportement d'avant (proportion naturelle, sans réservation).
-- Le prochain enregistrement de l'article les renseignera.
--
-- La mesure se fait dans le NAVIGATEUR de l'orga, au choix du fichier : c'est
-- là que vit un décodeur pour les quatre formats acceptés (PNG, JPEG, WebP,
-- AVIF). Une valeur fantaisiste déformerait la mise en page d'un article du
-- site, rien de plus — et seule une orga peut écrire ici. Le serveur borne
-- quand même à des entiers plausibles (cf. `contenu-form.ts`).

ALTER TABLE contenus ADD COLUMN IF NOT EXISTS image_width  INT;
ALTER TABLE contenus ADD COLUMN IF NOT EXISTS image_height INT;

COMMENT ON COLUMN contenus.image_width IS
  'Largeur en pixels de l''image, mesurée au dépôt. NULL = inconnue (image antérieure).';
COMMENT ON COLUMN contenus.image_height IS
  'Hauteur en pixels de l''image, mesurée au dépôt. NULL = inconnue (image antérieure).';
