# Conception détaillée — Lot N3 : les speakeuses écrivent

> Statut : **VALIDÉE par Cateline le 2026-08-08** (maquette v2 ; retours
> intégrés : vocabulaire unifié, ZÉRO anonymisation — la speakeuse cède
> ses droits à Tech Speak'Her —, rangement au choix avec la catégorie
> « Conseils de speakeuse », et « toute membre » écrit).
> Décline `conception-espace-fil-navigation.md` §7 et §11. Ce lot crée des
> ÉCRANS NEUFS et un LIEN DE DONNÉES nouveau (autrice ↔ article, public) :
> **aucune ligne de code avant le feu vert de Cateline** sur ce document,
> sa maquette et les questions restantes du §8.

## 1. Objectif du lot

Articles, astuces, retours d'expérience écrits PAR les speakeuses — la
matière qui fait vivre le fil entre deux conférences, et qui alimente le
fil public (/actualites, RSS, recherche) autant que le fil connecté.

Test doctrine (§0) : un REX de préparation de talk rapproche ses lectrices
d'une scène ; la relecture orga garde un fil de FAITS utile, jamais un mur
d'opinions à modérer.

## 1bis. Le vocabulaire, unifié entre les pages (retour du 2026-08-08)

Un concept = un mot, PARTOUT (pages, cartes, feuille ➕, admin, recherche,
e-mails) :

| Mot | Ce qu'il désigne | Où |
|---|---|---|
| **actualité** | une entrée du flux Actualités, quelle que soit sa forme (annonce, lien, article) | /actualites, les cartes, le fil, le RSS |
| **article** | une actualité avec un texte à lire chez nous | /articles/[slug], l'éditeur, « Mes articles », la relecture |
| **publication** | le mot TECHNIQUE (type en base) | jamais affiché |

La règle existante « article = actualité » (destination unique,
`docs/conception-articles.md`) reste : un article PARAÎT dans les
actualités. Le lot comprend une étape de MISE EN CONFORMITÉ des libellés
existants et un garde-fou de test (aucun libellé affiché ne dit
« publication » ; « article » réservé à ce qui se lit chez nous).

## 2. Le modèle : l'infrastructure existante, plus l'autrice et la relecture

La table `contenus`, l'éditeur Markdown, `/articles/[slug]`, le RSS et la
recherche existent. Il manque deux choses (conception v2 §7) :

### 2.1 L'autrice — jamais anonymisée (tranché le 2026-08-08)

- `contenus.auteur_user_id INTEGER NULL REFERENCES users(id) ON DELETE
  SET NULL` — le lien VIVANT (photo, fiche via son compte). FK sur `users`
  et pas sur `speaker_profiles` : TOUTE membre écrit (Q4), avec ou sans
  fiche. NULL = contenu signé Tech Speak'Her (l'existant, inchangé).
- `contenus.auteur_nom TEXT` — le nom AFFICHÉ, figé à la publication
  (patron « snapshot » des conférences) : **la byline survit à tout** —
  retrait de fiche, suppression de compte. La speakeuse écrit et CÈDE ses
  droits de publication à Tech Speak'Her, article signé de son nom.
- **Byline** sur l'article public et la carte du fil : photo + nom ; le
  LIEN vers sa fiche d'annuaire n'existe que si la fiche est publiée (une
  fiche retirée replie le lien, jamais le nom).
- Migration `db/migrations/NNN_*.sql` + `schema.sql` + `sync-to-latest.sql`.

### 2.2 La relecture (même modèle que la fiche)

- `contenus.statut` gagne `'en_relecture'` (CHECK étendu) et
  `relecture_motif TEXT` porte le retour d'une orga.
- Flux : la speakeuse écrit (brouillon) → soumet (en_relecture) → une orga
  **publie** ou **renvoie avec motif** (retour brouillon). La charte
  s'applique : une orga corrige la forme évidente, **jamais le fond sans
  elle** — le motif sert à ça.
- La soumission crée la tâche orga « Relire l'article de {nom} » dans
  À faire (moteur de tâches existant, même mécanique que la fiche).

## 3. Les parcours

| Geste | Où | Quoi |
|---|---|---|
| Écrire | feuille ➕ → « Écrire un article » (astuce, REX, conseil) | Un éditeur SIMPLE : titre, texte (Markdown), chapo optionnel, **catégorie au choix** (les catégories existantes + la nouvelle « Conseils de speakeuse », proposée par défaut). Le reste (image, liens, vidéo) reste l'affaire de l'éditeur orga. |
| Suivre | « Mon profil » → rangée « Mes articles » | Ses articles et leurs statuts (brouillon, en relecture, publié), reprendre un brouillon. |
| Relire | À faire → tâche → l'éditeur admin existant | Bandeau relecture : l'autrice, Publier, Renvoyer avec motif. |
| Lire | le fil (carte signée), /actualites, /articles/[slug], RSS | La carte du fil devient INCARNÉE : photo + nom de l'autrice + titre + chapo (le fil N2 l'accueille : une source de plus dans la fusion). |

