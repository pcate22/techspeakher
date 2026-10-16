# Conception technique — les contenus publiés entrent dans la recherche (⌘K)

> Suite de `docs/conception-recherche-contenus.md` (fonctionnel).
> Statut : **conception technique, à valider avant code.**
>
> **Dépendance** : se pose sur la PR #269, dont on réutilise `toCarteActu`
> (`src/lib/carte-actu.ts`) comme source unique de la destination d'un contenu.

## 1. L'existant, et où se brancher

La palette (`src/components/SearchBar.tsx`) construit son Fuse **une fois**,
à la première recherche :

```ts
fusePromise = Promise.all([import("fuse.js"), fetchSpeakers()])
  .then(([{ default: Fuse }, speakers]) => new Fuse(buildSearchList(speakers), FUSE_OPTIONS))
```

`buildSearchList` (`src/lib/site-search.ts`) fusionne l'index statique et les
speakeuses, puis déduplique. Le point de branchement est donc **là** : une
deuxième source dynamique, fusionnée au même endroit.

Le patron à copier existe déjà en entier pour les speakeuses :

| Rôle | Speakeuses | Contenus (à créer) |
|---|---|---|
| Requête SQL | `getPublishedAnnuaire()` | `listContenusPourRecherche()` |
| Mapping → `SearchItem` | `getSpeakerSearchItems()` | `getContenuSearchItems()` |
| Route | `/api/search/speakeuses` | `/api/search/contenus` |
| Consommation | `fetchSpeakers()` | `fetchContenus()` |

**Deux routes plutôt qu'une.** Fusionner les deux sources dans un seul
`/api/search` ferait un aller-retour au lieu de deux. On garde deux routes :
c'est le patron déjà en place, chaque source dégrade seule, et les deux fetches
partent en parallèle dans le `Promise.all` existant, donc la latence perçue ne
bouge pas. Le coût réel est un round-trip HTTP de plus, tous deux servis par le
CDN.

## 2. Le poids du corps : la vraie contrainte

Un corps peut peser **50 000 caractères** (`CORPS_MAX`). Indexer le plein-texte
naïvement enverrait tous les corps publiés à chaque ouverture de la palette.
C'est exactement le défaut que la revue de la PR #269 a corrigé sur l'accueil.

**Décision : la troncature se fait en SQL**, jamais après coup.

```sql
SELECT id, type, slug, titre, chapo, categorie, publie_le,
       lien, lien_externe, lien_label,
       left(corps, 600)   AS extrait_corps,
       btrim(corps) <> '' AS a_corps
  FROM contenus
 WHERE statut = 'publie' AND type IN ('publication', 'page')
 ORDER BY publie_le DESC NULLS LAST, id DESC
```

- `left(corps, 600)` : de quoi porter le chapeau et l'accroche d'un article.
  Ordre de grandeur du payload : quelques dizaines de contenus × ~0,6 Ko, soit
  la même échelle que la réponse speakeuses (bios + talks) déjà acceptée.
