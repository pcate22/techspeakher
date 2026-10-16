# Module Tremplin — Conception d'implémentation (Phase 2) — ARCHIVE

> **Statut : LIVRÉ, et le réel a divergé.** Tout ce que ce document projetait
> est **en prod depuis longtemps**, sous une forme différente. Il est gardé
> comme **archive de conception** (le raisonnement, les arbitrages RGPD, les
> audits) ; **rien en dessous de ce bandeau ne décrit le système actuel**. Le
> réel se lit dans `docs/architecture.md` (vue d'ensemble), `db/schema.sql`
> (commenté) et `src/lib/tremplin-*.ts`. Recalé le 2026-08-21 (dette P0-1).

## Le réel a divergé — carte des écarts

| Ce document projetait | Ce qui existe |
|---|---|
| 8 tables `tremplin_*` + `audit_events` (`tremplin_atelier_animatrices`, `tremplin_atelier_presences`, `tremplin_podium`, `tremplin_lots`…) | **15 tables `tremplin_*`** — les rôles d'atelier sont `tremplin_atelier_membres` (participantes, présence tri-état) et `tremplin_atelier_coachs` (comptes coachs), plus `tremplin_registration_coachs` (coachs d'une participante) et `tremplin_atelier_sous_groupes` + `tremplin_sous_groupe_coachs`. Le podium vit sur `tremplin_registrations.classement` + `titre_palmares` ; les lots sont `tremplin_recompenses` (statut `a_organiser`/`planifiee`/`realisee`). `audit_events` n'a **jamais** été créée ; la traçabilité du consentement est `tremplin_consent_log` (append-only). S'ajoutent `tremplin_photos` + `tremplin_photo_personnes` (droit à l'image), `tremplin_jury`, `tremplin_registration_phases` (visibilité par phase), `tremplin_documents` (seule table livrée telle que conçue). |
| `tremplin_ateliers` avec `lien_visio` seul | En plus : `coachs TEXT` (noms libres, **legacy** — cf. dette), `phase`, `nature` (`collectif`/`sous_groupes`), `audience` (`selection`/`phase`/`toutes`), `au_programme_public`, `lieu`, `date_fin`. |
| statut d'édition à 4 valeurs, `DEFAULT 'ouvert'` | **5 valeurs** — `preparation` (défaut, **pivot de la visibilité publique** : une édition en préparation répond 404) puis `ouvert`/`en_cours`/`clos`/`archive`. Liste tenue par `EDITION_STATUTS` (`src/lib/tremplin-statut.ts`) et **fermée en base** (CHECK, migrations 072/073). L'identité publique est (`conf_slug`, `annee`) ; la fenêtre d'inscriptions est datée (`inscriptions_debut/fin`) et l'état « ouvertes » est dérivé. |
| 6 libs `src/lib/tremplin-*` | **23 libs** (éditions, registrations, phases, ateliers, coachs, jury, récompenses, photos, documents, public, guards, admin, form, duplicate, import/seed du Tremplin 1, e-mail, messages, meta…). |
| 4 routes d'écran | Public : `/tremplin/[conf]/[annee]` (+ `montee-sur-scene`, hub `[conf]`, redirections 308). Membre : `/mon-espace/tremplin/[edition]` (+ ateliers) ; coach : `/mon-espace/coaching/[edition]`. Admin : `/admin/tremplins/[edition]` et sa **quarantaine de sous-pages** (infos, statut, finale, jury, ressources, photos, récompenses, ateliers, participantes…). |
| 6 Server Actions nommées | Les actions vivent dans **3 fichiers** : `src/app/admin/tremplins/actions.ts`, `src/app/mon-espace/tremplin/actions.ts`, `src/app/mon-espace/coaching/actions.ts`. |
| `middleware.ts` | **`src/proxy.ts`** (Next 16). La décision d'accès est `refusDAcces` (`src/auth.config.ts`), appliquée explicitement par le proxy ; seconde ligne : `src/lib/auth-guards.ts` et `src/lib/tremplin-guards.ts`. |
| « aucune donnée de participante côté public » | Consentement **opt-in par personne et par phase** (`public` + `public_consent_at` sur `tremplin_registrations` **et** `tremplin_registration_phases`), journalisé (`tremplin_consent_log`), photos sur consentement des personnes taguées. |
| migration `010` réduite, seed hors git | Le dépôt compte 81 fichiers de migrations (jusqu'à la 073) ; la reprise du Tremplin 1 est **dans le code** : `src/lib/tremplin-seed.ts` + `tremplin-import.ts` (import atomique — une transaction — et idempotent par vérification d'existence : édition retrouvée par nom + année, ateliers complétés par titre). |

---

# ↓ Conception d'époque (archive, ne décrit pas le système actuel) ↓

Ce document faisait le **pont entre la conception (déjà complète) et le code**. Il traduisait la Phase 2 en éléments concrets : schéma SQL + migration, libs d'accès, Server Actions et garde-fous, écrans/routes, e-mails, tests TDD, et la reprise du Tremplin 1.

---

## 0. Point de départ (ce qui existe déjà)

- **Phase 1a livrée** : comptes (`users`), profils speakeuses (`speaker_profiles`), talks, modération orga, annuaire public, Auth.js (Google / LinkedIn / lien magique), Neon + `pg`.
- **Aucune table Tremplin** dans `db/schema.sql` ni dans les 9 migrations.
- `src/app/tremplin/` est la **page vitrine statique** (données dans `src/data/tremplin.ts` : étapes, jury, participantes, prix, résultats, FAQ). Elle **reste** la vitrine ; le module Tremplin est l'**outil interne** (orga / membre / animatrice), distinct de cette page marketing.

> Le module ne remplace pas la page vitrine. À terme, la page `/tremplin` pourra lire l'édition `ouvert` en base pour son bandeau « inscriptions », mais ce n'est pas requis pour la Phase 2.

> 🔁 **Évolution (Phase 2b, post-Phase A)** : on **branche les pages publiques d'édition sur la base** (une nouvelle édition met le site à jour seule). La vitrine `/tremplin` reste statique/evergreen ; les **pages d'édition** `/tremplin/[conf]/[annee]` deviennent **pilotées par la BDD**. Conception dédiée : **`docs/tremplin-edition-publique.md`**. ⚠️ Cette évolution **assouplit** la règle d'origine « aucune donnée de participante côté public » (cf. §DTO ci-dessous) : finalistes/gagnantes **nommées + bios + photos** désormais possibles, **mais sur consentement explicite** (opt-in `public`, retrait, effacement, inventaire des photos).

> 🎯 **Objectif livré en premier (≠ ordre du schéma) : voir §13.** Le premier besoin concret n'est **pas** l'admin Tremplin complet ni le dashboard, mais **donner aux participantes du Tremplin 1 l'accès à leurs ressources** (supports des ateliers) **et à leur retour individuel du jury** après la soirée. Ce document décrit le module complet ; la **priorité de livraison** est cadrée en §13 et reflétée dans le phasage §9.

---

## 1. Décisions d'implémentation à acter (écarts/précisions vs conception)

Ces points touchent le schéma et doivent être tranchés avant de coder :

1. **Participante sans compte (reprise / orga)** — la conception (technique §12) dit que le Tremplin 1 est saisi par l'orga comme des **enregistrements, pas des comptes membres**. Donc `tremplin_registrations.user_id` doit être **nullable**, avec des champs de saisie libre (`participante_nom`, `participante_role`, `participante_linkedin`) pour les inscriptions créées par l'orga sans compte rattaché. Une inscription est donc soit **liée à un compte** (`user_id`), soit **saisie à la main** (les deux champs ne sont jamais vides en même temps → contrainte `CHECK`).
   *Recommandé.* Sans ça, impossible de rejouer le Tremplin 1 ni de pré-saisir des participantes avant qu'elles ne créent leur compte.

2. **La Finale est portée par l'édition** — la conception liste une entité « Finale { date, lieu } » et `finale_presente` sur l'inscription. Comme il y a **une finale par édition**, on met `finale_date` + `finale_lieu` **sur `tremplin_editions`** (pas de table dédiée), et `finale_presente` sur `tremplin_registrations` (déjà prévu §6).

3. **Une seule édition `ouvert` à la fois** — règle fonctionnelle (§4.1). On l'applique **à deux niveaux** : un **index partiel unique** `WHERE statut = 'ouvert'` (défense en profondeur, garantit l'invariant même en cas de course entre deux actions orga) **et** un contrôle côté **Server Action** qui renvoie une **erreur lisible** avant d'atteindre la base. *Correction d'audit* : l'index partiel ne contraint **que** les lignes `ouvert` — il n'a donc aucun impact sur le rattrapage (`archive`) ni sur les éditions `clos`/`en_cours`. Ma première version l'écartait à tort.

