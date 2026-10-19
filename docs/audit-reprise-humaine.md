# Audit : lire, lancer et modifier le code sans session Claude

> Mesuré le **2026-10-16** sur la branche `main` du dépôt public (`a82447e4`,
> son premier commit). La méthode de chaque chiffre est en annexe, pour qu'on puisse le
> refaire.
>
> **Pour qui.** Le code restera écrit à 95 % par des sessions Claude. Mais le
> dépôt est public : une bénévole, ou une curieuse, doit pouvoir le lire, le
> lancer et proposer un changement sans passer par une session. Le plan garde
> la méthode des sessions. Il ajoute un parcours pour les humaines, et ses
> chantiers de code (gros fichiers, commentaires) servent aussi aux sessions.
>
> **État** : plan **en attente de validation** par Cateline. Rien n'est
> commencé. Les décisions à prendre sont au §5.
>
> **Numérotation.** Le plan compte quatre lots, numérotés de 2 à 5 (le lot 1
> est cet audit). Ce sont des numéros de lot, pas des numéros de PR GitHub.

## 1. En bref

Le code est fiable : TypeScript strict sans `any`, 4 826 tests verts en
27 secondes **sans base de données**, une CI complète. Une humaine bute sur
six points, tous liés à l'accès :

1. aucune porte d'entrée dans les 73 docs, et aucun glossaire du métier ;
2. on ne voit pas le site avec des données, ni l'espace connecté, sans créer
   des comptes chez Neon, chez Google ou LinkedIn, ou chez Brevo ;
