# Principes de conception UI — et registre des erreurs à ne pas refaire

> Doc **transversal et durable**, à lire **avant** de concevoir une page, une
> refonte, ou un écran multi-rôles. Il généralise les leçons tirées de la
> plateforme Tremplin (2026-07) pour qu'on ne rejoue pas les mêmes erreurs.
>
> Pour l'application détaillée à la page d'édition orga :
> `docs/ux-admin-edition.md`. Revue a11y : `docs/revue-ux-rgaa.md`.
>
> Dernière mise à jour : **2026-08-16** (accessibilité cognitive : le public
> est nommé, et les règles de mots, de lisibilité, de listes et de choix
> deviennent opposables — cf. la checklist COGA plus bas).

## Règle d'or (à valider AVANT d'écrire le code d'une page)

**Une page = un rôle, un CTA principal maximum.**

Avant de coder ou d'ajouter quoi que ce soit à une page, répondre à voix haute :
« quel est LE rôle de cette page, et quelle est L'action principale ? ». Si la
réponse contient un « et » (consulter **et** éditer **et** supprimer **et**
ajouter…), la page fait trop : les actions secondaires partent **ailleurs**
(dialog déclenché par un bouton unique, ou page dédiée de l'item — cf. § 1
hub-and-spoke).

- Une page de **consultation / liste** (un registre, un annuaire, un hub) a pour
  rôle de **montrer et laisser choisir où aller** — pas d'héberger les
  formulaires d'édition/suppression de chaque item en ligne.
- Les gestes d'édition, de suppression, de création se font **dans le contexte
  de leur item** : sa page dédiée, ou un dialog ouvert par UN bouton.
- **Jamais** de formulaires empilés (a fortiori un par item de liste) sur une
  page dont le rôle premier est de consulter.

> Erreur à ne pas rejouer (2026-08-15) : `/mon-espace/connexions` (les moyens
> d'entrer dans son compte) portait aussi le choix de la PHOTO de profil, par un
> bouton « Utiliser cette photo » sur chaque provider. Deux rôles sur un écran,
> et surtout un geste posé loin de la chose qu'il change : la photo s'édite dans
> la fiche, où on la voit. Le libellé cachait en plus un aller-retour OAuth
> complet — on croyait changer un avatar, on partait chez Google. Correctif : la
> photo vit dans son champ (`ChampPhoto` : envoi d'un fichier OU reprise
> LinkedIn), la page des connexions garde une action par méthode. Leçon
> générale : **une action va là où vit la donnée qu'elle modifie**, jamais là où
> il restait de la place.

> Erreur à ne pas rejouer (2026-07-11) : `/admin/conferences` (consultation du
> registre) s'est retrouvée avec, **par carte de conférence**, un formulaire
> « corriger une édition » ET un formulaire « modifier + supprimer », en plus du
> formulaire « ajouter une conférence » en tête. Une page de consultation
> transformée en empilement de formulaires : violation directe de cette règle et
> du § 1. Correctif : l'édition/suppression d'une conférence vit dans un dialog
> (bouton unique) ou sur la page dédiée de la conférence, pas en ligne sur le
> registre.

## Le cap : inclusion et charge cognitive

Notre public inclut des personnes sur téléphone, dans des contextes variés, et
des personnes avec une **déficience intellectuelle légère, un TDAH ou un TSA**
(le public est nommé, pas laissé à « neuro-atypique » : la checklist COGA plus
bas dit ce que chacun de ces profils coûte). Deux critères priment sur « ça
marche » :

- **Charge cognitive minimale** : on choisit *où aller* avant de subir *toutes
  les actions possibles*. Loi de Hick (plus d'options coprésentes = décision
  plus lente), mémoire de travail limitée : ce qui est visible pèse, même si on
  ne s'en sert pas.
- **Inclusion réelle** : lecteur d'écran (peu de régions par page, titres
  navigables), moteur/mobile (pas de scroll interminable, cibles atteignables),
  wording sans jargon et nominatif.

## Les principes

### 1. Hub-and-spoke dès qu'une page empile plusieurs domaines

Une page d'administration qui gère N domaines (ateliers, participantes, photos…)
**ne les empile pas tous en mode édition**. Elle devient un **hub** :

- le hub ne porte que **l'état** : compteurs + ce qui **demande une action**
  (mis en évidence, ex. « 2 photos bloquées »), chaque domaine = **une ligne →
  sa page** ;
- les **formulaires de création vivent sur la page du domaine** (la spoke), pas
  sur le hub — on nomme la chose une fois qu'on est dans son contexte ;
- chaque item a **une page dédiée** (identité navigable, URL partageable,
  retour = bouton back du téléphone).

**Signal d'alerte** (à traiter, pas à ignorer) : une page qui dépasse ~4 écrans
mobile, ou qui coprésente plus de ~3-4 affordances de création, ou qui a besoin
d'un sommaire ancré *parce qu'*elle est trop longue.

### 2. Le hub répond à une surcharge — ne pas l'imposer aux écrans déjà légers

Les espaces coach et participante sont des vues courtes (2-3 sections). Y
ajouter une navigation en hub **rajoute des taps pour rien**. On mutualise le
**vocabulaire visuel** (lignes, fiches, listes de documents), **pas** la
structure de navigation. Le hub est une réponse ciblée à la surcharge, pas un
gabarit universel.

### 3. Mutualiser la présentation entre rôles par les capacités, pas par copie

Un même objet vu par plusieurs rôles (une fiche atelier vue par orga / coach /
participante ; un document) **est un seul composant de présentation**, piloté
par une prop de **capacités** (`{ peutEditerInfos, peutDeposer, voitDocsPrivés }`).

- **Un composant, N capacités** — jamais un composant recodé par rôle.
- La **donnée et l'autorisation restent côté serveur** : chaque page-rôle ne
  charge que son périmètre et ne sérialise que son DTO (l'orga voit tout, la
  participante ne reçoit que ses docs). Le composant partagé ne *décide* rien,
  il *affiche* ce qu'on lui passe.
- Bénéfice : un seul endroit à faire évoluer, un langage visuel cohérent d'un
  rôle à l'autre.

### 4. PRG (redirect) uniquement pour les formulaires de page entière

Le pattern Post-Redirect-Get est correct pour un formulaire qui occupe la page.
Sur une **micro-action** dans une liste (bascule, suppression), il **détruit le
contexte** : scroll remis en haut, dépliants refermés, feedback anonyme à
l'autre bout de la page. Ces actions passent par le **pattern résultat**
(`useActionState` + `router.refresh()`), avec **feedback inline et nominatif**
à côté du bouton.

### 5. Wording : nominatif, descriptif, sans état directionnel fragile

- Un message de confirmation **nomme** la personne / la chose concernée.
- Éviter les libellés **directionnels** qui peuvent contredire l'UI pendant un
  rafraîchissement (ex. un bouton qui affiche « est masquée » alors que le badge
  dit encore « visible » le temps du refresh → préférer un message **neutre**
  « Visibilité mise à jour »).
- Pas de jargon technique : on nomme les choses comme l'utilisatrice les
  reconnaît.
