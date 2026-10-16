# Tremplin Phase 2b — Conception d'implémentation : pages d'édition publiques pilotées par la BDD

> **Statut** : conception d'implémentation, **non encore livré**.
> **Place dans l'arborescence** : cette évolution prolonge le module Tremplin.
> Prérequis de lecture : [conception fonctionnelle](./plateforme-conception-fonctionnelle.md) (le *quoi*), [conception technique](./plateforme-conception-technique.md) §11 (vie privée) et §12 (migration), et [`tremplin-implementation.md`](./tremplin-implementation.md) (Phase 2, dont la note DTO `PublicEdition`). Source de vérité une fois livré : `docs/architecture.md`.
> ⚠️ **Évolution assumée d'une règle initiale** : `tremplin-implementation.md` posait « le DTO public ne sérialise **aucune** donnée de participante ». Ici on l'**assouplit** : nominatif (nom, bio, sujet, portrait) **sur consentement opt-in**, + photos de groupe avec inventaire. Les compteurs restent anonymes ; e-mails/docs/liste des inscrites restent privés. C'est le **seul** point qui diverge des docs précédents — tout le reste s'y conforme.
> ⚠️ Next.js 16 a des breaking changes : se référer à `node_modules/next/dist/docs/` avant d'écrire du code (cf. `AGENTS.md`).

> Objectif : **une seule source de vérité**. L'orga remplit l'espace admin
> (`/admin/tremplins`), et la page publique d'une édition se met à jour toute
> seule (compteurs, ateliers, récompenses, finalistes…), **en garantissant
> l'anonymat** de celles qui n'ont pas consenti à être nommées.
>
> Décisions actées avec l'orga :
> - Anonymat : **compteurs anonymes partout + nominatif uniquement sur consentement**.
> - On commence par alléger la vitrine (fait), puis cette page d'édition.
> - Création d'ateliers post-import : **plus tard** (hors de ce lot).

## 1. Deux pages, deux rôles

| Page | Rôle | Source |
| --- | --- | --- |
| `/tremplin` | **Vitrine** evergreen : le concept, le parcours en 5 étapes, le jury (méthode), « féminiser votre conf ». Ne bouge quasiment jamais. | Statique (`src/data/tremplin.ts`) |
| `/tremplin/[conf]` | **Conf** : présente une conférence partenaire et liste ses éditions. | **BDD** |
| `/tremplin/[conf]/[annee]` | **Édition** : le détail chiffré d'une édition. | **BDD** (`tremplin_*`) |

