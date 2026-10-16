# Audit : reprendre le code sans passer par Claude

> Mesuré le **2026-10-16** sur `main` (`a82447e4`, premier commit du dépôt
> public). La méthode de chaque chiffre est en annexe, pour qu'on puisse le
> refaire.
>
> **Pour qui.** Le code restera écrit à 95 % par des sessions Claude. Mais le
> dépôt est public : une bénévole, ou une curieuse, doit pouvoir le lire, le
> lancer et proposer un changement sans passer par une session. Le plan ne
> démonte donc pas la méthode des sessions ; il ajoute une entrée pour les
> humaines, et ne garde comme chantier de code que ce qui sert aux deux.
>
> **État** : plan **en attente de validation** par Cateline. Rien n'est
> commencé. Les décisions à prendre sont au §5.

## 1. En bref

Le code est fiable : TypeScript strict sans `any`, 4 826 tests verts en
27 secondes **sans base de données**, une CI complète. Ce qui gêne une
humaine n'est pas la qualité, c'est l'accès :

1. aucune porte d'entrée dans les 73 docs, et aucun glossaire du métier ;
2. on ne voit pas le site avec des données, ni l'espace connecté, sans créer
   des comptes chez Neon, Google ou Brevo ;
3. le processus de contribution est écrit pour des agents ;
4. quatre fichiers dépassent 1 000 lignes, dont un de 2 610 ;
5. un quart des lignes du code sont des commentaires, souvent longs et datés ;
6. le doc de dette, à lire avant chaque changement, fait 2 135 lignes dont
   environ 40 % sont soldées.

Les points 4 à 6 coûtent aussi aux sessions Claude : chacune charge ces
fichiers et ces docs dans son contexte.

## 2. Les mesures

| Mesure | Valeur |
|---|---|
| Code (`src/` hors tests) | 528 fichiers, 75 729 lignes |
| Tests Vitest | 408 fichiers, 70 383 lignes ; 4 826 tests, verts en 27 s, sans base |
| Tests E2E (`e2e/`) | 5 042 lignes |
| `any`, `@ts-ignore` | 0 et 0 (37 `eslint-disable`) |
| Lignes de commentaire (code) | 18 055, soit **24 %** des lignes, 25 % des lignes non vides |
| dont blocs de 10 lignes ou plus | 446 blocs, 6 734 lignes ; 76 blocs de 20 lignes ou plus |
| Commentaires qui racontent l'histoire | ~200 lignes dans 103 fichiers (code), ~180 dans 97 fichiers (tests) : dates, « revue du … », numéros de PR, « lot N2 » |
| Commentaires avec un mot en capitales pour insister | 2 555 lignes (15 % des lignes de commentaire) |
| Fichiers de plus de 1 000 lignes | 4 (20 de plus de 500) |
| `src/app/admin/tremplins/actions.ts` | 2 610 lignes, 54 Server Actions, 97 `revalidatePath` |
| `src/lib/tremplin-ateliers.ts` | 1 495 lignes, 63 exports, importé par 56 fichiers |
| `src/lib/profiles.ts` | 1 224 lignes, 49 exports, importé par 128 fichiers |
| `src/app/mon-espace/actions.ts` | 1 049 lignes, 19 Server Actions |
| Docs (`docs/`, Markdown) | 73 fichiers, 23 759 lignes, dont 34 `conception-*`, 5 `audit-*`, 4 `implementation-*` |
| Lectures obligatoires (`CLAUDE.md` + 5 docs) | 3 568 lignes |
| `docs/dette-technique.md` | 2 135 lignes, dont ~890 (42 %) soldées ou historiques |
| `docs/roadmap.md` | 838 lignes |
| Références `#NNN` dans les docs | 172, toutes vers l'ancien dépôt, privé |
| Historique Git du dépôt public | 1 commit |

## 3. Ce qui tient, et qu'on garde

- **Les tests se lancent sans rien configurer.** `npm install` puis
  `npm run test` : tout passe, Postgres compris (PGlite en mémoire). C'est le
  meilleur argument pour une contributrice.
