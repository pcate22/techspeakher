# Audit UX/UI de `/agenda` — 2026-08-16

> Objet : la page tient-elle quand l'agenda s'enrichit ? La question vient d'un
> fait concret — l'arrivée d'une speakeuse qui donne **plus de 30 interventions
> par an** — et d'une intuition à vérifier : il manquerait des filtres (ville,
> région, intervenante), une recherche multicritère, une pagination.
>
> Grille : `docs/principes-conception-ui.md` (règle d'or, §1 hub-and-spoke,
> §5 wording, §9 lisibilité, checklist COGA) et les conventions de `CLAUDE.md`.
> Priorités : **P0** (l'écran ment ou bloque), **P1** (le système se contredit,
> ou une fonctionnalité demandée est bloquée en amont), **P2** (polish).
>
> Cet audit ne propose aucun écran fini : il établit **ce qui casse, à quel
> volume, et ce qu'il faut fiabiliser avant de dessiner**.
>
> Les décisions produit prises depuis sont consignées en **§8**. Deux l'ont été
> le 2026-08-16 — **« horizon glissant, années révolues »** et **« mémoire
> complète »** — et elles redessinent le lot 2, qui n'est plus facultatif.

---

## 1. Méthode — tout ce qui est chiffré ici a été mesuré

Comme `docs/audit-e2e-parcours-2026-08.md`, rien n'est déduit de la lecture du
code. Dispositif :

- app **construite** (`npm run build`) et servie en production locale, sur un
  **vrai Postgres 16** monté pour l'occasion (`sync-to-latest.sql` +
  `db/seed-preview.sql`) ;
- **Chromium réel** (celui de Playwright) en **393×852** (iPhone 14, tactile) et
  **1280×800**, plus `axe-core` sur les tags `wcag2a/aa`, `wcag21a/aa`,
  `wcag22aa` ;
- **deux états** mesurés, pas un :
  - **état actuel** — la forme exacte de la capture fournie du 16/08/2026 :
    9 interventions (7 à venir : 1 en octobre, 6 le 19 novembre 2026 ; 2 passées) ;
  - **état anticipé** — un décor d'audit de **69 interventions** dont une
    speakeuse à **26 dates affichées** sur douze mois, treize villes,
    dix-huit libellés de conférence, deux annonces imprécises. C'est le profil
    « 30+ par an » de la demande, posé au milieu d'une communauté qui en annonce
    deux à sept chacune.

**Limites, dites d'emblée.** La prod n'était pas joignable depuis
l'environnement d'audit : l'état « aujourd'hui » est **reconstitué** à partir de
la capture PDF fournie, et le décor d'échelle est **fictif** (personnes
inventées, en `@demo.techspeakher.test`). Les constats de §4.1 sur la qualité
des libellés, eux, viennent de la **capture de prod**, donc de vraies données.
Les seuils (§3.1) sont mesurés sur des cartes de longueur réaliste ; un corpus
de titres plus courts déplacerait les chiffres de quelques pourcents, jamais
d'un ordre de grandeur.

**Revérifié après la fusion de `main` du 2026-08-16** (76 fichiers, dont le
chantier « Mon profil » et « aujourd'hui, date du fil »). Ce qui touche cet
audit, et ce qui en découle :

- `src/app/agenda/page.tsx` et `src/lib/agenda-public.ts` sont **inchangés** :
  la page auditée est bien celle d'aujourd'hui.
- `SceneCard` a changé, mais sur `scroll-margin-top` seulement
  (`scroll-mt-40` → `scroll-mt-bande-mois`), une propriété qui n'entre dans
  aucun calcul de mise en page : **toutes les hauteurs de §3.1 tiennent**. Ce
  correctif invalide en revanche un « acquis » que cet audit proclamait à tort,
  corrigé en §6.
- `principes-conception-ui.md`, la grille de lecture d'ici, s'est étoffé de
  143 lignes : le signal d'alerte des ~4 écrans et les règles de wording sont
  **inchangés**, et la checklist d'accessibilité cognitive devient
  **opposable**. Les lots de §7 y sont donc soumis, pas seulement invités.
- `AncreAujourdhui` a été **supprimé** au profit d'`AmenerEnVue` : entrée de §5
  réécrite.

---

## 2. Verdict

**La page est bien faite, et elle est déjà trop longue.** Ce n'est pas une page
bâclée qu'il faudrait reprendre : la chronologie est juste, les mois collants
fonctionnent, une carte a une seule cible, axe est vert, la panne de base est
gérée, les dates imprécises ont leur place. Le défaut n'est pas dans ce qui est
affiché : il est dans **ce qui n'existe pas**. La page n'a **aucune entrée**.

Mesuré, dans la zone de liste (entre le titre « À venir » et la fin des cartes) :

| Contrôle | `/agenda` | `/speakeuses` (page sœur) |
|---|---|---|
| Champ de recherche dans la page | **0** | 1 |
| Boutons de filtre / facettes | **0** | 26 (volet latéral) |
| Compteur de résultats | **absent** | `role="status"` visible |
| Tri, pagination, « voir plus » | **0** | — (liste courte) |

Les seuls `input` de `/agenda` sont la loupe globale de l'entête (mesuré :
2 champs, tous deux `aria-label="Rechercher sur le site"`). Et cette loupe
**ne connaît pas les dates** (§4.3). Il n'y a donc, aujourd'hui, littéralement
aucun moyen de répondre à « est-ce qu'une speakeuse passe près de chez moi ? »
autrement qu'en faisant défiler la page entière.

L'intuition de départ est donc juste, et l'audit la précise sur trois points :

1. le problème est **déjà là**, pas seulement à venir (§3.1) ;
2. la fonctionnalité la plus évidente — **filtrer par conférence** — est
   **bloquée en amont** par la qualité de la donnée (§4.1), et la seconde —
   **filtrer par ville/région** — l'est presque autant (§4.2) ;
3. le vrai déclencheur de gêne n'est pas le nombre total de dates, c'est la
   **concentration** : une seule speakeuse occupe 58 % de la page (§3.2).

---

## 3. P0 — l'écran bloque

### 3.1 Un mur de défilement, sans aucune prise — et le seuil est déjà franchi

Mesures à 393 px, page entière :

| Interventions à venir en base | Cartes rendues | Hauteur | Écrans mobile |
|---|---|---|---|
| **9 (état actuel, forme de la capture)** | 9 | 3 952 px | **4,6** |
| 15 | 15 | 5 325 px | 6,3 |
| 20 | 20 | 6 201 px | 7,3 |
| 33 | 33 | 8 592 px | 10,1 |
| 50 | 50 | 11 588 px | 13,6 |
| 69 | 69 | 14 974 px | 17,6 |

`principes-conception-ui.md` §1 pose son propre **signal d'alerte** : « une page
qui dépasse ~4 écrans mobile ». La page le franchit **avec les 9 interventions
d'aujourd'hui**. Avec le décor anticipé (33 à venir + 12 passées = 45 cartes),
elle mesure **12,8 écrans**, et le bloc « Une date à annoncer ? » vit à
**11 écrans** du haut.

Autres coûts de parcours mesurés sur ce décor :

- **2 cartes** visibles au premier écran (la première commence à 479 px) ;
- **25 tabulations** pour atteindre la 20ᵉ carte au clavier ;
- une date à Paris tombait au **13ᵉ rang, à 3,3 écrans** de défilement — sans
  aucun moyen de savoir, avant d'y arriver, qu'elle existait ;
- 45 cartes, **77 liens** sur la page, **149 ko** de HTML, **765 ko** transférés.

Et la lecture n'est pas seulement longue, elle est **aveugle** : rien n'annonce
combien d'interventions la page contient (mesuré : aucune occurrence de « N
interventions / dates / scènes » dans le texte rendu). On ne sait ni où on est,
ni combien il en reste. C'est exactement la charge cognitive que le doc de
conception place au-dessus de « ça marche ».

> **Conséquence pour la suite.** Un filtre ne suffira pas : même filtrée sur une
> ville, une liste non bornée peut rester longue. Il faut **une entrée (filtres)
> ET une borne (pagination ou tranche dépliable)**, pas l'une des deux.

### 3.2 Une speakeuse prolifique noie l'agenda de la communauté

C'est le cœur de la demande, et c'est mesurable. Sur les 45 cartes du décor
anticipé :

| Speakeuse | Cartes | Part de la page |
|---|---|---|
| La speakeuse prolifique (26 dates visibles) | **26** | **58 %** |
| La suivante | 7 | 16 % |
| Les 7 autres | 2 chacune ou moins | 26 % |

Et surtout : **45 liens de carte pour 9 destinations distinctes**, dont **26 qui
mènent à la même fiche**. Le registre des erreurs de
`principes-conception-ui.md` connaît déjà ce motif sous deux entrées :
« boutons dupliqués indistincts » et « une entrée par destination, un test
l'exige ». Ici il ne s'agit pas d'un bug de composant : c'est la **structure
même** de la page — une carte par date, toutes pointant vers la personne — qui
produit la répétition dès qu'une personne annonce beaucoup.

La page promet « les dates de la communauté, toutes speakeuses confondues ». À
ce volume, elle montre **une speakeuse, ponctuée par les autres**. Ce n'est pas
un reproche à qui annonce beaucoup : c'est la vitrine qui doit tenir la
promesse de son sous-titre.

> Deux réponses possibles, et elles ne s'excluent pas : une **facette par
> intervenante** (choisir de qui on veut voir les dates), et un **regroupement**
> quand une même personne occupe plusieurs cartes d'affilée sur un même jour ou
> un même événement. La seconde relève du design, pas de l'audit : à trancher
> au lot 1 (§7).

