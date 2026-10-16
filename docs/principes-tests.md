# Principes de tests — et registre des erreurs à ne pas refaire

> Doc **transversal et durable**, à lire **avant** d'écrire un test, et surtout
> avant de déclarer une protection en place. Il généralise les leçons de l'audit
> E2E d'août 2026 (`docs/audit-e2e-parcours-2026-08.md`), qui a trouvé une suite
> de 3 227 tests verts **et** une porte d'autorisation ouverte derrière.
>
> Pendant côté conception d'écran : `docs/principes-conception-ui.md`.
>
> Dernière mise à jour : **2026-10-15** (registre : trois entrées du 10-15, assertion bornée à sa région, « use server » et `File` reconstruit ; trois entrées du 10-14, cinq
> du 08-21 ; §9, les tests hérités, 08-18). Ce doc est un **doc de passation** : son en-tête est
> tenu au moins aussi frais que son corps, et un test le garde
> (`src/__tests__/docs-passation.test.ts`).

## Règle d'or (à valider AVANT d'ouvrir une PR)

**Un test se juge en le cassant, jamais en le lisant.**

Pour chaque protection écrite, faire tomber exprès ce qu'elle garde, une fois,
et vérifier qu'elle passe au rouge. Puis remettre. Si elle reste verte, elle ne
protège rien — et elle est **pire qu'absente**, parce qu'elle achète une
confiance que personne ne re-vérifiera.

C'est la seconde moitié du TDD du dépôt. La première (« le test avant le code »)
garantit qu'un test **existe**. Seule la seconde garantit qu'il **sert**. Elle
vaut pour les tests **hérités** autant que pour les neufs — voir §9.

> Erreur fondatrice (2026-08-08) : `e2e/auth.spec.ts` gardait les accès à
> `/admin` et `/mon-espace`. Trois tests, verts, câblés en CI, et
> `docs/dette-technique.md` classait le sujet « RÉSOLU ». Mesuré : la CI E2E ne
> posait pas d'`AUTH_SECRET`, donc aucune session n'était déchiffrable, donc le
> proxy redirigeait **quelle que soit** la logique d'autorisation. En
> neutralisant les DEUX gardes, les trois tests sont restés verts. La porte
> avait cessé d'être gardée sans que rien ne le signale.

---

## Les principes

### 1. Le nombre de tests ne mesure rien

3 227 tests verts, 93 actions sur 107 munies d'un test dédié (mesuré le
2026-08-08) : deux chiffres rassurants, et une porte ouverte derrière. Ni le compte, ni le pourcentage, ni
la couleur verte ne disent ce qui est réellement protégé.

**Ce qui se mesure** : une liste de parcours, et pour chacun « gardé » ou
« pas gardé ». Rien d'autre ne se présente comme une preuve.

### 2. Tester les pièces ≠ tester le montage

Deux questions distinctes, deux réponses nécessaires :

| Niveau | Question | Outil |
|---|---|---|
| La pièce | « cette serrure fonctionne-t-elle ? » | Vitest (unité, composant, intégration base) |
| Le montage | « la serrure est-elle posée sur la porte ? » | Playwright (parcours réel) |

Un test de pièce isole en remplaçant la base et l'authentification par des faux.
C'est la bonne méthode, et elle a un angle mort **par construction** : elle ne
voit jamais le câblage.

> Erreur (2026-08-09) : le callback d'autorisation était juste, testé, et sa
> réponse **jetée** par le proxy — Auth.js n'honore son verdict que si le proxy
> ne fournit pas son propre gestionnaire. La pièce était bonne ; elle n'était
> branchée à rien. Aucun test unitaire ne pouvait le voir.

> Erreur (2026-08-15) : **un test de composant qui se fournit lui-même l'entrée
> que la page réelle renseigne ne prouve rien du câblage.**
> `talk-form-ui.test.tsx` vérifiait que le renvoi « demande son ajout » pointait
> `/conferences/proposer` — en passant lui-même `proposeHref="/conferences/proposer"`
> au composant. Le test ne pouvait qu'être vert : il affirmait sa propre entrée.
> Les deux pages réelles passaient `"/mon-espace/talks"`, et `/conferences/proposer`
> n'a **jamais existé**. Une speakeuse (Aurélie Vache) l'a signalé depuis la prod.
>
> La forme générale : quand un test fixe la valeur d'un `prop`, il teste ce que
> le composant FAIT de cette valeur, jamais que la valeur soit la bonne. Le
> choix du `prop` appartient à la page — donc au parcours. Deux parades, à
> prendre ensemble : jouer le parcours (`e2e/parcours-talks.spec.ts`), ou
> supprimer le `prop` quand rien ne justifie que la page décide (ce qui a été
> fait ici : plus de `proposeHref`, plus de valeur à se tromper).

