# Inscription express à l'annuaire : design

Statut : livré sur la branche `claude/simplify-speaker-directory-328845` (2026-11-12), en attente de revue avant PR. Deux écarts tranchés pendant le plan, notés plus bas (relecture et contact). Maquettes : https://claude.ai/artifact/WnaUodkdb9pwaMTvyntdsm (lien privé).

## Pourquoi

Des speakeuses trouvent l'annuaire trop compliqué à remplir : l'assistant actuel compte 6 étapes (Profil, Secteurs, Sujets, Interventions, Contact, Attestation), et l'étape « Profil » demande à elle seule titre, poste, entreprise, présentation, ville et 5 liens. Le but : qu'une speakeuse n'hésite pas. Ce qui compte, ce sont ses thèmes ; les talks sont facultatifs, et en ajouter un doit tenir en un geste.

Principes tirés des sources de la page Notion « Profils autistes et accessibilité numérique » (AASPIRE, National Autistic Society) : une question par écran, consignes explicites, peu de choix visibles à la fois, rien d'obligatoire caché, pouvoir revenir plus tard.

## Critères de réussite

- Une nouvelle speakeuse publie sa fiche en 2 écrans (nom, thèmes).
- Un talk se crée avec son titre seul.
- Tout le reste (photo, ville, présentation, secteurs, liens, régions, langues) est facultatif et se complète après.

## Décisions prises

| Sujet | Décision |
|---|---|
| Minimum pour paraître | Nom + au moins un thème |
| Thèmes | Catégories et sous-catégories, plusieurs choix dans plusieurs catégories |
| Mots libres | Aucun : ce sont les talks qui affinent |
| Secteurs | Facultatifs, sur leur page de la fiche |
| Attestation | Phrase sous le bouton « Publier ma fiche » ; le clic pose `is_woman = true` côté serveur |
| Contact | Confirmé par Cateline le 2026-11-12 (« Oui, au clic »). Le clic sur « Publier ma fiche » vaut accord pour être contactée par le site (`contact_email_ok = true`) ; phrase sous le bouton : « Les organisateurs pourront t'écrire par le site, ton e-mail reste caché. » |
| Publication | Immédiate si aucun texte écrit à la main ; relecture orga sinon. Cette règle vaut pour la **première** publication seulement (voir « Écarts tranchés ») |
| Le nom | Compte comme texte écrit à la main, sauf s'il vient tel quel de Google ou LinkedIn |
| Titre de talk | 300 caractères (au lieu de 200), champ qui s'agrandit avec le texte |
| Import de talks | Hors du parcours principal (Sessionize et autres bloquent en 403) ; lien discret « Importer » |

## Taxonomie des thèmes

Source unique : `src/data/domaines.ts`. On stocke la sous-catégorie dans `sujets TEXT[]` (colonne inchangée) ; la catégorie se déduit.

| Catégorie | Sous-catégories |
|---|---|
| Développement | Web / Front-end, Back-end, Mobile, Qualité / Tests, Architecture |
| Data et IA | IA / Machine Learning, Data / BI, IA générative, Éthique de l'IA |
| Infra et sécurité | Cloud, DevOps, Cybersécurité, Green IT |
| Design | UX / UI, Accessibilité, Design system, Recherche utilisateur |
| Produit | Product management, Product marketing, Agilité, Growth |
| Humain et carrière | Leadership, Soft skills, Reconversion, Diversité et inclusion |
| Recherche et innovation | Recherche / PhD, R&D, Open source |

Chaque sous-catégorie est unique dans toute la liste (un test le garde).

### Reprise des anciens sujets

| Ancien sujet | Nouveaux thèmes |
|---|---|
| IA / Machine Learning / Data | IA / Machine Learning, Data / BI |
| Développement web / Front-end | Web / Front-end |
| Mobile | Mobile |
| Cloud / DevOps / Infra | Cloud, DevOps |
| Cybersécurité | Cybersécurité |
| UX / Design / Accessibilité | UX / UI, Accessibilité |
| Produit / Agilité | Product management, Agilité |
| Leadership / Soft skills | Leadership, Soft skills |
| Recherche / Académique (PhD) | Recherche / PhD |
| Innovation / R&D | R&D |
| Autre | retiré |

Une fiche dont le seul sujet était « Autre » se retrouve sans thème : elle reste publiée (pas de dépublication rétroactive), et Mon espace lui propose « Choisis tes thèmes » en tête de « Pour aller plus loin ».

## Écrans

