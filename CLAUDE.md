# Tech Speak'Her — Guide projet

> **Les cinq lectures obligatoires** — chacune porte une règle d'or non
> négociable, et ce qui l'a imposée :
>
> | Avant de… | Lire | Règle d'or |
> |---|---|---|
> | concevoir une page ou un écran | **`docs/principes-conception-ui.md`** | une page = **un rôle, un CTA principal maxi** |
> | écrire un test, ou déclarer une protection en place | **`docs/principes-tests.md`** | **un test se juge en le cassant**, jamais en le lisant |
> | toucher à du code déjà là | **`docs/dette-technique.md`** (son en-tête) · **`docs/principes-tests.md`** §9 | on **solde la dette qu'on croise**, et on re-juge les tests hérités |
> | ouvrir une pull request | **`docs/revue-avant-pr.md`** | quatre passes, **en agents parallèles** |
> | clore une session | **`docs/clore-une-session.md`** | la dette et la roadmap repartent **à jour**, dans la PR de la session |
>
> **Comprendre le système** : `docs/README.md` (accueil, index des docs, glossaire) ·
> `docs/architecture.md` (vue technique) ·
> `docs/conception-synchro-contacts.md` (qui écrit quoi : plateforme / Brevo /
> HelloAsso) · `docs/audit-e2e-parcours-2026-08.md` (couverture des parcours) ·
> `docs/audit-ux-agenda-2026-08.md` (l'agenda public à l'échelle : ce qui bloque,
> mesuré, et les décisions déjà prises).
>
> **Décider et exploiter** : `docs/dette-technique.md` (priorisée — et elle se lit
> **aussi** avant de toucher une zone, tableau ci-dessus) · `docs/roadmap.md`
> (produit) · `docs/exploitation.md` (mise en prod) ·
> `docs/migration-speakeuses.md` · `docs/google-ad-grants.md` (conformité).

## Le projet

Site web + plateforme de **Tech Speak'Her**, communauté de femmes de la tech à Toulouse qui encourage la prise de parole en conférence. Nos deux premiers meetups ont été organisés avec GDG Toulouse.

- **Prod** : Vercel (deploy auto sur push `main`)
- **Repo** : `pcate22/tech-speak-her-web-site`

## Stack

- Next.js 16 (App Router, TypeScript), Tailwind CSS v4 (`@theme inline` dans `globals.css`)
- Auth.js v5 (Google / LinkedIn / lien magique) + Postgres **Neon** (région UE), `pg`
- Brevo (e-mails transactionnels), Radix UI (composants a11y)
- Vitest + Testing Library (unit/compo), Playwright (E2E), Fuse.js (recherche)

## Structure

```
src/
├── app/         # Pages + Server Actions (actions.ts par dossier)
├── components/  # UI réutilisable (Button, SpeakeuseCard, TalkCard, AccountMenu…)
├── lib/         # Métier + accès DB (profiles, talks, email, rate-limit…)
├── constants/   # site.ts (URLs, e-mails), navigation.ts
├── data/        # Contenu statique (actualités, tremplin, charte…)
└── __tests__/   # Tests Vitest
db/              # schema.sql, sync-to-latest.sql, migrations/
e2e/             # Tests Playwright
```

## Conventions

