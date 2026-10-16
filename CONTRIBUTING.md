# Contribuer à Tech Speak'Her

Merci de vouloir contribuer. Ce guide résume ce qu'il faut savoir pour proposer
un changement. En participant, vous acceptez le
[Code de conduite](./CODE_OF_CONDUCT.md).

## Avant de commencer

- **Ouvrez une issue** avant une grosse contribution, pour valider l'approche
  et éviter le travail en double.
- Pour une **faille de sécurité**, n'ouvrez pas d'issue publique : suivez
  [`SECURITY.md`](./SECURITY.md).
- Le code est sous **licence propriétaire** ([`LICENSE`](./LICENSE)) : le dépôt
  est public pour être lu et amélioré, sa réutilisation ailleurs demande une
  autorisation écrite. En contribuant, vous gardez le droit d'auteur sur votre
  travail et vous autorisez Tech Speak'Her à l'exploiter dans le projet, y
  compris sous une licence choisie plus tard (`LICENSE` §3).

## Installation

```bash
npm install
cp .env.example .env.local   # renseigner les valeurs (voir docs/plateforme-setup.md)
npm run dev
```

La plupart des tests tournent **sans base de données** (mocks / pg-mem). Vous
pouvez donc contribuer sans configurer Neon pour beaucoup de sujets.

## Workflow

1. Faites une copie du dépôt (**fork**) sur votre compte GitHub, puis créez-y
   une branche depuis `main` (`feat/…`, `fix/…`, `docs/…`).
2. **TDD, en deux temps** : écrivez le test **avant** le code (rouge → vert → refactor), **puis cassez une fois** ce qu'il garde pour vérifier qu'il tombe. Le premier temps garantit qu'un test existe, le second qu'il sert. Les tests qui gardaient déjà le code que vous modifiez passent la même épreuve (`docs/principes-tests.md` §9).
3. Faites passer la CI en local avant de pousser (voir ci-dessous).
4. Ouvrez une Pull Request vers `pcate22/techspeakher` en remplissant le modèle
   proposé.

Rien ne merge en rouge. La CI vérifie : tests + type-check + lint + E2E.

```bash
npm run test         # Vitest (unit / composants)
npm run type-check   # TypeScript
npm run lint         # ESLint
npm run test:e2e     # Playwright (E2E, agnostiques aux données)
```

## Relecture, fusion et déploiement

Pas besoin de compte Vercel pour contribuer : le déploiement passe par GitHub
Actions, et c'est Cateline, pour l'association, qui le déclenche.

- **La CI de votre PR** démarre quand Cateline l'approuve : pour une
  contribution extérieure, GitHub attend son feu vert avant de lancer quoi que
  ce soit. Testez donc en local (commandes ci-dessus) avant de pousser.
- **Preview en ligne d'une contribution : pas encore disponible, à tester.**
  Nos déploiements passent par GitHub Actions, qui ne confie jamais nos secrets
  au code d'un fork (c'est voulu). Une autre voie, l'intégration GitHub de
  Vercel avec une autorisation par PR, sera essayée à la première contribution
  extérieure. D'ici là, votre travail se vérifie en local (`npm run dev`) et par
  la CI ; ajoutez des captures d'écran à la PR quand un écran change.
- **Seule Cateline fusionne**, et toujours par un **commit de fusion** (le
  squash et le rebase sont désactivés) : le commit déployé en production est
  ainsi toujours signé par elle, ce que notre offre Vercel exige. Votre travail garde votre nom dans l'historique.
- **Au merge sur `main`**, la **production** (techspeakher.fr) est déployée
  automatiquement.

## Conventions de code

> ⚠️ Ce dépôt utilise **Next.js 16** (changements cassants). Lisez le guide
> concerné dans `node_modules/next/dist/docs/` avant d'écrire du code
> (voir [`AGENTS.md`](./AGENTS.md)). Les conventions détaillées sont dans
> [`CLAUDE.md`](./CLAUDE.md).

- **Contenu statique** → `src/data/` (source unique, pas de hardcoding dans les
  pages). URLs et constantes → `src/constants/site.ts`. Tokens couleur →
  `src/app/globals.css`.
- **Contenu dynamique** (comptes, profils, talks) → Postgres via `src/lib/*`.
  Toute évolution de schéma modifie `db/schema.sql` **et** `db/sync-to-latest.sql`
  (idempotent) **et** ajoute une migration `db/migrations/NNN_*.sql`.
- **Server Actions** : l'identité vient de la **session** (jamais du client) ;
  ré-vérifiez l'autorisation côté serveur, validez les entrées (Zod), SQL
  **paramétré**. Couvrez les garde-fous par des tests.
- **Annuaire public** : ne sérialisez que le DTO `PublicSpeaker`. L'e-mail
  n'est **jamais** exposé.
- **Accessibilité RGAA** : `aria-labelledby` sur les sections, `role="alert"`
  pour les erreurs, `sr-only` pour les infos, `focus-visible` partout.
- **Sécurité / RGPD** : secrets uniquement en variables d'environnement, jamais
  committés. Aucune donnée personnelle réelle dans le dépôt.

## Langue et ton

- Tout en **français** (code, commits, issues, PR, contenu).
- Typographie du contenu affiché : espace insécable avant `! ? : ;`, **pas de
  cadratins (—)**. Le test `french-spelling.test.ts` scanne `src/data` et
  attrape les fautes courantes.
- **Ton naturel**, pas corporate. Évitez le style « ChatGPT »
  (« d'exception », « au cœur de », « qui a su »…).

## Commits et Pull Requests

- Commits en français, **préfixés** : `feat:`, `fix:`, `chore:`, `docs:`,
  `test:`.
- Une PR = un sujet cohérent. Décrivez le quoi et le pourquoi, liez l'issue.
- Ajoutez / mettez à jour les tests et la doc concernée.

## Où trouver de la doc

- Architecture : [`docs/architecture.md`](./docs/architecture.md)
- Principes de conception UI : [`docs/principes-conception-ui.md`](./docs/principes-conception-ui.md)
- Exploitation / mise en prod : [`docs/exploitation.md`](./docs/exploitation.md)
- Roadmap produit : [`docs/roadmap.md`](./docs/roadmap.md)
- Principes de tests (et registre des erreurs) : [`docs/principes-tests.md`](./docs/principes-tests.md)
- Dette technique priorisée, à lire avant de toucher une zone : [`docs/dette-technique.md`](./docs/dette-technique.md)