### 3. Le silence ressemble au succès

Un test ignoré, une passe qui n'évalue rien, une erreur avalée par un `catch`
muet : tout cela est **indiscernable** de « tout va bien ». Une protection doit
pouvoir crier.

Formes concrètes déjà en place :
- `a11y.spec.ts` exige d'avoir évalué plus de 50 règles avant de croire son
  verdict ;
- `e2e/decor.ts` s'ignore en local sans base, mais **échoue bruyamment en CI**,
  où l'absence de décor est une panne et non une excuse ;
- `auth.spec.ts` sonde d'abord qu'une session est réellement déchiffrable, avant
  d'affirmer quoi que ce soit sur les rôles.

> Erreur (2026-08-09) : le `catch` de l'annuaire était vide. Une base injoignable
> et un annuaire réellement vide rendaient le même écran, donc la même phrase —
> « L'annuaire arrive bientôt » — vraie sur un site neuf, fausse en panne. Le
> dépôt s'était déjà brûlé au même endroit (2026-07-23 : annuaire vide servi
> alors que 5 fiches étaient publiées).

### 4. Empêcher vaut mieux que tester

Le meilleur test est celui qu'on n'a pas besoin d'écrire. Quand la structure du
code rend une faute **impossible**, il n'y a plus rien à surveiller.

- Une écriture bornée **dans la requête SQL** (`auteur_user_id = uid`) vaut mieux
  qu'un `if` en tête d'action : un `if` s'oublie dans une branche, une clause
  `WHERE` non.
- Une donnée absente du DTO ne peut pas fuiter : `SpeakerProfile` ne **porte
  pas** l'adresse e-mail, ce qui rend la fuite impossible plutôt que testée.

Avant d'écrire un test de garde-fou, demander : **peut-on rendre la faute
impossible ?** Si oui, le faire, et ne pas écrire le test.

### 5. Couvrir par risque, pas par complétude

Une liste de trous appelle à cocher. C'est le mauvais réflexe : une exigence
qu'on n'arrive pas à tenir finit désactivée, et beaucoup de protections
abandonnées valent moins que peu de protections tenues.

Ordre de priorité, du plus au moins urgent :

1. ce qui expose une **donnée personnelle** ;
2. ce qui laisse entrer **la mauvaise personne** ;
3. ce qui est **irréversible** (suppression, envoi d'e-mail) ;
4. le **parcours central** du produit ;
5. le reste.

> Erreur évitée (2026-08-09) : 14 actions sans test dédié faisaient une belle
> liste. Vérification faite, **zéro** méritait un test — les écritures étaient
> déjà bornées en SQL, et le reste relevait d'outillage interne réversible.

### 6. Écrire la raison à côté de la règle

Une règle sans sa raison se fait défaire par la personne suivante, de bonne foi.

> Erreur (2026-08-09) : `/speakeuses/[id]` et `/articles/[slug]` laissent remonter
> une panne base en **500**, et c'est juste — un 404 affirmerait « ceci n'existe
> pas » et inviterait les moteurs à désindexer une fiche réelle. Personne ne
> l'avait écrit, et personne ne l'avait choisi : le 500 restait faute d'avoir été
> intercepté. Le risque n'était pas le comportement, c'était qu'on
> « harmonise » un jour en recopiant le `catch` de la page d'à côté.

### 7. Ne jamais croire une mesure sans la vérifier

Une même question, trois affinages, trois images différentes le même soir :
« 102 actions couvertes » → 93 avec un test **dédié** → dont plusieurs seulement
**simulées** dans un test d'écran, donc pas couvertes du tout.

Une citation n'est pas une couverture. Un fichier nommé d'après une action ne la
teste pas forcément. Vérifier ce qu'on affirme, y compris quand c'est soi qui
l'affirme.

> Erreur évitée (2026-08-10) : un test allait affirmer « la coach sans mission
> reçoit un 404 ». Mesuré : `/mon-espace/coaching/<id>` répond **200** alors que
> la page appelle bien `notFound()` — les en-têtes partent avec la coquille de
> `mon-espace/loading.tsx`, avant que le rendu ne décide. La garde tenait ;
> l'instrument, lui, mesurait le streaming. **Dès qu'une page est streamée
> derrière un `loading.tsx`, son code HTTP ne dit plus ce qu'elle affiche** : on
> juge sur l'écran (« Page introuvable »), qui est ce que la personne obtient.

> Erreur évitée (2026-08-10, second temps) : deux assertions ISR se croyaient des
> gardes. **(a)** « le classement au podium revalide la page publique » : mutation
> faite, le test restait **vert** — l'écriture voisine (la récompense) revalide la
> même route et rafraîchissait tout. Ce qui est gardé est « au moins une de ces
> écritures ramène la page à jour », pas chaque maillon. **(b)** « elle n'est pas
> encore nommée sur `/partenaires` » : la page est **prérendue au build**, donc
> elle ne POUVAIT pas nommer quelqu'un créé après — l'absence était vraie sans
> rien garder. Deux règles qui en sortent : **une garde par revalidation ne se
> juge qu'avec un cache CHAUD** (visiter la page AVANT l'écriture), et **une
> assertion d'absence sur une page en cache ne prouve rien** tant qu'on n'a pas vu
> ce cache se rafraîchir. Les deux limites sont désormais écrites à côté des
> assertions, pour qu'on ne leur prête pas mieux.

