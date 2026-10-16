# Conception — Dupliquer une édition du Tremplin

> S'appuie sur le modèle de données des éditions (`db/schema.sql`, section
> Tremplin), la création d'édition (`src/lib/tremplin-editions.ts`,
> `src/lib/tremplin-form.ts`, `src/app/admin/tremplins/AddEditionDialog.tsx`) et
> la reprise atomique du Tremplin 1 (`src/lib/tremplin-import.ts`) — dont la
> duplication réutilise le squelette (transaction + rollback).
>
> Design système : `docs/design-system.md`. Principes UX :
> `docs/principes-conception-ui.md`. Hub admin : `docs/conception-technique-hub-tremplin.md`.
>
> **Statut : conception (revue RGPD / sécurité / UX / RGAA / KISS du 2026-07-04
> intégrée).** Créé le **2026-07-04**.

## 0. Arbitrages tranchés (revue du 2026-07-04)

Revue à 5 angles (RGPD, sécurité, UX, RGAA, KISS) :

1. **UI unifiée, pas de « modes »** (KISS) : la duplication n'est PAS une modale
   à part avec une bascule « même conf / autre conf ». C'est le formulaire de
   **création pré-rempli depuis la source** + un `sourceId` caché. Le sélecteur
   de conf existant (`AddEditionDialog`) fait déjà les deux cas : conf par défaut
   = la source (→ nouvelle année), ou on change la conf (→ autre conférence).
2. **Phase 1 = ateliers seuls** (YAGNI) : le besoin exprimé est de ne pas
   re-saisir le parcours d'ateliers. Le catalogue de récompenses attend la
   phase 2 (il forcerait un refactor de `addRecompense`, cf. §7).
3. **Zéro donnée personnelle recopiée** (RGPD) : y compris le champ texte libre
   `coachs` des ateliers (noms de personnes) → réinitialisé.
4. **Champs datés / éditoriaux vidés** (UX) : `description` comprise (le bilan
   de la source serait faux sur la copie).
5. **Atomicité vraie** (sécurité) : tout dans une transaction ; les primitives
   appelées doivent accepter le `client` transactionnel.

## 1. Objectif

Ouvrir une nouvelle édition sans re-saisir le parcours, en repartant d'une
édition existante prise comme **modèle**. Deux cas d'usage, symétriques :

1. **Même conférence, année différente** — le DevFest revient chaque année :
   `devfest-toulouse / 2026` → `devfest-toulouse / 2027`. C'est le cas courant.
2. **Même année, conférence différente** — on décline le format déjà rôdé sur
   une autre conf : `devfest-toulouse / 2027` → `devoxx-france / 2027`.

Dans les deux cas, la cible est une **nouvelle** paire `(conf_slug, annee)` —
l'identité publique d'une édition (index unique `idx_editions_conf_annee`). La
duplication ne modifie **jamais** l'édition source.

## 2. Décision centrale — ce qui se recopie, ce qui non

