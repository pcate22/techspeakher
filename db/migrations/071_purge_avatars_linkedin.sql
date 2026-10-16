-- 071 — La photo LinkedIn quitte les avatars, elle aussi.
--
-- Suite directe de la 070. Le raisonnement était le même pour les deux
-- providers, mais seul Google avait été purgé : les URLs `media.licdn.com`
-- déjà en base restaient, en sursis. Elles sont SIGNÉES et expirent — l'avatar
-- serait retombé sur les initiales quelques semaines plus tard, sans que
-- personne fasse le lien avec cette date.
--
-- Plus aucun chemin ne les écrit depuis la 070 (le `profile()` des deux
-- providers laisse `image` à NULL, et la reprise LinkedIn COPIE la photo dans
-- notre stockage). Cette migration solde donc l'historique.
--
-- Conséquence assumée : ces comptes affichent leurs initiales jusqu'à ce
-- qu'une photo soit posée — « Reprendre ma photo LinkedIn » suffit, et la
-- copie obtenue, elle, ne périme pas. Les photos déposées chez nous
-- (`avatars/…`) et les autres provenances ne sont pas touchées.
UPDATE users
   SET image = NULL
 WHERE image LIKE '%licdn.com%';
