# Clore une session — la méthode

> Doc **transversal et durable**. La version courte (quoi tenir, dans quel
> ordre) tient dans `CLAUDE.md` §Clore une session ; ici vivent la méthode, les
> cas particuliers de chaque doc, et les précédents qui les ont imposés.
>
> Voisins : `docs/revue-avant-pr.md` (les quatre passes),
> `docs/principes-tests.md` §9 (les tests hérités), l'en-tête de
> `docs/dette-technique.md` (la forme d'un item).
>
> Écrit le **2026-08-21**, à partir de quatre relectures indépendantes de la
> règle (angles roadmap, dette, tests, cohérence).

## Le périmètre, dit d'avance

Une session **n'est pas tenue de relire les deux docs en entier**. Elle est
tenue de :

1. **ne laisser aucune ligne fausse de son fait** — les sections que son travail
   touche, de près comme de loin ;
2. **marquer « à vérifier », avec la date**, ce dont elle doute sans avoir
   vérifié.

Une ligne marquée « à vérifier » est un bon état. Une ligne fausse laissée en
affirmation, non. C'est dit ici parce que la règle, lue sans ce cadre, ressemble
à « relire 2 000 lignes en fin de parcours » — et le risque n'est pas de le
faire mal, c'est de **sauter le geste en bloc**.

## Les deux fautes symétriques

| Faute | Ce qu'elle produit |
|---|---|
| **Solder au forfait** — marquer résolu sans avoir vérifié | Un chantier terminé qu'on rouvre, ou une garde qu'on croit posée (précédent du 08-08 : entrée « RÉSOLU » sur la seule existence d'un fichier de test, filtrage par rôle à une couche pendant des mois) |
| **Réaffirmer sans relire** — laisser un item ouvert, ou le mettre en avant, sans le confronter au code | Un item ouvert *à raison* et faux *dans tous ses détails*. Précédent du 08-21 : le P0-3 « zéro `onRequestError`, `instrumentation.ts` ne fait que `checkEnv()`, 78 `console.error` » a été **promu en tête de doc comme seul chantier ouvert** alors que le journal des erreurs existait depuis 12 jours (`ba70d87`), que `surveillance-prod.yml` tournait, et que le compte réel était 126. Deux autres docs le disaient déjà juste (`principes-tests.md`, `exploitation.md`) |

D'où la règle : **un item qu'on met en avant, qu'on cite ou qu'on déplace se
relit contre le code, et porte sa date de relecture.** Sinon il reste où il est,
sans surcouche.

## Dette — les cas que « soldé / découvert » ne couvre pas

La forme d'un item (chemin complet, priorité, raison) fait foi dans l'en-tête de
`docs/dette-technique.md`. Ce qui suit est ce que la transition d'état laisse
passer :

- **Les vues dérivées périment en silence.** « Ordre suggéré » et l'en-tête
  récapitulatif sont des **index** de P0/P1 : un solde s'y répercute, sinon il
  crée une contradiction au lieu d'en lever une. Constaté le 08-21 : « Ordre
  suggéré » ouvrait encore P0-1 et P0-8, tous deux soldés le même jour.
- **Un item barré ne garde rien d'ouvert.** Ce qu'un solde laisse de reste sort
  dans sa priorité, chiffré, **avant** qu'on barre. Constaté le 08-21 : deux
  tâches (concurrence du cron de suppression, **S** ; ramassage des propositions
  à zéro occurrence, **XS**) ne vivaient que dans le corps d'items barrés, dont
  l'une se donnait à elle-même l'instruction « à ranger en P2 », jamais
  exécutée.
- **P1 « détonation datée », « Pièges connus », « ✅ Accepté » ne se relisent
  jamais.** Leur déclencheur n'est pas une date mais un **événement** (une
  édition qui passe en `ouvert`, un premier passage sur la zone, une montée de
  version). Ces sections nomment donc leur déclencheur, pas seulement leur date
  de dernière vérification. Un item « accepté » a déjà pourri en silence, le doc
  l'enregistre lui-même (« runner de migrations manuel : PÉRIMÉ »).
- **Au fil du geste ET à la clôture, jamais l'un à la place de l'autre.** L'en-tête
  du doc dit « ce doc se tient en travaillant, pas en revue annuelle » : c'est la
  dette de la zone qu'on traverse. La clôture, elle, rattrape ce que la session a
  rendu faux **ailleurs** — les index, les en-têtes, les docs voisins.

## Roadmap — au-delà des sections de chantier

- **Une seule passation.** Aucun bloc « Reprise immédiate » / « Passation » ne
  s'ajoute à un autre : s'il y en a deux, l'un est faux. La forme qui tient est
  **un titre par chantier, portant son état et sa date** (« état au … », « plan
  LIVRÉ en entier »), et **un seul** bloc d'état en tête, réécrit — jamais
  complété par un bloc au-dessus.
- **La date vit dans les titres de section.** Une date globale en tête de fichier
  redevient fausse sans que personne la voie (elle a dit 08-15 pendant que deux
  sections disaient 08-16 et 08-18). Corollaire : **une section sans date se lit
  comme non vérifiée**.
- **Le cliquet de sortie.** Ce qui est tranché quitte « En réflexion / à
  décider » le jour où on le tranche — vers « Fait (en prod) » si c'est livré,
  vers un chantier daté sinon. Une section reste sous « à décider » **tant qu'il
  reste quelque chose à décider**, pas parce que c'est là qu'elle est née.
  Mesuré le 08-21 : une décision tranchée *et livrée* (le 07-25) y dormait
  encore, à côté d'une spec complète qui n'attendait plus qu'une implémentation.
- **Le livré s'écrit à UN endroit** : rayé à sa place avec sa date et son
  numéro de PR ; ce qui mérite de rester lisible pour la suite monte dans
  « Fait (en prod) », **une seule fois**. Jamais les deux — le doublon existe
  déjà (l'upload de photo de profil y est décrit deux fois, en deux
  formulations).
- **Le backlog n'a pas à être tenu à jour**, mais chaque entrée porte **la date
  où on l'a écrite** : sans elle, la suivante ne peut pas savoir si le constat
  vaut encore.

## Ce que la session a appris sur ses tests

Une garde cassée qui est restée verte, un test qui mentait : c'est une leçon,
pas une anecdote, et son lieu durable est le **registre de
`docs/principes-tests.md`** (avec sa date). Le corps de la PR ne se relit pas —
c'est tout l'argument de cette page. « Rien appris de neuf » est une réponse
valable : le registre ne se remplit pas au forfait.

## Deux sessions qui font le même ménage

Le cas est mécanique, pas théorique : la règle demande le geste **dans la PR de
la session**, donc plusieurs PR réécrivent les mêmes lignes du haut. **Quatre**
sessions ont travaillé ces docs le même jour sans se voir (#352, #353, #354,
#356) — dont deux qui ont écrit, séparément, la même correction de l'« Ordre
suggéré ».

**Avant de prendre un item**, trois réflexes que la journée du 08-21 a payés
trois fois (le P0-8 traité en parallèle par trois sessions, dont deux sur la
même branche : sept fichiers en conflit, deux variantes du même correctif, et
un merge qui a failli faire disparaître la moitié utile du travail) :

1. **une branche par session** — deux sessions sur une même branche se marchent
   dessus sans qu'aucune ne le voie ;
2. **marquer l'item PRIS dans la dette, et pousser ce marquage tout de suite** —
   celui du P0-7 est arrivé après que le travail avait commencé ailleurs, donc
   il n'a servi à rien ;
3. **au merge, vérifier ce que `main` contient VRAIMENT** sur les fichiers du
   lot, fichier par fichier : un merge textuellement propre peut avoir absorbé
   une variante concurrente, et un « 0 conflit » de git ne prouve rien sur le
   contenu.

**La résolution : `main` fait base, l'union fait foi.** On rebase sur la version
de `main` (plus récente, et souvent relue contre le code), puis on y remet
**item par item** ce que notre session a vérifié et qu'elle n'a pas. Aucun item
vérifié n'est perdu ; aucun récit n'est fusionné à la main. « La version la plus
récente fait foi » tout court jetterait le travail de l'autre ; « union » tout
court produirait deux narrations cousues.

## Le test d'acceptation

**Ce qui se mesure, et qui est désormais tenu par un test**
(`src/__tests__/docs-passation.test.ts`) : chaque doc de passation porte, dans
son en-tête, une date **au moins aussi fraîche** que la date la plus récente de
son corps. C'est la dérive la plus fréquente — on ajoute au corps, on oublie la
ligne du haut — et elle était rouge sur trois docs sur trois au moment d'écrire
la règle.

**Ce qu'aucun test ne verra**, et qui reste à la charge de la session :

- l'**empilement** : un addendum posé en haut, avec sa date, passe le test —
  c'était pourtant le défaut principal du 08-21 (trois couches à sommer à
  l'envers, puis une quatrième pendant que la PR attendait sa revue) ;
- une rature **manquante** : détecter l'absence d'un geste est hors de portée ;
- la **véracité** d'un « relu contre le code » ;
- la contradiction **horizontale**, entre deux sections éloignées. Elle se
  cherche à la main : `grep` le nom de ce qu'on vient de livrer dans les deux
  docs — la même chose écrite à deux endroits en est le signe. Précédent :
  « re-sync automatique des futurs talks, toutes les briques livrées » d'un côté,
  « accès automatisés bloqués (403), donc pas d'import automatique » de l'autre,
  dans le même fichier.