### 8. Un décor de données figé, jamais partagé pour les écritures

Les tests qui **lisent** partagent le décor (`db/seed-preview.sql`, appliqué par
`npm run e2e:db`). Les tests qui **écrivent** créent leur propre compte, jetable,
effacé après.

Sans cette séparation, un test qui publie une fiche fait tomber celui qui
vérifiait qu'elle était en attente : la suite devient dépendante de l'ordre
d'exécution — le pire des états, parce qu'elle rougit sans qu'on ait rien cassé.

Et un seul décor, pas deux : deux jeux de données dérivent l'un de l'autre,
comme les trois copies de `PAGES_PUBLIQUES` avaient divergé.

« Figé » vaut pour son CONTENU, pas pour le calendrier : ce qui doit rester à
venir (ou passé d'un nombre de jours donné) s'écrit relatif au jour
(`CURRENT_DATE + n`). Une date littérale future bascule seule et rougit la
suite sans qu'on ait rien cassé — c'est arrivé le 2026-10-14 (registre).
`src/__tests__/seed-preview-dates.test.ts` le rend impossible.

### 9. Un test hérité n'est pas acquis

La règle d'or ne concerne pas que les tests qu'on écrit : elle concerne tous ceux
qui gardent le code qu'on touche. Un test vert **écrit avant, sur une version
antérieure de la fonction**, n'a pas été mis à l'épreuve depuis — et il n'est pas
au loin : il est souvent dans le fichier qu'on est en train d'éditer. Le
2026-08-17 en donne la forme exacte, et elle est plus retorse qu'un simple oubli :
le commit fautif a bien mis à jour l'assertion d'`addOccurrence` (un `toEqual`,
les deux nouvelles colonnes insérées au bon rang) et a laissé intacte, 25 lignes
plus bas dans le même fichier, celle d'`updateOccurrence` — un
`expect(params).toContain("DevFest")`. **La forte a été soignée, la faible est
passée inaperçue**, et c'est la faible qui gardait la fonction cassée : deux
paramètres SQL manquants, la modification d'une conférence impossible en
production, un test vert par-dessus.

**Le périmètre se lit sur le diff, pas sur la fonction.** La mutation à faire est
**l'annulation de son propre changement** : on revient à l'état d'avant (ou on
écrit la valeur fausse que le changement rendait possible), on rejoue les tests
concernés, on regarde ce qui tombe. Ce qui reste vert ne gardait pas ce
changement. Un renommage sans changement de comportement ne déclenche donc rien,
et une fonction traversée par quarante tests ne demande pas quarante lectures :
on les exécute contre la mutation, la liste sort d'elle-même.

**La mutation n'est pas libre** : c'est celle du changement qu'on vient de faire,
sinon on confirme ce que le test sait déjà voir. Le 08-17 le montre — retirer
`"DevFest"` faisait bien tomber `expect(params).toContain("DevFest")`, mais
décaler les paramètres d'un cran, le vrai défaut, le laissait vert.

Ça coûte une minute sur un test unitaire, un cycle de build sur un E2E
(`npm run build`, puis la seule spec visée). Sur un E2E, en faire **une seule**,
choisie : celle qui garde le rang le plus haut de §5.

**Trois issues, et une interdite.** Un test hérité qui ne tombe pas alors qu'on a
cassé ce qu'il garde cesse de mentir **dans la PR en cours** :

