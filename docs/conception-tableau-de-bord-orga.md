# Conception — Espaces, tableaux de bord et navigation globale (v6)

> Statut : **conception révisée** (v6 : header inchangé — pas de pastille
> d'espace ; le burger bascule, le fil d'Ariane raciné à l'espace situe),
> **à valider avant code**. Maquette fil de fer cliquable jointe (artifact
> « Maquette — Tableaux de bord TSH »).
>
> ⚠️ **Amendé le 2026-08-07 par `docs/conception-espace-fil-navigation.md`**
> (l'espace connecté v2) : le « À faire » devient UNIFIÉ toutes casquettes
> (puces `Toutes · Perso · Asso · Coach` — la séparation MOI/L'ASSO des tâches
> tombe), la navigation change (barre canonique unique, burger = site seul),
> et l'e-mail de rappel devient un CANAL du moteur de tâches à cadence choisie
> par la personne — le « non-retenu : notifications e-mail » ci-dessous ne
> vaut plus.
>
> Le lot N1 (2026-08-08, `docs/conception-lot-n1-navigation.md`) a LIVRÉ
> cette navigation : barre canonique unique, burger réduit au site, « Mon
> profil » porte les accès de rôle (dont l'accès direct aux ateliers de
> l'édition en cours) — les sections navigation ci-dessous sont l'historique.

## Le modèle : MOI vs L'ASSO

Le critère de séparation des espaces est **le sujet de la donnée**, pas la
« casquette » :

- **`/mon-espace` = MOI** : tout ce dont je suis le sujet — ma fiche, mes
  talks, ma participation au Tremplin, les ateliers où je vais, les ateliers
  que j'anime (coach). Speakeuse et coach sont deux façons d'être le sujet →
  leurs tâches SE MÉLANGENT dans une seule liste « À faire » perso, triée par
  urgence, puce « Tu animes » sur les lignes d'animation quand ça mélange.
  L'espace se renomme « **Mon espace** » (un coach n'est pas une speakeuse).
- **`/admin` = L'ASSO** : tout ce dont les données de l'asso sont l'objet —
  les fiches des autres (modération), les éditions, la logistique. Garde
  `isOrga`, volumes et état d'esprit différents → NE SE MÉLANGE PAS avec le
  perso. Une orga-speakeuse-coach a deux lieux, pas trois.
- **Anti-doublon** : une tâche vit dans UN espace. Pour une orga (même coach),
  les tâches d'exploitation d'atelier restent dans `/admin` ; `/mon-espace` ne
  les porte que pour un coach non-orga (v2).

## Navigation globale : un dispositif par niveau, présent partout

Les onglets EspaceNav sont supprimés (rendus sur 3 pages seulement,
disparaissent en profondeur, inexistants pour un coach seul). À la place :

**Contrainte mobile (réel iPhone)** : le header actuel affiche logo, nom,
loupe, burger — il est PLEIN. On n'y ajoute rien : ni pastille, ni avatar.

| Besoin | Dispositif permanent |
|---|---|
| Basculer d'espace (geste RARE) | **Le burger**, patron « réglages » (itéré en preview) : en tête la **carte d'identité** (avatar + nom + « Connectée »), identité SEULE — pas une navigation. Puis des sections TITRÉES aux rangées groupées en cartes (style unique, chevron ›, la zone est dite par son titre, jamais par la couleur seule) : « Mon espace » (Ouvrir mon espace), « Espace orga » selon les rôles (Tableau de bord, Speakeuses, Tremplins, Réglages — jamais d'entrée morte), « Site » (Tremplin en accent, puis les pages publiques). « Se déconnecter » dans SA carte, en orange, hors navigation. Déconnectée : la carte devient « Se connecter ». |
| Savoir où je suis | **Fil d'Ariane collant, RACINÉ À L'ESPACE** : sur la plateforme, il part de « Mon espace » / « Espace orga » (plus d'« Accueil » public en tête), 3 niveaux visibles sur mobile (livré). La racine cliquable ramène au tableau de bord de l'espace. |
| Circuler dans une édition | Sous-nav 6 pastilles identique sur toutes les pages d'une édition (Jury et Récompenses repliés sous Finale). |

Compteurs dans les h1 (« Ateliers (5) »), jamais en badge de pastille ni
d'onglet (revue KISS : coût requêtes + bruit).

## Une page = une fonction (patron « paramètre »)

Les fiches denses (atelier, participante, réglages) deviennent des
**sommaires** : une rangée par fonction, qui AFFICHE la valeur actuelle en
sous-titre (« Lien visio · pas encore communiqué ») et mène à une **sous-page
mono-fonction** — un titre, un seul champ ou groupe, UN CTA, retour au
sommaire. Comme un réglage Google ou une étape Doctolib, sauf que l'ordre est
libre. Bénéfices : un seul CTA par écran (charge cognitive), des URL profondes
par fonction (les tâches du tableau de bord pointent DIRECTEMENT sur la
sous-page), mobile-first naturel. Les toggles à enregistrement immédiat
(SettingToggle) restent des rangées du sommaire : ils sont déjà mono-geste.

## Tri : « proximité au présent », partout

- **À venir** : du plus proche au plus lointain (prochain atelier d'abord).
- **Passé** : du plus récent au plus ancien.
- **Pertinence qui décline** : dans Mon espace, le bloc Tremplin est haut
  tant que l'édition est active ; une édition archivée descend dans une
  section « Souvenirs » SOUS Mes talks (dans un an, le Tremplin est un
  souvenir, ses talks restent vivants). Même logique côté orga : éditions
  actives d'abord, archivées repliées.

## Principes des tâches

1. **Dérivées des données, jamais stockées** : une tâche apparaît parce que la
   condition est vraie, disparaît parce qu'on a agi. Chaque tâche = phrase
   actionnable + lien direct vers l'écran où agir. Une tâche sans écran
   d'action accessible à son destinataire ne doit pas exister.
2. **Critère d'entrée : RÉSOLUBLE** (une action finie la fait disparaître).
   Les états normaux durables ne sont PAS des tâches — ils restent des flags
   d'écran. Révisé en preview : « édition en préparation » est bien résoluble
   (l'OUVRIR la clôt), c'est devenu la règle 3ter — sinon le hub affiche un
   « Tout roule » mensonger sur une édition invisible du public.
3. **Tri à deux étages, anti-bruit** : datées d'abord (par date, puce « N j » /
   « En retard » sur CHAQUE tâche datée, le détail ne répète jamais la puce),
   résolubles non datées ensuite (sans puce). Pas de tri par volume.
4. **Surfaçage unique** : une anomalie vit dans la liste « À faire » et au
   point d'action. Les écrans intermédiaires n'en portent pas de copie
   textuelle (au plus un ⚠ muet).

## Les tâches v1 — `/admin` (orga)

| # | Condition | Tâche | Étage |
|---|---|---|---|
| 1 | atelier ≤ 7 j sans `lien_visio` | « Ajouter le lien visio de "{titre}" » | daté |
| ~~2~~ | ~~atelier ≤ 7 j réservé à 0 participante~~ **Retirée (revue)** : 0 participante est l'état normal d'un atelier « ouvert à toutes », pas une anomalie résoluble | — | — |
| 3 | atelier ≤ 7 j sans coach (table n-n vide ET texte libre vide) | « Trouver un coach pour "{titre}" » | daté |
| 3bis | atelier SANS date (ajouté en preview : un atelier, c'est un titre et une date) | « Donner une date à "{titre}" » → sous-page infos | calme |
| 3ter | édition en statut `preparation` (invisible du public) | « Ouvrir "{nom}" quand elle est prête » → sous-page statut | calme |
| 4 | atelier passé, ≥ 1 présence `non_renseignee` | « Pointer les présences de "{titre}" » | daté (en retard) |
| 5 | finale passée, récompense sans bénéficiaire | « Attribuer N récompense(s) » | daté |
| 6 | fiche speakeuse `en_attente` (engagement : validée sous 15 j) | « Valider la fiche de {nom} » | daté (échéance = soumission + 15 j) |
| 7 | inscriptions sans compte relié | « Relier N participante(s) à un compte » | non daté |
| 8a | photos dont une personne identifiée **hors inscription** attend son accord | « Recueillir l'accord pour N photo(s) » | non daté |
| 8b | photos bloquées par les **seules** inscrites (leur réglage de visibilité) | « N photos restent privées » | non daté, **constat** |

**« Constat » (2026-08-17)** : la ligne informe, elle ne réclame rien — aucun
geste posé dans l'app ne la referme. Elle reste dans la liste, sous une
étiquette « Pour information », et elle n'allume pas le point de l'onglet « À
faire ». **La 8b est la seule** : la couverture d'une inscrite vaut
`registration.public`, son réglage de visibilité à elle. Le champ `constat` de
`Tache` le porte, le prédicat partagé est `reclameUnGeste`, et la règle est dans
`docs/conception-technique-profil-et-a-faire.md` D3.

La 8 était d'abord une règle unique, marquée constat en bloc : elle avalait le
travail d'un clic de la 8a (la case « Accord recueilli »). La 7 aussi était
marquée à tort — `attachUserToRegistration` relie un compte existant
immédiatement. Deux relectures autonomes l'ont relevé le 2026-08-17.

**Engagements de délai (SLA)** : certaines tâches résolubles portent un
engagement de l'équipe orga — valider une fiche sous **15 jours**. Elles
deviennent datées (puce « J-x », puis « En retard ») : l'échéance est dérivée
(date de soumission + délai), jamais saisie. Les délais sont des **réglages**
(cf. C4), pas des constantes éparpillées.

Sous la liste, deux accès neutres sans duplication : « Speakeuses » et
« Tremplins » (titre de section : « Gérer »). État vide : « Rien à faire pour
l'instant. Tout roule. » (L'exclusion initiale d'« édition en préparation »
a été révisée : règle 3ter.)

Données : `getPendingProfiles` + par édition non archivée : ateliers,
membres+présences, coachs, récompenses, photos+tags (déjà requêtés par le hub).
**Correctif N+1 requis** : ajouter `presence` au SELECT de
`getAtelierMembersByEdition` (une requête sert les règles 2 et 4).

## `/mon-espace` v1 — adaptation + info, PAS de moteur

- **Haut de page adaptatif** : « Mon espace » ; le hero fiche-speakeuse ne
  s'affiche que si la personne a une fiche ou peut en créer une ; pour un
  coach sans fiche, carte reléguée « Créer ma fiche speakeuse ? » conditionnée
  au genre (jamais de CTA impossible).
- **Bloc « Prochains ateliers » fusionné** : participation + animation
  (préfixe « Tu animes », `getCoachAteliers`, lecture seule, statut du lien
  visio en info).
- Corrections de copie : salutation, zone danger, repli de nom « speakeuse ».
- Le moteur de tâches personnel (fusion hero-checklist → « À faire ») : v1.1
  — jamais deux listes de tâches concurrentes en haut de page.

## Découpage

- **C0** — navigation globale : **burger réorganisé** (section Plateforme
  selon les rôles — c'est LE basculeur d'espace), fils d'Ariane de la
  plateforme racinés à l'espace, renommage « Mon espace », suppression
  d'EspaceNav. Header intouché. Petit, indépendant, débloque le reste.
- **C1** — `/admin` tableau de bord : lib pure `taches-orga.ts` (8 règles, TDD
  sans base), correctif N+1, page `/admin` (À faire + Gérer), déménagement
  mécanique de la modération vers `/admin/speakeuses` (commit séparé).
- **C2** — `/mon-espace` adaptatif : haut de page par situation, « Prochains
  ateliers » fusionné, copie. Zéro moteur.
- **C3** — sous-nav d'édition 6 pastilles + hub d'édition en vue « À faire de
  l'édition » (les rangées domaines à compteurs disparaissent au profit de la
  sous-nav ; règle de surfaçage unique appliquée aux listes) + **fiches en
  sommaire** : atelier et participante passent au patron une page = une
  fonction (sous-pages : lien visio, présences, coachs, infos, phase…). La
  phase a sa propre sous-page (retour preview : elle n'a rien à faire sur
  « Informations », qui reste titre/date/horaires/description).
- **C4** — réglages plateforme : page `/admin/reglages` (patron sommaire +
  sous-pages mono-fonction) pour les délais et seuils : validation d'une
  fiche (15 j), fenêtre d'alerte ateliers (7 j), rappel de mise à jour
  speakeuse (6 mois). Stockage : petite table clé-valeur
  `plateforme_reglages` (migration), lue par le moteur de tâches avec
  valeurs par défaut en dur — le moteur marche sans la table. Les rappels
  personnels par personne (« tous les x jours ») : v2 (préférences
  utilisateur).
- **v1.1** — fusion hero-checklist → « À faire » perso ; ⚠ lien visio sur
  `/mon-espace/coaching/[edition]` (zéro requête).
- **v2** — actions coach (poser lien visio, pointer présences, gardées
  `isCoach` + scoping « ses ateliers »), puis règles coach injectées dans la
  liste perso (règle anti-doublon) ; signal inter-espaces si réclamé (une
  requête d'agrégat, pas de plomberie de badges).
- **Plus tard** — regroupement de `/admin/tremplins` par conférence (quand il
  y aura plus d'éditions).

## Non-retenu

- Table de tâches en base, notifications e-mail (sur-ingénierie).
- Page unique fusionnant MOI et ASSO (deux gardes, deux états d'esprit).
- Badges de compte sur la navigation (coût/valeur, bruit permanent).
- Pastille d'espace dans le header : ne tient pas sur mobile (header déjà
  plein : logo, nom, loupe, burger) ; la bascule est rare → burger.
- Trois espaces (un par casquette) : coach et speakeuse partagent le sujet
  « moi », les séparer reléguerait à nouveau l'un des deux.

## Retours preview (juillet 2026) — hub d'édition et ateliers

**Hub d'édition hiérarchisé par fréquence.** Ce qu'on fait SOUVENT sur une
édition (créer des ateliers, revenir mettre le lien visio, pointer les
présences, déposer les supports) vit en haut : « À faire » + pastilles de la
sous-nav. Ce qu'on fait UNE FOIS (informations générales, ouvrir l'édition,
la supprimer) descend en bas dans un sommaire discret « Réglages de
l'édition » : rangées Informations / Statut / Retrait (une page = une
fonction, patron des fiches). La modale fourre-tout « Modifier l'édition »
disparaît ; la zone danger n'occupe plus le premier écran (rangée Retrait en
orange, patron de la fiche participante). L'en-tête donne le pouls : conf ·
statut · finale (ou « Finale sans date »). La mention interne « (réglage
manuel : …) » quitte le hub (elle vit sur la sous-page Statut). Règle 3ter :
une édition en préparation n'affiche jamais « Tout roule » — sa tâche calme
« Ouvrir … quand elle est prête » pointe la sous-page Statut.

**« Ouvert à toutes » : propriété explicite de l'atelier (migration 030).**
Plus d'implicite « aucun membre = ouvert » : un atelier neuf n'est visible
que de l'orga ; l'ouverture à toutes les inscrites s'ACTIVE (interrupteur sur
« Participantes et présences »), indépendamment de l'inventaire nominatif des
membres (qui porte les présences). Les sommaires signalent le piège « ni
ouvert ni participante : invisible des inscrites ». Backfill une seule fois :
les ateliers existants sans membre restent ouverts (comportement préservé).
