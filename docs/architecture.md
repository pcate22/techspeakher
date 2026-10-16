# Architecture — Tech Speak'Her

Vue d'ensemble pour s'orienter vite. Détail produit/plateforme :
`docs/plateforme-conception-technique.md`. Migration de l'annuaire :
`docs/migration-speakeuses.md`.

## Stack

- **Next.js 16** (App Router, TypeScript) — server components par défaut.
- **Tailwind CSS v4** (`@theme inline` dans `globals.css`, tokens de couleur).
- **Auth.js v5** (NextAuth) + `@auth/pg-adapter`, sessions **JWT**.
- **Neon Postgres** (région UE), accès via `pg` (pool singleton, `src/lib/db.ts`).
- **Brevo** (e-mails transactionnels), **Vitest** + Testing Library, **Playwright** (E2E).
- Hébergement **Vercel** (deploy auto sur `main`, preview par PR).

## Structure

```
src/
├── app/            # Pages (App Router) + Server Actions (actions.ts par dossier)
│   ├── speakeuses/ # Annuaire public + fiche [id] + contact relais
│   ├── mon-espace/ # Espace membre (profil, talks, soumission, zone danger)
│   └── admin/      # Espace orga : tableau de bord, speakeuses/ (modération), tremplins/
├── components/     # UI réutilisable (Button, SpeakeuseCard, TalkCard, AccountMenu…)
├── lib/            # Logique métier + accès DB (profiles, talks, email, magic-link…)
├── constants/      # site.ts (URLs, e-mails), navigation.ts
├── data/           # Contenu statique (actualités, tremplin, charte…)
└── __tests__/      # Tests Vitest
db/                 # schema.sql, sync-to-latest.sql, migrations/
e2e/                # Tests Playwright
```

Règle : la logique DB et la validation vivent dans `src/lib/` ; les pages/actions
les appellent. Aucune donnée personnelle n'est committée (seeds livrés hors git).

## Rôles & authentification

Quatre rôles :

- **Visiteuse** (anonyme) : annuaire public, fiches publiées, formulaire de contact.
- **Membre** (speakeuse connectée) : son espace, sa fiche, ses talks.
- **Coach** (`users.is_coach`, cumulable) : ses ateliers d'accompagnement
  (`/mon-espace/coaching`).