1. on le **répare** ;
2. on **rend la faute impossible**, et la garde structurelle le remplace (§4) —
   c'est ce que le 08-17 a livré : autant de valeurs que de `$n`, vérifié par un
   helper partagé, plus le parcours en vrai navigateur ;
3. si la réparation demande un chantier que cette PR ne porte pas — brancher un
   secret en CI, monter un décor —, il passe en **`skip` explicite avec sa
   raison**, et le chantier part en dette en P0. Un `skip` dit la vérité, un vert
   ment. Précédent : réparer `auth.spec.ts` (2026-08-08) a demandé `AUTH_SECRET`
   en CI, `e2e/session.ts` et un service Postgres — ça ne tenait dans aucune PR
   de fonctionnalité.

L'issue interdite est la quatrième : le laisser vert en notant la dette pour plus
tard. §1 rappelle que son seul effet est d'ajouter 1 au compteur.

Et si la mutation ne fait tomber **personne**, le test n'est pas faux : il est
**absent**. On l'écrit, classé par le rang de §5 — ou, quand le rang est bas, on
écrit dans la PR qu'on a mesuré et choisi de ne pas couvrir.

§9 étend le champ de la règle d'or ; le précédent qui a imposé la règle d'or
elle-même — trois tests verts sur une garde supprimée, 2026-08-08 — est en tête
de ce doc, et aucun mécanisme de §9 ne l'aurait attrapé : personne n'avait
modifié cette garde.

---

## Les étages au-delà des tests

Un test tourne sur du code, dans un environnement de test, avec des données de
test. Trois familles de pannes lui échappent **par construction** — d'où trois
étages qui ne le remplacent pas :

| Étage | Répond à | Où |
|---|---|---|
| Contrôle après déploiement | « ce qu'on vient de mettre en ligne fonctionne-t-il ? » | `scripts/verifier-prod.mjs`, joué par le job production |
| Surveillance continue | « le site répond-il encore, maintenant ? » | `.github/workflows/surveillance-prod.yml`, toutes les 30 min |
| Journal des erreurs | « qu'est-ce qui casse chez de vraies personnes ? » | `src/lib/journal-erreurs.ts`, via `onRequestError` |

**Le contrôle après déploiement se juge sur le CONTENU, pas sur les codes de
réponse.** Mesuré base coupée : l'annuaire répond 200, l'index de recherche
renvoie « 0 fiche » sans erreur, et neuf contrôles sur dix restent verts. Un
contrôle naïf serait resté vert pendant tout l'incident du 2026-07-23. Même
piège côté authentification : `/admin` redirige vers `/connexion` **même sans
`AUTH_SECRET`** — c'est ce qui rendait l'ancien test d'accès incapable
d'échouer. Le témoin fiable est `/api/auth/session` (200 contre 500).

**Le journal des erreurs est le complément exact des tests** : ceux-ci attrapent
ce que quelqu'un a pensé à écrire, lui attrape le reste. C'est aussi un endroit
où les données personnelles fuient sans qu'on l'ait voulu — on n'y met jamais
les en-têtes (donc les cookies de session) ni la chaîne de requête (donc ce que
la personne a saisi). Verrouillé par `journal-erreurs.test.ts`.

**Ce qui manque encore, et ce qu'on a écarté :**

- **Une alerte sur les erreurs réelles.** Le journal est structuré et prêt ; il
  reste à brancher un outil (Sentry ou autre) pour être *prévenu* au lieu de
  devoir aller lire. Demande un compte tiers, donc une décision humaine.
- **La régression visuelle** : rien ne voit un bouton mal placé ou une mise en
  page cassée qui ne déborde pas.
- **Le déploiement progressif (canari) : écarté, et à raison.** Il envoie une
  fraction du trafic sur la nouvelle version et compare les taux d'erreur — ce
  qui suppose assez de trafic pour que cette fraction parle vite. À notre
  volume, elle mettrait des heures à produire un signal. Le couple « contrôle
  après déploiement + retour arrière immédiat Vercel » donne l'essentiel du
  bénéfice sans la complexité. À reconsidérer le jour où un retour arrière
  coûtera cher.

## Ce que les tests ne sauront pas faire

À connaître pour ne pas se croire à l'abri :

- **Le visuel.** Un bouton mal placé, un contraste laid mais conforme, une mise
  en page cassée qui ne déborde pas : rien ne sonnera. Ça se regarde.
- **« On a construit la mauvaise chose. »** Un test vérifie que le code fait ce
  qu'on a dit, jamais qu'on a dit la bonne chose.