### 3.3 « Déjà en scène » cache les deux tiers de l'archive, en silence

`separerScenes` plafonne le passé à **12** (`maxPassees = 12`,
`src/lib/agenda-public.ts:186`). Mesuré sur le décor : **36 interventions
passées en base, 12 rendues → 24 invisibles (67 %)**.

Rien ne le dit. Mesuré sur le texte rendu : **aucune** occurrence de « voir
plus », « voir toutes », « archives » ou « plus anciennes ». Le titre annonce
« Les interventions récentes de la communauté » — c'est vrai, et c'est
précisément ce qui rend la troncature indétectable : une visiteuse qui cherche
le talk d'une speakeuse donné il y a dix-huit mois conclut qu'il n'a pas eu
lieu.

Le plafond lui-même se défendait (une vitrine montre une communauté vivante,
elle ne déroule pas ses archives — c'est écrit dans le code, et c'était un
choix). Et il y avait un coût à le garder : cet historique est un **actif**
(preuve sociale, contenu indexable, mémoire de la communauté) qui n'a
aujourd'hui **aucune URL**.

> **Décision produit prise le 2026-08-16 : mémoire complète.** L'agenda garde
> et montre **tout** le passé de la communauté. Le plafond de 12 cesse donc
> d'être un choix : c'est une perte de données à l'affichage, à corriger au
> lot 2 (§7).

Ce que la décision entraîne, mesuré :

- **Elle ne coûte aucune requête de plus.** `getScenesPubliques()` ne porte
  **aucun `LIMIT`** : la base rend déjà tout le passé à chaque affichage, et
  c'est `separerScenes` qui en jette 24 en mémoire. On ne va pas chercher plus
  de données, on **cesse d'en jeter**.
- **Elle interdit en revanche de tout afficher d'un coup.** Mesuré : 149 ko de
  HTML et 765 ko transférés pour 45 cartes ; l'archive complète du décor en
  ferait 69, et une archive pluriannuelle réelle bien davantage. Le plafond
  doit passer de « on jette silencieusement 24 lignes » à « on **pagine**, et
  la suite est atteignable » — ce qui est précisément le lot 2, désormais
  obligatoire et plus seulement recommandé. Corollaire : la lecture publique,
  aujourd'hui non bornée en SQL, devra l'être (le fil le fait déjà,
  `getScenesRecentes` plafonne en SQL).
- **Elle rend l'URL indispensable, pas optionnelle** (§4.5). Une mémoire qu'on
  ne peut ni partager ni indexer n'est pas une mémoire : il faut une adresse
  stable pour l'archive, et vraisemblablement par année.
- **Elle périme le wording actuel.** « Les interventions récentes de la
  communauté » décrit une vitrine, plus une mémoire. Le titre et le résumé sont
  à réécrire avec le lot 2, à la forme positive.
- **Une propriété à préserver explicitement** : une fiche retirée disparaît de
  l'agenda **rétroactivement** (le `WHERE` partagé de `scenesVisiblesWhere` le
  garantit, et un test d'intégration le fige). Une « mémoire complète » ne doit
  surtout pas devenir un instantané figé qui survivrait à un retrait — le
  retrait du consentement reste souverain (RGPD art. 7-3, principe déjà inscrit
  au registre des erreurs : « une garde protège ce qu'on POSE, jamais ce qu'on
  efface »).

---

## 4. P1 — la fonctionnalité demandée est bloquée en amont

### 4.1 « Filtrer par conférence » est impossible sur la donnée actuelle

**Constat tiré de la capture de prod, pas du décor.** Le 19 novembre 2026, la
même journée au même endroit apparaît sous deux libellés :

| Libellé affiché | Occurrences dans la capture |
|---|---|
| `DevFest Toulouse · Toulouse · France` | 4 |
| `DevFest · Toulouse · France` | 3 (dont la carte « Déjà en scène ») |
| `Agile Tour Bordeaux (ATBX) 2026 · Bordeaux · France` | 1 |
| `Devoxx France 2025 · Paris · France` | 1 |

Quatre formes pour trois événements : nom seul, nom + sigle + année, nom +
année. Une facette « conférence » construite sur cette chaîne listerait
**« DevFest » et « DevFest Toulouse » comme deux entrées**, et sortirait
« Devoxx France 2025 » du filtre « Devoxx France ». Le filtre mentirait dès le
premier clic.

La cause est structurelle et le remède existe déjà dans le schéma :

- `talk_occurrences.conference` est un **instantané de saisie** (`schema.sql:241`
  le dit : « Libellé figé (SNAPSHOT du nom au save) ») ;
- le **lien canonique existe** : `talk_occurrences.conference_id → conferences`
  (`schema.sql:237`), alimenté par le registre depuis la migration 068, avec
  `conferences.nom`, `.slug`, `.ville`, `.pays` propres ;
- mais le DTO public **ne l'expose pas** : `ScenePublique`
  (`src/lib/agenda-public.ts:29`) porte `conference`, `ville`, `pays` — les
  snapshots — et rien du registre.

> **Préalable non négociable à toute facette « conférence »** : exposer
> `conferenceId` (et le `slug`) dans `ScenePublique`, facetter sur le
> **registre**, et garder le snapshot comme repli d'affichage pour les lignes
> historiques en texte libre. Avant de coder : **mesurer en prod** la part
> d'occurrences publiables qui portent déjà un `conference_id`. Si elle est
> faible, le lot commence par un rattachement au registre, pas par un écran.

### 4.2 « Filtrer par ville ou région » bute sur une asymétrie de modèle

Le vœu est **régional** (« par ville ou région »), la donnée est **ponctuelle et
libre**. Mesuré sur le décor : **13 villes distinctes** pour 45 dates, **40
libellés de lieu distincts** (`conférence · ville · pays`) — soit presque un par
carte. Une facette à 13 puces qui en produira 30 dans un an n'est pas une
facette, c'est une seconde liste à parcourir.

Et le projet **sait déjà** faire mieux, ailleurs :

| | Fiche speakeuse | Occurrence (une date) |
|---|---|---|
| Saisie de la ville | `VilleField` → autocomplétion Base Adresse Nationale (`/api/communes`) | `ChampTexte` libre, avec suggestions |
| Stocké | `ville`, `codePostal`, **`codeInsee`** | `ville` (texte), `pays` (texte) |
| Région | **`regionResidence`**, dérivée (`regionFromContext`) | **aucune** |

Le mécanisme de dérivation commune → région existe (`src/lib/communes.ts`), le
vocabulaire de régions existe (`REGIONS`, `src/data/domaines.ts:70`) et
l'annuaire l'expose déjà en facette. L'agenda est la seule surface géographique
du site à ne rien en avoir.

Deux pièges à nommer avant de dessiner :

- **deux géographies coexisteraient** : l'annuaire filtre sur les *zones où une
  speakeuse se déplace* (`regions`), l'agenda filtrerait sur le *lieu d'une
  date*. Même mot, sens différent. Le wording devra les distinguer, sinon deux
  pages sœurs répondront différemment à « Occitanie » sans que ce soit un bug.
- **les dates en ligne** : le décor comprend des occurrences sans ville. Une
  facette géographique doit leur donner une place explicite (« À distance »
  existe déjà dans `REGIONS`), jamais les faire disparaître d'un filtre.

> Ordre recommandé : ne pas facetter sur `ville` en texte libre. Soit dériver la
> région à la lecture depuis le **registre** (`conferences.ville` /
> `conference_editions.ville`, déjà normalisés côté orga), soit aligner la
> saisie d'occurrence sur `VilleField`. La première voie ne demande aucune
> migration de saisie et se branche sur le préalable §4.1.

### 4.3 La recherche globale ne connaît pas l'agenda — la loupe n'est pas un contournement

On pourrait penser que ⌘K sauve la mise. Mesuré sur l'index réellement servi
(`/api/search/speakeuses`, `/api/search/contenus`, `src/data/search-index.ts`) :