4. **Suppression de compte (RGPD) × inscriptions** — *bug bloquant identifié à l'audit, voir §10.1.* La combinaison `"userId" … ON DELETE SET NULL` + `CHECK (userId IS NOT NULL OR participante_nom IS NOT NULL)` **fait échouer** la suppression de compte existante (zone danger, `architecture.md`) dès qu'une membre a une inscription : le `SET NULL` rend les **deux** colonnes nulles → violation du `CHECK` → `DELETE FROM users` rejeté. **Décision** : la suppression de compte reste **gérée par l'action serveur**, qui, *avant* de supprimer l'utilisatrice : (a) **supprime** ses inscriptions aux éditions actives (`ouvert`/`en_cours`/`clos`), (b) **fige** le nom/linkedin (`participante_nom = users.name`, `participante_linkedin`) sur ses inscriptions d'éditions **archivées** à conserver (un palmarès passé ne disparaît pas). Le `SET NULL` ne s'applique alors qu'à des lignes qui ont déjà un `participante_nom` → `CHECK` respecté. La FK reste `SET NULL`.

5. **Intégrité inter-édition** — rien n'empêche au niveau SQL qu'une `tremplin_atelier_presences` (ou une ligne `tremplin_podium`, ou `tremplin_lots.attribue_a`) relie un atelier d'une édition à une inscription d'une **autre** édition. **Décision V1** : on garantit la cohérence **dans la lib** (toute écriture vérifie que l'atelier et l'inscription partagent `edition_id`). Le durcissement DB (clés étrangères composites via `UNIQUE (id, edition_id)`) est documenté en §10.4 comme option, non retenu en V1 (volumétrie d'asso, surcoût de schéma).

6. **Compte ≠ profil annuaire** *(clarification structurante)* — un **compte** (`users`) est la **porte d'entrée unique** : toute personne (participante, animatrice, orga) en a un (connexion lien magique / OAuth). Le **profil annuaire** (`speaker_profiles`) est une **facette optionnelle (0..1)** : seules les speakeuses **publiées** y figurent. Conséquences concrètes :
   - le module Tremplin s'appuie **exclusivement sur `users`** (jamais sur `speaker_profiles`) → on peut s'inscrire au Tremplin ou animer un atelier **sans** être dans l'annuaire ;
   - les rôles **Membre / Animatrice / Orga** sont des **droits posés sur le compte** (cf. conception fonctionnelle §2), pas des types de comptes distincts ;
   - l'espace `/mon-espace` doit fonctionner pour un compte **sans** profil annuaire (ne pas présumer qu'un `speaker_profiles` existe).

7. **Compte obligatoire pour le flux *live*, saisie orga réservée au rattrapage** — pour une édition active, **chaque participante et animatrice a un compte** (traçabilité, RGPD, droits self-service). La saisie « sans compte » (`userId` NULL, décision 1) est **cantonnée au rattrapage d'une édition `archive`** (Tremplin 1) ou à une pré-saisie temporaire que l'orga rattachera ensuite (§10.2). À acter pour éviter de recréer des « fiches fantômes » sur le flux courant.

8. **Journal d'événements + tableau de bord orga (KISS, RGPD)** — l'orga doit pouvoir **suivre les inscriptions / désinscriptions** (adhésion TSH et Tremplin) et **retrouver les logs**. On ajoute une table **`audit_events`** append-only, **pseudonymisée** (aucune donnée perso : pas d'e-mail ni de nom stocké ; lien `userId` qui passe à NULL à la suppression du compte → l'événement subsiste, anonyme, pour le suivi agrégé). Un tableau de bord `/admin` simple lit l'**état courant** (tables vivantes) + le **journal récent** (cf. §2, §5, §12).

9. **Objectif prioritaire = espace ressources & résultats (§13)** — la **première** livraison n'est pas l'admin complet mais la **remise de documents** aux participantes du Tremplin 1 (supports partagés + **retour individuel du jury**, privé). Conséquences sur le schéma/priorités :
   - table **`tremplin_documents`** (partagé vs individuel privé) ;
   - la **réconciliation compte ↔ inscription saisie orga** (§10.2), jusque-là « à trancher plus tard », devient **requise dès cette première phase** : chaque participante doit retrouver **ses** documents en se connectant, donc son compte doit être **rattaché** à son inscription (reprise Tremplin 1). Décision : rattachement **manuel par l'orga** (recherche par nom/e-mail), pas de matching automatique.

---

## 2. Schéma SQL

Aligné sur la conception technique §6, avec les précisions du §1 ci-dessus. À ajouter à **`db/schema.sql`** (source) **et** **`db/sync-to-latest.sql`** (idempotent) **et** comme migration **`db/migrations/010_tremplin.sql`** (cf. CLAUDE.md : les trois en cohérence).