- **La charge.** `concurrence.spec.ts` garde l'absence de casse sous accès
  simultanés ; il ne mesure ni le débit ni la latence sous charge réelle.
- **Ce que personne n'a pensé à écrire.** Une fonctionnalité livrée sans son test
  est invisible aux 3 000 autres : ils ne la connaissent pas.

---

## Checklist avant PR

- [ ] Chaque nouvelle promesse a son test, écrit **avant** le code.
- [ ] Chaque garde-fou a été **cassé une fois**, et le test est tombé.
- [ ] Ce qui pouvait être rendu **impossible** l'a été, plutôt que testé.
- [ ] Aucun test ne peut passer au vert en n'évaluant rien (sonde, seuil, ou
      échec explicite si le contexte manque).
- [ ] Les tests d'écriture travaillent sur leurs propres données.
- [ ] Les tests qui gardaient déjà le code touché ont été cassés une fois, eux
      aussi (§9).
- [ ] La raison d'un comportement contre-intuitif est écrite à côté de lui.

---

## Registre des erreurs observées (à ne pas refaire)

| Erreur | Ce qu'elle a coûté | La règle qu'elle impose |
|---|---|---|
| Test d'accès vert sur une garde supprimée (2026-08-08) | Une entrée « RÉSOLU » fausse dans la dette, et le filtrage par rôle absent au bord pendant des mois — sans exposition, chacune des 60 pages portant sa garde serveur, mais à une seule couche au lieu des deux écrites | Casser pour juger (règle d'or) |
| Callback d'autorisation testé mais débranché (2026-08-09) | Protection à une seule couche là où deux étaient écrites | §2 — tester le montage |
| `catch` muet sur l'annuaire (2026-08-09, déjà vu le 2026-07-23) | Une panne servie comme un site neuf, sur une page cœur de visibilité | §3 — le silence ressemble au succès |
| Nettoyage React en `beforeEach` (2026-08-09) | Vitest annonçait « 3 237 passed » **et** sortait en code 1 : CI rouge sans test rouge | §3 — un état anormal doit se voir, pas se cacher derrière un compte vert |
| « 102 actions couvertes » (2026-08-09) | Une couverture surestimée de 15 %, corrigée en deux affinages | §7 — vérifier la mesure |
| Fixture satisfaisant la soumission mais pas la complétude (2026-08-09) | Un test rouge qui ressemblait à une régression d'interface | §6 — écrire la raison dans la fixture |
| Code HTTP jugé sur une page streamée (2026-08-10) | Une assertion qui mesurait `loading.tsx`, pas la garde qu'elle croyait tenir | §7 — vérifier ce que l'instrument mesure vraiment |
| Retrait de consentement laissé cinq minutes en ligne (2026-08-10) | `/partenaires` (statique, `revalidate = 300`) cite les accompagnantes et n'était revalidée par AUCUNE action : un accord retiré y restait affiché | §2 — la pièce était juste, elle n'était branchée qu'à une des deux surfaces |
| Garde par ISR jugée sur un cache FROID (2026-08-10) | Deux assertions vertes qui ne gardaient rien : l'une masquée par l'écriture voisine, l'autre vraie parce que la page était prérendue | §3 — le silence ressemble au succès ; visiter la page AVANT l'écriture |
| Message de succès attendu à l'écran (2026-08-10) | Un test instable une fois sur dix (l'action rafraîchit et efface le message), que `retries: 2` aurait masqué | §7 — juger sur l'état durable, pas sur ce qui passe |
| Arrivée sur une page jugée sur l'ORDRE du DOM (2026-08-16) | « Mon agenda » s'ouvrait 104 px trop bas : la bande de mois du passé restait le seul titre en haut d'écran et se lisait comme la date du jour. `mon-agenda-page.test.tsx` vérifiait la seule chose que jsdom sache voir — le passé au-dessus du repère — et il est resté vert tout du long | §2 — un point d'arrivée est le produit de deux règles CSS et d'un `scrollIntoView` post-hydratation : il se MESURE en pixels dans un vrai navigateur, contre une référence de la page (le bas des barres collantes), jamais contre une constante recopiée. Et on écrit l'assertion sur ce que la personne LIT (« la bande collée en haut est celle du mois courant »), pas sur le réglage qui l'obtient |
| Requête jugée sur ce qu'elle CONTIENT, pool simulé (2026-08-17) | `updateOccurrence` annonçait quinze paramètres SQL et n'en passait que treize (deux colonnes oubliées à la migration 072, tout le reste décalé d'un cran). Postgres refusait la requête au bind : modifier une conférence de son talk était impossible en production. `expect(params).toContain("DevFest")` restait vert — un décalage n'est pas une absence — et AUCUN parcours E2E ne modifiait une occurrence, seulement des créations | §2 — un mock ne bind rien. On vérifie la FORME de l'appel (autant de valeurs que de `$n`, le tableau entier dans l'ordre), et le geste de modification a son parcours en vrai navigateur, contre une vraie base. Et **§9** : le commit a soigné l'assertion `toEqual` d'`addOccurrence` et laissé sa jumelle faible 25 lignes plus bas, dans le fichier qu'il éditait |
| Renvoi vérifié contre un `prop` fourni par le test (2026-08-15) | Un lien mort vers une page inexistante, signalé depuis la prod par une speakeuse, et la saisie perdue au passage | §2 — un test qui affirme sa propre entrée ne teste pas le montage |
| Parcours E2E écrit sur un décor qui ne contient pas le cas jugé (2026-08-21) | Le premier parcours « Déjà en scène » est resté **VERT avec le défaut remis**. Il vérifiait « la phrase annonce des cartes, et il y a des cartes » — vrai dans les deux mondes : les quinze dates passées **exactes** du décor remplissaient l'aperçu, et la seule date au mois près y avait été posée sur une vieille année, donc trop ancienne pour entrer dans les trois cartes montrées. La garde ne voyait jamais la pièce qu'elle jugeait | §7 — un décor n'est pas un figurant : la pièce qui DISCRIMINE doit être là **et** à un endroit où l'écran la montre. On l'obtient en cassant, jamais en relisant. Corollaire appris dans le même geste : déplacer cette pièce a un rayon d'action (calée sur « le mois dernier », elle ouvrait une porte d'archive pour l'année en cours et faisait diverger la garde « mémoire complète ») — un décor se change en re-jouant TOUT le fichier, pas le seul test qu'on écrit |
| Lecture EMPRUNTÉE à une autre surface, gardée par le test de cette autre surface (2026-08-18) | `/agenda` peuplait son aperçu du passé avec `getScenesRecentes`, écrite pour le fil connecté — sa doc disait « seul consommateur prévu » et « deux conditions **propres au fil** », dont l'exigence d'une date exacte. L'agenda, lui, COMPTE les dates imprécises dans son archive et les AFFICHE sur `/agenda/[annee]`. Résultat en prod : « 2 interventions depuis 2025. Voici la plus récente. » au-dessus de RIEN. Toute la suite était verte : le test d'intégration gardait la règle du fil (il disait vrai, pour le fil), et aucun test d'écran ne confrontait la phrase à ce qui était rendu | §9 — une fonction empruntée emporte les règles de sa surface d'origine, et sa doc les disait : c'est en lisant la ZONE qu'on le voit. Et quand deux affichages doivent s'accorder, on les fait lire la MÊME valeur — l'accord devient impossible à rompre au lieu d'être testé |
| Garde jugée ABSENTE sur la foi d'un doc, pas du code (2026-08-21) | Une factorisation sûre a été refusée et versée à la dette au motif que la garde « mémoire complète » n'existait pas. Elle existait depuis le lot 2 (`e2e/agenda.spec.ts`), et c'est la liste « gardes à écrire » de l'audit qui n'avait pas été rayée. Trois jours de retard d'un doc ont donc fait renoncer à un geste juste, et écrit noir sur blanc une justification fausse | §7 — l'inventaire de ce qui protège se lit **contre le code**, jamais contre nos propres notes. Un doc de suivi qu'on ne raye pas ne vieillit pas seulement : il **bloque**. Avant d'invoquer l'absence d'une garde pour refuser un changement, on la cherche là où elle vivrait |
| Serveur FUITÉ : la mutation jugée contre l'ancien build (2026-08-21) | `playwright.config.ts` pose `reuseExistingServer: !process.env.CI` : en local, Playwright **réutilise** ce qu'il trouve sur le port 3000. Un `npm run start` lancé à la main puis « tué » par son wrapper laisse le `next-server` vivant — et toutes les exécutions suivantes ont donc joué contre le build d'AVANT la mutation. Le flux muté rendait 5 évènements (exactement l'horizon) là où il aurait dû en rendre 20 : c'est ce chiffre trop juste qui a mis la puce à l'oreille, pas le vert. Refait en tuant `next-server` avant chaque exécution : la garde tombe (2 failed) | §7 — vérifier ce que l'instrument mesure. Un `kill` sur le wrapper npm ne tue pas `next-server`, et un serveur fuité est INVISIBLE : les tests passent, simplement ils parlent d'un autre code. Un cycle de mutation local ne démarre jamais son propre serveur — il laisse Playwright le faire — et libère le port avant de mesurer |
| Assertion rendue IMPOSSIBLE par le format qu'elle inspecte (2026-08-21) | Dans le même test, `not.toContain("Ce mois-là, sans jour précis")` ne pouvait jamais échouer : iCalendar échappe les virgules (`\,`), donc la chaîne cherchée n'existe nulle part dans un flux, fautif ou non. Le test mordait — par son AUTRE assertion — ce qui a masqué la ligne morte | §7 — une assertion « absence » se juge en la faisant échouer, elle aussi : dans un format échappé, on compare à la forme ÉCHAPPÉE. Un test qui tombe ne dit rien de ses lignes qui, elles, ne peuvent pas tomber |
| Mutation faite avec `git checkout` sur un fichier à corrections NON commitées (2026-08-21) | Le cycle « je casse, je mesure, je restaure » a été mené sur trois docs de passation pour juger `docs-passation.test.ts`. La restauration par `git checkout <fichier>` a rendu le fichier à HEAD — donc **effacé la correction que la session venait d'écrire et pas encore commitée** (l'en-tête recalé de ce doc). Le test est resté rouge après restauration, ce qui l'a révélé ; sans lui, la correction disparaissait en silence et la PR partait avec un doc non tenu | §7 — l'instrument de mutation a un effet de bord sur le travail en cours. On commite (ou on `stash`) AVANT de casser, et on relit `git status` après restauration : « restauré » veut dire « revenu à HEAD », pas « revenu à ce que j'avais » |
| Décor absent : 42 E2E **ignorés**, lus comme un cycle concluant (2026-08-21) | Un cycle de mutation monté à la main a démarré Postgres via `su`, qui repart avec son propre `PATH` : `initdb` introuvable, base absente, `exigerDecor` a donc fait SKIPPER les tests. La sortie disait « 2 skipped » sous la mutation et « 42 skipped » après restauration — de quoi conclure « la garde tombe puis repasse au vert » en ne lisant que la forme. Refait avec les chemins complets : la garde tombe pour de vrai (2 failed), puis 42 passed | §3 — le silence ressemble au succès, et « skipped » lui ressemble encore plus que « passed ». Un harnais de mutation local commence par un GARDE-FOU qui compte le décor et s'arrête s'il manque : sans lui, l'expérience mesure sa propre plomberie |
| Nom accessible jugé par un FRAGMENT (2026-10-14) | Les liens de téléchargement du kit de communication se lisaient « …fond sombrePNG · 500 × 500 px » et les boutons de couleur « …Violet nuit#170E47 » : deux `<span>` voisins, posés en colonne par `flex`, collent leur texte dans le nom accessible — l'écran les sépare, la synthèse vocale les fond en un mot. `toHaveAccessibleName(/PNG/)` est resté vert sur le nom fautif : un fragment se trouve AUSSI dans un mot collé. C'est le test de la couleur, écrit « nom puis code », qui a rougi | §7 — une assertion de nom accessible porte sur la JONCTION entre ses morceaux (« l'objet, une espace, le format »), pas sur la présence de chacun. Le remède est le `{" "}` explicite entre les deux éléments, comme pour les mots collés de `e2e/mots-colles.spec.ts` — qui ne voit pas ce cas : il ne regarde que le texte qui SUIT un élément en ligne |
| Bombe de date dans un décor (2026-10-14) | Le parcours « 4 tâches à faire » est tombé en CI (PR #365) sans qu'une ligne de code bouge : l'atelier « Répétition des pitchs » de l'édition EN COURS de `db/seed-preview.sql` était daté `DATE '2026-10-13'`. Le lendemain il était passé, une tâche « Pointer les présences » est apparue, 5 au lieu de 4. La section agenda du même fichier se savait exposée (« toutes RELATIVES à `now()` ») ; la section Tremplin, écrite avant, non | §8 — un décor qui distingue le futur du passé s'écrit relatif au jour (`CURRENT_DATE + n`) : une date littérale passée le reste, une future bascule seule. `seed-preview-dates.test.ts` refuse toute date littérale future du décor sauf marqueur `-- date fixe :` avec sa raison (mutation : une date en dur remise → rouge ; atelier passé en base → l'E2E retrouve exactement « 5 tâches ») |
| Deux courses de l'AUTOMATE prises pour de l'aléa (2026-10-14) | `e2e/parcours-talks.spec.ts` tombait 4 fois sur 32 en local parallèle, sans lien avec le code changé. Deux causes. (1) `locator("li").filter(…)` voyait DEUX rangées : pendant le streaming, Next garde une copie CACHÉE de la liste le temps de remplacer le repli de `loading.tsx`, et le mode strict refusait. (2) Choisir « DevFest Toulouse » pré-remplit la ville ; sous charge, le champ a valu « ToulouseToulouse » (hypothèse, à vérifier : ce rendu se croise avec `fill`). La CI, en série avec `retries: 2`, l'aurait masqué | §7 — vérifier ce que l'instrument voit. On cible par RÔLE (`getByRole`), qui ignore le caché, jamais par balise. Un champ qu'un autre geste pré-remplit se juge sur la valeur OBTENUE (`toHaveValue` dans un `toPass`), pas sur le seul `fill`. Mesure : 4/32 en échec avant, 120/120 après |
| Assertion E2E cherchée dans TOUTE la page (2026-10-15) | Le parcours « Une date » vérifiait `page.getByText("DevFest Toulouse").first()` après l'enregistrement : vert 3 fois sur 4, alors que la liste des talks gardait l'ancien état jusqu'au rechargement (la fenêtre se fermait PENDANT l'action et la revalidation se perdait). Le texte était trouvé ailleurs dans la page, par moments. Attrapé avant la PR, en répétant le test (`--repeat-each`) puis en lisant la section | §7 — une assertion se borne à la RÉGION qu'elle juge (`getByRole("region", { name: "Tes talks" })`), et un test instable se répète jusqu'à comprendre, jamais « vert au second essai » |
| Constante exportée d'un fichier "use server" (2026-10-15) | `LOT_INVITATIONS` passait type-check, lint et toute la suite Vitest (qui n'applique pas la transformation des server actions), et cassait `next build` : vue par deux revues, pas par un test | §2 — la pièce testée hors du montage ; `use-server-exports.test.ts` rend la faute visible là où elle s'écrit |
| Égalité profonde sur un `File` RECONSTRUIT (2026-10-15) | `toHaveBeenCalledWith(image)` sur deux routes d'upload : la route reçoit le fichier que `formData()` reconstruit, pas l'objet envoyé. Sous Node 22, l'égalité ne voyait que nom, type et taille (octets substitués à taille égale : VERT) ; sous Node 26, elle voit `lastModified`, horodaté à la reconstruction : rouge local permanent, que toutes les sessions du 10-14 et du 10-15 ont noté « sans rapport » | §7 — vérifier ce que l'instrument compare. Un objet qui traverse une frontière (multipart, JSON, `structuredClone`) se juge sur ce que la frontière TRANSPORTE (`contenuFichier` : nom, type, octets), jamais par égalité profonde avec l'original, dont le résultat dépend du moteur. Même jour, même leçon : le `localStorage` de Node ≥ 25 masquait celui de jsdom (Vitest n'écrase pas une clé déjà sur le global) |

