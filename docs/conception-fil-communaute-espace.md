# Conception — Le fil de la communauté dans l'espace connecté

> ⚠️ **REMPLACÉE le 2026-08-07 au soir** par
> `docs/conception-espace-fil-navigation.md` (l'espace connecté v2 : le fil
> devient l'Accueil entier, la page /mon-espace/fil et le marqueur de visite
> sont abandonnés avant merge). Ce document reste l'historique du lot 1 : ses
> revues (dont la revue exigeante à quatre rapports) et ses protections
> (fiche retirée rétroactive, strictement passé, périmètre public) restent
> valables et citées par la v2.
>
> Statut : **conception fonctionnelle + technique**, écrite avant le code.
> À lire avec `docs/principes-conception-ui.md` (règle d'or, §9 lisibilité, §10
> paliers) et `docs/conception-tableau-de-bord-orga.md` (le modèle MOI / L'ASSO,
> les principes de tâches — que ce fil ne rejoue pas).
>
> Date : **2026-08-07**.

## 1. Le manque

L'espace connecté ne raconte que **soi**.

- `/mon-espace` est un tableau de bord : « À venir » (mes ateliers, mes talks)
  et « Ma fiche » (son état, ce qu'il reste à compléter).
- `/admin` est un menu « Gérer » plus une page de tâches `/admin/taches`.
- `docs/conception-tableau-de-bord-orga.md` assume ce parti de bout en bout et
  ne mentionne jamais de fil.

Le seul objet « actualités » qu'ait connu l'espace connecté était
`NouveautesBanner` : un bandeau fermable à l'entrée, mémorisé par navigateur,
qui annonçait la dernière nouveauté produit. **La refonte #247 l'a supprimé sans
remplacement.** Depuis, une membre qui revient après trois semaines ne voit
aucune trace de ce qui a bougé — ni les fiches qui sont entrées dans l'annuaire,
ni les actualités publiées, ni les scènes qu'on vient de faire, ni ce qui a
changé sur la plateforme.

Le « fil de la communauté » existe pourtant : `src/lib/fil-communaute.ts`, écrit
pour la page d'accueil **publique**. C'est-à-dire à l'endroit exact où une
membre connectée ne va plus, puisque son onglet « Accueil » mène à
`/mon-espace`.

**Incohérence à corriger au passage** : l'en-tête de `CHANGELOG.md` renvoie
encore les nouveautés vers « un bandeau à l'entrée de l'espace
(`src/data/nouveautes.ts`) ». Le bandeau est parti, le fichier n'existe plus.

## 2. Conception fonctionnelle

### 2.1 Le rôle, en une phrase

**Dire ce qui s'est passé depuis la dernière visite.** Rien d'autre.

C'est un objet de **lecture**. Il ne porte **aucun CTA**, aucune action, aucun
formulaire — ce qui est précisément ce qui le rend compatible avec la règle d'or
(« une page = un rôle, un CTA principal maximum ») : posé sur `/mon-espace`, il
n'ajoute pas un second CTA à une page qui en a déjà un (l'onboarding de fiche).

