# Conception fonctionnelle — « Mon profil » rangé, et l'onglet « À faire »

> Statut : **VALIDÉE par Cateline le 2026-08-16**, maquette HTML jugée sur
> téléphone. Suite : la conception technique vit dans
> `docs/conception-technique-profil-et-a-faire.md`.
>
> **Revue le 2026-08-16** sous quatre angles (sécurité, RGPD, RGAA,
> accessibilité cognitive) : `docs/revue-conception-a-faire-2026-08.md`.
> Quatre points de CE document sont remis en cause et attendent un arbitrage
> — le libellé des puces (§4.2, trois grammaires pour quatre contrôles), le
> mot « Pour l'association » qui contredit « Mon bénévolat » à un tap de
> distance, ce que devient l'e-mail quotidien (§4.4) et, surtout, le fait que
> l'onglet 4 emporte la **seule** porte connue vers `/mon-espace/messages`.
> L'étape A reste livrée et inchangée.
>
> Historique du statut :
> les neuf questions ont été tranchées une à une, et le dernier risque ouvert
> (§5 P7, le groupe sans étiquette) est tombé sur écran réel — « comme on a
> *Mon profil*, ça flotte pas ».
>
> **Rien de la conception n'est codé.** Seules les corrections d'accessibilité
> cognitive du §5 (P1 `SegmentLabel`, P2 `NavRow`, P6 « étape »), indépendantes
> des questions, sont livrées — plus leur passage en règles opposables dans
> `docs/principes-conception-ui.md`. Décline l'audit `docs/audit-ux-profil-orga-2026-08.md` (onze
> constats) et respecte `docs/conception-espace-fil-navigation.md` §11
> (conception détaillée → revue → maquette → TDD) et §3 (un accès = un
> objectif). La conception TECHNIQUE viendra après validation de celle-ci.
>
> Rappel de méthode, payé cher le 2026-08-07 : **une maquette envoyée n'est
> pas une maquette validée.** Les questions du §9 attendent une réponse avant
> la première ligne de code.
>
> Créée le **2026-08-16**.

## 1. D'où ça vient

Le chantier navigation (N1 → N4) est fermé. L'audit du 2026-08-15 a passé
`/mon-espace/profil` au crible depuis un compte **orga + coach + speakeuse**
et en a sorti onze constats. Trois commandent tout le reste :

- **C1** — « Mes accès » aligne huit rangées de même graisse qui appartiennent
  à quatre mondes ; rien ne dit qu'on change de monde entre la 3ᵉ et la 4ᵉ.
- **C3** — la rangée « À faire » est muette. Savoir s'il y a du travail coûte
  deux taps ; modérer un message, cinq.
- **C8/C10** — l'orga est prévenue par un e-mail vers une adresse d'équipe,
  jamais dans l'app ; et l'onglet **Messages** occupe un cinquième de la barre
  canonique pour la surface la moins vivante du produit.

## 2. Ce qu'on change, en une phrase

**Le profil range ses accès par monde, et « À faire » quitte le fond d'une
page pour devenir un onglet de la barre.**

**De quel onglet on parle.** La barre du bas a cinq emplacements, les mêmes
pour tout le monde. Ce document appelle « onglet 4 » celui qui porte
aujourd'hui **Messages** :

```
 🏠        📅        ➕       ✉️       (photo)
Accueil  Agenda    Créer   Messages   Profil
   1        2        3        4          5
```

Deux surfaces, deux verbes — c'est toute la conception :

| Surface | Verbe | Contenu |
|---|---|---|
| **Accueil** (onglet 1) | ce qui **se passe** | le fil, inchangé. Les bravos reçus y arriveront (lot 3) |
| **Onglet 4**, aujourd'hui **Messages** | ce qui **attend une action** | une liste par personne : mes tâches, celles de l'asso si je suis orga, celles de mes coachées si je suis coach. Les messages y deviennent une ligne parmi d'autres |
| **Profil** (onglet 5) | **moi et mes portes** | l'étape, puis des rangées groupées par monde |

La barre reste **canonique** : cinq emplacements identiques pour tout le
monde. C'est le CONTENU derrière l'emplacement qui varie selon la personne —
exactement ce que le ➕ fait déjà (une orga y trouve « Actualité » et
« Atelier »). Aucun slot ne s'ajoute, aucun ne se déplace.

## 3. Maquettes fil de fer (téléphone, 390 px)