| Terme cherché | Présent dans l'index ? |
|---|---|
| `DevFest` (nom de conférence d'une date) | **non** |
| `Mix-IT` (idem) | **non** |
| `Bordeaux` (ville d'une date) | **non** |
| `novembre` / `2026-11` (date) | **non** |
| `Lyon` | oui — mais parce qu'une **fiche** y réside, pas parce qu'une date s'y tient |

Et l'index statique des pages compte **11 entrées** : `/`, `/a-propos`,
`/tremplin`, `/devfest-toulouse`, `/speakeuses`, `/actualites`, `/partenaires`,
`/contact`, `/code-de-conduite`… **`/agenda` n'y est pas**. Une visiteuse qui
tape « agenda » dans la loupe ne trouve pas la page qui porte ce nom.

C'est le trou le moins cher à boucher de tout cet audit (une ligne dans
`src/data/search-index.ts` pour la page ; l'indexation des dates elles-mêmes est
un vrai lot, à décider).

### 4.4 L'agenda est absent des TROIS surfaces de découverte

Le site sert trois publics de découverte, par trois canaux distincts. L'agenda
manque aux trois — c'est le constat le plus coûteux du rapport, et le moins
cher à corriger.

| Canal | Public | État mesuré pour `/agenda` |
|---|---|---|
| `src/data/search-index.ts` | la loupe ⌘K, en interne | **absent** (11 pages listées, pas celle-ci) |
| `public/llms.txt` | moteurs de réponse et assistants | **absent** (18 pages listées, **zéro** occurrence du mot « agenda ») |
| `application/ld+json` | moteurs de recherche | **absent** : un seul bloc, de type `NGO`, hérité du gabarit. Aucun `ItemList`, aucun `Event` |

La comparaison avec la page sœur est nette. `/speakeuses` publie un
`CollectionPage` complet avec son `ItemList` (`src/app/speakeuses/page.tsx:152`)
**et** dispose dans `llms.txt` d'une entrée écrite pour être citée :
« La page à citer pour "trouver une speakeuse ou conférencière tech en France" ».
`/agenda`, lui, déclare des mots-clés explicites dans ses métadonnées
(« agenda speakeuses », « prochaines conférences tech », « meetup tech
Toulouse »), vit dans le `sitemap.xml` en priorité 0.8… et n'est déclaré nulle
part ailleurs. Son contenu est pourtant littéralement une liste d'événements
datés et localisés : le cas d'école de `schema.org/Event`.

Deux remarques pour la mise en œuvre :

- **Ce que les moteurs de réponse citent, ce sont des phrases.** La page n'en
  a aucune qui énonce un fait (mesuré §3.1 : aucun compteur, nulle part). Une
  ligne de tête factuelle et datée — « Au 16 août 2026, 33 interventions sont
  annoncées dans 13 villes » — sert **trois** besoins d'un coup : elle donne à
  citer, elle dit à la visiteuse ce qu'elle parcourt, et elle fournit l'hôte
  obligatoire de la région vivante des filtres (§5).
- **Rien à inventer côté flux** : le dépôt publie déjà `feed.xml` (RSS des
  actualités). Un agenda, lui, gagnerait un flux **iCalendar** (`.ics`) — on
  s'abonne à des dates, on ne les recopie pas. Mesuré : aucun `.ics` dans le
  dépôt. Confort réel, et surface de diffusion de plus.

> À cadrer avec `docs/google-ad-grants.md` : on décrit **l'activité de
> l'association** (ses membres montent sur scène), jamais une offre de
> prestataires. Un `Event` dont le `performer` est une speakeuse et
> l'`organizer` la conférence hôte reste du côté descriptif ; il faut le
> vérifier avant publication, pas après.

#### Ce que la page est, et que peu d'autres semblent être

Recherche menée le 2026-08-16 pour cadrer le positionnement. **Chaque moitié
existe ailleurs ; c'est le croisement qui semble rare.**

| Ce qui existe | Exemples trouvés | Ce qui manque par rapport à `/agenda` |
|---|---|---|
| **Annuaires** de speakeuses | **`134onstage.vercel.app` — 171 noms, français, récent** (voir ci-dessous) ; `abenoit/french-women-tech-speaker-organizer` (37 personnes, liens et spécialités) ; Speakerinnen.org, Duchess France, Women Talk Design | Ni talks, ni dates : on sait **qui**, jamais **quand** ni **où** |
| **Programmes** d'un événement | toutes les conférences « women in tech » (WeAreTech, Women Who Code Summit, WomenTech Global…) | Une seule conférence à la fois : personne ne suit une communauté **à travers** les événements |
| **Bureaux de conférenciers** | BigSpeak, AllAmericanSpeakers | Commercial, et à l'opposé de ce que l'association décrit d'elle-même |
| **Agendas d'événements tech** | **`developers.events`** (voir ci-dessous), Agenda-Tech France, 10times | L'unité de compte est **l'événement**, pas la personne : on sait qu'une conférence a lieu, jamais qui y monte sur scène |
| **Profils avec sessions** | Sessionize (chaque speakeuse a sa page publique) | Une personne à la fois : aucune lecture **en travers** d'une communauté |

Ce que fait `/agenda` — croiser **qui** (l'annuaire), **quoi** (le talk) et
**quand/où** (la date), pour **une communauté entière**, en français, tenu à
jour par les intéressées elles-mêmes — n'a pas d'équivalent trouvé. Et c'est
cohérent : le croisement suppose la plateforme en dessous (des membres qui
maintiennent leur propre fiche), ce qu'une liste statique ne peut pas offrir.

##### Le comparable le plus proche : `134onstage`, et ce qu'il nous apprend

Un annuaire français de femmes de la tech, récent, signalé le 2026-08-16.
**Le site est inaccessible depuis l'environnement d'audit** (allowlist du proxy
sortant) : les constats viennent d'une capture d'écran puis de **l'export
complet de la page**, dont le texte a été relu intégralement — ce n'est donc
plus une impression, mais ce n'est pas non plus une mesure en navigateur (ni
hauteur, ni a11y, ni comportement des filtres).

Il se décrit comme « un **répertoire vivant** pour rendre visibles les femmes
qui prennent la parole sur la tech et sa nécessaire mixité », sous le titre
« Les femmes qui font la tech, **et qui montent sur scène** » — une formule
très proche du « de la salle… à la scène » de l'association. Ses compteurs de
tête : **171 expertes, 14 domaines, 167 profils LinkedIn**.

Ce qu'on y trouve — et c'est **exactement la barre d'entrée qui manque à
`/agenda`**, sur un seul écran, au-dessus de la liste :

| Élément | `134onstage` (relevé sur l'export) | `/agenda` (mesuré) |
|---|---|---|
| Recherche multicritère | « Chercher un nom, un rôle, un thème » | **absente** |
| Filtre géographique | liste déroulante « Toutes les villes » | **absent** |
| Facettes thématiques | puces **avec leur décompte** (« Égalité & Parité 79 », « Entrepreneuriat 56 ») | **absentes** |
| Compteur visible | « 171 noms » | **absent** |
| Par personne | nom, intitulé LinkedIn (tronqué), ville, jusqu'à 3 domaines + « +N », lien vers **LinkedIn** | — |
| Talks | **aucun** — zéro occurrence de « talk » ou « conférence » dans le contenu | le titre du talk est la 2ᵉ ligne de chaque carte |
| Dates | **aucune** — zéro occurrence d'« agenda » ou de date | c'est tout l'objet de la page |

**La réserve est levée : c'est un répertoire de personnes, pas un agenda.** La
carte mène au profil LinkedIn, pas à une intervention. Plusieurs speakeuses de
la communauté y figurent, dont celle dont les 30+ dates par an ont motivé cet
audit — ce qui illustre le partage exactement : ce répertoire dit **qui elle
est**, il ne dit pas **où elle parle le mois prochain**.

Trois enseignements, dans l'ordre d'utilité :

1. **Deux idées à reprendre au lot 1.** Les facettes **annoncent leur
   rendement** (« 79 ») : on ne clique pas dans le vide, et c'est un remède
   direct au filtre qui ne ramène rien. Et l'option neutre s'appelle
   « Tous 171 » — la forme positive, exactement la règle maison (§5). Le
   filtre de ville en **liste déroulante** plutôt qu'en puces mérite aussi
   d'être retenu : l'agenda aura vite plus de villes que de place en puces
   (13 mesurées sur le décor).
2. **La moitié « qui » n'est plus un terrain vide.** 171 noms contre une
   dizaine de fiches publiées : sur le volume de l'annuaire, la comparaison
   n'est pas flatteuse et il serait vain de la chercher. Ce qui **ne** se
   copie **pas** vite, c'est ce qu'il y a dessous : des fiches tenues par
   leurs propriétaires, des talks, et des dates.
3. **Donc l'agenda n'est pas un module de plus, c'est le différenciateur.**
   Ce constat renforce l'ordre des lots plutôt qu'il ne le bouscule : ce que
   nous sommes seules à pouvoir tenir, c'est **quand et où**, et c'est
   précisément la page qui n'a aujourd'hui aucune entrée.

##### L'autre voisin, et il est déjà chez nous : `developers.events`

`developers.events` (dépôt `scraly/developers-conferences-agenda`, maintenu par
Aurélie Vache) recense les **conférences de développeurs et leurs appels à
orateurs**, dans le monde entier : par entrée, des dates, un nom lié, une ville
et un pays, et un badge « CFP jusqu'au… ». Trois vues (liste par mois,
calendrier, carte), une contribution par pull request, et deux JSON publics
(`all-events.json`, `all-cfps.json`). **Aucun profil de speaker** : le projet
liste des événements.

**Ce n'est pas un concurrent, c'est déjà notre fournisseur.** Le catalogue
d'amorçage du registre en vient : `src/data/conferences-seed.ts` porte
l'attribution en tête (« extraction manuelle de developers.events, CC BY-NC 4.0,
usage non commercial : Tech Speak'Her est une association loi 1901 »), un test
interdit de la retirer, et `/admin/conferences` cite la source en pied de page.

La complémentarité se lit en une phrase, et elle est jolie : **une speakeuse
trouve un appel à orateurs sur `developers.events`, propose, se fait retenir, et
son talk apparaît dans notre agenda.** L'un dit *quels événements existent et où
proposer*, l'autre dit *qui, de la communauté, y monte sur scène*. L'unité de
compte diffère : l'événement d'un côté, l'intervention (personne × talk × date)
de l'autre.

> **Piste concrète pour le lot 0** (§4.1, normaliser les libellés de
> conférence) : la relation existe, la licence est déjà arbitrée, et le seed se
> fait aujourd'hui par **extraction manuelle**. Le `all-events.json` public est
> la suite naturelle — pour proposer des noms canoniques dans
> `ConferenceCombobox` et rapprocher « DevFest » de « DevFest Toulouse ». À
> instruire avec les mêmes précautions que le seed : attribution conservée,
> usage non commercial, et le registre orga garde le dernier mot (jamais
> d'écrasement automatique d'une saisie validée).
>
> À noter au passage pour le lot 4 : `developers.events` n'expose pas de flux
> iCalendar non plus. Le `.ics` reste donc un vrai confort à apporter, sur un
> périmètre que personne ne couvre.

###### Le second écart, et il n'est pas technique : le consentement

Le répertoire l'écrit lui-même en pied de page : « une initiative bénévole et
non commerciale », dont les profils figurent « sur la base du **volontariat et
de recommandations**, à la suite d'un appel lancé sur LinkedIn », avec un
retrait « sans délai » sur demande. La mention est honnête, et la voie de
sortie existe. Mais « recommandations » veut dire, en pratique, que **des
personnes s'y découvrent sans avoir rien demandé** — c'est le cas d'au moins
une membre de l'association, constaté le 2026-08-16.

Notre modèle est l'inverse, et ce n'est pas un hasard : chez nous **la fiche
est créée et publiée par la personne elle-même** (`status = 'publie'`), l'e-mail
n'est jamais exposé (relais), le retrait est aussi simple que l'accord
(RGPD art. 7-3, principe inscrit au registre des erreurs), et le consentement
est journalisé. Ce n'est pas une critique du répertoire voisin — c'est la
différence entre **rassembler des noms** et **héberger des fiches**. Et c'est
une raison de plus pour que l'agenda, qui expose des personnes ET leurs
déplacements, reste irréprochable sur ce point.

> **Propriété à préserver explicitement dans les lots 1 et 3.** L'agenda ne
> publie **jamais** le nom d'une personne dont la fiche n'est pas publiée : la
> garantie vit dans le `WHERE` partagé (`sp.status = 'publie'`,
> `scenesVisiblesWhere`) et un test d'intégration la fige, cas négatifs
> compris. Or les deux prochains lots **exposent des noms à des endroits
> nouveaux** : une facette « par intervenante » en ferait une liste de noms
> publique, et `Event.performer` les livrerait aux moteurs. Rien n'est cassé
> aujourd'hui — c'est justement pour ça qu'il faut l'écrire avant d'y toucher.
> Une date annoncée dit où une personne se trouvera un jour donné : le
> périmètre public se vérifie, il ne se suppose pas.

> **Deux précautions.** D'abord, ne pas transformer ce constat en superlatif
> affiché : une recherche n'est pas une preuve d'inexistence, elle a été menée
> depuis un moteur orienté États-Unis et un domaine était inaccessible.
> « Le seul agenda de speakeuses » est invérifiable, donc fragile — devant une
> visiteuse, devant un examinateur Ad Grants, et devant un moteur de réponse
> qui préfère les faits aux slogans. Ensuite, la conséquence utile n'est pas de
> se vanter mais de **se nommer** : ce que la page contient doit être écrit en
> toutes lettres, dans les mots que les gens et les machines emploient — « où
> et quand des femmes de la tech prennent la parole en conférence en France ».
> C'est ce qui doit gouverner la rédaction de l'entrée `llms.txt`, de la
> `description` et de la phrase de tête du lot 3. Décrire précisément ce qu'on
> est unique à faire vaut mieux que déclarer qu'on est unique.

### 4.5 L'état des filtres devra vivre dans l'URL — aucune surface du site ne le fait aujourd'hui

Mesuré : les trois surfaces filtrantes du dépôt (`SpeakeusesFilter`,
`ActualitesListe`, `RosterFilter`) gardent leur état en `useState` seul. Aucune
n'écrit dans l'URL.

Ce n'est pas une dette grave sur l'annuaire ou les actualités. Sur l'agenda,
c'en serait une dès le premier jour, pour trois raisons concrètes :

- **le lien partagé est le produit** : « les dates de la communauté à Lyon »
  s'envoie dans un message, se colle dans un canal, s'affiche en signature ;
- **le bouton retour du téléphone** : §1 de `principes-conception-ui.md` réclame
  une « URL partageable, retour = bouton back du téléphone ». Un filtre en état
  local rend le retour imprévisible après un aller sur une fiche ;
- **l'indexation** : c'est le seul moyen de faire exister une page
  « speakeuses en scène à Toulouse », alors que les métadonnées visent déjà ces
  requêtes (§4.4).

> Recommandation : `?ville=`, `?conference=`, `?speakeuse=`, `?q=` en paramètres
> d'URL lus côté serveur, avec des valeurs **canoniques** (slug de registre,
> code région) plutôt que des libellés. C'est aussi ce qui rend le lot
> indexable sans dupliquer de page.