3. le processus de contribution est écrit pour des sessions Claude ;
4. quatre fichiers dépassent 1 000 lignes, dont un de 2 610 ;
5. un quart des lignes du code sont des commentaires, souvent longs et datés ;
6. le doc de dette fait 2 135 lignes, dont environ 40 % sont soldées ; son
   en-tête (229 lignes) se lit avant chaque changement.

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
| Blocs de commentaire (code) | 4 228 blocs ; 70 % des lignes sont dans des blocs de 5 lignes ou plus |
| dont blocs de 10 lignes ou plus | 446 blocs, 6 734 lignes ; 76 blocs de 20 lignes ou plus (22 de plus dans les tests) |
| Commentaires qui racontent l'histoire | ~330 lignes dans ~150 fichiers (code), ~260 dans ~130 fichiers (tests) : dates, « revue du … », numéros de PR, « lot N2 » |
| Commentaires avec un mot en capitales pour insister | 2 555 lignes (14 % des lignes de commentaire) |
| Fichiers de plus de 1 000 lignes | 4 (20 de plus de 500) |
| `src/app/admin/tremplins/actions.ts` | 2 610 lignes, 54 Server Actions, 97 `revalidatePath` |
| `src/lib/tremplin-ateliers.ts` | 1 495 lignes, 63 exports, importé par 53 fichiers (3 autres le remplacent dans un test) |
| `src/lib/profiles.ts` | 1 224 lignes, 49 exports, importé par 115 fichiers (13 autres le remplacent dans un test) |
| `src/app/mon-espace/actions.ts` | 1 049 lignes, 19 Server Actions |
| Docs (`docs/`, Markdown) | 73 fichiers, 23 759 lignes, dont 34 `conception-*`, 5 `audit-*`, 4 `implementation-*` |
| Docs cités comme lectures obligatoires (`CLAUDE.md` + 5 docs) | 3 568 lignes en tout (pour la dette, `CLAUDE.md` demande l'en-tête et la section de la zone touchée) |
| `docs/dette-technique.md` | 2 135 lignes, dont ~890 (42 %) soldées ou historiques |
| `docs/roadmap.md` | 838 lignes |
| Références `#NNN` dans les docs | ~172, presque toutes vers des PR de l'ancien dépôt, privé |
| Historique Git du dépôt public | 1 commit |

## 3. Ce qui tient, et qu'on garde

- **Les tests se lancent sans rien configurer.** `npm install` puis
  `npm run test` : tout passe, y compris les tests qui ont besoin de Postgres
  (PGlite et pg-mem, deux Postgres en mémoire). Une contributrice vérifie son changement
  dès le premier jour.
- **Le README, `CONTRIBUTING.md`, `LICENSE`, `SECURITY.md` existent** et
  sont justes. `docs/architecture.md` est une bonne carte, à jour.
- **Les commentaires disent le pourquoi.** C'est d'autant plus utile que
  `git blame` ne remonte plus rien (un seul commit). La règle du dépôt le
  demande (`docs/principes-tests.md` §6). Le tri du §4.5 garde la raison et
  retire les dates et les numéros de PR.

## 4. Ce qui freine, et le plan

### 4.1 Pas de porte d'entrée

Le README renvoie à `CONTRIBUTING.md`, qui renvoie à `CLAUDE.md` pour les
conventions. Les 73 docs n'ont ni index ni statut : rien ne dit qu'un
`conception-*` d'août est une trace de conception et pas une règle en
vigueur. Les mots du métier (speakeuse, orga, Tremplin, édition, phase,
atelier, coach, finale, occurrence, fiche, talk pitché) ne sont rassemblés
nulle part : quelques-uns sont définis çà et là (`docs/architecture.md`,
`docs/conception-phases-tremplin.md`). Les 172 `#NNN` des docs renvoient à des PR que personne d'extérieur ne
peut ouvrir, et le nouveau dépôt réutilise déjà ces numéros (#1 à #6).

**Plan (lot 2).** Un `docs/README.md` court : où est quoi, comment lancer,
quoi lire en premier, et la liste des docs rangés en trois statuts (à lire,
référence, trace historique). Un glossaire court dans la même page. Une ligne
qui dit que les `#NNN` renvoient à l'ancien dépôt. Aucun doc ne change de
place (§4.7).

### 4.2 Voir le site et se connecter en local

Le démarrage rapide du README demande un projet Neon. Un chemin plus simple
existe (un Postgres local, puis `npm run e2e:db` qui pose le schéma et un décor
de personnes inventées) mais il n'est écrit que dans `docs/exploitation.md`,
au chapitre des E2E. Pour se connecter, il faut un compte Google ou LinkedIn
configuré pour l'application, ou une clé Brevo (le lien magique passe par
Brevo) : sans eux, l'espace connecté et l'admin restent fermés en local.

**Plan (lot 2).** Le chemin « Postgres local + décor » monte dans le
démarrage rapide. La connexion locale sans compte tiers est une
**décision** (§5, C).

### 4.3 Un processus écrit pour des sessions Claude

`CLAUDE.md` impose quatre revues, lancées en agents parallèles avec des
commandes de Claude Code (`/simplify`, `/code-review`, `/security-review`,
puis une revue UX). Le modèle de PR demande aussi de vérifier chaque test en
cassant exprès le code qu'il protège, de régler la dette croisée et de tenir
la dette et la roadmap dans la PR. Une session suit cette règle sans effort.
Une humaine qui corrige une coquille devrait, elle, lancer quatre revues et
tenir à jour deux docs de 800 et 2 000 lignes.

**Plan (lot 2).** Dans `CONTRIBUTING.md`, un parcours humain : tests,
type-check et lint au vert, une description du quoi et du pourquoi. Les
revues et la tenue des docs sont faites après l'ouverture de la PR, par une
session lancée par Cateline (§5, B). Le modèle de PR sépare le minimum pour
tout le monde de ce que fait une session. Les règles des sessions dans
`CLAUDE.md` restent les mêmes ; une ligne y précise qu'elles valent pour les
sessions et renvoie les humaines à `CONTRIBUTING.md`.

### 4.4 Les fichiers géants (lot 3)

Quatre fichiers dépassent 1 000 lignes. Le plus gros,
`src/app/admin/tremplins/actions.ts`, porte 54 Server Actions, que le tableau
ci-dessous range en sept sujets. Pour changer une action, une humaine fait
défiler 2 610 lignes, et une session les charge en entier.

**Plan.** Un découpage par sujet, sans changer le comportement, une PR par
fichier, dans cet ordre :

| Lot | Fichier | Découpage proposé |
|---|---|---|
| 3a | `admin/tremplins/actions.ts` | éditions (4), inscriptions et talks (12), photos et documents (8), ateliers (14), sous-groupes (5), coachs (4), récompenses et jury (7) |
| 3b | `mon-espace/actions.ts` | par écran de l'espace |
| 3c | `lib/tremplin-ateliers.ts` | à préciser à la lecture ; rouvre une dette classée « Accepté » (§5, D) |
| 3d | `lib/profiles.ts` | par sujet, avec un fichier d'index pour ne pas toucher les 115 imports |

À savoir avant de commencer :

- un fichier `"use server"` n'exporte que des fonctions async (le
  compilateur le refuse sinon) : `editionBase`, appelé par cinq sujets, va
  dans un module à part, sans la directive. Le guide Next 16
  (`node_modules/next/dist/docs/`) ne dit rien du ré-export d'actions : un
  essai de build tranchera entre imports directs et fichier d'index ;
