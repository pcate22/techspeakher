# Tech Speak'Her

Site web et plateforme de **Tech Speak'Her**, communauté de femmes de la tech à
Toulouse qui encourage la prise de parole en conférence. Nos deux premiers
meetups ont été organisés avec GDG Toulouse.

La plateforme gère l'annuaire public de speakeuses, les profils et talks, et un
module **Tremplin** : un dispositif d'accompagnement (ateliers, coaching, jury,
récompenses) pour aider des femmes à faire leur première conférence.

- **Licence du code** : [propriétaire](#licence), code visible et contributions
  bienvenues, réutilisation sur autorisation écrite.
- **Marque** : le nom « Tech Speak'Her » et le logo sont protégés, voir
  [`TRADEMARK.md`](./TRADEMARK.md).
- **Prod** : [techspeakher.fr](https://techspeakher.fr) (Vercel, déploiement auto sur `main`).

---

## Réutiliser ce code ?

Le dépôt est public pour qu'on puisse le lire, en discuter et y contribuer. Il
n'est pas sous licence libre : déployer la plateforme, en reprendre une partie
dans un autre projet ou garder un fork actif demande notre **autorisation
écrite** (voir [`LICENSE`](./LICENSE)).

Une autre communauté de femmes de la tech veut monter son tremplin, une école
veut s'en servir en cours, une entreprise veut l'héberger : écrivez à
**techspeakher@gmail.com**. Nous étudions les demandes au cas par cas.

Le nom et le logo suivent leur propre régime, plus strict encore :
[`TRADEMARK.md`](./TRADEMARK.md).

---

## Stack

- **Next.js 16** (App Router, TypeScript), **Tailwind CSS v4** (`@theme inline`)
- **Auth.js v5** (Google / LinkedIn / lien magique) + **Postgres Neon** (région UE), `pg`
- **Brevo** (e-mails transactionnels), **Radix UI** (composants accessibles)
- **Vitest** + Testing Library (unit/compo), **Playwright** (E2E), **Fuse.js** (recherche)

> ⚠️ Ce dépôt utilise Next.js 16, qui comporte des changements cassants par
> rapport aux versions antérieures. Lisez le guide concerné dans
> `node_modules/next/dist/docs/` avant d'écrire du code (voir [`AGENTS.md`](./AGENTS.md)).

## Démarrage rapide

Nouvelle venue ? Commencez par [`docs/README.md`](./docs/README.md) : où est
quoi, quoi lire en premier, et le glossaire du métier.

**Les tests** se lancent sans rien configurer :

```bash
npm install
npm run test
```

**Le site, avec des données fictives**, demande un Postgres sur votre machine
(Homebrew, Postgres.app ; avec Docker, mettez l'utilisateur et le mot de
passe du conteneur dans l'adresse) :

```bash
# 1. Une base vide
createdb tsh_local

# 2. Les tables et le décor (des personnes inventées)
DATABASE_URL="postgres://localhost:5432/tsh_local" npm run e2e:db

# 3. Les variables d'environnement
cp .env.example .env.local
#    puis, dans .env.local :
#    DATABASE_URL="postgres://localhost:5432/tsh_local"
#    AUTH_SECRET="…"   (à générer : openssl rand -base64 33)

# 4. Lancer en dev
npm run dev                  # http://localhost:3000
```

Sur Mac, si Postgres refuse de démarrer avec « le postmaster est devenu
multithreadé », lancez-le avec `LC_ALL=fr_FR.UTF-8` (ou `en_US.UTF-8`).

Pour **se connecter** (espace membre, admin), il faut configurer Google ou
LinkedIn pour `localhost`, ou une clé Brevo pour le lien magique. Pour
l'admin, passez ensuite votre compte en orga :
`UPDATE users SET is_orga = true WHERE email = '…';` puis reconnectez-vous
(voir `docs/exploitation.md`). Pour la
**production**, la base est un projet Neon. Ces comptes sont détaillés pas à
pas dans [`docs/plateforme-setup.md`](./docs/plateforme-setup.md), et chaque
variable est documentée dans [`.env.example`](./.env.example).

## Commandes

```bash
npm run dev          # Dev local
npm run build        # Build prod
npm run test         # Vitest
npm run type-check   # TypeScript
npm run lint         # ESLint
npm run test:e2e     # Playwright (E2E)
```

## Structure

```
src/
├── app/         # Pages + Server Actions (actions.ts par dossier)
├── components/  # UI réutilisable (Button, SpeakeuseCard, TalkCard…)
├── lib/         # Métier + accès DB (profiles, talks, email, rate-limit…)
├── constants/   # site.ts (URLs, e-mails), navigation.ts
├── data/        # Contenu statique (actualités, tremplin, charte…)
└── __tests__/   # Tests Vitest
db/              # schema.sql, sync-to-latest.sql, migrations/
e2e/             # Tests Playwright
docs/            # Architecture, exploitation, conception, roadmap
```

Vue d'ensemble technique : [`docs/architecture.md`](./docs/architecture.md).
Principes de conception UI : [`docs/principes-conception-ui.md`](./docs/principes-conception-ui.md).

## Contribuer

Les contributions sont les bienvenues, et la licence du code n'y change rien :
le dépôt reste ouvert aux issues et aux pull requests. Lisez d'abord
[`CONTRIBUTING.md`](./CONTRIBUTING.md) (workflow TDD, conventions de code et de
langue, style de commit) et le [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md).

Pour signaler une faille de sécurité : [`SECURITY.md`](./SECURITY.md) (ne pas
ouvrir d'issue publique).

## Licence

Code sous **licence propriétaire Tech Speak'Her** (voir [`LICENSE`](./LICENSE)).
En résumé : vous pouvez lire le code, le cloner pour l'étudier ou préparer une
contribution, et le faire tourner en local. Le déployer, le redistribuer ou en
reprendre une partie ailleurs demande une autorisation écrite
(**techspeakher@gmail.com**).

En contribuant, vous gardez le droit d'auteur sur votre travail et vous
autorisez Tech Speak'Her à l'exploiter dans le projet (détail : [`LICENSE`](./LICENSE) §3).

Le nom « Tech Speak'Her », le logo et l'identité de marque relèvent de
[`TRADEMARK.md`](./TRADEMARK.md).