---

## 5. P2 — polish, à traiter au passage

- **Le jour répété à l'identique.** Sur la capture de prod, **six cartes portent
  « JEUDI 19 »** sous le même en-tête « NOVEMBRE 2026 ». Le raisonnement qui a
  produit `libelleJourScene` (ne pas répéter le mois sous son en-tête) s'arrête
  une marche trop tôt : sous une même tranche, un même jour mériterait de se
  dire **une fois**. C'est un cas fréquent (une conférence rassemble plusieurs
  speakeuses le même jour), et il s'aggrave avec le volume.
- **`lienConf` traverse le DTO et n'est jamais affiché.** `ScenePublique` porte
  `lienConf`, et `SceneCard` le laisse volontairement de côté (« une seule cible
  par carte » — le choix est bon et documenté). Mais la donnée part quand même
  au client pour chaque carte. Soit on la sert, soit on la retire du DTO
  (minimisation, comme la ville l'est déjà sur l'annuaire).
- **Aucun compteur, donc aucun hôte pour la future région vivante.** L'annuaire
  affiche « N speakeuses… » dans un `role="status"` (visible **et** annoncé) ;
  l'agenda n'a rien. Le jour où un filtre arrive, ce compteur est **obligatoire**
  (`LiveStatus`, et le résumé doit **nommer le filtre actif** — sinon deux
  filtres qui rendent le même nombre n'annoncent rien du tout : la leçon est
  déjà écrite dans `LiveStatus.tsx`).
- **Le CTA principal vise les membres sur une page grand public.** « Gérer mes
  talks » est l'aplat magenta de la page ; « Voir l'annuaire » et
  « Contactez-nous » l'accompagnent. La règle d'or est respectée sur la forme
  (un seul aplat primaire), mais le public majoritaire de `/agenda` — des
  curieuses, des organisateurs — n'a pas d'espace membre. À relire quand la
  page gagnera une barre de filtres, qui deviendra de fait la première action.
- **Le repère « aujourd'hui » : une leçon à importer, et elle vient de tomber.**
  Cette entrée visait au départ le composant `AncreAujourdhui`, que l'agenda
  public ne réutilisait pas. **Il a été supprimé le 2026-08-16** au profit d'une
  approche plus juste, et c'est celle-là qui nous concerne : « maintenant » est
  désormais **une date du fil**, à sa place chronologique avec son mois
  au-dessus, plutôt qu'un séparateur entre deux zones. Le séparateur était né
  d'un défaut remonté de la prod (« je vois encore mai et j'ai l'impression
  qu'aujourd'hui j'ai septembre »).

  L'agenda public sépare aujourd'hui son futur et son passé de la même façon,
  par deux sections. La décision « horizon glissant » (§8) le tranche autrement,
  et dans le même sens : `/agenda` porte le fil de ce qui vient, l'archive vit
  ailleurs. À vérifier au lot 2 que la frontière restante ne rejoue pas le
  défaut, et à réutiliser le composant d'arrivée (`AmenerEnVue`) plutôt qu'à en
  écrire un second (§3 : mutualiser par les capacités, pas par copie).

---

## 5bis. Cohérence avec l'annuaire, la page sœur

`/agenda` et `/speakeuses` montrent **la même matière** (des talks, des
speakeuses) sous deux angles. Le lot 1 propose de réutiliser la mécanique de
l'annuaire : encore faut-il savoir ce qui, chez lui, mérite d'être repris.
Comparaison faite sur le code et sur la page rendue.

**Ce qui est déjà cohérent, et qu'il faut préserver.** Les deux cartes sont
**un seul lien** vers la fiche, avec une affordance décorative (`aria-hidden`)
et un nom accessible complet : « Voir la fiche » sur l'annuaire, « Par X → »
sur l'agenda. Aucune des deux ne tombe dans le « geste dupliqué à droite d'une
ligne » du registre. Même habillage de carte, même résilience, même
`force-dynamic` documenté.

**Trois divergences, dont deux à corriger dans l'agenda.**

| | `/speakeuses` | `/agenda` |
|---|---|---|
| Type de talk | **badge en tête de chaque talk** (« CONFÉRENCE », « QUICKIE / LIGHTNING »), avec un langage visuel choisi et commenté dans le composant | `talkType` **est dans le DTO**, jamais affiché |
| Entrée | recherche + volet de filtres + compteur visible | **rien** |
| Troncature | **dite** : « +2 autres talks », « +1 » | **tue** : 24 interventions passées sur 36 |

Le type de talk est la divergence la plus gênante : le même objet est décrit
avec un vocabulaire visuel sur une page et passé sous silence sur l'autre,
alors que la donnée voyage jusqu'au client. Avec `lienConf` (§5), cela fait
**deux champs transportés pour rien** — soit on les sert, soit on les retire.

Et sur la troncature, **c'est l'annuaire qui a raison** : il annonce ce qu'il
cache. L'agenda devrait s'aligner, ce que la décision « mémoire complète » (§8)
règle par le haut.

**En revanche, sa carte est un contre-modèle pour l'agenda.** Mesuré à 393 px :

| Page | Éléments | Hauteur | Écrans mobile |
|---|---|---|---|
| `/speakeuses` | **7 fiches** | 6 784 px | **8,0** |
| `/agenda` (état actuel) | **9 interventions** | 3 952 px | 4,6 |