- **Toujours la forme positive.** Bannir les tournures négatives dans les
  libellés, CTA et messages : **« ne … plus … » et « ne … pas … » sont
  interdits**. On dit ce qui EST ou ce qu'on FAIT, jamais ce qui n'est pas :
  « Aucun talk pitché » (pas « n'a plus de talk »), une option « Aucun » ou un
  bouton « Retirer » (pas « ne plus le pitcher »), « Ce talk appartient à une
  autre participante » (pas « n'appartient pas à… »).

### 6. Ne jamais perdre la saisie, ni dupliquer des boutons indistincts

- Une erreur de validation **conserve** la saisie (ne jamais faire re-remplir un
  formulaire long).
- Une saisie doit se **relire en entier**, pendant qu'on la tape. Un champ d'une
  ligne fait défiler le texte hors du cadre dès ~40 caractères sur téléphone :
  pour toute valeur qui dépasse couramment cette longueur (titre de talk, bio),
  le champ se **dimensionne sur son contenu** (`ChampTexte multiligne`, ou une
  zone de texte avec un compteur vivant). La valeur reste une ligne de données :
  « Entrée » soumet, et le serveur aplatit un collage multi-lignes.
- **Jamais** de boutons visuellement identiques différenciés par le seul
  `aria-label` (25× « Supprimer » sur une page = échec de conception, pas
  d'accessibilité : chacun doit être dans le contexte de son item, sur sa page).

### 7. Normaliser les données au bord, pas dans chaque vue

Un format qui revient de la base autrement qu'attendu (ex. `TIME` Postgres relu
`"HH:MM:SS"` alors que le formulaire attend `HH:MM`) se **normalise une fois**,
au point de lecture (`mapRow`), pas dans chaque composant qui l'affiche. Sinon
le même bug se réintroduit à chaque nouvelle vue.

### 8. Contraste : paires de couleurs approuvées (RGAA / WCAG AA)

Notre palette (violets sombres + magenta/cyan) porte un vrai risque de contraste,
surtout le **magenta**. Seuils AA : **texte normal ≥ 4.5**, **grand texte
(≥ 24 px, ou ≥ 18,66 px gras) et composants d'UI ≥ 3.0**. Ratios calculés depuis
les tokens de `globals.css` (source unique), verrouillés par
`src/__tests__/contrast.test.ts` : toute dérive d'un token fait échouer la CI.

**Texte sûr en toute taille (≥ 4.5) sur les fonds sombres** `navy` (#170E47),
`navy-light` (#1F1757), `navy-lighter` (#2A2068) : `white`, `cream`, `gray-light`,
`silver`, `cyan`, `cyan-light`, `gold`, `orange`, **`magenta-light`**. (Ratios
les plus bas au voisinage de 4.9 à 5.5 sur `navy-lighter`, tout passe.)

**Boutons / badges pleins** : texte `navy` sur `cyan`, `gold`, `cream`, `white`,
`magenta`, `silver` : tous ≥ 4.5.

**Piège `magenta` (#E631FB)** : en tant que **texte**, il passe sur `navy` (5.21)
et `navy-light` (4.70) mais **échoue sur `navy-lighter` (4.12)**. Règle : le
magenta plein est réservé au **grand texte, aux bordures et aux aplats** (avec
texte `navy` dessus) ; **pour du corps de texte, utiliser `magenta-light`**, sûr
partout. Ne jamais poser du magenta en texte normal sur une carte
`navy-lighter`.

> Le contraste des couleurs n'est pas mesurable par axe sous jsdom (pas de
> rendu) : c'est `contrast.test.ts` (calcul WCAG sur les tokens) qui tient ce
> rôle. Le reste de l'a11y est couvert par `a11y-axe.test.tsx` + les tests
> d'attributs.

### 9. Lisibilité en extérieur : le « sombre renforcé »

Constat terrain (2026-07-12) : sur téléphone **en plein soleil avec lunettes de
soleil**, l'interface sombre est difficile à lire. Le ratio WCAG **n'est pas** en
cause (blanc 17:1, `gray-light` 7:1, au-delà de AAA) : c'est la **luminosité
absolue** d'un fond très foncé, noyée par l'éblouissement. Un thème clair serait
le vrai correctif mais il casse l'identité (piste **reportée**, cf.
`docs/roadmap.md`). On garde donc le sombre, **renforcé** :

- **Bannir les opacités de texte** (`/70`, `/80`) : elles font chuter le
  contraste (≈ 4.3:1 sur `navy-lighter`) et disparaissent au soleil. Le token
  `muted`/`gray-light` reste valable **plein** pour légendes et texte secondaire
  (conforme à `tokens.json`), jamais atténué. Pour un **texte important à lire au
  soleil**, préférer `white`/`cream` en gras (≥ 600).
- **Hiérarchie par la taille et la graisse**, jamais par un gris plus pâle.
- **Statut confirmé = pastille pleine + icône grasse** (SVG à trait épais dans un
  aplat), jamais un glyphe fin (un ✓ maigre est invisible dehors).
- **Contours des champs et contrôles (WCAG 1.4.11, non textuel ≥ 3:1)** : le
  contour actuel des champs admin (`border-navy-lighter` sur `bg-navy`, cf.
  `styles.ts`) = **1.26:1**, invisible, a fortiori au soleil. Tout contour de
  champ, toggle ou bouton fantôme doit atteindre **≥ 3:1** (viser ≥ 4.5:1, ex.
  un violet clair `#8A83C0`) contre son fond ET la page ; sinon donner un **fond
  distinct** au champ. `tokens.json` est aujourd'hui **muet sur les contours** :
  à y ajouter un token dédié.
- **Jamais l'information par la couleur seule** (WCAG 1.4.1) : un état « manquant »
  s'écrit en toutes lettres, pas seulement en orange.
- Rappel §8 : magenta plein réservé aux aplats/bordures/grands titres ; corps de
  texte en `magenta-light`.

> Source de marque **canonique** : `public/brand/tokens.json` (palette, typo,
> composants, voix), publiée sur `techspeakher.fr/brand/tokens.json` et
> référencée par `public/llms.txt`. Ces règles a11y la **complètent** (comment
> utiliser la palette de façon lisible/accessible) ; toute évolution de palette
> ou de token se décide **là-bas**, pas ici.

### 10bis. Un lien de prose passe par `LienTexte`, jamais par une classe retapée

Le reset Tailwind retire tout style de lien : un lien non stylé disparaît dans
un paragraphe. La forme canonique vit donc dans `src/components/LienTexte.tsx` :

- **destination interne** → le composant `LienTexte` ;
- **destination externe** → `SiteLink` (qui gère aussi `rel` et la mention
  « nouvelle fenêtre ») ;
- **cas qui ne peut pas prendre le composant** (rendu Markdown, `ExternalLink`
  posé à la main) → la classe `LIEN_TEXTE`.

Pourquoi c'est une règle et pas une préférence : cette classe a vécu dans
`src/lib/markdown.tsx` sans être exportée, et les pages l'ont retapée **82 fois
en 12 variantes**. Les écarts portaient sur le soulignement, la transition, et
surtout l'**anneau de focus**, redéclaré à la main à chaque fois — treize liens
des mentions légales n'en avaient aucun. Deux liens voisins pouvaient donc
réagir différemment au clavier, ce qu'aucun test de contraste ne voit.

`src/__tests__/lien-texte.test.ts` tient le cliquet : les fichiers qui portent
encore la classe à la main sont listés nommément, aucun nouveau ne peut
s'ajouter, et une entrée migrée doit sortir de la liste. Elle ne fait que
raccourcir.

### 10. Trois paliers de suppression, selon ce que le geste emporte

Le filet doit être proportionné à ce qui disparaît. Trois paliers, pas plus :
au-delà, on ne sait plus lequel appliquer et chaque écran réinvente le sien.

**Palier 1 — réversible.** L'état d'origine se rétablit **sans ressaisir de
donnée** : masquer une fiche, se mettre en retrait de l'annuaire, délier une
méthode de connexion, défaire une simple association (un coach sur un atelier,
une identification sur une photo — le lien se recrée d'un clic dans le dialogue
juste à côté).
→ Pas de modale, ou une modale simple quand le geste vit dans une liste et
qu'un clic de travers est facile. L'état est dit **en toutes lettres** et
l'action inverse est visible juste à côté. Verbe simple (« Retirer »,
« Masquer »), **jamais** « définitivement » : le mot est réservé aux paliers
suivants, sinon il ne veut plus rien dire.

> Le test qui départage : **que faut-il retaper pour revenir en arrière ?**
> Rien → palier 1. Retirer un juré efface la fiche qu'on avait saisie (nom,
> rôle) : il faut la refaire, donc palier 2.

**Palier 2 — définitif, périmètre borné.** Ça ne revient pas, mais ça n'emporte
qu'un objet et ce qui lui appartient en propre : un talk et ses conférences, une
occurrence, un document, un juré, le fichier d'une photo, une conférence du
référentiel, un contenu.
→ Modale `ConfirmSubmitButton` à **emphase inversée** : « Annuler » porte le
poids visuel et garde le focus d'ouverture, le geste destructif reste lisible
mais discret (orange, sans fond). Le **périmètre chiffré** est annoncé avant le
clic ET dans la modale (« ce talk et ses 2 conférences »). Libellé de
confirmation : « Supprimer définitivement » / « Retirer définitivement ».

**Palier 3 — définitif ET large.** La cascade touche les données d'autres
personnes SANS qu'on puisse les refaire, ou l'objet est public : supprimer un
compte, supprimer une édition Tremplin, retirer une participante (documents,
photos, journal de consentement). Le test : *si le geste part de travers, peut-on
reconstituer ce qui est parti ?* Des présences se repointent (un atelier reste
donc au palier 2) ; une promotion entière, non.
→ Palier 2 **plus** le type-to-confirm : on retape le nom exact de la chose
(`confirmText`), et **le serveur revérifie la saisie**. Un garde-fou qui ne vit
qu'au navigateur n'est pas un palier 3.

**Variante en liste : le geste armé vaut la modale.**
Quand le geste vit dans une **liste** et que la modale ferait perdre tout
l'intérêt du raccourci, le filet peut être porté par un **geste en deux temps**
plutôt que par une fenêtre : la rangée se **glisse vers la gauche**, ce qui
découvre une **poubelle nominative**, et c'est **elle** qui confirme
(`RangeeGlissante`). Ce qui rend l'échange acceptable, et qui est **non
négociable** :

- la commande est **hors d'atteinte** tant qu'on n'a pas glissé exprès : le clic
  réflexe tombe sur la rangée, qui **navigue** et ne détruit rien ;
- un geste **vertical reste un défilement** (`lib/glissement.ts`), sinon
  parcourir la liste au doigt armerait des poubelles au hasard ;
- la fonction **existe sans le doigt** : la poubelle est un vrai bouton, atteint
  par tabulation **après** sa rangée, et le focus ouvre le tiroir (WCAG 2.2
  « mouvements de glissement », 2.4.11 « focus non masqué ») ;
- la rangée **dit ce que l'objet porte** avant le geste, et la confirmation
  **redit ce qui est parti** (`confirmationRetraitAtelier`) : sans modale, c'est
  le seul compte rendu, il doit être nominatif et chiffré.

**Plafond : deux actions pour supprimer** (décision du 2026-08-01). Un geste
destructif se fait en **deux actions maximum**, quel que soit l'écran d'où il
part : glisser puis appuyer dans une liste, ouvrir la page de retrait puis
appuyer depuis une fiche. Une modale **par-dessus** un écran qui ne sert qu'à
supprimer serait la troisième : la page qui n'a que ce rôle **arme** déjà, son
bouton **confirme**.

> Erreur qui a mené là (2026-08-01) : supprimer un atelier créé en double
> demandait **liste → fiche → sommaire → page de retrait → modale**. Un geste
> courant enterré sous cinq écrans finit par ne plus être fait : la ligne reste
> dans l'agenda et la liste ment.

**Le type-to-confirm reste l'exception, pas le réflexe.** On ne fait retaper un
nom que si la cascade emporte le travail d'un groupe entier et qu'on ne peut pas
le refaire : **un compte**, une **édition Tremplin**, le **retrait d'une
participante**. Un **atelier** n'y est PAS : sa cascade se reconstitue (on
repointe des présences, on redépose un support), et le rite coûtait plus qu'il
ne protégeait — il a été retiré le 2026-08-01, écran ET serveur.

