# Plateforme Tech Speak'Her — Conception technique

> **Statut** : v5 — Phase 1a livrée. Pile : **Neon + node-postgres (`pg`) + Auth.js (JWT) + région UE** ; Google + LinkedIn **+ lien magique** (actif). HelloAsso reporté. Coûts **0 €** (§16).
> ⚠️ **Document de conception (le *comment* visé).** Source de vérité de
> l'implémentation : `docs/architecture.md`. Écarts livrés depuis la rédaction :
> le **lien magique est actif** (pas reporté) ; l'annuaire **a été pré-alimenté**
> par migration (fiches `migrated = true` en `brouillon`), il ne « repart » donc
> pas tout à fait « de 0 ».
> Note : Prisma 7 (initialement envisagé) impose un driver adapter et n'était pas vérifiable dans l'environnement de dev → on part sur `pg` + `@auth/pg-adapter`, plus léger et vérifiable ; Prisma reste une option future.
> **Prérequis** : lire d'abord la [conception fonctionnelle](./plateforme-conception-fonctionnelle.md) (le *quoi*). Ce document décrit le *comment*.
> ⚠️ Next.js 16 introduit des breaking changes : au moment d'implémenter, se référer à la doc embarquée (`node_modules/next/dist/docs/`) avant d'écrire du code.

---

## 1. Objectifs techniques

Transformer le site statique actuel (Next.js 16 / Vercel, contenu en `src/data/`) en application avec :
- comptes membres + **authentification** (liens magiques),
- **données personnelles** stockées de façon **sécurisée et hors du dépôt** (le dépôt, lui, est public),
- intégration **HelloAsso** pour le statut d'adhésion,
- conformité **RGPD** (asso loi 1901, hébergement UE).

Principe directeur : **le code est public, les données ne le sont jamais.**

---

## 2. Vue d'ensemble de l'architecture

```
                    ┌─────────────────────────── Vercel (région UE) ───────────────────────────┐
                    │                                                                            │
   Visiteur ──────► │  Next.js 16 (App Router)                                                   │
   Membre   ──────► │   ├─ Pages publiques (statiques)        ◄── src/data/ (éditorial, en code)│
   Orga     ──────► │   ├─ Espace membre / admin (dynamiques) ──┐                                │
                    │   ├─ Server Actions / Route Handlers       │                               │
                    │   └─ Auth.js v5 (middleware + sessions)    │                               │
                    └────────────────────────────────────────────┼───────────────────────────────┘
                                                                  │ (server-only)
                          ┌───────────────────────────┬──────────┴───────────┬───────────────────┐
                          ▼                            ▼                      ▼                   ▼
                 Postgres managé (UE)            Brevo (emails)       HelloAsso API v5      (Vercel Cron)
                 données membres + Tremplin    magic links + notifs   adhésions/webhook    réconciliation
```

- **Contenu éditorial** (pages, FAQ, actus, speakeuses « vitrine ») : reste en `src/data/` (déjà en place), versionné.
- **Données membres / Tremplin** : en **base Postgres**, jamais dans le dépôt.
- **Accès aux données** : exclusivement **côté serveur** (Server Components, Server Actions, Route Handlers). Aucun secret ni requête DB côté navigateur.

---

## 3. Stack technique recommandée

| Brique | Recommandation | Pourquoi | Alternative |
|---|---|---|---|
| Framework | **Next.js 16** (déjà là) | full-stack, App Router | — |
| Hébergement app | **Vercel**, région **UE** (`fra1`/`cdg1`) | déjà en place, RGPD | — |
| Base de données | **Postgres managé en UE** — **Neon** | serverless, région UE, gratuit généreux, branche par PR | Supabase (Postgres + RLS + storage), Vercel Postgres |
| Accès BDD | **node-postgres (`pg`)** + adapter Auth.js **`@auth/pg-adapter`** ; schéma en SQL (`db/schema.sql`) | léger, transparent, vérifiable en local | Prisma (typage/migrations, plus tard), Drizzle |
| Auth | **Auth.js v5** — **Google + LinkedIn** (OAuth, **gratuit**) ; lien magique **plus tard** | gratuit, pertinent (LinkedIn), dans notre code (peu de lock-in) | Supabase Auth, Clerk (proprio) |
| Envoi d'e-mails | **Brevo** (déjà dépendance `@getbrevo/brevo`, utilisé par `/contact`) | réutilisation, société FR/UE | Resend, SMTP |
| Validation | **Zod** | valide formulaires + entrées serveur | — |
| Intégration adhésions | **Plus tard** : API HelloAsso v5 + webhook (nécessite un compte bancaire) | source de vérité des adhésions, à terme | **saisie manuelle orga (intérim, au lancement)** |

