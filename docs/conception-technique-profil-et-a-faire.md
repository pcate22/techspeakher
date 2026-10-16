# Conception technique — « Mon profil » rangé, et l'onglet « À faire »

> Décline la conception fonctionnelle `docs/conception-profil-et-a-faire.md`
> (validée par Cateline le 2026-08-16, maquette HTML jugée sur téléphone) et
> l'audit `docs/audit-ux-profil-orga-2026-08.md`. Applique
> `docs/principes-conception-ui.md` (règle d'or, checklist COGA) et
> `docs/principes-tests.md`.
>
> **Statut : RÉVISÉE le 2026-08-16 après revue**, prête à coder. La revue est
> `docs/revue-conception-a-faire-2026-08.md` — quatre angles, un relecteur
> autonome par angle. Ses 22 corrections sont intégrées ci-dessous ; les cinq
> arbitrages ont été tranchés **en autonomie** (Cateline dormait et avait
> demandé qu'on avance), sont **marqués comme tels**, et chacun se renverse
> d'une phrase sans défaire les autres.
>
> Ce que la revue a changé, en une ligne : l'étape B faisait sortir des données
> nominatives de la garde de préfixe de `/admin`, avec un compteur qui ne
> pouvait pas retomber à zéro, en fermant la seule porte connue vers les
> messages d'une membre.
>
> Créée le **2026-08-16**.

## 0. Ce que la conception fonctionnelle a déjà tranché

Rappel, pour ne pas rouvrir en écrivant le code : l'emplacement qui porte
aujourd'hui « Messages » devient **« À faire »** ; les bravos restent dans le
**fil** (c'est ce qui rend le mot honnête) ; le profil groupe ses rangées en
**Mon bénévolat / Ma participation / Mon compte**, les deux rangées du haut
sans étiquette (« Mon profil » les couvre) ; la liste s'ouvre sur **Tout** ; un
seul nom par territoire (**« Espace organisatrices »**, **« tremplin en
cours »**).

## 1. Les six décisions structurantes

### D1 — Un moteur, trois familles, en mots entiers

`deriverTachesOrga` devient **`deriverTaches`**. Le type `Tache` gagne un
champ obligatoire :

```ts
famille: "personnel" | "association" | "accompagnement"
```

**Pas `"perso"` ni `"coach"`** *(revue C7)*. « perso » est exactement la
troncature que la conception condamne dans les puces, et cette valeur est
**visible dans la barre d'adresse** (`?vue=personnel`) donc dans tout lien
partagé. Rien ne l'attraperait : `mots-entiers.test.ts` ne juge que la prose
(les chaînes contenant une espace), et il le dit lui-même — « une étiquette
d'un seul mot passe entre les mailles ». La règle « un seul mot par concept, de
l'écran au code » s'applique ici comme elle s'est appliquée à « marche » →
« étape ». Et `"accompagnement"` plutôt que `"coach"` : V6 a déjà tranché
qu'accompagner et coacher sont une seule chose.

Les règles existantes gardent leur libellé et leur `href`, et prennent
`famille: "association"`. `EntreesTaches` s'étend d'une clé par famille, et
**le moteur reste PUR** : zéro accès base, testable sans Postgres.

### D2 — La capacité borne le chargement, et personne ne peut la mentir

La première version passait les capacités en argument :

```ts
// ❌ ce que la revue a écarté
chargerTaches({ userId, profileId, estOrga, estCoach })
```

Trois raisons de ne pas faire ça, toutes vérifiées dans le code :

**(a) La route perd sa garde de préfixe.** `src/auth.config.ts` refuse `/admin`
à qui n'est pas orga ; `/mon-espace` demande seulement d'être connectée. Les
tâches d'association ont aujourd'hui **deux** gardes indépendantes ; sur
`/mon-espace/a-faire` il n'en resterait qu'une — et ce ne serait plus une
garde, mais un booléen qu'un appelant compose *(S1)*.

**(b) `estCoach` ne dit pas ce qu'on croit.** Il dit « cette personne est
coach », pas « ces ateliers sont les siens ». Les tâches d'accompagnement
portent des noms de participantes : réutiliser `chargerEditionEntrees`, qui
charge **toute** l'édition, donnerait à une coach les tâches des ateliers des
autres — élévation horizontale et fuite nominative. L'espace coach existant
fait l'inverse et le dit : « tout est scopé EN SQL par la liaison coach ↔
cible » *(S4)*. Aggravant : `markUserAsCoach` n'a **pas d'inverse**,
`is_coach` est vrai à vie.

**(c) `profileId` en argument crée un IDOR latent.**
`getPendingSuggestionsCount` et `getTransmittedMessagesForProfile` filtrent sur
l'identifiant qu'on leur donne, sans vérifier l'appartenance. Elles sont sûres
parce que leurs appelants le dérivent de la session — le mettre dans la
signature déplace cette responsabilité pour rien *(S3)*.

**La forme retenue** — trois portes, chacune gardée chez elle, aucune capacité
qui voyage :

```ts
// Espace connecté. Aucun argument : la session EST la capacité.
chargerTaches(): Promise<EntreesTaches>
desTachesAttendent(): Promise<boolean>

// Cron uniquement. Pas de session ; gardé par CRON_SECRET en amont.
chargerTachesAssociation(): Promise<EntreesTaches>
```

`chargerTaches` appelle `getSession()` (mémoïsé par requête, donc gratuit sur
les deux appels d'une page), en dérive `userId`, puis `profileId` via
`getProfileByUserId` (mémoïsé aussi), et **déclenche** le chargement de chaque
famille selon ce qu'elle a le droit de lire :

| Famille | Chargée si | Bornage |
|---|---|---|
| `personnel` | toujours | par `userId` |
| `association` | `session.user.isOrga` | — |
| `accompagnement` | la personne a au moins une liaison | **en SQL, par `user_id`**, jamais par filtrage après coup |

Le cron a besoin d'une porte parce qu'il n'a pas de session : sans elle, la
sortie de facilité serait de lui laisser passer `estOrga: true` en dur,
c'est-à-dire de rouvrir le trou qu'on vient de fermer *(S2 bis)*.

**Le test proposé au départ (« passer `estOrga: true` en dur → le test doit
tomber ») ne peut plus s'écrire.** C'est le bon résultat : rendre la faute
impossible vaut mieux que la tester.

### D3 — Un POINT, pas un compteur — révisé le 2026-08-17

> **Révision, sur question de Cateline** : « Et si tu mets juste un point quand
> y'a des tâches ? Est-ce que le compteur apporte vraiment ? » La réponse est
> non, et ce qui suit remplace la conception d'un compteur chiffré.

**Le coût.** La barre est rendue sur **chaque page** de l'espace connecté
(`NavEspaceServeur` — ex-`BottomNavServeur` —, monté par les deux layouts), et `chargerTachesAssociation`
fait ~5 requêtes plus 7 par édition active — une vingtaine sur deux éditions.
Inutilisable tel quel pour un signal de barre.

**Ce que le nombre coûtait en plus.** Un compte « bon marché » qui divergerait
du moteur serait pire qu'une absence de signal. Il fallait donc **deux chemins
et un invariant** (`compterTaches(c) === deriverTaches(chargerTaches(c)).length`),
tenu par un test d'intégration. C'était la pièce la plus chère et la plus
fragile du lot — et elle n'existait que pour que le chiffre ne mente pas.

**Ce que le nombre apportait.** Sur des volumes de une à cinq lignes, « 3 » et
« il y a quelque chose » déclenchent la même décision : j'ouvre. Le nombre ne
devient utile que lorsqu'il change le comportement — quand 2 et 20 ne se
traitent pas pareil. Ce n'est pas le cas ici, et Cateline l'a dit avant moi.

**Donc** :

```ts
desTachesAttendent(): Promise<boolean>
```

Un booléen ne peut se tromper que de **deux façons** — s'allumer pour rien, ou
rester éteint à tort — là où un compte pouvait diverger de N façons. L'invariant
lourd disparaît ; reste un test simple et un test qui compte vraiment (voir §5).

**Un seul chemin, mémoïsé** *(tranché au lot 4)*. La tentation était d'écrire un
`EXISTS` par famille, moins cher qu'un chargement complet. On ne le fait pas :
un `EXISTS` à la main serait une **seconde définition** de ce qu'est une tâche,
c'est-à-dire exactement ce que la revue a jugé pire qu'une absence de signal.
`desTachesAttendent()` lit donc `chargerTaches()`, et `chargerTachesAssociation`
passe sous `cache()` de React.

Ce que la mémoïsation achète, et ce qu'elle n'achète pas :

| Page | Coût du point |
|---|---|
| n'importe quelle page, **non-orga** | **zéro requête** — la porte de D2 rend `[]` sans rien lire |
| `/mon-espace/a-faire`, orga | **zéro requête de plus** : la barre et la liste partagent le même chargement |
| toute autre page de l'espace connecté, orga | **le chargement complet**, une fois |

Reste donc le troisième cas, et il porte sur une poignée de comptes. C'est
mesurable et réversible : si le volume le rend visible, **le risque 1
s'applique** — on retire le point de la barre et on garde la liste sur la page.
Un onglet muet est honnête. Ce qu'on ne fera pas, c'est un second chemin qui
diverge, ni un cache au-delà de la requête.

**Ce que le point signale** *(règle tranchée le 2026-08-17, cf. principes UI)* :
uniquement ce qu'un **geste de la personne qui le voit** peut refermer. Le
critère n'est pas la date — une action à faire dans dix jours reste une chose à
faire, elle allume. Le critère est **qui referme**. Sortent du signal :

| Règle | Allume-t-elle ? |
|---|---|
| Une photo bloquée par la **seule** inscrite qui y figure | **non** — sa couverture vaut `registration.public`, SON réglage de visibilité. L'orga n'a aucun geste à poser, et un accord refusé ne se « recueille » pas |
| Une photo dont une personne identifiée **hors inscription** attend son accord | **oui** — la case « Accord recueilli » se coche dans l'app, photo par photo |
| « Relier X à un compte » | **oui** — `attachUserToRegistration` écrit `"userId"` dans les DEUX branches de l'écran (compte existant choisi, ou compte pré-créé par invitation), et la règle dérive de `!r.userId` |
| « Ouvrir au public l'édition » | **oui**, même en dette : une orga la referme d'un geste. Que la tâche ne doive pas exister (les dates le disent déjà, `docs/dette-technique.md`) se règle en **supprimant la tâche**, pas en donnant un cas particulier à la règle du point |

La ligne qui n'allume pas **reste dans la liste**, où elle informe, sous une
étiquette visible « Pour information ».

> **Deux erreurs, corrigées le jour même par la revue.** Cette table classait
> d'abord « Relier X à un compte » et **toutes** les photos bloquées du côté qui
> n'allume pas. Faux : la première se referme en un clic, et `photoPubliable`
> fond DEUX mécanismes en un booléen (`couverte = registrationId !== null ?
> reg_public : consentement`), dont un seul échappe à l'orga. Les tests
> tenaient très bien l'erreur. **« Qui peut refermer » se lit sur l'écran que la
> ligne POINTE**, jamais sur l'intuition qu'on a du domaine — et se tromper de
> ce côté est le pire des deux : s'éteindre à tort apprend à ne plus regarder la
> barre. D'où la séparation en deux compteurs (`nbPhotosAccordAConfirmer`,
> `nbPhotosPrivees`) faite **à la source**, dans `chargerEditionEntrees`.

**Comment le code le porte** : un champ `constat` sur la règle, et un prédicat
exporté, `reclameUnGeste`. Pas de reconnaissance de libellé — une règle qui
change de mots changerait de sens sans qu'un test bronche.

**Et un seul prédicat pour les quatre surfaces** qui posent la question : le
point de l'onglet, la rangée « À faire » du tableau de bord (compte + drapeau),
la méta de `/admin/taches`, le hub d'édition. Elles comptaient toutes
`taches.length` : avec un constat et rien d'autre, `/admin` annonçait « 1 action
en attente » avec son drapeau pendant que le point restait éteint. La liste,
elle, reste **complète** — c'est le COMPTE qui suit les gestes, pas
l'affichage.

**L'accord photo devient un constat** *(décision de Cateline, 2026-08-17 :
« il faut surtout informer l'orga que la photo n'a pas de consentement »)*.
« Recueillir l'accord pour 2 photos » réclamait un geste que l'orga ne peut pas
faire **quand la photo est bloquée par une inscrite** — et le réclamait parfois
pour un accord **déjà refusé**. La règle se dédouble donc (cf. la table
ci-dessus) : le libellé impératif reste, juste, sur les photos dont l'accord se
recueille puis se coche ; et la moitié subie prend un libellé de constat.

Ce libellé-là devient **« 2 photos restent privées »**, avec le lien vers la
galerie de l'édition. Trois raisons de s'arrêter là :

- il dit ce qui EST, sans impératif ni négation (règle de wording, `« Aucun
  talk pitché »`) ;
- il est vrai des **deux** mécanismes, alors qu'« accord manquant » serait faux
  de l'un : pour une participante inscrite, `couverte` vaut
  `registration.public`, **son réglage de visibilité à elle** ; c'est seulement
  pour une personne identifiée en texte libre que le champ est un consentement.
  Un accord refusé n'est pas un accord manquant ;
- le détail — qui, et pourquoi — est **à un geste**, sur la page des photos.
  Un libellé de liste n'a pas à porter ce qu'un écran dit mieux.

Le lot « accord global + retrait ciblé » a sa propre conception à écrire (trois
états — accordé / refusé / sans réponse —, migration pour les personnes en
texte libre, écran de retrait côté participante, art. 7-3 : retirer aussi
simple que donner). Il **précisera** ce libellé ; il ne le contredira pas.

**Accessibilité du point** *(R1 vaut toujours)* : il entre dans le **nom
accessible** de l'onglet (« À faire, quelque chose attend » — vrai à une
tâche comme à vingt, là où un pluriel mentirait la moitié du temps), jamais dans une
pastille de couleur seule ; le libellé visible reste **en tête** du nom
(WCAG 2.5.3) ; à zéro, **rien du tout** — le nom redevient « À faire ». Il se
pose **dans** la boîte de l'onglet, sans décalage négatif franchissant le bord
du `<nav>` (R6 : `--hauteur-onglets` est la source unique du dégagement du
pied, du `scroll-padding-bottom` et de la barre d'action collante).

**Deux interdictions** : aucun cache au-delà de la requête (un `unstable_cache`
sans clé d'identité servirait le signal d'une orga à une membre) ; aucun
`<Suspense>` imbriqué autour du seul point — les layouts enveloppent déjà toute
la barre, elle arrive d'un bloc ou pas.

Si l'échec du signal doit être géré : l'onglet s'affiche **sans point**. Un
onglet muet vaut mieux qu'une page en erreur.

**Deux notes de plateforme, consignées au lot 6** *(passe justesse)* : les
layouts ne re-rendent pas en navigation client, donc le point vit au rythme
des entrées dans la coquille, des rechargements durs et des `revalidatePath`
des Server Actions — chaque geste posé DANS l'app le rafraîchit ; seul le
travail refermé par une AUTRE orga peut le laisser allumé jusqu'au prochain
rechargement, ce que « un signal par requête » accepte. Corollaire : la table
de coût ci-dessus SURESTIME — le chargement ne part pas à chaque navigation,
mais à chaque entrée/rechargement/action. Le risque 1 est encore plus loin de
se déclencher qu'écrit.

**Le jour où un volume rendra l'arbitrage utile**, le nombre s'ajoute sans rien
défaire : `EXISTS` est un sous-ensemble de `COUNT`.

### D4 — Les puces sont une vue dans l'URL, et un composant NEUF

Le dépôt a le mécanisme d'URL (`src/lib/vue-liste.ts`) : « le filtre vit dans
l'URL — un lien, pas un état ». On l'étend : `?vue=association`,
`?vue=personnel`, `?vue=accompagnement`, absent = **Tout**.

**Mais le rendu n'existe pas** *(R2)*. `vue-liste.ts` est un contrat d'URL et
rien d'autre ; `BandeauVue` est un `div` + un lien de retour, sans aucun
attribut ARIA ; et `ChipGroup` n'est pas candidat — ce sont des `<span>`
décoratifs, sans `href` ni `focus-visible`, **et son fichier est dans la liste
gelée du cliquet typographique**, qu'on ne peut que faire raccourcir *(R9)*.

Spécification du composant neuf :

- des **liens** (`<a href="?vue=…">`) — ce qui satisfait au passage le test
  « filtrable sans JS » ;
- la puce active porte **`aria-current="page"`**. C'est bien `page` et non
  `true` : la règle dit `page` **quand le lien mène à la page affichée**, et le
  `href` d'une puce active EST l'URL courante, requête comprise. `true` est la
  valeur d'un onglet-repli, pas d'un filtre. Corollaire : le `href` de « Tout »
  est `/mon-espace/a-faire` **sans paramètre**, sinon l'identité ne colle plus ;
- l'état est doublé **autrement que par la couleur** : active en **aplat
  plein**, repos en **contour** — une différence de forme, pas de teinte ;
- le contour au repos est à **`cyan/50` (3,81:1)** au minimum. `cyan/30` donne
  **2,13:1**, moitié du seuil de WCAG 1.4.11 pour un élément d'interface *(R3)* ;
- cible **≥ 44 px**, sur le patron déjà écrit dans `BandeauVue`
  (`min-h-[44px] py-3 -my-3`, qui garde la densité) *(R7)* ;
- la rangée est un **`<ul aria-label="Filtrer">`**, jamais un `<nav>` : un
  second repère de navigation encombre la liste qui sert à sauter *(R8)* ;
- placée **immédiatement avant la liste** : chaque puce est une navigation
  complète, le focus repart en tête de document.

**La vue est intersectée avec les capacités, jamais l'inverse** *(S5, R4)*.

> **Nuance d'implémentation (lot 5, consignée par la passe justesse)** : le
> code dérive les clés permises des familles **présentes et non vides**, pas
> des capacités — équivalent aujourd'hui (une seule dérivation existe, et
> seules les orgas la lisent). Le jour où la famille `personnel` arrive,
> `?vue=personnel` sur une liste personnelle vide donnera « Tout » au lieu de
> « Rien à faire de ton côté » (pourtant branché) : un lien épinglé se
> dégradera en silence. À trancher à ce moment-là — dériver `permises` de la
> session plutôt que de la liste. Le
raccourci « la vue dit quelle famille charger » ferait d'un paramètre d'URL un
sélecteur de données. Les clés permises sont **dérivées des capacités réelles** ;
une clé qu'on n'a pas le droit de voir donne `null`, donc « Tout »,
silencieusement — pas d'erreur, pas de message qui révélerait le modèle de
rôles.

**Et une vue active affiche toujours un retour visible vers « Tout »**, y
compris quand les puces sont absentes (personne à une seule famille arrivant
par le 308). C'est ce que `BandeauVue` existe pour faire, et le seul morceau de
`vue-liste` qui se transpose vraiment. Condition : puces présentes **ou**
bandeau, jamais les deux — deux commandes pour une destination, c'est déjà dans
le registre des erreurs.

### D5 — Les routes, et la porte axe

| Route | Sort |
|---|---|
| `/mon-espace/a-faire` | **nouvelle** — cible de l'onglet 4, avec `robots: { index: false }` et `dynamic = "force-dynamic"` |
| `/admin/taches` | **redirection 308** vers `/mon-espace/a-faire?vue=association` |
| `/mon-espace/messages`, `/admin/messages` | inchangées, mais **plus jamais atteintes seulement depuis la liste** (voir D6) |

Structure de la page *(R8)* : un seul `h1`, **pas de `<main>`** (le layout
racine porte `#main-content`, une règle ESLint le tient), la liste **nommée par
la vue active** (`aria-label="Tâches — pour l'association"`), et **aucun fil
d'Ariane** — la page devient une destination d'onglet, elle n'a plus de parent.

**Le `h1` ne porte pas le compte** *(R5)*. La maquette écrit « À faire (5) », et
c'est déjà ce que fait le code livré sur `/admin/taches`. Deux défauts : le nom
du repère de page bouge tout seul, et dès qu'une puce est active le `h1`
compterait la vue filtrée pendant que le badge compte « Tout » — deux nombres
contradictoires sans un mot pour l'expliquer. Le compte vit **à côté**, et dit
lequel il compte. **C'est un défaut LIVRÉ : il se corrige tout de suite, hors
étape B.**

**La porte axe** *(R10)* : `e2e/pages-publiques.ts` liste `/admin/taches` dans
`PAGES_ORGA`. Après le 308, cette entrée auditerait la vue filtrée — Playwright
suit la redirection et le `200` passe — et **`/mon-espace/a-faire` en vue
« Tout » ne serait auditée par personne**. C'est la seule porte qui évalue le
contraste réel, `target-size` avec ses exceptions et les repères : la route
entre dans `PAGES_MEMBRE`.

### D6 — Une porte permanente vers les messages, livrée AVANT le changement d'onglet

*(Arbitrage Q2, tranché en autonomie.)*

Vérifié : `/mon-espace/messages` n'est référencé qu'**une seule fois** dans tout
`src/` comme destination de navigation — `BottomNav.tsx:56`. Ni `navLinks`, ni
`AccountMenu`, ni aucune rangée du profil n'y mènent.

L'étape B remplace cet onglet, et une ligne « Répondre à X » n'existe que tant
qu'il reste quelque chose à traiter. Le jour où elle a répondu, **ses messages
lus deviennent inatteignables**. Ce n'est pas une gêne, c'est une
fonctionnalité qui disparaît — et pour les publics visés, le pire cas : ce qui
était toujours au même endroit n'y est plus, sans que rien ne dise où.

Et les deux défauts s'annulent d'une façon qui n'est pas une solution : rendre
la ligne refermable rend l'archive inatteignable ; la laisser perpétuelle
bloque le compteur.

**Donc** : une rangée **« Mes messages »** dans le groupe de tête du profil
(avec « Ma fiche publique » et « Mes articles »), affichée dès qu'il y a eu au
moins un message. **Livrée avant** que l'onglet change — c'est une contrainte
d'ordre, pas une préférence.

## 2. Étape A — le profil se range *(LIVRÉE, #323 et #332)*

Pour mémoire, et parce que la revue a révisé deux points en cours de route.

### A1. Les segments

Une structure de données, pas du JSX empilé — c'est elle qui rend le « segment
vide ne s'affiche pas » impossible à oublier :

```ts
const segments: { id: string; titre: string | null; rangees: Rangee[] }[]
```

`titre: null` = le groupe de tête, **sans titre du tout** : « Mes pages » était
un mot fabriqué, servi en `sr-only` — donc lu à voix haute aux seules personnes
qui ne peuvent pas le recouper avec l'écran. Un segment sans rangée retourne
`null` ; chaque segment est un **`<div>`** (pas une `<section>` : six repères de
navigation sur un écran qui n'a qu'un sujet), et c'est le `<ul role="list">` qui
porte `aria-labelledby`.

**Espacement** : la loi de proximité appartient au **composant**.
`SegmentLabel` rend `mt-8 -mb-1` et n'accepte plus de `className` — deux appels
sur trois l'annulaient.

**À ajouter** : la rangée « Mes messages » (D6).

### A2. Le wording *(livré)*

| Où | Avant | Après |
|---|---|---|
| rangée du profil, `h1` de `/admin`, `<title>`, fils d'Ariane | Tableau de bord orga / Espace orga | **Espace organisatrices** |
| rangée orga | Ateliers · {édition} | **Ateliers du tremplin en cours** + sous-titre `{nom}` |
| carte d'étape | …sur tes profils CFP… | **On a repéré N talks à ton nom** |

### A3 et A4 *(livrés)*

L'onglet Profil est courant dans `/admin` (avec `aria-current="true"`, valeur
d'un repli). Le pied de page s'allège dans la coquille d'app, en **retirant**
le contenu — jamais en le masquant en CSS.

## 3. Étape B — l'onglet « À faire »

### B1. Les familles

| Famille | Sources qui existent | Bornage |
|---|---|---|
| **personnel** | `getPendingSuggestionsCount`, `getTransmittedMessagesForProfile`, articles renvoyés, `getMesProchainsTalks` | par `userId` |
| **association** | `deriverTachesOrga` actuel, à l'identique | rôle |
| **accompagnement** | *à établir* | **en SQL, par les liaisons coach ↔ cible** |

> La famille `accompagnement` peut démarrer **vide** : la structure l'accepte,
> la puce ne s'affiche pas, rien ne ment. Ce serait un lot B2 séparé — et il ne
> peut pas partir avant que son bornage SQL soit écrit *(D2 b)*.

### B2. Ce que le client reçoit — et ce que la première version affirmait à tort

La version initiale écrivait « aucun identifiant de personne, aucun e-mail ».
**Faux deux fois** *(G1)* :

- le **nom** est la donnée personnelle, et il est dans le libellé (« Valider la
  fiche d'Ada », « Relier {nom} à un compte ») ;
- le **`href` est un identifiant de personne** : `/speakeuses/{id}`,
  `/admin/tremplins/{ed}/participantes/{id}/compte`.

C'est légitime pour un écran — un lien doit bien mener quelque part. Ce qui ne
l'était pas, c'est de se servir de cette phrase comme garantie pour l'étape C.

**Formulation juste** : le DTO porte un libellé composé côté serveur et une URL
interne ; il ne porte ni e-mail ni corps de message ; **et ni les noms ni les
URL ne quittent la plateforme**.

Point d'appui à ne pas perdre : `ListeTaches` est un **composant serveur**
(aucun `"use client"`), donc rien n'est sérialisé vers le navigateur — et comme
D4 met le filtre dans l'URL, on peut le garder ainsi. **Le DTO le plus sûr est
l'absence de DTO** *(G4)*.

Attention associée : `getTransmittedMessagesForProfile` renvoie des lignes
**complètes**, `senderEmail` et `body` compris. Seul le libellé survit au
chargement.

### B3. Le point, côté accessibilité

*(Réécrit le 2026-08-17 avec D3 : un point, pas un nombre. Ce qui suit valait
pour un badge chiffré et vaut mot pour mot pour un point — seule la chaîne
change.)*

Le signal entre dans le nom accessible de l'onglet — l'intention était juste,
le mécanisme manquait, et c'est là que le dépôt a un précédent *(R1)* : un
`sr-only` accolé à un libellé s'énonce **collé** (« Modifier**le** talk »). Et
l'inverse — `aria-label="Quelque chose à faire"` — ne contient plus la chaîne
visible dans l'ordre : échec **WCAG 2.5.3 (Label in Name)**, et la commande
vocale « cliquer À faire » cesse de fonctionner.

```tsx
<Link
  href="/mon-espace/a-faire"
  aria-label={attend ? "À faire, quelque chose attend" : undefined}
>
  <IconeAFaire aria-hidden="true" />
  <span>À faire</span>
  {attend && <span aria-hidden="true" className="…" />}
</Link>
```

Libellé visible **en tête**, point `aria-hidden`, et **rien du tout à zéro** :
le nom redevient « À faire ». Le point n'est jamais l'information seule — la
couleur ne porte rien qu'un lecteur d'écran n'entende déjà.

**Le point reste DANS la boîte de l'onglet** *(R6)*. Un enfant en absolu ne
sort pas de la zone cliquable, mais il sort de `--hauteur-onglets` — la source
**unique** du dégagement du pied, du `scroll-padding-bottom` (WCAG 2.4.11) et
du `bottom` de `.barre-action-collante`. Un `-top-1` avec `z-40` contre `z-10`
se peindrait **par-dessus le bouton « Enregistrer »** d'un formulaire long :
exactement la collision du registre des erreurs. Il y a la place à l'intérieur
du `min-h-14`. Un point n'a pas de texte, donc pas de plancher typographique à
respecter — mais il garde un **diamètre** qui se voit, et son contraste avec le
fond de la barre tient **1.4.11** (3:1), puisqu'il est porteur d'information.

### B4. Le pictogramme

**Trois icônes de lien** (Accueil, Agenda, À faire) passent en SVG à trait
épais, le pictogramme reprenant le mot de son étiquette — une liste cochée pour
« À faire », jamais une cloche. Les SVG restent `aria-hidden="true"`.

*(Formulation corrigée : « les cinq onglets » était faux deux fois — l'onglet 5
est une **photo** (`Avatar`), et le ➕ n'est pas dans `BottomNav` mais dans
`FeuilleCreer`, qui partage seulement la classe `ONGLET_BARRE`.)*

### B5. Le wording de la liste

*(Arbitrage Q4, tranché en autonomie.)*

**`Tout · Pour moi · Pour l'association · Pour mes coachées`** — une seule
grammaire, un seul axe : *pour qui est-ce ?* « Tout » reste hors patron parce
qu'il est l'absence de filtre.

Les **mêmes mots** servent d'étiquette sur les lignes. La maquette §3.4 écrit
« Association » et « Pour moi » alors que la puce dirait « Pour l'association » :
c'est la source depuis laquelle on codera, **elle doit être corrigée**.

Et l'étiquette de famille apparaît **à la même condition que les puces** (≥ 2
familles), jamais dans une vue filtrée : pour une speakeuse simple, chaque
ligne dirait « Pour moi », un mot qui ne distingue rien *(C6)*.

> **La divergence avec « Mon bénévolat » est assumée, et écrite** : le profil
> nomme *ce que je donne de moi* et groupe des **pages** ; la liste nomme *pour
> qui la tâche est faite* et filtre des **tâches**. Tant que ce n'est pas écrit,
> ça se lit comme l'incohérence « Tes coachées » / « Mes coachées » corrigée la
> veille. **Réversible** : l'axe possessif tient aussi (`Pour moi` → `Mes
> tâches`), au prix de l'ambiguïté de « Mes tâches ».

## 4. Étape C — les notifications alimentent les deux surfaces *(LIVRÉE le 2026-08-18, lot 7)*

- **Bravos → le fil** (`/mon-espace`), pas la liste. C'est la condition qui
  tient le mot « À faire ».
- **L'e-mail quotidien lit la même dérivation que l'écran, et n'en publie que
  l'agrégat** *(arbitrage Q3, tranché en autonomie ; G3, G5)*.

Le point produit visé est juste : l'e-mail disait deux choses quand le moteur
en dérive une dizaine, et il imprimait « 0 fiche à valider » dès que l'autre
ligne était non nulle. Depuis le lot 7, il lit `chargerTachesAssociation` (la
porte du cron, celle que D2 lui réservait) et publie l'agrégat par règle —
`Tache` porte `regle` (liste fermée) et `nb`, et une règle neuve sans libellé
d'agrégat est une erreur de compilation. Un canal du moteur, pas une seconde
définition.

Mais « lire la même dérivation » ne veut pas dire « imprimer les mêmes
libellés ». Trois faits, tous vérifiés :

1. l'e-mail part à `CONTACT_EMAIL` — **l'adresse publique de l'association**,
   publiée en `mailto:` sur le code de conduite, destinataire du formulaire de
   contact, `replyTo` des liens de connexion. Son périmètre d'accès n'est pas
   `users.is_orga`, c'est celui du partage d'une boîte Gmail. Et elle est chez
   Google, quand la base est délibérément en région UE ;
2. **une copie distribuée survit à la suppression du compte.** Le projet a
   poussé l'effacement jusqu'à Brevo et `passeConservation` efface en cascade :
   rien de tout ça n'atteint un e-mail déjà parti. Ce serait la **première
   durée de conservation que personne n'outille** ;
3. le cron applique déjà la bonne doctrine sur le canal d'à côté — son journal
   ne garde que des compteurs, avec la raison en commentaire : « un journal
   nominatif annulerait la suppression ».

**Forme retenue** :

```
- 3 fiches à valider
- 2 ateliers à dater (Tremplin DevFest 2026)
- 1 article à relire
Le détail est dans ton espace : {BASE_URL}/mon-espace/a-faire?vue=association
```

Comptes par règle, lignes à zéro tues, **aucun nom, aucune URL de dossier
individuel**. Et **jamais** de personne sans compte dans un libellé sortant :
celles-là n'ont ni notice, ni réglages, ni bouton de suppression — la forme
groupée existe déjà (« Relier 3 participantes à un compte ») *(G5)*.

Si un jour on veut du nominatif, ce sera un e-mail **par orga vers son adresse**,
destinataire identifié, avec les mentions légales amendées.

## 5. Stratégie de tests

Les deux niveaux de `docs/principes-tests.md` — Vitest « cette pièce est-elle
correcte ? », Playwright « est-elle branchée ? » — et le **second temps** :
casser une fois ce que chaque protection garde.

| Protection | Le test | Ce qu'on casse pour le vérifier |
|---|---|---|
| Une non-orga ne voit aucune tâche d'association | intégration | l'ancien test (« passer `estOrga: true` ») ne peut plus s'écrire : on vérifie qu'**aucune requête d'association n'est émise** |
| Une coach ne voit **que ses ateliers** | intégration | élargir le `WHERE` → le test tombe |
| Le point ne ment pas | intégration | une règle refermable existe et le point reste éteint → le test tombe |
| **La liste peut finir** | intégration | *il existe un état de la base où le point est ÉTEINT alors qu'une ligne s'affiche* — une photo bloquée par la seule inscrite qui y figure. Sans lui, la règle COGA n'est gardée nulle part |
| **Et son pendant** : la MÊME photo, identifiée hors inscription, ALLUME | intégration | c'est la moitié qui manquait : sans elle, un test vert couvrait un point éteint sur un travail d'un clic |
| Le point ne s'allume que pour ce qu'un geste referme | intégration | déclarer `constat` sur une règle de plus → la liste fermée tombe |
| Les quatre surfaces comptent la même chose | *à venir avec l'onglet* | remettre `taches.length` sur le drapeau de `/admin` |
| Le digest orga **ne contient aucun nom** | unitaire, posé **avant** l'étape C | y remettre un libellé → le test tombe |
| Un libellé de tâche ne contient **jamais** de `@` | unitaire | `registrationLabel` retombe sur l'e-mail si un filtre s'élargit |
| Le `h1` ne porte pas le compte | compo | remettre `(5)` dans le titre |
| La puce active porte `aria-current="page"` | compo | passer à `true` |
| Une vue non permise retombe sur « Tout » | intégration | laisser passer la clé |
| La liste est atteignable et filtrable **sans JS** | E2E, **au niveau HTTP** | livré le 2026-08-18 : le HTML servi contient la vue filtrée entière. Le rendu strict sans JS bute sur `loading.tsx` (limite de plateforme, cf. dette) |
| La page est auditée par axe | E2E | l'ajouter à `PAGES_MEMBRE`, pas seulement compter sur le 308 |

Le décor E2E passe par `npm run e2e:db` ; les parcours qui écrivent créent leur
compte jetable.

## 6. Risques

1. **Le coût du signal** reste le vrai risque, même réduit à un booléen. S'il
   ne tient pas en un `EXISTS` par famille, on ne triche pas : on retire le
   point de la barre et on garde la liste sur la page. Un onglet muet est
   honnête ; un point faux ne l'est pas. Et **aucun cache** n'est une sortie
   acceptable *(D3)*.
2. **La redirection de `/admin/taches`** doit survivre aux liens des e-mails
   déjà envoyés : 308 permanent, jamais une suppression sèche.
3. **Le renommage `TachesOrga` → `Taches`** touche beaucoup de fichiers. Un
   commit `refactor:` seul, sans changement de comportement, avant le reste.
4. **`is_coach` est vrai à vie** (`markUserAsCoach` n'a pas d'inverse) et le
   JWT fige les rôles jusqu'à la reconnexion. Les deux sont **préexistants** et
   sans conséquence **si et seulement si** le bornage SQL de D2 est en place :
   une capacité périmée donne alors une famille vide, pas une famille ouverte.
   À traiter pour eux-mêmes, hors de ce lot.

## 7. Ordre de livraison

| # | Lot | Pourquoi cet ordre |
|---|---|---|
| 0 | `refactor:` renommage seul, `famille` ajoutée, **sans** changement de comportement | isole un diff large et mécanique |
| 1 | Le `h1` de `/admin/taches` perd son compte | défaut **livré**, indépendant du reste |
| 2 | Les deux tests RGPD bon marché (pas de `@`, digest sans nom) | posés **avant** ce qu'ils protègent |
| 3 | La rangée **« Mes messages »** du profil | **doit précéder** le changement d'onglet *(D6)* |
| 4 | `chargerTaches` / `desTachesAttendent` / `chargerTachesAssociation` | le cœur, avec ses gardes |
| 5 | `/mon-espace/a-faire`, les puces, le 308, la porte axe | l'écran |
| 6 | L'onglet 4 et son point | **en dernier** : c'est lui qui retire « Messages » de la barre |
| 7 | Étape C — l'e-mail agrégé, les bravos au fil | **livré le 2026-08-18** (les bravos étaient déjà au fil, lot N4) |
| 8 | Étape B2 — la famille `accompagnement`, si elle a lieu d'être | après le bornage SQL |

Une PR par lot cohérent, et les **quatre passes** de `docs/revue-avant-pr.md`
avant chacune — `/simplify` en premier.

## 8. Hors périmètre

La roue crantée des éditions (lot 3 de l'audit), la messagerie interne (N5),
les commentaires (N6). Le balayage des mots tronqués et l'espacement de
`SegmentLabel` sont **soldés** par la PR du 2026-08-16 — « orga » et « asso »
par un cliquet à liste fermée, l'espacement en le retirant des mains des
appelants. Restent en dette les sigles (« CFP », « visio ») et la typographie
condamnée hors coquille d'app (~80 occurrences, gelées).
