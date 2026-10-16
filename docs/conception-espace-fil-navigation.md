# Conception — L'espace connecté v2 : le fil, la navigation, le réseau entre speakeuses

> Statut : **conception d'ensemble validée sur maquette** (fil de fer v5.1 +
> affinages, journée du 2026-08-07, avec Cateline). Chaque lot repassera par
> une conception détaillée avant son code. Ce document REMPLACE le cadrage de
> `conception-fil-communaute-espace.md` (qui reste l'historique du lot 1 et de
> ses revues) et amende `conception-tableau-de-bord-orga.md` (v6) sur la
> navigation et les tâches.
>
> **Révision du 2026-10-15 — la navigation sur bureau, et la fiche à un geste**
> (maquette cliquable bureau + mobile validée par Cateline le même jour ; v6 au
> journal §2). Ce qui change, et qui prime sur §3, §5 et §6 :
>
> - **Grand écran : un rail à gauche** (`src/components/RailEspace.tsx`). Avant
>   lui, la barre basse était masquée dès `lg` et RIEN ne la remplaçait : sur
>   bureau, l'espace n'avait que le menu du compte. Le rail porte les mêmes
>   destinations que la barre, avec la même règle de « vous êtes ici »
>   (`src/lib/entree-courante.ts`) ; en tête, le geste n° 1 en bouton
>   (« Ajouter un talk ») ; en plus, Messages et un groupe **Organisation**
>   (orgas seulement) — le tap de plus payé par les orgas (§3) ne vaut que sur
>   mobile.
> - **L'onglet-photo s'appelle « Ma fiche » et mène À la fiche**
>   (`/mon-espace/fiche`), comme §3 le prévoyait déjà. « Mon profil » (rangées
>   de rôle, réglages, messages) s'atteint par une rangée en bas de la fiche,
>   par le rail et par le menu du compte. L'onglet ne s'allume QUE sur la
>   fiche et les talks (tranché par Cateline le même jour) : ailleurs, aucun
>   onglet ne s'allume — le repli de l'audit C5 était vrai sous « Profil »,
>   il ne l'est plus sous « Ma fiche ».
> - **➕ « Ajouter une date à un talk »** (§6) : un talk retenu à une nouvelle
>   conférence est la mise à jour la plus fréquente, et elle obligeait à ouvrir
>   le talk. La feuille mène à la fiche, où la fenêtre « Une date » du talk
>   s'ouvre d'elle-même ; sur la fiche, chaque talk a son bouton « Une date »
>   (conférence, édition, ville, date ; liens ensuite).
>
> Méthode de la journée : maquettes fil de fer itérées sur téléphone (v1 → v5),
> chaque version tombée sur un retour argumenté — le journal en §2 est là pour
> qu'on ne re-litige pas.

## 0. Ce qu'on n'est pas : la ligne anti-LinkedIn

