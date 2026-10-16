# Audit UX/UI — « Mon profil » vu par une orga, et la place des messages

> Audit **sans code**, demandé le 2026-08-15 sur capture mobile d'un compte
> **orga + coach + speakeuse**. Le chantier navigation (lots N1 → N4) est
> fermé : cette page est ce qu'il en reste d'illogique côté orga. Second sujet
> posé avec l'audit : que faire de l'onglet **Messages**, sachant que le volume
> restera faible et que les bravos ne préviennent encore personne.
>
> À lire avec `docs/principes-conception-ui.md` (règle d'or),
> `docs/conception-lot-n1-navigation.md` (§2.3 la barre, §2.5 les deux écrans
> du « moi ») et `docs/conception-espace-fil-navigation.md` (§3 un accès = un
> objectif, §5 le profil, §8 la messagerie).
>
> Suite donnée : la conception fonctionnelle et les maquettes vivent dans
> `docs/conception-profil-et-a-faire.md` (proposée le 2026-08-16, **en
> attente de validation**). Rien n'est codé tant qu'elle n'est pas validée.
>
> **Étape A livrée le 2026-08-16** (PR #323, puis une PR de suite) : C1 (les
> accès groupés par monde), C5 (`aria-current` sur `/admin`), C7 (« Espace
> organisatrices », un seul nom), C9 (plus de rangée hors groupe), C10 (le pied
> court dans la coquille d'app). C3, C8 et C11 restent ouverts : ils attendent
> l'onglet « À faire » (étape B) et les notifications (étape C).
>
> La PR de suite ne corrige pas des constats de cet audit mais les **findings
> des trois revues** passées après le merge (`/code-review`,
> `/security-review`, RGAA/UX/accessibilité cognitive) : `aria-current="true"`,
> la typographie condamnée, les repères de navigation, les mots tronqués. Son
> verdict tient en une phrase, à garder en tête pour l'étape B : **la
> correction est vraie au niveau du composant, fausse au niveau de l'écran** —
> d'où deux cliquets à liste fermée (`typographie-lisible.test.ts`,
> `mots-entiers.test.ts`) plutôt que des corrections ponctuelles.
>
> Dernière mise à jour : **2026-08-16**.

## 1. Ce qu'on regarde

`/mon-espace/profil` (`src/app/mon-espace/profil/page.tsx`), cible de
l'onglet-photo. Pour un compte à trois casquettes, la capture donne, de haut
en bas :

1. en-tête : photo, « Mon profil » + pastille « Privé », nom, « Fiche : publiée » ;
2. carte **Ta prochaine marche** (« Ta prochaine scène est le 22 octobre 2026 ») ;
3. rangée **Ma fiche publique**, seule, sans étiquette ;
4. **MES ACCÈS**, huit rangées d'affilée : À faire · Tableau de bord orga ·
   Ateliers · Tremplin 2026 · Mes coachées · Tremplin 2026 · Documents ·
   Réglages · Se déconnecter ;
5. le pied de page **public** complet (trois colonnes, ~17 liens) ;
6. la barre d'onglets : Accueil · Agenda · ➕ · Messages · Profil.

## 2. Ce qui tient (à ne pas casser en corrigeant)

- **Les deux écrans du « moi » jamais mélangés** (privé / public), la pastille
  « Privé » en texte, la visibilité portée par les noms d'écran. C'est le cœur
  de la refonte, rien ici ne le remet en cause.
- **Une seule marche**, dérivée des données (`src/lib/prochaine-marche.ts`),
  jamais une pile d'injonctions. Un CTA principal, la règle d'or est tenue sur
  ce point.
- **`NavRow` partout** : un seul langage d'affordance, la ligne entière
  cliquable, chevron unique. Rien à revoir sur le composant.
- **La barre canonique**, identique pour tous les rôles. Les constats qui
  suivent ne demandent aucun slot supplémentaire.

## 3. Constats

### C1 — « Mes accès » est un sac : quatre mondes sous une seule étiquette

Huit rangées, un seul `SegmentLabel` (`profil/page.tsx:166-234`). Elles
appartiennent pourtant à quatre mondes :

| Monde | Rangées |
|---|---|
| Faire tourner l'asso | À faire, Tableau de bord orga, Ateliers · Tremplin 2026 |
| Accompagner | Mes coachées |
| Ma propre participation | Tremplin 2026, Documents |
| Mon compte | Réglages, Se déconnecter |

Rien ne signale qu'on change de monde entre la rangée 3 et la rangée 4 : même
carte, même chevron, même graisse. C'est le « et » que la règle d'or interdit
(« moi **et** mes accès »), et c'est la loi de Hick appliquée à un écran qu'on
ouvre plusieurs fois par jour. Le prix se paie surtout chez les comptes à
plusieurs casquettes — c'est-à-dire exactement les orgas.

### C2 — Deux rangées « Tremplin 2026 » qui ne parlent pas de la même chose

« Ateliers · Tremplin 2026 » (je **gère** l'édition) et « Tremplin 2026 » (je
**participe** à l'édition) sont dans la même liste, séparées par « Mes
coachées ». Le seul départage est le sous-titre, en petit et en gris. La même
édition apparaît donc trois fois sur l'écran (ateliers orga, participation,
et le coaching qui s'y rattache) sans hiérarchie qui dise depuis quelle
casquette on la regarde.

### C3 — La page ne dit jamais l'état : « À faire » est une rangée muette

Sur `/admin`, la rangée porte le compte et l'alerte :
`À faire (3)` + « 3 actions en attente » + `flag` (`admin/page.tsx:45-51`).
Sur le profil, la même destination est une rangée nue (`profil/page.tsx:172-177`).

Ce n'est pas un oubli d'affichage : la page **ne charge pas** les tâches. Elle
lance neuf lectures, aucune n'est `chargerTachesOrga`.

Conséquence mesurée en taps, app ouverte sur le fil :

| Objectif | Chemin | Taps |
|---|---|---|
| **Savoir** s'il y a du travail | Profil → À faire | 2 (+ 2 chargements) |
| Modérer un message | Profil → À faire → « Modérer 3 messages » → le message → Transmettre | 5 |
| Idem par le menu | Profil → Tableau de bord orga → Messages → le message → Transmettre | 5 |

L'orga paie le tap **et** l'ignorance : elle doit aller voir pour savoir s'il
fallait y aller.

### C4 — La seule porte vers l'espace orga de tout le produit est cette rangée

`href="/admin"` n'apparaît qu'une fois hors de `/admin` : `profil/page.tsx:182`.
Sur desktop, `AccountMenu` ne l'a plus non plus (Q1 tranchée, à raison : deux
modèles de navigation selon la taille d'écran, c'était pire).

Le tap supplémentaire est une décision assumée et chiffrée (« ~3 orgas paient
un tap pour que ~200 membres aient une app canonique »), elle n'est pas
rouverte ici. Le constat porte sur sa combinaison avec C3 : le péage est
acceptable si la page dit ce qu'il y a derrière. Aujourd'hui elle se tait.

### C5 — Dans tout `/admin`, aucun onglet n'est courant

`BottomNav.correspondance` (`BottomNav.tsx:64-78`) ne connaît que des préfixes
`/mon-espace*`. Sur `/admin/**`, tous les scores valent 0, `actif` vaut `null` :
la barre est visible, aucun onglet ne porte `aria-current`. On voit cinq
destinations et aucune ne dit « vous êtes ici » ; « Accueil » fait sortir de
l'espace orga sans le dire.

Deux commentaires du dépôt décrivent encore un onglet qui n'existe plus :

- `admin/layout.tsx:5-7` — « l'onglet Orga de la barre basse mène ici — la
  barre reste donc visible (onglet Orga courant) » ;
- `admin/taches/page.tsx:18` — « C'est l'onglet "À faire" de la barre basse ».

La dérive est double : le comportement décrit est faux, et la justification
a11y invoquée (navigation cohérente) n'est plus assurée.

### C6 — La barre porte déjà du rôle, mais seulement pour créer

`getFeuilleDonnees` (`src/lib/feuille-creer.ts`) est role-aware : une orga
trouve « Ajouter une actualité » et « Ajouter un atelier » dans le ➕. Donc,
depuis n'importe quelle page de l'app :

- **créer** en tant qu'orga = 1 tap ;
- **traiter** en tant qu'orga = 3 taps et aucun signal.

Le principe « la barre ne porte jamais le rôle » vaut pour les **slots** (et il
doit continuer), pas pour le **contenu** derrière un slot — le ➕ le prouve
déjà. C'est la porte d'entrée de la recommandation §4.

### C7 — Trois noms pour un territoire, deux définitions de « à faire »

Noms du même endroit : « Tableau de bord orga » (la rangée), « Tableau de
bord » (le `h1`), « Espace orga » (le sous-titre et tous les fils d'Ariane),
« espace de modération » (l'e-mail quotidien). Au passage, la page ne montre
aucun chiffre : c'est un menu, pas un tableau de bord.

Définitions de « à faire » : `deriverTachesOrga` en dérive une dizaine de types
(fiches en attente, fiches en sommeil, ateliers, photos bloquées, récompenses,
participantes sans compte, articles en relecture, messages) ; l'e-mail
quotidien `buildOrgaDigestEmail` n'en connaît que **deux** (fiches, messages).
L'e-mail et l'écran ne disent donc pas la même chose. Détail à corriger au
passage : le digest imprime les deux lignes dès que **l'une** est non nulle, ce
qui produit des « 0 fiche à valider ».

### C8 — L'orga est prévenue par e-mail sur une boîte partagée, jamais dans l'app

Le cron de 17 h (`src/app/api/cron/notifications/route.ts`) envoie le digest à
`CONTACT_EMAIL`, une adresse d'équipe — pas à chaque orga. Dans l'app, rien.

Le produit a donc **un moteur de notifications** (`deriverTachesOrga`) et
**trois surfaces** (un e-mail collectif, un compteur sur `/admin`, une page
`/admin/taches`), et la surface qu'on ouvre le plus — la barre — est muette.

### C9 — Deux rangées flottent hors de toute section

« Ma fiche publique » (`:153`) et « Mes articles » (`:159`) vivent entre la
carte marche et le `SegmentLabel` : même composant, même apparence que les
rangées de « Mes accès », mais sans étiquette. À l'œil, on lit une liste de
neuf rangées dont sept seulement sont annoncées. Au lecteur d'écran, c'est du
contenu orphelin entre deux `h2`.

### C10 — Le pied de page du site occupe environ un tiers de l'écran de l'app

`src/app/layout.tsx:194` rend le `Footer` public sur `/mon-espace/**` et
`/admin/**`. Sur la capture, entre « Se déconnecter » et la barre d'onglets :
la baseline de l'asso, « Devenir sponsor », « Nous contacter », trois colonnes
(LE SITE, INFOS, SUIVEZ-NOUS), la ligne légale — de l'ordre de 17 liens dans
une coquille d'app qui a déjà une barre d'onglets **et** un burger dont c'est
le seul rôle.

Vérification faite avant de proposer de le retirer (registre des erreurs :
« avant de masquer une section, vérifier ce qu'elle héberge d'autre ») : le
burger ne porte que `navLinks` + « Accueil du site ». **Mentions légales**,
**Code de conduite**, **Partenaires**, les réseaux et le flux RSS n'existent
que dans ce pied de page. Il faut donc l'**alléger**, pas le supprimer.

### C11 — L'accueil connecté ne dit rien à l'orga non plus

Le fil est pur, sans carte personnelle : c'est la doctrine, elle n'est pas
rouverte. Le constat est cumulatif : ajouté à C3, il rend impossible
d'apprendre qu'il y a du travail avant le deuxième tap, quelle que soit la
porte empruntée.

## 4. La question posée : où doit vivre ce qui attend une action ?

### État des lieux de l'onglet Messages

- Il mène à `/mon-espace/messages` : **sa** boîte à elle (contacts relayés,
  déjà modérés). Volume faible aujourd'hui, et il le restera.
- La boîte qu'une orga **traite** est `/admin/messages`, à trois taps.
  L'onglet nommé « Messages » est donc, pour une orga, la mauvaise boîte.
- Les **bravos** (lot N4, livrés) ne préviennent personne : `src/lib/reactions.ts`
  n'a aucun canal de notification. Une membre applaudie ne l'apprend qu'en
  repassant par le fil, et seulement si la carte est encore là.
- Résultat : un cinquième de la barre canonique est occupé par la surface la
  moins vivante du produit, pour tout le monde.

Le produit a déjà, sans le nommer ainsi, un centre de notifications : le moteur
de tâches. Il lui manque deux choses — être **par personne** (pas seulement
orga) et être **à un tap**.

### Le modèle proposé : deux surfaces, deux verbes

- **Accueil (le fil) = ce qui se passe.** De l'information, aucune action.
  C'est là que les bravos reçus ont leur place le jour où on les notifie
  (« Nora t'a applaudie ») : un bravo n'est pas une tâche, il n'a rien à faire
  dans une liste d'actions.
- **Onglet 4 = « À faire ».** Une liste unique par personne, dérivée comme
  aujourd'hui, avec les puces déjà tranchées le 2026-08-07
  (`Toutes · Perso · Asso · Coach`). Un message reçu y est un item
  (« Répondre à Nawel ») qui pointe vers `/mon-espace/messages` ; des messages
  à modérer y sont un item (« Modérer 3 messages ») qui pointe vers
  `/admin/messages`. C'est déjà littéralement ce que `deriverTachesOrga`
  produit pour la partie asso.

Ce que ce déplacement règle d'un seul coup :

- l'onglet quasi vide reprend un métier, **sans ajouter de slot** : le contenu
  de la liste varie selon la personne, la barre ne bouge pas (le ➕ fait déjà
  exactement ça, C6) ;
- « À faire » **sort** de « Mes accès » : une rangée de moins dans le sac (C1) ;
- l'orga passe de 3 taps sans signal à **1 tap avec un compteur** (C3, C4, C8) ;
- l'unification promise (`Toutes · Perso · Asso · Coach`) atterrit sur une
  surface, au lieu de rester « un lot ultérieur » sans adresse ;
- `/mon-espace/messages` garde son rôle — la page où on **lit** un message —
  et perd seulement son onglet ;
- les membres, pas seulement les orgas, gagnent enfin une notification in-app
  (aujourd'hui : e-mail ou rien).

**Libellé de l'onglet.** « À faire » est le mot que le produit emploie déjà, il
est honnête pour les deux rôles et il reste à la forme positive. Il n'est juste
qu'à condition que les items « pour info » (bravos, arrivées) restent dans le
fil : sinon la liste ment sur son nom. Question Q1 du §6.

### La contrainte technique à ne pas rater

Un compteur sur la barre se paie à **chaque page** de l'espace connecté.
`chargerTachesOrga` fait ~5 requêtes, plus 7 par édition active — une
vingtaine sur deux éditions. Inutilisable pour un badge.

Ce qu'il faut : une fonction de **compte** dédiée, bornée en SQL (des `COUNT`
réunis), au modèle de `countPendingProfiles` / `countPendingContactMessages`
qui existent déjà pour le digest. Et la barre reste dans son `<Suspense>` : le
contenu de la page ne doit jamais attendre le badge.

Deux garde-fous : le compteur n'est **jamais** une pastille de couleur seule
(le nombre entre dans le nom accessible de l'onglet), et le badge dit un
**nombre**, pas un point — « il se passe quelque chose » sans dire combien
oblige à aller voir, c'est-à-dire à repayer le tap qu'on voulait supprimer.

## 5. Recommandations, par lot

### Lot 1 — la page arrête de se taire sur son état (aucune décision produit)

1. **Grouper « Mes accès » en segments nommés**, avec `SegmentLabel` (il existe
   déjà, et il rend un vrai `h2`). Quatre segments, **chacun conditionnel** —
   il ne s'affiche que s'il porte au moins une rangée, donc une membre simple
   n'en voit que deux (§2 des principes : le groupement répond à une
   surcharge, on ne l'impose pas aux écrans légers) :

   | Segment | Rangées |
   |---|---|
   | Ce que je publie | Ma fiche publique, Mes articles |
   | Faire tourner l'asso | À faire, Espace orga, Ateliers de l'édition, Mes coachées |
   | Ma participation | Tremplin {année}, Documents |
   | Mon compte | Réglages, Se déconnecter |

   > **Correction du 2026-08-16.** Ce document recommandait d'abord **deux**
   > segments, « Faire tourner l'asso » puis « Moi », ce dernier absorbant
   > « Ma fiche publique ». À l'écriture, l'ordre se retourne contre la page :
   > la porte vers la fiche tomberait **sous** quatre rangées d'administration,
   > alors que la doctrine la place juste après la marche (conception N1
   > §2.5, rangée 3). Un regroupement qui déplace le sujet de la page a raté
   > sa cible. D'où quatre segments, le personnel d'abord — et l'orga qui
   > vient travailler y gagnera de toute façon plus au lot 2 qu'à deux rangées
   > de défilement.

   → C1, C9.
2. **Faire parler « À faire »** : compteur dans le titre et `flag`, comme sur
   `/admin`. La rangée vit dans son propre `<Suspense>` pour que la page ne
   l'attende pas, et lit la fonction de **compte** (§4), pas le moteur complet.
   → C3.
3. **Désambiguïser les deux Tremplin** : côté orga « Ateliers de l'édition en
   cours » (l'année est déjà dans le sous-titre), côté participante « Ma
   participation · Tremplin 2026 ». Le groupement du point 1 fait le reste.
   → C2.
4. **Un seul nom** : « Espace orga » sur la rangée, dans le `h1` et dans les
   fils d'Ariane. « Tableau de bord » disparaît — la page est un menu et
   n'affiche aucun chiffre. → C7.
5. **Rallumer un onglet dans `/admin`** : ajouter `/admin` aux `prefixes` de
   l'onglet Profil (une ligne, aucun slot nouveau, et c'est cohérent : on est
   entré dans l'espace orga par le profil). Corriger dans la foulée les deux
   commentaires périmés. → C5.
6. **Alléger le pied de page dans la coquille d'app** (`/mon-espace/**`,
   `/admin/**`) : garder la ligne légale, « Mentions légales » et « Code de
   conduite », renvoyer le reste au burger. Ne rien retirer avant d'avoir
   vérifié que la destination existe ailleurs (C10). → C10.
7. **Aligner l'e-mail quotidien sur le moteur** : lister ce que
   `deriverTachesOrga` dérive, et taire les lignes à zéro. → C7.

### Lot 2 — l'onglet Messages devient « À faire »

> Le nom du concept a bougé le 2026-08-16 : « ce qui m'attend » était trop
> long et peu courant, et c'était un second nom pour une chose que le produit
> appelle déjà **« À faire »**. Tranché avec Q1 et Q2 de la conception.

Le déplacement décrit au §4 : liste unifiée par personne, puces
`Toutes · Perso · Asso · Coach`, compteur sur l'onglet, `/mon-espace/messages`
conservée comme page de lecture, « À faire » retiré de « Mes accès ». C'est le
lot qui répond vraiment à « la page est illogique pour les orga » — le lot 1
soigne la page, le lot 2 rend la page moins nécessaire.

### Lot 3 — les notifications personnelles, et la roue crantée des éditions

Les bravos reçus arrivent dans le **fil** ; les messages transmis et les
demandes d'aide (N5) arrivent dans la **liste**. À ce moment-là seulement, la
question du libellé de l'onglet se referme pour de bon.

**La roue crantée sur le hub d'une édition** (proposée le 2026-08-16). Le hub
`/admin/tremplins/[edition]` se termine par « Réglages de l'édition »
(Informations, Statut, Suppression) plus « Dupliquer cette édition » : quatre
affordances et un arrêt de lecture, pour des choses qu'on règle une fois. Une
roue dans l'en-tête, menant à une **page** `/reglages` (jamais un menu
déroulant : ce serait un second modèle de navigation, la raison même pour
laquelle `AccountMenu` a maigri), les descend d'un niveau. Y va ce qui se
règle une fois et vaut pour toute l'édition ; Photos, Ressources et Finale
restent des domaines de contenu.

Trois conditions, dans l'ordre où elles mordent :

1. **Le signal ne part pas avec les rangées.** « Statut » survit seul : le
   moteur en fait déjà une tâche (« Ouvrir au public l'édition … »).
   « Informations » non — le flag orange « Finale sans date » est le seul
   endroit qui le dise. Il faut donc la tâche **« Donner une date à la
   finale »**, sur le patron de « Donner une date à un atelier ». Ensuite la
   roue reste muette, comme la rangée Messages du menu Gérer reste neutre.
2. **Un vrai nom accessible** (`aria-label`), une cible ≥ 44 px, et un **SVG à
   trait épais** dans `src/components/icons/` — pas l'emoji ⚙️, dont le trait
   fin disparaît au soleil (§9 des principes). Précédents dans le dépôt : le
   burger, la loupe, l'avatar d'`AccountMenu`.
3. **Sur l'édition, pas sur l'atelier.** Le plafond « deux actions pour
   supprimer » (§10) a été écrit pour le cas de l'atelier créé en double,
   enterré sous cinq écrans : y ajouter une roue rejouerait l'erreur. Une
   édition est au palier 3, on veut qu'elle soit loin. Et sur la fiche
   atelier, « Informations » porte la date et le lieu — ce qu'on consulte et
   corrige le plus, pas un réglage.

**Pourquoi au lot 3 et pas au lot 1** : la roue ne répond à aucun des onze
constats. Elle allège de ~400 px un écran situé deux niveaux sous le point où
l'orga se perd. Et l'ordre joue contre elle : une fois le lot 2 livré, on
arrive sur le hub d'une édition **par une tâche**, en lien profond, pour faire
une chose précise — le poids de la section réglages se juge mieux à ce
moment-là. Seule la tâche « Donner une date à la finale » sort tout de suite :
c'est un trou du moteur, elle vaut par elle-même (C7).

## 6. À trancher avant de coder

- **Q1 — le libellé de l'onglet 4.** « À faire » (le mot du produit, honnête
  pour les deux rôles) tient si et seulement si les bravos et les arrivées
  restent dans le fil. Sinon il faut un mot plus large, et « Messages » ne
  conviendra pas davantage.
- **Q2 — les bravos : fil ou liste ?** Recommandation : le fil (un bravo ne
  demande rien). C'est la décision qui commande Q1.
- **Q3 — deux segments ou trois** dans « Mes accès » : l'accompagnement
  compte-t-il comme « faire tourner l'asso » ?
- **Q4 — « Espace orga » partout** : d'accord pour faire disparaître « Tableau
  de bord » du vocabulaire ?
- **Q5 — la liste d'une orga s'ouvre-t-elle sur `Toutes` ou sur `Perso` ?**
  `Toutes` sert le travail, `Perso` sert la doctrine (« on veut que les membres
  passent peu de temps ici »). Recommandation : `Toutes`, parce qu'une orga
  qui ouvre l'app vient presque toujours pour l'asso.

## 7. Hors périmètre

Le fil lui-même (doctrine « zéro carte personnelle », non rouverte), le
partage de la fiche publique, la messagerie interne entre membres (N5), les
commentaires (N6), le thème clair. Le tap supplémentaire vers l'espace orga
n'est pas rouvert non plus : il est chiffré et assumé, le lot 2 le rend
indolore en donnant à l'orga un signal avant de le payer.
