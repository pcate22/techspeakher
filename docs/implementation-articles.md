# Implémentation — publications (article = actualité) et pages éditables

> Pendant technique de `docs/conception-articles.md` (à lire d'abord). Ici : le
> SQL exact, les signatures de lib, les contrats des Server Actions et leurs
> gardes, le plan de rendu/sanitisation, et la liste de tests par fichier. Suit
> le patron `docs/implementation-registre-conferences.md` (table → lib → actions
> gardées → admin hub-and-spoke).
>
> ⚠️ `AGENTS.md` : Next 16 a des ruptures. Lire `node_modules/next/dist/docs/`
> avant d'écrire du code de routing / metadata / RSC.

> **Statut : revue technique soldée (§9), modèle unifié « article = actualité ».**
> **Lot 1 (`lib/slug.ts`) livré** (PR dédiée) ; **lot 6 (image, §7) livré**
> (`src/lib/media.ts`, Vercel Blob) ; reste : lot 8 (recherche), lot 9 (pages de
> prose).

## 0. Décisions techniques structurantes (les vrais risques)

### 0.1 Dépendances nouvelles

Le repo n'a **que `zod`** côté contenu (aucune lib Markdown, aucune sanitisation,
pas de `@vercel/blob`). La CI a un job **Security audit** → toute dep ajoutée
doit être épinglée et propre à l'audit.

