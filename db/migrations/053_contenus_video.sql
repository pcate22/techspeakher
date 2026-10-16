-- 053 — un article peut porter une vidéo, à regarder OU à lire.
--
-- Demande orga : « Pour Aurélie on devra afficher la vignette en haut de
-- l'article car on va avoir l'article à lire et la vidéo à regarder pour ceux
-- qui préfèrent ». Les interviews Behind the Scenes existent désormais sous
-- deux formes ; l'article en est le point d'entrée unique, et propose les deux.
--
-- Une seule colonne suffit : l'URL de la vidéo sur notre chaîne YouTube. La
-- vignette s'en DÉRIVE (src/lib/youtube.ts) au lieu d'être une deuxième saisie
-- à tenir cohérente avec la première. `image_url` / `image_alt` restent ce
-- qu'elles étaient : l'illustration des métadonnées de partage.

ALTER TABLE contenus ADD COLUMN IF NOT EXISTS video_url TEXT;

COMMENT ON COLUMN contenus.video_url IS
  'URL de la vidéo YouTube de l''article. La vignette en est dérivée.';
