# Conception fonctionnelle — les contenus publiés entrent dans la recherche (⌘K)

> Statut : **conception fonctionnelle, à valider avant la conception technique.**
> Suite technique : `docs/implementation-recherche-contenus.md`.
> Contexte amont : `docs/conception-articles.md` (« article = actualité »),
> `docs/principes-conception-ui.md` (règle d'or, wording positif).
>
> **Dépendance** : ce lot se pose sur la PR #269 (les actualités de l'accueil
> branchées sur la base) et réutilise sa fonction `toCarteActu`. À coder une fois
> #269 en prod.

## 1. Le constat

La recherche du site (loupe du header, ⌘K) mélange deux sources :

| Source | D'où elle vient | Fraîcheur |
|---|---|---|
| Speakeuses | `/api/search/speakeuses` → base (profils publiés) | **live** |
| Pages, actualités, FAQ | `src/data/search-index.ts`, construit à l'import | **figée au build** |

Depuis que l'éditeur de contenus existe, une orga publie une actualité et la
voit apparaître sur `/actualites` et sur l'accueil. Mais **la recherche continue
d'ignorer ce qu'elle vient d'écrire** : l'index statique est bâti sur
`src/data/actualites.ts`, une graine figée dans le dépôt. Publier ne suffit
donc pas à être trouvable ; il faudrait redéployer, et même un redéploiement
ne suffirait pas, puisque la graine ne bouge plus.

Deuxième défaut, plus ancien : **toutes les actualités de l'index pointent sur
`/actualites`**, la liste. Chercher « Rachel Dubois » et cliquer atterrit sur la
liste complète, à charge de retrouver la carte à l'œil. Or l'interview a sa
page d'article depuis la migration 047.

## 2. Ce que ça change pour qui

- **Une visiteuse** trouve un article par son titre, son chapô ou son contenu,
  et le clic ouvre **l'article**, pas une liste où le chercher à nouveau.
- **Une orga** publie depuis l'éditeur et le contenu est trouvable tout de
  suite, sans redéploiement et sans passer par le code.
- **Personne** ne voit de brouillon dans la recherche.

## 3. Décisions

### 3.1 Ce qui entre dans la recherche

| Contenu | Aujourd'hui | Cible |
|---|---|---|
| Publications **publiées** (`contenus`, `type='publication'`) | graine figée | **base, live** |
| Pages éditoriales **publiées** (`type='page'`) | absentes | **base, live** |
| Pages du site codées en dur (Accueil, À propos, Tremplin…) | index statique | inchangé |
| FAQ du Tremplin (`src/data/tremplin.ts`) | index statique | inchangé |
| Speakeuses | base, live | inchangé |
| Brouillons | absents | **restent absents** |

Les pages éditoriales entrent aussi : une page écrite dans l'éditeur est du
contenu publié comme un autre, et l'en exclure recréerait le défaut du jour
(publier sans être trouvable) sur l'autre moitié de l'éditeur.

### 3.2 Où mène un résultat

