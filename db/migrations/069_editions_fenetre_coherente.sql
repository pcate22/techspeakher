-- 069 — Fenêtre d'une édition cohérente (date_fin exploitable).
--
-- Pourquoi : `date_fin` existe depuis la migration 027 mais rien ne l'écrivait.
-- Elle devient la donnée qui borne ce qu'une édition LÈGUE à la date d'un talk
-- (dateLegueeParEdition) : un événement multi-jours lègue le mois, jamais un
-- faux jour précis. Le formulaire orga l'écrit désormais ; la base garantit
-- qu'une fenêtre écrite est cohérente (fin jamais avant le début, jamais de
-- fin orpheline sans début), quel que soit le chemin d'écriture.
--
-- Idempotent : rejouable sans effet la deuxième fois.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'conference_editions_fenetre_ck'
  ) THEN
    ALTER TABLE conference_editions
      ADD CONSTRAINT conference_editions_fenetre_ck
      CHECK (date_fin IS NULL OR (date_debut IS NOT NULL AND date_fin >= date_debut));
  END IF;
END $$;
