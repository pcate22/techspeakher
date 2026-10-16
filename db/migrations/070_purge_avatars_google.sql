-- 070 — La photo Google quitte les avatars.
--
-- Elle arrivait par deux chemins : automatiquement à la première connexion
-- Google (l'adapter Auth.js recopie `picture` dans `users.image`), et par un
-- bouton « Utiliser cette photo » sur « Mes connexions ». Les deux ont disparu :
-- la photo de profil se choisit désormais dans la fiche (envoi d'un fichier, ou
-- reprise de la photo LinkedIn), et elle est HÉBERGÉE PAR NOUS — une URL de
-- provider est signée, elle expire, et l'avatar retombait alors sur les
-- initiales sans que personne comprenne pourquoi.
--
-- Cette migration retire les avatars Google restants. Conséquence assumée :
-- ces comptes affichent leurs initiales jusqu'à ce qu'une photo soit envoyée
-- (champ Photo de la fiche). Les photos déposées chez nous (`avatars/…`) et
-- les autres provenances ne sont pas touchées.
UPDATE users
   SET image = NULL
 WHERE image LIKE '%googleusercontent.com%';