> **Un objet vide redescend d'un palier.** Le palier se lit sur l'effet : un
> brouillon d'édition sans participante, atelier, photo, juré, récompense ni
> document n'emporte rien en partant — c'est le cas fréquent (créé par erreur).
> Lui imposer une saisie serait du rite, pas un filet. La règle vaut des deux
> côtés : l'écran ne montre le champ que si l'objet porte quelque chose, et le
> serveur applique la même condition.

Le palier se lit sur **l'effet**, pas sur le rôle de qui agit : une orga qui
retire une participante est au palier 3, une membre qui supprime son talk est au
palier 2. Et le statut ne dégrade pas le palier — supprimer une édition non
publiée efface autant de données qu'une publiée, donc même palier.

## Accessibilité cognitive (COGA) — checklist avant PR

**Le public qu'on nomme.** « Neuro-atypique » est trop vague pour trancher un
écran. On conçoit pour que l'app soit utilisable par **une personne avec une
déficience intellectuelle légère, un TDAH ou un TSA** (demande explicite de
Cateline, 2026-08-16). Ces trois profils ne demandent pas la même chose, et
c'est ce qui rend la liste utile :

| Profil | Ce qui coûte | Ce qu'on en tire |
|---|---|---|
| **Déficience intellectuelle légère** | l'abstraction, le mot rare, le texte coupé | des mots courants et entiers |
| **TDAH** | ce qui presse, ce qui ne finit jamais, ce qui distrait | des listes qui se referment |
| **TSA** | l'implicite, la métaphore, ce qui bouge de place | du littéral, et de la stabilité |

L'automatique (axe, `contrast.test.ts`) **ne voit rien** de tout ça : ces règles
se vérifient à la main avant toute PR qui touche un écran (repères : W3C COGA
« Making Content Usable », WCAG 2.2).

### Les mots

- **Langage clair** : une idée par phrase, mots courants, pas de jargon.
- **Aucun mot tronqué dans un intitulé.** « asso », « orga », « co-orga » sont
  le vocabulaire de la maison : ils supposent qu'on est déjà dedans. On écrit
  « association », « organisatrices ». La règle vaut même quand l'écran n'est
  montré qu'aux personnes du rôle : une orga qui vient d'arriver, ou qui lit
  lentement, n'a aucune prise sur trois lettres.
- **Aucune métaphore dans une étiquette.** Elle se lit au premier degré.
  « Ta prochaine marche » demandait de se représenter un escalier — et
  « marche » est en plus ambigu en français (une marche, marcher, ça marche) :
  devenu « Ta prochaine étape ». Une métaphore morte et lexicalisée (« étape »,
  « fil ») reste permise ; une image vivante, non.
- **Un seul mot par concept, partout.** Le même endroit appelé « Tableau de
  bord orga », « Tableau de bord », « Espace orga » et « espace de
  modération » oblige à retenir quatre noms pour une chose. Un mot, une chose,
  de l'écran au code (renommer la lib avec le libellé, pas seulement le texte).
- **Le possessif doit être VRAI.** « Mon compte », « Ma participation », « Mon
  bénévolat » : ces choses sont bien à la personne. « Mon asso », « Mon
  tremplin », « Ma communauté » lui attribuent un collectif qui ne lui
  appartient pas — une association loi 1901 n'appartient pas à celles qui la
  font tourner.
