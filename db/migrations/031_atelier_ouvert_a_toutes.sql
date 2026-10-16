-- 031 — atelier « ouvert à toutes » en propriété explicite (opt-in).

-- Migration 031 — « ouvert à toutes » : propriété EXPLICITE de l'atelier
-- (opt-in), plus d'implicite « aucun membre = ouvert ». Les ateliers existants
-- sans membre étaient ouverts DE FAIT : on préserve leur comportement une
-- seule fois (backfill dans le même garde : jamais rejoué, une refermeture
-- manuelle ultérieure ne sera pas écrasée). Idempotent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'tremplin_ateliers' AND column_name = 'ouvert_a_toutes'
  ) THEN
    ALTER TABLE tremplin_ateliers
      ADD COLUMN ouvert_a_toutes BOOLEAN NOT NULL DEFAULT false;
    UPDATE tremplin_ateliers a
       SET ouvert_a_toutes = true
     WHERE NOT EXISTS (
       SELECT 1 FROM tremplin_atelier_membres m WHERE m.atelier_id = a.id
     );
  END IF;
END $$;