Corollaire de méthode : à chaque fois qu'on voudra lui ajouter un geste
(« masquer », « j'aime », « marquer comme lu »), la bonne réponse par défaut est
non. Le fil se lit et on passe à autre chose.

### 2.2 Ce qu'il ne fait pas, et pourquoi

| Écarté | Pourquoi |
|---|---|
| **Un suivi lu / non-lu par entrée** (et son extension : articles lus, fiches lues) | Il faudrait une table (personne × contenu) : de la donnée de **comportement de lecture**, créée là où il n'y en avait pas — pour un fil qui bouge quelques fois par mois. Et l'UI qui va avec (badges sur `/actualites`, sur l'annuaire) est le « bruit permanent » déjà rejeté par `conception-tableau-de-bord-orga.md`. À la place : le marqueur de **visite** du §2.2bis, qui dit « nouveau depuis ton passage » sans jamais prétendre savoir ce qui a été lu. |
| **Un `localStorage` à la `NouveautesBanner`** | Un état par navigateur ment dès qu'on change de téléphone, et il faisait disparaître l'information au lieu de l'archiver. Et contrairement à l'intuition, il n'échappe pas au régime des traceurs : l'article 82 de la loi Informatique et Libertés couvre **toute** écriture dans le terminal (`localStorage` compris), pas les seuls cookies. La forme serveur du §2.2bis, elle, n'écrit **rien** dans le terminal. |
| **Des tâches dans le fil** | « À faire » (orga) et la complétude de fiche sont des listes d'action, elles vivent où elles vivent. Jamais deux listes concurrentes en haut de page (déjà tranché, v1.1 du tableau de bord). Le fil dit ce qui *est arrivé*, pas ce qu'*on doit faire*. |
| **Ce qui vient** | `/mon-espace` a déjà « À venir » (mes échéances) et `/agenda` porte les prochaines dates de toute la communauté. Un fil qui mélange le passé et le futur dans une seule colonne chronologique ne se lit plus. **Le fil est strictement antichronologique et strictement passé.** |
| **Les données de participation** (inscriptions Tremplin, ateliers, présences) | Ce n'est pas la vie publique de la communauté, c'est le dossier de quelqu'un. |
| **Une fenêtre glissante** (« les 90 derniers jours ») | Elle vide le fil les mois creux, et un fil vide rend sa page injoignable depuis le tableau de bord. À la place : pas de fenêtre, et **chaque entrée porte sa date** — c'est la date qui dit la fraîcheur, pas un titre qui la promet. Le titre de section est donc « Dans la communauté », jamais « Récemment ». |

### 2.2bis « Nouveau » : un marqueur de visite, côté serveur (décidé le 2026-08-07)

Le besoin est réel — savoir d'un coup d'œil ce qui est arrivé depuis son dernier
passage — et la première version de cette conception l'avait écarté trop vite,
en le confondant avec le suivi de lecture. Les deux se séparent :

**Ce qu'on marque est un fait de VISITE, jamais un fait de LECTURE.** Une seule
donnée : la date de dernière ouverture du fil, une colonne sur `users`
(`fil_ouvert_le TIMESTAMPTZ`). Le mot affiché est **« Nouveau »** (sous-entendu :
depuis ton dernier passage) — **jamais « non lu »**, qui serait un mensonge deux
fois : on ne sait pas si la personne a lu, et prétendre le savoir obligerait à
le mesurer.

Et il y a plus fort que le coût : un suivi de lecture serait **impossible à
rendre vrai**. Les actualités et les fiches speakeuses sont des pages
PUBLIQUES : une membre les lit souvent déconnectée, depuis le flux RSS ou un
partage LinkedIn — hors de vue de tout marqueur, et c'est très bien ainsi.
« Nouveau » survit à ce scénario parce que c'est une affirmation sur le FIL,
jamais sur la personne : « cette entrée est arrivée dans le fil depuis ton
dernier passage dans le fil » reste vrai même quand l'article a déjà été lu
ailleurs, la veille, déconnectée. Un badge « non lu » au même endroit serait
faux dans ce cas précis.

Comment ça joue :

- **L'Accueil** marque « Nouveau » sur les entrées de son extrait — un calcul
  en lecture seule contre la date, aucune écriture au passage sur l'Accueil.
  Pas de compteur global (« 3 nouveautés ») : il exigerait de charger le fil
  ENTIER sur l'Accueil pour compter juste, et les badges de l'extrait plus
  l'ordre antichronologique disent déjà l'essentiel.
- **Ouvrir `/mon-espace/fil` pose la date.** Les entrées arrivées depuis le
  passage précédent portent « Nouveau » sur CE rendu (l'ancienne valeur est lue
  avant d'être remplacée) : on voit ce qui est nouveau au moment où on le
  regarde, et le compteur est soldé.
- Une entrée aperçue dans l'extrait de l'Accueil sans ouvrir le fil **reste
  nouvelle** : l'extrait ne solde rien. C'est aussi ce qui donne sa raison
  d'être à la page.
- « Nouveau » s'écrit **en toutes lettres** sur l'entrée (jamais un point de
  couleur seul, WCAG 1.4.1).
- **Limite assumée de la précision jour** : une scène entre dans le fil le
  lendemain de sa date (strictement passée), avec la date de l'ÉVÉNEMENT. Pour
  une visiteuse quotidienne, elle arrive donc datée du jour de son dernier
  passage : jamais badgée « Nouveau ». C'est le prix d'une date qui dit le
  fait (le talk a eu lieu le 5) plutôt que la mécanique (il est entré dans le
  fil le 6) — la visiteuse quotidienne voit l'entrée en tête du fil de toute
  façon.

**Côté légal, c'est la forme la plus sobre qui existe.** Rien n'est écrit dans
le terminal (ni cookie, ni `localStorage`) : le régime des traceurs (art. 82
LIL / ePrivacy) ne s'applique pas, donc aucun bandeau, aucun consentement. La
colonne est une donnée de compte ordinaire : base légale « exécution du
service », une ligne aux mentions légales, effacée avec le compte
(`ON DELETE CASCADE` n'a même pas à jouer : elle est SUR la ligne du compte).

Prix assumé : le « zéro migration » de la v1 de cette conception tombe — il
était la conséquence du refus du vu/non-vu, pas un objectif. Une colonne,
`schema.sql` + `sync-to-latest.sql` + une migration `NNN_fil_ouvert_le.sql`.

### 2.3 Les quatre natures d'entrée

Toutes les matières sont **déjà publiques** et **déjà présentes** — en base ou
dans `src/data`. Aucune n'est inventée pour l'occasion.

| Nature | L'entrée dit | Source | Date de l'entrée |
|---|---|---|---|
| **Annuaire** | « {Nom} », son titre de profil → sa fiche | `speaker_profiles` (`getNouvellesVenues`, déjà écrit) | `published_at` |
| **Actualité** | le titre de la publication, son chapô → l'article ou le lien | `contenus` (`listPublicationsRecentes`, déjà écrit) | `publie_le` |
| **Sur scène** | le titre du talk, « {Nom} · {Conférence} » → sa fiche | `talk_occurrences` (mêmes règles que l'agenda public) | date de l'occurrence |
| **Plateforme** | ce qui a changé sur le site, en une phrase → l'écran concerné | statique, `src/data/fil-plateforme.ts` | date de livraison, écrite à la main |

**Chaque intitulé nomme le FAIT, pas la catégorie** (décidé le 2026-08-07). Une
étiquette « Annuaire » range l'entrée dans un tiroir ; « Nouvelle speakeuse dans
l'annuaire » dit ce qui s'est passé. C'est la règle §5 des principes (nominatif,
descriptif) appliquée au fil, et elle vaut pour les quatre :

| Nature | Intitulé affiché |
|---|---|
| Annuaire | **Nouvelle speakeuse dans l'annuaire** |
| Sur scène | **Un talk en conférence** |
| Actualité | **Nouvelle actualité** |
| Plateforme | **Nouveau sur la plateforme** |

(« Un talk en conférence » réconcilie deux exigences : nommer le fait, et
parler le vocabulaire que la fiche publique emploie déjà — sa section s'appelle
« Talks & conférences ».)

Conséquence sur la mise en page : l'intitulé porte une phrase, plus un mot. Il
occupe donc sa propre ligne au-dessus du titre de l'entrée, la date restant à
droite — et non une pastille serrée à côté d'elle.

**Pourquoi « Sur scène » en fait partie.** Sans elle le fil est maigre :
l'annuaire gagne quelques fiches par mois et les actualités sont rares. Surtout,
c'est la raison d'être de l'association — quelqu'un est passé de la salle à la
scène. C'est l'entrée qui donne envie de revenir lire le fil.

**Pourquoi la nature « Plateforme » a son propre fichier statique.** Trois
sources ont été pesées :

- `CHANGELOG.md` : daté, déjà tenu… mais écrit pour l'équipe (« migration `057` »,
  « `saveProfile` revalide »). Ce n'est pas de la copie pour les membres. Écarté
  — mais son en-tête est corrigé (cf. §2.6).
- `src/data/nouveautes-plateforme.ts` : la tentation « source unique », puisque
  c'est déjà la copie produit écrite pour les membres. Écarté quand même : ce
  fichier est le **contenu d'une campagne e-mail** (`CAMPAGNE_NOUVEAUTES =
  "nouveautes-2026-08"`), sans date par entrée, et **remplacé en bloc à la
  campagne suivante**. Un fil branché dessus perdrait son historique le jour où
  on écrit la campagne de septembre.
- **`src/data/fil-plateforme.ts`** (retenu) : une liste qui **s'accumule**, une
  entrée = un titre, une phrase, une date, un lien. C'est la forme qu'un fil
  demande. Suite possible, hors périmètre : dériver la prochaine campagne
  e-mail de ce fichier plutôt que l'inverse.

### 2.4 Où le fil vit

**Sur `/mon-espace`, pour tout le monde — orga comprise.**

Ce n'est pas un arbitrage entre deux espaces : la barre d'onglets
(`BottomNav`) donne « Accueil » → `/mon-espace` à **toutes**, et les
emplacements orga (« À faire », « Orga ») s'ajoutent à côté. L'accueil d'une
speakeuse connectée et l'accueil d'une orga connectée sont **la même page**. Le
fil y va, et `/admin` n'en porte **aucune copie** — règle de surfaçage unique.
C'est cohérent avec le modèle MOI / L'ASSO : le fil ne parle ni de moi ni de la
logistique de l'asso, il parle de **la communauté**, donc il vit dans l'espace
que tout le monde partage.

Deux surfaces, le patron exact de « À venir » (rien de nouveau à apprendre) :

1. **`/mon-espace`** — une section « Dans la communauté », **3 entrées**, puis
   un lien discret « Voir tout le fil → ». Elle se place **en dernier, pour
   tout le monde** (décidé le 2026-08-07) : ce que j'ai à faire passe avant ce
   que je lis, et une position fixe se code et se teste sans cascade de cas.
   La v1 de cette conception faisait remonter le fil sur un compte tout neuf ;
   c'est le lot 2 (§5) qui traitera l'accueil du compte neuf, proprement, par
   le « À faire » perso — la remontée aurait préjugé de cette refonte.
2. **`/mon-espace/fil`** — la page du fil, **30 entrées au plus**, groupées par
   mois comme `/mon-espace/agenda`. Ce n'est pas une archive : au-delà,
   `/speakeuses`, `/actualites` et `/agenda` portent les listes complètes, et
   la page le dit.

### 2.4bis La barre d'accès direct : le fil ne prend pas d'onglet

La barre basse (`BottomNav`) est LE dispositif d'accès direct de l'espace. Elle
tient **cinq** emplacements : Accueil et Agenda en tête, « Ma fiche » en queue,
et **deux** emplacements variables remplis par priorité de rôle. Ce que ça donne
aujourd'hui :

| Rôle | Emplacements 3 et 4 | Ce qui n'a pas d'onglet |
|---|---|---|
| Orga (même coach, même participante) | À faire · Orga | Talks, Messages |
| Coach non-orga | Coaching · Documents | Talks, Messages |
| Participante | Documents · Talks | Messages |
| Speakeuse simple | Talks · Messages | — |

**Le fil n'y entre pas**, pour trois raisons :

1. Il serait le **sixième** emplacement, sur une barre déjà pleine pour une
   orga. À 375 px, six cibles tombent à 62 px de large, et aucun libellé
   d'onglet ne porte « Fil de la communauté ».
2. **Un onglet sert à revenir FAIRE quelque chose.** Le fil se lit. Sa place est
   l'onglet que tous les rôles ont déjà en position 1 : Accueil.
3. **C'est déjà la règle du dépôt.** Pour une orga, « Mes talks », « Mes
   messages », « Mes documents » et « Mon coaching » n'ont pas d'onglet et
   vivent sur la page Accueil. La page Accueil est le **hub** ; la barre n'est
   qu'un raccourci vers les cinq gestes les plus fréquents.

> **Dossier ouvert « navigation globale », hors périmètre de ce lot** — trois
> constats du 2026-08-07, à trancher ensemble et pour eux-mêmes ; le fil ne
> doit ni les masquer ni servir de prétexte à les régler.
>
> 1. **La barre n'est pas canon pour une orga** : ses deux emplacements
>    variables sont pris par À faire et Orga, donc elle perd l'accès direct à
>    ses **propres** talks et messages — alors qu'une orga est aussi une
>    speakeuse. Même effet pour une coach non-orga.
> 2. **Le chemin d'une orga vers un atelier est un problème de
>    découvrabilité, pas de structure** : le raccourci existe (l'onglet Agenda
>    porte le programme qu'elle organise, chaque carte mène à la fiche admin de
>    l'atelier, passé compris), mais rien ne le dit, et le chemin « évident »
>    (Orga → Tremplins → édition → Ateliers → atelier) fait cinq écrans.
> 3. **Le menu compte est caché sur mobile.** `AccountMenu` (l'avatar du
>    header, avec fiche/talks/espace orga selon le rôle) existe et fonctionne —
>    mais dans un bloc `hidden xl:flex` : desktop seulement. Sur téléphone, le
>    burger récupère une section « Mon compte » qui, pour une membre connectée,
>    fait doublon avec la barre basse : deux navigations concurrentes. La
>    décision v6 (« header mobile plein, on n'y ajoute rien ») avait été pesée
>    pour l'orga qui bascule d'espace ; l'ouverture des adhésions change la
>    population — la majorité sera des speakeuses non-orga, pour qui l'avatar
>    en haut est le geste appris partout, et le burger doit redevenir la
>    navigation du SITE. Coût à arbitrer : quatre objets dans le header
>    (logo, loupe, avatar, burger) demandent de resserrer le nom sous ~375 px.

### 2.5 Le vide, et la panne

- **Zéro entrée** → la section disparaît de `/mon-espace` (jamais de cadre
  vide ; même règle que les blocs vivants de l'accueil public). Le lien vers la
  page part avec elle : pas de porte vers une page vide. En pratique le cas ne
  se produit pas — les entrées « Plateforme » sont statiques, donc toujours là.
  La page dédiée, elle, reste atteignable par URL et dit ce qu'elle attend.
- **Base indisponible** → chaque source dégrade **seule** (`.catch` par
  requête, comme l'accueil public) : les entrées statiques restent, le fil vit,
  et rien de faux ne s'affiche.

### 2.6 La cohérence à rétablir

`CHANGELOG.md`, en-tête : remplacer le renvoi au bandeau supprimé et au fichier
disparu (`src/data/nouveautes.ts`) par le renvoi au fil et à sa source
(`src/data/fil-plateforme.ts`). Une nouveauté visible des membres s'écrit
désormais à **deux** endroits, et le CHANGELOG le dit.

## 3. Conception technique

### 3.1 Le partage pur / chargement, déjà en usage

On reprend le découpage de `taches-orga.ts` / `taches-orga-chargement.ts`, qui
existe précisément pour tester la logique **sans base** :

- `src/lib/fil-communaute.ts` (le fichier existe déjà, et il porte déjà ce nom
  parce qu'il porte déjà cette idée) : le type `EntreeFil`, la clé stable
  `cleEntree`, et **`fusionnerFil` — pure** : elle reçoit les quatre listes,
  fusionne, trie, plafonne. `getNouvellesVenues` y reste.
- `src/lib/fil-chargement.ts` : `chargerFil(limite)` — les requêtes, leur
  `.catch` de dégradation, et l'appel à `fusionnerFil`.

### 3.2 Le type : une union discriminée, comme `EcheanceAgenda`

```ts
type EntreeFil =
  | { genre: "venue";       date: string; ... }
  | { genre: "publication"; date: string; ... }
  | { genre: "scene";       date: string; ... }
  | { genre: "plateforme";  date: string; ... };
```

Chaque variante porte de quoi rendre **une** rangée : un intitulé de nature
(« Annuaire », « Actualité », « Sur scène », « Plateforme »), un titre, un
détail facultatif, une date `YYYY-MM-DD`, une destination et le **nom accessible
entier** du lien. Une seule présentation (`FilEntree`) les rend toutes — un
composant, des capacités (§3 des principes), jamais quatre cartes recopiées.

La clé React stable est `{genre}:{id}` (`venue:12`, `publication:{slug}`…) :
les identifiants des quatre sources se recoupent, et dériver le préfixe du
genre rend l'unicité vraie par construction (une 5ᵉ nature ne peut pas entrer
en collision).

**L'avatar ne sort que pour « Annuaire »**, où la photo est déjà chargée par
`getNouvellesVenues` et déjà affichée publiquement. Les scènes ne le
sélectionnent pas : une colonne de moins à lire est une colonne de moins à
minimiser.

### 3.3 Les requêtes, et l'invariant du plafond

Quatre sources, une limite : **on charge `limite` entrées par source, et le
mélange en garde `limite`.**

C'est exact, pas approximatif : une entrée qui appartient aux `limite` plus
récentes de l'union appartient forcément aux `limite` plus récentes de **sa**
source. Prendre moins par source (par exemple 5 chacune pour en afficher 30)
donnerait un résultat faux dès qu'une source domine une période. L'invariant est
énoncé ici parce qu'il sera **testé**.

- `getNouvellesVenues(limite)` — existe, inchangée.
- `listPublicationsRecentes(limite)` — existe, inchangée (elle tronque déjà
  `corps` à un caractère, exactement ce dont une carte a besoin).
- `getScenesRecentes(limite, aujourdhui)` — **nouvelle**, écrite dans
  `agenda-public.ts` : même table, même exclusion des talks d'origine Tremplin,
  même filtre `status = 'publie'` que `getScenesPubliques`. Elle ajoute deux
  conditions : date **strictement passée** et date **exacte** (`YYYY-MM-DD`) —
  une annonce imprécise (« courant 2026 ») n'a pas de jour où se ranger dans un
  fil. `LIMIT` en SQL : le fil n'a pas besoin des dizaines de lignes que
  `/agenda` affiche.
- `filPlateforme(limite)` — en mémoire.

**Coût sur le tableau de bord.** `/mon-espace` est `force-dynamic` et lance déjà
plusieurs lectures. Le fil en ajoute **trois**, toutes plafonnées à 3 lignes,
toutes lancées dans le même `Promise.all` que l'existant. Le fil est
**identique pour tout le monde** (aucune donnée de session n'y entre) : c'est un
candidat naturel à la mise en cache, noté ici comme suite possible et **pas
implémenté en v1** — on ne cache pas avant d'avoir mesuré.

### 3.4 Une colonne, une migration

Le marqueur de visite (§2.2bis) coûte exactement une colonne :

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS fil_ouvert_le TIMESTAMPTZ;
```

`NULL` = jamais ouvert : tout est « nouveau », ce qui est la vérité d'un compte
qui découvre le fil. À porter dans `db/schema.sql` **et** `sync-to-latest.sql`
**et** une migration `db/migrations/NNN_*.sql` (règle du dépôt). Aucune table
nouvelle, aucun index (la colonne n'est jamais un critère de recherche : elle
se lit et s'écrit par `id`).

L'écriture vit dans une fonction dédiée (`marquerFilOuvert(userId)`) appelée
par la page du fil, qui **retourne l'ancienne valeur** (`UPDATE … RETURNING`
la valeur précédente) : un seul aller-retour pour poser la date ET savoir quoi
marquer « Nouveau ».

### 3.5 RGPD et sécurité, en une ligne chacun

- **Rien de privé ne transite.** Les quatre natures dérivent de données déjà
  publiées : l'annuaire, l'agenda public, les publications, le contenu produit.
  Le fil ne connaît pas la personne qui le lit, donc il n'y a pas de périmètre
  à garder ni de fuite possible par confusion de rôle.
- **Une fiche retirée disparaît du fil**, y compris rétroactivement, parce que
  les deux requêtes qui nomment quelqu'un filtrent `status = 'publie'` (déjà le
  cas pour les venues, à répliquer pour les scènes). C'est la propriété la plus
  importante du lot : **elle sera testée**.
- Aucun e-mail n'est sélectionné, nulle part. Aucun `SELECT *`.
- La page est `robots: { index: false }` comme le reste de l'espace.

### 3.6 Tests (TDD, rouge d'abord)

| Ce qu'on couvre | Où |
|---|---|
| `fusionnerFil` : tri antichronologique, départage déterministe, plafond, invariant « `limite` par source » | `fil-communaute.test.ts` (pur, sans base) |
| Dégradation : une source en panne laisse les autres | idem |
| `getScenesRecentes` : fiche retirée exclue, date imprécise exclue, date future exclue | `fil-chargement.integration.test.ts` (base) + test de la requête |
| Rendu : les 4 natures, un lien nommé par entrée, `<time datetime>`, nature en toutes lettres | `fil-espace.test.tsx` |
| `/mon-espace` : section absente si le fil est vide, présente sinon, 3 entrées maxi | `mon-espace-adaptatif.test.tsx` |
| a11y axe sur la page et la section | `a11y-axe-espace.test.tsx` |
| Typographie française des entrées statiques | `french-spelling.test.ts` (étendu à `fil-plateforme.ts`) |

## 4. Revue de conception — RGAA / UX

Passée **avant** le code, sur la conception ci-dessus. Ce qui suit est
contraignant pour l'implémentation.

### 4.1 Structure et sémantique

- La section du tableau de bord est une `<section aria-labelledby>` de plus sur
  une page qui en compte déjà quatre au maximum. On reste sous le seuil de
  « peu de régions par page » (le cap : charge cognitive). **Elle ne s'ajoute
  qu'après « À venir » et « Ma fiche »** : l'ordre de lecture au lecteur
  d'écran est l'ordre des priorités.
- Le fil est une **liste** : `<ul role="list">` (le `role` explicite, comme
  partout dans le dépôt, parce que la remise à zéro Tailwind fait perdre la
  sémantique de liste à VoiceOver). Une entrée = un `<li>`.
- La page groupe par mois avec le **même** en-tête collant que
  `/mon-espace/agenda` (`sticky top-barres`), donc calé sous les deux barres du
  site : pas de titre masqué au défilement (WCAG 2.4.11).
- Un seul `h1` par page (`ListPageTemplate` s'en charge), `h2` pour les mois,
  `h3` pour les entrées.

### 4.2 Liens

- **Une entrée = un lien, et le lien couvre la rangée entière** (cible ≥ 44 px,
  registre des erreurs : « la ligne entière est le lien vers la page de
  l'item »). Pas de second lien à droite.
- **Jamais N liens homonymes.** Le fil aligne des destinations différentes ; un
  intitulé « Voir » répété serait un échec RGAA 6.1 / WCAG 2.4.4. Chaque lien
  porte donc un `aria-label` contenant **la phrase entière**, le libellé visible
  restant inclus dedans (WCAG 2.5.3).
- **Pas de `<span class="sr-only">` accolé à un libellé** pour le compléter : le
  calcul du nom accessible recolle les nœuds sans séparateur (« Modifierle
  talk » — déjà payé une fois dans ce dépôt). C'est `aria-label` ou rien.
- Un lien **externe** (une actualité qui pointe hors du site) passe par
  `SiteLink` / `ExternalLink`, qui portent `rel` et la mention « nouvelle
  fenêtre » en `sr-only`. La destination d'un contenu se calcule déjà au seul
  endroit qui en a le droit (`destinationContenu`, `carte-actu.ts`) : le fil
  s'y branche, il ne réinvente pas la règle « article = actualité ».

### 4.3 Dates

- Chaque entrée affiche sa date **en absolu**, dans un
  `<time dateTime="YYYY-MM-DD">`. Pas de « il y a 3 jours » : le relatif se
  périme dans le cache, se traduit mal et ne dit rien à qui revient après six
  mois.
- Sur la page, la date de l'entrée ne répète pas le mois porté par l'en-tête de
  tranche (règle déjà appliquée par `libelleJourScene` sur l'agenda public).

### 4.4 Nature de l'entrée : jamais la couleur seule

Les quatre natures se distinguent par **un mot** (« Annuaire », « Actualité »,
« Sur scène », « Plateforme »), lisible, pas par une pastille de couleur ni par
une icône seule (WCAG 1.4.1, et §9 des principes : au soleil, la couleur ne
survit pas). Une icône peut accompagner le mot, jamais le remplacer, et elle est
`aria-hidden`.

### 4.5 Contraste et lisibilité (§8 et §9 des principes)

- Fond de rangée `navy-light` / bordure `navy-lighter`, comme
  `CarteNouvelleVenue`.
- **Aucune opacité de texte** (`/70`, `/80`) : interdit par §9. Le secondaire
  est `gray-light` **plein**.
- Le titre d'une entrée est ce qu'on doit lire au soleil : `white`, gras.
- **Pas de magenta en texte normal** sur une carte `navy-lighter` (4.12, sous
  AA) : `magenta-light` si l'accent est nécessaire. L'intitulé de nature est du
  petit texte, donc `cyan` ou `gray-light`, jamais `magenta`.
- `focus-visible:ring-2 ring-cyan` sur chaque rangée.

### 4.6 Copie

- Forme **positive**, sans exception : l'état vide de la page dit « Le fil se
  remplit à mesure que la communauté publie », jamais « il n'y a rien ».
- Espace insécable avant `! ? : ;`, pas de cadratin dans le contenu affiché.
- Ton naturel, pas de « au cœur de » ni de « qui a su ».

### 4.7 Ce que la revue a changé dans la conception

1. « Récemment » → **« Dans la communauté »** en titre de section : le premier
   promettait une fraîcheur que le fil ne peut pas garantir les mois creux.
2. La fenêtre glissante de 90 jours a été **retirée** : elle vidait la section
   et emportait avec elle le seul lien vers la page.
3. La formulation « {Nom} est montée sur scène » a été **abandonnée** au profit
   de « {titre du talk} — {Nom} · {conférence} » : l'accord du participe
   genrait une phrase générée pour des personnes dont l'annuaire accueille
   aussi les identités non binaires.
4. Une entrée « scène » ne montre **pas** d'avatar : la requête n'a alors aucune
   raison de lire `users.image`, et c'est une colonne personnelle de moins à
   faire transiter pour un gain décoratif.

## 5. Découpage

### Lot 1 — le fil (ce lot)

- **L0** — cohérence : en-tête de `CHANGELOG.md`.
- **L1** — la lib : `EntreeFil`, `fusionnerFil`, `cleEntree`,
  `getScenesRecentes`, `chargerFil`, `marquerFilOuvert`,
  `src/data/fil-plateforme.ts`, la colonne `fil_ouvert_le` (schéma + sync +
  migration). TDD, sans base pour la partie pure.
- **L2** — la présentation : `FilEntree`, la section de `/mon-espace` (en
  dernier, position fixe), la page `/mon-espace/fil` (pose la date, marque
  « Nouveau »), la ligne aux mentions légales.

### Lot 2 — l'accueil re-fondé (conception à écrire, constat du 2026-08-07)

L'Accueil actuel est un empilement dont **six blocs sont de la pure
navigation** (Mes talks, Mes messages, Mes documents, Mon coaching, l'édition
Tremplin, Retirer ma fiche) — une TROISIÈME navigation qui recopie la barre
basse et le burger. Cible : l'Accueil dit l'état, la barre dit où aller. Trois
piliers : **à faire** (perso) / **à venir** / **le fil** ; les rangées de
navigation redondantes sortent.

Le « À faire » perso (fusion hero-checklist, v1.1 du doc tableau de bord)
absorbe « Créer ma fiche » — écartable (« Aucune fiche pour moi »), ce qui
demande une colonne sur `users`, même famille que `fil_ouvert_le`.

> **Modèle gravé le 2026-08-07 (retour de Cateline).** Le « À faire » perso
> hérite de la doctrine des tâches orga (dérivée des données, résoluble,
> jamais stockée) et le **moteur de tâches est la source unique : l'e-mail de
> rappel en est un CANAL, qui dérive des tâches** — jamais un système
> parallèle avec ses propres conditions. Exemple attendu dans six mois : la
> tâche « Ajouter tes talks à venir » (condition : aucune occurrence future)
> vit dans le moteur ; la liste la montre à l'étage calme, et l'e-mail la
> rappelle à la cadence CHOISIE par la speakeuse — un réglage personnel de
> notifications (une fois par mois, jamais…), qui est la piste v2 déjà notée
> au doc tableau de bord (« rappels personnels par personne : préférences
> utilisateur »). C'est la cadence choisie, opt-out compris, qui rend le
> rappel non harcelant — pas l'absence de tâche.

### Suites possibles, hors périmètre

- Mise en cache du fil (identique pour toutes).
- Dériver la campagne e-mail de `fil-plateforme.ts`.
- Le dossier « navigation globale » (§2.4bis) : barre orga, découvrabilité du
  chemin vers les ateliers, `AccountMenu` sur mobile.
- Mutualiser la présentation des deux agendas (public `SceneCard` / privé
  `EcheanceCard`) par un composant à capacités (§3 des principes) — noté aussi
  en dette.