- **Un seul patron par famille d'intitulés.** Trois grammaires sur un écran
  (« Ce que je publie » / « Faire tourner l'asso » / « Mon compte ») obligent à
  changer de mode de lecture à chaque titre. Les étiquettes de segment sont
  « Mon / Ma / Mes + un nom courant ».
- **On ne fabrique pas un mot pour avoir une étiquette.** Si aucun nom simple
  n'existe pour un groupe, c'est que le groupe n'a pas à être nommé.
- **Un intitulé ne cite jamais une implémentation qui va bouger.** « repérés
  sur Sessionize » devient faux le jour où une deuxième source arrive (Notist
  est déjà à la roadmap) ; « repérés sur tes profils CFP » demandait en plus de
  connaître un sigle. On nomme le FAIT, pas l'outil : « On a repéré un talk à
  ton nom ». Même règle pour une marque, un format ou un nom de table.

### Ce qui se lit

- **Une étiquette qui structure est le texte le plus lisible de l'écran, pas
  le moins** : casse du texte respectée (**jamais de capitales forcées** — on
  reconnaît la silhouette d'un mot avant d'en lire les lettres), **≥ 14 px**,
  graisse ≥ 600, couleur pleine. Pas d'interlettrage élargi.
- **On tronque une DONNÉE, jamais une DESTINATION.** Qui ne peut pas deviner
  la fin d'un intitulé ne peut pas choisir où aller.
- **Une étiquette est nettement plus proche de ce qu'elle introduit que de ce
  qui précède** (loi de proximité). Viser un rapport d'au moins **2 pour 1**,
  et vérifier à l'œil sur téléphone : une étiquette à mi-distance se lit comme
  la légende du groupe du dessus, et le regroupement dit alors le contraire de
  ce qu'on voulait. Corollaire : une étiquette ne colle jamais au bloc
  précédent, même quand c'est la première de la page. **Cet espacement
  appartient au composant** (`SegmentLabel`), jamais à l'appelant : la prop
  `className` a été retirée le 2026-08-16 parce que deux pages sur trois
  l'annulaient.
- **Un titre de page peut faire office d'étiquette pour le premier groupe.**
  Sous « Mon profil », les rangées « Ma fiche publique » et « Mes articles »
  n'ont besoin d'aucun nom : le titre les couvre. On n'ajoute une étiquette
  qu'à partir du moment où un groupe s'éloigne du sujet de la page.
- **Un groupe visuel n'est pas un repère de navigation.** Le plan d'une page se
  lit par ses TITRES ; une `<section>` nommée entre dans la liste des repères,
  celle qui sert à sauter. Six groupes = six repères sur un écran qui n'a qu'un
  sujet. Un groupe est un `<div>` ; sa liste porte son nom par
  `aria-labelledby`, ce qui la nomme sans encombrer les repères.
- **Un titre nomme l'endroit, rien d'autre.** L'état (« Privé »), le compteur,
  le badge vivent à CÔTÉ du `h1`, jamais dedans : dans le titre, ils entrent
  dans le nom accessible du repère de page.
- **`aria-current` : `page` seulement quand le lien mène à la page affichée.**
  Un onglet qui reste allumé par REPLI (il couvre une famille de routes, mais
  son lien mène ailleurs) prend `true` — « élément courant d'un ensemble ».
  L'onglet s'allume pareil ; c'est l'annonce qui redevient vraie.
- **Un sous-titre de rangée DÉCRIT, il n'ordonne pas.** Un sommaire dit ce
  qu'on trouve derrière (« Depuis un fichier ou ton profil LinkedIn ») ; les
  consignes vivent sur l'écran qui les demande.
- **Le pictogramme dit le même mot que l'étiquette.** Une cloche au-dessus de
  « À faire » donne deux concepts pour un emplacement. Et un SVG plutôt qu'un
  emoji, dont le dessin change d'un téléphone à l'autre.
- **Jamais l'info par la couleur seule** ; **cibles tactiles ≥ 44 px** ; le
  mouvement respecte `prefers-reduced-motion`.

### Les listes, les compteurs, les choix

- **Une liste doit pouvoir finir.** Un compteur qui ne retombe jamais à zéro
  devient un reproche permanent : culpabilité côté TDAH, règle qu'on ne peut
  pas refermer côté TSA. Donc aucune ligne qu'aucun geste ne résout, et un
  état d'arrivée dit en mots (« Rien en attente. Tout roule. »).

  **Corollaire, tranché le 2026-08-17** : ce qui s'allume ne signale que ce
  qu'un **geste de la personne qui le voit** peut refermer. Le critère n'est
  pas la date — une action à faire dans dix jours reste une chose à faire, elle
  compte. Le critère est **qui referme**.

  Une seule règle du moteur de tâches y échoue : une photo qu'une participante
  a choisi de garder hors de la galerie. Sa couverture vaut **son** réglage de
  visibilité ; l'orga n'a aucun geste à poser. La ligne reste dans la liste, où
  elle informe, sous une étiquette **« Pour information »** — et elle n'allume
  rien. Ce qui s'allume se compte partout de la même façon : le point de
  l'onglet, la rangée du tableau de bord et la méta de la page lisent **un seul
  prédicat**, sinon deux surfaces se contredisent sur la même liste.

  > **Ce qu'on s'est trompé en écrivant cette règle, le jour même.** Deux autres
  > lignes avaient été classées « rien à faire » : relier une inscription à un
  > compte, et *toutes* les photos bloquées. Faux dans les deux cas — l'écran
  > d'arrivée relie un compte existant **en un clic**, et la case « Accord
  > recueilli » d'une photo est un geste d'orga. Les tests tenaient très bien
  > l'erreur ; deux relectures autonomes l'ont défaite en ouvrant l'écran que
  > chaque ligne POINTE. **« Qui peut refermer » se lit sur l'écran d'arrivée,
  > jamais sur l'intuition qu'on a du domaine.** Et se tromper de ce côté est le
  > pire des deux : s'éteindre à tort apprend à ne plus regarder la barre.

  Corollaire du corollaire : **« ouvrir une édition au public » allume**, elle,
  bien qu'elle soit en dette (les dates d'ouverture la disent déjà, cf.
  `docs/dette-technique.md`). Une orga la referme d'un geste, le critère est
  rempli. Une tâche qui ne devrait pas exister se règle en **supprimant la
  tâche**, jamais en donnant un cas particulier à la règle du signal.
- **Un signal d'attente entre dans le nom accessible, jamais dans une pastille
  de couleur seule.** Sur la FORME du signal, la règle a changé le 2026-08-17,
  et il faut lire pourquoi avant de la rétablir.

  Elle disait : « un compteur dit un NOMBRE, jamais un point — *il se passe
  quelque chose* sans dire combien oblige à aller voir ». Elle visait les
  pastilles **décoratives**, celles qui remplacent une information par une
  alerte, et elle reste vraie là : un badge sur une carte, un état dans une
  liste, tout ce qui doit se lire sans naviguer.

  Elle ne vaut pas pour un signal **à un tap de son détail**, et un nombre s'y
  paie cher : il oblige à garder deux chemins d'accord (le compte affiché et la
  liste dérivée), donc un invariant à tenir, alors qu'un point ne peut se
  tromper que de deux façons — s'allumer pour rien, ou rester éteint à tort. Sur
  des volumes de une à cinq lignes, « 3 » et « il y a quelque chose »
  déclenchent la même décision : j'ouvre. Le nombre ne devient utile que
  lorsqu'il change le comportement, c'est-à-dire quand 2 et 20 ne se traitent
  pas pareil.

  **Donc** : un point suffit quand le détail est à un tap ET que le nombre ne
  change aucune décision. Il dit ce qu'il sait, en toutes lettres, dans le nom
  accessible (« À faire, quelque chose attend » — vrai à une tâche comme à
  vingt, là où un pluriel mentirait la moitié du temps) — jamais par la couleur
  seule.
  Dès qu'un volume rend l'arbitrage utile, on passe au nombre : le chemin
  « y a-t-il quelque chose ? » est un sous-ensemble de « combien ? », et
  l'ajouter ne défait rien.