- `a_corps` est calculé **en base** : `toCarteActu` a besoin de savoir s'il y a
  un corps (règle « un corps l'emporte sur le lien »), pas de le lire. On évite
  de transporter 50 000 caractères pour tester une chaîne vide, comme
  `listPublicationsRecentes` le fait déjà.

Conséquence assumée : on cherche dans les **600 premiers caractères** du corps,
pas dans tout l'article (fonctionnel §3.3).

La coupe SQL tombe au milieu d'un mot. Pour le **plein-texte indexé** c'est sans
effet (Fuse cherche des sous-chaînes). Pour l'**aperçu affiché** quand le chapô
manque, on retaille sur la dernière espace et on suffixe « … » : un aperçu qui
finit sur un mot tronqué se lit comme un bug d'affichage.

## 3. Le code

### 3.1 `src/lib/contenus.ts` — la lecture

```ts
/** Ce que la recherche a besoin de savoir d'un contenu publié. */
export interface ContenuRecherche {
  type: ContenuType;
  slug: string;
  titre: string;
  chapo: string | null;
  categorie: string | null;
  /** Début du corps (tronqué en SQL) : plein-texte indexé, jamais affiché brut. */
  extraitCorps: string;
  /** Le contenu a-t-il un corps ? Calculé en base (le corps entier ne transite pas). */
  aCorps: boolean;
  lien: string | null;
  lienExterne: string | null;
  lienLabel: string | null;
}

export async function listContenusPourRecherche(): Promise<ContenuRecherche[]>;
```

Résilience : `.catch(siSchemaEnRetard({ rows: [] }))`, comme ses voisines — une
base en retard de migration rend une liste vide, pas une erreur 500.

### 3.2 `src/lib/search.ts` — le mapping

Le fichier porte déjà les sources de recherche **en base** (aujourd'hui les
speakeuses). On y ajoute `getContenuSearchItems()` plutôt que de créer un
`search-contenus.ts` : même rôle, même contrat, même dégradation.

```ts
export async function getContenuSearchItems(): Promise<SearchItem[]>
```

- **`url` et destination** : `toCarteActu` décide. Sont **écartés** (§3.2 du
  fonctionnel) les contenus dont `href` est `null` **et** ceux dont
  `externe === true` : la palette ne mène qu'à des destinations internes.
  Un seul prédicat, `estDestinationInterne(carte)`, testé à part.
  Les pages (`type='page'`) mènent à `/${slug}` — c'est bien la route publique
  d'une page éditoriale (`src/app/[slug]/page.tsx`, vérifié). `toCarteActu` ne
  connaît que les publications, donc la page se mappe à côté, en trois lignes,
  sans lui faire porter un cas qui n'est pas le sien.
- **`category`** : `categorie` du contenu ; repli `"Actualité"` (publication) ou
  `"Page"` (page). Le vocabulaire des chips devient celui des pastilles.
- **`description`** : `chapo`, à défaut le début de `extraitCorps` en texte brut.
- **`keywords`** : `extraitCorps` en texte brut (non affiché, indexé faiblement).
- `try/catch` → `[]`, comme `getSpeakerSearchItems`.

### 3.3 `src/lib/texte-markdown.ts` — le texte brut

Petite fonction pure, testée seule : `texteBrut(md: string): string`. Elle
retire ce qui parasiterait la recherche et l'aperçu — blocs de code, images,
syntaxe de lien (en gardant le libellé), marqueurs de titre, d'emphase, de
citation et de liste — puis normalise les blancs. Volontairement naïve : c'est
de l'indexation, pas du rendu ; le rendu réel passe par `react-markdown` +
`rehype-sanitize` et ne change pas.

### 3.4 `src/app/api/search/contenus/route.ts`

Copie conforme de la route speakeuses, mêmes en-têtes :

```ts
export const dynamic = "force-dynamic";
// Cache-Control: public, s-maxage=300, stale-while-revalidate=600
```

`force-dynamic` pour la même raison qu'ailleurs : un build sans base figerait un
index vide. Aucune donnée personnelle ne transite : ce sont des contenus
éditoriaux publiés.

### 3.5 `src/components/SearchBar.tsx`

```ts
fusePromise = Promise.all([import("fuse.js"), fetchSpeakers(), fetchContenus()])
  .then(([{ default: Fuse }, speakers, contenus]) =>
    new Fuse(buildSearchList([...speakers, ...contenus]), FUSE_OPTIONS))
```

`buildSearchList` garde sa signature (une liste de sources dynamiques à
fusionner à l'index statique) : rien à changer dans `site-search.ts` hormis le
commentaire.

**Pastilles** : `categoryColors` gagne les catégories réelles. Un test verrouille
la couverture — chaque valeur de `CATEGORIES` doit avoir sa couleur, sinon la
pastille passe en gris sans que rien n'échoue (même garde que `TagBadge`, posée
par `data-integrity.test.ts`).

### 3.6 `src/data/search-index.ts` — le nettoyage

Les deux blocs d'actualités statiques (`allActualites`, `behindTheScenes`)
**sortent** : ils feraient doublon avec la base, avec en prime la mauvaise URL
(`/actualites` au lieu de l'article). Restent les pages du site codées en dur et
la FAQ. `CATEGORY_PRIORITY` gagne les catégories réelles ; « Speakeuse » reste
au-dessus.

`src/data/actualites.ts` **ne bouge pas** : il reste la graine du seed
(`seedContenusAction`).

## 4. Tests (TDD, écrits avant)

| Fichier | Neuf ? | Ce qu'il verrouille |
|---|---|---|
| `texte-markdown.test.ts` | neuf | titres, emphase, liens (libellé gardé, URL retirée), images, blocs de code, blancs normalisés |
| `search-contenus.test.ts` | neuf | mapping : destination (corps > lien interne), contenu sans destination écarté, **contenu purement externe écarté**, catégorie et son repli, aperçu (chapô, sinon début de corps coupé sur un mot), keywords, panne base → `[]` |
| `search-bar.test.tsx` | neuf | les deux fetches partent ; l'un en échec laisse l'autre servir ; une pastille par catégorie réelle |
| `contenus-db.integration.test.ts` | ajout | `listContenusPourRecherche` : brouillons absents, pages ET publications présentes, corps tronqué, `aCorps` juste sur corps vide / non vide |
| `site-search.test.ts` | ajout | fusion des deux sources dynamiques, déduplication inchangée |
| `search-route.test.ts` | ajout | la route contenus rend du JSON et ses en-têtes de cache |
| `search-index.test.ts` | maj | plus aucune entrée d'actualité statique ; pages et FAQ intactes |

Les tests d'intégration tournent sur PGlite (patron existant), donc pas de base
en CI.

## 5. Risques et parades

| Risque | Parade |
|---|---|
| Payload qui enfle avec le nombre d'articles | troncature SQL ; au-delà de ~200 contenus, passer à une recherche serveur (`/api/search?q=`), déjà envisagé pour les speakeuses |
| Un brouillon fuite dans la palette | `WHERE statut = 'publie'` en SQL **et** test d'intégration dédié |
| Résultat qui mène à une impasse | contenu sans destination écarté au mapping, test dédié |
| Sortie du site sans prévenance (RGAA 13.2) | destinations externes écartées, test dédié |
| Lien interne hérité déguisé en URL externe (`//evil.test`) | `cheminInterne` replie les séparateurs de tête, donc rend toujours un chemin que `isSafeInternalPath` accepte |
| Page publiée que personne ne peut atteindre (slug masqué par une route) | `SLUGS_RESERVES` refuse le titre à la saisie ; la recherche écarte les lignes antérieures à la garde |
| Pastille grise sur une catégorie oubliée | test de couverture `CATEGORIES` → couleur |
| Deux fetches au lieu d'un | parallèles dans le `Promise.all` existant, tous deux cachés 5 min |

## 5 bis. Revue de conception — ce qu'elle a changé

Passée avant d'écrire la moindre ligne, avec un angle RGAA / UX explicite.

| Finding | Effet |
|---|---|
| **RGAA 13.2** — une option de combobox ne peut pas annoncer « nouvelle fenêtre », or le fonctionnel prévoyait des destinations externes | périmètre réduit : les contenus purement externes n'entrent pas dans la recherche (fonctionnel §3.2 et §6) |
| Le fonctionnel promettait « le corps », le technique tronquait à 600 caractères | promesse corrigée dans le fonctionnel, avec la raison (poids) et l'issue (recherche serveur) |
| « Trouvable au plus tard 5 min » ignorait `stale-while-revalidate` | fraîcheur réécrite : 5 min en général, un quart d'heure au pire |
| Coupe SQL au milieu d'un mot, visible dans l'aperçu sans chapô | retaille sur la dernière espace + « … » |
| Destination d'une page éditoriale supposée `/${slug}` | vérifiée dans `src/app/[slug]/page.tsx` ; le conflit de slug avec une route codée est documenté en cas limite |

## 5 ter. Revue qualité — ce qu'elle a changé

Quatre relectures parallèles (réutilisation, simplification, efficacité,
altitude) après le code, avant la PR.

| Finding | Effet |
|---|---|
| **Zod dans le bundle client** : lire `CATEGORIES` depuis `contenu-form` (schémas Zod construits au niveau module) le tirait, via `search-index` → `site-search` → `SearchBar`, dans le header de **toutes les pages publiques** | le vocabulaire déménage dans `src/data/categories-contenus.ts`, module sans dépendance ; `contenu-form` le réexporte, aucun import existant ne bouge |
| **`texteBrut` écrasait les espaces insécables** que `uneSeuleLigne` préserve exprès (typographie française du projet) | délègue à `uneSeuleLigne` ; un test verrouille « présenter ? » |
| **La route d'une page réécrite** à côté de `destinationContenu` : 4ᵉ copie de la règle, et elle exigeait un corps alors qu'une page publiée sans corps a déjà une URL, un sitemap et un lien d'admin | `destinationContenu` connaît le `type` ; `search-contenus` ne garde que la politique d'admission (externe, sans destination) |
| **Payload non borné en nombre d'items** (borné par item seulement) | `LIMIT` à 200, constante documentée, plafond écrit dans le fonctionnel |
| **`keywords` redoublait l'aperçu** quand le chapô manque : même texte envoyé deux fois et scanné deux fois par Fuse à chaque frappe | omis quand l'aperçu le montre déjà en entier |
| En-tête de cache dupliqué entre les deux routes | `ENTETES_CACHE_RECHERCHE` (`src/lib/search-cache.ts`) |
| `CarteActu` redéclarait les 4 champs de `Destination` ; doc orpheline laissée par l'extraction ; garde et `Record` redondants ; regex de filet horizontal en partie inatteignable | nettoyés |
| Test de couverture des couleurs logé dans `search-index.test.ts` | déplacé dans `search-bar.test.tsx` |

**Écarté volontairement** : unifier `categoryColors` (palette) et `COULEURS_TAG`
(`TagBadge`) en une table catégorie → jeton partagée. C'est la bonne forme —
`ChipGroup` la montre déjà — mais elle touche `TagBadge` et `ChipGroup`, hors de
ce lot. À porter en dette technique.

**Écarté aussi** : remplacer `btrim(corps)` par `btrim(left(corps, 600))` dans la
requête. Ça éviterait de détoaster les gros corps côté serveur, mais un corps de
600 blancs suivis de texte serait alors vu « sans corps » par la recherche et
« avec corps » par la carte. Une incohérence entre deux surfaces coûte plus cher
que ce CPU, sur un chemin caché 5 minutes.

## 6. Ce qui ne change pas

- `FUSE_OPTIONS`, `rankResults`, l'extrait surligné, la déduplication.
- La combobox, son `aria-activedescendant`, l'annonce du nombre de résultats.
- `/api/search/speakeuses` et `getSpeakerSearchItems`.
- Le rendu Markdown des articles.
