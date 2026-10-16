-- 054 — La FICHE COACH : créditer une accompagnante sans l'enrôler dans
-- l'annuaire des speakeuses.
--
-- Les pages publiques d'une édition créditent désormais celles qui ont
-- accompagné. Le premier jet gatait leur nom sur `speaker_profiles.status =
-- 'publie'` — c'est-à-dire qu'il fallait ENTRER DANS L'ANNUAIRE DES SPEAKEUSES
-- pour être citée comme coach. Deux finalités derrière un seul état, et une
-- accompagnante qui ne prend pas la parole publiée dans un annuaire qui n'est
-- pas le sien.
--
-- La fiche coach est donc une fiche À PART, minimale, rattachée au COMPTE (donc
-- à l'e-mail : c'est déjà par là que l'orga invite une coach, cf.
-- getOrCreateUserByEmail). L'orga la tient pour celles qui ne se connectent
-- jamais ; celles qui se connectent la reprennent.
--
-- CONSENTEMENT au niveau du compte, pas de l'édition : « je veux bien être
-- citée comme accompagnante » est une position sur soi, pas sur une année, et
-- une seule révocation doit valoir partout. Une coach qui a accompagné trois
-- éditions n'a pas trois cases à décocher.
--
-- Horodaté (`public_consent_at`) pour être démontrable, comme le consentement
-- des participantes. Révocation : `public = false` suffit, et la suppression du
-- compte emporte la fiche par CASCADE.
--
-- Fondation possible d'un futur annuaire des coachs bénévoles (piste orga) —
-- qui reste un AUTRE lot, avec sa propre conception.
--
-- Idempotent : CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS coach_profiles (
  "userId"          INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  -- Rôle affiché (« Conceptrice-rédactrice », « Coach produit »). Saisi par
  -- l'orga ou par la coach ; jamais déduit de la fiche speakeuse.
  role              TEXT,
  -- Un lien vers elle (LinkedIn, site), facultatif.
  lien              TEXT,
  -- Le consentement à être citée publiquement comme accompagnante. Défaut
  -- FERMÉ : une fiche créée par l'orga ne publie personne tant que l'accord
  -- n'est pas recueilli.
  public            BOOLEAN NOT NULL DEFAULT false,
  public_consent_at TIMESTAMPTZ
);

-- Rejouable sur une base où la table existe déjà sans ces colonnes.
ALTER TABLE coach_profiles ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE coach_profiles ADD COLUMN IF NOT EXISTS lien TEXT;
ALTER TABLE coach_profiles ADD COLUMN IF NOT EXISTS public BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE coach_profiles ADD COLUMN IF NOT EXISTS public_consent_at TIMESTAMPTZ;