- **Un filtre n'est jamais un péage.** La vue par défaut est **complète** et ne
  demande aucune décision ; les filtres raffinent, et disparaissent quand il
  n'y a qu'une famille. Un compteur compte toujours la vue complète, sinon il
  ment.
- **Un plafond d'affichage replie en annonçant son compte exact**, il ne masque
  jamais en silence.

### Les gestes et la mémoire

- **Un seul CTA, toujours visible** : jamais sous la flottaison (barre collante
  en bas sur mobile) ; il ne doit pas masquer le champ en cours (WCAG 2.2 —
  2.4.11 « focus non masqué »).
- **Formulaire de page entière** : à l'enregistrement, **rester en place** avec
  une **confirmation focalisée et nominative** (« Les informations de "…" sont
  enregistrées ») + un bouton de sortie **explicite** ; pas de redirection
  surprise. Erreur : rester sur place, message clair **à côté du champ**,
  **saisie conservée**.
- **Bascule à impact** (rendre public, supprimer) : état affiché **en toutes
  lettres** + **annulation** ou confirmation. Pas de geste conséquent sans filet.
- **Ne pas dépendre de la mémoire** : valeurs actuelles affichées et
  pré-remplies.
- **Rien ne change de place selon qui regarde** : l'ordre des sections d'une
  page est fixe, quel que soit le rôle. Une page qui se réorganise n'est plus
  apprenable.

### Comment on vérifie

Trois niveaux, du plus dur au plus humain — le troisième est le seul qui juge
vraiment les filtres, les mots et les groupements :

1. **Testable, et sur l'ÉCRAN pas sur la pièce** : aucun intitulé de navigation
   tronqué ; taille et casse des étiquettes ; un compteur égal au nombre de
   lignes de la vue complète. Une règle qui parle d'un écran se garde par un
   **cliquet à liste fermée** sur les sources (`typographie-lisible.test.ts`,
   `mots-entiers.test.ts`) : la liste gèle l'existant, la CI refuse toute
   NOUVELLE occurrence, et une entrée périmée fait échouer. Un test de
   composant ne garde que le composant — corrigé une fois, il laissait la même
   faute vivre 80 fois ailleurs.
2. **Revue à la main** avant PR : cette checklist, écran par écran.
3. **Avec des personnes concernées** — 2 ou 3 suffisent à révéler l'essentiel.

## Registre des erreurs observées (à ne pas refaire)

