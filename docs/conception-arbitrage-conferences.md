# Conception — arbitrer les conférences proposées (la file, et de quoi juger)

> Statut : **conception + mise en œuvre** (lot du 2026-08-21). Déclencheur :
> l'import de portefeuille d'Aurélie Vache a marché — et a déposé **113
> conférences** dans une file que rien n'annonçait, que rien n'aidait à juger.
>
> Amont : `docs/conception-registre-conferences.md` § A bis (la conférence
> manquante n'arrête plus la saisie) et § A ter (l'import en masse).
> Règles opposables : `docs/principes-conception-ui.md` (règle d'or, § listes) ·
> `docs/conception-tableau-de-bord-orga.md` (moteur de tâches).

## Ce qui s'est passé

Le 2026-08-21, deux constats d'orga, à une heure d'intervalle du même geste :

1. « Je n'avais pas les tâches dans À faire alors que cela aurait dû
   apparaître. »
2. « Je ne peux pas voir le formulaire des conférences pour comprendre si la
   saisie est ok. Ni rien qui m'aide. »

Les deux sont justes, et ils ne se recouvrent pas : le premier dit que la file
est **invisible**, le second qu'elle est **inarbitrable**. Un troisième s'ajoute
en regardant la capture : 113 cartes à deux boutons sur une page dont le rôle
est de consulter un catalogue.

## Les cinq défauts, nommés

**A — La file n'entre dans aucune tâche.** `REGLES_TACHES`
(`src/lib/taches.ts`) est une liste FERMÉE de treize règles ; la file
d'arbitrage est arrivée après (migrations 041 puis 068) et n'y a jamais été
inscrite. Conséquences en chaîne : « À faire » annonce « Tout roule » avec 113
soumissions de membres en attente, le point de l'onglet reste éteint, la rangée
du tableau de bord reste neutre, et le récap quotidien ne dit rien.
`countConferencePropositions()` existe depuis la migration 041 **sans un seul
appelant** : le compteur avait été prévu, le câble jamais tiré. Du code mort
est ici la trace exacte de ce qui manque.

**B — L'arbitrage est AVEUGLE.** La carte montre le nom, l'année, la ville,
l'autrice, l'URL, l'id Sessionize et « N talks passeront en ligne » — jamais ce
qui a été saisi. Et ce n'est pas rattrapable ailleurs : l'invariant de
visibilité (`proposition_id IS NOT NULL` ⇒ jamais public,
`src/lib/occurrence-visibilite.ts`) tient la saisie hors de la fiche publique,
et **aucun écran orga ne montre les talks d'une membre** (`getTalksByProfileId`
n'a d'appelant que `/mon-espace` et la page participante d'un tremplin). Il
n'existe donc, dans le produit, aucun endroit où lire la saisie qu'on arbitre.
La demande « voir le formulaire » n'est pas une demande de confort : c'est le
seul chemin vers l'information manquante.

**C — Rien n'aide à décider, et deux risques sont invisibles.** L'orga décide
pour le répertoire PARTAGÉ (celui que le sélecteur propose à toutes) :

- *le doublon de marque*. Le rapprochement de l'import se fait au **slug
  exact** (`construirePlan` → `parSlug.get(slugify(nom))`). « DevoxxFR » ne
  rejoint donc pas « Devoxx France », « KubeCon + CloudNativeCon EU » ne
  rejoint pas « KubeCon + CloudNativeCon Europe » : ce sont deux propositions,
  et deux validations créent deux marques pour une conférence. Le cas se
  déclenche même en cascade : valider « … Europe 2026 » ne referme rien pour
  « … EU 2025 », qui créera sa propre conférence juste après ;
- *la faute de saisie promue*. La capture contient « DevFest Strasbourg 3019 ·
  2019 » : le nom devient celui du répertoire, pour toutes les speakeuses, et
  `extraireAnnee` ne le corrige pas (elle ne reconnaît que `19xx`/`20xx`).

**D — Il n'y a pas de troisième porte.** Valider écrit tel quel ; refuser
laisse la saisie hors ligne chez son autrice. Corriger est impossible côté
orga : `updateConferenceProposition` porte l'appartenance EN SQL
(`propose_par = userId`) et ne touche que ce que la saisie appelante est SEULE à
tenir. Le message de conflit d'endpoint le dit pourtant en toutes lettres —
« Corrige-le avant de valider » — en pointant un écran qui n'existe pas.

**E — Le mur.** 113 cartes empilées sur `/admin/conferences`, page dont le rôle
est de consulter le catalogue. C'est la règle d'or, et c'est même une erreur
**déjà au registre** (`principes-conception-ui.md`, 2026-07-11 : « une page de
consultation transformée en empilement de formulaires »). C'est aussi le point
de bascule que la dette avait posé d'avance : « une file orga qui dépasse ce que
la page affiche confortablement (elle liste tout, sans pagination) → pagination »
(`docs/dette-technique.md`, plafond d'import).

## Les solutions, en trois lots

Un lot par défaut de nature : **voir** la file, la **juger**, la **finir**.

### Lot 1 — La file entre dans « À faire » (défaut A)

Une quatorzième règle, `valider-conference`, du même patron que
`valider-fiche` :

| | |
|---|---|
| Condition | proposition en `en_attente` |
| Famille | `association` |
| Étage | **datée** — échéance = `created_at` + `validation_fiche_jours` |
| Une seule | « Valider la conférence « X » proposée par Y » → sa page |
| Plusieurs | « Valider N conférences proposées » → la file (échéance = la plus ancienne) |

**Pourquoi datée** : une proposition est une soumission de membre qui attend
l'association, avec un talk hors ligne derrière — exactement ce que
`relire-article` a déjà tranché en partageant le SLA de la fiche (« une
soumission de membre attend une orga, quelle que soit sa forme »). Rien de neuf
n'est réglé ici : le même réglage, le même engagement.

**Pourquoi une ligne groupée** : 113 lignes datées noieraient la liste — c'est
le motif anti-mur déjà en place (`directeOuGroupee`, « fini le mur de cartes »).

**Pourquoi ça allume** (`reclameUnGeste`) : l'orga referme d'un clic, sur
l'écran que la ligne pointe. Critère vérifié sur l'écran d'arrivée, jamais sur
l'intuition — la leçon du 2026-08-17.

Le récap quotidien gagne son agrégat (`N conférences à valider`) : la liste
`AGREGATS` est exhaustive par construction, une règle sans agrégat ne compile
pas. C'est le cliquet qui garantit qu'aucun canal n'oublie la nouveauté en
silence — celui-là même qui manquait au moteur en 2026-08.

### Lot 2 — Chaque proposition a sa page, et cette page montre la saisie (B, C, D)

`/admin/conferences/propositions/[id]` — un rôle : **juger cette proposition**.
Trois blocs, dans l'ordre où la décision se prend :

1. **Ce qui a été saisi.** Les talks derrière la proposition, tels que saisis :
   titre, autrice, date, lieu, liens (programme, slides, vidéo, retours). C'est
   le « formulaire » demandé — pas une copie du formulaire, la SAISIE elle-même,
   lue là où elle vit. Zéro adresse e-mail : le DTO ne porte que le nom, comme
   `proposeParNom` le fait déjà.
2. **Ce que le répertoire en dit** (l'aide qui manquait) :
   - *déjà au répertoire* (slug identique) : certitude. La page le dit et
     annonce l'effet réel — valider ne créera pas de marque, ça rattachera
     l'édition et publiera les talks ;
   - *ressemble à …* : indice, jamais décision. Jetons partagés du nom replié
     (`foldRecherche`) — plus la même suite de lettres à ses séparations près,
     et un début commun qui doit peser dans le mot qu'il désigne (voir
     « Ce que la file réelle a mesuré ») — l'année en repère. « DevoxxFR »
     remonte « Devoxx France » ; « KubeCon + CloudNativeCon EU » remonte
     « … Europe » ; « Women Who Go Paris » ne remonte pas « ParisTestConf ».
3. **Les gestes.** CTA principal « Valider », action secondaire « Refuser »,
   et une rangée « Corriger la proposition » vers sa sous-page — le patron
   sommaire → sous-page mono-fonction, comme `/admin/conferences/[slug]` et son
   `/modifier`. Aucun formulaire sur la page de jugement.

`/admin/conferences/propositions/[id]/corriger` — nom, année, ville, URL, id
Sessionize. Un rôle, un CTA, reste en place (`InlineActionForm`).

**Décision structurante : « rattacher à une conférence existante » n'est PAS
une action de plus.** C'est la correction du nom. La promotion retombe déjà
d'elle-même sur la conférence existante quand le slug coïncide
(`ON CONFLICT (slug) DO UPDATE SET nom = conferences.nom` renvoie la ligne
curée, puis `findEditionId` en repli si l'édition existe). Renommer « DevoxxFR »
en « Devoxx France » et valider **est** le rattachement. Une seconde porte de
validation aurait ajouté une surface d'autorisation, un chemin d'écriture et un
invariant de plus pour un geste que le chemin actuel fait déjà.

**La correction orga écrit en place, même sur une proposition partagée** — à
l'inverse de la porte membre, et c'est voulu. Le nom que l'orga fixe est celui
du répertoire, donc celui de toutes les saisies derrière ; et la clé
(nom, année) garantit qu'elles ont toutes tapé le même couple. C'est
précisément ce que la garde membre protège (« ne pas republier le talk d'une
autre sous un nom qu'elle n'a pas tapé ») et ce que l'arbitrage, lui, a pour
mandat de faire. Garde conservée : `statut = 'en_attente'` — une proposition
déjà arbitrée ne se réécrit pas.

Effet de bord assumé : corriger vers le (nom, année) d'une AUTRE proposition en
attente laisse deux lignes pour une édition. Sans dégât — la seconde validation
rattache à l'édition existante — et la page de la file le montre côte à côte.

### Lot 3 — Le catalogue cesse d'arbitrer, la file peut finir (défaut E)

- `/admin/conferences/propositions` : la file, une **ligne** par proposition
  (nom · année · autrice · N saisies · l'indice du répertoire), et la rangée
  ENTIÈRE mène à sa page. **Plafond d'affichage qui annonce son compte exact**
  (§ listes des principes UI), page suivante par `?page=`.
- `/admin/conferences` retrouve son rôle : une rangée « Conférences
  proposées (113) » qui mène à la file. Le mur de cartes disparaît, et
  l'erreur de 2026-07-11 avec lui.

**Renversement de la passe UX : la file n'ARBITRE pas.** Le premier jet posait
les deux gestes sur chaque rangée. Trois règles du dépôt disent non, et la
troisième est la nôtre :

1. écarter est un geste de **palier 2** — définitif, périmètre borné : il bloque
   ce nom pour son autrice **toutes années confondues**
   (`findPropositionByNom`), et rien, dans le produit, ne dés-écarte. Il lui
   faut sa modale nominative, qui annonce le périmètre chiffré. Vingt-cinq fois
   sur une liste, c'est intenable ; une fois sur la page de l'item, c'est juste ;
2. 25 rangées × 2 boutons faisaient **cinquante boutons homonymes**, ce que les
   principes UI nomment explicitement comme un échec de conception (§6) ;
3. c'est l'argument que ce doc opposait déjà au « tout valider », appliqué d'un
   cran plus bas : **le débit tenable vient de l'écran qui donne à juger, pas
   d'un bouton qui saute le jugement.** Un « Valider » de rangée est un « tout
   valider » d'une ligne à la fois.

Le prix est assumé : deux gestes par proposition au lieu d'un. L'indice du
répertoire reste sur la rangée — il sert au **tri**, pas au geste : les
propositions qui vont poser question se repèrent sans les ouvrir.

**Ce qu'on ne fait pas, et pourquoi** : pas de « tout valider ». Faire entrer
113 marques d'un clic dans le répertoire partagé sans les regarder est
exactement le risque pour lequel la file existe. Le débit tenable vient du lot 2
(une page qui donne à juger en un écran), pas d'un bouton qui saute le
jugement.

## Deux choses vues À L'ÉCRAN, et tranchées là (passe UX du lot)

- **Un seul mot pour l'arbitrage négatif : « Écarter ».** Le bouton disait
  « Refuser » quand tout le reste disait « écarter » — le message de
  confirmation (« Proposition écartée »), le badge côté membre (« Conférence
  écartée »), et le code (`dejaEcartee`). Deux mots pour un geste, dont un
  seul revient dans la phrase qui suit le clic.
- **Le CTA arrive APRÈS les trois blocs, et c'est voulu**, alors que la règle
  dit « un seul CTA, toujours visible, jamais sous la flottaison ». Ici l'ordre
  de lecture EST la fonction de la page : juger, puis agir. Un « Valider »
  collant en haut d'un écran fait pour être lu inviterait au clic avant la
  lecture — exactement le geste que ce lot existe pour empêcher. La page reste
  courte (trois blocs), le pied de page laisse de quoi faire défiler, et
  l'écran d'où l'on vient (la file) porte, lui, le geste rapide.

## Ce que la file réelle a mesuré (2026-08-22) : deux bornes de plus

L'orga a posé la question que l'écran est censé rendre inutile : « y'a quelque
chose qui m'aide à vérifier ces 114 conférences ? » Réponse mesurée, en jouant
`rapprocher()` — la fonction livrée, pas une approximation — sur les 112 noms
lus dans sa capture, contre le catalogue d'amorçage (126 conférences) : **31
déjà au répertoire** (valider ne crée rien), **17 ressemblent**, **64 noms
neufs**.

Et le tri a montré un défaut de la fonction elle-même. Trois propositions
marquaient **1,00** contre « ParisTestConf » — le score d'un vrai doublon :
« Women Who Go Paris », « Ladies of Code Paris », « Paris Container Day (PCD) ».
La cause tient en deux faits qui se rencontrent : « paris » commence
« paristestconf », et un nom du répertoire sans aucune coupure fait **un seul
jeton**, donc « la part des jetons du plus court » saturait à 1 sur 1. Une ville
partagée valait une identité de marque.

**Deux bornes, une par moitié du défaut :**

- `COUVERTURE_DEBUT` (0,6) : un début commun doit peser dans le mot qu'il
  prétend désigner. « devoxx » fait les trois quarts de « devoxxfr », « paris »
  un gros tiers de « paristestconf ».
- `memeSuiteDeLettres` : la borne ci-dessus, seule, perdait « SunnyTech » →
  « Sunny Tech » (« sunny » ne couvre que la moitié de « sunnytech »). Or c'est
  justement la coupure qui manque d'un côté : recoller les jetons rend la
  comparaison à l'échelle du **nom**. Égalité stricte, pas un début commun — un
  nom qui commence l'autre sans l'épuiser (« DevoxxFR » dans « Devoxx France »)
  remonte déjà par les jetons, aux mêmes bornes, et une seconde voie pour le
  même fait ne serait qu'une branche sans cas à elle.

Après correctif, sur la même file : **31 / 14 / 67**. Les trois « Paris »
sortent, et tous les rapprochements vrais tiennent (« VoxxedDays Luxembourg »,
« RivieraDev », « DevFest Strasbourg 3019 », « SunnyTech », « DevoxxFR », les
quatre variantes de KubeCon, « Meetup Cloud Native Aix-Marseille », « DevQuest
Niort », « OVHcloud meetup »).

**Deux réserves sur ces nombres**, dites parce qu'elles changent ce qu'on en
fait : le répertoire comparé est le catalogue d'amorçage du dépôt, pas la base
de production ; et la liste vient d'une capture d'écran, 112 noms lus sur les
114 annoncés.

**Générosité qui reste, assumée** : une proposition d'UN seul mot remonte tout
ce qui le contient — « Toulouse » remonte « AFUP Toulouse », « Agile Game
Toulouse », « Agile Toulouse » à 1,00 ; « DevoxxFR » remonte les trois Devoxx du
catalogue. C'est l'asymétrie des coûts déjà écrite en tête du module (un doublon
manqué s'installe dans un répertoire partagé, un indice de trop coûte un coup
d'œil), et `MAX_PROCHES` en borne l'encombrement à trois lignes.

## Ce que les quatre passes ont changé (et que la conception avait manqué)

La revue avant PR a trouvé **trois défauts de justesse**, dont deux prouvés par
sonde sur une vraie base. Aucun ne remettait en cause le lot ; tous les trois
étaient dans les angles morts de ce document.

- **La correction orga était annulée EN SILENCE par la membre.**
  `updatePropositionParOrga` n'écrivait que `conference_propositions.nom` — or
  `talk_occurrences.conference` est le nom que la membre voit dans son espace ET
  celui que son formulaire pré-remplit. Elle revenait ajouter un lien de slides,
  son écran renvoyait « DevoxxFR » sans qu'elle puisse le savoir,
  `findPropositionByNom` ne trouvait plus rien sous ce nom, et la porte membre
  réécrivait la ligne à l'ancien nom. Le doublon de marque que cet écran existe
  pour empêcher redevenait possible, sans que personne ne le voie passer.
  Correctif : le libellé figé des saisies est renommé **dans la même
  transaction**. Le lieu, la date et les liens restent à leur autrice.
- **L'année se corrigeait à l'aveugle.** La validation estampille le libellé
  `${conf} ${annee}` sur **toutes** les occurrences derrière la proposition,
  sans jamais regarder leur date. Deux saisies sans date derrière une même ligne,
  une année renseignée par l'orga, et un talk donné en 2023 partait en ligne sous
  « … 2025 » — pour une autrice qui n'avait jamais tapé ce couple. La garantie
  que ce doc invoquait (« la clé (nom, année) garantit qu'elles ont toutes tapé
  le même couple ») est vraie du **nom** ; elle ne dit rien quand l'année est
  nulle, ni quand c'est l'orga qui la change. Correctif : l'écran de correction
  MONTRE les saisies et leurs dates, au-dessus du champ. **Montrer plutôt que
  bloquer** : deux membres peuvent avoir tapé la même année fausse, et corriger
  reste le geste juste.
- **L'écran se contredisait** quand une conférence identique ET des
  ressemblances coexistaient (« Agile Tour Toulouse » au répertoire, « Agile
  Tour Nantes » et « … Rennes » en voisines) : il annonçait le rattachement,
  puis demandait de corriger le nom, en proposant deux autres villes. Un état,
  une voix : l'identique règle la question, les ressemblances ne s'affichent
  qu'à défaut.

Deux angles morts de TESTS, mesurés (mutation verte) et refermés : la pagination
n'était gardée qu'à la page 1 (un `offset` décalé rendait 88 propositions sur 113
inatteignables, 13 tests verts), et le cliquet RGPD du `contexte` ne voyait que
la forme NOMMÉE de la règle — un nom de personne sur la ligne groupée traversait
4 256 tests verts.

## Dette soldée en passant

- **La garde d'état du refus** (dette P2, XS) : `refuseConferenceProposition`
  écrivait `statut = 'refusee'` sans clause sur le statut courant, là où son
  jumeau garde `statut = 'en_attente' FOR UPDATE`. Deux onglets, et une
  conférence validée par l'une passait « refusée » par l'autre — après quoi
  `findPropositionByNom` refusait ce nom à sa membre **toutes années
  confondues**. La clause manquante est posée ; le refus rend désormais un
  booléen, et l'écran dit « déjà traitée » au lieu d'annoncer un succès faux.
- **Le champ endpoint d'une proposition côté orga** accepte l'adresse de la
  page programme (détecteur `detecteur-sessionize.ts`), comme les autres écrans
  orga — le schéma membre garde l'id strict. Un seul objet de champs partagé
  entre les deux, au lieu de deux listes jumelles à maintenir.

## Ce que ça laisse ouvert (rangé en dette, pas fait ici)

- **La lecture du résumé est bornée en CHARGE UTILE, pas en travail.**
  `conference_propositions` ne porte aucun index hors sa clé primaire : les trois
  lectures du résumé (compte, plus ancienne, première ligne) sont trois parcours
  séquentiels plus un tri, à chaque rendu de page connectée. Sans commune mesure
  avec la matérialisation d'avant (113 lignes jointes à `users`), mais l'argument
  « borné » de la passe sécurité ne vaut que pour ce qui traverse le réseau. Un
  index `(statut, created_at)` le règle — donc une migration, donc pas dans ce
  geste. **Effort : XS.**

- **Aucune trace de la correction orga.** `conference_propositions` ne porte ni
  `updated_at` ni `corrige_par` : une correction fautive est inattribuable, et
  l'autrice n'est pas informée que le nom a bougé (elle le VOIT, depuis le
  correctif ci-dessus, mais rien ne le lui dit). Traçabilité d'une écriture orga
  sur une donnée de membre — **effort : S**.
- **L'année corrigée reste réversible par la membre — mesuré, pas supposé.** Le
  nom est désormais cohérent des deux côtés ; l'année non, parce que la porte
  membre la recalcule depuis SA date de saisie. La re-revue du lot l'a joué en
  sonde : l'orga corrige 2024 → 2025, la membre revient ajouter un lien, sa clé
  `(nom, 2024)` ne retrouve plus la ligne, et `updateConferenceProposition`
  réécrit `annee: 2024`. Personne n'en est averti. Variante à deux saisies : la
  porte membre refuse, on retombe sur `soumettreProposition`, et une SECONDE
  ligne s'ouvre en file au même nom — le doublon que l'écran existe pour
  empêcher, déclenché par la correction. La parade est côté membre : quand sa
  saisie tient déjà une proposition, la retrouver par son `proposition_id`
  plutôt que par la clé `(nom, année)`. **Effort : S**, et c'est le prochain
  geste de cette zone.
- **L'arbitrage ramène toujours en page 1.** La file est triée par ancienneté et
  ne liste que ce qui attend : on arbitre depuis le début, donc le cas est rare.
  Reporter `?page` demanderait de le faire voyager par la page de l'item.
  **Effort : XS.**

- **Fusionner deux marques déjà créées** dans le répertoire (le doublon que ce
  lot empêche d'apparaître, pas celui déjà là). Effort : M — il faut déplacer
  les éditions, les occurrences et les logos.
- **Ramassage des propositions à zéro saisie** (dette XS déjà inscrite) : la
  page de la file le DIT désormais (« aucune saisie derrière »), l'orga écarte.
- **Une saisie qui tape le nom exact d'une conférence du répertoire** ouvre
  quand même une proposition (la porte membre ne consulte pas le répertoire).
  Sans dégât — la validation rattache — mais c'est du bruit dans la file.
  Effort : S.

## Tests (TDD, avant le code — puis cassés une fois)

| Ce qui est gardé | Le test | La mutation qui doit le faire tomber |
|---|---|---|
| La file entre dans « À faire » | `taches.test.ts` : une proposition ⇒ une tâche datée `valider-conference` | retirer la règle du moteur |
| Elle allume | `taches-signal.test.ts` : `desTachesAttendent` vrai sur une file non vide | marquer la règle `constat` |
| Elle groupe | 3 propositions ⇒ UNE ligne, échéance = la plus ancienne | remplacer `directeOuGroupee` par une boucle |
| Le canal e-mail n'oublie rien | `digest-email.test.ts` : l'agrégat sort | supprimer la ligne de `AGREGATS` (erreur de compilation attendue) |
| Le rapprochement voit un doublon de marque | `proposition-rapprochement.test.ts` : « DevoxxFR » → « Devoxx France » ; « … EU » → « … Europe » | rendre le score exact-only |
| Il ne crie pas au loup | deux conférences sans jeton commun ⇒ aucune voisine | abaisser le seuil |
| Une ville partagée n'est pas une marque | `proposition-rapprochement.test.ts` : « Women Who Go Paris » ⇒ aucune voisine face à « ParisTestConf » | retirer la clause `COUVERTURE_DEBUT`, ou la descendre à 0,3 |
| Les mêmes lettres à une séparation près restent un doublon | « SunnyTech » → « Sunny Tech », « RivieraDev » → « Riviera Dev », « VoxxedDays Luxembourg » → « … Days … » | retirer la voie `memeSuiteDeLettres` (le jeton seul ne les voit pas) |
| La page montre la saisie | test de page : titre du talk et nom de l'autrice à l'écran | retirer le bloc |
| Aucune adresse e-mail ne sort | le DTO n'a pas de champ e-mail, et la page ne l'affiche pas | ajouter l'e-mail au SELECT |
| La correction orga est gardée | `actions-conferences.test.ts` : sans session orga ⇒ refus ; proposition arbitrée ⇒ refus | retirer `requireOrgaId`, retirer la clause de statut |
| Le refus ne réécrit pas un arbitrage | intégration : refuser une proposition `validee` ⇒ rien écrit | retirer `AND statut = 'en_attente'` |
