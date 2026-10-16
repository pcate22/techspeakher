# Conception — publications (article = actualité) et pages éditables (éditeur, sans IA)

> Conception KISS (pas une implémentation). Répond au besoin : **pouvoir
> publier des actualités/articles et des pages statiques (ex. « À propos »)
> sans passer par le code** (aujourd'hui `src/data/actualites.ts` = édition de
> fichier + déploiement), avec **du SEO**, **un peu de mise en forme** (titres,
> liens, image), un **flux RSS** et une **rediffusion LinkedIn automatique**.
> **Sans IA** : éditeur manuel, aucune génération assistée.
>
> Prérequis lus : `docs/principes-conception-ui.md` (règle d'or, hub-and-spoke,
> wording positif, a11y), `docs/architecture.md`, `docs/roadmap.md` (§ blog /
> ressources), `docs/diffuser-actualites-rss.md` (RSS → LinkedIn déjà tranché).
> Patron dynamique de référence : `docs/conception-registre-conferences.md` +
> `src/lib/conferences.ts` + `src/app/admin/conferences/*` (table DB → lib →
> Server Actions gardées → admin hub-and-spoke).

> **Statut : conception, prête pour le doc d'implémentation.** Décisions actées
> en discussion :
> (1) **article = actualité** : un **seul type « publication »**. Il s'affiche
> toujours comme **carte** (la vue actualité) ; s'il a un **corps**, la carte a
> « Lire la suite » → **page complète** `/articles/[slug]` ; sinon la carte
> pointe vers son **lien**. Plus la **page** statique (slug fixe, ex. « À
> propos »). Donc **2 types** (publication + page), pas 3 ; **une** table.
> (2) **teaser = chapô** rédigé par l'autrice (pas de découpe auto du Markdown) :
> sert 3 fois — carte, description RSS, meta description SEO ;
> (3) **éditeur = Markdown** stocké en base, **barre d'outils** (Titre,
> Sous-titre, Lien, Image, gras, liste) + **aperçu**, **rendu serveur assaini** ;
> (4) **brouillon/publié explicite** (jamais de publication silencieuse) ;
> (5) **image = upload** derrière l'abstraction `media.ts`, adaptateur **Vercel
> Blob** en v1, **cible OVH Object Storage (UE)** documentée, **CSP verrouillée** ;
> (6) **SEO + diffusion** : `generateMetadata`, JSON-LD `Article`, sitemap,
> **flux RSS instantané** (`/feed.xml` existe déjà) et **LinkedIn en no-code**
> (RSS → Zapier/Buffer, aucun code côté app).

## 1. Le besoin, traduit

