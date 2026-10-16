# Design système — Tech Speak'Her

> Référence **durable** des briques d'interface : on assemble les pages à partir
> de ces éléments, on ne recopie plus de coques à la main. À lire avant de créer
> une page ou un composant d'UI.
>
> Principes UX qui gouvernent ces briques : `docs/principes-conception-ui.md`.
> Application à la refonte Tremplin : `docs/conception-technique-hub-tremplin.md`.
>
> Créé le **2026-07-04**.

## Les 4 niveaux

```
Tokens          couleurs, typo, rayons        globals.css (@theme inline)
   ↓
Primitives      atomes réutilisables          src/components/*
   ↓
Modèles de page coques de page standard       (à extraire — voir §3)
   ↓
Compositions    pages/écrans métier           src/app/**/page.tsx, AtelierDetail…
```

Règle d'or : une page métier **assemble** un modèle de page + des primitives.
Si on se surprend à recopier une coque (en-tête, ligne cliquable, grille de
fiche), c'est qu'il manque une primitive ou un modèle — on l'extrait.

## 1. Tokens (`globals.css`)

Couleurs : `navy` / `navy-light` / `navy-lighter` (fonds), `cyan` / `cyan-light`
(accent, liens, focus), `orange` (alerte / à-traiter), `gold` / `silver` /
`bronze` (podium Tremplin), `gray-light` (texte secondaire), `magenta`
(sélection). Rayons : `rounded-xl` (lignes), `rounded-2xl` (cartes de section).
Focus : `focus-visible:ring-2 ring-cyan` **partout** (RGAA).

## 2. Primitives (existant)

| Primitive | Rôle |
|---|---|
| `Button` | bouton / lien stylé (variants) |
| `Card` | carte générique (fond navy-light, bordure) |
| `CarteSection` | **section de fiche** : `<h2 aria-labelledby>` + description + contenu |
| `Breadcrumb` | fil d'Ariane (remontée hiérarchique) |
| `ExternalLink` | lien `_blank` sûr (bloque non-http, annonce « nouvel onglet ») |
| `InlineActionForm` | **formulaire d'action à résultat** (pattern « résultat », pas PRG) |
| `ConfirmSubmitButton` | confirmation Radix des gestes destructifs |
| `DocList` | **liste de documents mutualisée** (action par item optionnelle) |
| `TagBadge` | pastille/étiquette |
| `SearchBar` / `ChipGroup` / `StepIndicator` / `PageHero` / `EspaceNav` | recherche, filtres, wizard, hero, onglets d'espace |

### Primitive à extraire : `NavRow`

Aujourd'hui la **ligne cliquable → page** est réimplémentée partout :
`EditionListItem`, les lignes ateliers / participantes / récompenses / photos de
la page édition, `ParticipantesNav`. Toutes ont la même forme :

```
[ élément de tête ]  Titre                         →
                     sous-titre / méta · badges
```

On l'extrait en **une** primitive :

```tsx
<NavRow
  href="/admin/tremplins/2/ateliers/7"
  leading={<Count>5</Count>}        // optionnel : compteur, avatar, miniature
  title="Construire son pitch"
  subtitle="19 mars · ouvert à toutes · 1 support"
  badges={["✓", "●"]}               // optionnel
  badgesLabel="compte relié, visible du public"
  flag="warning"                    // optionnel : met le sous-titre en orange (à-traiter)
/>
```

Contrat : composant **partagé** (server-safe : `ParticipantesNav`, qui est
client, doit pouvoir le rendre). Rend un `<Link>` (bordure, hover
`border-cyan/40`, focus ring, flèche `→` `aria-hidden`), `min-w-0` + `truncate`
sur les textes, dans un `<li>` (les suites de `NavRow` sont des `<ul>`).
`flag` **impose un équivalent texte** (visible + `sr-only`), jamais la couleur
seule (RGAA 1.4.1).

`ParticipantesNav` devient un usage de `NavRow`. **`EditionListItem` reste à
part** au premier jet : année inline dans le titre, aucun badge, route publique
ISR — forme différente, on ne le force pas dans le contrat (YAGNI, §4.5).

## 3. Modèles de page (le cœur de la demande)

Quatre coques standard. Chacune est un composant qui prend un `Breadcrumb`, un
en-tête et des *slots* de contenu — pour que **toutes** les pages d'un même type
soient identiques en structure, espacement, a11y et wording.

