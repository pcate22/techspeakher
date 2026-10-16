-- 050 — Titres de séances lisibles (revue UX post-prod du 31/07).
--
-- « Revue croisée entre speakeuses (1) » : sur une carte d'agenda, « (1) » se
-- lit comme un badge de compteur (1 notification ? 1 place ?), pas comme un
-- numéro de séance. On écrit ce que c'est : « (séance 1) ».
--
-- Idempotente : le motif « (N) » en fin de titre n'existe plus après passage.

UPDATE tremplin_ateliers
   SET titre = regexp_replace(titre, '\((\d+)\)$', '(séance \1)')
 WHERE titre ~ '\(\d+\)$';