1. **`/mon-espace/bienvenue`, étape 1** : « Comment t'appelles-tu ? », un champ, prérempli depuis le compte. Bouton « Continuer ».
2. **Étape 2** : « De quoi parles-tu ? ». Les 7 catégories en pastilles ; un toucher ouvre les sous-catégories en dessous (une catégorie ouverte à la fois). Chaque pastille de catégorie affiche le nombre de thèmes cochés dedans. Récapitulatif « Tes thèmes (n) » au-dessus du bouton. Bouton « Publier ma fiche », sous lequel : « En publiant, j'atteste être une femme ou une personne non binaire. »
3. **Mon espace après publication** : message selon le cas, « Ta fiche est en ligne. » ou « Ta fiche est envoyée. L'équipe la relit, en général sous 48 h. », puis la liste « Pour aller plus loin » (talk, photo, ville, présentation, secteurs et liens), chaque ligne vers sa page `fiche/[section]` existante.
4. **`/mon-espace/talks/nouveau`** : le titre seul (300 caractères, compteur, champ qui s'agrandit), bouton « Enregistrer ». Description et conférences s'ajoutent ensuite sur la page du talk. En bas : « Tes talks sont sur Notist ou dans un fichier ? Importer ».

Routage : une connectée sans fiche qui arrive sur `/mon-espace` est envoyée vers `bienvenue`. Les liens existants vers `/mon-espace` (accueil, y compris la branche Tremplin Devoxx) restent valides. Les anciens `?step=…` de `profil-etapes.ts` mènent à la page `fiche/[section]` correspondante.

## Composants et fonctions

- **`ChoixThemes`** (client) : catégories en boutons `aria-expanded` + `aria-controls`, thèmes en vraies cases à cocher stylées en pastilles, récapitulatif en `aria-live="polite"`, `fieldset`/`legend` par catégorie, `focus-visible` partout.
- **`doitEtreRelue(nomSaisi, nomCompte)`** (`src/lib/relecture.ts`, pure) : vrai si le nom saisi diffère du nom du compte, ou si le compte n'a pas de nom. Elle ne juge que la première publication (voir « Écarts tranchés »).
- **Server Action `publierFicheExpress`** : identité depuis la session, validation Zod (nom requis, au moins un thème, thèmes dans la liste), pose `is_woman = true`, puis publie ou met en relecture selon `doitEtreRelue`. Le client ne transmet jamais la décision.
- **Talk** : `TITRE_MAX` passe à 300 dans `src/lib/talk-limits.ts` (colonne `TEXT`, pas de migration). Créer un talk ou changer son texte ne dépublie pas une fiche déjà en ligne.
- **Annuaire** : les filtres « Sujets » deviennent « Thèmes » par catégorie ; filtrer « Design » trouve toute fiche ayant une sous-catégorie Design.

## Écarts tranchés

- **Relecture à la première publication seulement.** Une fiche publiée qui change reste visible (`upsertProfile`, `src/lib/profiles.ts`), et la modification se repère par `updated_at` plus récent que `validated_at`. On garde ce comportement : `doitEtreRelue` ne décide qu'au clic sur « Publier ma fiche ». La version initiale de cette spec prévoyait une relecture à chaque texte modifié ou talk créé ; elle est abandonnée.
- **Contact au clic.** Le clic sur « Publier ma fiche » pose `contact_email_ok = true`, avec la phrase sous le bouton. Cateline l'a confirmé le 2026-11-12.

## Données

- Migration `db/migrations/078_themes_categories.sql` (076 et 077 sont pris par le Tremplin Devoxx) : conversion des sujets selon la table ci-dessus. Même chose dans `sync-to-latest.sql` (idempotent) ; `schema.sql` ne change pas de forme.
- Aucune nouvelle colonne.

## Branche Tremplin Devoxx en parallèle

`claude/tech-speakher-devoxx-669331` touche `db/sync-to-latest.sql`, `docs/dette-technique.md`, `docs/roadmap.md`, `src/__tests__/french-spelling.test.ts`, `src/data/search-index.ts`, `src/app/page.tsx`. Pour limiter les conflits :
- migration numérotée 078 (077 prise entre-temps par `077_tremplin_2027_deplacements.sql`) ;
- ne pas toucher `src/app/page.tsx` ni les fichiers Tremplin ;
- se rebaser sur `main` après sa fusion, puis réunir item par item ce que contiennent les deux versions de la dette et de la roadmap (règle « l'union fait foi »).

## Tests

- Vitest : `doitEtreRelue` (nom du compte inchangé, modifié ou absent) ; correspondance des sujets (chaque ancien sujet a une destination, pas de doublon) ; unicité des sous-catégories ; `publierFicheExpress` (refus sans session, refus sans thème, attestation posée, relecture décidée côté serveur) ; `ChoixThemes` (compteurs, récapitulatif, clavier).
- Playwright (`npm run e2e:db`) : inscription complète en 2 écrans avec un compte jetable ; talk créé avec son titre seul ; fiche visible ou en relecture selon le cas.
- Chaque garde est cassée une fois pour vérifier que son test tombe (`docs/principes-tests.md`).

## Hors périmètre

- Mots libres ou thèmes personnalisés.
- Import automatique depuis Sessionize ou Conference Hall.
- Changement des secteurs, régions, langues.