- **Rendu Markdown** : `react-markdown@^10` + `rehype-sanitize@^6`.
  - **Compat vérifiée (revue §9)** : `react-markdown` 10.1.0 (peer `react >=18`
    → React 19 OK), `rehype-sanitize` 6.0.0. Les deux sont **ESM-only** — Next 16
    (RSC) et **Vitest** (natif ESM) le gèrent. Épingler, revérifier l'audit CI.
  - Choix : rend vers des **éléments React** (jamais `dangerouslySetInnerHTML`),
    sanitisation par **schéma allow-list** audité. Posture la plus sûre en React.
  - Alternative écartée : `marked` + `DOMPurify` (DOMPurify exige un DOM serveur
    → `jsdom`, dépendance lourde ; `sanitize-html` possible mais on manipule du
    HTML string au lieu d'un arbre React).
  - **Config unique partagée** `src/lib/markdown.tsx` : les mêmes `components` +
    schéma `rehype-sanitize` servent le **rendu serveur** (pages publiques) ET
    l'**aperçu client** (éditeur). Un seul endroit à auditer.
- **Upload image (lot 3)** : `@vercel/blob@^2` (2.6.1, ESM). Isolé dans
  `src/lib/media.ts` (adaptateur), rien d'autre ne l'importe.

> Si l'ajout de deps est jugé trop lourd en revue : repli documenté = sous-ensemble
> Markdown rendu à la main (titres/gras/liens/listes/image), refusé par défaut
> (réinvente un parseur, surface de bugs). À trancher en §9.

### 0.2 Périmètre Markdown rendu (allow-list figée)

Balises autorisées, rien d'autre : `p h2 h3 strong em a ul ol li blockquote img`.
- `a` : `href` (http/https/mailto uniquement), pas de `javascript:`. Liens
  externes → `target="_blank"` + `rel="noopener noreferrer"` + `sr-only`
  « nouvelle fenêtre » ajoutés par le composant `a` custom.
- `img` : `src` (domaines CSP), `alt` (obligatoire côté saisie). Pas de `srcset`.
- Interdits explicitement : `h1` (réservé au titre de page), `script`, `style`,
  `iframe`, `svg`, attributs `on*`, `class`/`id` arbitraires.
- « Titre 1 » de la barre d'outils insère `##` (→ `h2`), « Titre 2 » `###` (→ `h3`).

### 0.3 Diffusion : RSS existant, LinkedIn en no-code

- `src/app/feed.xml/route.ts` **existe déjà** (RSS 2.0, lit `data/actualites`).
  Aucune nouvelle dépendance : on le rebranche sur `listPublications()`.
- **LinkedIn : rien à coder.** RSS → Zapier (ou Buffer) → LinkedIn, en no-code
  (guide `docs/diffuser-actualites-rss.md`, déjà rédigé). On **écarte** l'API
  LinkedIn intégrée (appli OAuth, jeton d'organisation à renouveler ~60 j,
  validation d'accès Products) : hors KISS, aucun gain vs Zapier/Buffer.

## 1. Base de données — migration `036_contenus.sql`

Idempotente (patron 027). Mettre à jour **`db/schema.sql`** + **`db/sync-to-latest.sql`** + ce fichier (drift-test).

**Une seule table** : « article = actualité » → un type `publication` (+ le type
`page`). Pas de table `actualites` séparée.

```sql
-- Migration 036 — Contenus éditoriaux : publications (article = actualité) + pages.
-- Voir docs/conception-articles.md et docs/implementation-articles.md.

CREATE TABLE IF NOT EXISTS contenus (
  id           SERIAL PRIMARY KEY,
  type         TEXT NOT NULL,                       -- 'publication' | 'page'
  slug         TEXT NOT NULL UNIQUE,                -- slugify(titre), jumelé SQL/TS (lib/slug)
  titre        TEXT NOT NULL,
  chapo        TEXT,                                -- teaser carte + description RSS + meta SEO
  corps        TEXT NOT NULL DEFAULT '',            -- Markdown ; VIDE = publication d'annonce/lien
  image_url    TEXT,
  image_alt    TEXT,
  categorie    TEXT,                                -- publication : 'Meetup & Talk'|'Interview'|'Tremplin'|'Communauté'
  tag          TEXT,                                -- publication : 'À venir'|'En cours'|'Passé'
  lien         TEXT,                                -- publication : lien interne (optionnel)
  lien_externe TEXT,                                -- publication : lien externe (optionnel)
  lien_label   TEXT,                                -- libellé du lien externe (optionnel)
  statut       TEXT NOT NULL DEFAULT 'brouillon',   -- 'brouillon' | 'publie'
  publie_le    DATE,                                -- publication : date affichée + tri + RSS ; page : NULL
  maj_le       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT contenus_type_ck   CHECK (type IN ('publication','page')),
  CONSTRAINT contenus_statut_ck CHECK (statut IN ('brouillon','publie')),
  -- Une image sans alt est interdite (a11y non négociable, défense en base).
  CONSTRAINT contenus_img_alt_ck CHECK (image_url IS NULL OR image_alt IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_contenus_type_statut ON contenus (type, statut);
CREATE INDEX IF NOT EXISTS idx_contenus_publie_le   ON contenus (publie_le);
```

Notes :
- `corps` `DEFAULT ''` : une publication naît **brouillon** (titre + chapô), corps
  rempli ensuite ; **corps vide reste légitime** (publication d'annonce qui pointe
  vers `lien`/`lien_externe`, sans page dédiée).
- `slug UNIQUE` sur toute la table → pas de collision publication/page (routage §5).
- La contrainte `img_alt` double la validation Zod (§3) : défense en profondeur.
- `categorie`/`tag`/`lien*` n'ont de sens que pour une `publication` (NULL pour
  une `page`) — nullable, pas de sous-table (KISS).

Seed : `src/lib/contenus-seed.ts` (patron `conference-seed.ts`) insère les entrées
de `src/data/actualites.ts` comme **publications** (`type='publication'`, corps
vide, `lien`/`lien_externe` repris) **si la table est vide** (idempotent),
déclenché par une action orga (bouton « Amorcer », comme `seedCatalogueAction`).
`parseFrenchDate` + `MONTHS` sont **déplacés** de `src/data/actualites.ts` vers
`src/lib/actualites.ts` (le tri des dates textuelles vit côté lib ; on évite un
import `lib → data`) ; `data/actualites.ts` redevient de la donnée pure (graine).
Ses tests suivent.

## 2. `src/lib/contenus.ts` — accès DB

```ts
export type ContenuType = "publication" | "page";
export type Statut = "brouillon" | "publie";

export interface Contenu {
  id: number; type: ContenuType; slug: string; titre: string;
  chapo: string | null; corps: string;
  imageUrl: string | null; imageAlt: string | null;
  categorie: string | null; tag: string | null;
  lien: string | null; lienExterne: string | null; lienLabel: string | null;
  statut: Statut; publieLe: string | null; majLe: string;
}

// slug : réutilise `src/lib/slug.ts` (extrait de conferences.ts au LOT 1, livré ;
// fonction pure, jumelage SQL/TS testé). PAS d'import de `conferences.ts`.
export { slugify } from "@/lib/slug";

function mapRow(r: ContenuRow): Contenu; // normalisation au bord (une fois)

// Lectures publiques (statut='publie' uniquement) :
export function getContenuPublieBySlug(slug: string): Promise<Contenu | null>;
export function listPublications(): Promise<Contenu[]>;          // ORDER BY publie_le DESC — /actualites, accueil, RSS
export function listArticlesPublies(): Promise<Contenu[]>;       // publications AVEC corps — /articles
export function listPagesPubliees(): Promise<Pick<Contenu,"slug"|"majLe">[]>; // sitemap

// Lectures admin (tous statuts) :
export function getContenuById(id: number): Promise<Contenu | null>;
export function listContenus(type: ContenuType): Promise<Contenu[]>;

// Écritures (SQL paramétré) — renvoient un résultat, jamais throw pour l'unicité :
export function createContenu(input: CreateContenuInput):
  Promise<{ ok: true; id: number; slug: string } | { ok: false; reason: "slug" }>;
export function updateContenu(id: number, input: UpdateContenuInput):
  Promise<{ ok: true; slug: string } | { ok: false; reason: "slug" | "introuvable" }>;
export function setStatut(id: number, statut: Statut): Promise<void>;
  // publie : pose publie_le = CURRENT_DATE si NULL et type='publication' ; brouillon le laisse
export function deleteContenu(id: number): Promise<void>;
```

- `listPublications` (toutes) vs `listArticlesPublies` (celles à corps) : la carte
  d'une publication sans corps pointe vers son `lien`/`lien_externe` (pas de page
  `/articles/[slug]`), cf. conception §2.