**Même règle que la carte d'actualité**, sans la réécrire : la destination vient
de `toCarteActu` (PR #269). Un corps l'emporte sur le lien externe.

| Le contenu a… | Le résultat mène à |
|---|---|
| un corps | sa page d'article `/articles/[slug]` |
| pas de corps, un lien interne | le lien interne |
| pas de corps, **un lien externe seulement** | **le contenu n'entre pas dans la recherche** |
| ni corps ni lien | **le contenu n'entre pas dans la recherche** |

Une **page éditoriale** fait exception : elle mène toujours à sa route
(`/slug`), avec ou sans corps. Elle a une URL vivante dès sa publication, elle
figure au sitemap et l'admin la lie déjà ; l'écarter de la seule recherche
serait la seule surface à la nier.

Les deux exclusions sont des décisions, et la deuxième vient de la revue de
conception :

- **Sans destination**, un résultat est une impasse. Mieux vaut qu'il
  n'apparaisse pas que d'ouvrir une page qui ne dit rien.
- **Vers l'extérieur seulement** : la palette est une liste d'options de
  combobox, pas une liste de liens. Elle ne peut donc pas prévenir qu'on quitte
  le site ni qu'une nouvelle fenêtre s'ouvre, alors que c'est exigé (RGAA 13.2).
  Une annonce-lien purement externe reste visible et cliquable là où elle est un
  vrai lien : sur `/actualites` et sur l'accueil, avec son icône et sa mention
  « nouvelle fenêtre ». Faire de la palette un lanceur de sites tiers demanderait
  de changer sa nature ; ce n'est pas le sujet de ce lot.

### 3.3 Ce qu'on affiche d'un résultat

- **Pastille** : la **catégorie du contenu** (« Meetup & Talk », « Behind the
  Scenes », « Tremplin », « Communauté »), donc le même mot que la chip de la
  carte et de l'en-tête d'article. Un contenu sans catégorie prend « Actualité »
  pour une publication, « Page » pour une page.
- **Titre** : celui du contenu.
- **Aperçu** : la **date** puis le chapô — l'index d'avant datait ses entrées et
  la carte le fait toujours ; sans repère temporel, une pile de « Retour sur le
  meetup » se ressemble. À défaut de chapô, le début du corps ; à défaut de
  tout, l'adresse de destination, pour qu'une option garde sa deuxième ligne et
  dise ce qu'on va ouvrir.
- **Plein-texte indexé mais non affiché** (`keywords`) : le **début du corps**,
  ses **300 premiers caractères**. On retrouve ainsi un article par une phrase
  de son ouverture, comme on retrouve déjà une speakeuse par sa bio. L'extrait
  surligné existant montre alors le passage trouvé, donc on voit pourquoi le
  résultat remonte.

  La borne est un choix de poids, MESURÉ : à 600 caractères, ce champ pesait
  116 Ko bruts (11 Ko compressés) de plus par visiteuse et ajoutait ~4 ms à
  chaque frappe, Fuse cherchant sur le fil principal sans anti-rebond. Un corps
  peut peser 50 000 caractères, et tout indexer enverrait chaque article publié
  à chaque ouverture de la palette. Chercher une phrase enfouie au milieu d'un long
  article ne marchera donc pas. Si le besoin se confirme, la réponse est une
  recherche côté serveur (§6), pas un index client plus gros.

### 3.4 Fraîcheur

Même contrat que les speakeuses : lecture serveur à la demande, réponse gardée
**5 minutes** par le CDN, avec 10 minutes de rattrapage pendant lesquelles le
CDN sert l'ancienne réponse en rafraîchissant derrière. Une publication est donc
trouvable en général sous 5 minutes, au pire sous un quart d'heure, sans
redéploiement. C'est le contrat déjà accepté pour l'entrée d'une speakeuse dans
l'annuaire.

### 3.5 Dégradation

La recherche est un **confort**, jamais un passage obligé. Base indisponible ou
requête en échec → la liste des contenus est vide, **les pages statiques, la FAQ
et les speakeuses restent cherchables**. Aucun message d'erreur : une recherche
qui marche moins bien ne s'annonce pas, elle rend ce qu'elle a.

## 4. Le vocabulaire des pastilles

L'arrivée des catégories réelles élargit le vocabulaire affiché dans la
palette. Chaque valeur de `CATEGORIES` doit avoir sa couleur, sinon la pastille
tombe en gris sans que rien n'échoue.

La couleur dit la **nature** du résultat (une personne, une question, un contenu
du site), pas la catégorie : huit catégories pour trois teintes ne pouvait
produire qu'un regroupement trompeur. Elle reste un **renfort** — le mot est
écrit en toutes lettres, précédé de « Catégorie : » en `sr-only`, jamais porté
par la seule teinte (RGAA 3.1).

**Une porte de sortie permanente** ferme la palette : un lien « Voir toutes les
actualités », hors de la listbox. Il sert deux silences — la recherche sans
résultat, et les annonces dont le lien sort du site, écartées de la palette
(§3.2) donc introuvables ici alors qu'elles vivent sur `/actualites`.

## 5. Cas limites

| Cas | Décision |
|---|---|
| Contenu publié puis repassé en brouillon | sort de la recherche à l'expiration du cache (§3.4) |
| Contenu supprimé | idem : le lien mort vit le temps du cache, pas au-delà |
| Deux contenus de même titre | les deux apparaissent : leurs URL diffèrent, la déduplication porte sur (URL + titre) |
| Une actualité de la graine ET en base | la base gagne : les entrées statiques d'actualités **quittent** l'index |
| Contenu sans chapô | l'aperçu prend le début du corps, coupé sur un mot entier |
| Page éditoriale au slug d'une route codée (ex. `a-propos`) | **refusé à la saisie** : le titre qui produirait cette adresse est rejeté, avec un message qui le dit. Une page enregistrée avant cette garde reste en base mais n'entre pas dans la recherche (elle mènerait à la page codée, pas à elle) |
| Base lente | la palette s'ouvre et cherche dans ce qu'elle a ; rien ne bloque la saisie |
| Plus de 200 contenus publiés | seuls les 200 plus récents sont cherchables (§6). Plafond assumé, pas silencieux : la suite est une recherche serveur |
| Page publiée dont le slug est masqué par une route du code | écartée de la recherche ET du sitemap : son URL sert la route codée, pas son contenu |

## 6. Ce qu'on ne fait pas

- **Pas de recherche côté serveur** (SQL plein-texte, `tsvector`). Le volume est
  de quelques dizaines de contenus : Fuse côté client, déjà en place pour les
  speakeuses, suffit. La palette télécharge la liste entière à la première
  frappe, d'où un **plafond à 200 contenus** (les plus récents) : sans lui, ce
  téléchargement grandirait d'un article à chaque publication, pour toujours.
  Franchir ce seuil est le signal de passer à une recherche serveur, pas
  d'agrandir l'index client.
- **Pas d'index persistant** ni de table de recherche : rien de nouveau à
  stocker, donc rien de nouveau à protéger ni à resynchroniser.
- **Pas de brouillons pour l'orga** dans ⌘K. La palette est publique et
  cacheable ; y verser du non-publié demanderait une réponse par rôle et un
  cache par utilisatrice, pour un gain faible (l'orga a `/actualites` avec son
  filtre « Brouillon »).
- **Pas de recherche dans les documents du Tremplin** ni dans quoi que ce soit
  de privé. La recherche ne montre que ce qui est **déjà public**.
- **Pas de destination hors du site depuis la palette** (§3.2) : il faudrait
  qu'une option de combobox devienne un lien, avec sa mention de nouvelle
  fenêtre. C'est une refonte de la palette, pas ce lot.

## 7. Découpage

1. **Lot 1 — la source** : les contenus publiés deviennent des items de
   recherche (lib + route), avec leur destination et leur catégorie.
2. **Lot 2 — la fusion** : la palette consomme la nouvelle source ; les
   actualités statiques quittent `search-index.ts` ; le vocabulaire des
   pastilles couvre les catégories réelles.

Les deux lots partent ensemble : le lot 1 seul laisserait les doublons entre la
graine et la base.

## 8. Comment on saura que c'est réussi

- Publier une actualité depuis l'éditeur, la chercher dans les 5 minutes : elle
  est là, avec sa catégorie, et le clic ouvre son article.
- La repasser en brouillon : elle disparaît.
- Couper la base : la loupe trouve toujours « Code de conduite » et la FAQ.