| Erreur | Symptôme constaté | Correctif / principe |
|---|---|---|
| **Page qui empile tout en mode édition** | Page orga : ~105 formulaires, 88 boutons, ~12 écrans mobile | Hub-and-spoke (§1) |
| **Composant recodé par rôle** | `DocList` réécrit 3× (orga, coach, participante) ; fiche atelier idem | Composant partagé piloté par capacités (§3) |
| **PRG sur micro-actions** | Bascule d'un item → scroll perdu, dépliants refermés, 6 requêtes rejouées | Pattern résultat (§4) |
| **Libellé directionnel qui contredit l'UI** | Bascule visibilité « est masquée » vs badge encore « visible » pendant le refresh | Message neutre nominatif (§5) |
| **Saisie perdue sur erreur** | Photo taguée 6 personnes + URL erronée → tout à ressaisir | Conserver la saisie (§6) |
| **Boutons dupliqués indistincts** | 25× « Supprimer », 12× « Retirer » différenciés par `aria-label` seul | Une action dans le contexte de son item (§6) |
| **Deux pages création / édition distinctes** | Création d'atelier et modification sur deux écrans → confusion orga | Unifier : créer minimal, compléter sur la fiche |
| **Création silencieusement publique** | Atelier créé titre-seul = visible du public sans le dire | Rendre l'état explicite (texte d'aide ou état brouillon) |
| **Format non normalisé au bord** | `TIME` relu `"HH:MM:SS"` → l'en-tête affiche les secondes ET la ré-écriture échoue | Normaliser dans `mapRow` (§7) |
| **Formulaires empilés sur une page de consultation** | `/admin/conferences` : par carte, un formulaire « corriger édition » + un « modifier/supprimer », plus l'ajout en tête → plusieurs rôles et CTA sur une page de consultation | Une page = un rôle, un CTA (Règle d'or) ; actions en dialog/​page dédiée (§1) |
| **CTA sous la flottaison + feedback sur place** | Sous-page atelier « Informations » : « Enregistrer » hors écran (5 champs), message de succès sous un bouton invisible → on croit à des réglages sans action | CTA toujours visible + confirmation focalisée (§9, checklist cognitive) |
| **`disabled` sur le contrôle qu'on vient d'actionner** | Les cases de présence portaient `disabled={pending}` : le navigateur retire du parcours clavier le contrôle QUI A LE FOCUS, donc le focus tombe sur `body` et la tabulation repart du début du document. Mesuré : 12 tabulations pour revenir à la première case, une de plus par personne — **285 tabulations pour en pointer quinze** | `aria-disabled` + `preventDefault`, jamais `disabled` : le contrôle reste atteignable et annoncé. Le dépôt le faisait déjà dans `RangeeGlissante` et `ConfirmSubmitButton` |
| **Filet réservé aux doigts** | La poubelle d'un atelier était « hors d'atteinte tant qu'on n'a pas glissé la rangée exprès » — vrai au DOIGT seulement. Le glissement arme, mais ce déplacement n'a aucun équivalent dans l'arbre d'accessibilité : au clavier, `Tab` ouvrait le tiroir et `Entrée` effaçait la séance, avec ses présences pointées et ses documents. Une orga au clavier traversait un bouton destructif par rangée | Chaque temps du geste doit avoir son équivalent clavier. Un appui sur une poubelle désarmée l'ARME et le dit (« Confirmer la suppression de « X » ») ; le suivant supprime |
| **Un geste qui doit raconter sa propre disparition** | Le compte rendu vivait DANS l'élément que le geste supprime — la rangée d'un atelier, et le bouton « Marquer présentes les N » qui s'efface quand N tombe à zéro. Or une `revalidatePath` — sur n'importe quel chemin — fait re-rendre la route courante dans la réponse de l'action : React applique le nouvel arbre en même temps que l'état retourné, et la rangée est démontée avant d'avoir pu rendre sa confirmation. Mesuré : réponse de 32 ko, zéro région vive, focus sur un bouton fantôme | Le compte rendu d'une action de liste vit AU-DESSUS de la liste (`AnnonceListe`), dans un composant que le rafraîchissement ne démonte pas : région montée vide puis remplie, et focalisée. Et l'action ne revalide RIEN : le rafraîchissement appartient au client, après l'annonce |
| **Deux éléments collants qui s'ignorent** | La barre d'action (`sticky`, `z-10`) posée à la main sur chaque écran ignorait la barre d'onglets (`fixed`, `z-40`), arrivée après elle : mesuré à 393×852, « Enregistrer » était recouvert sur 32 de ses 44 px et `elementFromPoint` en son centre renvoyait l'onglet « Agenda » — **appuyer sur Enregistrer changeait de page et perdait la saisie** (100 % recouvert sur la sous-page « infos »). Chaque revue ne voyait qu'un côté de la collision | Une seule mécanique partagée (`.barre-action-collante`), une seule source pour la hauteur de la barre (`--hauteur-onglets`), et `scroll-padding-bottom` en pendant de `scroll-padding-top` pour que le focus ne se glisse pas dessous (WCAG 2.4.11). Un `sticky bottom-*` posé à la main est interdit par un test |
| **Texte atténué en opacité sous AA** | `text-gray-light/70` et `/80` ≈ 4.3:1 sur `navy-lighter` ; illisible au soleil | Corps à lire en `white`/`cream` gras, jamais d'opacité de texte (§9) |
| **Info portée par la couleur seule** | État « à traiter » signalé par du texte orange seul | Doubler d'un mot (« manquant », « à faire ») (§9, WCAG 1.4.1) |
| **En-tête titre + bouton en deux colonnes** | `/mon-espace/talks/[id]` : `justify-between` + bouton `shrink-0` → sur 402 px, le texte d'aide tombait sur 6 lignes de 200 px face à un vide de 200 px | Empiler sur mobile (`flex-wrap` ou `flex-col sm:flex-row`) ; UNE seule porte d'entrée par page pour une action (en-tête OU corps, jamais les deux — le doublon en-tête + bas de liste de « Mes talks » a été signalé le 15/08 et retiré, cf. `TalksActions`/`TalksManager`) |
| **Second CTA magenta pour une simple navigation** | Même page : « Enregistrer les modifications » et « Ajouter une conférence » en aplat magenta identique | Un seul aplat primaire par page ; naviguer = `variant="secondary"` (Règle d'or) |
| **Geste dupliqué à droite d'une ligne** | Ligne de conférence : méta écrasée + lien « Modifier » de 36 px collé à droite | La ligne entière est le lien vers la page de l'item (§1, cible ≥ 44 px) |
| **Geste courant enterré sous cinq écrans** | Supprimer un atelier créé en double : liste → fiche → sommaire → page de retrait → modale, plus le titre à retaper | Deux actions maximum : rangée glissée + poubelle nominative dans la liste, page de retrait + bouton depuis la fiche ; type-to-confirm retiré pour l'atelier (§10) |
| **Champ long réduit à 3 lignes** | Description de 3000 caractères en `rows={3}` : le texte se coupait en plein milieu d'une ligne | Dimensionner le champ sur son contenu (`rows={6}`) + compteur vivant plutôt qu'une limite figée |
| **Bloc parallèle à une liste, pour compléter un item** | La page de la conférence listait ses éditions, puis rouvrait dessous « L'édition 2026, en deux temps » — parce que la liste ne menait qu'au chapitre 1. Deux conséquences : la première carte refaisait la ligne d'à côté (même destination, un écran plus bas), et ni l'une ni l'autre ne se donnait pour cliquable (pas de flèche, pas de couleur de lien, un `hover:border` qui n'existe pas au doigt) | Ce qui manque à UN item de liste s'ajoute SUR sa ligne, pas dans un bloc à côté : le second chapitre est un lien de suite sous sa propre édition, frère du lien principal (jamais imbriqué) et souligné. Une entrée par destination, un test l'exige |
| **Prop accessible acceptée d'un côté, jetée de l'autre** | `Button` déclarait `aria-label` dans les props du BOUTON seulement. Passé sur la variante lien, TypeScript l'acceptait (l'union autorisait la clé) et le rendu la jetait : l'appelante croyait avoir nommé son lien, et « Modifier » restait « Modifier » pour la synthèse, N fois pour N destinations. Aucun type, aucun test ne s'en plaignait | Une prop d'accessibilité vit dans les props COMMUNES, et chaque branche la pose. Corollaire mesuré : un `<span class="sr-only"> le talk…</span>` accolé à « Modifier » s'énonce « Modifierle talk » — le calcul du nom accessible recolle les nœuds sans séparateur. Pour compléter un intitulé, `aria-label` avec la phrase entière, le libellé visible restant contenu dedans (WCAG 2.5.3) |
| **Masqué à l'œil, gardé au clavier** | Les maillons repliés du fil d'Ariane portaient `sr-only` : présents dans le DOM et dans le parcours clavier, mais réduits à 1×1 px et découpés par `clip`. Sous 640 px on tabulait donc sur jusqu'à trois liens sans le moindre anneau de focus — rogné avec le maillon (RGAA 10.7). Le lien d'évitement du layout, lui, avait déjà la réponse | `sr-only` sur un élément focalisable s'accompagne TOUJOURS de sa réapparition : `focus-within:not-sr-only` (ou `focus:` sur le focalisable lui-même). Un test l'exige de chaque `sr-only` du composant |
| **Bloc daté rendu sur toutes les pages du même gabarit** | La FAQ du Tremplin répond pour 2026 — la soirée du 4 juin, le jury de cette année-là, des candidatures closes le 17 avril — et s'affichait sur la page de CHAQUE édition. Sur 2025 elle répondait à côté ; pire, le JSON-LD `FAQPage` publiait ces réponses aux moteurs sous l'adresse de l'autre édition. Et comme le retour « Toutes les éditions » et le rappel du code de conduite vivaient DANS cette section, la masquer emportait la seule porte de sortie de la page | Un contenu qui cite des dates appartient à l'édition qu'il décrit : il porte son année (`faqAnnee`) et ne s'affiche que là. Avant de masquer une section, vérifier ce qu'elle héberge d'autre — une navigation logée dans un bloc éditorial part avec lui |
| **Éditorial générique sur une page datée** | La page d'une édition affichait sans condition « Ce qu'il y a à gagner » et « La soirée pitch devant jury ». Sur 2025 — la communauté est montée sur la scène du DevFest, sans parcours autour — ça promettait au futur des prix que personne n'a gagnés et détaillait le format d'une soirée qui n'a pas eu lieu. Le bloc éditorial ne ment jamais tout seul : il ment quand la page qui l'accueille parle d'une année précise | Un bloc qui décrit COMMENT ça marche s'affiche tant qu'il y a quelque chose à décrire : une édition à venir ou en cours le garde (c'est ce qui donne envie de candidater), une édition bouclée qui n'a rien tenu s'en passe (`aUnTremplinADecrire`). Elle a un récit, pas un règlement |
| **Compteurs à zéro posés en grand** | La page d'une édition ouvrait sur trois chiffres énormes sous un titre `sr-only` : pour une année sans parcours, ça donnait `0 0 0` sans étiquette, juste avant un récit qui raconte une salle pleine. Une visiteuse voyante lit « ça a raté », puis lit le contraire un scroll plus bas | Zéro partout = rien à compter : la bande se tait (`aDesChiffresAAfficher`). Dès qu'UN chiffre existe, les trois s'affichent — c'est là qu'un zéro informe (« 8 inscrites, 0 gagnante » raconte l'étape) |
| **Contenu éditorial écrit en dur dans une page** | Ce que 2025 a été pour la communauté (salle des communautés ouverte par le DevFest, présentation de Tech Speak'Her, talk de 35 min devant une salle pleine) vivait dans le JSX de `/devfest-toulouse`. Deux conséquences : la page qui raconte cette édition, `/tremplin/devfest-toulouse/2025`, ne pouvait pas s'en servir — elle se réduisait à trois compteurs à zéro et une séance isolée, au point d'avoir affiché « 10 semaines d'accompagnement » qui n'ont jamais eu lieu — et le corriger d'un mot demandait un déploiement. Le texte était là, à une page de distance, et personne ne pouvait ni le voir ni le toucher | **Chercher le mécanisme AVANT d'en inventer un.** Il existait depuis la migration 040 : `contenus.conference_edition_id` associe un contenu à une conférence répertoriée, et l'orga l'écrit dans `/admin/contenus`. Les surfaces s'y branchent (`RecitConference`), le seed est en `ON CONFLICT DO NOTHING` pour que l'admin garde le dernier mot. Un registre statique en `src/data` aurait refait le même piège une couche plus loin : du texte que seule une PR peut changer |
| **Garde de précondition posée aussi sur le retrait** | La fiche coach exige que le compte accompagne quelqu'un — précondition juste pour ÉCRIRE un rôle public. Appliquée telle quelle au consentement, elle gardait aussi le geste inverse : une coach retirée de son dernier atelier conservait un `public = true` indélébile, republié le jour où elle accompagne à nouveau, sur la foi d'un accord donné pour une autre édition | Une garde protège ce qu'on POSE, jamais ce qu'on efface. Retirer un accord reste possible en toutes circonstances (RGPD art. 7-3 : aussi simple à retirer qu'à donner). Même règle pour toute suppression : la voie de sortie ignore les conditions d'entrée |
| **Le même récit recopié sur trois surfaces** | Une fois le récit de 2025 passé en base, deux surfaces le lisaient… et `/tremplin` en gardait une TROISIÈME copie en dur : mêmes noms, même durée de talk, même salle pleine. Elle contredisait déjà la version en base (« le Tremplin n'existait pas encore » alors que 2025 est justement l'année du premier talk de Cateline), et employait la forme négative interdite. Trois copies d'un texte, c'est trois vérités qui divergent au premier mot corrigé | Une page qui n'a PAS le récit pour rôle y renvoie, elle ne le rejoue pas. `/tremplin` dit pourquoi le programme existe en une phrase et pointe vers la page de la conférence, qui porte l'histoire. Un test interdit les noms et les détails du récit dans ce bloc : la copie ne peut plus revenir par inadvertance |
| **Landmark principal reposé par chaque page** | `layout.tsx` enveloppe tout le contenu dans `<main id="main-content">`, cible du lien d'évitement. Et 57 pages plus 2 gabarits posaient malgré tout LEUR `<main>` à l'intérieur : HTML invalide, trois violations axe mesurées par page (`landmark-main-is-top-level`, `landmark-no-duplicate-main`, `landmark-unique`). « Aller au contenu principal » devenait ambigu, et la liste des repères annonçait deux fois la même région. Cinq fichiers portaient déjà le bon commentaire — la règle était connue, elle n'était simplement gardée nulle part | Un repère structurant appartient au GABARIT, jamais à la page qu'il accueille : une page rend un `<div>`. Et la porte qui compte se choisit en connaissance de cause — axe range les règles de landmark en « best-practice », donc hors des tags WCAG A/AA de la CI, ce qui a laissé la dette pousser jusqu'à 59 fichiers sans que rien ne tombe. On les nomme une à une dans la porte E2E, et la règle vit dans ESLint plutôt que dans un test qui balaie les sources — il lit l'AST (une regex de ligne rate `<main` dont les attributs passent à la ligne), signale à la frappe, et couvre les pages qu'aucun navigateur de CI n'atteint |
| **Le nom de l'association coupé en deux** | « Tech Speak'Her » portait une espace ordinaire dans les 260 chaînes du dépôt. Mesuré en navigateur : le nom se cassait en deux sur quatre paragraphes à 390 px et trois à 320 px. Le dépôt avait déjà résolu le cas UNE fois, à la main, avec `whitespace-nowrap` sur un seul titre : le correctif local existait, la règle n'était nulle part. Deux gardes successives ont raté leur cible avant la bonne | L'espace INSÉCABLE dans la prose affichée. La garde vit AU RENDU (`e2e/mots-colles.spec.ts`), jamais côté sources : en JSX, un saut de ligne entre deux mots se replie en espace SÉCABLE, et un scan ligne par ligne ne le voit pas — deux pages étaient dans ce cas. La frontière compte autant que le caractère : les DONNÉES qu'on apparie gardent l'espace ordinaire (index de recherche, seeds, identité juridique, sorties e-mail et RSS), et les données structurées passent toutes par `ASSOCIATION.nom`. Corollaire trouvé à la deuxième revue : replier l'espace à la comparaison ne suffit pas si le moteur de recherche indexe la chaîne BRUTE — Fuse reçoit donc un corpus aux espaces repliées |
| **Relever une taille sans lire les exceptions de la norme** | Une revue avait signalé 44 cibles tactiles « sous 24 px » sur les pages publiques, dont le pied de page et le fil d'Ariane. Vérification faite, il y en a ZÉRO : WCAG 2.5.8 exempte le lien en ligne dans une phrase (sa taille est contrainte par l'interlignage) et la cible espacée d'au moins 24 px de ses voisines. Le fil d'Ariane mesure 50×32, la flèche de retour 28×24. Un correctif aurait épaissi des liens conformes, au prix de la densité | Une règle d'accessibilité se cite AVEC ses exceptions, sinon on corrige du conforme. Le juge n'est ni l'œil ni un relevé de tailles : c'est axe, qui implémente les exceptions — `target-size` est passé dans la porte E2E, et il y est vert. Corollaire : un constat de revue non reproduit reste une hypothèse, y compris quand il vient de moi |
| **Un repère « maintenant » qui n'est pas une date, et deux marges de défilement qui s'additionnent** | « Mon agenda » s'ouvrait sur un SÉPARATEUR (« ———— AUJOURD'HUI ———— ») posé entre le passé et l'à-venir. Deux défauts d'un coup. (1) Il ne disait pas la date, et un agenda saute les mois vides : entre une séance de mai et une de septembre, aucun en-tête ne portait le mois courant. (2) Il portait `scroll-mt-[6.5rem]` **en plus** du `scroll-padding-top: 6.5rem` du site — les deux se cumulent au lieu de se remplacer — donc la page se posait à 208 px du haut au lieu de 104, laissant à l'écran une carte du passé coupée en deux et l'en-tête de mois COLLANT du passé. Le seul titre visible en haut de fenêtre était donc « MAI 2026 ». Signalé depuis la prod (16/08) : « je vois encore mai et j'ai l'impression qu'aujourd'hui j'ai septembre ». La bande collante ne mentait pas, elle répondait à une question qu'on ne lui posait plus | **Maintenant est une DATE du fil, pas une frontière entre deux zones** : la ligne du jour existe toujours, à sa place chronologique, avec son mois au-dessus, même vide (`avecAujourdhui` + « Rien à l'agenda aujourd'hui. »). Ce qu'on lit en haut de l'écran en arrivant est alors le mois courant et le jour même — la structure du calendrier fait le travail, aucun ornement n'a à le compenser. Elle se distingue par la **taille et la graisse** d'abord, la couleur en renfort, et le mot « aujourd'hui » ÉCRIT (§9, WCAG 1.4.1). Et la marge de défilement se pose **une seule fois** : le `scroll-padding-top` du site réserve ses deux barres, un élément n'ajoute que la TROISIÈME s'il vit dessous (la bande de mois, token `--spacing-bande-mois`), et sur l'élément focalisable, jamais sur son conteneur. Tout ça se mesure en pixels dans un vrai navigateur (`e2e/agenda-perso.spec.ts`), jamais en lisant le DOM |
| **La page vérifie, l'action fait confiance** | `/admin/…/coachs/[userId]` vérifie bien qu'on ouvre la fiche d'une coach de CET atelier. Mais le `userId` repart ensuite dans un champ caché, et la Server Action ne relisait que « entier positif » : un POST forgé écrivait un rôle et un lien PUBLICS sur n'importe quel compte, avec un consentement horodaté à la clé | Ce qu'une page garde, l'action le REVÉRIFIE : la page choisit l'écran, elle n'autorise rien. Poser la précondition dans le lib (`estCoachRattache`), la documenter là et l'appeler depuis chaque geste. Une vérification impossible (base en panne) ferme, elle n'ouvre pas |
| **L'étiquette qui structure, rendue illisible** | `SegmentLabel` — l'élément dont le SEUL rôle est de réduire la charge de lecture — rendait 10,5 px, TOUT EN CAPITALES, interlettrage 0,14 em, en `gray-light`. Trois obstacles cumulés sur le même mot : une taille sous le plancher de lecture, des capitales qui effacent la silhouette du mot (on la reconnaît avant de lire les lettres), et un gris qui retire l'emphase à ce qui structure la page. La règle existait déjà (§9 : « hiérarchie par la taille et la graisse, jamais par un gris plus pâle ») — elle n'était gardée nulle part | Une étiquette de segment est le texte le plus lisible de l'écran, pas le moins : casse respectée, ≥ 14 px, graisse ≥ 600, couleur pleine. Gardé par `segment-label.test.tsx` |
| **Une destination tronquée** | `NavRow` coupait tout titre sur UNE ligne (`truncate`) par défaut. Sur téléphone, « Ateliers de l'édition en cours » s'affichait « Ateliers de l'édition en c… » : l'intitulé qui doit permettre de CHOISIR où aller était le seul texte qu'on ne pouvait pas finir de lire | On tronque une **donnée** (un nom, un sujet de talk), jamais une **destination**. Défaut à deux lignes, « none » pour ce qui doit se lire en entier. L'exception « données denses » (`titleClamp={1}`) a été RETIRÉE le 2026-08-16 : aucune rangée du produit ne s'en servait, elle ne subsistait plus que comme invitation à recommencer. Une option qu'aucun appelant n'utilise n'est pas une capacité |
| **Le vocabulaire de la maison pris pour du français** | « Ta prochaine marche » (métaphore d'escalier, et mot ambigu : une marche, marcher, ça marche), « Mon asso », « Espace orga » — des mots tronqués ou imagés qui supposent qu'on est déjà dedans. L'argument « cet écran n'est montré qu'aux orgas » ne sauve pas « orga » : une personne qui vient d'arriver, ou qui lit lentement, n'a aucune prise sur trois lettres | Mots entiers et littéraux dans tout intitulé (« étape », « association », « organisatrices »). Une métaphore morte (« étape », « fil ») passe ; une image vivante, non. Et le code suit le mot — renommer la lib avec le libellé, sinon on rétablit deux noms pour une chose |
| **Un possessif qui attribue ce qui n'est à personne** | Un groupe de rangées orga étiqueté « Mon asso » faisait de l'orga la propriétaire de l'association. Une loi 1901 n'appartient pas à celles qui la font tourner — et le même piège guettait « Mon tremplin » pour une participation | On nomme **ce qui est à soi** (mon compte, ma participation, mon bénévolat), jamais le collectif dont on est membre. Le possessif d'une étiquette doit être vrai |
| **Vrai au niveau du composant, faux au niveau de l'écran** | `SegmentLabel` corrigé, son test au vert, la règle écrite — et la forme condamnée survivait **plus de 80 fois** ailleurs, dont ~29 sur des `h2`/`h3`. Le composant qui existe précisément pour ce rôle n'est appelé que 7 fois : corriger la pièce n'a corrigé aucun écran, et rien n'empêchait la 83ᵉ occurrence. Même mécanique pour « orga » : l'espace organisatrices renommé, et 43 phrases disaient encore « l'orga », dont une sur `/connexion` — une page PUBLIQUE, lue sans compte | Une règle d'écran se garde par un **cliquet à liste fermée** sur les sources, pas par un test de composant : la liste gèle l'existant, la CI refuse toute NOUVELLE occurrence, et une entrée périmée fait échouer (`typographie-lisible.test.ts`, `mots-entiers.test.ts`, sur le modèle de `lien-texte.test.ts`). Le vocabulaire se juge sur la COPIE extraite par l'AST, jamais par `grep` : un commentaire parle du code, une chaîne parle à quelqu'un (`src/__tests__/copie-affichee.ts`) |
| **Une règle énoncée, puis contournée dans la ligne suivante** | Le code portait le commentaire « le groupe n'a pas de nom simple, **et on ne fabrique pas un mot pour avoir une étiquette** », puis fabriquait « Mes pages » et le servait en `sr-only`. Donc un mot que personne n'emploie, lu à voix haute aux seules personnes qui ne peuvent pas le recouper avec l'écran — l'inverse exact du service rendu. Et le test qui gardait le groupe VÉRIFIAIT la présence de ce mot | Si aucun nom simple n'existe, le groupe n'a **pas de titre du tout** — ni visible, ni masqué. Un `sr-only` n'est pas une exemption : c'est un texte qu'on ne peut plus relire à l'usage, donc la version la plus exigeante, pas la plus permissive |
| **Un repère de page qui annonce un état** | La pastille « Privé » vivait DANS le `h1` : le nom accessible du titre devenait « Mon profil Privé ». Le repère qui sert à dire OÙ l'on est annonçait une propriété de visibilité, et la même pastille portait 11 px interlettrés — la typographie condamnée, manquée par deux revues successives parce qu'elle n'était pas dans un titre | Un titre nomme l'endroit, rien d'autre. L'état, le compteur, le badge vivent **à côté** — dans le même bloc visuel si besoin, jamais dans le nom accessible du titre |
| **`aria-current="page"` sur un onglet qui mène ailleurs** | L'onglet Profil est le REPLI de tout `/mon-espace/**` et de tout `/admin/**` : il s'allume sur des dizaines de routes où son lien mène… au profil, c'est-à-dire ailleurs. Annoncé « page courante », il promettait un lien qui ne déplace pas. Et le test verrouillait la valeur fausse sur trois chemins `/admin` | `page` veut dire « CE lien mène à la page affichée » ; pour « élément courant d'un ensemble », la valeur est `true`. L'onglet reste allumé dans les deux cas — seule l'annonce change, et elle redevient vraie |
| **Un groupe visuel promu en repère de navigation** | Chaque groupe de rangées du profil était une `<section aria-labelledby>` : six repères annoncés sur un écran de téléphone qui n'a qu'un sujet. La liste des repères, qui sert à SAUTER, devenait une seconde table des matières concurrente du plan de titres | Le plan se lit par les **titres** ; un groupe est un `<div>`, et sa liste porte son nom par `aria-labelledby` — ce qui la nomme sans encombrer la liste des repères. On réserve `<section>` nommée à ce qui mérite qu'on y saute |
| **Une règle qu'un appelant peut annuler** | La loi de proximité était écrite (« une étiquette est nettement plus proche de ce qu'elle introduit que de ce qui précède »), et `SegmentLabel` exposait `className` : deux appels sur trois passaient `mt-0` ou `mt-2`, l'étiquette se retrouvant à égale distance des deux groupes — donc lue comme la légende du groupe du dessus. La dette technique proposait de corriger les APPELS | L'espacement appartient au **composant** (`mt-8 -mb-1`), et la prop a disparu. Rendre la faute impossible vaut mieux que la tester : une règle qu'un appelant peut annuler n'est pas une règle, c'est une convention |