- Unicité slug : `INSERT … ON CONFLICT (slug) DO NOTHING RETURNING id` →
  `ok:false, reason:"slug"` si rien renvoyé (patron `createConference`).
- `maj_le = now()` à chaque écriture.

## 3. `src/lib/contenu-form.ts` — validation (Zod)

Réutilise les helpers existants (`firstErrors`, `formString`, `optionalText`,
`optionalUrl` de `profile-form`).

```ts
const TITRE_MAX = 160, CHAPO_MAX = 300, CORPS_MAX = 50_000;

const titreField = z.string().trim().min(2, "Titre requis").max(TITRE_MAX)
  .refine((v) => slugify(v).length > 0, "Le titre doit contenir des lettres ou chiffres.");

const contenuSchema = z.object({
  type: z.enum(["publication", "page"]),
  titre: titreField,
  chapo: optionalText(CHAPO_MAX),
  corps: z.string().max(CORPS_MAX).default(""),   // vide autorisé (publication-lien)
  imageUrl: optionalUrl,                 // http/https
  imageAlt: optionalText(200),
  // Champs publication (ignorés/NULL pour une page) :
  categorie: z.enum(["Meetup & Talk","Interview","Tremplin","Communauté"]).optional(),
  tag: z.enum(["À venir","En cours","Passé"]).optional(),
  lien: optionalText(300),               // interne
  lienExterne: optionalUrl,
  lienLabel: optionalText(120),
}).refine((d) => !d.imageUrl || (d.imageAlt && d.imageAlt.length > 0), {
  message: "Un texte alternatif est requis avec une image.", path: ["imageAlt"],
});

export function parseContenuForm(fd: FormData): 
  { ok: true; data: … } | { ok: false; errors: Record<string,string> };
```