Une édition mélange trois natures de données. La règle : **on recopie le
squelette réutilisable (le parcours d'ateliers), jamais les personnes ni
l'événementiel daté.** RGPD d'abord : aucune donnée personnelle ne traverse
d'une édition vers une autre.

### Recopié — le squelette du parcours (phase 1)

| Donnée | Détail recopié | Pourquoi |
| --- | --- | --- |
| **Ateliers** (`tremplin_ateliers`) | `ordre`, `titre`, `description`, `phase` | Le parcours (5 ateliers thématiques) est stable d'une édition à l'autre — c'est le cœur du format à réutiliser. La `phase` (avant / après la soirée) fait partie de cette structure. |

### Réinitialisé sur les ateliers recopiés

- `date`, `heure_debut`, `heure_fin` → **null** : nouvelles dates, saisies après.
- `lien_visio` → **null** : lien de la session précédente, périmé.
- **`coachs`** (texte libre) → **null** : ce sont des **noms de personnes**
  (donnée personnelle). On ne les propage pas vers une édition future à laquelle
  elles n'ont pas encore consenti ; les mêmes coachs se re-saisissent.
- Les **membres** (`tremplin_atelier_membres`), **présences** et **coachs
  comptes** (`tremplin_atelier_coachs`, liés à `users`) → rien : ce sont des
  personnes de l'édition source.

### Jamais recopié

- **Inscriptions** (`tremplin_registrations`) et tout ce qui en dépend en
  cascade : consentements (`public`, `public_consent_at`, `tremplin_consent_log`),
  coachs individuels (`tremplin_registration_coachs`), sujets, bios, portraits,
  récompenses attribuées, statut finaliste.
- **Photos** (`tremplin_photos`, `tremplin_photo_personnes`) : événement daté,
  droit à l'image attaché aux personnes de l'édition source.
- **Documents** (`tremplin_documents`) : supports d'atelier, retours jury et
  vidéos propres à l'édition (souvent individuels et privés).
- **Jury** (`tremplin_jury`) : des personnes (nom, fonction, e-mail) rattachées
  à l'édition source — données personnelles, jamais propagées.
- **Appartenances de phase** (`tremplin_registration_phases`) : dépendent des
  inscriptions (non recopiées), donc vides par construction.
- **Récompenses** (`tremplin_recompenses`) : hors périmètre en phase 1 (§7.1).

### Métadonnées de l'édition elle-même

| Champ | Duplication |
| --- | --- |
| `nom` | Proposé « Tremplin {conf} {année} » (la conf porte déjà nom + lieu + année ; son année finale est remplacée par la cible : « Tremplin DevFest Toulouse 2027 »), recalculé quand conf ou année change, **éditable**. Pas de « Copie de… » : nom final, jamais de placeholder qui fuiterait au public si l'orga oublie de renommer avant d'ouvrir. |
| `conf_slug`, `annee` | **La cible** — c'est ce qui change (§3). |
| `statut` | Forcé à **`preparation`** (invisible du public, comme toute création). |
| `conf_nom`, `conf_lien` | Recopiés si même conf ; à saisir si conf différente (le sélecteur les pré-remplit déjà pour une conf connue). |
| `description` | **Vidée** — la description de la source est un bilan daté (« Première édition… 3 gagnantes »), faux sur la copie. L'orga la réécrit. |
| `conf_date`, `finale_date`, `finale_lieu` | **null** — événementiel daté. |
| `inscriptions_debut`, `inscriptions_fin` | **null** — nouvelle fenêtre. |

**Invariant RGPD (à tester) :** après duplication, la nouvelle édition ne porte
**aucune** donnée personnelle. Concrètement, **0 ligne** rattachée à sa
`edition_id` dans : `tremplin_registrations`, `tremplin_photos`,
`tremplin_photo_personnes`, `tremplin_documents`, `tremplin_recompenses`,
`tremplin_jury`, `tremplin_consent_log` ; et **0 ligne** dans
`tremplin_atelier_membres`, `tremplin_atelier_coachs`,
`tremplin_registration_coachs`, `tremplin_registration_phases` pour ses ateliers
/ inscriptions ; enfin `coachs IS NULL` sur chaque atelier copié. C'est la
garantie qu'aucun lien personne↔édition n'a traversé.

*Effet de bord bénéfique :* la copie ne contenant aucune donnée personnelle, elle
est **indépendante** d'un futur droit à l'effacement exercé sur la source.

## 3. Choix de la cible — un seul formulaire (pas de « modes »)

La duplication réutilise le **formulaire de création** (`AddEditionDialog`),
**pré-rempli depuis la source** et porteur d'un `sourceId` caché. Le sélecteur
de conférence existant couvre nativement les deux cas, sans bascule dédiée :

- **conf pré-sélectionnée = celle de la source** → l'orga ne change que l'année
  (« même conf, nouvelle année », le cas courant) ;
- **l'orga choisit une autre conf** (connue ou « nouvelle conférence ») →
  « autre conférence ».

La contrainte d'unicité `(conf_slug, annee)` interdit mécaniquement de dupliquer
une édition sur elle-même ou sur une paire déjà prise : l'erreur `23505` est
déjà gérée à la création et renvoie un message clair, saisie conservée — on
réutilise le même traitement.

## 4. Modèle de données — aucun changement de schéma

Rien à migrer. La duplication est une lecture de la source + des `INSERT` dans
les tables existantes, sous une nouvelle `edition_id`. **Pas** de colonne
« dupliquée depuis » en phase 1 (YAGNI) : la traçabilité n'est pas un besoin
exprimé ; si elle le devient, une colonne `source_edition_id` nullable s'ajoutera
par migration `NNN_*.sql` (+ `schema.sql` + `sync-to-latest.sql`).

## 5. Couche métier — `duplicateEdition`

Nouvelle fonction dans `src/lib/tremplin-editions.ts` (ou un
`tremplin-duplicate.ts` dédié, comme `tremplin-import.ts`), **transactionnelle
et atomique**, sur le modèle exact d'`importTremplin1` (BEGIN / INSERT… /
COMMIT, ROLLBACK sur erreur — aucune donnée à moitié écrite) :

