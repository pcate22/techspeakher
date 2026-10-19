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

Pour vous repérer d'abord : [`docs/README.md`](./docs/README.md) (où est
quoi, quoi lire, glossaire).

```bash
npm install
npm run test                 # tous les tests, sans base de données
```

Pour voir le site avec des données fictives, suivez le
[démarrage rapide du README](./README.md#démarrage-rapide) : un Postgres
local suffit, sans compte Neon.

## Le parcours d'une contributrice

La plupart du code est écrit par des sessions Claude, qui suivent les règles
de [`CLAUDE.md`](./CLAUDE.md) (quatre revues avant chaque PR, tenue des docs
de suivi). Une contributrice humaine suit un parcours plus court :

1. Forkez le dépôt et créez une branche depuis `main` (`feat/…`, `fix/…`,
   `docs/…`).
2. Faites votre changement. S'il change un comportement, ajoutez ou adaptez
   un test ; si vous ne savez pas comment, dites-le dans la PR.
3. Vérifiez en local que tout passe :

   ```bash
   npm run test         # Vitest (unit / composants)
   npm run type-check   # TypeScript
   npm run lint         # ESLint
   ```

4. Ouvrez une Pull Request : décrivez ce que vous changez et pourquoi, et
   cochez la partie « Pour tout le monde » du modèle.

Ensuite, côté association : on approuve le lancement de la CI (tests,
type-check, lint, E2E), puis on fait relire la PR par une session Claude.
Cette relecture passe les revues de `CLAUDE.md`, vérifie que les tests
tombent bien quand on casse le code qu'ils protègent, et met à jour la dette
et la roadmap (dans votre PR si vous cochez « Allow edits by maintainers »,
sinon dans une PR de suivi). Les retours arrivent en commentaire de la PR. Une seule
personne de l'association fusionne les PR, et rien ne fusionne en rouge.

## Le parcours d'une session Claude

Une session suit [`CLAUDE.md`](./CLAUDE.md) en entier : TDD en deux temps
(écrire le test **avant** le code, **puis casser une fois** ce qu'il garde pour
vérifier qu'il tombe, `docs/principes-tests.md` §9), les quatre revues avant
PR (`docs/revue-avant-pr.md`), et la tenue de la dette et de la roadmap dans
la PR (`docs/clore-une-session.md`). Rien ne merge en rouge. La CI vérifie :
tests + type-check + lint + E2E.

```bash
npm run test         # Vitest (unit / composants)
npm run type-check   # TypeScript
npm run lint         # ESLint
npm run test:e2e     # Playwright (E2E, agnostiques aux données)
```

## Déploiement (previews)

Pas besoin de compte Vercel pour contribuer : les déploiements sont
automatiques, via GitHub Actions.

- **À l'ouverture d'une PR depuis une branche de ce dépôt** (et à chaque push) :
  une **preview** est déployée et son URL apparaît dans la PR, pour tester son
  travail en ligne et le faire relire. Une PR venue d'un fork n'a pas de
  preview : testez en local (démarrage rapide du README).
- **Au merge sur `main`** : la **production** (techspeakher.fr) est déployée
  automatiquement.

## Conventions de code

> ⚠️ Ce dépôt utilise **Next.js 16** (changements cassants). Lisez le guide
> concerné dans `node_modules/next/dist/docs/` avant d'écrire du code
> (voir [`AGENTS.md`](./AGENTS.md)). Les conventions détaillées sont dans
> [`CLAUDE.md`](./CLAUDE.md) ; celles qui suivent sont l'essentiel.

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
- **Commentaires** : un commentaire dit **pourquoi** le code est ainsi, au
  présent et en quelques lignes. Pas de date, pas de numéro de PR, pas de
  récit de la façon dont le problème a été trouvé : ça va dans la description
  de la PR ou dans un doc de conception. Les capitales sont pour les sigles
  (RGPD, SQL), pas pour insister.

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
- Ajoutez ou mettez à jour les tests et la doc concernée (voir l'étape 2 du
  parcours d'une contributrice si vous ne savez pas comment).

## Où trouver de la doc

- Page d'accueil des docs, glossaire : [`docs/README.md`](./docs/README.md)
- Architecture : [`docs/architecture.md`](./docs/architecture.md)
- Principes de conception UI : [`docs/principes-conception-ui.md`](./docs/principes-conception-ui.md)
- Exploitation / mise en prod : [`docs/exploitation.md`](./docs/exploitation.md)
- Roadmap produit : [`docs/roadmap.md`](./docs/roadmap.md)
- Principes de tests (et registre des erreurs) : [`docs/principes-tests.md`](./docs/principes-tests.md)
- Dette technique priorisée, à lire avant de toucher une zone : [`docs/dette-technique.md`](./docs/dette-technique.md)