## Acquis à conserver

`AdminDialog` (saisie à la chaîne, restauration sur erreur, régions vivantes) ;
badges/compteurs alignés sur la page publique ; confirmations nominatives des
gestes destructifs (`ConfirmSubmitButton`) ; gardes serveur scopées à l'édition ;
`overflow-x: clip` (pas `hidden`) pour couper le scroll horizontal sans casser
`position: sticky` ; le glissement de rangée (`RangeeGlissante`) qui met une
action destructive à un geste sans la rendre cliquable par accident.

**Le carrousel qui laisse le navigateur défiler** (`CarrouselVerbatims`) : la
piste est un conteneur `overflow-x` + `scroll-snap` atteignable par tabulation,
donc le doigt, la molette ET le clavier la font défiler sans une ligne de
mathématique de glissement (contrairement à `RangeeGlissante`, qui doit
découvrir une action cachée). Le JS n'ajoute que les flèches, les pastilles et
l'annonce de position en région vivante — **rien ne défile tout seul**
(WCAG 2.2.2 : un défilement automatique vole la lecture en cours, et une pause
à trouver est déjà un problème). Deux règles apprises là : le contenu des
cartes se **centre** (toutes ont la hauteur de la plus longue, sinon une
citation courte laisse un trou), et les positions **traversées** par un
défilement animé ne sont pas des arrivées (sans ce repère, la pastille recule
d'un cran juste après le clic).