Un seul parseur : publication et page partagent le schéma (les champs
publication sont optionnels). Le `type` décide de ce qui est retenu à l'écriture.

## 4. Server Actions — `src/app/admin/contenus/actions.ts`

Toutes : `"use server"`, `await requireOrgaId()` en tête, SQL paramétré,
`revalidatePath` ciblé + `revalidatePath` de la route publique concernée.

| Action | Signature | Comportement |
|---|---|---|
| `createContenuAction` | `(state, fd) → ActionState` | valide → `createContenu` → **PRG** vers `/admin/contenus/[type]/[slug]?cree=1` ; slug pris → `erreur` (reste en place, saisie conservée) |
| `updateContenuAction` | `(state, fd) → ActionState` | valide → `updateContenu` ; **reste en place** (confirmation focalisée) ; **redirige seulement si le slug change** (renommage → sinon 404 de l'ancienne URL, patron `updateConferenceAction`) |
| `publishAction` | `(fd) → void` | `setStatut(id,'publie')` → PRG `?publie=1` |
| `unpublishAction` | `(fd) → void` | `setStatut(id,'brouillon')` → PRG (repasse en brouillon, wording positif « Repasser en brouillon ») |
| `deleteContenuAction` | `(fd) → void` | `ConfirmSubmitButton` → `deleteContenu` → PRG `/admin/contenus?supprime=…` |
| `seedPublicationsAction` | `() → void` | `requireOrgaId` → seed idempotent depuis `data/actualites.ts` → PRG |

- Identité **jamais** du client ; `id`/`type` relus + validés (`Number.isInteger`,
  `enum`) comme `updateConferenceAction`.
- Erreur → `{ status:"error", error, values: formValues(fd) }` (saisie conservée).

## 5. Public + SEO + diffusion

- **`/actualites/page.tsx`** : `listPublications()` → cartes (existant réutilisé).
  Action de carte : « Lire la suite » → `/articles/[slug]` si corps, sinon
  `lien`/`lien_externe`, sinon chapô seul (conception §2). Accueil idem (récentes).
- **`/articles/page.tsx`** : `listArticlesPublies()` (publications **avec corps**).
- **`/articles/[slug]/page.tsx`** :
  - `generateStaticParams` depuis les publications à corps + **ISR via
    `revalidatePath`** déclenché aux actions (pas de `revalidate` temporel).
  - `generateMetadata` : `title`, `description=chapo`, `alternates.canonical`,
    `openGraph` (image=`imageUrl`). Brouillon/inconnu/sans corps → `notFound()`.
  - Rendu : `<article>`, `<h1>{titre}</h1>`, `<MarkdownContenu corps=… />`
    (composant serveur, config `markdown.tsx`), image `next/image` légendée.
  - **JSON-LD `Article`** via `<script type="application/ld+json">`.
- **Pages** : route racine `/[slug]` (`src/app/[slug]/page.tsx`) qui lit
  `getContenuPublieBySlug(slug)` et ne rend que les contenus de type `page`
  (sinon `notFound()`), résiliente si la base est indisponible. Les routes
  statiques et `/articles/[slug]` gardent la priorité. Caveat : un slug de page
  identique à une route statique existante est masqué par celle-ci.
- **Flux RSS** : `src/app/feed.xml/route.ts` **existe déjà** (lit `data/actualites`).
  Le rebrancher sur `listPublications()` → flux **instantané**. `description` =
  `chapo`, `link` = `/articles/[slug]` (si corps) sinon `lien`/`lien_externe`.
- **LinkedIn** : **aucun code**. RSS → Zapier/Buffer → LinkedIn (guide existant
  `docs/diffuser-actualites-rss.md`). On n'intègre pas l'API LinkedIn (cf. §0.3).
- **`sitemap.ts`** : ajouter publications (à corps) + pages publiées (`lastModified=majLe`).
- **Recherche (lot 8)** : `search-index.ts` étendu — fonction serveur qui fusionne
  l'index statique + publications/pages publiées. Note `search.ts` à mettre à jour.

## 6. Admin (UI) — hub-and-spoke

- `/admin/contenus/page.tsx` : `requireOrgaPage()` ; **2 sections**
  (`listContenus("publication")`, `listContenus("page")`) ; état brouillon/publié
  en toutes lettres + compteurs ; un CTA de création par section.
- `/admin/contenus/[type]/nouveau/page.tsx` : `InlineActionForm` (titre + chapo),
  `stickySubmit`, PRG.
- `/admin/contenus/[type]/[slug]/page.tsx` : éditeur.
  - **Éditeur** = client component `Editeur.tsx` : `<textarea>` + barre d'outils
    (boutons insèrent Markdown dans la sélection) + **onglet Écrire/Aperçu**
    (jamais côte à côte sur mobile, cf. conception §15). Aperçu = `MarkdownContenu`
    (même config). Cibles ≥ 44 px, icônes + libellés.
  - Champs : corps (premier), puis « Réglages » repliés dessous (slug affiché,
    image + alt, statut). `useActionState` + saisie conservée + confirmation
    nominative focalisée.
  - Bouton **Publier** distinct de **Enregistrer**.
- Suppression : `/[slug]/supprimer` + `ConfirmSubmitButton` (nominatif).
- Dashboard `/admin/page.tsx` : `NavRow` « Contenus » (compteur brouillons).

## 7. Lot 6 — image (`src/lib/media.ts` + CSP) — ✅ livré

```ts
export async function uploadImage(file: File):
  Promise<{ url: string } | { error: string }>;
// v1 : @vercel/blob `put(nom, file, { access:'public' })`. Valide type MIME
// (image/png|jpeg|webp|avif) + taille (≤ 4 Mo) AVANT put. Nom non deviné du client.
```
- **Route API** `POST /api/admin/contenus/image` (gardée par `requireOrgaJson()`
  — sibling JSON de `requireOrgaId()` dans `src/lib/auth-guards.ts`, pour une
  route consommée par `fetch` : elle répond 401/403 au lieu de `redirect()`,
  qu'un appel JS ne suivrait pas comme une navigation), renvoie l'URL → posée
  dans `image_url`. `image_alt` saisi à côté (obligatoire). **Pas une Server
  Action** : les Server Actions partagent une
  limite de taille de requête GLOBALE (`experimental.serverActions.bodySizeLimit`,
  1 Mo par défaut) — la relever pour une image de 4 Mo l'aurait relevée pour
  toute action du site, y compris les actions publiques non authentifiées
  (connexion, contact).
- `next.config` : domaine Blob dans `img-src` (liste) + `images.remotePatterns`.
- Câblage éditeur : `Editeur.tsx` appelle la route en `fetch` direct (hors
  `useActionState`, pas de PRG) dès le choix du fichier ; l'URL renvoyée
  alimente un champ caché `imageUrl` du formulaire principal, à côté du champ
  `imageAlt` (obligatoire dès qu'une image est déposée). Boutons Publier/
  Enregistrer désactivés pendant l'envoi (sinon publication sans l'image, sans
  erreur visible).
- Cible OVH documentée (conception §6) : swap adaptateur + CSP + migration URLs.
- Mise en place du store Vercel Blob (une fois) : `docs/exploitation.md`
  (§ Stockage de fichiers).

## 8. Tests (TDD — rouge avant vert)

| Fichier testé | Cas |
|---|---|
| `slug` | jumelage SQL/TS (accents, symboles → slug non vide), unicité |
| `contenus.ts` (pg-mem) | `mapRow` normalise ; brouillon **exclu** des lectures publiques ; tri publications par `publie_le` DESC ; `listArticlesPublies` **exclut** les publications sans corps ; `createContenu` slug dupliqué → `ok:false` ; `setStatut('publie')` pose `publie_le` |
| `contenu-form.ts` | titre requis/slug non vide ; `imageAlt` requis si `imageUrl` ; `type`/`categorie`/`tag` enums ; `corps` **vide autorisé** ; erreurs restaurent la saisie |
| `markdown.tsx` | `##`→`h2`, `###`→`h3`, **pas de `h1`** ; `<script>`/`onclick`/`iframe`/`javascript:` **neutralisés** (non-régression XSS) ; lien externe → `rel="noopener"` + `sr-only` |
| `actions.ts` | non-orga **rejetée** (garde) ; création → brouillon ; publication explicite ; renommage → redirection nouveau slug ; suppression confirmée |
| public | `[slug]` brouillon/**sans corps** → `notFound()` ; publication sans corps → carte sans page dédiée ; sitemap exclut brouillons ; recherche idem |
| `feed.xml` | publication publiée présente (chapô en `description`) ; brouillon **absent** |
| a11y | `a11y-axe` sur page article + éditeur ; un seul `h1` ; alt présent |
| E2E | agnostique aux données |

## 9. Revue de conception technique (AVANT tout code)

Point de contrôle demandé. **Résolu** = vérifié contre le code, décision figée.
**⚠️ À trancher** = besoin d'un arbitrage produit/toi ; tant qu'un ⚠️ demeure sur
son périmètre, on ne code pas le lot concerné.

**Résolu en revue :**

- **Deps Markdown** — `react-markdown@10.1.0` (peer React ≥18 → 19 OK) +
  `rehype-sanitize@6`, ESM, gérés par Next 16 (RSC) et Vitest. Reste à confirmer
  l'audit CI propre à l'installation (lot 1).
- **`slugify`** — ✅ **livré (lot 1)** : extrait dans `src/lib/slug.ts` (pure,
  sans dép DB), `conferences.ts` ré-exporte l'alias `slugifyConference` ; test
  d'équivalence SQL/TS conservé, `slug.test.ts` ajouté. `contenus.ts` importera
  `lib/slug` (jamais `conferences.ts`).
- **« Article = actualité »** — un seul type `publication` (+ `page`), **une**
  table `contenus`, table `actualites` supprimée du plan, plus de passerelle
  « afficher-aussi-en-actu ». Teaser = `chapo` (pas de découpe auto).
- **Diffusion** — RSS `/feed.xml` déjà présent (rebranché sur la base) ;
  LinkedIn **no-code** (RSS → Zapier/Buffer), aucune API à intégrer (§0.3).
- **`parseFrenchDate`** — vit dans `src/data/actualites.ts`. Décision :
  **déplacer dans `src/lib/actualites.ts`** pour éviter un import `lib → data` ;
  la donnée reste dans `data/` (seed). Tests suivent.
- **Table polymorphe `contenus`** — champs spécifiques publication (`publie_le`,
  `categorie`, `tag`, `lien*`) nullables pour une page. Aucun champ nuisible →
  une table validée (pas deux libs jumelles).
- **Sanitisation** — rendu vers éléments React (pas de `dangerouslySetInnerHTML`),
  allow-list §0.2, test XSS obligatoire. Défense doublée en base (`img_alt` CHECK).
- **Composants** — `InlineActionForm`, `ConfirmSubmitButton`, `NavRow`,
  `action-state`, `requireOrgaId/Page` existent : réutilisés, rien réinventé.

**Tranché avec l'orga (discussion) :**

- **Markdown, pas de WYSIWYG** en v1 (barre d'outils suffit).
- **Pages** : route racine `/[slug]` (ajoutée après revue post-#194) qui sert
  les contenus de type `page` publiés ; accueil et pages à gabarit restent codés.
- **Rendu image** = `next/image` (`remotePatterns` + CSP au lot 6).
- **Bornes** : `CHAPO_MAX=300`, `CORPS_MAX=50 000`, image ≤ 4 Mo,
  MIME `png/jpeg/webp/avif`.
- **Un seul type publication** (article = actualité) ; actualités et articles
  livrés ensemble (l'objet est le même).

**⚠️ Reste à vérifier en cours de route :** audit CI propre après l'ajout des
deps Markdown (lot 3) ; format exact des champs `link` du flux RSS selon corps
vs lien (lot 7).