```sql
-- ─── Tremplin (Phase 2) ───

-- Édition : une promo rattachée à une conférence majeure.
-- statut : 'ouvert' | 'en_cours' | 'clos' | 'archive'
CREATE TABLE IF NOT EXISTS tremplin_editions (
  id           SERIAL PRIMARY KEY,
  nom          TEXT NOT NULL,
  annee        INTEGER NOT NULL,
  statut       TEXT NOT NULL DEFAULT 'ouvert',
  description  TEXT,
  conf_nom     TEXT,
  conf_date    DATE,
  conf_lien    TEXT,
  finale_date  DATE,
  finale_lieu  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Inscription : lien (participante × édition). user_id nullable pour les
-- enregistrements saisis par l'orga (reprise Tremplin 1, pré-saisie).
-- statut : 'en_attente' | 'acceptee' | 'refusee'
CREATE TABLE IF NOT EXISTS tremplin_registrations (
  id            SERIAL PRIMARY KEY,
  edition_id    INTEGER NOT NULL REFERENCES tremplin_editions(id) ON DELETE CASCADE,
  "userId"      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  participante_nom      TEXT,
  participante_role     TEXT,
  participante_linkedin TEXT,
  statut        TEXT NOT NULL DEFAULT 'en_attente',
  sujet         TEXT,
  finale_presente BOOLEAN,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- liée à un compte OU saisie à la main, jamais ni l'un ni l'autre.
  -- ⚠️ interagit avec la suppression de compte : voir §1 décision 4 et §10.1.
  CONSTRAINT registration_identite CHECK (
    "userId" IS NOT NULL OR participante_nom IS NOT NULL
  ),
  -- une personne ne s'inscrit qu'une fois par édition.
  -- NB : Postgres traite les NULL comme DISTINCTS (défaut) → cet UNIQUE
  -- garde les inscriptions liées à un compte, et autorise volontairement
  -- plusieurs inscriptions « saisie orga » (userId NULL) par édition.
  UNIQUE (edition_id, "userId")
);

-- Atelier : session de coaching d'une édition (horaires début/fin).
-- Le NOMBRE d'ateliers est variable par édition : c'est simplement le nombre
-- de lignes créées par l'orga (5 pour le Tremplin 1, mais non figé).
-- heure_debut/heure_fin en TIME (sans fuseau) : interprétées en Europe/Paris
-- pour l'affichage ET pour le cron de rappel (cf. §6, §10.3).
-- Les docs de travail (plusieurs liens/atelier) vivent dans tremplin_documents
-- (atelier_id) ; ici on ne garde que le lien visio (un seul par atelier).
CREATE TABLE IF NOT EXISTS tremplin_ateliers (
  id           SERIAL PRIMARY KEY,
  edition_id   INTEGER NOT NULL REFERENCES tremplin_editions(id) ON DELETE CASCADE,
  ordre        INTEGER NOT NULL DEFAULT 0,
  titre        TEXT NOT NULL,
  date         DATE,
  heure_debut  TIME,
  heure_fin    TIME,
  description  TEXT,
  lien_visio   TEXT
);

-- Animatrices d'un atelier (n-n : plusieurs animatrices par atelier).
CREATE TABLE IF NOT EXISTS tremplin_atelier_animatrices (
  atelier_id INTEGER NOT NULL REFERENCES tremplin_ateliers(id) ON DELETE CASCADE,
  "userId"   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (atelier_id, "userId")
);

-- Présence atelier (OPTIONNELLE → permet le rattrapage sans appel).
-- statut : 'presente' | 'absente' | 'excusee'
CREATE TABLE IF NOT EXISTS tremplin_atelier_presences (
  atelier_id      INTEGER NOT NULL REFERENCES tremplin_ateliers(id) ON DELETE CASCADE,
  registration_id INTEGER NOT NULL REFERENCES tremplin_registrations(id) ON DELETE CASCADE,
  statut          TEXT NOT NULL,
  PRIMARY KEY (atelier_id, registration_id)
);

-- Podium : classement par édition (rang 1 = gagnante).
CREATE TABLE IF NOT EXISTS tremplin_podium (
  edition_id      INTEGER NOT NULL REFERENCES tremplin_editions(id) ON DELETE CASCADE,
  registration_id INTEGER NOT NULL REFERENCES tremplin_registrations(id) ON DELETE CASCADE,
  rang            INTEGER NOT NULL,
  titre_talk      TEXT,
  PRIMARY KEY (edition_id, rang)
);

-- Lots : liste par édition + suivi de remise.
-- statut : 'a_attribuer' | 'attribue' | 'remis'
CREATE TABLE IF NOT EXISTS tremplin_lots (
  id          SERIAL PRIMARY KEY,
  edition_id  INTEGER NOT NULL REFERENCES tremplin_editions(id) ON DELETE CASCADE,
  libelle     TEXT NOT NULL,
  rang        INTEGER,
  partenaire  TEXT,
  statut      TEXT NOT NULL DEFAULT 'a_attribuer',
  attribue_a  INTEGER REFERENCES tremplin_registrations(id) ON DELETE SET NULL,
  remis_le    TIMESTAMPTZ
);

-- Documents & ressources d'une édition (cf. §13 — objectif prioritaire).
-- registration_id NULL  → ressource PARTAGÉE (supports d'atelier, vue par toutes
--                          les participantes acceptées de l'édition).
-- registration_id défini → document INDIVIDUEL & PRIVÉ (retour jury, vidéo du
--                          pitch) : visible par CETTE participante + l'orga.
-- Un document est soit un LIEN (Drive/Doc/vidéo), soit un CONTENU TEXTE
-- saisi/collé dans un éditeur (le retour jury tapé directement), soit les deux.
-- Pas d'upload de fichiers en V1 (cohérent conception §9 ; voir §13.4).
-- Le contenu texte vit en base (Postgres UE) → plus maîtrisé qu'un lien Drive.
-- Portée d'un document :
--   - atelier_id défini      → doc de travail d'UN atelier (partagé) ;
--   - registration_id défini → doc INDIVIDUEL & privé (retour jury, note…) ;
--   - les deux NULL          → ressource générale de l'édition.
--   (atelier_id et registration_id sont mutuellement exclusifs en pratique ;
--    garanti côté lib.)
-- auteur_id : qui a écrit le doc. Sert à l'autorisation (§13.2) :
--   - orga  → retour jury / supports (la participante lit, n'édite pas) ;
--   - participante → SES notes/idées de prépa (elle CRUD, type 'note').
-- type : 'support_atelier' | 'feedback_jury' | 'video_pitch' | 'note' | 'autre'
CREATE TABLE IF NOT EXISTS tremplin_documents (
  id              SERIAL PRIMARY KEY,
  edition_id      INTEGER NOT NULL REFERENCES tremplin_editions(id) ON DELETE CASCADE,
  atelier_id      INTEGER REFERENCES tremplin_ateliers(id) ON DELETE CASCADE,
  registration_id INTEGER REFERENCES tremplin_registrations(id) ON DELETE CASCADE,
  auteur_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  type            TEXT NOT NULL DEFAULT 'autre',
  titre           TEXT NOT NULL,
  lien            TEXT,
  contenu         TEXT,   -- texte markdown saisi via l'éditeur réutilisable
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- au moins un support : un lien OU du contenu.
  CONSTRAINT document_a_un_support CHECK (lien IS NOT NULL OR contenu IS NOT NULL)
);

-- Journal d'événements orga (append-only, PSEUDONYMISÉ).
-- RGPD : on ne stocke AUCUNE donnée perso directe (ni e-mail ni nom). Le nom
-- ne s'obtient que par jointure sur users TANT QUE le compte existe ; à la
-- suppression du compte, "userId"/acteur_id passent à NULL → l'événement reste
-- comme trace anonyme (suivi agrégé inscriptions/désinscriptions).
-- action : 'compte_cree' | 'compte_supprime' | 'adhesion_debut' | 'adhesion_fin'
--        | 'tremplin_inscription' | 'tremplin_desinscription'
--        | 'inscription_acceptee' | 'inscription_refusee'
--        | 'animatrice_ajout' | 'animatrice_retrait' | 'atelier_sans_animatrice'
CREATE TABLE IF NOT EXISTS audit_events (
  id          SERIAL PRIMARY KEY,
  action      TEXT NOT NULL,
  "userId"    INTEGER REFERENCES users(id) ON DELETE SET NULL,  -- personne concernée
  acteur_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,  -- qui a agi (elle-même / orga)
  edition_id  INTEGER REFERENCES tremplin_editions(id) ON DELETE SET NULL,
  cible       TEXT,            -- libellé NON perso : 'Tremplin 2026', 'Atelier 3'…
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Index (requêtes chaudes) ───
CREATE INDEX IF NOT EXISTS idx_registrations_edition ON tremplin_registrations (edition_id);
CREATE INDEX IF NOT EXISTS idx_registrations_user    ON tremplin_registrations ("userId");
CREATE INDEX IF NOT EXISTS idx_tremplin_ateliers_edition      ON tremplin_ateliers (edition_id);
CREATE INDEX IF NOT EXISTS idx_tremplin_animatrices_user      ON tremplin_atelier_animatrices ("userId");
CREATE INDEX IF NOT EXISTS idx_tremplin_lots_edition          ON tremplin_lots (edition_id);
CREATE INDEX IF NOT EXISTS idx_documents_edition      ON tremplin_documents (edition_id);
CREATE INDEX IF NOT EXISTS idx_documents_atelier      ON tremplin_documents (atelier_id);
CREATE INDEX IF NOT EXISTS idx_documents_registration ON tremplin_documents (registration_id);
CREATE INDEX IF NOT EXISTS idx_audit_created          ON audit_events (created_at DESC);

-- ─── Invariant : une seule édition 'ouvert' à la fois (§1 décision 3) ───
-- Index partiel unique : toutes les lignes ciblées ayant la même valeur
-- 'ouvert', l'unicité borne leur nombre à 1. N'affecte pas archive/clos/en_cours.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_edition_ouverte
  ON tremplin_editions (statut) WHERE statut = 'ouvert';
```