La question a été posée en face (« est-ce qu'on ne refait pas un LinkedIn ? »)
et la réponse est la doctrine de tout ce qui suit : **LinkedIn optimise
l'attention, nous optimisons un résultat hors ligne** — quelqu'un monte sur
scène. Leur fil est la destination ; le nôtre est un moyen.

Le test, à poser sur CHAQUE future idée d'écran ou de fonctionnalité :
**« est-ce que ça rapproche quelqu'un d'une scène ? »** Sinon, non.

| Eux | Nous, jamais | Parce que |
|---|---|---|
| Graphe social (connexions, followers) | Pas de graphe : la communauté est le réseau, entière | Suivre/être suivie crée des hiérarchies ; ici tout le monde voit tout le monde |
| Fil algorithmique, scroll infini | Chronologique, fin de fil « Tu es à jour ✓ » | On veut que les membres passent PEU de temps ici et beaucoup sur scène |
| Posts libres (humeurs, opinions) | Des FAITS structurés : talk, fiche, article, demande d'aide, événement | Un fil de faits reste utile et se modère ; un fil d'opinions demande une armée |
| Métriques de vanité publiques | Compteurs sobres, jamais comparatifs | La comparaison décourage — l'inverse de la mission |
| Pub, premium, algorithme de rétention | Rien à vendre aux membres | L'asso sert ses membres |

Et l'atout que LinkedIn ne peut pas copier : **un espace fermé entre pairs**.
Une femme qui n'écrira jamais en public « je n'ai jamais donné de talk, j'ai
le trac, aidez-moi » peut le dire ici. C'est la raison d'être du réseau
interne (§8), et c'est pour ça qu'il vaut mieux ici que sur WhatsApp, où la
demande se noie en vingt minutes.

## 1. La vision : deux accueils jumeaux

- **La home publique `/`** donne envie de REJOINDRE (inchangée dans ce lot).
- **L'Accueil connecté `/mon-espace`** donne envie de MONTER — et sa forme est
  **le fil, façon réseaux** : le langage d'interface que chaque membre
  pratique déjà ailleurs. L'incitation passe PAR L'EXEMPLE (« Asma a mis sa
  fiche à jour : nouveau talk »), jamais par des injonctions empilées.

## 2. Journal des versions (anti-relitige)

| Version | Forme | Tombée parce que |
|---|---|---|
| v1 (lot 1 livré) | Section « Dans la communauté » en bas du hub existant | L'accueil restait un fourre-tout ; le fil enterré au 3ᵉ écran ; badge « Nouveau » jamais soldé sur le parcours majoritaire (revue exigeante, 4 rapports) |
| v2 | Trois piliers : à faire / à venir / fil | Structure sans objectif ; « on n'est pas dans un rôle de type fil » ne suffisait pas — il manquait l'intention |
| v3 | Un objet unique « ta progression » (marche + preuve) | Dupliquait encore les onglets (à venir = Agenda, preuve = actus) ; sections ≠ flux |
| v4 | Flux de cartes, marche épinglée en tête + carte-rappel | Les cartes perso en tête trahissaient le fil : « les cartes en haut ne sont pas alignées avec l'objectif de fil » |
| v5 / v5.1 | **Fil pur + barre canonique + le « moi » à part** | Validée — affinée ensuite par les exemples Instagram (onglet-photo, page profil riche) et par le réseau interne (§8) |
| v6 (2026-10-15) | **Rail bureau + onglet « Ma fiche » + une date sans ouvrir le talk** | Validée sur maquette cliquable (bureau et mobile). Déclencheur : « c'est horrible pour mettre à jour sa fiche de speakeuse, alors que c'est LE truc qui doit être hyper simple » — sur bureau, aucune navigation d'espace ; partout, la fiche à deux gestes et une date à cinq |

Leçons de méthode, payées dans la journée : les maquettes se valident
EXPLICITEMENT (jamais « envoyée » = « validée ») ; les correctifs de
navigation ne se glissent pas au fil de l'eau dans une PR d'un autre sujet
(décision « 3 non ») ; les captures d'apps sont des EXEMPLES pour nourrir le
jugement, pas des consignes à recopier.

## 3. Le système : un accès = un objectif

La phrase-test avant toute évolution d'un écran : « est-ce que ça sert SON
objectif ? » Sinon, ça va ailleurs.

| Accès | Objectif (une phrase) |
|---|---|
| **Header** | `☰` (site, à GAUCHE — geste rare) · logo + nom (lien accueil du site) · `loupe` (recherche). C'est tout : le « moi » a quitté le header. |
| **Burger ☰** | Aller au site public. Identique connectée ou non. Sa section « Mon compte » disparaît. « Accueil du site » en tête (LIVRÉ, PR #291). |
| **Barre basse** | LA MÊME pour tous les rôles — la stabilité d'une barre est l'identité du produit : `Accueil · Agenda · ➕ · Messages · [ma photo]`. (Onglet 4 devenu « À faire » le 2026-08-16 ; sur grand écran, le rail la remplace depuis le 2026-10-15 — voir l'en-tête.) |
| **Accueil** (onglet 1) | Le fil : ce qui se passe chez nous, et l'envie qui va avec (§4). |
| **Agenda** (onglet 2) | Où et quand la communauté parle — le mien et le public. |
| **➕** (onglet 3, central) | CRÉER — la matière première du fil : talk · article · demande d'aide (orga : + actualité · atelier). Patron Vinted : l'acte qu'on veut encourager occupe le centre. |
| **Messages** (onglet 4) | La boîte : messagerie INTERNE entre membres (§8), les contacts externes relayés n'en sont qu'un type. |
| **[Ma photo]** (onglet 5) | Le profil : Ma fiche enrichie (§5). L'onglet affiche l'avatar de la personne (patron Instagram) — libellé « Ma fiche » conservé pour l'accessibilité. |
| **/actualites, /agenda, /speakeuses** | Les listes complètes restent PUBLIQUES — le fil n'archive rien, il pointe. |

Le travail de rôle (orga, coach, participante) ne change JAMAIS la barre : il
vit en rangées sur la page profil (§5). Coût assumé et chiffré : ~3 orgas
paient un tap de plus pour que ~200 membres aient une app canonique.

Détail header : sans avatar en haut, le nom « TECH SPEAK'HER » retient sa
place sur mobile (la mesure sur iPhone 17 qui le condamnait comptait DEUX
emplacements ajoutés ; il n'y en a plus qu'aucun — seul ☰ change de côté).

## 4. L'Accueil = le fil, pur

Un seul flux de cartes, antichronologique, **zéro carte personnelle** — pas de
marche épinglée, pas de rappel : le perso vit sur le profil. Fin de fil après
~20 cartes : « Tu es à jour ✓ ». Pas de page d'archive, pas de marqueur de
visite (la colonne `fil_ouvert_le` du lot 1 sort avant merge, cf. §10).

**Les cartes** — une carte = un fait, incarné (avatar + nom + fait en verbe),
la carte entière mène à une page existante :

| Carte | Exemple | Source |
|---|---|---|
| Sur scène | « Léa Marchand · sur scène — “Débugger…” donné à Devoxx » | `getScenesRecentes` (lot 1, conservé) |
| Fiche à jour | « Asma · fiche à jour — nouveau talk : “…” » | talks publiés (nouveau dériveur ; groupé par personne et par jour, anti-inondation) |
| A rejoint l'annuaire | « Salomé · a rejoint l'annuaire » | `getNouvellesVenues` (lot 1, conservé) |
| Article | « Nawel · a publié un retour d'expérience » | contenus signés (§7) |
| Asso | actualité, Tremplin (candidatures, photos de finale) | contenus orga (existant) |
| Demande d'aide | « Camille · cherche une répétition blanche avant le 15 » | §8 |

**Protections, héritées du lot 1 et non négociables** : une fiche retirée
disparaît du fil rétroactivement (toutes cartes qui la nomment) ; scènes
strictement passées à date exacte ; jamais de brouillon ; le retour après
retrait est DISCRET (`published_at` posé seulement s'il est vide — finding de
la revue exigeante, corrigé au lot N0) ; les nouveautés PLATEFORME restent hors du
fil (changelog ≠ communauté → lettre d'information).

## 5. Ma fiche = le profil (l'onglet-photo)

Le modèle « profil » complet, inspiré des exemples (pas recopié) :

- **En tête** : photo, nom, stats sobres (talks · scènes faites — jamais
  comparatives), état de la fiche.
- **« Partager ma fiche »** : le geste d'une speakeuse vers une organisatrice
  de conf — il n'existe pas aujourd'hui et sert directement la mission.
- **Ta prochaine marche** : UNE carte dérivée des données (sans fiche → la
  créer, écartable « Aucune fiche pour moi » ; fiche sans talk → premier
  talk ; sans date à venir → viser une scène ; datée → préparer). La
  complétude existante devient son détail.
- **Les talks** : section du profil (« comme les expériences LinkedIn » —
  l'onglet Talks disparaît, décision du 2026-08-07).
- **En rangées discrètes, sous le pli** : Réglages, et le travail de rôle —
  À faire (unifié, puces `Toutes · Perso · Asso · Coach`, une personne = une
  liste, décision du 2026-08-07), Tableau de bord orga (avec accès DIRECT aux
  ateliers de l'édition du moment — besoin exprimé, à livrer AVEC cette
  refonte), Mes coachées (renommage de « Coaching », la direction dans le
  mot), Documents (participante). Se déconnecter.

Le moteur de tâches reste la SOURCE UNIQUE ; l'e-mail de rappel en est un
canal, à la cadence choisie par la personne (modèle gravé le 2026-08-07 —
amendement à porter au doc tableau de bord, qui liste encore « notifications
e-mail » en non-retenu).

## 6. ➕ Créer

Une feuille (bottom sheet) : **Ajouter un talk** · **Écrire** (article,
astuce, retour d'expérience) · **Demander de l'aide**. Une orga voit en plus :
Actualité · Atelier. Chaque entrée mène au formulaire existant ou à créer —
le ➕ n'invente pas de formulaire, il raccourcit.

## 7. Les speakeuses écrivent

Articles, astuces, retours d'expérience — LA matière qui fait vivre le fil
entre deux conférences, et qui alimente le fil PUBLIC (/actualites, RSS,
recherche) autant que le fil connecté.

- **Infrastructure existante réutilisée** : table `contenus`, éditeur,
  `/articles/[slug]`, RSS. Il manque : l'**autrice** (lien au profil, byline
  sur l'article menant à sa fiche) et le **flux de relecture**.
- **Relecture avant publication** : une speakeuse soumet, une orga relit
  (charte, pas de correction du fond sans elle) — même modèle que la fiche,
  même SLA réglable, tâche « Relire l'article de {nom} » dans À faire. La
  publication crée la carte du fil et l'entrée publique.
- La byline est un choix : publier sous son nom (défaut, sa fiche) ou en
  anonyme communautaire — à trancher en conception détaillée du lot.

## 8. Le réseau entre speakeuses (interne à la communauté)

Ordonné par ratio valeur/coût — et chaque texte libre naît avec son bouton de
signalement :

1. **Bravo 👏 sur les cartes du fil** — l'encouragement, le mot de la
   mission. Une table (membre × carte), compteur nominatif (« Léa et 4
   autres »), ZÉRO texte donc zéro modération. Donnée personnelle visible en
   interne, assumé : un applaudissement anonyme ne vaut rien.
2. **« J'ai besoin d'aide pour… »** — demande STRUCTURÉE (type + échéance +
   description courte), carte du fil, visible jusqu'à résolution (« résolu »
   par la demandeuse). Bouton « Je peux aider » → message interne. C'est ce
   qui remplace WhatsApp : pas un clone de chat, la capture des échanges
   structurés — le bavardage peut rester sur WhatsApp.
3. **Messagerie interne** : Messages devient la boîte entre membres ; les
   contacts externes relayés (rares) en sont un type. Asynchrone, sobre —
   jamais un temps réel à la WhatsApp (gouffre produit).
4. **Commentaires** — en dernier, scopés d'abord aux ARTICLES : l'autrice
   modère les siens, signalement vers l'orga. Jamais sur toutes les cartes
   tant que l'équipe de modération se compte sur une main.

## 9. RGPD, sécurité, modération

- Tout ce que le fil montre est déjà public OU interne à l'espace connecté
  fermé (Bravo, demandes d'aide, messages) — et le doc de chaque lot listera
  ses données nouvelles, sa base légale et sa cascade de suppression.
- Retrait rétroactif partout : fiche retirée = cartes, bravos et byline
  retirés. Compte supprimé = cascade complète.
- Signalement sur tout texte libre dès le premier jour du texte libre.
- Les gardes serveur restent la règle du dépôt : identité de session, autorisations
  revérifiées par action, SQL paramétré, DTO minimaux.

## 10. Conséquences sur l'existant

- **PR #291 (non mergée) maigrit** : la page `/mon-espace/fil`, le marqueur
  `fil_ouvert_le` (migration 061) et la section « Dans la communauté » du hub
  sortent ; RESTENT les sources (`getScenesRecentes`, venues datées, filtre
  `avecDestination` et son test anti-dérive), les correctifs (burger
  « Accueil du site », Paris-date de `publie_le`), la conception
  et le CHANGELOG. Les findings a11y de la revue exigeante s'appliquent aux
  cartes du futur fil.
- **Correctif indépendant à garder** : le retour discret après retrait
  (`published_at` posé seulement si vide) + une phrase de consentement à la
  soumission de fiche (« son arrivée est signalée… »).
- La ligne « fil de la communauté » des mentions légales (marqueur) sort avec
  la colonne.
- `BottomNav`, `EspaceNav` résiduel, le hub `/mon-espace` actuel et l'onglet
  Talks sont refondus par les lots ci-dessous.

## 11. Découpage en lots

Chaque lot : conception détaillée → revue (correction explicite +
`/security-review` si auth/données ; `/simplify`) → maquette si écran neuf →
TDD → revues → merge. La CI ne tourne que sur les PR ciblant `main`.

- **N0 — la PR #291 maigrit et merge** (retraits §10 + retour discret).
- **N1 — navigation** : header (☰ gauche), burger allégé, barre canonique
  (➕ inactif au début : feuille à une seule entrée « talk »), onglet-photo,
  page profil (stats, partager, marche, rangées rôle, Talks absorbé).
- **N2 — le fil** sur l'Accueil (cartes scène/fiche/venue/asso, protections).
- **N3 — les speakeuses écrivent** (autrice + relecture + carte article).
- **N4 — Bravo**.
- **N5 — demandes d'aide + messagerie interne**.
- **N6 — commentaires sur articles**.

## 12. Non-retenu / questions ouvertes

- Non-retenu : graphe social, algorithme, posts libres, métriques publiques,
  chat temps réel, page d'archive du fil, marqueur vu/non-vu (§0 et journal).
- Ouvert, à trancher lot par lot : copie des cartes et des verbes ; seuils
  (cartes avant « Tu es à jour », groupement fiche-à-jour) ; byline anonyme ;
  place de Documents pendant une édition ; feuille ➕ exacte par rôle.