```ts
interface DuplicateTarget {
  confSlug: string;   // = source (nouvelle année) ou saisi (autre conf)
  annee: number;
  nom: string;        // proposé, éditable
  confNom: string | null;
  confLien: string | null;
}

/**
 * Crée une nouvelle édition en `preparation` à partir d'une source :
 * recopie les ateliers (ordre/titre/description SEULEMENT — dates, horaires,
 * lien visio, coachs et membres exclus). Ne recopie AUCUNE donnée personnelle.
 * Atomique. Renvoie l'id de la nouvelle édition. Propage 23505 si (conf, année)
 * existe déjà.
 */
async function duplicateEdition(
  sourceId: number,
  target: DuplicateTarget,
): Promise<number>
```

Étapes, dans une transaction :

1. Charger la source (`getEditionById`) — 404 clair si absente.
2. `createEdition({ …métadonnées §2, description: null, dates: null,
   statut: "preparation" }, client)`. Le conflit `(conf, année)` tombe ICI, sur
   le premier INSERT → rollback propre.
3. Recopier les ateliers : `getAteliersByEdition(sourceId)` → pour chacun,
   `createAtelier(newId, { ordre, titre, description, date: null,
   heureDebut: null, heureFin: null, lienVisio: null, coachs: null }, client)`.
4. COMMIT. En cas d'erreur → ROLLBACK + propagation (l'action remonte à l'UI).

Réutilisations : `createEdition` et `createAtelier` acceptent déjà un
`client`/`Queryable` transactionnel — rien à refactorer pour la phase 1.

## 6. Server Action + UI

### Action

Il n'y a **pas d'action dédiée** : `createEditionAction`
(`src/app/admin/tremplins/actions.ts`) porte un `sourceId` optionnel — vide →
`createEdition` (édition vierge), renseigné → `duplicateEdition` :

- `await requireOrgaId()` (réservé orga, identité par la session).
- Parse : `parseEditionForm` inchangé (réutilise `slugify`, `SLUG_RE`, la
  validation d'année et la fenêtre d'inscriptions) + un `sourceId` entier
  positif quand il est fourni. Pas de parseur parallèle.
- `duplicateEdition(sourceId, target)` ; sur `23505` → même message que la
  création (« Une édition existe déjà pour cette conférence et cette année… »),
  saisie conservée (`formValues`).
- Succès → `revalidatePath("/admin/tremplins")` puis `redirect` vers la page
  admin de la nouvelle édition (on atterrit sur le hub de la copie, en
  préparation, prête à recevoir dates et ouverture).

Sécurité : orga mono-rôle (lecture de n'importe quelle édition source légitime,
pas de scoping multi-locataire à ajouter) ; SQL paramétré via les primitives
réutilisées.

### UI — où vit le geste (deux points d'entrée, une seule action)

Créer, c'est souvent repartir de l'édition précédente : `createEditionAction`
porte un **`sourceId` optionnel** (vide → édition vierge ; renseigné →
duplication du squelette). Deux portes d'entrée l'utilisent :

1. **« Dupliquer cette édition »** sur le hub admin de l'édition source
   (`/admin/tremplins/[edition]`), à côté de « Modifier l'édition » : modale
   pré-remplie (conf de la source sélectionnée, année +1, nom proposé),
   `sourceId` en champ caché.
2. **« Créer une édition »** sur la liste des éditions : le sélecteur
   **« À partir de (optionnel) »** liste les éditions existantes comme modèles
   (« Édition vierge » par défaut).

Le récapitulatif copié / non-copié est un composant partagé
(`DuplicationRecap`), affiché dans les deux modales dès qu'un modèle est en jeu.