> **Maquette HTML** : `docs/maquettes/profil-et-a-faire.html` — cinq écrans
> dans la palette réelle du produit, à ouvrir sur un téléphone. Les fils de fer
> ci-dessous restent la version lisible en revue de code ; le HTML est celui
> qui juge (P1, P7, le poids réel d'un écran).

> Convention de lecture : la maquette 3.1 reproduit l'écran **d'avant**, avec
> son rendu d'origine (étiquettes en capitales grises de 10,5 px). Les
> maquettes 3.2 et 3.3 montrent la cible, étiquettes en casse normale — les
> composants ont été corrigés le 2026-08-16, voir §5 P1 et P2.

### 3.1 « Mon profil » — AUJOURD'HUI, compte orga + coach + speakeuse

C'est la capture qui a lancé l'audit.

```
┌────────────────────────────────┐
│ ☰       TECH SPEAK'HER      🔍 │
├────────────────────────────────┤
│ (CP)  Mon profil   [ Privé ]   │
│       Cateline P. · Fiche :    │
│       publiée                  │
│                                │
│ ╭────────────────────────────╮ │
│ │ TA PROCHAINE MARCHE        │ │  ← métaphore + 10,5 px
│ │ Ta prochaine scène est le  │ │    en capitales grises
│ │ 22 octobre 2026.           │ │
│ │ [ Voir mon agenda ]        │ │
│ ╰────────────────────────────╯ │
│                                │
│ ┌ Ma fiche publique        › ┐ │  ← flotte, sans étiquette (C9)
│                                │
│ MES ACCÈS                      │
│ ┌ À faire                  › ┐ │  ┐
│ │ Les tâches de l'asso…      │ │  │
│ ┌ Tableau de bord orga     › ┐ │  │ l'asso
│ │ Speakeuses, contenus…      │ │  │
│ ┌ Ateliers · Tremplin 2026 › ┐ │  │
│ │ L'accès direct aux…        │ │  ┘
│ ┌ Mes coachées             › ┐ │  ← accompagner
│ │ Les speakeuses que tu…     │ │
│ ┌ Tremplin 2026            › ┐ │  ┐ MA participation
│ │ Ta participation…          │ │  │ (même nom que
│ ┌ Documents                › ┐ │  │  la rangée 3 !)
│ │ Retours du jury…           │ │  ┘
│ ┌ Réglages                 › ┐ │  ┐ mon compte
│ │ Méthodes de connexion…     │ │  │
│ ┌ Se déconnecter             ┐ │  ┘
│                                │
│ ~~~ pied de page du site ~~~   │  ← 3 colonnes, ~17 liens (C10)
│ ~~~ (≈ 1/3 de l'écran)  ~~~    │
├────────────────────────────────┤
│  🏠     📅    ➕    ✉️    (CP)  │
│Accueil Agenda     Messages Profil│
└────────────────────────────────┘
```

Quatre mondes, une étiquette. « À faire » ne dit rien de son état. Deux fois
« Tremplin 2026 », séparés par « Mes coachées ».

### 3.2 « Mon profil » — CIBLE, même compte

```
┌────────────────────────────────┐
│ ☰       TECH SPEAK'HER      🔍 │
├────────────────────────────────┤
│ (CP)  Mon profil   [ Privé ]   │
│       Cateline P. · Fiche :    │
│       publiée                  │
│                                │
│ ╭────────────────────────────╮ │
│ │ Ta prochaine étape         │ │
│ │ Ta prochaine scène est le  │ │
│ │ 22 octobre 2026.           │ │
│ │ [ Voir mon agenda ]        │ │
│ ╰────────────────────────────╯ │
│                                │
│ ┌ Ma fiche publique        › ┐ │  ← le sujet de la page,
│ ┌ Mes articles             › ┐ │    attaché à l'en-tête,
│ │ Brouillons, relecture…     │ │    sans étiquette (§4.0)
│                                │
│ Mon bénévolat                  │
│ ┌ Espace organisatrices    › ┐ │  ← « À faire » est PARTI
│ │ Speakeuses, contenus,      │ │    (il vit sur l'onglet
│ │ messages, tremplins        │ │     « À faire »)
│ ┌ Ateliers du tremplin     › ┐ │
│ │ en cours                   │ │
│ │ Tremplin 2026              │ │
│ ┌ Mes coachées             › ┐ │
│ │ Les speakeuses que tu      │ │
│ │ accompagnes, tes ateliers  │ │
│                                │
│ Ma participation               │
│ ┌ Tremplin 2026            › ┐ │
│ │ Ateliers, ressources et    │ │
│ │ retour du jury             │ │
│ ┌ Documents                › ┐ │
│ │ Retours du jury et         │ │
│ │ ressources, par édition    │ │
│                                │
│ Mon compte                     │
│ ┌ Réglages                 › ┐ │
│ │ Méthodes de connexion,     │ │
│ │ e-mails, compte            │ │
│ ┌ Se déconnecter             ┐ │
│                                │
│ ─ © 2026 Tech Speak'Her ─      │  ← pied allégé (C10)
│   Mentions légales ·           │
│   Code de conduite             │
├────────────────────────────────┤
│  🏠     📅    ➕    ☑3    (CP)  │
│Accueil Agenda    À faire  Profil│
└────────────────────────────────┘
```

Ce que la maquette dit, et qu'il faut lire avant de valider :

- **Le personnel reste en tête, et sans étiquette.** La fiche et les articles
  sont le sujet de la page : ils restent attachés à l'en-tête, comme la
  doctrine place la porte vers la fiche juste après l'étape (conception N1
  §2.5, rangée 3). Les faire descendre sous quatre rangées d'administration
  aurait déplacé le sujet de la page. (L'audit recommandait d'abord l'inverse ;
  corrigé, avec la raison, dans le doc d'audit.)
- **« À faire » n'est plus là.** C'est le point qui fait tout basculer, et
  c'est la Q1 du §9.
- **Les deux « Tremplin 2026 » sont désambiguïsés deux fois** : par le segment
  qui les sépare, et par le titre côté orga (« Ateliers du tremplin en
  cours », l'année passant en sous-titre).
- **Un seul nom : « Espace organisatrices »** (C7). Aujourd'hui la même chose
  s'appelle « Tableau de bord orga » sur la rangée, « Tableau de bord » dans le
  titre de la page, « Espace orga » dans les fils d'Ariane et « espace de
  modération » dans l'e-mail quotidien — quatre noms à retenir pour un endroit.
  Le mot entier plutôt que « orga » : voir Q6.

### 3.3 « Mon profil » — CIBLE, speakeuse « simple » (le cas majoritaire)

La preuve qu'on n'alourdit pas les écrans légers : **un segment ne s'affiche
que s'il porte une rangée** (principes UI §2 — le groupement répond à une
surcharge, on ne l'impose pas).

```
┌────────────────────────────────┐
│ (AL)  Mon profil   [ Privé ]   │
│       Ada Lovelace · Fiche :   │
│       publiée                  │
│                                │
│ ╭────────────────────────────╮ │
│ │ Ta prochaine étape         │ │
│ │ Tes talks sont prêts. Vise │ │
│ │ une scène…                 │ │
│ │ [ Déclarer une scène ]     │ │
│ ╰────────────────────────────╯ │
│                                │
│ ┌ Ma fiche publique        › ┐ │
│                                │
│ Mon compte                     │
│ ┌ Réglages                 › ┐ │
│ ┌ Se déconnecter             ┐ │
└────────────────────────────────┘
```

Trois rangées, **une** étiquette — le même compte qu'aujourd'hui (« Mes
accès »). La refonte ne coûte donc rien au cas majoritaire : c'est ce que la
première version de ce document ratait, avec deux étiquettes pour trois
rangées.

### 3.4 L'onglet « À faire » — vue orga

```
┌────────────────────────────────┐
│ ☰       TECH SPEAK'HER      🔍 │
├────────────────────────────────┤
│ À faire (5)                    │
│ Tout ce qui attend une action. │
│ La liste se met à jour toute   │
│ seule.                         │
│                                │
│ (Tout) (Pour moi)              │  ← mots ENTIERS : « Perso »
│ (Pour l'association)           │    et « Asso » étaient des
│ (Mes coachées)                 │    mots tronqués (§6, V1)
│                                │
│ ┌ Valider la fiche d'Ada     ┐ │
│ │ Association     En retard   │ │
│ ┌ Modérer 3 messages reçus   ┐ │
│ │ via les fiches             │ │
│ │ Association                 │ │
│ ┌ Pointer les présences de   ┐ │
│ │ « Pitcher son talk »       │ │
│ │ Association · Tremplin 2026 │ │
│ ┌ Répondre à Nawel           ┐ │
│ │ Pour moi                    │ │
│ ┌ Confirmer un talk repéré   ┐ │
│ │ sur Sessionize             │ │
│ │ Pour moi                    │ │
│                                │
├────────────────────────────────┤
│  🏠     📅    ➕    ☑5    (CP)  │
│Accueil Agenda    À faire  Profil│
└────────────────────────────────┘
```

### 3.5 L'onglet « À faire » — vue speakeuse simple, rien en attente

```
┌────────────────────────────────┐
│ À faire                        │
│                                │
│ ┌────────────────────────────┐ │
│ │ Rien en attente.           │ │
│ │ Tout roule.                │ │
│ │                            │ │
│ │ Ce qui se passe chez nous  │ │
│ │ vit sur l'Accueil.         │ │
│ └────────────────────────────┘ │
├────────────────────────────────┤
│  🏠     📅    ➕    ☑     (AL)  │
│Accueil Agenda    À faire  Profil│
└────────────────────────────────┘
```

Le vide **renvoie vers le fil** : sans ça, une membre qui n'a jamais rien à
faire trouverait un onglet mort là où elle avait une boîte aux lettres.

## 4. Règles fonctionnelles

### 4.0 Le wording des étiquettes : UN seul patron

Première version de ce document : « Ce que je publie », « Faire tourner
l'asso », « Ma participation », « Mon compte » — une proposition relative, un
infinitif et deux possessifs sur le même écran. Trois grammaires pour quatre
étiquettes : la lectrice doit changer de mode de lecture à chaque titre, ce
qui est précisément la charge qu'on cherche à retirer.

**Règle : une étiquette de segment est « Mon / Ma / Mes + un nom courant »** —
courant ET entier, jamais tronqué (« asso », « orga »).
Pas de verbe, pas de proposition, deux mots quand c'est possible. C'est déjà
le patron du produit partout ailleurs — Mon espace, Mon profil, Ma fiche
publique, Mes articles, Mes talks, Mes coachées, Mes messages.

**Et le possessif doit être VRAI.** Corollaire ajouté le 2026-08-16, sur
retour de Cateline : la première version nommait le groupe orga « Mon asso »,
ce qui fait de l'orga la propriétaire de l'association. Elle ne l'est pas —
une association loi 1901 n'appartient à personne, et surtout pas à celles qui
la font tourner. On nomme donc **ce qui est à soi** (un compte, une
participation, un bénévolat), jamais le collectif dont on est membre. La règle
a un effet secondaire utile : elle interdit d'avance « Mon tremplin », « Ma
communauté », « Mon association ».

Corollaire tiré au passage : **on ne fabrique pas un mot pour avoir une
étiquette.** Le premier groupe (fiche publique, articles) n'a pas de nom
simple — « Ma vitrine » est une métaphore commerciale, « Mes publications »
est du jargon, « Mes contenus » est le vocabulaire des orgas. C'est le signe
que ce groupe n'a pas à être nommé : ces deux rangées sont **le sujet de la
page**, elles restent attachées à l'en-tête, sans étiquette. On passe donc de
quatre segments à **trois**.

> Le reste du produit ne suit pas encore cette règle : « Mes accès » (profil),
> « Gérer l'édition » / « Réglages de l'édition » (hub tremplin), « Gérer
> l'atelier » (fiche atelier) — trois patrons de plus. Hors périmètre ici,
> mais la règle a vocation à rejoindre `docs/principes-conception-ui.md`.

### 4.1 Les segments du profil

| Segment | Rangées | S'affiche si |
|---|---|---|
| *(sans étiquette)* | Ma fiche publique · Mes articles | fiche existante, ou ≥ 1 article |
| **Mon bénévolat** | Espace organisatrices · Ateliers du tremplin en cours · Mes coachées | orga ou coach |
| **Ma participation** | {édition} · Documents | inscrite à ≥ 1 édition |
| **Mon compte** | Réglages · Se déconnecter | toujours |

Trois étiquettes, trois fois le même patron, deux mots chacune — et trois
possessifs vrais : **le bénévolat est le mien, la participation est la mienne,
le compte est le mien.** Aucun ne prétend posséder l'association ni le
Tremplin. Une speakeuse simple n'en voit qu'**une** (« Mon compte »), soit le
même nombre qu'aujourd'hui avec « Mes accès ».

« Mon bénévolat » couvre le travail donné à l'association — orga **et** coach,
qui sont bénévoles au même titre ; « Ma participation » couvre ce qu'on vit
comme participante du Tremplin. La frontière n'est pas le sujet (les deux
parlent du Tremplin) mais la place qu'on y tient : ce qu'on donne, ce qu'on
reçoit. C'est aussi ce qui lève le recouvrement entre une coach et une
ancienne participante.

> Le mot a un risque, qu'il faut voir avant de valider : **« bénévolat » est
> d'un registre un peu administratif**, là où « asso » était familier. Le
> deuxième choix serait « Mon engagement » — même vérité du possessif, ton
> plus chaleureux, mais plus abstrait, ce qui coûte précisément aux publics du
> §5. Q4.

Ordre fixe, jamais réordonné selon le rôle : une page dont les sections
changent de place selon qui regarde n'est plus apprenable.

Les rangées sans étiquette gardent un titre de section **`sr-only`** : le plan
de la page reste complet au lecteur d'écran, sans ajouter un titre visible qui
ne sert personne.

### 4.2 L'onglet 4

- **Une liste, une personne.** La même dérivation pour toutes ; ce qui change,
  c'est ce qu'on a le droit de voir. Une orga voit les tâches de l'asso parce
  qu'elle est orga, pas parce qu'elle a un onglet différent.
- **Les puces `Tout · Pour moi · Pour l'association · Mes coachées`** ne
  s'affichent que si la personne a au moins deux familles. Une speakeuse simple
  n'en a qu'une : aucune puce. (Les libellés d'origine — `Toutes · Perso ·
  Asso · Coach` — portaient deux mots tronqués et aucun patron : §6, V1.)
- **Un message est un item.** « Répondre à Nawel » (perso) mène à
  `/mon-espace/messages` ; « Modérer 3 messages » (asso) mène à
  `/admin/messages`. Les deux boîtes existent toujours, elles cessent d'être
  des destinations d'onglet.
- **Le compteur est un NOMBRE**, jamais un point : « il se passe quelque
  chose » sans dire combien oblige à aller voir, c'est-à-dire à repayer le tap
  qu'on voulait supprimer. Il entre dans le nom accessible de l'onglet
  (« À faire, 5 en attente »), jamais dans une pastille de couleur seule.
- **Le vide est un état, dit en mots** : « Rien en attente. Tout roule. »

### 4.3 Wording

Un seul nom par territoire : **« Espace organisatrices »** sur la rangée du
profil, dans le titre de `/admin` et dans les fils d'Ariane. « Tableau de bord » disparaît
du vocabulaire — la page est un menu et n'affiche aucun chiffre.

Formes positives partout (« Rien en attente », « Aucun message »), jamais de
« ne … pas ».

### 4.4 Ce que l'e-mail quotidien devient

Il dit aujourd'hui deux choses (fiches à valider, messages à modérer) quand le
moteur en dérive une dizaine, et il imprime « 0 fiche à valider » dès que
l'autre ligne est non nulle. Il doit **lire la même liste que l'écran** et
taire les lignes vides : un canal du moteur, pas une seconde définition.

## 5. Accessibilité cognitive : ce que les maquettes doivent corriger

Le public inclut des personnes avec une déficience intellectuelle légère, un
TDAH ou un TSA. Rien de ce qui suit n'est vu par `axe` ni par
`contrast.test.ts` : c'est une relecture à la main des maquettes du §3, avec
la checklist COGA des principes UI et « Making Content Usable » (W3C) en
regard. Sept points, du plus mordant au plus discret.

### P1 — L'étiquette de groupe était le texte le moins lisible de l'écran

> **CORRIGÉ le 2026-08-16** (indépendant des questions du §8) :
> `SegmentLabel` rend désormais `text-sm font-bold text-cream`, casse du texte
> respectée. Gardé par `src/__tests__/segment-label.test.tsx`.
>
> **Insuffisant, complété le même jour.** La relecture RGAA a montré que la
> correction était vraie au niveau du composant et fausse au niveau de
> l'écran : `SegmentLabel` n'est appelé que 7 fois, et la forme condamnée
> (tout-capitale, tailles sous 12 px) survivait **plus de 80 fois** ailleurs,
> dont ~29 sur des `h2`/`h3`. Un test de composant ne garde qu'un composant.
> La coquille d'app est reprise, et `typographie-lisible.test.ts` gèle le
> reste : la CI refuse toute nouvelle occurrence, la liste ne peut que
> raccourcir.

`SegmentLabel` rendait **10,5 px, TOUT EN MAJUSCULES, interlettrage 0,14 em,
en gris**. Trois obstacles cumulés, sur l'élément même qui est censé réduire la
charge :

- **la taille** est sous tout seuil de lecture confortable ;
- **les majuscules effacent la silhouette du mot** — on reconnaît la forme
  d'un mot avant d'en lire les lettres, et le tout-capitale supprime cet appui.
  Il ralentit tout le monde et bloque une lectrice en difficulté ;
- **le gris** retire l'emphase à ce qui structure la page.

C'est aussi une infraction à une règle déjà écrite du dépôt (principes §9 :
« hiérarchie par la taille et la graisse, jamais par un gris plus pâle »).

→ **Casse normale** (« Mon bénévolat », pas « MON BÉNÉVOLAT »), **≥ 14 px**,
graisse 600-700, couleur `cream` — sûre en contraste sur tous les fonds
sombres de la palette. Le composant est partagé : la correction profite aux
quatre écrans qui l'emploient (profil, réglages, espace coach).

### P2 — Un intitulé de navigation ne se tronque jamais

> **CORRIGÉ le 2026-08-16** : le défaut de `titleClamp` passe de 1 à 2, la
> règle vit dans le commentaire de la prop, et les trois valeurs sont gardées
> par `src/__tests__/nav-row.test.tsx`.

`NavRow` coupait le titre sur **une** ligne (`truncate`). « Ateliers du tremplin
en cours » devient « Ateliers du tremplin en c… ». Qui ne peut pas deviner la
fin ne peut pas choisir où aller.

→ Règle : **on tronque une donnée (un nom, un sujet de talk), jamais une
destination.** Le défaut ne cache plus rien qu'on puisse éviter ; une rangée
de navigation dont l'intitulé dépasse deux lignes prend `titleClamp="none"`,
et une donnée dense assume `titleClamp={1}`.

### P3 — Le pictogramme doit dire le même mot que l'étiquette

> **Maquettes corrigées le 2026-08-16** (§6, V2) : la cloche est devenue une
> liste cochée dans les trois fils de fer.

Ma maquette 3.2 mettait **🔔 sous « À faire »**. Une cloche dit « notification »,
le mot dit « à faire » : deux concepts pour un emplacement. Qui s'appuie sur
le pictogramme paie l'écart à chaque fois.

→ Le pictogramme **reprend le mot** : une coche ou une liste cochée pour « À
faire ». Et un **SVG à trait épais** plutôt qu'un emoji, dont le dessin change
d'un téléphone à l'autre (et dont le trait fin disparaît au soleil, principes
§9). À faire pour les cinq onglets, pas seulement le quatrième.

### P4 — Un filtre ne doit jamais être un péage

Les puces (quel que soit leur libellé) posent un choix à quatre branches
**avant** d'agir. Qui ne sait pas dans quelle famille tombe sa tâche est
bloqué par l'outil censé l'aider.

→ La liste s'ouvre sur **`Tout`**, complète, sans rien à décider ; les puces
sont un raffinement, jamais une porte. Elles **disparaissent** quand la
personne n'a qu'une famille — c'est-à-dire pour la majorité des membres. Et le
compteur de l'onglet compte toujours `Tout` : un compteur qui parlerait
d'une vue filtrée mentirait.

### P5 — La liste doit pouvoir finir

Un compteur qui ne retombe jamais à zéro devient un reproche permanent :
culpabilité côté TDAH, règle qu'on ne peut pas refermer côté TSA.

→ « Rien en attente. Tout roule. » est un **état d'arrivée**, il doit rester
atteignable. Deux conséquences concrètes : aucune tâche perpétuelle (une ligne
qu'aucun geste ne résout n'a rien à faire dans la liste), et le plafond
d'affichage **replie** en annonçant son compte exact, il ne masque jamais.

### P6 — Les métaphores et les mots tronqués se lisent au premier degré

> **TRANCHÉ par Cateline le 2026-08-16 : on corrige les deux.**

« Ta prochaine **marche** » demandait de se représenter un escalier pour
comprendre qu'il s'agit d'une étape — et « marche » est en plus ambigu en
français (une marche, marcher, ça marche), là où le corps de la carte est
littéral (« Ta prochaine scène est le 22 octobre 2026 »). Devenu **« Ta
prochaine étape »** : « étape » est une métaphore morte, lexicalisée, qui
s'emploie au sens propre dans la langue courante.

Le module suit le mot — `prochaine-etape.ts`, `prochaineEtape`, `Etape`,
`etape-title` : laisser le code dire « marche » quand l'écran dit « étape »
aurait recréé les deux noms pour une chose que l'audit reproche ailleurs (C7).

« Mon **asso** » est traité au §4.0, et pour une raison de plus que la
troncature du mot : le possessif y était faux.

→ Règle qui reste : le corps de la carte doit rester littéral **à chaque
état** de l'étape.

### P7 — Le groupe sans étiquette est un risque ouvert, pas un acquis

Le §4.0 retire l'étiquette des deux premières rangées et pose un titre
`sr-only`. C'est réglé pour un lecteur d'écran ; pour qui s'appuie sur la
structure **visuelle**, deux rangées identiques aux autres et sans titre, c'est
le constat C9 de l'audit à moitié refermé.

→ À vérifier **sur écran réel**, pas sur fil de fer. Deux issues, dans l'ordre
de préférence : les coller au bloc d'en-tête (aucun espace, elles se lisent
comme la suite de la carte) ; sinon leur donner une étiquette et accepter le
moins mauvais mot. Je le signale comme risque, pas comme décision.

### Comment on vérifie

Rien de tout ça ne tombe en CI. Trois niveaux, du plus dur au plus humain :

1. **Testable** : aucun intitulé de navigation tronqué ; taille et casse des
   étiquettes de segment ; le compteur de l'onglet égale le nombre de lignes
   de la vue `Tout`.
2. **Revue à la main** avant PR : la checklist COGA des principes UI, plus les
   sept points ci-dessus.
3. **Avec des personnes concernées** — 2 ou 3 suffisent à révéler l'essentiel
   (principes UI, checklist COGA). C'est le seul niveau qui juge vraiment P4,
   P6 et P7.

## 6. La conception passée au crible de ses propres règles

Les règles du §5 sont devenues opposables dans
`docs/principes-conception-ui.md` le 2026-08-16. Question posée aussitôt par
Cateline, et la seule qui vaille : **est-ce que cette conception les
respecte ?** Relecture ligne à ligne des maquettes. **Non — six manquements**,
dont deux que les règles condamnent nommément.

### V1 — Mes propres puces de filtre portaient deux mots tronqués

`Toutes · Perso · Asso · Coach`. Je venais d'écrire « aucun mot tronqué dans
un intitulé » en citant « asso » comme contre-exemple, et « asso » était dans
ma maquette, deux écrans plus haut. Ces puces héritent d'une décision du
2026-08-07 : je les avais recopiées sans les relire.

Second défaut, indépendant : **aucun patron.** « Toutes » est un quantificateur,
les trois autres sont des domaines — quatre étiquettes, deux grammaires.

→ **CORRIGÉ** : `Tout · Pour moi · Pour l'association · Mes coachées`. Mots
entiers, et le même patron (ce que la tâche concerne). Les mêmes mots servent
d'étiquette sur chaque ligne de la liste.

### V2 — Le pictogramme que j'avais moi-même condamné est resté

Le §5 P3 dit qu'une cloche au-dessus de « À faire » donne deux concepts pour
un emplacement. J'ai écrit la règle et laissé **🔔 dans les trois maquettes**.
Une règle qu'on n'applique pas à la page où on l'écrit ne tiendra nulle part.

→ **CORRIGÉ** : liste cochée dans les fils de fer 3.2, 3.4 et 3.5. Le SVG
reste à dessiner à l'implémentation.

### V3 — Les sous-titres n'ont aucun patron

J'ai unifié les étiquettes de segment et oublié la famille juste en dessous :

| Rangée | Sous-titre | Forme |
|---|---|---|
| Espace organisatrices | « Speakeuses, contenus, messages, tremplins » | énumération |
| Mes coachées | « Les speakeuses que tu accompagnes, tes ateliers » | proposition + nom |
| Mes articles | « Brouillons, relecture et publiés » | deux noms + un adjectif |
| Documents | « Retours du jury et ressources, par édition » | énumération + complément |

→ **À TRANCHER** (Q8, où le tableau rangée par rangée est écrit) : un
sous-titre dit ce qu'on trouve derrière la rangée, sans verbe conjugué et sans
« tu ».

### V4 — « CFP » est un sigle, et il est déjà en production

La carte « Ta prochaine étape » affiche « des talks repérés sur tes profils
**CFP** attendent ta confirmation ». Le sigle suppose qu'on sait ce qu'est un
*call for papers*. Or l'association existe précisément pour celles qui n'ont
**pas encore** proposé de talk : c'est le public le moins susceptible de
connaître le mot, et il tombe sur lui dans le seul CTA de la page.

→ **À TRANCHER** (Q9). Ma première proposition — « repérés sur Sessionize » —
a été arrêtée par Cateline : la roadmap prévoit **Notist** comme troisième
source du moissonneur, donc le libellé aurait menti dans quelques semaines.
**Un intitulé ne cite pas une implémentation qui va bouger** : on dit « On a
repéré N talks à ton nom ».

### V5 — Le groupe sans étiquette : TRANCHÉ, il reste sans étiquette

> **Jugé sur écran réel le 2026-08-16**, maquette ouverte au téléphone.
> Verdict de Cateline : « comme on a *Mon profil*, ça flotte pas ». **Le titre
> de la page fait office d'étiquette pour le premier groupe** — c'est ce que
> le papier ne pouvait pas dire, et c'est ce qui referme P7. La règle rejoint
> `docs/principes-conception-ui.md` : on n'ajoute une étiquette qu'à partir du
> moment où un groupe s'éloigne du sujet de la page.

Le raisonnement d'origine, conservé :

Le §4.0 laisse les deux premières rangées sans étiquette au motif qu'aucun mot
simple n'existe. La règle « on ne fabrique pas un mot pour avoir une
étiquette » le permet. Mais celle d'à côté — « un seul patron par famille
d'intitulés » — pousse dans l'autre sens : trois groupes nommés et un groupe
muet, ce sont deux traitements pour une même famille.

→ **FERMÉ** par l'écran réel, comme prévu. Ce que le fil de fer ne montrait
pas : à l'écran, l'en-tête, la carte d'étape et les deux rangées forment un
seul bloc — « Mon profil » les couvre.

### V7 — L'étiquette collait au groupe du DESSUS (trouvé au même moment)

Une règle CSS de la maquette (`.segment:first-of-type { margin-top: 0 }`)
annulait l'espace au-dessus de la **première** étiquette : « Mon bénévolat »
se retrouvait collé à la carte « Mes articles » et éloigné du groupe qu'il
introduit. Le regroupement disait donc le contraire de ce qu'on voulait —
signalé par Cateline sur téléphone, invisible sur fil de fer.

→ **CORRIGÉ** : 2 rem au-dessus contre 0,5 rem en dessous (4 pour 1). La règle
générale — une étiquette est nettement plus proche de ce qu'elle introduit —
passe dans les principes.

> **Complété le 2026-08-16.** « À vérifier sur les trois autres écrans » n'était
> pas une correction : deux appels réduisaient bien l'écart (`mt-2`, `mt-0`).
> L'espacement appartient désormais au COMPOSANT (`mt-8 -mb-1`), qui n'accepte
> plus de `className` — la faute n'est plus possible sur aucun écran, présent
> ou à venir.

### V6 — Deux mots pour une relation

« Mes coachées » (la rangée), « les speakeuses que tu accompagnes » (son
sous-titre), « Coach » (la puce d'origine). Coacher et accompagner désignent
la même chose. Un mot, une chose.

→ **CORRIGÉ pour la puce** (« Mes coachées »), et le sous-titre suit V3.

### Ce que cet exercice apprend

Quatre des six manquements portent sur des textes **recopiés d'une décision
antérieure** sans être relus (les puces, les sous-titres) ou sur une règle
**écrite mais non appliquée à la page où on l'écrivait** (le pictogramme).
D'où la seule ligne de méthode à retenir : **une règle nouvelle se repasse sur
le document qui l'a produite**, avant de la repasser sur le produit.

## 7. Ce qui NE change pas

- La barre : cinq emplacements, les mêmes pour tout le monde, dans le même
  ordre. Seul le libellé de l'onglet 4 est en jeu (Q2).
- Le fil : pur, antichronologique, zéro carte personnelle.
- Les deux écrans du « moi » : profil privé / fiche publique, jamais mélangés,
  pastille « Privé », visibilité portée par les noms d'écran.
- « Ta prochaine marche » : une carte, un CTA, dérivée des données.
- `/mon-espace/messages` et `/admin/messages` : mêmes pages, mêmes rôles.
- Les tâches elles-mêmes : `deriverTachesOrga` reste la source unique.

## 8. Découpage proposé

| Étape | Contenu | Écran neuf ? |
|---|---|---|
| **A** | Les segments du profil, le wording « Espace organisatrices » et « tremplin en cours », les deux Tremplin désambiguïsés, le pied de page allégé dans la coquille d'app, un onglet qui se rallume dans `/admin` | non (mêmes rangées, regroupées) |
| **B** | L'onglet 4 devient « À faire » : liste par personne, puces, compteur ; la rangée « À faire » quitte le profil | **oui** — maquettes 3.4 / 3.5 |
| **C** | Les notifications personnelles alimentent les deux surfaces (bravos au fil, messages à la liste) ; l'e-mail aligné sur le moteur | non |

L'étape A ne dépendait que de Q1, désormais tranchée : la rangée « À faire »
quitte le profil.

## 9. Les questions

**Q1 — TRANCHÉE le 2026-08-16 : OUI.** L'emplacement qui porte aujourd'hui
« Messages » devient la liste de ce qui attend une action, une par personne.
`/mon-espace/messages` et `/admin/messages` restent les pages où l'on lit et
où l'on modère, atteintes depuis la liste ; elles perdent seulement leur
emplacement dans la barre.

**Q2 — TRANCHÉE le 2026-08-16 : « À faire ».** Retour de Cateline : « ce qui
m'attend » est trop long et peu courant. C'était de toute façon un nom de
concept, jamais un libellé — les maquettes disaient déjà « À faire ». Deux
noms pour une chose, c'est le défaut qu'on corrige partout ailleurs : le
document, le concept et l'étiquette portent désormais le seul mot que le
produit emploie déjà.

Reste une condition, et elle vaut engagement : « À faire » n'est juste que si
les items « pour info » (bravos, arrivées) restent dans le **fil**. Le jour où
l'on en met un dans la liste, la liste ment sur son nom. C'est Q3.

**Q3 — TRANCHÉE : le fil.** Un bravo n'appelle aucune action, il n'a donc rien
à faire dans une liste d'actions. C'est ce qui rend le mot « À faire »
honnête, et c'est désormais un engagement : le jour où un item « pour info »
entre dans la liste, c'est le libellé de l'onglet qu'il faut rouvrir.

**Q4 — TRANCHÉE : « Mon bénévolat ».** Le registre un peu formel est assumé :
le mot est juste (orgas et coachs sont bénévoles au même titre), entier, et le
possessif y est vrai. « Mon engagement », plus chaleureux mais plus abstrait,
est écarté.

**Q5 — l'onglet d'une orga s'ouvre sur tout, ou sur ce qui la concerne ?**
Recommandation : **`Tout`** — une orga qui ouvre l'app vient presque toujours
pour l'association.

**Q6 — TRANCHÉE : un seul nom, et ce sera « Espace organisatrices ».**
« Tableau de bord » disparaît du vocabulaire. Et Cateline a rouvert le mot
lui-même : « orga » est-il lisible par une personne neuro-atypique ou avec un
trouble cognitif léger ? **Non, pas tout à fait** — c'est le même défaut
qu'« asso », un mot tronqué qui suppose le vocabulaire de la maison.

Il est atténué par un fait : cette rangée n'est montrée qu'à des personnes qui
tiennent le rôle, donc à qui on l'a déjà dit. Mais atténué n'est pas réglé —
une orga qui vient d'arriver, ou qui lit lentement, n'a aucune prise sur trois
lettres. Et depuis que `NavRow` accorde deux lignes (§5, P2), le mot entier
tient sans rien coûter. La règle passe dans
`docs/principes-conception-ui.md` : **aucun mot tronqué dans un intitulé**,
même sur un écran réservé au rôle.

**Q8 — TRANCHÉE le 2026-08-16 : le patron est adopté**, et « Mes articles »
prend **« Du brouillon à la publication »**. Le détail ci-dessous.

**Le patron des sous-titres de rangée (§6, V3).** Aujourd'hui ils sont dans trois
formes différentes : certains s'adressent à toi (« les speakeuses que **tu**
accompagnes »), d'autres énumèrent (« Speakeuses, contenus, messages »),
d'autres mélangent. La règle proposée tient en une phrase :

> **Un sous-titre dit ce qu'on trouve derrière la rangée. Sans verbe
> conjugué, sans « tu ».**

Ce que ça donne, rangée par rangée — c'est ça que je te demande de valider :

| Rangée | Aujourd'hui | Proposé |
|---|---|---|
| Ma fiche publique | *(aucun)* | *(aucun)* — le titre suffit |
| Mes articles | Brouillons, relecture et publiés | **Du brouillon à la publication** — voir plus bas |
| Espace organisatrices | Speakeuses, contenus, messages, tremplins | inchangé — déjà au patron |
| Ateliers du tremplin en cours | L'accès direct aux ateliers de l'édition en cours | **Tremplin 2026** — le titre dit déjà quoi, le sous-titre dit lequel |
| Mes coachées | Les speakeuses que **tu** accompagnes, tes ateliers | **Speakeuses accompagnées et ateliers** |
| Tremplin 2026 | **Ta** participation : ateliers, ressources et retour du jury | **Ateliers, ressources et retour du jury** |
| Documents | Retours du jury et ressources, par édition | inchangé — déjà au patron |
| Réglages | Méthodes de connexion, e-mails, compte | inchangé — déjà au patron |

**Le cas qui résiste : « Mes articles ».** Un article passe par trois états —
`brouillon`, `en_relecture`, `publie`.

> **Correction du 2026-08-16.** J'avais écrit que « relecture est le mot de
> celles qui relisent, pas celui de l'autrice ». C'est **faux** : le produit
> dit déjà « relecture » à l'autrice, sur le bouton qu'elle presse
> (« Soumettre à la relecture ») et dans « Ton article est chez l'orga, en
> relecture avant publication ». Le diagnostic était mauvais.

Cateline a proposé **« soumis à validation »**. Écarté, pour trois raisons qui
tiennent au mécanisme réel :

1. **Un article n'est pas validé, il est relu — et il peut revenir.** Le code
   le dit : « Une orga te l'a renvoyé : {motif} ». L'issue n'est pas un
   oui/non, c'est une lecture qui peut revenir avec des suggestions.
   « Validation » promet un verdict, et fait alors lire un renvoi comme un
   refus — coûteux pour une lectrice littérale, alors que c'est un
   aller-retour normal.
2. **« Validation » est déjà le mot des FICHES** (« Valider la fiche d'Ada »,
   `validation_fiche_jours`) — et une fiche, elle, est bien un oui/non. Deux
   mots pour deux mécanismes réellement différents : l'écart est juste ici.
3. L'autrice lit déjà « relecture » sur le bouton : renommer côté sous-titre
   recréerait deux mots pour une chose, sur le même chemin.

→ **Proposition** : ne pas nommer l'état du milieu. La rangée résiste à
l'énumération parce que ses trois états ne sont pas trois noms naturels —
alors on dit le chemin :

> **« Du brouillon à la publication »**

Sans verbe conjugué, sans « tu », mots courants, ça dit ce qu'on trouve
derrière, et le débat relecture/validation devient sans objet.

**Q10 — TRANCHÉE le 2026-08-16, sur la maquette ouverte au téléphone :
« édition » devient « tremplin ».** La rangée dit « Ateliers **du tremplin**
en cours », pas « de l'édition ». « Édition » est le mot du **schéma**
(`tremplin_editions`) : une orga dit « le tremplin ». Même famille que
« orga » — on nomme la chose comme elle se dit, pas comme la base la range.
Le mot « édition » reste partout dans l'espace d'administration (« Gérer
l'édition », « Réglages de l'édition », fils d'Ariane) : consigné en dette,
pas traité ici.

**Q11 — le compteur de l'onglet ne pousse jamais le libellé.** Constaté sur
téléphone : le « 5 » passait à la ligne sous « À faire » et faisait grandir
l'onglet, donc la barre entière. Le compteur se pose **sur l'icône**, en
absolu — la hauteur d'un onglet ne dépend plus de son contenu. Son équivalent
texte reste dans le nom accessible (« À faire, 5 en attente »).

**Q9 — TRANCHÉE le 2026-08-16 : la formulation générique est adoptée.**

**« CFP » dans la carte « Ta prochaine étape » (§6, V4).** Le texte dit
aujourd'hui « N talks repérés sur tes profils **CFP** attendent ta
confirmation ». Le sigle suppose qu'on sait ce qu'est un *call for papers* —
or l'association existe pour celles qui n'ont **pas encore** proposé de talk :
le public le moins susceptible de connaître le mot le rencontre dans le seul
CTA de la page.

**Ma première proposition était mauvaise, et Cateline l'a arrêtée** : je
suggérais « repérés sur Sessionize ». Or la roadmap prévoit **Notist comme
troisième plateforme** — le libellé aurait menti dans quelques semaines, et
serait à réécrire à chaque source ajoutée. Un intitulé ne cite pas une
implémentation qui va bouger.

→ Proposition générique, qui survit à toutes les sources :

| | Aujourd'hui | Proposé |
|---|---|---|
| plusieurs | N talks repérés sur tes profils CFP attendent ta confirmation. | **On a repéré N talks à ton nom : ils attendent ta confirmation.** |
| un seul | Un talk repéré sur tes profils CFP attend ta confirmation. | **On a repéré un talk à ton nom : il attend ta confirmation.** |

Aucun sigle, aucune marque, et ça dit **qui** a fait quoi (« on ») — ce que la
version d'origine taisait.

**Q7 — les métaphores : TRANCHÉE le 2026-08-16, on corrige.** « Ta prochaine
marche » devient « Ta prochaine étape » (livré, §5 P6) ; « Mon asso » est
écarté pour une raison de plus que la troncature — le possessif y était faux
(§4.0). « Mon association » l'est aussi : une association loi 1901
n'appartient pas à celles qui la font tourner.

## 10. Hors périmètre

La roue crantée des éditions (rangée en lot 3 de l'audit, avec ses trois
conditions), la messagerie interne entre membres (N5), les commentaires (N6),
le fil lui-même, le thème clair. Le tap supplémentaire vers l'espace orga
n'est pas rouvert : il est chiffré et assumé, et l'étape B le rend indolore.