### Langue et ton
- Tout en **français**. Typographie : espace insécable (` `) avant `! ? : ;`. **Pas de cadratins (—)** dans le contenu affiché.
- **Ton naturel**, pas corporate. Éviter le style ChatGPT (« d'exception », « au cœur de », « qui a su »…). `french-spelling.test.ts` attrape les fautes courantes (scanne `src/data`).
- **Wording toujours à la forme positive** : « ne … plus … » et « ne … pas … » sont **interdits** dans les libellés, CTA et messages. Dire ce qui EST ou ce qu'on FAIT (« Aucun talk pitché », une option « Aucun », « Retirer »). Détail : `docs/principes-conception-ui.md` §5.

### Code & données
- Contenu **statique** → `src/data/` (source unique, importé par les pages, pas de hardcoding). URLs/constantes → `src/constants/site.ts`. Tokens couleur → `globals.css` (`gold`/`silver`/`bronze` pour le Tremplin).
- Contenu **dynamique** (comptes, profils, talks) → Postgres via `src/lib/*`. Schéma dans `db/` : modifier `schema.sql` **et** `sync-to-latest.sql` (idempotent) **et** ajouter une migration `db/migrations/NNN_*.sql`.
- **Server Actions** : l'identité vient de la **session** (jamais du client) ; ré-vérifier l'autorisation côté serveur (`session.user.isOrga`), valider les entrées (Zod, `src/lib/*-form.ts`), SQL **paramétré**.
- **Annuaire public** : ne sérialiser que le DTO `PublicSpeaker` (pas de métadonnée interne). E-mail **jamais** exposé (relais).
- **Accessibilité RGAA** : `aria-labelledby` sur les sections, `role="alert"` pour les erreurs, `sr-only` pour les infos (nouvelle fenêtre…), `focus-visible` partout.
- **Commentaires** : le **pourquoi**, au présent, en quelques lignes. Ni date, ni numéro de PR, ni « revue du … », ni récit de la découverte : ça va dans le corps de la PR, la dette ou un doc de conception (le dépôt public n'a pas l'historique des PR, et `git blame` s'arrête au 16/10/2026). Capitales réservées aux sigles. Un commentaire qui raconte l'histoire, croisé en passant, se ramène à son pourquoi (comme la dette qu'on croise ; mesure et plan : `docs/audit-reprise-humaine.md` §4.5).

### Toucher à du code existant
> Règle d'or : **rien ne repart dans l'état où on l'a trouvé** — ni le code autour, ni la dette de la zone, ni les tests qui la gardaient.

Avant de modifier une fonction, une lib ou une Server Action : **lire la zone** (le code autour, pas la seule ligne à changer) et ce que `docs/dette-technique.md` dit de cet endroit. Puis, dans le même passage :

- **refactorer ce qu'on traverse** et **solder la dette qui tient dans le geste** — ça tient si ça ne demande ni migration, ni dépendance nouvelle, ni changement d'écran, ni une seconde passe de revue ; sinon ça part dans la dette avec sa priorité, pas dans la PR. Exception déjà tranchée : un correctif de **navigation** ne se glisse jamais dans la PR d'un autre sujet (`docs/conception-espace-fil-navigation.md`, décision « 3 non ») ;
- **re-juger les tests hérités** du périmètre touché, en cassant une fois ce qu'ils gardent.

Méthode, précédents, et tenue du doc de dette dans les deux sens : `docs/dette-technique.md` (en-tête) et `docs/principes-tests.md` §9.

### Sécurité / RGPD
- Secrets uniquement en env (Vercel / `.env.local`), **jamais** committés (`.env.example`). **Données personnelles** (e-mails de migration) livrées **hors git**.
- Anti-abus : `src/lib/rate-limit.ts` (contact + lien magique). Crons gardés par `CRON_SECRET`.

### Tests
> Principes, angles morts et registre des erreurs : **`docs/principes-tests.md`**. Règle d'or : **un test se juge en le cassant, jamais en le lisant.**

- **TDD, en DEUX temps** : tests **avant** le code (rouge → vert → refactor), **puis casser une fois** ce que la protection garde pour vérifier qu'elle tombe. Le premier temps garantit qu'un test existe, le second qu'il sert : une suite de 3 227 tests verts a laissé passer une garde d'autorisation supprimée (2026-08-08).
- Rien ne merge en rouge (CI = test + type-check + lint + E2E).
- Couvrir les **Server Actions** (garde-fous : autorisation, attestation, joignabilité), pas seulement les libs. Mais **rendre la faute impossible** (écriture bornée en SQL, donnée absente du DTO) vaut mieux que la tester.
- **Deux niveaux, deux questions** : Vitest répond « cette pièce est-elle correcte ? », Playwright « est-elle branchée ? ». Un callback juste dont le proxy jetait la réponse est passé sous les deux si on n'en joue qu'un.
- **E2E** : les parcours publics restent agnostiques aux données ; ceux qui ont besoin d'un décor passent par `npm run e2e:db` (Postgres éphémère + `db/seed-preview.sql`). Décor absent → ignoré en local, **échec en CI** (`e2e/decor.ts`). Les tests qui écrivent créent leur propre compte jetable.

### Git
- Merge sur `main` pour déployer. Commits en français, préfixés (`feat:`, `fix:`, `chore:`, `docs:`, `test:`).
- **Revue avant PR (obligatoire pour une session)** — quatre passes, dans cet ordre, **lancées en agents autonomes parallèles** (autorisation permanente, rien à demander). Une contributrice humaine suit le parcours allégé de `CONTRIBUTING.md` ; la session qui relit sa PR passe alors ces quatre revues pour elle :

  | Passe | Question | Quand |
  |---|---|---|
  | `/simplify` | est-ce **bien écrit** ? | toujours, en premier (la suivante juge alors la forme définitive) |
  | `/code-review` | est-ce **juste** ? | toujours |
  | `/security-review` | est-ce **exposé** ? | auth, Server Actions, RGPD, données personnelles |
  | UX/UI + RGAA + wording | est-ce **vivable** ? | dès qu'un texte ou un pixel change, fût-ce un message d'erreur |

  Si `/simplify` a touché à du **sensible** (autorisation, décision de branchement, écriture/effacement, RGPD, Server Action), **rejouer** `/code-review` sur ses seuls correctifs — jamais inverser l'ordre. Corriger ou justifier chaque finding avant d'ouvrir la PR, et y dire ce que chaque passe a trouvé. Un rapport vide est une réponse valable.

  Le corps de la PR dit aussi la **dette soldée** (avec ses numéros), les **tests hérités re-jugés** (avec la mutation faite) et le **ménage des docs** (dette + roadmap, §Clore une session) — « rien croisé » est une réponse valable.

  Méthode, raisons et précédents : **`docs/revue-avant-pr.md`**. La CI reste le garde-fou dur ; les revues attrapent en amont ce qu'elle ne voit pas — et la quatrième regarde ce qu'aucune autre ne regarde : l'écran.

### Clore une session

> Règle d'or : **ce que la session suivante ne peut pas savoir sans relire la
> conversation n'est pas livré.**

Deux docs vivent au rythme des sessions : `docs/dette-technique.md` (ce qui
reste à payer) et `docs/roadmap.md` (ce qu'on fait ensuite). **Aucune session ne
se clôt sans les avoir tenus**, et le geste part **dans la PR de la session**,
jamais en tâche pour la suivante. Le périmètre n'est pas « tout relire » :
**ne laisser aucune ligne fausse de son fait**, et marquer « à vérifier », avec
la date, ce dont on doute sans avoir vérifié.

- **Dette**, dans les deux sens, à sa place, avec sa date, sa priorité et son
  chemin complet (forme : en-tête de `docs/dette-technique.md`). Deux fautes
  symétriques : on ne solde pas au forfait, et **un item qu'on met en avant se
  relit contre le code, avec sa date**.
- **Roadmap : une seule passation, jamais deux concurrentes.** Chaque section dit
  son **état et sa date dans son titre** et **absorbe** la précédente. Ce qui est
  tranché quitte « à décider » le jour où on le tranche ; ce qu'on n'a pas fait
  dit **pourquoi** et **où reprendre**.
- **Les docs que la session a rendus faux** (conception, audit, architecture)
  suivent, dans la même PR. Une garde cassée restée verte part au **registre de
  `docs/principes-tests.md`** : le corps de la PR ne se relit pas.
- **Si une autre session a fait le même ménage** : `main` fait base, **l'union
  fait foi** — on rebase, puis on remet item par item ce qu'elle n'a pas.

**Le test d'acceptation.** `src/__tests__/docs-passation.test.ts` tient ce qui se
mesure : l'en-tête d'un doc de passation est au moins aussi frais que son corps.
Le reste est à la main — un addendum posé en haut passe le test et reste une
faute, et deux sections qui se contredisent à distance ne se voient qu'en
`grep`ant le nom de ce qu'on vient de livrer.

> **Ce qui l'a imposé (2026-08-21)** : trois addenda empilés sur la dette — un
> quatrième pendant que la PR de ménage attendait sa revue — deux « Reprise
> immédiate » concurrentes sur la roadmap sous une date plus vieille qu'elles,
> quatre sessions sur ces docs le même jour sans se voir, et un P0 mis en vitrine
> dont la description était **périmée de 12 jours**. Écrire le ménage ne suffit
> pas : il faut relire contre le code.

Méthode, cas de chaque doc et précédents : **`docs/clore-une-session.md`**.

## Commandes

```bash
npm run dev          # Dev local
npm run build        # Build prod
npm run test         # Vitest
npm run type-check   # TypeScript
npm run lint         # ESLint
npx playwright test  # E2E
```

@AGENTS.md