> **Dépendance à venir — lieu de la conférence** : la branche
> `claude/trampoline-platform-design-81em1h` (migration 028, cf.
> `docs/conception-conference-lieu.md`) sépare `conf_lieu` du nom et retire
> l'année du `conf_nom`. À son arrivée : `duplicateEdition` recopie `confLieu`,
> et `nomEditionPropose` compose nom + lieu + année depuis les champs
> structurés (le retrait d'année finale devient un simple filet legacy).

La modale affiche un **récapitulatif** clair de ce qui sera recopié et ce qui ne
le sera pas (le parcours d'ateliers ; ni participantes, ni photos, ni dates, ni
coachs, ni récompenses) — pour qu'aucune orga ne croie « repartir avec les
inscrites ».

**Invariants RGAA** (cohérents avec le reste de l'admin) : `<label>` liés à
chaque champ, `role="alert"` sur l'erreur, focus géré par `AdminDialog` (déjà
fiabilisé iOS/clavier), et le récapitulatif copié/non-copié en **vrai texte**
(jamais une icône ni une couleur seules).

## 7. Questions ouvertes (phase 2)

1. **Catalogue de récompenses** : le recopier (`intitule`, `detail`, `rang`,
   sans bénéficiaire ni suivi) ? Prérequis : `addRecompense` utilise aujourd'hui
   `pool` directement — il faudra lui passer un `db: Queryable = pool` pour
   qu'elle rejoigne la transaction (sinon une récompense insérée survivrait à un
   rollback → atomicité cassée). À faire AVANT d'ajouter cette copie.
2. **Coachs comptes des ateliers** (`tremplin_atelier_coachs`) : les recopier ?
   Les mêmes coachs reviennent souvent, mais ce sont des personnes (comptes) —
   recopier crée un lien édition→personne sans nouvelle action de leur part.
   Reco : non, laisser l'orga les re-relier.
3. **Documents généraux** (`tremplin_documents` sans atelier ni inscription =
   ressource générale) : les recopier ? Élargit le périmètre « recopié ».
4. **Traçabilité** « dupliquée depuis l'édition N° X » : non en phase 1 (§4).

## 8. Plan de tests (TDD — rouge avant vert)

**Unitaires / intégration DB** (`src/__tests__/tremplin-db.integration.test.ts`,
sur le modèle des tests d'`importTremplin1`) :

- Duplication **même conf, autre année** : nouvelle édition, même `conf_slug`,
  année cible, `statut = "preparation"`, `description` et toutes les dates
  (conf/finale/inscriptions) à null.
- Duplication **autre conf** : `conf_slug`/`conf_nom`/`conf_lien` de la cible.
- **Ateliers recopiés** : même `titre`/`ordre`/`description` ;
  `date`/`heures`/`lien_visio`/**`coachs`** à null ; **aucun membre** repris.
- **Invariant RGPD** : les 0-lignes des 8 tables + `coachs IS NULL` (liste §2),
  même quand la source en est pleine (inscrites, photos, docs, récompenses,
  membres, coachs).
- **Source inchangée** après duplication (aucun effet de bord).
- **Conflit `(conf, année)`** : rejet (23505), rien de créé (rollback).
- **Atomicité** : une insertion d'atelier qui échoue → rollback complet (édition
  comprise).

**Server Action** (`src/__tests__/actions-tremplin.test.ts`) : garde orga (refus
sans session orga), `sourceId` invalide → erreur claire, validation de la cible
(année/slug), message clair sur conflit avec saisie conservée, redirection vers
la nouvelle édition au succès.

## 9. Découpage (tranches verticales)

1. **Lib + tests** : `duplicateEdition` + tests d'intégration DB (rouge → vert).
2. **Action + form** : `createEditionAction` étendue d'un `sourceId` optionnel
   (une seule action pour créer et dupliquer), tests d'action.
3. **UI** : entrée « Dupliquer » sur le hub source + `AddEditionDialog`
   pré-rempli + revalidation + E2E léger (agnostique aux données).

Chaque tranche est livrable seule et laisse la CI verte (test + type-check +
lint + E2E). La phase 2 (récompenses, §7) est un lot distinct, après le refactor
de `addRecompense`.