La CESSION DE DROITS à la soumission, en toutes lettres (tranché le
2026-08-08 : la speakeuse écrit et donne ses droits à Tech Speak'Her) :
« En soumettant, tu autorises Tech Speak'Her à publier ton article sous
ton nom — il reste en ligne même si tu retires ta fiche ou fermes ton
compte. »

## 4. RGPD et modération

- **Donnée nouvelle** : le lien autrice ↔ article et le nom figé
  (`auteur_nom`), PUBLICS une fois publié. Base légale : la cession de
  droits explicite au moment de soumettre (§3) — l'article est une œuvre
  publiée, pas une donnée de profil : il survit au retrait de la fiche et
  à la suppression du compte, SIGNÉ (zéro anonymisation, tranché le
  2026-08-08). Ce que la suppression de compte efface : le compte, la
  fiche, le LIEN vivant (`auteur_user_id → NULL`) — le nom sur l'œuvre
  reste, comme dans n'importe quelle revue.
- **Fiche retirée** : le lien de la byline se replie, le nom et l'article
  restent.
- **Modération** : la relecture est AVANT publication — aucun texte libre
  non modéré n'apparaît, donc pas de bouton de signalement dans ce lot (il
  naîtra avec les commentaires, N6).

## 5. Sécurité

Identité de session partout ; une speakeuse n'écrit et ne soumet QUE ses
articles (`auteur_user_id` vérifié serveur) ; publier/renvoyer reste
`isOrga` ; Markdown rendu par la moulinette existante (échappement
inchangé) ; SQL paramétré ; Zod sur le formulaire.

## 6. Accessibilité (RGAA)

Éditeur : labels visibles, erreurs `role="alert"` avec saisie conservée,
statuts en mots (jamais la couleur seule). Byline : lien nommé (« la fiche
de {nom} »). Carte du fil : mêmes règles qu'au lot N2.

## 7. Étapes (TDD, une PR, après validation)

1. **A1 — le schéma et les libs** : migration, statut, autrice, gardes.
2. **A2 — écrire et soumettre** : éditeur speakeuse, rangée « Mes
   articles », consentement.
3. **A3 — relire** : bandeau orga, publier / renvoyer avec motif, tâche
   À faire.
4. **A4 — lire** : byline (article public, carte du fil), RSS inchangé.
5. **A5 — le vocabulaire** : mise en conformité des libellés existants
   (§1bis) + garde-fou de test.
6. Revues (correction exigeante + `/security-review` obligatoire :
   nouvelles données perso + Server Actions — + `/simplify`), CI, merge.

## 8. Questions : tranchées et restantes

Tranché par Cateline le 2026-08-08 :

- **Q1 — byline anonyme** : ÉCARTÉE. Zéro anonymisation, jamais.
- **Q2/Q3 — fiche retirée, compte supprimé** : l'article RESTE publié et
  signé — la speakeuse cède ses droits à Tech Speak'Her à la soumission
  (§2.1, §4). Seul le lien vivant se replie.
- **Q5 — le rangement** : catégorie AU CHOIX parmi les existantes, plus la
  nouvelle catégorie **« Conseils de speakeuse »** (ajoutée à
  `src/data/categories-contenus.ts`, proposée par défaut dans l'éditeur
  speakeuse).
- **Vocabulaire** : unifié entre les pages (§1bis) — actualité (le flux),
  article (ce qui se lit), publication (technique, jamais affiché).

- **Q4 — qui écrit** : **toute membre connectée** (tranché le 2026-08-08).
  La byline ne fait un lien que si sa fiche est publiée ; sans fiche au
  moment d'écrire, le nom vient du compte.

## 9. Arbitrages issus des revues (2026-08-08, correction + sécurité)

Corrigé pendant les revues :

- **Fenêtre de déploiement** : les lectures des nouvelles colonnes se
  replient par `siSchemaEnRetard` (colonne absente, pas seulement table) —
  le tableau de bord orga et le fil connecté survivent au code déployé
  avant la migration 061.
- **Suppression de compte (RGPD)** : la cession de droits porte sur la
  PUBLICATION. `deleteAccount` emporte les articles jamais publiés
  (brouillon + en relecture) ; seul l'article publié survit, signé.
- **Anti-abus** : plafond de **20 articles en cours** par membre (borne
  SQL dans l'INSERT), listes bornées (`LIMIT`) côté orga et côté membre.
- **Course de deux orgas** : renvoyer un article déjà traité écrit zéro
  ligne et LE DIT (`deja_traite`), au lieu de confirmer à tort.
- **Slug** : jamais vide, jamais le segment réservé `nouveau` ; motif de
  renvoi borné (1 000) ; RSS : chapo échappé (une membre le rédige).

Assumé (à re-trancher si besoin) :

- **Titre déjà pris** : la collision de slug répond « titre déjà pris »
  quel que soit le contenu en face — une membre pourrait en déduire
  l'existence d'un brouillon d'orga. Assumé : il faut deviner le titre
  exact, rien ne fuit du contenu, et l'orga garde la main (renommer /
  supprimer). L'alternative (suffixe automatique `-2`) est notée.
- **Brouillons visibles des orgas** : un brouillon de membre vit dans la
  table commune `contenus`, donc dans `/admin/contenus`, AVANT soumission.
  Assumé : les orgas sont de confiance et la modération du spam l'exige.
  Si on veut la confidentialité stricte avant soumission, il faudra
  l'exclure de la liste admin (décision produit).
