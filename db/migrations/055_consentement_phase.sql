-- 055 — Un consentement PAR PHASE pour les speakeuses nommées.
--
-- `tremplin_registrations.public` a été recueilli pour LA GALERIE DES
-- FINALISTES (« me montrer parmi les finalistes de la soirée »). S'en servir
-- pour publier « elle est accompagnée vers le DevFest » serait un changement de
-- finalité : une finaliste qui a accepté d'apparaître en juin n'a pas, par ce
-- geste, accepté de figurer en novembre dans une liste d'accompagnées.
--
-- Le décalage est d'autant plus net que la cohorte de la phase 3 DÉBORDE les
-- finalistes : une participante retenue au CFP de la conférence sans être passée
-- par la finale n'a jamais eu l'occasion de consentir à quoi que ce soit de
-- public. Sans cette colonne, elle serait publiée sur la foi d'un drapeau qui ne
-- parlait pas d'elle.
--
-- Le consentement vit donc sur l'APPARTENANCE À LA PHASE, au plus près de ce
-- qu'il autorise, horodaté pour être démontrable et révocable seul (sortir de
-- la page « montée sur scène » laisse la galerie des finalistes intacte, et
-- réciproquement).
--
-- Défaut FERMÉ : rattacher une participante à une phase ne publie personne.
-- Aucun backfill, volontairement — reprendre l'existant reviendrait à réutiliser
-- le consentement de galerie, c'est-à-dire exactement ce que cette migration
-- corrige. Les accords se recueillent, puis se cochent dans l'admin.
--
-- Idempotent : ADD COLUMN IF NOT EXISTS.

ALTER TABLE tremplin_registration_phases
  ADD COLUMN IF NOT EXISTS public BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE tremplin_registration_phases
  ADD COLUMN IF NOT EXISTS public_consent_at TIMESTAMPTZ;
