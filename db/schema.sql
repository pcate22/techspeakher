-- Schéma de base de données — Tech Speak'Her (plateforme), Phase 1a
-- À exécuter une fois dans l'éditeur SQL de Neon (région UE).
--
-- Tables Auth.js (adapter @auth/pg-adapter) : users, accounts, sessions,
-- verification_token — noms/colonnes EXACTS attendus par l'adapter (camelCase
-- entre guillemets). Ne pas renommer.
-- Tables métier Tech Speak'Her : speaker_profiles, speaker_talks, user_memberships.

-- ─── Auth.js ───

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(255),
  email         VARCHAR(255),
  "emailVerified" TIMESTAMPTZ,
  image         TEXT,
  is_orga       BOOLEAN NOT NULL DEFAULT false,
  -- Profil « animateur / coach » (cumulable avec orga ; speakeuse = profil dédié).
  is_coach      BOOLEAN NOT NULL DEFAULT false,
  -- Obligatoire pour les coachs, déclaratif (statistiques de mixité de l'accompagnement).
  genre         TEXT CHECK (genre IN ('femme', 'homme', 'non_binaire') OR genre IS NULL),
  -- Désabonnement de la LETTRE D'INFORMATION (migration 057). NULL = abonnée.
  -- Les e-mails de SERVICE (connexion, modération, messages) l'ignorent : on ne
  -- coupe jamais le service parce qu'on refuse le marketing.
  newsletter_optout_at TIMESTAMPTZ,
  -- Conservation des comptes (migration 067, RGPD art. 5-1-e). Les sessions
  -- sont en JWT : la table `sessions` n'est jamais alimentée, donc rien d'autre
  -- ne dit quand la personne est passée. Écriture au plus hebdomadaire, depuis
  -- le callback jwt. Cf. docs/conception-conservation-comptes.md.
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  -- Avertissement de suppression envoyé. NULL = jamais averti, OU réveillé
  -- depuis : un signe de vie l'efface, sinon une inactivité future supprimerait
  -- sans que la personne ait eu sa chance.
  suppression_annoncee_le TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS accounts (
  id                  SERIAL PRIMARY KEY,
  "userId"            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type                VARCHAR(255) NOT NULL,
  provider            VARCHAR(255) NOT NULL,
  "providerAccountId" VARCHAR(255) NOT NULL,
  refresh_token       TEXT,
  access_token        TEXT,
  expires_at          BIGINT,
  id_token            TEXT,
  scope               TEXT,
  session_state       TEXT,
  token_type          TEXT,
  -- L'adresse donnée par le fournisseur à la connexion (migration 074).
  -- Auth.js ne la garde pas ; elle sert au rapprochement des adhésions
  -- HelloAsso. Vérifiée par Google / LinkedIn. Cf.
  -- docs/conception-adhesions-helloasso.md.
  email               TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id             SERIAL PRIMARY KEY,
  "userId"       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires        TIMESTAMPTZ NOT NULL,
  "sessionToken" VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS verification_token (
  identifier TEXT NOT NULL,
  expires    TIMESTAMPTZ NOT NULL,
  token      TEXT NOT NULL,
  PRIMARY KEY (identifier, token)
);

-- ─── Métier Tech Speak'Her ───

-- Fiche COACH (migration 054) : créditer une accompagnante sans l'enrôler dans
-- l'annuaire des speakeuses — deux finalités, deux fiches. Rattachée au compte
-- (donc à l'e-mail d'invitation) ; l'orga la tient pour celles qui ne se
-- connectent jamais. `public` est LE consentement à être citée, horodaté et
-- révocable seul ; défaut fermé.
CREATE TABLE IF NOT EXISTS coach_profiles (
  "userId"          INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  role              TEXT,   -- « Conceptrice-rédactrice », « Coach produit »…
  lien              TEXT,   -- LinkedIn ou site, facultatif
  public            BOOLEAN NOT NULL DEFAULT false,
  public_consent_at TIMESTAMPTZ
);

-- Profil speakeuse (1 par compte).
-- status : 'brouillon' | 'en_attente' | 'publie' | 'refuse' | 'masque'
CREATE TABLE IF NOT EXISTS speaker_profiles (
  id           SERIAL PRIMARY KEY,
  "userId"     INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  -- Identifiant d'URL lisible « nom-prenom » (façon LinkedIn), UNIQUE. NULL tant
  -- qu'aucun nom n'existe (brouillon lien-magique) ; l'app redirige l'id → slug.
  slug         TEXT,
  titre_profil TEXT,
  poste        TEXT,
  entreprise   TEXT,
  bio          TEXT,
  website      TEXT,
  linkedin     TEXT,
  instagram    TEXT,
  sessionize_url      TEXT,
  conference_hall_url TEXT,
  ville        TEXT,
  -- Localisation de résidence structurée (Base Adresse Nationale, migration 039).
  -- region_residence ≠ regions (celui-ci = zones d'intervention/déplacement).
  code_postal      TEXT,
  code_insee       TEXT,
  region_residence TEXT,
  regions      TEXT[] NOT NULL DEFAULT '{}',
  langues      TEXT[] NOT NULL DEFAULT '{}',
  secteurs     TEXT[] NOT NULL DEFAULT '{}',
  sujets       TEXT[] NOT NULL DEFAULT '{}',
  contact_email_ok BOOLEAN NOT NULL DEFAULT false,
  is_woman     BOOLEAN NOT NULL DEFAULT false,
  migrated     BOOLEAN NOT NULL DEFAULT false,
  status       TEXT NOT NULL DEFAULT 'brouillon',
  published_at TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  validated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  validated_at TIMESTAMPTZ,
  refus_motif  TEXT,
  last_reminder_at TIMESTAMPTZ,
  invited_at   TIMESTAMPTZ,
  -- Consentement au moissonneur CFP : 'aucun' | 'suggestions' | 'auto'
  cfp_sync_mode TEXT NOT NULL DEFAULT 'suggestions',
  -- Jalon du digest : décision de modération déjà annoncée à la speakeuse.
  moderation_notified_at TIMESTAMPTZ,
  -- Fréquence acceptée des RAPPELS sur la fiche (migration 066) : rappel de mise
  -- à jour des fiches publiées, et relance des brouillons en sommeil. NULL = pas
  -- de choix, donc le délai réglé par l'équipe s'applique. Ne touche jamais aux
  -- e-mails de compte (connexion, modération, message reçu), qui annoncent un
  -- fait au lieu de pousser. Cf. docs/conception-cadence-rappels.md.
  rappel_cadence TEXT CHECK (rappel_cadence IS NULL
    OR rappel_cadence IN ('mensuel', 'bimestriel', 'semestriel', 'aucun')),
  -- Date annoncée par le préavis « ta fiche quitte l'annuaire faute
  -- d'adhésion » (migration 074). NULL = aucun préavis en cours. Jamais de
  -- pause sans elle. Cf. docs/conception-adhesions-helloasso.md.
  annuaire_retrait_le TIMESTAMPTZ,
  -- Invitation à adhérer envoyée (migration 075) : une seule fois par fiche.
  adhesion_invitee_le TIMESTAMPTZ,
  -- Liste fermée (migration 073, élargie par la 074 : `en_pause` = hors
  -- annuaire faute d'adhésion), miroir de PROFILE_STATUSES
  -- (src/lib/profile-status.ts) : un statut hors liste passait le
  -- `NOT IN ('masque', 'refuse')` de tremplin-public.ts et EXPOSAIT la fiche.
  CONSTRAINT speaker_profiles_status_ck
    CHECK (status IN ('brouillon', 'en_attente', 'publie', 'refuse', 'masque', 'en_pause'))
);

-- ─── Référence des conférences (migration 027, cf. docs/conception-registre-conferences.md) ───
-- L'organisateur récurrent : une MARQUE de conférence OU une ASSO/communauté.
CREATE TABLE IF NOT EXISTS conferences (
  id       SERIAL PRIMARY KEY,
  slug     TEXT NOT NULL UNIQUE,
  nom      TEXT NOT NULL,
  type     TEXT NOT NULL DEFAULT 'conference',  -- 'conference' | 'asso'
  ville    TEXT,
  pays     TEXT,
  site_url TEXT
);

-- L'événement daté : une ÉDITION de conf OU un MEETUP d'asso. Porte la date,
-- le lieu, et (pour les confs) les champs de moisson (ex-cfp_events).
CREATE TABLE IF NOT EXISTS conference_editions (
  id             SERIAL PRIMARY KEY,
  -- RESTRICT : supprimer un organisateur qui a des événements = geste conscient.
  conference_id  INTEGER NOT NULL REFERENCES conferences(id) ON DELETE RESTRICT,
  type           TEXT NOT NULL DEFAULT 'edition', -- 'edition' | 'meetup'
  -- NULL pour une édition (libellé = conf.nom + annee) ; titre pour un meetup.
  nom            TEXT,
  annee          INTEGER,
  date_debut     DATE,
  -- Dernier jour (NULL = un seul jour) : borne ce que l'édition lègue à la
  -- date d'un talk (dateLegueeParEdition) — multi-jours lègue le mois.
  date_fin       DATE,
  ville          TEXT,
  pays           TEXT,
  lieu           TEXT,
  url            TEXT,
  -- Moisson (nullable : un événement connu n'est pas forcément moissonné) :
  source         TEXT,
  endpoint       TEXT,
  actif          BOOLEAN NOT NULL DEFAULT FALSE,
  -- Provenance communauté : membre ayant ajouté l'événement (info admin).
  propose_par    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  -- Sync meetups Toulouse Tech Hub : id Meetup = clé d'idempotence.
  meetup_id      TEXT UNIQUE,
  CONSTRAINT conf_editions_source_endpoint_coherents
    CHECK ((source IS NULL) = (endpoint IS NULL)),
  -- Fenêtre cohérente : jamais de fin avant le début ni de fin sans début.
  CONSTRAINT conference_editions_fenetre_ck
    CHECK (date_fin IS NULL OR (date_debut IS NOT NULL AND date_fin >= date_debut))
);

-- Propositions de conférences par les membres (migration 041) : une speakeuse
-- signale une conférence manquante, ça N'entre PAS dans le répertoire tant qu'une
-- orga n'a pas validé (promotion → conferences + conference_editions). Rien ici
-- n'est lu par les sélecteurs ni le moissonneur : zéro risque de fuite.
CREATE TABLE IF NOT EXISTS conference_propositions (
  id           SERIAL PRIMARY KEY,
  nom          TEXT NOT NULL,
  annee        INTEGER,
  ville        TEXT,
  url          TEXT,
  endpoint     TEXT,
  -- Autrice de la proposition (info orga) ; SET NULL si le compte est supprimé.
  propose_par  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  -- Arbitrage (migration 068) : une proposition n'est plus supprimée, elle change
  -- de statut — des occurrences la référencent (talk_occurrences.proposition_id).
  statut       TEXT NOT NULL DEFAULT 'en_attente',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT conference_propositions_statut_ck
    CHECK (statut IN ('en_attente', 'validee', 'refusee'))
);

CREATE TABLE IF NOT EXISTS speaker_talks (
  id                SERIAL PRIMARY KEY,
  speaker_profile_id INTEGER NOT NULL REFERENCES speaker_profiles(id) ON DELETE CASCADE,
  titre         TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'Conférence',
  conference    TEXT,
  ville         TEXT,
  pays          TEXT,
  date          TEXT,
  description   TEXT,
  lien_conf     TEXT,
  lien_slides   TEXT,
  lien_video    TEXT,
  lien_feedback TEXT,
  -- Provenance d'un import (moissonneur CFP) : 'manuel' | 'sessionize' | 'conference-hall'
  source        TEXT NOT NULL DEFAULT 'manuel',
  external_id   TEXT,
  -- Événement de la référence pointé par ce talk (NULL = saisie libre).
  -- LEGACY : depuis la migration 044, les données « par événement » vivent dans
  -- talk_occurrences ; ces colonnes (conference, ville, pays, date, lien_*,
  -- edition_id, external_id) sont conservées le temps de la bascule (expand),
  -- une migration CONTRACT ultérieure les retirera. Le code n'en lit plus rien.
  edition_id    INTEGER REFERENCES conference_editions(id) ON DELETE SET NULL
);

-- ─── Occurrences d'un talk (migration 044, cf. docs/conception-talk-multi-conferences.md) ───
-- speaker_talks = IDENTITÉ (titre, type, description, source) ; une occurrence =
-- une fois où ce talk a été donné (une conférence datée, avec ses liens propres),
-- rattachée au registre (conferences + conference_editions) par conference_id ET
-- edition_id. Un talk à ZÉRO occurrence = un sujet proposé (pas encore donné).
CREATE TABLE IF NOT EXISTS talk_occurrences (
  id                 SERIAL PRIMARY KEY,
  talk_id            INTEGER NOT NULL REFERENCES speaker_talks(id) ON DELETE CASCADE,
  -- Dénormalisé depuis le talk parent (invariant garanti côté code) : requis par
  -- l'index d'idempotence du moissonneur (un index unique partiel ne traverse
  -- pas deux tables).
  speaker_profile_id INTEGER NOT NULL REFERENCES speaker_profiles(id) ON DELETE CASCADE,
  -- Lien de premier ordre au registre : la conférence (marque) et son édition.
  conference_id INTEGER REFERENCES conferences(id) ON DELETE SET NULL,
  edition_id    INTEGER REFERENCES conference_editions(id) ON DELETE SET NULL,
  -- Libellé figé (SNAPSHOT du nom au save) : affichage + rescapé du SET NULL ;
  -- porte aussi la mention texte des talks libres HISTORIQUES (legacy).
  conference    TEXT,
  ville         TEXT,
  -- Migration 072 — la géographie d'une occurrence, exploitable.
  -- La ville seule était du texte libre : filtrer sur « Toulouse » marchait,
  -- sur « Occitanie » non (audit de l'agenda §4.2). La saisie passe désormais
  -- par la Base Adresse Nationale, comme la commune d'une fiche.
  -- NULLABLES ET SANS CONTRAINTE, à dessein : la BAN est un service tiers, et
  -- une speakeuse doit pouvoir enregistrer sa date même quand il ne répond pas
  -- (le rattrapage remplira plus tard). Hors de France, la BAN ne connaît rien :
  -- la ville reste du texte, ces deux colonnes restent vides, et la règle
  -- d'affichage (lib/lieu-occurrence.ts) range l'intervention en
  -- « International ».
  code_insee    TEXT,
  region        TEXT,
  pays          TEXT,
  date          TEXT,
  lien_conf     TEXT,
  lien_slides   TEXT,
  lien_video    TEXT,
  lien_feedback TEXT,
  -- Provenance moisson de l'occurrence : 'manuel' | 'sessionize' | 'conference-hall'
  source        TEXT NOT NULL DEFAULT 'manuel',
  external_id   TEXT,
  -- Migration 068 — la conférence de cette occurrence attend l'arbitrage orga.
  -- INVARIANT tenu par les lectures publiques : proposition_id IS NOT NULL ⇔
  -- occurrence en attente (ou écartée) ⇒ jamais affichée publiquement. À la
  -- validation, l'orga pose conference_id/edition_id et remet ceci à NULL.
  -- RESTRICT : supprimer une proposition derrière laquelle une saisie attend est
  -- un geste conscient (un SET NULL la rendrait publique sans validation).
  proposition_id INTEGER REFERENCES conference_propositions(id) ON DELETE RESTRICT,
  -- Une saisie en attente ne pointe PAS aussi le répertoire : la contradiction
  -- est ce qui la rendrait visible des lectures publiques qui filtrent par
  -- edition_id / conference_id (cf. conference-speakers.ts) au lieu de
  -- proposition_id. Rendue impossible ici, pas seulement testée.
  CONSTRAINT talk_occurrences_attente_hors_registre_ck
    CHECK (proposition_id IS NULL OR (conference_id IS NULL AND edition_id IS NULL))
);

-- ─── Moissonneur CFP (voir docs/faisabilite-import-talks.md, scénario F) ───

-- Registre d'événements moissonnés. endpoint : id d'endpoint public Sessionize
-- (ou slug Conference Hall).
CREATE TABLE IF NOT EXISTS cfp_events (
  id          SERIAL PRIMARY KEY,
  nom         TEXT NOT NULL,
  source      TEXT NOT NULL,
  endpoint    TEXT NOT NULL,
  url         TEXT,
  ville       TEXT,
  pays        TEXT,
  date_debut  DATE,
  actif       BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (source, endpoint)
);

-- Suggestions du moissonneur, confirmées en un clic par la speakeuse.
-- statut : 'proposee' | 'acceptee' | 'refusee' (une refusée n'est jamais re-suggérée)
CREATE TABLE IF NOT EXISTS talk_suggestions (
  id          SERIAL PRIMARY KEY,
  profile_id  INTEGER NOT NULL REFERENCES speaker_profiles(id) ON DELETE CASCADE,
  -- Depuis la migration 027, l'événement est une conference_edition (RESTRICT :
  -- la mémoire des refus ne doit jamais disparaître avec l'événement).
  event_id    INTEGER NOT NULL REFERENCES conference_editions(id) ON DELETE RESTRICT,
  external_id TEXT NOT NULL,
  titre       TEXT NOT NULL,
  description TEXT,
  date        TEXT,
  conference  TEXT,
  ville       TEXT,
  pays        TEXT,
  lien_conf   TEXT,
  statut      TEXT NOT NULL DEFAULT 'proposee',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profile_id, event_id, external_id)
);

-- Adhésion. source : 'manuel' (éditeur Neon) | 'helloasso' (synchro, migration
-- 074, cf. docs/conception-adhesions-helloasso.md) ; status : 'active' | 'expired'.
-- Seules les adhésions HelloAsso qui correspondent à un COMPTE y entrent : une
-- adhésion sans compte ne laisse aucune ligne (minimisation RGPD).
-- La saisie à la main reste possible : la liste fermée du statut (migration
-- 073, miroir de MEMBERSHIP_STATUSES, src/lib/membership-status.ts) la borde —
-- un statut hors liste passait le `<> 'active'` de comptes-inactifs.ts et
-- rangeait le compte dans la cohorte de SUPPRESSION.
CREATE TABLE IF NOT EXISTS user_memberships (
  id         SERIAL PRIMARY KEY,
  "userId"   INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  source     TEXT NOT NULL DEFAULT 'manuel',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  status     TEXT NOT NULL DEFAULT 'active',
  -- L'article HelloAsso qui a posé l'échéance : une trace, SANS unicité (un
  -- article peut changer de compte, cf. migration 074). Rien d'autre n'est
  -- copié de HelloAsso : ni montant, ni nom, ni réponses.
  helloasso_item_id  BIGINT,
  -- Relance avant échéance envoyée ; remise à NULL quand l'échéance change.
  relance_envoyee_le TIMESTAMPTZ,
  CONSTRAINT user_memberships_status_ck
    CHECK (status IN ('active', 'expired'))
);

-- ─── Tremplin (Phase A — socle, cf. db/migrations/010_tremplin.sql) ───
-- statut édition (migration 072) : 'preparation' | 'ouvert' | 'en_cours' |
-- 'clos' | 'archive'. `preparation` = en cours de montage par l'orga, INVISIBLE
-- du public : c'est le défaut, parce qu'une édition créée à la main dans
-- l'éditeur Neon ne doit pas naître annoncée. Liste fermée par le CHECK, miroir
-- de EDITION_STATUTS (src/lib/tremplin-statut.ts).
CREATE TABLE IF NOT EXISTS tremplin_editions (
  id           SERIAL PRIMARY KEY,
  nom          TEXT NOT NULL,
  annee        INTEGER NOT NULL,
  conf_slug    TEXT,                              -- identifiant d'URL conf (ex. devfest-toulouse) ; (conf_slug, annee) = identité publique
  statut       TEXT NOT NULL DEFAULT 'preparation',
  description  TEXT,
  conf_nom     TEXT,
  conf_lieu    TEXT,                              -- lieu de la conf : ville OU pays (optionnel) ; l'année est l'édition, jamais le nom
  conf_date    DATE,
  conf_lien    TEXT,
  finale_date  DATE,
  finale_lieu  TEXT,
  inscriptions_debut DATE,                        -- fenêtre d'inscriptions : l'état
  inscriptions_fin   DATE,                        -- « ouvertes » est dérivé de la date du jour
  -- Conférence partenaire pointée dans la référence (migration 027). Nommé
  -- conference_edition_id (edition_id désigne déjà l'édition de Tremplin).
  conference_edition_id INTEGER REFERENCES conference_editions(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at   TIMESTAMPTZ,                        -- tombstone : édition publiée supprimée (données effacées, coquille gardée pour l'URL)
  CONSTRAINT tremplin_editions_statut_ck
    CHECK (statut IN ('preparation', 'ouvert', 'en_cours', 'clos', 'archive'))
);

-- "userId" nullable : enregistrement saisi par l'orga (rattaché à un compte
-- plus tard). statut : 'en_attente' | 'acceptee' | 'refusee'
CREATE TABLE IF NOT EXISTS tremplin_registrations (
  id              SERIAL PRIMARY KEY,
  edition_id      INTEGER NOT NULL REFERENCES tremplin_editions(id) ON DELETE CASCADE,
  "userId"        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  participante_nom      TEXT,
  participante_role     TEXT,
  participante_linkedin TEXT,
  statut          TEXT NOT NULL DEFAULT 'en_attente',
  finale_presente BOOLEAN,
  public            BOOLEAN NOT NULL DEFAULT false,  -- consentement à apparaître nommée publiquement (opt-in)
  public_consent_at TIMESTAMPTZ,                     -- horodatage du consentement (démontrable)
  classement        INTEGER,                           -- rang de podium 1/2/3… (NULL = non classée) ; libellé dérivé à l'affichage
  titre_palmares    TEXT,                            -- titre primé FIGÉ au classement (archive palmarès, survit au talk) ; migration 034
  bio               TEXT,                            -- bio publique (galerie)
  site_web          TEXT,                            -- site perso (galerie)
  photo_url         TEXT,                            -- portrait (suit le consentement public)
  -- Talk mis en avant (proposition / sujet) rattaché à l'inscription : vit dans
  -- speaker_talks et préremplit le profil. NULL = aucun talk rattaché. Migration 032.
  talk_id           INTEGER REFERENCES speaker_talks(id) ON DELETE SET NULL,
  -- Phase d'entrée dans le parcours (1 CFP et pitch, 2 finale, 3 montée sur
  -- scène) — cf. docs/parcours-participante.md.
  phase_entree    TEXT NOT NULL DEFAULT 'cfp_et_pitch'
                  CHECK (phase_entree IN ('cfp_et_pitch', 'finale', 'montee_sur_scene')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT registration_identite CHECK (
    "userId" IS NOT NULL OR participante_nom IS NOT NULL
  ),
  UNIQUE (edition_id, "userId")
);

-- Le titre pitché est lu DIRECTEMENT depuis le talk (`talk_id → speaker_talks.
-- titre`) partout où il s'affiche (galerie, coach, admin) ; le palmarès lit
-- l'archive figée `titre_palmares`. Plus de colonne `sujet` ni de trigger de
-- miroir (migration 035). Cf. docs/conception-talk-pitche-migration.md.

-- Nombre d'ateliers libre par édition. TIME interprété Europe/Paris.
CREATE TABLE IF NOT EXISTS tremplin_ateliers (
  id           SERIAL PRIMARY KEY,
  edition_id   INTEGER NOT NULL REFERENCES tremplin_editions(id) ON DELETE CASCADE,
  ordre        INTEGER NOT NULL DEFAULT 0,
  titre        TEXT NOT NULL,
  date         DATE,                              -- date unique OU début de fenêtre (cf. date_fin)
  date_fin     DATE,                              -- fin de fenêtre (NULL = date unique) ; cf. CHECK
  heure_debut  TIME,
  heure_fin    TIME,
  description  TEXT,
  lieu         TEXT,                              -- lieu physique (présentiel) ; avec lien_visio → hybride
  lien_visio   TEXT,
  coachs       TEXT,                              -- noms des coachs/animatrices (texte libre)
  -- Phase de l'atelier : avant la soirée (préparation CFP) ou après (préparation
  -- conférence). La soirée (finale) elle-même n'a pas d'atelier.
  phase        TEXT NOT NULL DEFAULT 'cfp_et_pitch'
               CHECK (phase IN ('cfp_et_pitch', 'montee_sur_scene')),
  -- Nature : rendez-vous collectif (on pointe la présence) OU activité en
  -- sous-groupes autonomes (on suit la réalisation par sous-groupe). Pilote le suivi.
  nature       TEXT NOT NULL DEFAULT 'collectif'
               CHECK (nature IN ('collectif', 'sous_groupes')),
  -- QUI voit l'atelier — un choix EXCLUSIF (migration 051, cf.
  -- src/lib/atelier-audience.ts). Un atelier neuf est visible de personne tant
  -- qu'on ne l'a pas dit : le défaut est la sélection, vide.
  --   selection = les inscrites nommément désignées ;
  --   phase     = les inscrites rattachées à la phase DE CET ATELIER ;
  --   toutes    = toute inscrite à l'édition.
  audience     TEXT NOT NULL DEFAULT 'selection'
               CHECK (audience IN ('selection', 'phase', 'toutes')),
  -- CE QUE LE SITE PUBLIC ANNONCE (migration 056) : nom, dates et description.
  -- Jamais le lieu. Réglage EXPLICITE, initialisé depuis l'audience à la
  -- création (cohorte → visible), puis modifiable seul. Défaut fermé : une
  -- séance neuve n'est publique que si on l'a dit.
  au_programme_public BOOLEAN NOT NULL DEFAULT false,
  -- MIROIR de `audience = 'toutes'`, conservé le temps de la bascule
  -- (expand/contract : l'ancien code la lit encore). Ne pas s'en servir comme
  -- source : `audience` décide seule. Suppression tracée en dette technique.
  ouvert_a_toutes BOOLEAN NOT NULL DEFAULT false,
  -- Fenêtre cohérente : la fin ne précède pas le début (dates ISO AAAA-MM-JJ).
  CONSTRAINT tremplin_ateliers_fenetre_coherente
    CHECK (date_fin IS NULL OR date IS NULL OR date_fin >= date)
);

-- Sous-groupes d'un atelier « en sous-groupes » (revue croisée en duo, trio, ou
-- une participante + sa coach). Porte le suivi de réalisation (fait_le), le coach
-- éventuel et le lien « comment se retrouver ». Cf. docs/conception-sous-groupes-ateliers.md.
CREATE TABLE IF NOT EXISTS tremplin_atelier_sous_groupes (
  id            SERIAL PRIMARY KEY,
  atelier_id    INTEGER NOT NULL REFERENCES tremplin_ateliers(id) ON DELETE CASCADE,
  -- Le sous-groupe se DÉSIGNE par qui est dedans (libellé dérivé, cf.
  -- src/lib/sous-groupe-libelle.ts) : plus de nom à saisir. La colonne reste,
  -- facultative, pour les anciens libellés — suppression tracée en dette.
  libelle       TEXT,
  -- MIROIR de la PREMIÈRE coach, conservé le temps de la bascule
  -- (expand/contract). Les coachs vivent dans `tremplin_sous_groupe_coachs` :
  -- il peut y en avoir plusieurs. Ne pas s'en servir comme source.
  coach_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  lien_visio    TEXT,                                             -- « comment se retrouver »
  fait_le       DATE,                                             -- réalisation ; NULL = pas encore fait
  -- Cible de la FK composite de `tremplin_sous_groupe_coachs` (migration 052) :
  -- `id` est déjà unique (PK), cette contrainte rend le COUPLE référençable.
  CONSTRAINT tremplin_sous_groupes_id_atelier_uniq UNIQUE (id, atelier_id)
);
CREATE INDEX IF NOT EXISTS idx_sous_groupes_atelier ON tremplin_atelier_sous_groupes (atelier_id);

-- Membres d'un atelier : l'inventaire nominatif (les présences se pointent
-- dessus). Sans membre ni « ouvert à toutes », l'atelier n'est visible que de
-- l'orga (et de ses coachs).
CREATE TABLE IF NOT EXISTS tremplin_atelier_membres (
  atelier_id      INTEGER NOT NULL REFERENCES tremplin_ateliers(id) ON DELETE CASCADE,
  registration_id INTEGER NOT NULL REFERENCES tremplin_registrations(id) ON DELETE CASCADE,
  -- Présence pointée par l'orga, TRI-ÉTAT (« non renseignée » par défaut).
  presence        TEXT NOT NULL DEFAULT 'non_renseignee'
                  CHECK (presence IN ('non_renseignee', 'presente', 'absente')),
  -- Sous-groupe de la participante DANS cet atelier (NULL = pas encore rangée).
  -- Supprimer un sous-groupe délie ses membres (ils restent inscrits à l'atelier).
  sous_groupe_id  INTEGER REFERENCES tremplin_atelier_sous_groupes(id) ON DELETE SET NULL,
  PRIMARY KEY (atelier_id, registration_id)
);

-- Portée : atelier_id (doc d'atelier partagé) | registration_id (individuel
-- privé) | les deux NULL (ressource générale). Au moins un support (lien|contenu).
-- type : 'support_atelier' | 'feedback_jury' | 'video_pitch' | 'note' | 'autre'
-- Coachs d'un atelier : des comptes de la plateforme (pas forcément des
-- speakeuses publiées), invitables par e-mail comme les participantes.
CREATE TABLE IF NOT EXISTS tremplin_atelier_coachs (
  atelier_id INTEGER NOT NULL REFERENCES tremplin_ateliers(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (atelier_id, user_id)
);

-- Coachs d'un SOUS-GROUPE : une, plusieurs, ou aucune (« autonome », état normal
-- d'une revue croisée entre speakeuses). Migration 052.
--
-- INVARIANT TENU EN BASE : coachs du sous-groupe ⊆ coachs de son ATELIER. D'où
-- `atelier_id` (dénormalisée, mais la première FK composite garantit qu'elle est
-- bien l'atelier du sous-groupe) et la seconde FK vers `tremplin_atelier_coachs`.
-- Un compte qui n'est pas coach de l'atelier est refusé par la base ; retirer
-- une coach de l'atelier la retire de ses sous-groupes par CASCADE, sans code
-- applicatif à tenir en phase.
CREATE TABLE IF NOT EXISTS tremplin_sous_groupe_coachs (
  sous_groupe_id INTEGER NOT NULL,
  atelier_id     INTEGER NOT NULL,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (sous_groupe_id, user_id),
  FOREIGN KEY (sous_groupe_id, atelier_id)
    REFERENCES tremplin_atelier_sous_groupes (id, atelier_id) ON DELETE CASCADE,
  FOREIGN KEY (atelier_id, user_id)
    REFERENCES tremplin_atelier_coachs (atelier_id, user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sg_coachs_user ON tremplin_sous_groupe_coachs (user_id);

CREATE TABLE IF NOT EXISTS tremplin_documents (
  id              SERIAL PRIMARY KEY,
  edition_id      INTEGER NOT NULL REFERENCES tremplin_editions(id) ON DELETE CASCADE,
  atelier_id      INTEGER REFERENCES tremplin_ateliers(id) ON DELETE CASCADE,
  registration_id INTEGER REFERENCES tremplin_registrations(id) ON DELETE CASCADE,
  auteur_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  type            TEXT NOT NULL DEFAULT 'autre',
  titre           TEXT NOT NULL,
  lien            TEXT,
  contenu         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT document_a_un_support CHECK (lien IS NOT NULL OR contenu IS NOT NULL)
);

-- Photos de groupe (podium, soirée) + inventaire « qui est sur quelle photo »
-- (droit à l'image : retrait ciblé possible). Règle de publication appliquée
-- côté lib : une photo n'est publique que si toutes ses personnes consentent.
CREATE TABLE IF NOT EXISTS tremplin_photos (
  id          SERIAL PRIMARY KEY,
  edition_id  INTEGER NOT NULL REFERENCES tremplin_editions(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  legende     TEXT,
  kind        TEXT NOT NULL DEFAULT 'autre',     -- 'podium' | 'soiree' | 'autre'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Tag « personne » (cf. docs/photos-tremplin.md) : une participante de
-- l'édition, n'importe quel compte (jurée, coach…) ou un nom libre —
-- avec « consentement recueilli » PAR TAG pour les personnes hors inscription
-- (les inscrites gardent leur consentement self-service `public`).
-- FK en ON DELETE SET NULL (droit à l'image) : supprimer le compte ou retirer
-- l'inscription d'une personne taguée NE fait PAS disparaître son tag en
-- cascade (ce qui republierait la photo). Le tag SUBSISTE, orphelin et
-- anonyme, et reste bloquant tant que « consentement recueilli » n'est pas
-- coché. Le CHECK d'identité serait alors violé (plus aucune identité) : il
-- est donc absent — la garde « un tag a une identité à la CRÉATION » est
-- applicative (addPhotoTag), le seul cas d'orphelin est ce SET NULL.
CREATE TABLE IF NOT EXISTS tremplin_photo_personnes (
  id              SERIAL PRIMARY KEY,
  photo_id        INTEGER NOT NULL REFERENCES tremplin_photos(id) ON DELETE CASCADE,
  registration_id INTEGER REFERENCES tremplin_registrations(id) ON DELETE SET NULL,
  user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  nom_libre       TEXT,
  consentement    BOOLEAN NOT NULL DEFAULT false,
  consentement_le TIMESTAMPTZ  -- horodatage de l'attestation orga (droit à l'image, preuve)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_photo_personnes_reg_unique
  ON tremplin_photo_personnes (photo_id, registration_id) WHERE registration_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_photo_personnes_user_unique
  ON tremplin_photo_personnes (photo_id, user_id) WHERE user_id IS NOT NULL;

-- Récompenses de l'édition (présentation au DevFest, talk en meetup, coaching
-- CFP…) : distinctes du PODIUM (mérite, sur l'inscription). Attribuables
-- librement à une participante (motif tracé quand c'est transmis), et suivies
-- dans le temps (statut + date de l'événement organisé). Pas d'unicité sur
-- (edition_id, rang) : la plupart n'ont pas de rang, un rang peut en ouvrir
-- plusieurs.
CREATE TABLE IF NOT EXISTS tremplin_recompenses (
  id            SERIAL PRIMARY KEY,
  edition_id    INTEGER NOT NULL REFERENCES tremplin_editions(id) ON DELETE CASCADE,
  intitule      TEXT NOT NULL,
  detail        TEXT,
  rang          INTEGER,
  beneficiaire_registration_id INTEGER REFERENCES tremplin_registrations(id) ON DELETE SET NULL,
  motif         TEXT,                                -- note orga INTERNE (jamais publiée)
  transfert_raison TEXT                              -- raison PUBLIQUE et énumérée d'un transfert (sans nom)
                CHECK (transfert_raison IS NULL OR transfert_raison IN ('cfp_officiel', 'autre')),
  statut        TEXT NOT NULL DEFAULT 'a_organiser'
                CHECK (statut IN ('a_organiser', 'planifiee', 'realisee')),
  evenement_le  DATE,
  attribuee_le  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Appartenance MULTI-PHASE d'une inscription (cf. docs/conception-phases-tremplin.md).
-- Rosters différents par phase (phase 2 dépend de la phase 1, phase 3 indépendante).
-- La phase 2 (finale) reste pilotée par `registrations.finale_presente` ; cette
-- table gère les phases 1 et 3 (et peut porter la 2 pour cohérence future).
CREATE TABLE IF NOT EXISTS tremplin_registration_phases (
  registration_id INTEGER NOT NULL REFERENCES tremplin_registrations(id) ON DELETE CASCADE,
  phase           TEXT NOT NULL
                  CHECK (phase IN ('cfp_et_pitch', 'finale', 'montee_sur_scene')),
  -- Consentement à être NOMMÉE sur la page publique de CETTE phase (migration
  -- 055). Distinct de `registrations.public`, recueilli pour la galerie des
  -- finalistes : deux finalités, deux interrupteurs, deux révocations.
  -- Défaut fermé — rattacher à une phase ne publie personne.
  public            BOOLEAN NOT NULL DEFAULT false,
  public_consent_at TIMESTAMPTZ,
  PRIMARY KEY (registration_id, phase)
);

-- Jury d'une édition (phase 2). Personnes PAS forcément membres de la plateforme
-- (pas de compte) : nom/prénom/fonction/entreprise PUBLICS (accord recueilli),
-- e-mail INTERNE (contact orga, jamais exposé publiquement).
CREATE TABLE IF NOT EXISTS tremplin_jury (
  id          SERIAL PRIMARY KEY,
  edition_id  INTEGER NOT NULL REFERENCES tremplin_editions(id) ON DELETE CASCADE,
  nom         TEXT NOT NULL,
  prenom      TEXT,
  fonction    TEXT,
  entreprise  TEXT,
  email       TEXT,                                 -- interne, jamais public
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Journal de consentement (RGPD, append-only) : trace datée de chaque
-- consentement/retrait, pour démontrer un consentement passé même après retrait.
-- `public_consent_at` (ci-dessus) ne reflète que l'état courant ; ce journal
-- garde l'historique. On n'y fait QUE des INSERT.
CREATE TABLE IF NOT EXISTS tremplin_consent_log (
  id              SERIAL PRIMARY KEY,
  registration_id INTEGER NOT NULL REFERENCES tremplin_registrations(id) ON DELETE CASCADE,
  action          TEXT NOT NULL CHECK (action IN ('accorde', 'retire')),
  -- Origine du consentement (démontrabilité RGPD, migration 037) : 'self' = la
  -- personne dans son espace ; sinon recueil externe attesté par l'orga.
  base            TEXT NOT NULL DEFAULT 'self'
                  CHECK (base IN ('self', 'formulaire_inscription', 'email', 'autre')),
  -- Lien vers la source d'un recueil externe (jamais un binaire, jamais public).
  preuve_lien     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Messages de contact modérés (voir docs/plateforme-conception-fonctionnelle.md §3.6).
-- reason : motif (src/data/contact-motifs.ts) ; status : 'en_attente' | 'transmis' | 'rejete'.
CREATE TABLE IF NOT EXISTS contact_messages (
  id           SERIAL PRIMARY KEY,
  profile_id   INTEGER NOT NULL REFERENCES speaker_profiles(id) ON DELETE CASCADE,
  reason       TEXT NOT NULL,
  sender_name  TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  body         TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'en_attente',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  moderated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  moderated_at TIMESTAMPTZ,
  notified_at  TIMESTAMPTZ
);

-- ─── Index (requêtes chaudes) ───
-- speaker_talks.speaker_profile_id : FK lue à chaque fiche et dans l'espace
-- (la plus chaude), accélère aussi le DELETE en cascade.
CREATE INDEX IF NOT EXISTS idx_speaker_talks_profile ON speaker_talks (speaker_profile_id);
-- speaker_profiles.status : filtre partagé annuaire / modération / rappels.
CREATE INDEX IF NOT EXISTS idx_speaker_profiles_status ON speaker_profiles (status);
-- Slug fiche : clé d'URL publique (partage) ET d'unicité. NULL autorisé en
-- multiple (Postgres) : les fiches sans nom restent sans slug.
CREATE UNIQUE INDEX IF NOT EXISTS idx_speaker_profiles_slug ON speaker_profiles (slug);
-- users.name : tri de l'annuaire (ORDER BY u.name).
CREATE INDEX IF NOT EXISTS idx_users_name ON users (name);
-- Unicité de l'e-mail (insensible à la casse) : Auth.js suppose un compte par
-- e-mail ; empêche les doublons (course get-or-create du rattachement Tremplin).
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (lower(email));
-- Moissonneur : 1 session externe = au plus 1 talk par profil (co-speakeuses possibles).
CREATE UNIQUE INDEX IF NOT EXISTS speaker_talks_profile_source_external_id_key
  ON speaker_talks (speaker_profile_id, source, external_id) WHERE external_id IS NOT NULL;
-- Suggestions en attente d'une speakeuse (espace membre).
CREATE INDEX IF NOT EXISTS idx_talk_suggestions_profile_statut
  ON talk_suggestions (profile_id, statut);
-- Contact modéré : file orga (par statut) + vue « Mes messages » (par fiche).
CREATE INDEX IF NOT EXISTS idx_contact_messages_status
  ON contact_messages (status);
CREATE INDEX IF NOT EXISTS idx_contact_messages_profile_status
  ON contact_messages (profile_id, status);
-- Référence des conférences (migration 027). Index PARTIEL obligatoire pour la
-- moisson : un UNIQUE inline avec des NULLs ne matche jamais dans ON CONFLICT.
CREATE UNIQUE INDEX IF NOT EXISTS conf_editions_source_endpoint_key
  ON conference_editions (source, endpoint) WHERE endpoint IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS conf_editions_conf_annee
  ON conference_editions (conference_id, annee) WHERE annee IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conf_editions_conference ON conference_editions (conference_id);
CREATE INDEX IF NOT EXISTS idx_conf_editions_date_debut ON conference_editions (date_debut);
CREATE INDEX IF NOT EXISTS idx_speaker_talks_edition ON speaker_talks (edition_id);
-- Occurrences d'un talk (migration 044) : FK chaudes + idempotence moisson.
CREATE INDEX IF NOT EXISTS idx_talk_occurrences_talk ON talk_occurrences (talk_id);
CREATE INDEX IF NOT EXISTS idx_talk_occurrences_conference ON talk_occurrences (conference_id);
CREATE INDEX IF NOT EXISTS idx_talk_occurrences_edition ON talk_occurrences (edition_id);
CREATE INDEX IF NOT EXISTS idx_talk_occurrences_proposition ON talk_occurrences (proposition_id);
-- Migration 072 — les facettes de l'agenda lisent la région en travers de
-- toutes les fiches publiées. Partiel : une occurrence sans région (hors
-- France, ou en visio) n'a pas à peser dans l'index.
CREATE INDEX IF NOT EXISTS talk_occurrences_region_idx
  ON talk_occurrences (region)
  WHERE region IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS talk_occurrences_profile_source_external_id_key
  ON talk_occurrences (speaker_profile_id, source, external_id) WHERE external_id IS NOT NULL;
-- Tremplin : identité publique d'une édition = (conf, année) — unicité.
CREATE UNIQUE INDEX IF NOT EXISTS idx_editions_conf_annee ON tremplin_editions (conf_slug, annee);
-- Tremplin : FK chaudes (lecture par édition / atelier / participante).
CREATE INDEX IF NOT EXISTS idx_registrations_edition   ON tremplin_registrations (edition_id);
CREATE INDEX IF NOT EXISTS idx_registrations_user      ON tremplin_registrations ("userId");
-- Un seul rang de podium par édition (1ᵉʳ, 2ᵉ… uniques) : garantit l'invariant
-- dont dépend la dérivation de l'origine d'un transfert (classement = rang).
CREATE UNIQUE INDEX IF NOT EXISTS idx_registrations_classement_unique
  ON tremplin_registrations (edition_id, classement) WHERE classement IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tremplin_ateliers_edition ON tremplin_ateliers (edition_id);
CREATE INDEX IF NOT EXISTS idx_documents_edition       ON tremplin_documents (edition_id);
CREATE INDEX IF NOT EXISTS idx_tremplin_photos_edition      ON tremplin_photos (edition_id);
CREATE INDEX IF NOT EXISTS idx_photo_personnes_registration ON tremplin_photo_personnes (registration_id);
CREATE INDEX IF NOT EXISTS idx_consent_log_registration     ON tremplin_consent_log (registration_id);
CREATE INDEX IF NOT EXISTS idx_atelier_membres_registration ON tremplin_atelier_membres (registration_id);
CREATE INDEX IF NOT EXISTS idx_atelier_coachs_user ON tremplin_atelier_coachs (user_id);
CREATE TABLE IF NOT EXISTS tremplin_registration_coachs (
  registration_id INTEGER NOT NULL REFERENCES tremplin_registrations(id) ON DELETE CASCADE,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (registration_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_registration_coachs_user ON tremplin_registration_coachs (user_id);
CREATE INDEX IF NOT EXISTS idx_documents_atelier       ON tremplin_documents (atelier_id);
CREATE INDEX IF NOT EXISTS idx_documents_registration  ON tremplin_documents (registration_id);
CREATE INDEX IF NOT EXISTS idx_recompenses_edition ON tremplin_recompenses (edition_id);
CREATE INDEX IF NOT EXISTS idx_recompenses_beneficiaire
  ON tremplin_recompenses (beneficiaire_registration_id);
CREATE INDEX IF NOT EXISTS idx_jury_edition ON tremplin_jury (edition_id);

-- ─── Réglages de la plateforme (lot C4) ───
-- Clé-valeur : une ligne par réglage MODIFIÉ seulement ; les défauts vivent
-- dans le code (src/lib/reglages.ts).
CREATE TABLE IF NOT EXISTS plateforme_reglages (
  cle        TEXT PRIMARY KEY,
  valeur     TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Contenus éditoriaux (migration 036) : publications (article = actualité) + pages ───
CREATE TABLE IF NOT EXISTS contenus (
  id           SERIAL PRIMARY KEY,
  type         TEXT NOT NULL,                       -- 'publication' | 'page'
  slug         TEXT NOT NULL UNIQUE,                -- slugify(titre), jumeau SQL/TS de lib/slug
  titre        TEXT NOT NULL,
  chapo        TEXT,                                -- teaser carte + description RSS + meta SEO
  corps        TEXT NOT NULL DEFAULT '',            -- Markdown ; vide = publication d'annonce/lien
  image_url    TEXT,
  image_alt    TEXT,
  -- Taille de l'image (migration 065), mesurée au dépôt : elle permet de
  -- réserver sa place en tête d'article, où la photo garde sa proportion
  -- naturelle. NULL = inconnue (image déposée avant la mesure).
  image_width  INT,
  image_height INT,
  -- Vidéo de l'article (migration 053) : l'interview existe en article ET en
  -- vidéo, on propose les deux. La vignette en est dérivée (lib/youtube.ts).
  video_url    TEXT,
  categorie    TEXT,                                -- publication : Meetup & Talk|Behind the Scenes|Tremplin|Communauté
  tag          TEXT,                                -- publication : À venir|En cours|Passé
  lien         TEXT,                                -- publication : lien interne
  lien_externe TEXT,                                -- publication : lien externe
  lien_label   TEXT,                                -- libellé du lien externe
  statut       TEXT NOT NULL DEFAULT 'brouillon',   -- 'brouillon' | 'publie'
  publie_le    DATE,                                -- publication : date affichée + tri + RSS ; page : NULL
  maj_le       TIMESTAMPTZ NOT NULL DEFAULT now(),
  au_flux      BOOLEAN NOT NULL DEFAULT TRUE,        -- au flux RSS ? (seed historique = false)
  -- Article rattaché à une édition de conférence du répertoire (migration 040) :
  -- la page article liste alors automatiquement les speakeuses publiées ayant un
  -- talk sur cette édition. NULL = article non rattaché.
  conference_edition_id INTEGER REFERENCES conference_editions(id) ON DELETE SET NULL,
  -- L'autrice (migration 061, lot N3) : le lien VIVANT (photo, fiche via son
  -- compte) et le nom FIGÉ à la publication — zéro anonymisation, la membre
  -- cède ses droits de publication (l'article reste signé après suppression
  -- du compte : SET NULL n'efface que le lien). NULL = contenu de l'asso.
  auteur_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  auteur_nom     TEXT,
  -- Motif du dernier renvoi en relecture (lot N3), montré à l'autrice.
  relecture_motif TEXT,
  CONSTRAINT contenus_type_ck   CHECK (type IN ('publication', 'page')),
  CONSTRAINT contenus_statut_ck CHECK (statut IN ('brouillon', 'en_relecture', 'publie')),
  CONSTRAINT contenus_img_alt_ck CHECK (image_url IS NULL OR image_alt IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_contenus_type_statut ON contenus (type, statut);
CREATE INDEX IF NOT EXISTS idx_contenus_publie_le   ON contenus (publie_le);
CREATE INDEX IF NOT EXISTS idx_contenus_auteur      ON contenus (auteur_user_id);

-- ─── Réactions sur les cartes du fil (lot N4, migrations 063 + 064) ───
-- UN geste, TROIS mots dérivés du type de carte : « Bravo » (une scène),
-- « Bienvenue » (une arrivée dans l'annuaire), « Merci » (l'article d'une
-- membre). Une réaction va à une PERSONNE — l'actualité de l'association
-- n'en porte pas (contrainte côté code : `auteur_user_id` requis).
-- Un applaudissement NOMINATIF (membre × carte), interne à l'espace connecté.
-- Les cartes du fil sont dérivées : un bravo référence sa ligne source —
-- exactement une des trois (CHECK), suppression de la source = CASCADE ; le
-- retrait rétroactif (fiche retirée, contenu dépublié) purge côté code.
-- Index uniques : la CIBLE d'abord — unicité, lecture du fil et cascades FK
-- avec les mêmes objets.
CREATE TABLE IF NOT EXISTS fil_reactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  occurrence_id INTEGER REFERENCES talk_occurrences(id) ON DELETE CASCADE,
  profile_id INTEGER REFERENCES speaker_profiles(id) ON DELETE CASCADE,
  contenu_id INTEGER REFERENCES contenus(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fil_reactions_cible_ck CHECK (
    (occurrence_id IS NOT NULL)::int + (profile_id IS NOT NULL)::int
      + (contenu_id IS NOT NULL)::int = 1
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS fil_reactions_occurrence_uq
  ON fil_reactions (occurrence_id, user_id) WHERE occurrence_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS fil_reactions_profile_uq
  ON fil_reactions (profile_id, user_id) WHERE profile_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS fil_reactions_contenu_uq
  ON fil_reactions (contenu_id, user_id) WHERE contenu_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fil_reactions_user ON fil_reactions (user_id);

-- Trace des SEEDS de contenu déjà posés une fois.
--
-- `sync-to-latest.sql` est rejoué à CHAQUE déploiement. Un seed gardé par le
-- seul `ON CONFLICT (slug) DO NOTHING` ne tient que tant qu'une ligne porte ce
-- slug : supprimer l'article dans l'admin le fait revenir au déploiement
-- suivant (une demande de retrait de nom serait annulée toute seule), et le
-- RENOMMER libère le slug — le seed réinsère alors un doublon qui, à date de
-- publication égale, gagne l'affichage public (`ORDER BY … id DESC`).
--
-- Un seed se pose UNE fois. Cette table dit lesquels sont passés.
CREATE TABLE IF NOT EXISTS seeds_appliques (
  cle         TEXT PRIMARY KEY,
  applique_le TIMESTAMPTZ NOT NULL DEFAULT now()
);
