-- Migration 033 — Miroir sujet ← talk pitché + backfill des sujets existants.
--
-- 1) Triggers : `registration.sujet` (titre affiché publiquement) devient dérivé
--    du talk pitché (`talk_id`), maintenu EN BASE (aucun writer applicatif requis).
--    Cf. docs/conception-talk-pitche-migration.md.
-- 2) Backfill (one-shot, idempotent) : transforme chaque `sujet` libre existant
--    en talk « Sujet proposé » (marqueur source = 'tremplin') rattaché à
--    l'inscription, et réconcilie les lignes déjà pitchées depuis #146.
--
-- Idempotent : rejouable sans risque (CREATE OR REPLACE, DROP/CREATE trigger,
-- backfill borné par `talk_id IS NULL`).

-- ── 1. Triggers (identiques à db/schema.sql et db/sync-to-latest.sql) ──
CREATE OR REPLACE FUNCTION tremplin_sujet_from_talk() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public, pg_temp
  AS $$
BEGIN
  IF NEW.talk_id IS NOT NULL THEN
    SELECT titre INTO NEW.sujet FROM speaker_talks WHERE id = NEW.talk_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.talk_id IS NOT NULL AND NEW.classement IS NULL THEN
    NEW.sujet := NULL;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_registration_sujet_from_talk ON tremplin_registrations;
CREATE TRIGGER trg_registration_sujet_from_talk
  BEFORE INSERT OR UPDATE OF talk_id ON tremplin_registrations
  FOR EACH ROW EXECUTE FUNCTION tremplin_sujet_from_talk();

CREATE OR REPLACE FUNCTION tremplin_propagate_talk_titre() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public, pg_temp
  AS $$
BEGIN
  IF NEW.titre IS DISTINCT FROM OLD.titre THEN
    UPDATE tremplin_registrations SET sujet = NEW.titre WHERE talk_id = NEW.id;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_talk_titre_to_sujet ON speaker_talks;
CREATE TRIGGER trg_talk_titre_to_sujet
  AFTER UPDATE OF titre ON speaker_talks
  FOR EACH ROW EXECUTE FUNCTION tremplin_propagate_talk_titre();

-- ── 2a. Réconciliation des inscriptions DÉJÀ pitchées (posées par l'orga en #146) ──
-- Leur sujet libre concurrent est aligné sur le titre du talk (invariant J+0).
UPDATE tremplin_registrations r
   SET sujet = t.titre
  FROM speaker_talks t
 WHERE r.talk_id = t.id
   AND r.sujet IS DISTINCT FROM t.titre;

-- ── 2b. Backfill : sujet libre → talk « Sujet proposé » (compte requis) ──
-- Une inscription sans talk, avec un sujet non vide et un compte relié : on crée
-- un talk « proposition » sur son profil (source 'tremplin' = marqueur, exclu de
-- l'annuaire tant que la personne ne l'a pas confirmé) et on le désigne pitché.
DO $$
DECLARE
  r   RECORD;
  pid INTEGER;
  tid INTEGER;
BEGIN
  FOR r IN
    SELECT reg.id AS reg_id, reg."userId" AS user_id, reg.sujet AS sujet
      FROM tremplin_registrations reg
     WHERE reg.talk_id IS NULL
       AND reg."userId" IS NOT NULL
       AND reg.sujet IS NOT NULL
       AND btrim(reg.sujet) <> ''
  LOOP
    INSERT INTO speaker_profiles ("userId") VALUES (r.user_id)
      ON CONFLICT ("userId") DO NOTHING;
    SELECT id INTO pid FROM speaker_profiles WHERE "userId" = r.user_id;

    INSERT INTO speaker_talks (speaker_profile_id, titre, type, source)
      VALUES (pid, r.sujet, 'Sujet proposé', 'tremplin')
      RETURNING id INTO tid;

    -- Le trigger réécrit sujet = titre (déjà égal) ; on pose juste le lien.
    UPDATE tremplin_registrations SET talk_id = tid WHERE id = r.reg_id;
  END LOOP;
END $$;