L'annuaire coûte donc environ **deux fois plus par élément** : sa carte porte un
nom, un sous-titre, jusqu'à trois talks, quatre secteurs, quatre sujets et un
pied. C'est défendable là où on lit **peu de fiches en profondeur** ; c'est
intenable sur une page qui doit en afficher des dizaines. **Reprendre sa
mécanique de filtres, oui ; copier sa carte, non.**

> Deux détails relevés au passage, pour l'annuaire lui-même (hors périmètre de
> cet audit, à verser à la dette) : le champ de recherche affiche « …titre de
> talk**...** » en trois points ASCII plutôt qu'un vrai caractère de points de
> suspension ; et les talks saisis portent souvent la conférence ET l'année
> **dans leur titre** (« … », MiXiT Lyon 2025), ce qui aggrave §4.1 — le nom
> d'une conférence peut vivre à trois endroits, seul le registre fait foi.

---

## 6. Ce qui est solide — à ne pas casser en refondant

Mesuré, pas supposé :

- **axe : 0 violation** en 393×852 **et** en 1280×800, sur
  `wcag2a/aa + wcag21a/aa + wcag22aa`, sur la page pleine à 45 cartes.
- **L'en-tête de mois collant tient au défilement.** À mi-page, **exactement
  un** en-tête est collé, à `top: 100 px`, sous les deux barres du site. Le
  piège « deux éléments collants qui s'ignorent » du registre des erreurs
  **n'est pas rejoué ici**.

  > **Correction du 2026-08-16, après la fusion de `main`.** La version initiale
  > de cet audit ajoutait que « le `scroll-mt-40` posé sur le lien tient
  > WCAG 2.4.11 ». **C'était faux**, et l'erreur mérite d'être gardée. La bande
  > de mois mesure `2.5rem` (token `--spacing-bande-mois`) ; `scroll-mt-40` en
  > vaut **10rem, soit quatre fois trop** : un lien qui prenait le focus se
  > posait si bas que la bande visible au-dessus était celle du mois
  > **précédent**. C'est la version clavier du défaut remonté de la prod le même
  > jour sur « Mon agenda », corrigé depuis (`scroll-mt-bande-mois`, plus
  > `src/__tests__/bande-mois-collante.test.ts` qui refuse les nombres
  > recopiés).
  >
  > **Pourquoi je l'ai raté** : j'ai mesuré la position des bandes **en
  > défilant**, jamais celle du lien **après tabulation**. Deux questions
  > différentes, un seul relevé — et j'en ai tiré une propriété que le relevé ne
  > démontrait pas. Le registre le dit déjà dans l'autre sens (« un constat de
  > revue non reproduit reste une hypothèse, y compris quand il vient de moi ») ;
  > il vaut aussi pour un **acquis** proclamé : une propriété non mesurée reste
  > une hypothèse, même quand elle est rassurante.
  >
  > Ce qui **reste vrai** : le changement porte sur `scroll-margin-top`, qui
  > n'entre dans aucun calcul de mise en page. Toutes les hauteurs et tous les
  > décomptes d'écrans de §3.1 sont donc inchangés.
- **Une carte, une cible.** Toute la carte mène à la fiche, et l'`aria-label`
  porte la date **complète** même quand l'affichage n'a que le jour.
- **Résilience.** Base injoignable → la page s'affiche avec son mot d'attente
  (`force-dynamic` documenté, leçon de l'incident du 23/07/2025 sur l'annuaire).
- **Les dates imprécises sont traitées juste** : « courant 2027 » forme sa propre
  tranche, se range à la **fin** de sa période, et le départage à fin égale est
  documenté et testé.
- **Le socle de tests existe** : `agenda-public.test.ts` (tri, tranches),
  `agenda-public.integration.test.ts` (périmètre public sur vrai Postgres, avec
  cas négatifs), `agenda-public-page.test.tsx` (rendu, mois collant, a11y),
  `e2e/navigation.spec.ts` et `e2e/pages-publiques.ts`. Toute évolution part
  d'un filet réel.

---

## 7. Ce que l'audit recommande, dans l'ordre

L'ordre compte : les deux premiers lots sont des **préalables**, et les sauter
ferait livrer un filtre qui ment.

| Lot | Contenu | Pourquoi d'abord | Comment on saura que c'est réussi |
|---|---|---|---|
| **0. Fiabiliser la donnée de facette** (aucun écran) | Exposer `conferenceId` + `slug` dans `ScenePublique` ; dériver la géographie depuis le registre ; **mesurer en prod** la part d'occurrences publiables rattachées au registre ; instruire le `all-events.json` de `developers.events` comme source de noms canoniques (relation et licence déjà arbitrées, §4.4) | §4.1 : une facette sur le libellé libre listerait « DevFest » et « DevFest Toulouse » séparément | Sur les données de prod, le nombre de facettes « conférence » égale le nombre d'événements réels |
| **1. L'entrée** : recherche + facettes | Champ de recherche + facettes conférence / lieu / intervenante, en réutilisant `FilterGroup` + `FilterChip` + `LiveStatus` (motif maison, uniforme sur 4 surfaces), **état dans l'URL** (§4.5) ; facettes **avec leur décompte** et liste déroulante pour les villes (repris de `134onstage`, §4.4) ; carte **légère**, jamais celle de l'annuaire (§5bis : 2× plus coûteuse par élément) | C'est la demande, et §3.1/§3.2 montrent qu'elle est déjà nécessaire | « Trouver la prochaine date à Lyon » passe de 3,3 écrans de défilement aveugle à un geste ; le résumé filtré est annoncé et **nomme le filtre actif** |
| **2. Les deux surfaces, et la mémoire complète** | Recentrer `/agenda` sur l'**horizon glissant** (il ne porte plus que ce qui vient, plus un aperçu permanent du passé récent) ; sortir l'archive sur `/agenda/[annee]`, **plafond `maxPassees` retiré**, sans seuil de publication (une année existe dès une intervention) ; borner la lecture SQL, aujourd'hui sans `LIMIT` ; réécrire titre et résumé de la section (décisions du 16/08, §8) | Un filtre seul ne borne pas. Et c'est la découpe elle-même qui borne : privé du passé, `/agenda` repasse sous le seuil **sans pagination** | `/agenda` repasse **sous 4 écrans mobile** par défaut comme à l'état filtré ; **zéro intervention passée inatteignable** ; aucune page ne se vide au changement d'année ; le poids d'une page ne croît plus avec l'âge de l'association |
| **3. La découverte** (les trois canaux, §4.4) | `ItemList` + `Event` sur l'horizon et sur chaque page d'année ; entrée `/agenda` dans `src/data/search-index.ts` **et** dans `public/llms.txt`, rédigée pour être citée ; phrase de tête factuelle et datée ; pages d'année dans le `sitemap` via `collectRoutes` | §4.4 : l'agenda manque aux **trois** surfaces à la fois, et c'est le lot le moins cher du rapport | La loupe trouve « agenda » ; un assistant sait citer la page ; les `Event` valident, relus à l'aune de `google-ad-grants.md` |
| **4. Le confort** (facultatif) | Flux **iCalendar** (`.ics`) de l'horizon — on s'abonne à des dates, on ne les recopie pas | Aucune urgence, mais le dépôt sait déjà servir un flux (`feed.xml`) et rien n'existe côté `.ics` | Une visiteuse ajoute l'agenda à son calendrier en un geste |

Un **lot 1b** s'est intercalé en cours de route, et il ne figurait pas au plan
initial : la géographie d'une occurrence était un texte libre, donc la facette
« région » du lot 1 aurait filtré sur du vide. Décision du 17/08 (« va au b
directement ») : poser la **donnée** avant la facette, plutôt que livrer un
filtre sur les seules villes qu'il faudrait refaire ensuite.

### État d'avancement au 18/08/2026

| Lot | État | Où |
|---|---|---|
| **0.** Identité de conférence | **fusionné** | PR #334 — `src/lib/agenda-conference.ts`, `conferenceCle` + `conferenceLibelle` dans le DTO |
| **1.** Recherche + facettes | **fait** | `src/lib/agenda-filtres.ts`, `src/app/agenda/AgendaFiltres.tsx`, les deux surfaces (`/agenda` et `/agenda/[annee]`), état dans l'URL (`?q=`, `?ville=`, `?region=`, `?conference=`) — détail ci-dessous |
| **1b.** Géographie d'une occurrence | **complet** | PR #338 (socle) — migration 072, `src/lib/lieu-occurrence.ts`, garde `geographieValidee`, `npm run geo:occurrences` ; puis le formulaire, `VilleField` généralisé aux deux écrans (fiche et occurrence). Une nouvelle saisie capture désormais son code INSEE toute seule : le rattrapage ne sert plus qu'à l'existant. |
| **2.** Horizon glissant + années révolues | **fusionné** | PR #336 — `/agenda` réécrite, `/agenda/[annee]`, `e2e/agenda.spec.ts` |
| **3.** Les trois canaux de découverte | **fusionné** | PR #337 — `src/lib/agenda-jsonld.ts`, `search-index.ts`, `llms.txt`, `sitemap` |
| **4.** Flux `.ics` | **LIVRÉ** (2026-08-21) | `/agenda.ics` (horizon, dates exactes), déclaré en `alternates` de `/agenda` et proposé en lien discret sous le CTA |

#### Ce que le lot 1 a livré, et les deux endroits où il s'écarte du plan

**Livré, conformément aux quatre réponses produit du 17/08.** Un champ de
recherche libre (il trouve un titre, une conférence, une ville, une région et un
NOM — sans facette « intervenante »), trois facettes (ville, région, conférence),
l'état **dans l'URL** et lu côté serveur, un décompte par option, un résumé en
région vivante qui **nomme le filtre actif**, et la règle « en ligne » de bout en
bout : une date sans lieu apparaît dans « À distance » ET dans tous les filtres
géographiques, ce que le libellé dit (« à Toulouse **ou en ligne** »).