- **Le README, `CONTRIBUTING.md`, `LICENSE`, `SECURITY.md` existent** et
  sont justes. `docs/architecture.md` est une bonne carte, à jour.
- **Les commentaires disent le pourquoi.** C'est rare et précieux, d'autant
  plus que `git blame` ne remonte plus rien (un seul commit). La règle du dépôt
  le demande (`docs/principes-tests.md` §6). Le tri du §4 garde la raison et
  retire le récit.

## 4. Ce qui freine, et le plan

### 4.1 Pas de porte d'entrée

Le README renvoie à `CONTRIBUTING.md`, qui renvoie à `CLAUDE.md` pour les
conventions. Les 73 docs n'ont ni index ni statut : rien ne dit qu'un
`conception-*` d'août est une trace de conception et pas une règle en
vigueur. Les mots du métier (speakeuse, orga, Tremplin, édition, phase,
atelier, coach, finale, occurrence, fiche, talk pitché) ne sont définis nulle
part. Les 172 `#NNN` des docs renvoient à des PR que personne d'extérieur ne
peut ouvrir, et le nouveau dépôt réutilise déjà ces numéros (#1 à #6).

**Plan (PR 2).** Une page `docs/README.md` d'une page : où est quoi, comment
lancer, quoi lire en premier, et la liste des docs rangés en trois statuts
(à lire, référence, trace historique). Un glossaire court dans la même page.
Une ligne qui dit que les `#NNN` renvoient à l'ancien dépôt. On ne déplace
aucun doc : le code, les tests et les scripts en citent 46 par leur chemin,
dans 198 fichiers.

### 4.2 Voir le site et se connecter en local

Le démarrage rapide du README demande un projet Neon. Un chemin plus simple
existe (un Postgres local, puis `npm run e2e:db` qui pose le schéma et un décor
de personnes inventées) mais il n'est écrit que dans `docs/exploitation.md`,
au chapitre des E2E. Pour se connecter, il faut Google OAuth ou une clé Brevo
(le lien magique passe par Brevo) : sans compte chez eux, l'espace connecté et
l'admin restent fermés en local.

**Plan (PR 2).** Le chemin « Postgres local + décor » monte dans le démarrage
rapide. La connexion locale sans compte tiers est une **décision** (§5, C).

### 4.3 Un processus écrit pour des agents

`CLAUDE.md` impose quatre revues lancées en agents parallèles (`/simplify`,
`/code-review`, `/security-review`, UX). Le modèle de PR demande aussi de
casser chaque test une fois, de solder la dette croisée et de tenir la dette
et la roadmap dans la PR. C'est la bonne règle pour une session. Pour une
humaine qui corrige une coquille, c'est un mur.

**Plan (PR 2).** Dans `CONTRIBUTING.md`, un parcours humain : tests,
type-check et lint au vert, une description du quoi et du pourquoi. Les
revues et la tenue des docs sont faites après l'ouverture de la PR, par une
session lancée par Cateline (§5, B). Le modèle de PR sépare le minimum pour
tout le monde de ce que fait une session. `CLAUDE.md` ne change pas.

### 4.4 Les fichiers géants (PR 3)

Quatre fichiers dépassent 1 000 lignes. Le plus gros,
`src/app/admin/tremplins/actions.ts`, porte 54 Server Actions sur neuf sujets.
Pour changer une action, une humaine fait défiler 2 610 lignes, et une session
les charge en entier.

**Plan.** Un découpage par sujet, sans changer le comportement, une PR par
fichier, dans cet ordre :

| PR | Fichier | Découpage proposé |
|---|---|---|
| 3a | `admin/tremplins/actions.ts` | éditions (4), inscriptions et talks (12), photos et documents (8), ateliers (14), sous-groupes (5), coachs (4), récompenses et jury (7) |
| 3b | `mon-espace/actions.ts` | par écran de l'espace |
| 3c | `lib/tremplin-ateliers.ts` | à préciser à la lecture ; rouvre un « Accepté » de la dette (§5, D) |
| 3d | `lib/profiles.ts` | par sujet, avec un fichier d'index pour ne pas toucher les 128 imports |

À savoir avant de commencer :

- un fichier `"use server"` n'exporte que des fonctions async : les
  utilitaires partagés (`editionBase`, `revaliderEditionPartout`) vont dans un
  module à part, sans la directive. Relire le guide Next 16 sur les Server
  Actions (`node_modules/next/dist/docs/`) avant de choisir entre imports
  directs et ré-export ;
- 3a solde dans le geste le P1 « Squelette copié-collé des actions
  redirect » de la dette ;
- les tests qui mockent par chemin (`vi.mock("@/lib/…")`) changent de
  chemin : chacun est re-jugé en cassant une garde par sous-fichier ;
- une règle ESLint `max-lines` à 1 000 empêche le retour : après le
  découpage, aucun fichier ne la dépasse.

### 4.5 Les commentaires (PR 4)

Un quart des lignes. Leur fond est bon : ils disent pourquoi. Leur forme
gêne :

- ils racontent comment on a trouvé le problème (« revue justesse du
  2026-10-15 », « le précédent du 08-16 », « #233 »). Le récit n'aide ni
  l'humaine, qui ne peut pas ouvrir la PR, ni la session, qui n'a besoin que de
  la règle ;
- ils sont longs : 70 % des lignes de commentaire sont dans des blocs de 5
  lignes ou plus ;
- les capitales pour insister (« LA SEULE », « JAMAIS ») reviennent sur une
  ligne de commentaire sur sept, et se lisent comme un cri.

**Plan.** Dans cet ordre :

1. **D'abord la règle d'écriture**, dans `CLAUDE.md` et `CONTRIBUTING.md` :
   un commentaire dit le pourquoi, au présent ; ni date, ni numéro de PR, ni
   nom de revue ; le récit va dans la doc de conception ou le corps de la PR ;
   les capitales sont pour les sigles. Sans elle, les sessions, qui écrivent
   95 % du code, en remettent dès la semaine suivante.
2. **Une garde** du même genre que `french-spelling.test.ts` : elle refuse
   dans les commentaires de `src/` une date de revue, un `#NNN` ou « PR ».
3. **Le tri** : les ~380 lignes qui racontent l'histoire (code et tests)
   perdent leur provenance et gardent leur raison ; les 76 blocs de 20 lignes
   ou plus sont relus un par un et raccourcis. On ne réécrit pas en masse les
   4 000 autres blocs : ils se raccourcissent au fil des passages, selon la
   règle.

Découpé en deux ou trois PR (`lib`, `app` et `components`, tests), après la
PR 3 pour ne pas trier deux fois les mêmes lignes.

### 4.6 Le doc de dette (PR 5)

`docs/dette-technique.md` est une lecture obligatoire avant de toucher du
code. Environ 890 de ses 2 135 lignes sont soldées ou historiques :
l'en-tête est un journal de sessions de 229 lignes, les P0 soldés restent
barrés à leur place (un seul P0 ouvert sur huit), une section « Historique »
ferme le doc.

**Plan.** Tout ce qui est soldé part dans `docs/archives/dette-soldee.md`,
avec sa date et sa PR. L'en-tête redevient un état court (le test
`docs-passation.test.ts` en lit 40 lignes). La règle « un item soldé reste
barré à sa place » devient « un item soldé part dans l'archive » : c'est un
changement de `docs/clore-une-session.md`, donc une décision (§5, E). Effort
faible, gain immédiat pour chaque session. La roadmap (838 lignes) pourrait
suivre le même traitement plus tard ; ce n'est pas dans ce plan.

### 4.7 Ce qu'on ne touche pas

- **Le mélange français et anglais des noms** (`createEditionAction`,
  `deplacerAtelierAction`, `getFeuilleDonnees`) : le renommage coûterait un
  énorme diff pour un gain faible. Le glossaire suffit.
- **L'emplacement des docs de conception** : 46 docs sont cités par leur
  chemin dans 198 fichiers de code, de tests et de scripts. Le statut se dit dans l'index, pas en déplaçant.
- **Les règles des sessions** (quatre revues, TDD en deux temps, tenue des
  docs) : elles restent la règle pour Claude.

## 5. Le plan, et ce qu'il faut trancher

| # | Livrable | Effort | Gain humaine | Gain session | Risque |
|---|---|---|---|---|---|
| 2 | Page d'accueil, glossaire, démarrage local, parcours humain | S | fort | faible | nul (docs) |
| 5 | Dette soldée archivée | S | moyen | fort (lecture obligatoire) | nul (docs) |
| 3 | Découpage des 4 gros fichiers (4 PR) | M à L | fort | fort (contexte) | faible : déplacement pur, 4 826 tests, type-check, E2E |
| 4 | Règle, garde et tri des commentaires (2 ou 3 PR) | M | fort | moyen | perdre un pourquoi utile : chaque hunk se relit |

**Ordre recommandé : 2, 5, 3, 4.** La 2 ouvre la porte. La 5 est courte et
chaque session en profite tout de suite ; elle ne touche que des docs et peut
avancer en même temps que la 3. La 3 passe avant la 4 pour trier les
commentaires sur les fichiers définitifs. La 3 et la 4 se suivent, jamais en
parallèle : mêmes fichiers.

À trancher par Cateline avant la PR 2 :

- **A. L'ordre** : 2, 5, 3, 4 (recommandé), ou l'ordre de la demande
  (2, 3, 4, 5).
- **B. Les revues d'une PR humaine** : la contributrice fait passer tests,
  type-check et lint ; une session lancée par Cateline sur la PR passe les
  quatre revues et tient la dette et la roadmap. D'accord ?
- **C. Se connecter en local sans compte tiers** : un script de dev qui
  fabrique la session d'un compte du décor (la technique de
  `e2e/session.ts`), refusé hors `localhost`. Il touche à l'authentification,
  donc PR à part avec revue sécurité. Oui, plus tard, ou non (on documente
  Google OAuth en local) ?