- 3a règle au passage la dette P1 « Squelette copié-collé des actions
  redirect » (`editionBase` rend aussi l'identifiant de l'édition) ;
- les tests qui remplacent un module par son chemin (`vi.mock("@/lib/…")`)
  changent de chemin : pour chacun, on casse exprès une vérification du
  sous-fichier pour s'assurer que le test échoue ;
- on ajoute la règle ESLint `max-lines` à 1 000, limitée au code hors
  tests : elle empêche qu'un fichier repasse au-dessus. Après le découpage,
  aucun ne la dépasse. Quatre fichiers de test dépassent 1 000 lignes
  (jusqu'à 3 449) ; ils restent hors de la règle et hors de ce plan.

### 4.5 Les commentaires (lot 4)

Les commentaires font un quart des lignes. Ils expliquent le pourquoi, ce
qui est utile ; trois choses gênent la lecture :

- ils racontent comment on a trouvé le problème (« revue justesse du
  2026-10-15 », « le précédent du 08-16 », « #233 »). Ce récit n'aide ni
  l'humaine, qui ne peut pas ouvrir la PR, ni la session, qui n'a besoin que de
  la règle ;
- ils sont longs : 70 % des lignes de commentaire sont dans des blocs de 5
  lignes ou plus ;
- les capitales pour insister (« LA SEULE », « JAMAIS ») reviennent sur une
  ligne de commentaire sur sept et alourdissent la lecture.

**Plan.** Dans cet ordre :

1. **D'abord la règle d'écriture**, dans `CLAUDE.md` et `CONTRIBUTING.md`
   (§5, F) : un commentaire dit le pourquoi, au présent ; ni date, ni numéro
   de PR, ni nom de revue ; le récit va dans la doc de conception ou le corps
   de la PR ; les capitales sont pour les sigles. Sans elle, les sessions, qui
   écrivent 95 % du code, en remettent dès la semaine suivante.
2. **Un test** du même genre que `french-spelling.test.ts`, qui échoue si un
   commentaire de `src/` contient une date de revue, un `#NNN` ou « PR ».
3. **Le tri** : les ~600 lignes qui racontent l'histoire (code et tests)
   perdent leur provenance et gardent leur raison ; les 98 blocs de 20 lignes
   ou plus (76 dans le code, 22 dans les tests) sont relus un par un et
   raccourcis. On ne réécrit pas en masse les
   quelque 4 000 autres blocs : ils se raccourcissent au fil des passages,
   selon la règle.

Découpé en deux ou trois PR (`lib`, `app` et `components`, tests), après le
lot 3 pour ne pas trier deux fois les mêmes lignes.

### 4.6 Le doc de dette (lot 5)

`CLAUDE.md` demande de lire l'en-tête de `docs/dette-technique.md` avant de
toucher du code. Environ 890 de ses 2 135 lignes sont soldées ou
historiques : l'en-tête est un journal de sessions de 229 lignes, les P0
soldés restent barrés à leur place (un seul P0 ouvert sur huit), une section
« Historique » ferme le doc.

**Plan.** Tout ce qui est soldé part dans `docs/archives/dette-soldee.md`,
avec sa date et sa PR. L'en-tête redevient un état court (le test
`docs-passation.test.ts` n'en lit que les 40 premières lignes). La règle
« un item soldé reste barré à sa place » devient « un item soldé part dans
l'archive » : elle est écrite en tête de la section P0 de la dette et dans
`docs/clore-une-session.md`, donc c'est une décision (§5, E). Effort faible,
gain immédiat pour chaque session. La roadmap (838 lignes) pourrait suivre
le même traitement plus tard ; ce n'est pas dans ce plan.

### 4.7 Ce qui reste tel quel

- **Le mélange français et anglais des noms** (`createEditionAction`,
  `deplacerAtelierAction`, `getFeuilleDonnees`) : le renommage coûterait un
  énorme diff pour un gain faible. Le glossaire suffit.
- **L'emplacement des docs de conception** : 46 docs sont cités par leur
  chemin dans 198 fichiers de code, de tests et de scripts. Le statut se dit
  dans l'index, pas en déplaçant.
- **Les règles des sessions** (quatre revues, TDD en deux temps, tenue des
  docs) : elles restent la règle pour Claude.

## 5. Le plan, et ce qu'il faut trancher

| Lot | Livrable | Effort | Gain contributrice | Gain session | Risque |
|---|---|---|---|---|---|
| 2 | Page d'accueil, glossaire, démarrage local, parcours humain | S | fort | faible | nul (docs) |
| 5 | Dette soldée archivée | S | moyen | fort (lue avant chaque changement) | nul (docs) |
| 3 | Découpage des 4 gros fichiers (4 PR) | M à L | fort | fort (contexte) | faible : déplacement, plus la dette P1 réglée dans 3a ; 4 826 tests, type-check, E2E |
| 4 | Règle, test et tri des commentaires (2 ou 3 PR) | M | fort | moyen | perdre un pourquoi utile : chaque modification se relit |

**Ordre recommandé : 2, 5, 3, 4.** Le lot 2 donne une entrée aux
contributrices. Le lot 5 est court et chaque session en profite tout de
suite ; il ne touche que des docs et peut avancer en même temps que le
lot 3. Le lot 3 passe avant le lot 4 pour trier les commentaires sur les
fichiers définitifs. Les lots 3 et 4 se suivent, jamais en parallèle : mêmes
fichiers.

À trancher par Cateline avant le lot 2 :

- **A. L'ordre** : 2, 5, 3, 4 (recommandé), ou l'ordre des sections du §4
  (2, 3, 4, 5).
- **B. Les revues d'une PR humaine** : la contributrice fait passer tests,
  type-check et lint. Une session lancée par Cateline sur la PR passe les
  quatre revues, vérifie les tests en cassant le code qu'ils protègent, et
  tient la dette et la roadmap. D'accord ? Si non, la contributrice suit tout
  `CLAUDE.md`.
- **C. Se connecter en local sans compte tiers** : un script de dev qui crée
  le cookie de connexion d'un compte du décor, comme le font les tests E2E
  (`e2e/session.ts`), et qui refuse de tourner hors `localhost`. Il touche à
  l'authentification, donc PR à part avec revue sécurité. Trois réponses :
  oui, dans ce plan (PR à part après le lot 2) ; oui, après le plan ; non (on
  documente Google OAuth en local).
- **D. Découper `lib/tremplin-ateliers.ts`** rouvre la dette classée
  « Accepté » « Découpage `src/lib/tremplin-*` : modules cohésifs » (on avait
  choisi de ne pas y toucher). La raison nouvelle : 1 495 lignes à faire
  défiler pour changer une fonction. On le rouvre ? Si non, le lot 3c sort du
  plan.
- **E. La dette soldée part dans une archive** au lieu de rester barrée à sa
  place (change l'en-tête de la section P0 de la dette et
  `docs/clore-une-session.md`). D'accord ?
- **F. La règle d'écriture des commentaires entre dans `CLAUDE.md`**
  (§4.5, étape 1) : c'est une règle nouvelle pour les sessions. D'accord ?

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
  « session du » ou « depuis le 20… ». On retire les faux positifs connus :
  « revue croisée » (une nature d'atelier) et les couleurs hexadécimales.
  Le chiffre reste un ordre de grandeur (une date d'exemple passe encore).
- **Capitales** : lignes de commentaire qui contiennent un mot de 4 lettres
  ou plus en capitales, hors sigles courants (RGPD, RGAA, SQL, JSON…).
- **Server Actions** : `export async function` dans les fichiers qui
  commencent par `"use server"`.
- **Importeurs** : fichiers qui importent le module ; ceux qui ne font que le
  remplacer (`vi.mock`) sont comptés à part.
- **Dette soldée** : en-tête avant le premier `##`, sections dont le titre
  porte `~~`, « SOLDÉ » ou « RÉSOLU », items P0 barrés, « Historique »,
  « Recalages de cette revue », puces barrées et leur suite.
- **Tests** : `npx vitest run`, Node 26, sans `DATABASE_URL`.
