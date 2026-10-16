-- Migration 022 — Classement structuré + raison de transfert publique.
-- (cf. docs/conception-technique-recompenses.md)
--
-- CLASSEMENT : le rang de podium (1, 2, 3…) était un texte libre
-- (registrations.recompense = « 1ᵉʳ prix »). On le structure en entier pour
-- pouvoir le trier, le compter, et surtout APPARIER une gagnante au barème
-- (récompense de même rang) et DÉRIVER l'origine d'un transfert. Le libellé
-- « 1ᵉʳ prix » devient dérivé à l'affichage. Migration expand/contract :
-- ce lot AJOUTE `classement` et backfille depuis `recompense` ; la bascule des
-- lectures puis le retrait de `recompense` viennent dans les lots suivants.
--
-- TRANSFERT_RAISON : raison PUBLIQUE et ÉNUMÉRÉE (sans nom, pas de donnée
-- personnelle) d'un transfert de récompense. Le `motif` texte libre existant
-- reste INTERNE (jamais publié). Deux valeurs (décision orga) :
-- `cfp_officiel` (« Retenue via le CFP officiel de l'événement »), `autre`.

ALTER TABLE tremplin_registrations ADD COLUMN IF NOT EXISTS classement INTEGER;

-- Backfill best-effort des lignes historiques (« 1ᵉʳ/1er prix » → 1, etc.).
-- Ne touche pas aux lignes déjà renseignées ; laisse NULL si non reconnu.
UPDATE tremplin_registrations
   SET classement = CASE
     WHEN recompense ~ '^\s*1'  THEN 1
     WHEN recompense ~ '^\s*2'  THEN 2
     WHEN recompense ~ '^\s*3'  THEN 3
     ELSE NULL
   END
 WHERE classement IS NULL AND recompense IS NOT NULL;

ALTER TABLE tremplin_recompenses ADD COLUMN IF NOT EXISTS transfert_raison TEXT
  CHECK (transfert_raison IS NULL OR transfert_raison IN ('cfp_officiel', 'autre'));