> Convention : on garde `"userId"` entre guillemets (camelCase) pour rester cohérent avec les tables Auth.js et `speaker_profiles`, et `idx_*` comme dans `007_indexes.sql`.

---

## 3. Couche d'accès (`src/lib/`)

Une lib par agrégat, server-only, SQL paramétré, mapping vers des types internes. Symétrique de `profiles.ts` / `talks.ts`.

| Fichier | Responsabilité |
|---|---|
| `src/lib/tremplin-editions.ts` | CRUD éditions ; `getEditionOuverte()`, `getEditionById()`, `listEditions()` ; règle « une seule `ouvert` » (lève si conflit). |
| `src/lib/tremplin-registrations.ts` | Inscrire (membre), lister par édition / par user, accepter/refuser (orga), saisie orga (sans compte), `finale_presente`. |
| `src/lib/tremplin-ateliers.ts` | CRUD ateliers + association animatrices (n-n) ; `getAteliersByEdition()`, `getAteliersForAnimatrice(userId)`. |
| `src/lib/tremplin-presences.ts` | Upsert présence atelier (appel) ; matrice (participantes × ateliers) pour l'orga. |
| `src/lib/tremplin-documents.ts` | **(Phase A)** Documents partagés vs individuels (§13) : `getSharedDocuments(editionId)`, `getMyDocuments(userId, editionId)`, dépôt orga. Ne renvoie **jamais** les documents privés d'une autre personne. |
| `src/lib/tremplin-podium.ts` | Lire/écrire le classement d'une édition. |
| `src/lib/tremplin-lots.ts` | CRUD lots + transitions de suivi (`a_attribuer`→`attribue`→`remis`). |
| `src/lib/tremplin-form.ts` | Schémas **Zod** (édition, inscription, atelier, lot) — validation partagée actions/formulaires. |
| `src/lib/tremplin-guards.ts` | Helpers d'autorisation : `assertOrga(session)`, `assertAnimatriceDeLAtelier(session, atelierId)`, `assertOwnerInscription(session, regId)`. |
| `src/lib/audit.ts` | `logEvent(action, { userId?, acteurId?, editionId?, cible? })` (append-only) + lectures dashboard : `recentEvents(limit)`, `eventsForUser(userId)`. **Ne stocke jamais** d'e-mail/nom. |
| `src/lib/admin-dashboard.ts` | Agrégats KISS pour `/admin` : `countAdhesionsActives()`, `countInscriptionsEditionOuverte()`, `desinscriptionsRecentes()`, `alertes()` (ateliers sans animatrice, gagnante absente de la finale…). Lit l'**état courant** des tables vivantes, pas le journal. |
| `src/lib/account-deletion.ts` | Orchestration **RGPD** de la suppression de compte (algorithme §12) : désinscriptions actives, figeage des palmarès archivés, retrait des animations + alerte orga, clôture adhésion, `logEvent`. Étend la zone danger existante. |

**DTO public** : un DTO `PublicEdition` (comme `PublicSpeaker`) projette l'édition côté public.

> 🔁 **Mise à jour (Phase 2b, cf. `docs/tremplin-edition-publique.md`).** La règle initiale était « **aucune** donnée de participante côté public ». Avec les pages d'édition pilotées par la BDD, elle devient : le DTO peut exposer **nom, rôle, sujet, bio, liens, portrait** d'une participante **uniquement si `public = true`** (consentement opt-in, horodaté), plus les **photos de groupe** dont **toutes** les personnes taguées consentent (inventaire `tremplin_photo_personnes`). Restent **toujours privés** : e-mails, `userId`, liste des inscrites, noms non consentis, documents (retours jury, vidéos, notes). Les **compteurs** restent des agrégats **anonymes**.

> **Compte ≠ annuaire** (§1 décision 6) : ces libs joignent `users` (le compte) et **n'exigent pas** de `speaker_profiles`. Pour afficher un nom dans le dashboard, on lit `users.name` ; absent (compte sans nom) → libellé neutre.

---

## 4. Server Actions & garde-fous (RBAC + ownership)

Toutes dans des `actions.ts` par dossier de route. **Identité depuis la session, jamais du client** ; autorisation re-vérifiée serveur ; entrées validées Zod ; SQL paramétré (cf. CLAUDE.md).

| Action | Acteur | Garde-fous serveur |
|---|---|---|
| `createEditionAction` / `updateEditionAction` | Orga | `session.user.isOrga` ; refuse une 2ᵉ édition `ouvert`. |
| `registerToTremplinAction` | Membre | session connectée ; édition `ouvert` ; pas déjà inscrite (`UNIQUE`). |
| `decideRegistrationAction` (accepter/refuser) | Orga | `isOrga` ; notifie la participante par e-mail. |
| `upsertAtelierAction` + `setAnimatricesAction` | Orga | `isOrga`. |
| `updateAtelierSupportAction` (visio/support) | Animatrice | **ownership** : animatrice de **cet** atelier (ou orga). |
| `markPresenceAction` (appel) | Animatrice | ownership atelier ; statut ∈ {`presente`,`absente`,`excusee`}. |
| `setFinaleAction` / `setPodiumAction` | Orga | `isOrga` ; rang 1 = gagnante. |
| `upsertLotAction` / `advanceLotAction` | Orga | `isOrga` ; transitions de statut contrôlées. |
| `withdrawFromTremplinAction` (désinscription) | Membre | **ownership** : sa propre inscription ; édition non close ; `logEvent('tremplin_desinscription')` + alerte orga. |
| `deleteAccountAction` (zone danger, **existant à étendre**) | Elle-même | algorithme RGPD complet §12 (désinscriptions, palmarès, animations, adhésion, journal). |

La protection de route grossière vit dans `middleware.ts` (`/mon-espace/**` connecté, `/admin/**` orga) ; l'**ownership fin** (animatrice ↔ son atelier, membre ↔ son inscription) **uniquement** côté action via `tremplin-guards.ts`. **Toute action qui change un état suivi** (inscription, désinscription, accept/refus, ajout/retrait animatrice, adhésion) appelle `logEvent` pour alimenter le journal et le dashboard.

---

## 5. Écrans & routes (App Router)

Repris de la conception fonctionnelle §7.