- **D. Découper `lib/tremplin-ateliers.ts`** rouvre l'item « Accepté »
  « Découpage `src/lib/tremplin-*` : modules cohésifs ». La raison nouvelle
  est la lecture. On le rouvre ?
- **E. La dette soldée part dans une archive** au lieu de rester barrée à sa
  place (change `docs/clore-une-session.md`). D'accord ?

## Annexe : refaire les mesures

- **Lignes et fichiers** : `wc -l`, sur `src/` hors `__tests__` et hors
  `*.test.*` / `*.spec.*` pour le code.
- **Commentaires** : une ligne compte comme commentaire si, sans ses espaces,
  elle commence par `//`, `/*`, `{/*`, ou se trouve dans un bloc `/* … */`.
  Un bloc est une suite de lignes de commentaire sans ligne de code entre
  elles.
- **Commentaires qui racontent l'histoire** : lignes de commentaire qui
  contiennent une date ISO, une date `JJ/MM`, « revue », « finding », un
  `#NNN`, « PR », « lot N », « retours de Cateline », « précédent »,
  « session du » ou « depuis le 20… ». Le chiffre est un ordre de grandeur :
  le filtre attrape quelques faux positifs (une date d'exemple).
- **Capitales** : lignes de commentaire qui contiennent un mot de 4 lettres
  ou plus en capitales, hors sigles courants (RGPD, RGAA, SQL, JSON…).
- **Server Actions** : `export async function` dans les fichiers qui
  commencent par `"use server"`.
- **Dette soldée** : en-tête avant le premier `##`, sections dont le titre
  porte `~~`, « SOLDÉ » ou « RÉSOLU », items P0 barrés, « Historique »,
  « Recalages de cette revue », puces barrées et leur suite.
- **Tests** : `npx vitest run`, Node 26, sans `DATABASE_URL`.