La facette « conférence » est bâtie sur `conferenceCle` (le registre), jamais sur
le libellé figé — et c'est gardé aux trois niveaux : la clé
(`agenda-conference-facette.test.ts`), le filtre et la page
(`agenda-filtres.test.ts`, `agenda-public-page.test.tsx`), et le parcours réel
(`e2e/agenda.spec.ts`, sur le décor qui porte exprès « DevFest » et « DevFest
Toulouse » le même jour).

**Écart 1 — des listes déroulantes, là où le plan disait des puces.** Le plan
prévoyait de reprendre `FilterGroup` + `FilterChip` (motif maison, uniforme sur
quatre surfaces). Deux raisons de ne pas le faire ici, et elles se renforcent :

- ces quatre surfaces gardent leur état en MÉMOIRE, avec `aria-pressed` ; ici
  l'état vit dans l'ADRESSE (§4.5). Une puce qui navigue est un **lien**, pas
  une bascule : reprendre le composant aurait promis une sémantique de bouton
  pressé à une commande qui change de page ;
- le mal que ce lot répare est un **mur de défilement** (§3.1). L'audit
  recommandait déjà la liste déroulante pour les villes (« l'agenda aura vite
  plus de villes que de place en puces », §4.4) ; l'argument vaut plus encore
  pour les conférences, dont il naît une par événement. Trente puces au-dessus
  de la liste auraient repoussé les dates de deux écrans de plus.

Ce que les puces apportaient est conservé : **chaque option annonce son
rendement**, et l'option neutre est à la forme positive (« Toutes les villes
(33) »). Le formulaire est un `GET` (`next/form`) : il marche **sans
JavaScript**, et la navigation reste côté client quand il est là.

**Écart 2 — le compte de `/agenda/[annee]` a changé de place.** Il vivait dans le
sous-titre de l'en-tête ; il vit désormais **sous la barre de filtres**, en
région vivante. Deux comptes sur une même page se seraient contredits dès le
premier filtre — celui de l'en-tête aurait continué d'annoncer l'année entière.

**Trois conséquences de conception, écrites pour ne pas être redécouvertes :**

- **un filtre gouverne la page entière.** Sous « Paris », l'aperçu du passé
  récent (trois cartes toulousaines) contredirait la commande : il se retire, et
  la section garde son compte et ses **portes d'année**. Une année est un AUTRE
  document (§8) : son lien ne porte pas le filtre, et son décompte reste celui
  de l'année entière ;
- **un filtre à vide n'est pas une adresse inexistante.** `/agenda/2025?ville=lyon`
  répond **200** et dit « Aucune intervention à lyon » : seule une année sans la
  moindre intervention ferme (404). Un 404 sur une vue filtrée inviterait les
  moteurs à désindexer une archive réelle ;
- **le `canonical` d'une vue filtrée pointe la page nue.** Les métadonnées
  restent statiques : c'est le défaut retenu tant que la question 2 de §8 reste
  ouverte, et il évite d'ouvrir à l'indexation la combinatoire des filtres.

#### Ce que les quatre passes de revue ont trouvé, et ce qu'elles ont changé

La revue avant PR (`docs/revue-avant-pr.md`) a rendu un rapport **non vide**, et
c'est le lot qui en sort différent. Les deux passes automatiques ont mesuré, pas
supposé : sondes jetables côté justesse, navigateur réel et 39 captures côté
écran. Ce qui a changé, dans l'ordre de gravité :

