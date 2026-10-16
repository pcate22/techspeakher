-- 056 — « Cet atelier sera visible sur le site public » devient une PHRASE que
-- l'orga lit et coche, au lieu d'une conséquence qu'elle doit déduire.
--
-- HISTORIQUE, à lire avant de toucher à ce réglage. La migration 051 avait
-- FUSIONNÉ audience et publication, pour de bonnes raisons : il existait deux
-- interrupteurs indépendants et le plus permissif gagnait EN SILENCE. La règle
-- de publication dépendait alors du nombre de participantes désignées — donc
-- POINTER UNE PRÉSENCE publiait la séance, avec son lieu de rendez-vous, alors
-- que l'écran promettait « seules les inscrites que tu désignes la voient ».
--
-- Ce que la fusion corrigeait n'était pas « deux réglages » : c'était un réglage
-- IMPLICITE. Personne ne choisissait de publier, ça se déduisait d'un geste qui
-- parlait d'autre chose. Un interrupteur explicite, libellé en toutes lettres,
-- initialisé depuis l'audience, est le contraire de ce défaut — et le lieu ne
-- sort plus du DTO public depuis (cf. `PublicAtelier`), donc le pire de
-- l'incident n'est plus rejouable.
--
-- L'audience redevient la réponse à UNE seule question (qui la voit dans son
-- espace) ; celle-ci répond à l'autre (ce que le site public annonce).
--
-- REPRISE À L'IDENTIQUE : l'état actuel se lit sur l'audience, exactement comme
-- la règle sortante le faisait (`audience <> 'selection'`). Personne n'entre ni
-- ne sort de la vitrine du fait de cette migration. Le backfill vit DANS la
-- garde — jamais rejoué, donc un choix manuel ultérieur ne sera pas écrasé.
--
-- Idempotent.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'tremplin_ateliers' AND column_name = 'au_programme_public'
  ) THEN
    -- Défaut FERMÉ, comme l'audience : une séance neuve n'est publique que si
    -- on l'a dit (le code l'initialise depuis l'audience à la création).
    ALTER TABLE tremplin_ateliers
      ADD COLUMN au_programme_public BOOLEAN NOT NULL DEFAULT false;

    UPDATE tremplin_ateliers
       SET au_programme_public = (audience <> 'selection');
  END IF;
END $$;
