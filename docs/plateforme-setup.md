# Plateforme — comptes à créer & configuration

> Checklist pour Cateline / l'orga. Objectif : créer les comptes **gratuits** et
> renseigner les variables d'environnement. Une fois fait, je branche
> l'authentification et la base, puis on vérifie ensemble.
> Toutes les variables sont listées dans [`.env.example`](../.env.example).

Tout est **gratuit** (voir conception technique §16). Le seul coût existant est le domaine.

---

## 1. Base de données — Neon (5 min)

1. Créer un compte sur **https://neon.tech** (connexion possible avec GitHub/Google).
2. **New Project** → choisir la **région Europe** (ex. *Europe (Frankfurt)*).
3. Copier la **connection string** (format `postgresql://…?sslmode=require`).
   Remplacer `sslmode=require` par **`sslmode=verify-full`** (vérification
   complète du certificat ; sûr avec Neon, et compatible pg v9).
4. → variable **`DATABASE_URL`**.

## 2. Secret Auth.js (1 min)

- Générer un secret : dans un terminal `npx auth secret`, ou `openssl rand -base64 33`.
- → variable **`AUTH_SECRET`**.

## 3. Connexion Google (10 min)

1. **https://console.cloud.google.com** → créer un projet (ex. « Tech Speak'Her »).
2. *APIs & Services → OAuth consent screen* : type **External**, renseigner nom + e-mail support, publier.
3. *APIs & Services → Credentials → Create credentials → OAuth client ID* → type **Web application**.
4. **Authorized redirect URIs** :
   - `https://techspeakher.fr/api/auth/callback/google`
   - `http://localhost:3000/api/auth/callback/google` (pour le dev)
5. Copier l'ID et le secret → **`AUTH_GOOGLE_ID`**, **`AUTH_GOOGLE_SECRET`**.

## 4. Connexion LinkedIn (15 min, validation)

1. **https://www.linkedin.com/developers/apps** → **Create app** (rattachée à une Page LinkedIn ; on peut créer une Page « Tech Speak'Her »).
2. Onglet **Products** → ajouter **« Sign In with LinkedIn using OpenID Connect »** (gratuit ; activation quasi immédiate).
3. Onglet **Auth** → **Authorized redirect URLs** :
   - `https://techspeakher.fr/api/auth/callback/linkedin`
   - `http://localhost:3000/api/auth/callback/linkedin`
4. Copier le *Client ID* et le *Client Secret* → **`AUTH_LINKEDIN_ID`**, **`AUTH_LINKEDIN_SECRET`**.

## 5. Configuration Vercel (5 min)

1. Projet Vercel → **Settings → Environment Variables** : ajouter toutes les variables ci-dessus (cocher **Production** et **Preview**).
2. **Settings → Functions** : région **Paris (`cdg1`)** (proximité RGPD).
3. Conserver l'existant : `BREVO_API_KEY`, `REVALIDATE_SECRET`.
4. Le `GOOGLE_SHEET_ID` peut être retiré (le Sheet a été débranché).

---

## Ce qu'il me faut pour brancher

Quand les comptes sont créés, **renseigne les variables côté Vercel** (et envoie-moi un `.env.local` rempli **en privé**, jamais dans le repo / GitHub, pour tester en local si besoin).

⚠️ **Sécurité** : ne colle jamais une valeur de secret dans une issue, une PR, un commit ou un message public. Les secrets vivent uniquement dans Vercel (et ton `.env.local` local).

## Créer les tables dans Neon (une fois)

1. Dans Neon → **SQL Editor**.
2. Copie-colle le contenu de [`db/schema.sql`](../db/schema.sql) et exécute.
3. Ça crée les tables Auth.js (`users`, `accounts`, `sessions`, `verification_token`) et métier (`speaker_profiles`, `speaker_talks`, `user_memberships`, et le module `tremplin_*`). La base démarre **vide** (les comptes se créent à la 1ʳᵉ connexion).

## Déjà fait (côté code)

- ✅ Auth.js (Google + LinkedIn, sessions JWT) + `proxy.ts` (Next 16) qui protège `/mon-espace` et `/admin`.
- ✅ Accès base via `pg` + `@auth/pg-adapter` (persiste les comptes à la connexion).
- ✅ Pages `/connexion` et `/mon-espace` (minimale).

## Ensuite (côté code, moi)

1. CRUD profil + talks dans `/mon-espace`.
2. Annuaire public lu depuis la base.
3. Espace orga minimal (gestion manuelle de l'appartenance, en intérim sans HelloAsso).
4. Vérifier sur un preview, puis mettre en prod.

## Tester sur une preview Vercel

Une preview = le déploiement d'une **branche** (≠ la prod, qui vient de `main`).
Pièges rencontrés et réglages à faire **dans l'environnement Preview** :

1. **Les variables d'env ne s'appliquent qu'aux nouveaux builds.** Après en
   avoir ajouté/modifié une, il faut **rebuild la *preview*** (pas la prod) :
   *Deployments* → repérer le déploiement **Environnement = Preview** de la
   bonne **branche** → **… → Redeploy** ; ou pousser un commit sur la branche.
   Redéployer la **Production** ne change rien à la preview.
2. **Connexion Google sur preview** : le host de la preview n'est pas déclaré
   chez Google → `redirect_uri_mismatch`. Deux options :
   - **Simple/ponctuel** : ajouter l'URI exacte affichée dans l'erreur
     (`https://<preview>.vercel.app/api/auth/callback/google`) dans *Google
     Cloud Console → Credentials → Authorized redirect URIs*.
   - **Pérenne (toutes previews)** : variable **`AUTH_REDIRECT_PROXY_URL`** =
     `https://techspeakher.fr/api/auth` cochée **Preview** → les callbacks
     OAuth des previews passent par la prod (déjà autorisée chez Google).
     Conditions : **`AUTH_SECRET` identique** Preview ET Production, et
     **rebuild de la preview** après l'ajout. Vérif : le `redirect_uri` de
     l'erreur doit devenir `https://techspeakher.fr/...` ; tant qu'il montre le
     host `…vercel.app`, le proxy n'est pas pris (build pas à jour).
3. **Lien magique sur preview** : le bouton « Recevoir un lien » n'apparaît que
   si **`BREVO_API_KEY`** est présente (cochée **Preview**) — puis rebuild.
4. **Tables Tremplin** : exécuter les migrations Tremplin sur la base que pointe
   la preview (`010_tremplin.sql`, `011_rename_tables.sql`,
   `012_tremplin_edition_publique.sql`) — ou plus simplement `db/sync-to-latest.sql`
   (idempotent, inclut tout) — sinon les routes `/admin/tremplins`,
   `/mon-espace/tremplin/[edition]` et les pages d'édition publiques échouent.

> Rappel passwordless : se connecter **=** s'inscrire. La 1ʳᵉ connexion (Google,
> LinkedIn ou lien magique) **crée le compte**. Un compte n'implique pas une
> fiche annuaire : une participante Tremplin a un compte sans être speakeuse.