> Choix « code lisible » et budget asso : Auth.js (gratuit, dans le code) + Neon/Supabase (gratuit, UE) + Brevo (déjà là). Pas de SaaS d'auth propriétaire.

---

## 4. Authentification (Auth.js v5)

- **Au lancement (gratuit)** : **« Se connecter avec Google »** et **« Se connecter avec LinkedIn »** (OAuth / OpenID Connect). LinkedIn est particulièrement pertinent pour des femmes de la tech.
- **Plus tard** : **lien magique par e-mail** (secours, ou pour qui n'a ni Google ni LinkedIn).
- **Multi-providers** : Auth.js gère Google + LinkedIn en parallèle, avec **liaison de comptes** par e-mail.
- **Adapter base (`@auth/pg-adapter` + `pg`)** : pour persister comptes/sessions (`users`, `accounts`, `sessions` ; `verification_token` quand le lien magique sera ajouté). Les providers OAuth peuvent tourner en JWT sans adapter, mais on garde l'adapter pour unifier les comptes en base. Schéma SQL dans `db/schema.sql`.
- **E-mail récupéré** : Google fournit un e-mail **vérifié** ; LinkedIn (OIDC) fournit l'e-mail → sert au **rapprochement avec l'adhésion HelloAsso**.
- **Setup (gratuit)** : app OAuth **Google** (Google Cloud Console) + app **LinkedIn** (LinkedIn Developers, produit « Sign In with LinkedIn », validation gratuite). Secrets en env : `AUTH_GOOGLE_ID/SECRET`, `AUTH_LINKEDIN_ID/SECRET`, `AUTH_SECRET`.
- **Envoi d'e-mails** (notifs + lien magique optionnel) : via **Brevo** (déjà dans le repo).
- **Config v5** : `auth.config.ts` (commun) + `auth.ts` (adapter + providers). Variables d'env préfixées **`AUTH_`**.
- **Sécurité** : CSRF + cookies sécurisés (Auth.js) ; rate-limiting si le lien magique est activé.

---

## 5. Autorisation et rôles (RBAC)

Trois niveaux de droits posés sur un même compte (cf. conception fonctionnelle §2) :

| Rôle | Comment il est déterminé |
|---|---|
| **Membre** | tout compte connecté **adhérent à jour** |
| **Animatrice** | membre rattachée à ≥ 1 atelier (`atelier_animatrices`) |
| **Orga** | drapeau `users.is_orga = true` (attribué manuellement au départ) |

- **Protection des routes** : `middleware.ts` (Auth.js) protège `/mon-espace/**` (connecté) et `/admin/**` (orga).
- **Contrôles fins (ownership)** : une animatrice n'agit que sur **ses** ateliers ; une membre n'édite que **son** profil → vérifs côté Server Action (l'identité vient de la session, jamais d'un paramètre client).
- **Annuaire public** : ne renvoie que les profils `publié` **et** adhésion à jour.

---

## 6. Base de données — schéma

Tables dérivées du modèle fonctionnel (noms indicatifs) :

**Comptes & auth**
- `users` : id, email (unique), prenom, nom, telephone (nullable), is_orga (bool), emailVerified, created_at
- `accounts`, `sessions`, `verification_tokens` : tables Auth.js standard
- `memberships` : id, user_id, source (`helloasso`/`manuel`), started_at, **expires_at**, status (`active`/`expired`), helloasso_order_id (nullable)

**Annuaire speakeuses**
- `speaker_profiles` : id, user_id (1‑1), role_title, entreprise, bio, website, linkedin, instagram, tags (text[]), **status** (`brouillon`/`en_attente`/`publie`/`refuse`/`masque`), **migrated** (bool, fiche reprise de l'annuaire → cible les invitations), **invited_at**, published_at, **moderation_notified_at** (nullable — jalon du digest : décision de modération déjà annoncée à la speakeuse ; cf. §8)
- `talks` : id, profile_id, titre, evenement (nullable), date (nullable), description (nullable), lien (nullable)
- `contact_messages` : id, profile_id (FK `speaker_profiles` **ON DELETE CASCADE**), **reason** (`conference`/`jury`/`interview`/`autre`), sender_name, sender_email, body, **status** (`en_attente`/`transmis`/`rejete`, défaut `en_attente`), created_at, moderated_by (FK `users`, nullable), moderated_at (nullable), **notified_at** (nullable — jalon du digest speakeuse). *Contact modéré : chaque message est mis en file puis transmis/rejeté par une orga (cf. fonctionnel §3.6). Index utiles : `(status)` pour la file, `(profile_id, status)` pour la vue « Mes messages ».*

**Tremplin**
- `tremplin_editions` : id, nom, annee, **statut** (`ouvert`/`en_cours`/`clos`/`archive`), description, **conf_nom**, **conf_date**, **conf_lien**
- `tremplin_registrations` : id, edition_id, user_id, statut (`en_attente`/`acceptee`/`refusee`), sujet, created_at, **finale_presente** (bool, nullable)
- `ateliers` : id, edition_id, ordre, titre, date, **heure_debut**, **heure_fin**, description, lien_visio, lien_support
- `atelier_animatrices` : atelier_id, user_id  *(n‑n → plusieurs animatrices/atelier)*
- `atelier_presences` *(optionnel)* : atelier_id, registration_id, statut (`presente`/`absente`/`excusee`)
- `podium` : edition_id, registration_id, rang (1 = gagnante), titre_talk
- `lots` : id, edition_id, libelle, rang (nullable), partenaire (nullable), statut (`a_attribuer`/`attribue`/`remis`), attribue_a (registration_id, nullable), remis_le (nullable)

> Présence atelier en table séparée et **optionnelle** → permet le rattrapage d'une édition passée sans appel (cf. fonctionnel §4.5).

---

## 7. Intégration HelloAsso (statut d'adhésion) — *phase ultérieure*

> ⏳ **Reporté.** Tant que l'association n'a **pas de compte bancaire**, HelloAsso ne peut pas gérer les inscriptions (même à 0 €). **Au lancement, l'appartenance est gérée à la main par l'orga** (`/admin/membres`) : les premières membres seront les **gagnantes du Tremplin** qui créent leur espace. La section ci-dessous décrit la **cible**, à brancher quand le compte bancaire et l'accès API existeront.

L'adhésion (gratuite, 1 an) sera gérée sur **HelloAsso** via une **campagne d'adhésion**. La plateforme apprendra alors le statut par **trois canaux complémentaires** :

1. **Webhook** (principal) : HelloAsso notifie les événements **Order/Payment**. Une adhésion (même à 0 €) crée un *Order* → notre Route Handler `/api/helloasso/webhook` reçoit l'événement, **rapproche par e-mail**, crée/renouvelle `memberships` avec `expires_at = +1 an`.
2. **Réconciliation périodique** (filet) : un **Vercel Cron** appelle l'API v5 (OAuth2 `client_credentials`, token 30 min) pour lister les adhérent·es et corriger les écarts (webhook manqué).
3. **Saisie manuelle** (secours) : l'orga peut marquer une adhésion dans `/admin/membres` (cas limites).

- **Auth technique** : `POST https://api.helloasso.com/oauth2/token`, secrets `HELLOASSO_CLIENT_ID` / `HELLOASSO_CLIENT_SECRET` en env.
- **Accès API** : nécessite des clés (programme partenaire / clés d'organisation) — *à demander à HelloAsso*.
- **Expiration** : un job quotidien passe les adhésions échues en `expired` → la fiche est **masquée** automatiquement ; relances par e-mail avant l'échéance (cf. fonctionnel).
- **Rapprochement compte ↔ adhésion** : par **e-mail** (l'e-mail de connexion = e-mail HelloAsso). Gérer le cas « e-mails différents » côté orga.

---

## 8. E-mails (Brevo, déjà en place)

Réutilisation de **Brevo** (`@getbrevo/brevo`, déjà utilisé par `/api/contact`).
Offre Free = **300 e-mails/jour** (large) ; on **groupe** malgré tout les
notifications par cron (choix produit anti-spam, cf. fonctionnel §8).

**Transactionnel (immédiat)**
- lien magique de connexion — **seul** e-mail par événement, jamais groupé.

**Notifications**
- **Message transmis → e-mail immédiat.** `moderateContactMessageAction` envoie
  l'e-mail à la speakeuse (extrait seulement) **dès la transmission**, puis pose
  `notified_at`. Best-effort : si l'envoi échoue, `notified_at` reste NULL.
- **Décision de modération de profil** : e-mail immédiat (`moderateProfileAction`).
  Le quota Brevo réel (300/jour) permet l'immédiat. `moderation_notified_at`
  reste **réservée** (non câblée).
- **Cron quotidien 17h** (gardé par `CRON_SECRET`, rien si vide) : (a) rappels
  6 mois, (b) **digest orga** vers `techspeakher@gmail.com` — fiches à valider
  (`countPendingProfiles`) + messages `en_attente` (`countPendingContactMessages`),
  (c) **filet** : renvoie les messages `transmis` restés `notified_at IS NULL`
  (envoi immédiat échoué).

> ⚠️ **Contrainte crons Vercel Hobby : 2 jobs max, 1×/jour** (cf. §16). `vercel.json`
> en a **déjà 2** (`reminders` 9h, `sync-talks` 7h) → **on ne peut pas ajouter un
> 3e cron**. Parade retenue : **absorber les digests dans le cron `reminders`
> existant**, transformé en **cron de notifications quotidien à 17h** (rappels
> 6 mois + digest orga + digests speakeuses). `sync-talks` reste à part → total
> inchangé (2 crons). Corps des e-mails en fonctions pures testables (comme
> `buildModerationEmail`).

**Suivi des notifications (pour ne pas re-notifier)**
- Messages : colonne `contact_messages.notified_at` (posée à l'envoi immédiat ou,
  à défaut, par le filet du cron).
- `speaker_profiles.moderation_notified_at` : colonne **réservée** (la décision de
  profil part en immédiat, pas via un digest — à câbler seulement si on regroupe
  un jour ces notifs).

---

## 9. Fichiers et supports d'atelier

Les supports et visios sont des **liens** (Google Meet, slides, docs) → **aucun stockage de fichiers** nécessaire en V1 (juste des URL en base). Si un jour on héberge des fichiers, prévoir un stockage UE (ex. Supabase Storage / S3 UE) — hors périmètre pour l'instant.

---

## 10. Sécurité & code public

> Mise à jour du **2026-08-23** : le dépôt reste **public**, mais sous licence
> **propriétaire** (`LICENSE`) — les contributions sont accueillies, la
> réutilisation demande une autorisation écrite. Le principe ci-dessous est
> inchangé : le code se lit, les données jamais.

- **Secrets** uniquement en **variables d'env Vercel** : `AUTH_SECRET`, `DATABASE_URL`, `HELLOASSO_CLIENT_ID/SECRET`, `BREVO_API_KEY`, `REVALIDATE_SECRET` (existant)…
- **`.env.example`** dans le repo : documente les **noms** des variables, **jamais les valeurs**.
- **Aucune donnée personnelle dans le dépôt** (le seed initial n'utilise que des données déjà publiques).
- **Accès DB server-only** ; validation **Zod** systématique des entrées ; autorisation vérifiée à partir de la **session**, pas d'un paramètre client.
- **Auth.js** : CSRF + cookies sécurisés intégrés ; **rate-limit** sur les liens magiques.
- **Webhook HelloAsso** : vérifier l'origine/signature, route idempotente.
- Si Supabase est choisi : activer **RLS** (politiques par utilisateur) en complément.

---

## 11. RGPD (asso loi 1901)

- **Hébergement UE** : app Vercel région UE, **base en UE** (Neon/Supabase EU), Brevo (FR), HelloAsso (FR).
- **Sous-traitants & DPA** à recenser/signer : Vercel, Neon/Supabase, Brevo, HelloAsso.
- **Minimisation** : ne stocker que l'utile (téléphone **facultatif**).
- **Consentement** : case explicite à la **publication** du profil ; **politique de confidentialité** + mentions légales (page `/mentions-legales` existe déjà).
  - 🔁 **Évolution Tremplin (Phase 2b)** : sur les **pages d'édition publiques** pilotées par la BDD, une finaliste/gagnante n'est **nommée** (nom, bio, sujet, portrait) **que si elle a consenti** (opt-in `public`, horodaté `public_consent_at`) ; les **photos de groupe** ne sont publiées que si **toutes** les personnes dessus consentent (inventaire). Retrait et **droit à l'image** gérés (cf. [`tremplin-edition-publique.md`](./tremplin-edition-publique.md)). Les **compteurs** d'édition restent **anonymes**.
- **Droits des personnes** : accès & rectification en **self-service** (`/mon-espace`), **suppression** du compte, **export** (portabilité), opposition.
- **Conservation** : profil tant qu'adhérente (+ délai) ; données Tremplin archivées ; purge des comptes inactifs.
- **Messages de contact** (`contact_messages`) : contiennent des données perso
  d'un **tiers** (nom + e-mail de l'expéditeur). **Historique conservé**
  (transmis *et* rejetés) pour l'audit et la détection de récidive — finalité
  **sécurité / safe place**, base légale **intérêt légitime**. À documenter dans
  la **politique de confidentialité / mentions légales**. Suppression du compte
  speakeuse → cascade (`ON DELETE CASCADE`) efface ses messages. Prévoir une purge
  au long cours si l'historique gonfle (non urgent au volume d'une asso).
  - ⚠️ La **suppression de compte** doit composer avec les **inscriptions Tremplin** (un palmarès archivé est conservé) : interaction technique et stratégie détaillées dans [`tremplin-implementation.md`](./tremplin-implementation.md) §10.1.
- **Registre des traitements** à tenir.

---

## 12. Migration des données existantes

- **Annuaire speakeuses → repart de 0.** Avec les nouvelles règles, l'annuaire de la plateforme **démarre vide** : **pas de migration en masse** des fiches actuelles. Il se remplit quand les membres créent **elles-mêmes** leur espace (en commençant par les **gagnantes du Tremplin**), qui y rattachent leur site web, leurs mentions et leurs talks — et gèrent ainsi leurs propres données.
  - L'annuaire **statique actuel** (`speakeuses.ts` — jamais versionné, données personnelles hors git ; l'annuaire est **branché sur la base** depuis) restait la vitrine **en attendant**.
- **Tremplin 1 (DevFest 2026)** → en phase Tremplin, créé en édition **`archive`** à partir des données existantes (`src/data/tremplin.ts`) : participantes, **podium** (`resultats`), **lots** (`prix`), finale — **sans présence atelier** (rattrapage). (Ce sont des **enregistrements** saisis par l'orga, pas des comptes membres.)
  - 🔁 **Phase 2b** : une fois les **pages d'édition pilotées par la BDD**, ces données (`participantes`/`resultats`/`prix` de `src/data/tremplin.ts`) deviennent **redondantes** et sont **retirées** → la base devient la **source unique**. La page **vitrine** `/tremplin`, elle, reste statique. Détail : [`tremplin-edition-publique.md`](./tremplin-edition-publique.md).

---

## 13. Découpage technique par phase

- **Phase 1a — Socle + espace speakeuses** *(0 €, sans HelloAsso ni lien magique)*
  Base Postgres Neon (UE) + `pg` · Auth.js **Google + LinkedIn** · CRUD profil + talks · **annuaire qui repart de 0**, alimenté par les membres · **appartenance gérée à la main par l'orga** (intérim) · 1ᵉˢ comptes = gagnantes du Tremplin.
- **Phase 1b — Adhésion & conformité** *(quand compte bancaire + API)*
  Intégration **HelloAsso** (webhook + cron + gating automatique) · masquage auto à expiration + relances · **lien magique** en complément · durcissement RGPD (consentement, droits, DPA) · rate-limiting.
- **Phase 2 — Module Tremplin**
  Éditions (conférence majeure) · inscriptions · ateliers (horaires + animatrices multiples) · présences ateliers + **finale** · **podium/gagnante** · **lots & suivi** · rattrapage Tremplin 1.
  → conception d'implémentation détaillée (schéma SQL, libs, Server Actions, écrans, tests, phasage) : [`docs/tremplin-implementation.md`](./tremplin-implementation.md).

---

## 14. Décisions techniques

**Tranché**
- **Connexion** : **Google + LinkedIn** au lancement ; **lien magique plus tard**.
- **HelloAsso** : **reporté** (pas de compte bancaire) ; appartenance **gérée à la main par l'orga** en intérim.
- **Annuaire** : **repart de 0**, **pas de migration** des fiches actuelles (les membres créent leur espace, à commencer par les gagnantes du Tremplin).

- **Base de données** : **Neon** (Postgres serverless, région UE) — auto-reprise après veille, branches par PR, faible lock-in.
- **Accès BDD** : **`pg` (node-postgres) + `@auth/pg-adapter`**, schéma en SQL (`db/schema.sql`). Vérifiable en local ; Prisma envisageable plus tard.
- **Sessions** : **JWT** au lancement (sessions en base plus tard si révocation à distance nécessaire).
- **Région Vercel** : **Paris (`cdg1`)** pour les fonctions serveur.

---

## 15. Prochaines étapes

1. Valider la stack (§3), les coûts (§16) et les décisions à valider (§14) avec scraly.
2. Créer les **apps OAuth Google + LinkedIn** (gratuit).
3. Démarrer la **Phase 1a** (socle + espace speakeuses, annuaire vide) sur une base UE.
4. *(Plus tard)* Compte bancaire → **adhésion HelloAsso** + API, puis lien magique.

---

## 16. Coûts (objectif 0 €)

Tout le nécessaire existe en **offre gratuite**. Objectif **0 €/an de nouvelle infra**.

| Service | Rôle | Plan | Coût |
|---|---|---|---|
| Vercel | hébergement app | Hobby | **0 €** |
| Neon | base Postgres (UE) | Free | **0 €** |
| Auth.js | authentification | open source | **0 €** |
| Google OAuth | connexion Google | — | **0 €** |
| LinkedIn OAuth | connexion LinkedIn | — | **0 €** |
| Brevo | e-mails transactionnels | Free (300/jour) | **0 €** |
| HelloAsso | adhésions | gratuit pour les assos | **0 €** |
| Domaine `techspeakher.fr` | nom de domaine | déjà payé | ~12 €/an (existant) |

**Limites du gratuit à garder en tête :**
- **Vercel Hobby** : usage non commercial (OK pour une asso) ; **cron limité à 1×/jour** (suffit pour la réconciliation/expiration HelloAsso) ; **déploiements bloqués pour les commits dont l'auteur n'est pas dans l'équipe Vercel** (déjà rencontré) → avec des contributions externes, ajouter les contributrices à l'équipe Vercel ou laisser l'orga merger. Bascule éventuelle **Vercel Pro ~20 $/mois** si besoin.
- **Neon free** : mise en veille de la base si inactive (légère latence au réveil) — négligeable au volume d'une asso.
- **Brevo free** : 300 e-mails/jour — large pour des connexions + notifications.
- **LinkedIn** : validation (gratuite) de l'app développeur à prévoir.

> Si la volumétrie grossit (beaucoup de membres/e-mails), les premiers paliers payants restent modestes (Brevo, Neon) ; rien d'obligatoire au lancement.

---

## 17. Stratégie de tests

Le projet a déjà une forte culture de tests (Vitest + Testing Library, Playwright e2e, Lighthouse, audit sécurité en CI). On l'étend à la plateforme, **par niveau** :

| Niveau | Outil | Quoi | Statut |
|---|---|---|---|
| **Unitaire** | Vitest | logique pure : protection des routes (`authConfig.authorized`), validations (Zod à venir), helpers de requêtes SQL (assertions SQL + params via pool mocké) | ✅ `auth-authorized.test.ts` |
| **Composant** | Testing Library | pages & formulaires : `/connexion`, `/mon-espace` (mock `auth()` : redirige si déconnectée, affiche le profil sinon), formulaire profil (erreurs `role="alert"`, RGAA) | ✅ `connexion.test.tsx` (reste à venir) |
| **Intégration BDD** | Vitest | fonctions d'accès (profil/talks/adhésion) : pool `pg` mocké (vérifie requêtes + mapping), et/ou Postgres éphémère en CI | à venir avec le CRUD |
| **Bout-en-bout** | Playwright | annuaire public (lecture, sans auth) faisable ; parcours connecté → OAuth réelle difficile en e2e, donc provider de test gated en env de test ou mock (étape ultérieure) | à venir |
| **Sécurité / garde-fous** | Vitest | routes privées qui redirigent (✅) ; **données privées jamais rendues côté public** (email/tél) ; server actions qui vérifient l'**ownership** (une animatrice n'agit que sur ses ateliers, une membre que sur son profil) | au fil des features |
| **Contact modéré** | Vitest | envoi → message `en_attente` **sans** e-mail immédiat ; garde orga sur transmettre/rejeter ; rejet **ne transmet pas** ; joignabilité (`contact_email_ok`) ; motif dans la liste (Zod) ; rate-limit ; digests **vides = aucun e-mail** ; extrait seulement dans le digest speakeuse | à venir (TDD) |

**Règles**
- **TDD** : pour chaque nouvelle feature, on écrit les tests **avant** le code (rouge → vert → refactor).
- Chaque feature livrée vient avec ses tests (unité + composant ; + intégration si elle touche la base).
- On **garde verts** les suites existantes (data-integrity, french-spelling, navigation, accessibilité) + Lighthouse.
- La CI joue tout à chaque PR (Lint & Type-check, Tests unitaires, E2E, Lighthouse, Security audit) → rien ne merge en rouge.

**Déjà en place** : `src/__tests__/auth-authorized.test.ts` (protection des routes) et `src/__tests__/connexion.test.tsx` (page de connexion). Suite à **184 tests** verts.