- **Orga** : modération (champ `users.is_orga`, lu **à la connexion** → un nouvel
  orga doit se reconnecter pour que l'accès prenne effet).

La garde des routes privées vit dans **`src/proxy.ts`** (ex-middleware, Next 16),
qui applique la décision de `refusDAcces` (`src/auth.config.ts`) : non connectée
→ `/connexion` ; connectée sans `isOrga` sur `/admin` → `/mon-espace`. Seconde
ligne de défense dans chaque page/action : `src/lib/auth-guards.ts`.

Connexion (`src/auth.ts`, `src/auth.config.ts`) :
- **Google** et **LinkedIn** (OAuth), avec `allowDangerousEmailAccountLinking`
  (liaison par e-mail vérifié → on retombe sur le même compte).
- **Lien magique e-mail** (n'importe quel fournisseur), activé dès que
  `BREVO_API_KEY` est présent. Indispensable pour les speakeuses non-Google.

Pré-création d'un compte (migration) : on insère `users` + `speaker_profiles` ;
à sa 1re connexion **avec le même e-mail**, la speakeuse récupère sa fiche.

## Modèle de données (`db/schema.sql`)

- `users` — compte (nom, e-mail, image, `is_orga`). Tables Auth.js : `accounts`,
  `sessions`, `verification_token`. `accounts.email` (migration 074) garde
  l'adresse que Google ou LinkedIn donne à la connexion : Auth.js l'oublie, le
  rapprochement des adhésions en a besoin.
- `speaker_profiles` — 1 par compte (`userId` unique). Champs profil + :
  - `status` : `brouillon` → `en_attente` → `publie` | `refuse` | `masque` |
    `en_pause`. La speakeuse peut **retirer** sa fiche (`publie`/`en_attente`/
    `masque`/`en_pause` → `brouillon`) ; l'orga peut **mettre en retrait**
    (`publie` → `masque`). `en_pause` (migration 074) : hors annuaire faute
    d'adhésion, après un préavis daté (`annuaire_retrait_le`), derrière
    `FLAG_ADHESIONS` ; revient seule à `publie` dès l'adhésion.
  - `migrated` (fiche reprise de l'ancien annuaire) — cible les invitations,
    indépendamment du statut (les fiches migrées restent en `brouillon` invisible
    tant qu'elles ne sont pas soumises puis validées). `invited_at` (idempotence).
  - `contact_email_ok` (relais e-mail), `is_woman` (attestation, requise pour soumettre).
  - Audit modération : `submitted_at`, `validated_by`, `validated_at`, `refus_motif`.
  - `updated_at` (modif speakeuse) vs `validated_at` → détecte une modif post-validation.
  - `last_reminder_at` (anti-spam du cron de rappel).
- `speaker_talks` — talks liés au profil (`speaker_profile_id` ; titre, type,
  liens ; + colonnes legacy gelées que le code ne lit plus, migration 044)
  + `talk_occurrences` (chaque fois où le talk a été donné : conférence, date,
  lieu structuré BAN ; zéro occurrence = sujet proposé).
- `coach_profiles` — fiche coach (créditer une accompagnante sans l'enrôler dans
  l'annuaire ; `public` = consentement horodaté, défaut fermé).
- `user_memberships` — adhésions : copie de travail de HelloAsso pour les seuls
  comptes rapprochés (adresse du membre), `source` `helloasso` ou `manuel`
  (éditeur Neon). `status` ∈ `active`/`expired`, **liste fermée en base**
  (CHECK 073). `helloasso_item_id`, `relance_envoyee_le` (migration 074).
  Synchro : `src/lib/helloasso.ts` (client API), `src/lib/adhesions.ts`,
  `src/lib/passe-adhesions.ts` (cron de 17 h + `POST
  /api/helloasso/notification`). Conception :
  `docs/conception-adhesions-helloasso.md`.
- **Registre des conférences** : `conferences` (la marque ou l'asso),
  `conference_editions` (l'événement daté, + champs de moisson),
  `conference_propositions` (saisies membres, en file tant que non validées).
  Moissonneur : `cfp_events` (endpoints Sessionize), `talk_suggestions`
  (confirmées en un clic, consentement `cfp_sync_mode`).
- **Tremplin** — 15 tables. `tremplin_editions` : identité publique
  (`conf_slug`, `annee`), fenêtre d'inscriptions datée, `deleted_at`
  (tombstone), et `statut` ∈ `preparation` (défaut, **pivot de la visibilité
  publique** : en préparation = 404 public) / `ouvert` / `en_cours` / `clos` /
  `archive` — liste `EDITION_STATUTS` (`src/lib/tremplin-statut.ts`), fermée en
  base (CHECK 072). `tremplin_registrations` (`"userId"` nullable → saisie orga
  rattachée ensuite ; podium via `classement` + `titre_palmares` ; consentement
  de visibilité `public` + `public_consent_at`, décliné **par phase** dans
  `tremplin_registration_phases`). Ateliers : `tremplin_ateliers` (phase,
  nature, audience, programme public) avec `tremplin_atelier_membres`
  (participantes, présence tri-état) et `tremplin_atelier_coachs` (comptes
  coachs) — deux rôles, deux tables — plus sous-groupes et leurs coachs.
  `tremplin_registration_coachs` (coachs d'une participante),
  `tremplin_recompenses`, `tremplin_jury`, `tremplin_documents` (portée
  atelier / individuelle privée / générale ; lien **ou** contenu texte),
  `tremplin_photos` + `tremplin_photo_personnes` (droit à l'image, tags
  consentis), `tremplin_consent_log` (append-only). Historique de conception :
  `docs/tremplin-implementation.md` (**archive** — son bandeau dit ce qui a
  divergé).
- `contact_messages` — messages modérés du relais speakeuses
  (`en_attente`/`transmis`/`rejete`).
- `contenus` — éditorial ; `type` ∈ `publication` (« article » à l'écran,
  article = actualité) / `page` ; `fil_reactions` — applaudissements
  nominatifs du fil.
- `plateforme_reglages` (clé-valeur des seuls réglages modifiés, plus le
  bilan de la dernière relecture HelloAsso sous `adhesions_derniere_synchro`,
  que `getReglages` ignore),
  `seeds_appliques` (idempotence des seeds).

> Mise à niveau d'une base : `db/sync-to-latest.sql` (idempotent, **c'est lui
> qui est joué** — `scripts/migrate.mjs` au déploiement) ; `db/migrations/`
> (dernière : 073) est l'historique. Données : seed hors git.

## Parcours speakeuse

1. Connexion → **espace** (`/mon-espace`), tableau de bord guidé (checklist +
   barre de progression, `src/lib/espace.ts`).
2. **Profil** en assistant 4 étapes (`ProfileForm`) : Profil → Domaines →
   Contact → Attestation.
3. **Talks** : CRUD (création sur page dédiée, suppression confirmée).
4. **Soumission** à l'annuaire (`submitProfileAction`) : exige **un moyen de
   contact** (LinkedIn ou relais e-mail) **et** l'**attestation**. Garde-fous
   côté serveur (l'identité vient de la session, jamais du client).
5. **Retrait** (`withdrawProfileAction`) : la speakeuse retire sa fiche à tout
   moment (depuis `publie`/`en_attente`/`masque`) → retour en `brouillon`
   modifiable, à re-soumettre ensuite. CTA adapté au statut.

## Modération (orga)

- File à valider : `/admin` (`getPendingProfiles`) + liste des publiées
  (`getPublishedProfiles` : date/qui a validé, dernière modif).
- Décision **depuis la fiche** en vue orga (`ModerationPanel`) : **Publier**,
  **Refuser** avec **motif** (expliqué à la speakeuse), ou **Mettre en retrait**
  (`masque`, sans e-mail).
- `setProfileStatus` trace `validated_by`/`validated_at` ; ne touche pas
  `updated_at`. La speakeuse est notifiée par e-mail **uniquement sur vrai
  changement de statut** (pas de spam à la revalidation), si Brevo est configuré.
- **Invitations migration** : `/admin` → « Inviter N speakeuses »
  (`sendInvitationsAction`). Cible `migrated = true` jamais invitées
  (`getProfilesToInvite`), **idempotent** (`invited_at`), best-effort par
  destinataire ; les échecs sont **remontés à l'UI** (`?failed`/`?err`).

## Annuaire public

- `/speakeuses` (server, `force-dynamic`) lit les profils **publiés**
  (`getPublishedAnnuaire`) et les projette en **`PublicSpeaker`** (DTO : aucun
  champ interne — statut, validation, `userId`, e-mail — ne part vers le client).
- Filtres par secteur/sujet (tablist accessible, navigation clavier), cartes
  cliquables → fiche `/speakeuses/[id]`. Résilient : base indisponible → annuaire
  vide, pas de 500.
- **URL de fiche partageable (slug, façon LinkedIn)** : chaque fiche a un `slug`
  lisible « nom-prenom » (colonne `speaker_profiles.slug`, UNIQUE ; migration
  044, auto-généré depuis le nom, dé-doublonné). Le segment `[id]` accepte un id
  **ou** un slug (`getProfileByHandle`) ; arrivée par l'ancien id numérique →
  **redirection 307** vers le slug (temporaire, car le slug est modifiable :
  un 308 permanent resterait en cache navigateur après un changement de slug).
  Le SEO est consolidé par la balise `canonical` (toujours le slug). Toutes les surfaces publiques (annuaire, sitemap, JSON-LD Person,
  menu compte, e-mail de publication) lient via `speakeuseHref` (slug sinon id).
  La speakeuse personnalise son adresse depuis le formulaire profil (étape
  « Profil ») ; unicité vérifiée côté action (`isSlugAvailable`), l'index UNIQUE
  reste le filet. Même logique que les slugs contenus/conférences (jumeau SQL/TS
  de `slugify`).

## E-mails (`src/lib/email.ts`, `magic-link.ts`, `moderation-email.ts`)

Expéditeur : `contact@techspeakher.fr` (domaine validé Brevo). Tous gardés par
`BREVO_API_KEY`. Types : lien de connexion, message relais (fiche), contact
général, décision de modération, rappel 6 mois (cron), invitation migration,
préavis d'annuaire et relance d'adhésion (cron, derrière `FLAG_ADHESIONS`).
L'adresse de la speakeuse n'est **jamais** exposée (relais + reply-to).

> ⚠️ **Brevo bloque par IP par défaut** sur certains comptes (« IP autorisées »).
> L'hébergement serverless Vercel utilise des IP changeantes → tous les envois
> sont rejetés (401). **Désactiver** ce blocage côté Brevo (cf. `exploitation.md`).

## Sécurité & RGPD

- Hébergement **UE** (Neon). E-mail jamais affiché ; projeté hors du client via
  un DTO `PublicSpeaker` (annuaire) — aucune métadonnée interne sérialisée.
- Accès fiche non publiée : réservé orga/propriétaire (`notFound()` sinon).
- Server Actions : autorisation re-vérifiée serveur (`session.user.isOrga`,
  identité issue de la session), entrées validées (Zod, `src/lib/*-form.ts`),
  SQL **paramétré**. Attestation « être une femme » requise pour soumettre.
- Anti-abus : rate-limit du formulaire de contact et du lien magique
  (`src/lib/rate-limit.ts`).
- Anti-démarchage de `/api/contact` (`src/lib/anti-spam.ts`) : piège à robots
  (champ caché), délai de saisie minimal, puis score sur le contenu (vocabulaire
  de prospection, tarifs mensuels, nom dupliqué…). Il faut deux signaux forts
  pour écarter un message — un faux positif coûte un contact. Un message écarté
  reçoit la même réponse qu'un message envoyé, et les motifs partent dans les
  logs Vercel avec le seul **domaine** de l'expéditeur (`Message de contact
  écarté`).
- Cloudflare **Turnstile** sur le même formulaire (`src/lib/turnstile.ts`),
  **activé par l'environnement** : sans `TURNSTILE_SECRET_KEY`, aucune
  vérification et aucun script tiers chargé (dev, CI, previews). Échec **ouvert**
  si Cloudflare est injoignable — une panne chez eux couperait sinon le seul
  canal de contact. Mise en service : `docs/exploitation.md`.
- Droits RGPD : suppression du compte en self-service (zone danger → cascade) ;
  rappel de mise à jour tous les 6 mois ; détail dans `/mentions-legales`.
- Webhooks entrants (Brevo, HelloAsso) gardés par un jeton dans l'URL, comparé
  à temps constant (`secretValide`, `src/lib/cron-auth.ts`). La notification
  HelloAsso n'est pas signée : on n'en lit que l'identifiant de commande, et
  la commande est relue par l'API.
- Crons protégés par `CRON_SECRET` ; secrets uniquement en env, jamais dans le
  repo (`.env.example`). Données perso (e-mails de migration) livrées hors git.

## Accessibilité (RGAA)

Visée RGAA/WCAG AA : `focus-visible` partout, `aria-labelledby` sur les sections,
`role="alert"` pour les erreurs, `sr-only` pour le contexte (nouvelle fenêtre,
nombre de résultats), titres hiérarchisés, tablists navigables au clavier
(roving tabindex), divulgations `aria-expanded`/`aria-controls`. Détail et taux
de conformité : page `/mentions-legales`.

## UI & composants

Pas de kit UI stylé (MUI / PrimeReact / Ant…). On reste sur **Radix UI**
(primitives headless accessibles) **+ Tailwind v4** (tokens dans `globals.css`)
**+ composants maison** (`Button`, `SpeakeuseCard`…). C'est le pattern
shadcn/ui : on garde la maîtrise du markup, de la marque, du RGAA et du budget
Lighthouse. Si un besoin complexe arrive, on ajoute une **lib headless ciblée**
(ex. TanStack Table pour un tableau triable), jamais un kit global.

### Repères pour qui vient d'Angular

| Angular | Ici (React / Next 16) |
|---|---|
| Component (`.ts` + `.html`) | une fonction qui retourne du JSX (`src/components/*.tsx`) |
| Service `@Injectable` + DI | un module importé (`src/lib/*.ts`) |
| `HttpClient` → API REST | **Server Action** + accès DB `pg` (pas de REST à écrire) |
| Reactive Forms | inputs contrôlés + **Zod** |
| RxJS / Signals | `async/await` (serveur), `useState`/`useEffect` (client) |
| Angular Router | **routing par fichiers** (`app/.../page.tsx` = la route) |
| Guards `CanActivate` | `src/proxy.ts` (ex-middleware, Next 16) + vérifs dans les Server Actions |

> Piège n°1 : **Server vs Client Components**. Tout est rendu **serveur** par
> défaut (aucun JS envoyé) ; un composant n'est interactif (`useState`,
> `onClick`) que s'il porte `"use client"` en tête de fichier.

## SEO & performance

- **Visibilité** : fiches publiées **indexables** (`generateMetadata` par fiche :
  titre/description/canonical/OG, `noindex` si non publiée), **sitemap** dynamique
  incluant les fiches, **JSON-LD** `Person`. Annuaire indexable.
- **Perf DB** : index sur `speaker_talks(speaker_profile_id)`, `speaker_profiles(status)`,
  `users(name)` ; pool `pg` singleton borné (serverless + endpoint *pooler* Neon).
  Pages connectées en `force-dynamic`, résilientes si la base est indisponible.

## Tests

**TDD** : tests avant code. `npm run test` (Vitest : unitaires, composants,
**Server Actions** — garde-fous d'autorisation/attestation/joignabilité),
`npm run type-check`, `npm run lint`, `npx playwright test` (E2E). La CI joue
tout ; rien ne merge en rouge. L'E2E annuaire est agnostique aux données (pas de
base en CI) — le filtrage/les cartes sont couverts en unitaire. Couverture clé :
modération, soumission, relais contact, projection publique, anti-abus, SEO.

## Commandes

```bash
npm run dev          # Dev local
npm run build        # Build prod
npm run test         # Vitest
npm run type-check   # TypeScript
npm run lint         # ESLint
npx playwright test  # E2E
```