> **Périmètre (décision de revue, YAGNI)** : seuls `NavRow`, `ListPageTemplate`
> et le **pattern de création en modale** sont des composants. `HubTemplate` et
> `DetailTemplate` restent des **conventions de composition** documentées
> ci-dessous tant qu'ils n'ont qu'un usage — on les extraira au 2ᵉ.

### 3.1 `HubTemplate` — *convention* : tableau de bord d'un domaine

En-tête (titre + statut + action d'édition) puis **liste de `NavRow`**
(sous-domaines : compteur + résumé + drapeau à-traiter). **Aucun formulaire de
création** ici. Sert la page édition Tremplin (1 seul usage → convention, pas
un composant).

### 3.2 `ListPageTemplate` — liste d'un type d'items

Breadcrumb + en-tête (titre + méta courte) + **zone de création** (slot :
un `CreateForm`) + **liste de `NavRow`** (les items) + état vide explicite. C'est
le modèle des pages `…/ateliers`, `…/photos`, `…/recompenses`, `…/ressources`.

```tsx
<ListPageTemplate
  breadcrumb={…}
  title="Ateliers" meta="Tremplin 2 · 5 ateliers"
  create={<AddAtelierDialog …/>}    // déclencheur de MODALE (décision de revue)
  items={ateliers.map(a => <NavRow …/>)}
  empty="Aucun atelier pour l'instant."
/>
```

### 3.3 Pattern de création — MODALE (`AdminDialog`)

**Décision de revue** : la création se fait en **modale** (`AdminDialog` déjà
fiabilisée iOS : en-tête/pied fixes, corps défilant, positionnement explicite),
pas en formulaire de page. On garde donc `AddParticipanteDialog`,
`AddPhotoDialog`, etc., appelés depuis le slot `create` de `ListPageTemplate`.

Règles communes de la modale (via `InlineActionForm`, donc pattern résultat,
saisie conservée sur erreur) :
- indicateur visible d'obligatoire (`*` orange + `sr-only « obligatoire »`) ;
- **focus** : à l'ouverture → 1er champ ; sur erreur → **pas de vol de focus**,
  message annoncé via `role="alert"` ; sur succès → modale fermée, le nouveau
  `NavRow` apparaît dans la liste, feedback `role="status"` sans voler le focus ;
- rôle ARIA explicite : `alert` (erreur) vs `status` (succès) ;
- wording nominatif, `variant="primary"`.

### 3.4 `DetailTemplate` — *convention* : fiche d'un item

Breadcrumb + en-tête (titre + badges + méta) + suite de `CarteSection` + lien
retour. `AtelierDetail`, la fiche participante, la fiche récompense en sont des
compositions (1 enchaînement trivial → **convention**, pas un composant tant
qu'il n'apporte pas de règle propre). Les capacités par rôle (qui édite quoi)
sont gérées **dans** la composition, pas dans le modèle (cf.
`conception-technique-hub-tremplin.md` §4).

## 4. Règles transverses (valables pour toute page)

1. **Une intention par page** ; le hub ne porte que l'état, la création vit sur
   la page liste (`principes-conception-ui.md` §1).
2. **Pattern résultat** (`InlineActionForm`) pour les actions dans une liste ;
   PRG réservé aux formulaires de page entière (§4 des principes).
3. **A11y non négociable** : `Breadcrumb` en tête, un seul `h1`, sections en
   `CarteSection` (`aria-labelledby`), `role="alert"`/`status` pour les
   messages, focus ring cyan partout, `sr-only` pour les infos visuelles.
4. **Wording** : nominatif, descriptif, sans jargon ; typographie FR (espace
   insécable avant `! ? : ;`, pas de cadratin dans le contenu affiché).
5. **Ne pas sur-abstraire** : on extrait une primitive/un modèle quand la coque
   est répétée **au moins deux fois** et stable. Un slot suffit souvent ; pas de
   configuration spéculative (YAGNI).

## 5. État d'avancement

- **Fait** : `DocList` (mutualisé, testé).
- **À extraire (composants)** : `NavRow` (partagé), `ListPageTemplate`. Le
  pattern de création réutilise `AdminDialog` (existant).
- **Conventions (pas de composant tant qu'1 seul usage)** : `HubTemplate`,
  `DetailTemplate`.
- **Application + phasage** : `docs/conception-technique-hub-tremplin.md`.