Le Tremplin se décline sur **plusieurs conférences** (DevFest, Devoxx…), donc
l'URL est **hiérarchique conf → année** :
`/tremplin/devfest-toulouse/2026`, `/tremplin/devoxx/2027`… On regroupe par
conférence (conf d'abord), ce qui donne « gratuitement » une **page conf**
`/tremplin/devfest-toulouse` (pitch de la conf + liste de ses éditions).
Routes : `app/tremplin/[conf]/page.tsx` et `app/tremplin/[conf]/[annee]/page.tsx`.
L'actuelle page statique `app/tremplin/2026/page.tsx` est retirée ; redirection
`2026 → devfest-toulouse/2026` possible pour préserver le lien.

## 2. Le contrat d'anonymat (le point critique)

La BDD contient **toutes** les inscrites (non-finalistes, no-shows, e-mails,
retours jury…). Rien de tout ça ne doit fuiter. La page publique ne lit qu'un
DTO de projection strict, `PublicEdition` :

**Exposé :**
- Édition : `nom`, `annee`, `statut`, conf (`conf_nom`, `conf_date`, `conf_lien`), finale (`finale_date`, `finale_lieu`), `description`.
- **Compteurs** (agrégats anonymes) : nb inscrites, nb finalistes, nb gagnantes.
- **Ateliers** : `titre`, `date` **et `description`** (la description est publique aujourd'hui ; on ne perd pas ce contenu). Pas de visio ni de docs.
- **Jury** : `nom` + `role` (public par nature).
- **Récompenses** : rang + intitulé du prix ; gagnantes **nommées seulement si `public = true`**.
- **Galerie des finalistes** : seulement les inscriptions avec **`public = true`** → `nom`, `role`, **`sujet` (le talk présenté à la finale)**, `bio`, `linkedin`, `site_web`, **portrait (`photo_url`)**. Les autres sont **comptées mais jamais listées**.
- **Photos de groupe** (podium, soirée) : une photo n'est publique **que si toutes les personnes taguées dessus ont `public = true`** (sinon masquée). Jamais le nom des personnes non consentantes.

**Jamais exposé :** e-mails, `userId`, la liste des inscrites, les noms non-consentis, les `tremplin_documents` (retours jury, vidéos, notes), le statut individuel.

> Même discipline que l'annuaire (`PublicSpeaker`) : on sérialise **uniquement**
> le DTO, aucune métadonnée interne ne part vers le client.

### Conservation des noms dans le temps (RGPD)

Garder les noms des finalistes/gagnantes longtemps est possible, **jamais gravé** :

- **Base légale = consentement** (`public = true`), horodaté (`public_consent_at`) pour être démontrable.
- **Retrait à tout moment** : `public = false` → le nom disparaît du site (le compteur, agrégat anonyme, reste).
- **Droit à l'effacement / suppression de compte** — décision orga : par
  **défaut, le palmarès reste nominatif** même après suppression du compte
  (base légale : **archive d'un événement public**, intérêt légitime ; le
  `userId` passe à NULL, `participante_nom` est conservé). **Mais** chaque
  speakeuse doit pouvoir se sentir en sécurité : on **prévoit une option de
  retrait self-service** « me retirer de la galerie/du palmarès public »
  (repasse `public = false`, le rang reste anonyme « Gagnante non communiquée »).
  → à livrer dans un lot ultérieur (cf. §8). À documenter dans `/mentions-legales`.
- **Gagnantes** : argument d'**intérêt légitime** en plus (palmarès d'un événement public), mais on conserve l'opt-out par principe.
- À **documenter dans `/mentions-legales`** (finalité, base légale, durée, retrait).

**Droit à l'image (photos).** Une photo de personnes identifiables est une donnée
personnelle. Pour pouvoir **retirer une photo** quand quelqu'un le demande, il
faut savoir **qui est dessus** → un **inventaire** (table de liaison
photo ↔ personne). Conséquences :
- Le **portrait** d'une finaliste suit son propre consentement (`public`).
- Une **photo de groupe** (podium, soirée) n'est publiée que si **toutes** les
  personnes taguées consentent ; si l'une retire son consentement, la photo est
  masquée automatiquement (et l'orga la voit signalée via l'inventaire).
- Sur demande de retrait/effacement : on retrouve **toutes les photos** d'une
  personne par l'inventaire, pour les masquer ou les recadrer.

## 3. Ce que la page affiche (sans rien perdre vs la page actuelle)

La page d'édition reprend **tout le contenu de la page `/tremplin/2026` actuelle**.
Chaque bloc est soit **dynamique (BDD)** — donc mis à jour seul à chaque édition —
soit **éditorial statique** (constante du programme, dans `src/data`). Aucune
donnée existante n'est supprimée.

| Bloc | Source | Détail |
| --- | --- | --- |
| En-tête (nom, conf, dates, statut) | **BDD** | édition |
| **En chiffres** (inscrites/finalistes/gagnantes) | **BDD** | compteurs anonymes |
| **Le parcours** : ateliers | **BDD** | titre, date **et description** (+ « Fait ») |
| **Palmarès / podium** | **BDD** | récompenses + noms consentis |
| **Galerie des finalistes** | **BDD** | nom/rôle/sujet/bio/liens/portrait, consentis |
| **Photos** (podium, soirée) | **BDD** | publiables (consentement de toutes) |
| Format de la soirée (3 min / 5 min / 100 % retours) | éditorial | constante programme |
| **Grille d'évaluation du jury** (5 critères /28, axe Sujet / Personne) | éditorial | la *méthode*, stable |
| **Retours pour toutes** (feedback jury / vidéo / post) | éditorial | constante programme |
| **Les prix** (récompenses offertes) | éditorial v1 | par-édition en v2 |
| **Jury** (membres) | éditorial v1 | par-édition en v2 (table) |
| **Partenaires** | éditorial v1 | par-édition en v2 (table) |
| Phase « après » (coaching gagnante → conf) | éditorial | dates conf depuis la BDD |
| **FAQ** (+ JSON-LD `FAQPage`) | éditorial | evergreen |

> Co-animatrice d'atelier (ex. Lucile sur le CFP) : aujourd'hui dans `src/data`.
> En v1 on la **fond dans la description** de l'atelier au seed (sinon colonne
> dédiée plus tard). Pas de perte.