1. **Une commande qui disparaissait sous les doigts** (bloquant, revue d'écran).
   La PRÉSENCE d'une liste se décidait sur la vue filtrée : taper « devfest »
   dans la recherche faisait donc disparaître les trois listes, et le parcours
   « je cherche, puis j'affine » devenait impossible — le bouton qu'on venait
   d'actionner remontait de 230 px sous le doigt. La présence se juge désormais
   sur le **document** (`Facette.offerte`), le décompte reste celui de la vue.
2. **Une facette qui promettait 1 et rendait 0** (justesse). Le plafond de 80
   caractères tronquait une **clé** de conférence (`texte:` + jusqu'à 160
   caractères), donc fabriquait une clé qui n'existe pas : l'option offerte
   annonçait (1), le clic rendait zéro, et une troisième option apparaissait,
   étiquetée de la clé coupée. Deux bornes maintenant, parce que deux choses
   différentes se comptent : la saisie (80) et la clé (200).
3. **Les commandes se désynchronisaient de l'adresse** (justesse). Champs non
   contrôlés, jamais remontés : après « Tout effacer » ou un retour arrière, la
   liste affichait encore « Toulouse » au-dessus d'une page complète — et
   « Filtrer » rétablissait un filtre que personne n'avait demandé. Corrigé par
   une clé de remontage, et le parcours E2E relit maintenant l'état des
   commandes (il s'arrêtait au compte des cartes).
4. **Un cul-de-sac en creux de saison** (justesse). Horizon vide **et** filtre
   posé : la barre disparaissait, « Tout effacer » avec elle, et il ne restait
   aucun lien vers l'agenda nu. La barre s'affiche désormais dès qu'un filtre
   est posé.
5. **Une date en salle pouvait traverser tous les filtres géographiques**
   (justesse). `estEnLigne` lit la région du DTO ; or `regionAffichee` rendait la
   région stockée **avant** de regarder la ville, et `REGIONS` autorisait
   « À distance (visio) » à la saisie. Une occurrence toulousaine postée ainsi —
   avec un vrai code INSEE, donc en satisfaisant la garde de qualité — se serait
   affichée sous chaque ville de l'agenda, tout en étant déclarée en présentiel
   dans le balisage. La ville tranche maintenant d'abord, et seules les régions
   **administratives** entrent en base (aux deux bords : lecture et saisie).
6. **Le premier écran d'un téléphone ne montrait plus aucune date** (revue
   d'écran, mesuré : barre de 417 px, première carte à y = 920 pour une fenêtre
   de 852). Le mal que ce lot répare est un mur de défilement : le réparer en
   posant un formulaire au-dessus de la liste l'aurait déplacé. Les trois listes
   se **replient** donc derrière une ligne qui dit ce qu'elle cache et ce qui est
   choisi, et qui s'ouvre d'elle-même dès qu'un filtre est posé ; l'en-tête de
   page est resserré. Un test E2E mesure désormais qu'une carte est visible à
   l'arrivée, sur les deux tailles d'écran.
7. **Trois défauts de mots** (revue d'écran) : le préfixe d'implémentation
   `texte:` s'affichait (« pour texte:reunion secrete ») ; un slug d'URL
   ressortait brut et en minuscules au milieu d'une phrase française (« à
   saint-etienne »), y compris pour une ville que le document connaît quand un
   autre filtre l'excluait de la vue ; et « à Toulouse, en Occitanie ou en
   ligne » se lisait comme trois possibilités là où le filtre en exige deux. Une
   valeur de conférence hors du document se **nomme** désormais (« pour la
   conférence demandée ») au lieu de se répéter — c'est la seule des trois que
   `slugify` ne borne pas, donc la seule par laquelle un lien forgé pourrait
   écrire dans la copie de la page.
8. **Une adresse sale à chaque filtre** (revue d'écran) : un formulaire GET
   soumet tous ses champs, donc `?q=visio&ville=&region=&conference=` — l'adresse
   qu'une visiteuse copie dans un message, alors que ce lot pose que le lien
   partagé est le produit. Les deux pages **rangent l'adresse** avant tout
   affichage (une redirection), ce qui canonise du même coup les valeurs
   non canoniques et retire un filtre de ville que « À distance » subsume. La
   fonction est idempotente par construction, et un test le fige : une
   redirection qui tournerait en rond serait pire que l'adresse qu'elle répare.
9. **Un balisage qui décrivait la page nue en ne listant qu'une date sur
   quarante** (justesse) : le `canonical` d'une vue filtrée pointe la page nue,
   donc une vue filtrée ne publie plus rien du tout.
10. **Deux détails d'écran** : le libellé indicatif du champ de recherche vivait
    en opacité (interdit par §9 des principes de conception, et le champ jumeau
    de l'annuaire faisait déjà juste), et « Tout effacer » mesurait 16 px de haut
    contre les 44 px que le projet s'impose. Corrigés, et le lien a rejoint le
    bouton en fin de rangée — posé sous la première liste, la loi de proximité le
    rattachait à cette liste.

**Ce que les revues ont signalé et qu'on a JUSTIFIÉ plutôt que corrigé**, pour
ne pas le rediscuter à chaque passe :

- « 1 intervention annoncée **à Lyon ou en ligne** » quand rien ne se tient à
  Lyon : la phrase est littéralement vraie, et c'est **exactement** la forme
  tranchée le 17/08 (§8). La carte affichée dit son propre lieu. À rouvrir si ça
  mord en prod, pas avant.
- **Trois mots pour un concept** (« À distance (visio) » dans la facette, « en
  ligne » dans la phrase, `a-distance-visio` dans l'URL) : le vocabulaire est
  PARTAGÉ avec `/speakeuses` (décision du 17/08 : « jamais un second »), donc le
  renommer est une décision de vocabulaire commun, pas un correctif local. Versé
  aux questions ouvertes de §8.
- **« Conférence » étiquette une liste où figurent des meetups** : le registre
  s'appelle « conférences » de l'écran d'administration jusqu'au code, et la
  règle maison veut qu'on renomme les deux ensemble. Même sort : question de
  vocabulaire.
- **Le décompte de l'option neutre change de référentiel** selon les autres
  filtres (« Toutes les villes (5) » et « Toutes les régions (3) » sur la même
  rangée) : chaque nombre est exactement ce que son option rend, et c'est la
  propriété la plus forte des deux.
- **Trois entrées versées à la dette** (`docs/dette-technique.md`) : les deux
  champs de recherche jumeaux à mutualiser, les huit repères de navigation d'une
  page d'année (ils viennent de `TranchePeriode`, pas de l'entrée), et le 404
  qu'une panne de base sert sur une page d'année — préexistant, mais ce lot rend
  justement ces pages citables.

**Le décor E2E a dû grandir pour que ces règles soient jugeables** : les
occurrences du seed portent désormais leur `region` et leur `code_insee` (sans
quoi toutes les villes françaises se rangeaient en « International », et la
facette « Occitanie » filtrait sur du vide — le décor aurait testé le contraire
du réel), et une **date en ligne** y est entrée, sans laquelle la règle « une
visio est joignable de partout » n'avait rien où se prouver.

> **Ce que finir le lot 1b a mis au jour**, et qui n'était pas dans le plan :
> `updateOccurrence` annonçait quinze paramètres SQL et n'en passait que treize
> depuis la migration 072. Modifier une conférence d'un talk échouait donc en
> production, quel que soit le champ touché — Postgres refuse la requête au
> bind. Aucun test ne l'a vu : les unitaires simulent le pool (une requête que
> personne ne bind ne se plaint jamais) et AUCUN parcours E2E ne modifiait une
> occurrence, seulement des créations. Corrigé, avec les deux gardes qui
> manquaient : autant de valeurs que de `$n` côté unitaire, et le geste
> « je reviens sur ma conférence et je la complète » côté Playwright.

Deux choses à faire tourner à la main, qu'aucune CI ne fera :

- `npm run geo:occurrences -- --essai` puis la vraie passe. Le chemin nominal de
  la BAN **n'a pas pu être prouvé** depuis l'environnement d'assistance (proxy
  sortant bloquant) : seul le chemin d'échec l'est. On regarde avant d'écrire.
- ~~Vérifier les `Event` du lot 3 sur `search.google.com/test/rich-results`~~ —
  **fait le 18/08**, sur la prod, depuis un téléphone. Résultat : `/agenda`
  déclare **8 éléments valides** (7 `Event` + l'`Organization` du gabarit),
  exploration OK, et le contenu de chaque `Event` est juste (date, mode
  présentiel, lieu, `performer` relié à la fiche, `organizer` sous le nom du
  registre). Les 5 avertissements sont des champs **facultatifs** : `offers` et
  `image` sont absents **exprès** (l'association ne vend rien, et une
  intervention n'a pas d'image) ; `endDate`, `description` et l'URL de
  l'`organizer` seraient de vrais petits gains, ils demandent d'élargir le DTO
  public et attendent une décision. `/agenda/2025` ne déclare **aucun** `Event`,
  et c'est **correct** : ses deux dates sont au mois près, et le balisage exclut
  les dates imprécises (reprendre « novembre 2025 » inventerait un jour).

### 7.1 Ce que cette vérification a mis au jour — l'aperçu du passé mentait

L'impression de prod du 18/08 montre, sous « Déjà en scène » :
**« 2 interventions depuis 2025. Voici la plus récente. »** au-dessus de **rien**.

La cause n'est pas dans le lot 1, elle lui est antérieure : `/agenda` peuplait
son aperçu avec `getScenesRecentes`, une fonction écrite **pour le fil de
l'espace connecté**, dont la doc disait « seul consommateur prévu » et « deux
conditions **propres au fil** » — dont l'exigence d'une date **exacte**, parce
qu'un fil chronologique n'a pas de jour où ranger « courant 2026 ». Or l'agenda,
lui, **compte** ces dates dans son archive (`getAnneesArchive` juge sur la fin de
période) et les **affiche** sur `/agenda/[annee]`. Trois surfaces, deux règles,
et un écran qui promettait ce qu'il ne montrait pas.

Corrigé (18/08) sans toucher au fil : `/agenda` a sa propre lecture,
`getApercuPasse`, sur le dispositif déjà établi par `getAnneesArchive` — le SQL
pose un plancher grossier, `separerScenes` tranche et ordonne. L'invariant tenu
est **« l'aperçu voit exactement ce que l'archive compte »**, et il a son test.

Deux enseignements, gardés parce qu'ils se reproduiront :

- **une fonction empruntée emporte les règles de sa surface d'origine**, et sa
  doc les disait — c'est en lisant la zone qu'on l'a vu, pas en lisant la ligne ;
- côté écran, la phrase et la liste lisent désormais **la même valeur** : la
  contradiction est devenue impossible au lieu d'être testée. Le test d'écran
  reste, pour le jour où l'aperçu revient vide pour une autre raison.

Le test hérité qui gardait la règle du fil a été **re-jugé** et conservé tel
quel : il dit vrai **pour le fil**. C'est son emprunt qui était faux.

### 7.2 Lot 4 — le flux iCalendar, livré le 21/08

`/agenda.ics` sert **l'horizon**, aux **dates exactes** seulement. Les deux
restrictions se justifient d'elles-mêmes : un calendrier auquel on s'abonne sert
à savoir ce qui vient (déverser quinze ans d'archive chez quelqu'un serait un
cadeau empoisonné), et il ne sait pas placer « courant 2026 » — la règle du lot 3
s'applique telle quelle, sans être réécrite (`isExactTalkDate`).

Les évènements sont des **journées entières** : le DTO ne porte pas d'heure, donc
c'est la seule affirmation vraie disponible. Base injoignable → calendrier
**vide mais valide**, jamais une erreur : un 500 sur un flux d'abonnement fait
désabonner des clients d'une adresse qui remarchera dans cinq minutes.

Le format est la vraie difficulté, et chacune de ses contraintes a son test
(`src/__tests__/agenda-ics.test.ts`), parce qu'un `.ics` mal formé s'ouvre dans
la moitié des clients et échoue dans l'autre **sans message** : CRLF partout,
pliage à **75 octets** sans couper un caractère accentué en deux, échappement de
`\ ; ,` et des retours, `UID` **stable** tiré de l'occurrence (un identifiant qui
bouge fait collectionner les doublons à l'abonnée), et `DTEND` **exclusif** sous
peine d'occuper deux jours.

Côté écran, un lien discret sous le CTA (« s'abonner au calendrier », avec le
format en `sr-only`) : la page garde **un** CTA principal, et ceci est un confort,
pas l'action de la visiteuse majoritaire.

> **Ce que ce lot a coûté en harnais, et qui vaut d'être su.** La vérification du
> branchement a d'abord conclu à tort, deux fois. `reuseExistingServer: !CI` fait
> réutiliser à Playwright tout serveur trouvé sur le port 3000 : un
> `next-server` fuité par un `kill` sur son wrapper npm a fait jouer les
> mutations contre le build précédent. Le signe qui a trahi la panne n'est pas un
> rouge, c'est un **chiffre trop juste** — le flux « muté » rendait exactement
> les 5 dates de l'horizon. Et dans le test lui-même, une assertion d'absence ne
> pouvait pas échouer : iCalendar échappe les virgules, donc le titre cherché
> tel quel n'existe nulle part. Les deux entrées sont au registre de
> `docs/principes-tests.md`.

**Et le décor E2E a dû grandir, en deux temps.** Aucun parcours ne regardait
« Déjà en scène », et le décor ne portait **aucune** date passée au mois près :
même joué, il n'aurait rien prouvé. La ligne ajoutée à `db/seed-preview.sql`
porte donc trois propriétés, et les deux dernières ont été apprises **en cassant
le test** :

1. la précision au **mois**, sans jour — le cas que l'ancienne lecture jetait ;
2. la **plus récente du passé** (décembre de l'année révolue finit après les
   dates exactes de septembre), donc forcément dans les trois cartes de
   l'aperçu. Posée sur une vieille année, elle n'y entrait jamais : le parcours
   restait **vert avec le défaut remis** ;
3. dans une année **révolue**, jamais l'année en cours. Calée sur « le mois
   dernier », elle ouvrait une porte d'archive pour l'année courante — dont la
   page liste aussi le futur — et faisait diverger la garde « mémoire complète »
   qui additionne les pages d'année.

Mesuré après coup : 42 parcours verts sur les deux tailles d'écran, et les deux
qui gardent ce correctif tombent quand on remet le défaut.

Quatre gardes à écrire **avant** le code correspondant, conformément à
`docs/principes-tests.md` (rouge → vert, **puis casser une fois**) :

- ~~un test qui **échoue** si une facette de conférence est construite sur le
  libellé libre plutôt que sur le registre~~ — **écrit** (lots 0 et 1), aux trois
  niveaux : la clé, le filtre, et le parcours en vrai navigateur ;
- un test de volume qui **échoue** si la page dépasse la borne retenue au lot 2
  (le dépôt sait déjà mesurer une hauteur rendue en E2E) ;
- un test qui **échoue** si la page d'atterrissage se vide au passage d'une
  année : horloge au 28 décembre, dates annoncées en janvier suivant, `/agenda`
  doit les lister. C'est la garde propre à la décision « horizon glissant », et
  c'est le genre de défaut qu'aucune revue ne voit parce qu'il n'apparaît
  qu'une semaine par an ;
- ~~un test qui **échoue** si une intervention passée cesse d'être atteignable~~
  — **écrite** (lot 2), et cette liste avait trois jours de retard sur le code :
  c'est `e2e/agenda.spec.ts`, « MÉMOIRE COMPLÈTE : toutes les interventions
  passées sont atteignables ». Elle compare le total annoncé au décor (SEIZE
  interventions passées, donc plus que l'ancien plafond de douze) puis additionne
  ce que les pages d'année affichent vraiment. **Vérifiée en la cassant le
  21/08** : un plafond de douze remis dans la lecture partagée la fait tomber,
  sur les deux tailles d'écran. Elle ne remplace pas le test d'intégration qui
  vérifie qu'une fiche **retirée** disparaît rétroactivement : les deux
  coexistent, l'un dit « rien ne se perd », l'autre « sauf ce qu'on retire ».

  > Le coût de ce retard est mesuré : le 18/08, une entrée de dette a été
  > ouverte en refusant une factorisation *parce que cette liste la disait
  > absente*. La garde existait. Une liste de « à faire » qui ne se raye pas
  > devient un frein — c'est le motif « le doc disait ≠ le code fait » de
  > `docs/dette-technique.md`, appliqué à cet audit lui-même.

---

## 8. Décisions produit

### Tranchées

- **2026-08-16 — La forme : un horizon glissant, des années révolues.**
  Le futur et le passé n'ont pas la même découpe naturelle, et c'est la clé de
  tout le reste :
  - **`/agenda` est un HORIZON, jamais une année.** Il porte tout ce qui vient,
    en fenêtre **glissante**. Une page d'atterrissage calée sur l'année civile
    se viderait en décembre — le défaut est structurel, pas conjoncturel, et
    il frapperait la page la plus visible du lot. C'est aussi elle qui porte
    les données structurées, l'entrée `llms.txt` et l'entrée de la loupe : une
    adresse stable, toujours peuplée, qui répond à « où et quand les speakeuses
    prennent-elles la parole ? ». Pour qu'elle ne soit jamais nue même en
    creux de saison, l'aperçu du passé récent s'affiche **toujours**, il n'est
    pas un reliquat de bas de page : l'horizon glisse dans les deux sens.
  - **`/agenda/[annee]` est un COMPTE RENDU.** Une année révolue est un
    document **fini, stable et citable** — exactement ce qu'un moteur de
    réponse sait reprendre, et ce qu'une page glissante ne sera jamais. Elle ne
    se videra pas : elle est close.
  - **Les autres facettes restent en paramètres d'URL** (`?ville=`,
    `?conference=`, `?speakeuse=`) sur les deux surfaces. L'année n'est pas une
    facette de plus : elle **sélectionne un autre document**, là où ville et
    conférence **filtrent à l'intérieur** d'un document. Les deux modèles
    d'URL coexistent parce qu'ils ne disent pas la même chose.

  > Cette décision **corrige** la recommandation « année en facette » faite
  > plus haut dans la discussion : elle tenait tant qu'on cherchait un modèle
  > d'URL unique, elle tombe dès qu'on exige une page d'atterrissage qui ne se
  > vide pas.

  Trois garde-fous :
  - **Aucun seuil de publication.** Une année existe dès qu'elle porte UNE
    intervention. Un seuil aurait paru prudent ; il est en fait à contresens du
    modèle : le passé se **remplit à retardement**, à mesure que les speakeuses
    complètent leur fiche. Une année maigre l'est parce que les fiches ne sont
    pas encore remplies, pas parce qu'il ne s'y est rien passé — la punir en la
    masquant, c'est cacher la page pendant précisément la période où elle
    grandit. Et une page qui apparaît puis disparaît selon un compte est le pire
    des cas pour les liens entrants, le sitemap et les moteurs de réponse : ce
    qu'on veut d'une adresse d'archive, c'est qu'elle soit **stable**.

    > Ce que le seuil prétendait éviter reste vrai, et le dépôt le traitait déjà
    > autrement : `aDesChiffresAAfficher` ne masque pas la page de l'édition
    > 2025, il **fait taire les compteurs** quand ils valent zéro ; et
    > `aUnTremplinADecrire` retire l'éditorial qui promettrait ce qui n'a pas eu
    > lieu. Le remède maison n'a jamais été « cacher la page » mais « ne pas
    > poser de zéros en grand ». C'est celui-là qu'on applique : une année à deux
    > interventions les montre, dit ce qu'elle est, et renvoie à l'annuaire —
    > sans bandeau de chiffres ni récit inventé.

  - **Une adresse figée, un contenu vivant.** Corollaire direct du remplissage à
    retardement : une année révolue est un document **stable d'adresse**, pas
    **figé de contenu**. `lastModified` du sitemap doit suivre les vraies
    écritures, et tout cache doit se revalider — sinon une contribution ajoutée
    six mois après coup reste invisible. Corollaire du corollaire : une page
    d'année peut passer de 2 à 30 entrées, donc elle a besoin de la même borne
    que le reste (lot 2).
  - **L'année en cours se remplit, elle ne ment pas.** Elle se dit « en cours »
    tant qu'elle l'est, et ne devient un compte rendu qu'une fois close. Le
    recouvrement avec l'horizon (une date de novembre vit sur les deux) est
    normal : ce sont deux lectures d'un même fait, pas deux copies d'un même
    texte. Chacune porte son `canonical` et son titre propre.

- **2026-08-16 — L'archive : mémoire complète.** « Déjà en scène » garde et
  montre **tout** le passé de la communauté, pas les douze dernières
  interventions. Conséquences détaillées en §3.3, mise en œuvre au lot 2 (§7).
  Trois points à ne pas perdre de vue en chemin : la pagination devient
  obligatoire (sinon la décision ne fait qu'allonger le mur), l'archive a besoin
  d'une adresse stable (une mémoire qu'on ne peut ni partager ni indexer n'en
  est pas une), et le retrait d'une fiche reste souverain (l'archive ne fige
  jamais d'instantané).

- **2026-08-17 — Les quatre questions du lot 1, tranchées.** Elles cadrent
  l'écran qui reste à faire, et chacune ferme une question qui était ouverte
  ci-dessous.

  - **Géographie : ville ET région, cherchables indépendamment.** La question
    posée supposait qu'il fallait choisir ; la réponse a été « pourquoi on
    restreint ? ». Une visiteuse qui tape « Toulouse » et une autre qui tape
    « Occitanie » cherchent la même chose à deux échelles, et rien n'oblige à
    n'en servir qu'une. Le vocabulaire reste celui de l'annuaire (`REGIONS`),
    **jamais un second** : deux pages sœurs qui répondraient différemment à
    « Occitanie » seraient le vrai défaut.

    > Conséquence immédiate, et c'est ce qui a produit le lot 1b : filtrer sur
    > la région suppose que les occurrences **portent** une région. Elles ne
    > portaient qu'un texte libre. D'où « il faut avoir l'INSEE aussi sur les
    > conférences » et l'ordre donné de faire la donnée avant la facette.

  - **Aucune facette « intervenante ».** L'agenda répond à « quand, où, sur
    quoi ». Qui, c'est la question de l'annuaire et des fiches, qui existent
    déjà et le font mieux. Une facette de plus aurait dupliqué une surface
    voisine au lieu de servir celle-ci. Le champ de recherche unique reste
    libre de trouver un nom : ne pas en faire une **facette** n'est pas en
    interdire la **recherche**.

  - **Une date en ligne apparaît dans « À distance » ET dans tous les filtres
    géographiques.** Une visio depuis Toulouse est joignable depuis Toulouse :
    l'exclure d'un filtre « Toulouse » cacherait une date réellement
    accessible. Conséquence sur le libellé, et elle n'est pas cosmétique : un
    résumé filtré doit dire « à Toulouse ou en ligne », sans quoi le compte
    affiché contredit le filtre annoncé.

  - **La carte mène par la date, le lieu et le sujet, la personne ensuite.**
    C'est ce qui ferme la question du regroupement : l'unité de l'agenda est
    l'**intervention**, pas la personne. Trois interventions d'une même
    speakeuse le même jour sont trois faits distincts et restent trois cartes.
    Conséquence de conception : la carte est **légère** et propre à l'agenda,
    jamais celle de l'annuaire (§5bis : 2× plus coûteuse par élément, et elle
    hiérarchise l'inverse).

### Encore ouvertes

1. **Une base de pays normalisée.** Proposée le 17/08 en même temps que l'INSEE
   (« une base internationale pour les pays »), et **repoussée** : la BAN ne
   couvre que la France, donc Bruxelles, Genève et Montréal restent aujourd'hui
   un `pays` en texte libre, rangé en « International ». ISO 3166-1 est le
   candidat évident. Repoussé parce que le volume hors France est faible et que
   le lot 1 se livre sans, pas parce que la question est mauvaise : elle
   reviendra dès qu'une facette « pays » aura autre chose que trois entrées.
2. **Un seul mot pour « en ligne ».** Relevé par la revue d'écran du 18/08 : la
   facette propose « À distance (visio) », le résumé dit « en ligne », et l'URL
   porte `a-distance-visio` — trois mots pour un concept, à deux centimètres
   d'écart. La règle COGA en demande un seul, de l'écran au code. Mais le
   vocabulaire est partagé avec l'annuaire (décision du 17/08 : « jamais un
   second »), donc le trancher engage les deux pages et la case que les
   speakeuses cochent sur leur fiche. Candidat : « En ligne » partout.
3. **Quelles vues filtrées mérite-t-on d'indexer ?** Conséquence de la forme
   retenue : `?ville=toulouse` a une valeur de recherche évidente,
   `?ville=toulouse&conference=devfest&speakeuse=…` n'en a aucune et multiplie
   les adresses. À décider facette par facette (`canonical` vers la page nue
   par défaut, exception assumée pour celles qui portent une vraie requête),
   plutôt que d'indexer la combinatoire.