## Acquis à conserver

- La porte RGAA en vrai navigateur (`a11y.spec.ts`), avec son seuil anti-silence.
- Les gardes d'accès jugées **au bord** (requêtes sans JavaScript, redirections
  non suivies) : sinon les gardes de page masquent la panne du proxy.
- Le décor de données en CI (`npm run e2e:db`) tiré du seed déjà maintenu.
- Les tests d'écriture sur comptes jetables — et, pour le pilotage du Tremplin,
  sur **éditions jetables** (`e2e/tremplin-jetable.ts`), avec leur propre
  `conf_slug` : deux tests parallèles ne peuvent alors pas se marcher dessus, ni
  polluer une adresse publique que d'autres specs regardent.
- Les invariantes de **consentement** vérifiées sur la page publiée, pas sur la
  colonne : nom retiré, photo dépubliée, cloisonnement entre les trois accords
  (galerie, phase, fiche coach). Et la revalidation ISR jugée en visitant la page
  AVANT et APRÈS — sans quoi un retrait RGPD resterait affiché cinq minutes.
- **La liste des surfaces qu'une écriture publie**, tenue à un seul endroit et
  avec sa raison (`PUBLIC_EDITION_ROUTE`, `PUBLIC_PARTENAIRES_ROUTE` dans
  `admin/tremplins/actions.ts`). Un consentement peut nourrir une page qui n'a
  rien à voir avec l'écran où on le coche : c'est ainsi que `/partenaires` était
  restée en dehors.