Sections **purement evergreen** (concept, « pour qui », CTA « féminiser votre
conf ») restent sur la **vitrine** `/tremplin` et ne sont pas dupliquées ici.

## 4. Modèle de données — ce qu'il faut ajouter

Migration `012` (+ `schema.sql` + `sync-to-latest.sql`).

Sur `tremplin_editions` :

| Colonne | Type | Rôle |
| --- | --- | --- |
| `conf_slug` | `TEXT NOT NULL` | Identifiant d'URL de la conf (ex. `devfest-toulouse`). Édition identifiée par `(conf_slug, annee)` → `UNIQUE (conf_slug, annee)`. |

> La page conf `/tremplin/[conf]` liste les éditions partageant `conf_slug` (nom
> repris du `conf_nom` de la plus récente). Pas de table `confs` dédiée en v1.

Sur `tremplin_registrations` :

| Colonne | Type | Rôle |
| --- | --- | --- |
| `public` | `BOOLEAN NOT NULL DEFAULT false` | Consentement à apparaître nommée publiquement (RGPD : opt-in explicite). |
| `public_consent_at` | `TIMESTAMPTZ` | Horodatage du consentement (démontrable). |
| `recompense` | `TEXT` | Intitulé/rang du prix (ex. « 1ᵉʳ prix »). `NULL` = pas de récompense. |
| `bio` | `TEXT` | Bio publique (pour la galerie ; aujourd'hui seulement dans `src/data`). |
| `site_web` | `TEXT` | Site perso optionnel (galerie). |
| `photo_url` | `TEXT` | Portrait (suit le consentement `public` de la personne). |

**Photos de groupe + inventaire** (podium, soirée) :

```
tremplin_photos (
  id, edition_id → tremplin_editions ON DELETE CASCADE,
  url TEXT NOT NULL, legende TEXT, kind TEXT,   -- 'podium' | 'soiree' | 'autre'
  created_at
)
tremplin_photo_personnes (                      -- l'inventaire « qui est sur quelle photo »
  photo_id → tremplin_photos ON DELETE CASCADE,
  registration_id → tremplin_registrations ON DELETE CASCADE,
  PRIMARY KEY (photo_id, registration_id)
)
```

Règle de publication d'une photo de groupe : visible publiquement **ssi toutes**
ses personnes taguées ont `public = true` (photo sans personne taguée = lieu /
ambiance → publiable). C'est l'inventaire qui rend ce contrôle (et le retrait)
possible.

Le **sujet présenté à la finale** réutilise le champ existant `sujet`
(pas de nouvelle colonne). Compteurs = `COUNT(*)` dérivés (inscrites = toutes ;
finalistes = `finale_presente` ; gagnantes = `recompense IS NOT NULL`).
**Pas** de colonnes de comptage à maintenir.

**Jury par édition** : aujourd'hui statique (`data/tremplin.ts`). Deux options :
- **v1** : garder le jury en statique (le jury 2026 ne bouge plus).
- **v2** : table `tremplin_jures (edition_id, nom, role, ordre)` quand une 2ᵉ édition arrive. *(Recommandé : v1 d'abord, on ajoute la table quand le besoin est réel.)*

Idem **partenaires** : statiques en v1, table plus tard si besoin.

## 5. Côté admin (ce que l'orga pilote)

Sur la fiche édition (`/admin/tremplins/[edition]`), par inscription :
- une case **« visible publiquement »** (→ `public`, horodate `public_consent_at`),
- un champ **récompense** (→ `recompense`),
- bio / site web / **portrait** (→ galerie).

Photos de groupe (podium, soirée) :
- ajouter une photo (URL + légende + type),
- **taguer les personnes** dessus (inventaire) parmi les inscriptions.
- L'admin **signale** les photos masquées car une personne taguée n'a pas (ou
  plus) consenti → on sait quoi retirer/recadrer.

Le reste (compteurs, ateliers, jury) découle automatiquement de ce qui est déjà
saisi. Remplir l'admin = mettre la page publique à jour.

## 6. Reprise de l'existant (2026)

L'import `importTremplin1` crée déjà l'édition + 8 finalistes + 5 ateliers. On
l'étend pour refléter le site **actuel** (déjà public, donc consentement
historique) : `public = true` pour les 8 finalistes, `bio`/`role`/`site_web`
repris de `data/tremplin.ts`, et `recompense` pour les 3 gagnantes (`resultats`).

→ Une fois `/tremplin/2026` lu depuis la BDD, les tableaux statiques
`participantes` / `resultats` / `prix` deviennent redondants et peuvent être
retirés de `src/data` (objectif « une seule source de vérité »). `etapes`,
`tremplinSteps`, `accompagnement`, `jury`, `faq` restent (vitrine / jury v1).

## 7. Technique (rappels)

- Route `app/tremplin/[annee]/page.tsx`, `generateStaticParams` depuis les éditions, `generateMetadata` par édition (titre/canonical/OG), **`noindex` si pas `archive`/publiable**.
- Résilience : base indisponible → `notFound()` propre, pas de 500 (comme l'annuaire).
- Fraîcheur : `revalidatePath('/tremplin/[annee]')` depuis les actions admin (déjà le pattern), ou ISR court.
- Sitemap : ajouter les éditions publiables.
- Lib : `getPublicEdition(annee): PublicEdition | null` dans `src/lib/` (projection + compteurs), testée (unitaire + intégration pg-mem) ; aucune donnée privée dans le DTO.

## 8. Découpage en lots

1. **Schéma + reprise** : `tremplin_editions.conf_slug` ; sur l'inscription `public`/`public_consent_at`/`recompense`/`bio`/`site_web`/`photo_url` ; tables `tremplin_photos` + `tremplin_photo_personnes` ; migration 012 ; extension de l'import 2026 ; DTO `PublicEdition` + `getPublicEdition(conf, annee)` (testés).
2. **Pages** `/tremplin/[conf]` (liste éditions) et `/tremplin/[conf]/[annee]` (en-tête, compteurs, ateliers, jury, palmarès, galerie consentie, photos) + metadata + sitemap ; suppression de la page statique 2026.
3. **Admin** : « visible » + récompense/bio/site/portrait par inscription ; ajout de photos de groupe + tag des personnes (inventaire).
4. **Nettoyage** : retrait des données statiques redondantes, ajustement des tests ; note RGPD dans `/mentions-legales`.
5. **Confort / RGPD** : option self-service « me retirer de la galerie/palmarès public » (repasse `public = false`) dans l'espace membre, + validation des URLs galerie (`optionalUrl`) quand l'UI d'édition des photos/portraits arrivera.

## 9. Décisions (validées avec l'orga)

- **URL** : hiérarchique **conf → année** (`/tremplin/devfest-toulouse/2026`) + page conf (`/tremplin/devfest-toulouse`). ✅
- **Jury / partenaires** : statiques en v1, table BDD quand une 2ᵉ édition arrive. ✅
- **Galerie** : on garde les **bios riches** (colonnes `bio`/`site_web`) + le **sujet du talk** présenté à la finale. ✅
- **Consentement 2026** : les 8 finalistes déjà publiques sont considérées consentantes (seed `public = true`, `public_consent_at` = date de reprise). ✅
- **Conservation RGPD** : noms gardés longtemps mais réversibles (retrait + effacement), cf. §2. ✅

- **Photos** : portrait par finaliste + photos de groupe avec **inventaire** (qui est dessus) ; une photo de groupe n'est publique que si **toutes** les personnes taguées consentent. ✅

Reste à trancher :
- **Hébergement des images** : on garde **URL en base**. ⚠️ Les photos de
  **personnes identifiables** ne doivent **pas** être committées dans le repo :
  l'historique git est permanent (incompatible avec le droit à l'effacement),
  le repo passera **public**, et la règle projet impose les données perso
  **hors git**. De plus, un fichier git-ignored n'est **pas déployé** par Vercel.
  → portraits / podium / soirée hébergés **hors repo** (reco : **Vercel Blob**,
  suppression réelle possible) ; seuls les **assets non personnels** (logos,
  lieu) peuvent vivre dans `public/`.
- Distinguer « sujet d'inscription » et « sujet retenu à la finale » (2 champs) ? Pour l'instant un seul `sujet` suffit (le talk présenté).