**Membre (connectée)**
- `/mon-espace/tremplin` — édition ouverte (s'inscrire / **se désinscrire**), mes inscriptions, programme des ateliers si **acceptée** (dates, visio, supports), mon suivi de présence (lecture seule).

**Animatrice**
- `/mon-espace/ateliers` — **mes** ateliers : éditer visio/support, **faire l'appel** (présences).

**Orga (admin)**
- `/admin` — **tableau de bord KISS** : quelques **cartes de compteurs** (adhérentes actives, profils publiés à l'annuaire, inscrites à l'édition `ouvert`), un bloc **⚠️ alertes** (ateliers sans animatrice, gagnante absente de la finale, lot attribué à une non-classée), et un **journal des derniers événements** (inscriptions / désinscriptions / suppressions, pseudonymisé). Réutilise la file de modération existante en l'enrichissant, plutôt qu'une page neuve.
- `/admin/membres` — suivi des **adhésions** (inscriptions / désinscriptions TSH), saisie manuelle d'adhésion (intérim HelloAsso), masquage d'une fiche.
- `/admin/tremplins` — liste des éditions (par conférence majeure).
- `/admin/tremplins/[edition]` — détail : ateliers (horaires + animatrices) + inscriptions (accepter/refuser).
- `/admin/tremplins/[edition]/presences` — **matrice** participantes × ateliers.
- `/admin/tremplins/[edition]/finale` — présence finale + podium / gagnante.
- `/admin/tremplins/[edition]/lots` — lots & suivi de remise.

Pages connectées en `force-dynamic`, résilientes si la base est indisponible (pattern existant de l'annuaire). Accessibilité RGAA : `aria-labelledby` sur les sections, `role="alert"` sur les erreurs, tablists au clavier, `focus-visible` (cf. `architecture.md`).

---

## 6. E-mails (Brevo, déjà en place)

Étendre `src/lib/email.ts` (gardé par `BREVO_API_KEY`, expéditeur `contact@techspeakher.fr`) :
- inscription Tremplin **acceptée / refusée** (à la participante) ;
- animatrice : « tu animes l'atelier X » + **rappel avant l'atelier** (cron) ;
- (existant ailleurs) relances d'adhésion — hors périmètre Tremplin.

Le rappel avant atelier peut réutiliser le pattern cron existant (`CRON_SECRET`, 1×/jour sur Vercel Hobby).

---

## 7. Reprise du Tremplin 1 (DevFest 2026) en `archive`

Objectif (technique §12) : rejouer l'édition **terminée** **sans présence atelier**, comme socle de l'**objectif prioritaire §13** (remise des documents). Les inscriptions sont d'abord saisies par l'orga, puis **rattachées** aux comptes au fur et à mesure que les participantes se connectent (§1 décision 9, §10.2).

**Chiffres** (source : `src/data/tremplin.ts`, déjà publié) :
- **12 inscrites** au total (le site n'en montre que les finalistes ; les 4 autres sont connues de l'orga, non publiques).
- **8 finalistes** à la **soirée du 4 juin** → ce sont les 8 `participantes` du site (noms, rôles, sujets, LinkedIn).
- **3 gagnantes** → `resultats` (les noms vivent en base de production, avec leur consentement).
- **1 à 2 no-show complets** aux ateliers (parmi les 12, non finalistes).
- Retour **individuel du jury** + **vidéo du pitch** par finaliste.

Mise en base (seed depuis `src/data/tremplin.ts` pour le public, complété par l'orga pour le privé) :
- **Édition** : `nom = "Tremplin 2026"`, `annee = 2026`, `statut = 'archive'`, `conf_nom = "DevFest Toulouse 2026"`, `conf_date = 2026-11-19`, `finale_date = 2026-06-04`, `finale_lieu` (BPCE IT Toulouse).
- **Inscriptions** : les **8 finalistes** (depuis `participantes`) + jusqu'à **4 inscrites supplémentaires** (saisies orga, non publiques) → `tremplin_registrations` (`userId` NULL au départ). `finale_presente = true` pour les **8 finalistes** ; les 4 autres `false`/non renseigné.
- **Podium** : `resultats` (3 gagnantes) → `tremplin_podium` (rang + `titre_talk`).
- **Lots** : `prix` → `tremplin_lots` (`statut = 'remis'`).
- **Ateliers** : les **5 ateliers** (depuis `etapes`/`accompagnement`) avec **titre, jour, heure début/fin** → `tremplin_ateliers`. Le nombre d'ateliers est libre (ici 5).
- **Documents** : par atelier, les **docs de travail** (liens) → `tremplin_documents` (`atelier_id`) ; par finaliste, le **retour jury** (lien Google Doc en itération 1) + la **vidéo** → documents individuels privés.
- **Présence atelier** : **non tracée** (rattrapage) ; les 1-2 no-shows ne sont pas saisis atelier par atelier (présence optionnelle, table `tremplin_atelier_presences` non utilisée ici).

> Le site est la source des **données publiques** (8 finalistes, podium, jury, prix). Les **données privées** (retours jury individuels, vidéos, 4 inscrites non finalistes) sont fournies par l'orga **hors git**.

> Livré via un **script de seed hors git** (données personnelles — retours jury, liens/vidéos privés — **jamais committées**, cf. CLAUDE.md §Sécurité). Le seed est idempotent (réutilise l'édition si elle existe).

---

## 8. Tests (TDD — rouge → vert → refactor)

Tests **avant** le code ; rien ne merge en rouge (CI). Couverture par niveau (cf. conception technique §17) :

- **Unitaire / intégration DB** : libs `tremplin-*` avec pool `pg` mocké (assertions SQL + params + mapping). Cas clés : `getEditionOuverte` unique, `CHECK registration_identite`, `UNIQUE (edition_id, userId)`.
- **Server Actions (garde-fous)** — le cœur :
  - `decideRegistrationAction` refuse si non-orga ;
  - `markPresenceAction` / `updateAtelierSupportAction` refusent une animatrice **non rattachée** à l'atelier (ownership) ;
  - `registerToTremplinAction` refuse une édition non `ouvert` et la double inscription ;
  - `withdrawFromTremplinAction` n'agit que sur **sa** propre inscription ;
  - `createEditionAction` refuse une 2ᵉ édition `ouvert`.
- **Cycle de vie / RGPD (§12)** — la matrice de cas est testée :
  - suppression de compte d'une **candidate en plein Tremplin** → inscription supprimée + `tremplin_desinscription` journalisé, pas d'erreur `CHECK` ;
  - suppression de compte d'une **animatrice assignée** → lien retiré + `atelier_sans_animatrice` + atelier listé en alerte ;
  - suppression d'une **gagnante archivée** → podium préservé (nom figé ou neutralisé) ;
  - `logEvent` **refuse** un champ contenant un e-mail/nom ; `audit_events` jamais exposé côté public.
- **Composant** : formulaires (édition, atelier, lot) → erreurs `role="alert"`, RGAA ; matrice de présence ; dashboard orga (compteurs + alertes).
- **Sécurité** : aucune coordonnée de participante rendue côté public ; un **compte sans `speaker_profiles`** accède bien à `/mon-espace` et au Tremplin (compte ≠ annuaire) ; routes privées qui redirigent.
- **Garder verts** : suites existantes (data-integrity, french-spelling, navigation, a11y) + Lighthouse.

---

## 9. Phasage de livraison (3 temps : valeur d'abord)

Séquencement piloté par la **valeur**, et non par le schéma : on **donne d'abord** quelque chose aux participantes du Tremplin 1, **ensuite** on outille l'édition suivante, **enfin** on durcit les cas spécifiques. Chaque lot est une (ou quelques) PR petites, testées, qui n'a de sens **que livrée**.

### Phase A — MVP « valeur participantes Tremplin 1 » (§13)

But : une participante se connecte et **récupère ses documents** (supports des **ateliers** + retour jury). **Itération 1 = liens seulement** (le retour jury est un **Google Doc partagé**, on en stocke l'URL) — suffisant pour livrer la valeur. L'éditeur texte et les notes viennent **juste après**. Schéma minimal : `tremplin_editions`, `tremplin_registrations`, `tremplin_ateliers`, `tremplin_documents` (pas de présences/animatrices/finale/dashboard ici).

- **Lot A1 — Socle minimal** : migration `010` réduite à `tremplin_editions` + `tremplin_registrations` + `tremplin_ateliers` + `tremplin_documents` (+ `schema.sql`/`sync-to-latest.sql`) ; libs `tremplin-editions`, `tremplin-registrations`, `tremplin_ateliers`, `tremplin-documents` + tests d'intégration.
- **Lot A2 — Seed Tremplin 1 (hors git)** : édition `archive`, les **5 ateliers** (titre/jour/heure), les **8 finalistes** (depuis `src/data/tremplin.ts`) + jusqu'à 4 inscrites orga, documents en **liens** (docs de travail par atelier + **lien Google Doc** du retour jury + lien vidéo individuels). Idempotent.
- **Lot A3 — Rattachement compte ↔ inscription** : écran orga minimal pour relier une inscription (`userId` NULL) à un compte connecté (recherche nom/e-mail) ; e-mail d'invitation (priorité aux **8 finalistes**).
- **Lot A4 — Espace participante (liens)** : `/mon-espace/tremplin/[edition]` — **les ateliers et leurs docs** + **ses** documents privés en **liens** (lecture). Garde-fou : une participante ne voit **que** ses propres documents individuels (test de sécurité dédié, matrice §13.2).

> ✅ **Fin de l'itération 1 = valeur livrée** : les 8 finalistes accèdent à leurs retours jury (Google Docs) et supports, **sans** éditeur, **sans** admin complet.

**Itération suivante (même phase, fast-follow) — éditeur & notes** :
- **Lot A5 — Éditeur réutilisable** : `RichTextEditor` (textarea natif contrôlé) + `Markdown` (rendu `pre-wrap` échappé) + **test XSS** (§13.4). Permet de **coller le contenu** d'un retour directement en base (au lieu/en plus du lien).
- **Lot A6 — Notes participante** : « Mes notes » dans l'espace participante (CRUD via l'éditeur, type `note`, ownership §13.2).

> Le bug RGPD §10.1 reste à couvrir a minima dès qu'un compte réel est rattaché (Lot A3) — voir encart plus bas.

### Phase B — Préparer l'édition suivante (Tremplin 2)

But : ouvrir une nouvelle édition et la gérer de bout en bout.

- **Lot B1 — Compléter le schéma** : `tremplin_atelier_animatrices`, `tremplin_atelier_presences`, `tremplin_podium`, `tremplin_lots`, `audit_events` (+ index, index partiel `uniq_edition_ouverte`). *(`tremplin_ateliers` est déjà créé en Phase A, Lot A1.)*
- **Lot B2 — Orga éditions, ateliers & inscriptions** : `/admin/tremplins`, CRUD édition (règle « une seule ouverte »), **CRUD ateliers** (titre/jour/heure/visio + docs de travail, nombre libre), accepter/refuser + e-mails, **désinscription** membre, `logEvent`.
- **Lot B3 — Animatrices** : association n-n (`tremplin_atelier_animatrices`), e-mail « tu animes l'atelier X ».
- **Lot B4 — Membre & animatrice** : inscription à l'édition ouverte (`/mon-espace/tremplin`), `/mon-espace/ateliers` (supports + appel des présences).
- **Lot B5 — Finale, podium & lots** : `/admin/tremplins/[edition]/{finale,lots}` + matrice présences.

### Phase C — Cas spécifiques & durcissement

But : robustesse, RGPD et confort orga, une fois la valeur livrée.

- **Lot C1 — Suppression de compte étendue (RGPD)** : `account-deletion.ts` (algorithme §12) + test de non-régression (inscription active, podium archivé, **animatrice assignée**). *(§10.1 — à anticiper dès qu'un compte réel est rattaché en Phase A ; voir encart ci-dessous.)*
- **Lot C2 — Tableau de bord orga** : `/admin` (compteurs + **alertes** ateliers sans animatrice / incohérences §10.6 + **journal**), `/admin/membres` (suivi adhésions).
- **Lot C3 — Durcissements** : invariants métier (alertes non bloquantes §10.6), réconciliation outillée (§10.2), éventuel durcissement d'intégrité inter-édition (§10.4), `CHECK (statut IN …)`.
- **Lot transverse — Doc** : mettre à jour `architecture.md` (source de vérité) au fil des livraisons.

> ℹ️ **RGPD / suppression de compte en Phase A** — *précision post-implémentation* : le rattachement (Lot A3) pose `userId` **sans effacer** `participante_nom`. À la suppression d'un compte, le `SET NULL` laisse donc `participante_nom` rempli → le `CHECK` (§10.1) **reste satisfait, la suppression ne plante pas**. Le risque `CHECK`/`SET NULL` est reporté à la **Phase B** (inscription *live* d'une membre, `participante_nom` nul). Reste un point d'erasure **non bloquant** à traiter en Lot C1 : à la suppression d'un compte, ses **documents individuels** (retour jury) restent liés à l'inscription conservée → à purger/neutraliser par `account-deletion.ts` (§12).

> Chaque lot vient avec ses tests (unité + composant ; + intégration si il touche la base) et garde les suites existantes vertes.

---

## 10. Limites connues, risques & arbitrages (audit technique)

Revue critique de cette conception. Chaque point est soit **corrigé ci-dessus**, soit **assumé en V1** avec sa raison, soit **à trancher**.

### 10.1 Suppression de compte RGPD × inscriptions (corrigé) — *risque le plus sérieux*

Le `CHECK (userId IS NOT NULL OR participante_nom IS NOT NULL)` interagit mal avec `"userId" … ON DELETE SET NULL` : supprimer une utilisatrice qui a une inscription « liée au compte » (donc `participante_nom` nul) rend les deux colonnes nulles et **viole le CHECK**, ce qui **fait échouer** le `DELETE FROM users` — or la suppression de compte self-service existe déjà (`architecture.md`, zone danger, cascade). Sans correctif, livrer le module **casse une fonctionnalité RGPD en place**.
**Traitement** : §1 décision 4 — la suppression reste pilotée par l'action serveur (supprime les inscriptions d'éditions actives, fige nom/linkedin sur les éditions archivées à conserver, puis supprime le compte).
**Test de non-régression obligatoire** : étendre le test de la zone danger pour couvrir « membre avec inscription active » **et** « membre figurant à un podium archivé ».

### 10.2 Réconciliation « enregistrement orga » → « compte » (tranché → Phase A, Lot A3)

La reprise du Tremplin 1 crée des inscriptions **sans `userId`** (saisie orga). Quand une participante **crée son compte**, il faut relier son inscription archivée à ce compte — **prérequis de l'objectif prioritaire** (§13) : sans rattachement, elle ne voit pas ses documents.
**Décision (§1 décision 9)** : rattachement **manuel par l'orga** via `/admin/tremplins/[edition]` (recherche par nom/e-mail), **pas** de matching automatique (faux positifs ; l'e-mail des participantes saisies n'est pas stocké). Livré en **Lot A3**.

### 10.3 Fuseau horaire des ateliers (assumé)

`heure_debut`/`heure_fin` sont des `TIME` sans fuseau, interprétés **Europe/Paris**. C'est suffisant pour l'affichage et pour le cron de rappel (asso toulousaine, ateliers en midi local), mais **non robuste** à un changement de fuseau serveur. Le cron de rappel doit convertir explicitement (`date` + `heure_debut` en Europe/Paris) plutôt que se fier au fuseau du runtime. Acceptable en V1 ; à revoir si des éditions multi-fuseaux apparaissent.

### 10.4 Intégrité référentielle inter-édition (assumé, durcissement documenté)

`tremplin_atelier_presences`, `tremplin_podium` et `tremplin_lots.attribue_a` peuvent, au niveau SQL seul, relier des entités d'**éditions différentes**. En V1 c'est **garanti par la lib** (toute écriture vérifie l'égalité d'`edition_id`). Durcissement DB possible (non retenu) : `UNIQUE (id, edition_id)` sur `tremplin_registrations` et `tremplin_ateliers`, puis ajouter `edition_id` à `tremplin_atelier_presences` avec des **clés étrangères composites** vers les deux tables. À reconsidérer si l'on observe des incohérences en exploitation.

### 10.5 Course à la création d'édition `ouvert` (corrigé)

Deux actions orga concurrentes pouvaient créer deux éditions `ouvert` (vérification applicative seule = TOCTOU). Corrigé par l'**index partiel unique** `uniq_edition_ouverte` (§2) ; l'action applicative reste pour l'**erreur lisible**.

### 10.6 Cohérence podium ↔ lots ↔ finale (assumé)

Aucune contrainte ne garantit que `tremplin_lots.rang` corresponde au même `registration_id` que `tremplin_podium` au même rang, ni qu'une `finale_presente = true` existe pour la gagnante. Ce sont des **invariants métier faibles** laissés à l'UI orga (V1). À surveiller : un récapitulatif d'édition côté orga qui **signale** les incohérences (lot attribué à une non-classée, gagnante absente de la finale) serait un bon garde-fou non bloquant.

### 10.7 Rôle « animatrice » absent de la session (clarification)

Contrairement à `is_orga` (dans le JWT, lu à la connexion), le statut animatrice **n'est pas** dans la session : il dépend de `tremplin_atelier_animatrices`, lu **en base à chaque requête**. Donc `/mon-espace/ateliers` est protégé **connecté** par `middleware.ts` (pas de règle « animatrice » au niveau middleware) et la page **filtre par `getAteliersForAnimatrice(userId)`** (vide si aucun atelier). Avantage : pas de péremption de session lors de l'ajout/retrait d'une animatrice. L'ownership fin reste vérifié dans l'action.

### 10.8 Gating adhésion reporté (cohérent avec Phase 1b)

La conception réserve l'inscription aux **adhérentes**, mais l'adhésion (HelloAsso) est **reportée** et gérée à la main. En V1, `registerToTremplinAction` est donc **connecté-only** ; la curation se fait via accepter/refuser (orga). Le branchement du gating adhésion suivra la Phase 1b, sans changement de schéma Tremplin.

### 10.9 Contrainte d'exploitation : cron 1×/jour (Vercel Hobby)

Les rappels « avant l'atelier » et toute expiration reposent sur **un seul cron quotidien** (Vercel Hobby, conception technique §16). Suffisant pour des ateliers planifiés à la journée, mais **pas de rappel < 24 h de précision**. À garder en tête pour la formulation des e-mails (« demain » plutôt qu'une heure précise) ; bascule Vercel Pro si besoin un jour.

### 10.10 Périmètre non couvert (explicite)

- **Pas de stockage de fichiers** : supports = liens (conception §9). Aucun upload.
- **Journal d'événements** : couvert par `audit_events` (§2, §12), volontairement **léger et pseudonymisé** (inscriptions / désinscriptions / suppressions / animations). Ce n'est **pas** un audit exhaustif de toutes les actions ni un versionnage des éditions ; on n'y met aucune donnée perso.
- **Pas d'`updated_at`** sur éditions/ateliers/lots (présent sur les profils). Ajout trivial si le besoin de « dernière modif » émerge.
- **Statuts en `TEXT` libre** (comme `speaker_profiles.status`) plutôt qu'`ENUM`/`CHECK IN (...)`. Cohérent avec l'existant ; la validation des valeurs est portée par **Zod** côté action. Un `CHECK (statut IN (...))` reste une option de durcissement bon marché.

---

## 11. Verdict de l'audit

La conception **tient** et reste alignée sur les conceptions fonctionnelle/technique. L'audit a produit : **2 corrections intégrées au schéma/aux décisions** (suppression de compte RGPD §10.1, course édition `ouvert` §10.5), **1 hypothèse explicitée** (fuseau §10.3), **1 point tranché depuis** (réconciliation orga↔compte §10.2 → Phase A) et **1 à trancher** (durcissement intégrité §10.4), et un **lot de limites assumées** documentées (§10.6–10.10). Le **bloquant** (§10.1) impose un test de non-régression sur la suppression de compte dès la phase « socle DB ». Aucune révision des conceptions amont n'est nécessaire ; seule la conception technique §11 (RGPD) gagne à pointer §10.1.

---

## 12. Cycle de vie des comptes & suppression RGPD

> Exigences : **chaque personne a un compte** ; un compte n'implique **pas** une fiche annuaire (§1 décision 6) ; l'orga **suit** les inscriptions/désinscriptions (TSH + Tremplin) via le journal et le dashboard (§5) ; la **suppression de compte** doit rester propre quel que soit le moment (en plein Tremplin, animatrice assignée…).

### 12.1 Algorithme de suppression de compte (`deleteAccountAction`)

La zone danger existante supprime déjà le compte en cascade. On l'**étend** pour traiter les rattachements Tremplin **avant** le `DELETE FROM users`, **dans une transaction** :

1. **Inscriptions actives** (édition `ouvert`/`en_cours`/`clos`) → **supprimées** ; `logEvent('tremplin_desinscription', { editionId, cible })` ; **alerte orga** (e-mail + dashboard) si une finale/un podium approche.
2. **Inscriptions archivées** (palmarès, édition `archive`) → on **fige** `participante_nom`/`participante_linkedin` à partir de `users` **si** rétention justifiée (résultats déjà rendus publics), **sinon** on remplace par un libellé neutre (« Participante (compte supprimé) »). Évite la violation `CHECK` du `SET NULL` (§10.1).
3. **Animations** (`tremplin_atelier_animatrices`) → la cascade retire les liens ; pour chaque atelier **futur** ainsi laissé **sans animatrice** : `logEvent('atelier_sans_animatrice', …)` + **alerte orga** pour réassigner.
4. **Adhésion** (`memberships`) → supprimée ; `logEvent('adhesion_fin')`.
5. **Profil annuaire** (`speaker_profiles`) → cascade (rien à conserver : c'était public, la personne exerce son droit à l'effacement).
6. `logEvent('compte_supprime')` (anonyme : `userId` deviendra NULL juste après), puis `DELETE FROM users` → les `SET NULL` restants ne touchent que des lignes déjà conformes.

> **Pourquoi pas tout en cascade DB ?** Parce qu'il faut (a) éviter le piège `CHECK`/`SET NULL` (§10.1), (b) **journaliser** ces transitions pour le suivi orga, (c) **alerter** sur les trous opérationnels (atelier orphelin). Ces trois besoins imposent une orchestration applicative, pas de simples `ON DELETE`.

### 12.2 Matrice des cas

| Cas | Effet sur les données | Trace / alerte orga |
|---|---|---|
| **Candidate supprime son compte en plein Tremplin** | Inscription active **supprimée** ; présences associées cascadées | `tremplin_desinscription` au journal ; alerte si finale proche → l'orga ajuste le line-up |
| **Animatrice supprime son compte alors qu'elle doit animer** | Lien `tremplin_atelier_animatrices` retiré ; l'atelier peut se retrouver **sans animatrice** | `atelier_sans_animatrice` + alerte ; le dashboard liste les ateliers à réassigner |
| **Membre se désinscrit du Tremplin (sans supprimer le compte)** | Inscription supprimée ; compte et fiche annuaire **conservés** | `tremplin_desinscription` (avec `userId` → l'orga voit qui) |
| **Gagnante (édition passée) supprime son compte** | Palmarès **figé** en enregistrement (nom conservé si public, sinon neutralisé) | `compte_supprime` ; podium archivé préservé |
| **Compte sans fiche annuaire supprimé** | Aucun `speaker_profiles` à purger ; reste identique | journalisé comme les autres |
| **Adhésion expirée (cron)** | `memberships.status='expired'` → fiche annuaire masquée (logique Phase 1b) | `adhesion_fin` |

### 12.3 RGPD — garde-fous du journal

- `audit_events` **ne stocke aucune donnée personnelle directe** (pas d'e-mail, pas de nom) ; le nom n'apparaît que par **jointure** sur `users` **tant que le compte existe**. À la suppression, `userId`/`acteur_id` → NULL : l'événement subsiste comme **trace anonyme** (le suivi agrégé « X inscriptions / Y désinscriptions ce mois » reste possible, l'identification non).
- Le dashboard affiche le **présent** (qui est inscrite **maintenant**) à partir des tables vivantes, et un **journal anonymisable** pour l'historique : on satisfait le besoin de suivi **sans** créer un registre nominatif persistant.
- **Conservation** : pas de purge spécifique du journal en V1 (données déjà non nominatives) ; à inscrire au registre des traitements (conception technique §11).
- **Test de sécurité** : vérifier qu'aucune route/DTO n'expose `audit_events` côté public, et que `logEvent` refuse tout champ contenant un e-mail/nom (garde-fou de forme).

---

## 13. Objectif prioritaire — Espace ressources & résultats (Tremplin 1)

> **C'est la première chose livrée** (Phase A, §9). Objectif : chaque participante du Tremplin 1 se connecte et **retrouve ce qu'elle a eu** pendant le parcours, **et** son **retour individuel du jury** après la soirée.

### 13.1 Besoin

- **Documents partagés** (toutes les participantes acceptées) : supports des 5 ateliers, ressources communes.
- **Documents individuels & privés** (une seule participante) : **retour écrit du jury**, **vidéo de son pitch**, éventuel feedback nominatif. Donnée **personnelle sensible** → strictement privée (la participante + l'orga, jamais une autre participante).
- **Notes de la participante** : pendant la **prépa des sessions**, chaque participante écrit ses **notes / idées** dans l'éditeur (type `note`). Ce sont **ses** contenus : elle les CRUD ; ils utilisent le **même composant éditeur** réutilisable.
- Contexte : **12 inscrites**, 1-2 no-show, **8 finalistes** à la soirée, **3 gagnantes**. Cible documents : **les 8 finalistes** (retour jury + vidéo) ; extensible aux 12.

### 13.2 Modèle, accès & autorisation

- `tremplin_documents` (§2) : `registration_id` NULL = **partagé** ; renseigné = **individuel privé**. `auteur_id` = qui a écrit.
- **Compte requis** : la participante se connecte (lien magique), son compte est **rattaché** à son inscription (Lot A3, §1 décision 9). Un compte **sans fiche annuaire** suffit (§1 décision 6).
- **Un document = un lien OU du contenu texte** (§2, `lien`/`contenu`) : coller un **lien** (Drive/Doc/vidéo) et/ou **écrire le contenu** dans l'éditeur.
- **Matrice d'autorisation** (vérifiée côté Server Action) :

| Document | Lecture | Écriture |
|---|---|---|
| **Partagé** (`registration_id` NULL) | toutes les participantes acceptées de l'édition + orga | **orga** |
| **Retour jury / vidéo** (individuel, `auteur` orga) | **la** participante concernée + orga | **orga** (elle ne peut pas l'éditer) |
| **Note de prépa** (`type='note'`, `auteur` = la participante) | la participante (+ orga pour le coaching — *défaut à confirmer*) | **la participante** (CRUD sur ses notes) |

- **Lecture** (`src/lib/tremplin-documents.ts`) : `getSharedDocuments(editionId)`, `getMyDocuments(userId, editionId)`, `getMyNotes(userId, editionId)`. **Jamais** de fonction renvoyant les documents privés d'une autre personne. Écritures gardées par `tremplin-guards.ts` (ownership : on n'édite que ce dont on est `auteur`, sauf orga).

### 13.3 Écrans

- **Participante** : `/mon-espace/tremplin/[edition]` — « Le programme » (partagés) + « Mes documents » (retour jury, vidéo, lecture seule) + « **Mes notes** » (création/édition via l'éditeur). Contenu texte rendu en place ; liens en nouvel onglet (`sr-only`, RGAA).
- **Orga** : `/admin/tremplins/[edition]/documents` — déposer un document **partagé** ou **individuel** (lien et/ou éditeur). Rattacher une inscription à un compte (Lot A3).

### 13.4 Stockage des documents — *décision retenue : liens + éditeur texte*

Décidé avec l'orga : pas d'upload de fichiers en V1. Deux supports, combinables :

- **Lien** : URL Drive/Doc/vidéo. 0 € d'infra. Le lien n'est affiché qu'à la bonne participante connectée ; la confidentialité réelle dépend des réglages du Drive (à expliciter à l'orga).
- **Contenu texte** (éditeur) : on **colle/écrit** le contenu ; le texte est **stocké en base** (Postgres UE) et servi **derrière l'authentification** → meilleur contrôle d'accès qu'un lien, et idéal pour « coller le contenu envoyé aujourd'hui ».
- **Upload de fichiers** : **hors V1** (imposerait un stockage UE type Supabase Storage / S3 + URL signées). Documenté comme évolution si un vrai contrôle d'accès sur des fichiers binaires devient nécessaire.

#### Éditeur de texte — composant réutilisable

L'éditeur n'est **pas** spécifique au retour jury : il sert aussi aux **notes de prépa** des participantes (§13.1) et potentiellement ailleurs (descriptions d'atelier…). On en fait un **composant réutilisable** : `src/components/RichTextEditor.tsx` (saisie) + `Markdown.tsx` (rendu), API simple `value` / `onChange`.

**Choix de l'éditeur — décision : pas de nouvelle lib d'éditeur en V1.** Inventaire des dépendances : la stack contient `@radix-ui/*` (primitives a11y : dialog, dropdown — **pas** d'éditeur), `react`, `zod` ; **aucun éditeur riche ni renderer markdown**. Les formulaires existants (`ProfileForm`) sont **faits main** (composants contrôlés + Zod). On suit ce pattern :

- **Saisie** : `<textarea>` **natif contrôlé** (zéro dépendance), enveloppé dans `RichTextEditor` (label, `focus-visible`, aide `sr-only`, RGAA). Pas de WYSIWYG (TipTap / Lexical / Slate = lourd, injustifié pour du feedback et des notes).
- **Format stocké** : **markdown** (juste du texte, aucune dépendance pour stocker).
- **Rendu V1** : **texte échappé** en `white-space: pre-wrap` → **zéro dépendance, zéro risque XSS**, parfait pour « coller le contenu envoyé aujourd'hui ».
- **Évolution** (si mise en forme souhaitée) : rendre un **sous-ensemble markdown** (gras, listes, liens). Toute conversion markdown→HTML **impose une sanitisation** (lib à allowlist) ; on ne l'ajoute qu'au besoin réel, avec **test de sécurité dédié** (`<script>`, `javascript:`… jamais exécutés), valable contenu **orga** comme **participante**.

### 13.5 RGPD

- Le **retour jury individuel** est une donnée personnelle : accès **strictement** participante + orga, jamais exposé publiquement ni à une autre participante (test de sécurité dédié, Lot A4).
- **Contenu texte en base** : donnée personnelle hébergée en **UE** (Neon), accès **server-only** ; ne jamais le sérialiser dans un DTO public ni le mettre dans `audit_events`. Avantage RGPD vs lien : la suppression est **réellement effective** (DELETE en base), pas dépendante d'un Drive externe.
- En **liens** : ne pas indexer ; expliquer à l'orga que la maîtrise réelle dépend des réglages du Drive (un lien reste accessible hors plateforme).
- **Suppression de compte** : les documents **individuels** de la personne sont supprimés (cascade via `registration_id`, ou nettoyés par l'action §12) — le **contenu texte** disparaît avec ; les **liens** restent à révoquer côté Drive par l'orga (hors plateforme — à documenter).