| Objectif exprimé | Conséquence technique |
|---|---|
| Publier sans Claude Code | Contenu **en base** (Postgres), admin web **gardée orga**, plus de `src/data` à éditer + redéployer |
| SEO | Page `/articles/[slug]`, `generateMetadata` (canonical, OpenGraph), **JSON-LD `Article`**, sitemap, recherche interne |
| Mise en forme (Titre 1/2, liens, photo) | **Corps Markdown** rendu proprement + **une image** |
| Flux RSS + LinkedIn auto | **`/feed.xml`** (déjà là) branché sur la base → instantané ; rediffusion LinkedIn **no-code** (RSS → Zapier/Buffer) |
| Sans IA | Éditeur **manuel** (barre d'outils + aperçu). Aucune génération de texte. |

## 2. Décision de fond : « article = actualité » → un type publication + un type page

Une actualité et un article ne sont **pas deux objets** : une actualité, c'est
la **vue-carte** d'une publication. On unifie.

| | Publication (article = actualité) | Page |
|---|---|---|
| Rôle | Contenu **daté** (annonce courte OU article de fond) | Contenu **fixe** (prose autonome) |
| Vue liste | **Carte** dans `/actualites` + accueil + RSS | Aucune (pas listée) |
| Vue détail | Page `/articles/[slug]` **si** elle a un corps | Sa page à **slug fixe** (ex. `/a-propos`) |
| Daté / listé | Oui (`publie_le`, tri, RSS, JSON-LD `Article`) | Non |
| Éditeur | **Éditeur partagé** (Markdown) | **Éditeur partagé** (Markdown) |
| SEO | Fort | Moyen (page stable) |

**La publication, un seul objet, trois affichages selon son contenu :**

- **carte** (toujours) : `titre` + `chapô` + date + `tag` ;
- **action de la carte** :
  - a un **corps** → bouton **« Lire la suite »** → `/articles/[slug]` (page complète sur le site) ;
  - sinon a un **lien** (interne/externe) → la carte pointe là (comme les cartes Meetup/LinkedIn actuelles) ;
  - sinon → simple carte d'annonce (chapô seul) ;
- **flux RSS** : toute publication publiée y entre, `description` = `chapô`.

Ça remplace **à la fois** l'actualité et l'article de la conception précédente,
**supprime** la table `actualites` séparée, et évite toute « passerelle
afficher-aussi-en-actu » (c'est déjà la même chose).

La **page** reste distincte : une prose autonome (pas datée, pas dans la liste
d'actus), activée **au cas par cas** (cf. §2.1).

### 2.1 Pages éditables : la frontière avec le code

Convertir une page codée en page éditable = **échanger un gabarit sur-mesure
contre une mise en page prose**. Règle :

- **Éditable** = page surtout **textuelle** (bons candidats v1 : « À propos »,
  « Mentions légales »).
- **Reste codée** = page à **gabarit spécifique / interactif** : accueil,
  Tremplin, annuaire, contact. On ne met en CMS que la prose.
- **Option hybride** (différée, §13) : une page codée peut inclure **une région
  de corps éditable** (texte piloté par le CMS dans un shell codé) sans tout
  basculer — utile si « À propos » veut garder un hero mais un texte éditable.

## 3. Modèle de données

Discipline schéma (`CLAUDE.md`) : **`db/schema.sql`** + **`db/sync-to-latest.sql`**
(idempotent) + migration **`db/migrations/036_contenus.sql`**. **Une** table.

```
contenus
  id           serial primary key
  type         'publication' | 'page'
  slug         text unique not null        -- slugify(titre), jumelé SQL/TS (lib/slug)
  titre        text not null
  chapo        text                        -- teaser carte + description RSS + meta SEO
  corps        text not null default ''    -- Markdown ; VIDE = publication d'annonce/lien
  image_url    text
  image_alt    text                        -- OBLIGATOIRE si image_url présent
  categorie    text                        -- publication : 'Meetup & Talk'|'Behind the Scenes'|'Tremplin'|'Communauté'
  tag          text                        -- publication : 'À venir'|'En cours'|'Passé'
  lien         text                        -- publication : lien interne (optionnel)
  lien_externe text                        -- publication : lien externe (optionnel)
  statut       'brouillon' | 'publie'      -- défaut brouillon
  publie_le    date                        -- publication : date affichée + tri + RSS ; page : NULL
  maj_le       timestamptz not null default now()
```

- `slug` unique sur toute la table → pas de collision publication/page.
- `slugify` : **réutilise `src/lib/slug.ts`** (extrait des conférences, jumelage
  SQL/TS testé — livré au lot 1).
- Normalisation au bord (`principes-conception-ui.md` §7) : `mapRow` unique dans
  `src/lib/contenus.ts`.
- Champs `categorie`/`tag`/`lien`/`lien_externe` n'ont de sens que pour une
  `publication` (NULL pour une `page`) — nullable, pas de sous-table.

**Seed** : `src/lib/contenus-seed.ts` insère les entrées de
`src/data/actualites.ts` comme **publications** (idempotent, patron
`conference-seed.ts`). Les actus-lien actuelles → publications sans corps, avec
`lien`/`lien_externe`. Après seed, la **base est la source unique** ;
`actualites.ts` reste la graine. `parseFrenchDate` déplacé en `lib` (cf. doc
d'implémentation).

## 4. L'éditeur (Markdown, barre d'outils, aperçu) — sans IA

- **Corps Markdown** en base. Portable, testable, pas de HTML brut.
- **Barre d'outils** dont les boutons **insèrent** le Markdown (Titre,
  Sous-titre, Lien, Image, gras, liste) → syntaxe masquée pour une non-tech.
- **Aperçu** : **onglet « Écrire / Aperçu »** (jamais côte à côte sur mobile,
  cf. §15).
- **Rendu serveur assaini** : `react-markdown` + `rehype-sanitize`, allow-list
  stricte (`p h2 h3 strong em a ul ol li blockquote img`), liens externes
  `rel="noopener"` + `sr-only` « nouvelle fenêtre ». Config unique partagée
  (rendu public + aperçu).

### 4.1 Titres : mapping SEO/a11y

La page a **déjà** son `<h1>` (le `titre`). Un seul `<h1>`/page. Donc :
« Titre 1 » → **`<h2>`**, « Titre 2 » → **`<h3>`**.

## 5. SEO + diffusion (RSS, LinkedIn)

- **Routes** : `/articles` (liste des publications publiées **avec corps**) +
  `/articles/[slug]` (détail). Pages à slug fixe (§8). `revalidatePath` à la
  publication (patron conférences), pas de réglage ISR.
- **`generateMetadata`** (publication + page) : `title`, `description` = `chapo`,
  `alternates.canonical`, OpenGraph (image), `robots` (brouillon → `index:false`).
- **JSON-LD `Article`** sur les publications avec corps.
- **Sitemap** : publications + pages publiées (`lastModified` = `maj_le`).
- **Flux RSS** : **`/feed.xml` existe déjà** (`src/app/feed.xml/route.ts`, lit
  aujourd'hui `src/data/actualites`). On le branche sur la base → **instantané**
  (une publication publiée y apparaît sans redéploiement). `description` = chapô.
- **LinkedIn (no-code, déjà tranché `docs/diffuser-actualites-rss.md`)** :
  **RSS → Zapier (ou Buffer) → LinkedIn**. **Rien à coder** côté app : chaque
  publication se reposte automatiquement. On **n'intègre PAS** l'API LinkedIn
  (OAuth, jeton d'organisation à renouveler ~60 j, validation d'accès) : hors
  KISS, aucun gain vs Zapier/Buffer. (cf. revue KISS §14.)
- **Recherche interne** : `search-index.ts` est statique ; l'étendre aux
  publications + pages publiées (lot séparé §12).

## 6. Image : stockage remplaçable (Vercel Blob → OVH à terme)

CSP en **liste de domaines verrouillée**. Décision : **upload** (pas d'URL à
héberger ailleurs), derrière une **abstraction**.

- **`src/lib/media.ts`** : `uploadImage(fichier) → url`. En base on stocke l'URL.
- **v1 : Vercel Blob** — domaine unique `*.public.blob.vercel-storage.com`,
  offre gratuite, déjà sur Vercel. Action gardée `requireOrgaId`, validation
  type/taille, `image_alt` obligatoire.
- **CSP** (`next.config`) : domaine Blob dans `img-src` + `images.remotePatterns`.
- **Cible OVH Object Storage (UE)** : migrer = remplacer l'adaptateur dans
  `media.ts` + ajouter le domaine CSP + migration SQL des URLs existantes.
  Zéro impact éditeur/pages/SEO.

> Pas Google Drive : pas un CDN (lien = page HTML, `uc?export=view` bridé,
> URL instable) — incompatible avec une liste de domaines stable.

## 7. Admin — hub-and-spoke (règle d'or)

- **`/admin/contenus`** : **hub** = liste en **deux sections** (Publications,
  Pages), état brouillon/publié + compteurs, un bouton de création par section.
  Aucun formulaire empilé.
- **`/admin/contenus/[type]/nouveau`** : création (titre + chapô minimum) →
  **PRG** vers la page de l'item.
- **`/admin/contenus/[type]/[slug]`** : **éditeur partagé** (publication/page),
  formulaire pleine page, **CTA collant**, **saisie conservée** sur erreur,
  **confirmation focalisée nominative**, pas de redirection surprise (COGA §9).
  Une publication sans corps est légitime (annonce-lien) : le corps est optionnel.
- **Publication** : geste **explicite** (bouton « Publier » distinct
  d'« Enregistrer »), état en toutes lettres. Évite « publication silencieuse ».
- **Renommage de slug** : change l'URL → redirection + avertissement (patron
  conférences), surtout pour une page rattachée au menu.
- **Suppression** : page/dialog dédié + `ConfirmSubmitButton` (nominatif).
- **Entrée « Contenus »** au tableau de bord `/admin` (`NavRow`, compteur brouillons).

## 8. Public

- **`/actualites`** : lit la **base** (publications publiées, triées par date).
  Composant carte existant réutilisé ; l'action de carte suit §2 (Lire la suite
  / lien / chapô seul).
- **`/articles`** : liste des publications publiées **avec corps** (cartes :
  image, titre, chapô, date). **`/articles/[slug]`** : `<article>`, un seul
  `<h1>`, corps rendu, image légendée, date, fil d'Ariane.
- **Pages** : route racine `/[slug]` sert les contenus de type `page` publiés
  (`getContenuPublieBySlug`, `notFound()` sinon). Les routes statiques et
  `/articles/[slug]` gardent la priorité ; caveat assumé : un slug de page
  identique à une route statique est masqué par celle-ci (collision).
- **Accueil** : cartes « actus récentes » lisent la base — **même source**
  (`listPublications`, 4 plus récentes) et **même mapping** que `/actualites`
  (`src/lib/carte-actu.ts`), donc une actu mène au même endroit où qu'on clique.
  Bloc absent si rien n'est publié (pas de cadre vide).
- **Chip du type de contenu** (`categorie`, via `TagBadge`) sur les trois
  surfaces : carte d'accueil, carte de liste, en-tête d'article. Les interviews
  portent la catégorie **« Behind the Scenes »** (notre marque ; migration 058 a
  renommé les anciennes lignes « Interview »). Corollaire : aucune citation
  vedette codée en dur — l'interview vit une seule fois, dans son article.

## 9. Sécurité / RGPD

- **Server Actions** : `requireOrgaId`, identité via session, autorisation
  re-vérifiée, **Zod** (`contenu-form.ts`), **SQL paramétré**.
- **Sanitisation** du Markdown au rendu (allow-list, pas de `script`/`iframe`/`on*`).
- **Upload** : MIME + taille validés serveur, nom non deviné du client.
- **CSP** élargie au strict domaine de l'hébergeur d'images.
- Pas de données personnelles nouvelles.
- → `/security-review` avant PR (auth + Server Actions + contenu affiché +
  upload), en plus de `/code-review`.

## 10. Accessibilité (RGAA) / wording

- `<article>`, **un seul `<h1>`**, `aria-labelledby`, `focus-visible`,
  `role="alert"`.
- **Alt d'image obligatoire** (bloquant à l'enregistrement).
- Liens externes : `sr-only` « nouvelle fenêtre », `rel="noopener"`.
- **Wording positif** : « Brouillon » / « Publié », jamais « ne … plus … ».
  Typo FR (espace insécable avant `! ? : ;`), pas de cadratins.
- Contraste : paires approuvées (§8 principes), corps plein, magenta réservé
  aplats/titres.

## 11. Tests (TDD)

- **Lib** : `slug` (déjà, lot 1) ; `contenus.ts` (`mapRow`, brouillon exclu des
  lectures publiques, tri publications par `publie_le`, unicité slug).
- **Form** : `contenu-form.ts` (titre requis, alt requis si image, statuts,
  longueur chapô, corps optionnel).
- **Sanitisation** : `<script>`/`onclick`/`iframe` neutralisés (non-régression XSS).
- **Server Actions** : garde d'autorisation, création → brouillon, publication
  explicite, renommage → redirection, suppression confirmée.
- **Public** : brouillon absent (liste, détail 404, sitemap, RSS, recherche) ;
  publication **sans corps** → carte sans page dédiée ; titres → `h2`/`h3`.
- **RSS** : une publication publiée entre dans `/feed.xml` (avec chapô) ; un
  brouillon **non**.
- **E2E** agnostiques aux données ; a11y-axe sur page article + éditeur.

## 12. Découpage de livraison

Chaque lot = une PR testée (rouge → vert), petite et revue isolément.

1. ✅ **`lib/slug.ts`** (extrait de `conferences.ts`, tests d'équivalence). *(livré)*
2. **Socle données** : migration `036` + `contenus.ts` + `contenu-form.ts` +
   `parseFrenchDate` déplacé en lib. Invisible.
3. **Rendu Markdown assaini** : `markdown.tsx` + tests XSS. Isolé.
4. **Admin CRUD** : hub (Publications/Pages) + création + éditeur partagé +
   publier/supprimer + Server Actions gardées.
5. **Public + SEO** : `/articles`, `/articles/[slug]`, pages à slug fixe,
   `generateMetadata`, JSON-LD, sitemap.
6. ✅ **Image** : `media.ts` (Vercel Blob) + CSP + `remotePatterns`. *(livré)*
7. **Actualités & flux** : `/actualites` + accueil branchés sur la base ;
   `feed.xml` lit la base (RSS instantané) ; seed depuis `data/actualites.ts`.
8. **Recherche** : injecter publications + pages publiées dans l'index.
9. **Pages de prose** : migrer « À propos » et « Mentions légales » en type page.

LinkedIn : **aucun lot de code** — configuration Zapier/Buffer sur `/feed.xml`
(guide `docs/diffuser-actualites-rss.md`), une fois le lot 7 en prod.

## 13. Évolutions différées (hors v1)

- **Migration OVH Object Storage** (§6).
- **WYSIWYG** si le Markdown gêne (le corps reste du Markdown).
- **Région éditable dans une page codée** (hybride §2.1).
- **Programmation de publication** (`publie_le` futur).
- **IndexNow** à la publication (le sitemap + RSS suffisent en v1).

## 14. Revue KISS — ce qui a été volontairement retiré

- **« Article = actualité »** : un seul type publication au lieu de deux → une
  table, une lib, un éditeur, un CRUD. **Suppression de la table `actualites`**
  séparée et de la passerelle « afficher-aussi-en-actu » (inutile : c'est déjà
  le même objet).
- **Teaser = chapô** (pas de découpe auto du corps) : le chapô sert **3 fois**
  (carte + RSS + meta), zéro logique de troncature Markdown fragile.
- **LinkedIn en no-code** (RSS → Zapier/Buffer) plutôt que l'API LinkedIn
  intégrée : évite OAuth, jeton d'organisation à renouveler, validation d'accès.
- **RSS déjà existant** réutilisé, pas réécrit (juste branché sur la base).
- Retirés de la v1 : `auteur`, `Ressource` comme catégorie à part, JSON-LD des
  pages, IndexNow, réglage ISR, WYSIWYG, catch-all de routes.
- **Barre d'outils bornée** : Titre, Sous-titre, Lien, Image, gras, liste.

## 15. Revue UX / UI, RGAA et charge cognitive

**Conforme** : règle d'or (hub vs éditeur), un seul `<h1>` (« Titre 1 » →
`<h2>`), brouillon/publié explicite, saisie conservée + CTA collant +
confirmation focalisée, wording positif, contraste, alt obligatoire, liens
externes annoncés.

**Points de vigilance (implémentation) :**

- **Éditeur mobile** : aperçu **jamais côte à côte** → onglet « Écrire /
  Aperçu ». Barre d'outils cibles ≥ 44 px, icône + libellé.
- **Carte de publication** : un **seul** repère d'action clair (« Lire la
  suite » **ou** lien externe, jamais les deux qui se disputent le clic).
- **Renommage de slug** d'une page du menu → redirection + avertissement.
- **Collision de routes** : route explicite pour les pages en v1.
- **Longueur de l'éditeur** : corps en premier, « Réglages » (slug, image,
  catégorie, tag, lien, SEO) repliés dessous ; rester sous ~4 écrans mobile.
- **Markdown pour une non-tech** : lien d'aide court ; réévaluer le WYSIWYG
  (§13) si l'usage coince.
