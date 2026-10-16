# Conception technique — Tableaux de bord, navigation, réglages (C0-C4)

> Déclinaison technique de `docs/conception-tableau-de-bord-orga.md` (v6,
> validée). Statut : **revue de conception passée** (corrections intégrées
> ci-dessous), TDD en cours. Chaque lot =
> une PR/un ensemble de commits, TDD, batterie de revues.

## C0 — Navigation globale (burger, fils racinés, renommage)

### Burger (`src/components/Header.tsx`)

Le tiroir mobile existe déjà (`mobileOpen`, `#mobile-menu`, lignes 110-135) ;
on restructure son CONTENU, pas son mécanisme :

1. **Carte d'identité** en tête (si `session?.user`) : initiale (rond) + nom +
   « Connectée · Mon espace » → lien `/mon-espace`. Déconnectée : bouton
   « Se connecter » → `/connexion`. (La session est déjà lue :
   `useSession()` ligne 14.)
2. **Section « Espace orga »** (si `user.isOrga`) : Tableau de bord `/admin`,
   Speakeuses `/admin/speakeuses`, Tremplins `/admin/tremplins` (+ Réglages
   `/admin/reglages` au lot C4).
3. **Le site** : `navLinks` (constants/navigation.ts, inchangé).
4. **« Se déconnecter »** en bas — il EXISTE déjà dans le tiroir
   (`Header.tsx:171`, `signOut`), comme « Se connecter » (`:181`) : C0 est une
   restructuration du tiroir, pas un ajout de mécanique.

Desktop : `AccountMenu` reste ; vérifier qu'il expose les mêmes entrées
plateforme (Mon espace / Espace orga) — l'aligner si besoin, sans le refondre.

### Fils d'Ariane racinés à l'espace

- `tremplinCrumbs` (`src/lib/tremplin-admin.ts:25-40`) : retirer
  `{ label: "Accueil", href: "/" }` ; la racine devient
  `{ label: "Espace orga", href: "/admin" }`.
- Balayage des pages plateforme qui construisent leurs `items` à la main
  (**9 fichiers**, grep `label: "Accueil"` sous `src/app/admin` et
  `src/app/mon-espace`) :
  racine « Espace orga » ou « Mon espace » selon l'espace. Les pages
  PUBLIQUES gardent « Accueil ».
- Racine = page courante (tableau de bord lui-même) → pas de fil (le
  composant rend `null` si un seul item sans href ? Non : on ne rend
  simplement pas de Breadcrumb sur les deux racines).

### Renommage et suppression

- « Espace speakeuse » → « Mon espace » (`mon-espace/page.tsx` sous-titre,
  metadata, textes).
- `EspaceNav` supprimé (3 usages : `admin/page.tsx:82`,
  `admin/tremplins/page.tsx:48`, `mon-espace/page.tsx:131`) + son test
  (`espace-nav.test.tsx`) retiré.

### Tests C0

- Rendu Header (session mockée) : carte d'identité présente/nom affiché ;
  section orga absente pour une non-orga ; « Se connecter » hors session.
- `tremplinCrumbs` : racine « Espace orga », plus d'« Accueil ».

## C1 — Tableau de bord orga

### Correctif N+1 (préalable)

`getAtelierMembersByEdition` (`src/lib/tremplin-ateliers.ts:218`) ajoute
`presence` au SELECT et renvoie
`Map<number, { registrationId: number; presence: Presence }[]>`.
Adapter les **4 appelants** (hub édition, page ateliers,
`mon-espace/tremplin/[edition]`, interne `tremplin-ateliers.ts:468`) —
mécanique, `membreIds` devient `.map(m => m.registrationId)` ; le type-check
les attrape tous.

### Moteur : `src/lib/taches-orga.ts` (PUR, zéro accès base)

```ts
export type Tache = { libelle: string; href: string; echeance?: string }; // ISO
export function derivierTachesOrga(e: EntreesTaches, aujourdhui: string): Tache[]
// + une fonction exportée par règle (testable seule) :
// tachesAteliersIncomplets(ateliers, membres, coachs, fenetreJours, aujourdhui)
// tachesPresencesNonPointees(ateliers, membresAvecPresences, aujourdhui)
// tachesFichesAValider(profils, slaJours, aujourdhui)   // échéance = submittedAt + sla
// tachesRecompensesAAttribuer(edition, recompenses, aujourdhui)
// tachesSansCompte(registrations, editionId)
// tachesPhotosBloquees(photos, tags, editionId)
export function libelleEcheance(echeance: string, aujourdhui: string): string
// « En retard » | « Aujourd'hui » | « N j » — la puce, dérivée, jamais stockée
```

- Tri : datées par échéance croissante, puis non datées ; stable.
- Règle 3 (sans coach) : `coachs.length === 0 && !atelier.coachs?.trim()`
  (repli texte libre hérité).
- Seuils (7 j, 15 j) reçus EN PARAMÈTRE (défauts exportés par
  `src/lib/reglages.ts`, cf. C4 — en C1 ce module n'expose que les défauts
  en dur, pas de table).

### Page `/admin` (réécrite) + `/admin/speakeuses` (déplacement)

- `/admin` : `Promise.all` — `getPendingProfiles()` + par édition non
  archivée (`listEditions` filtré) : `getAteliersByEdition`,
  `getAtelierMembersByEdition`, `getCoachsByEdition`,
  `getRecompensesByEdition`, `getPhotosByEdition`+`getPhotoTagsByEdition`
  (chacun `.catch` → entrée vide, patron du hub). Rendu : section « À faire »
  (NavRow, flag orange, puce = `libelleEcheance`) ; état vide ; section
  « Gérer » (Speakeuses, Tremplins). Breadcrumb : aucun (racine).
- `/admin/speakeuses/page.tsx` : contenu ACTUEL de `admin/page.tsx` déplacé
  tel quel (commit séparé, mécanique). Mettre à jour dans
  `src/app/admin/actions.ts` : `revalidatePath("/admin")` (×2, :67 :117),
  `redirect("/admin")` (:69) et `redirect("/admin?invite=disabled")` (:80)
  → `/admin/speakeuses` ; les lectures `searchParams` (invited/failed/err)
  déménagent avec la page.

### Tests C1

- `taches-orga.test.ts` : chaque règle (cas vrai/faux/frontière : atelier à
  exactement 7 j, présence partiellement pointée, texte libre coach, SLA
  J-15/J0/retard), tri, `libelleEcheance`.
- Rendu `/admin` (libs mockées) : tâches affichées triées, état vide, accès.
- Intégration pg-mem : `getAtelierMembersByEdition` avec `presence`.

## C2 — Mon espace adaptatif

- **Données** : nouveau `src/lib/mes-ateliers.ts` —
  `getMesProchainsAteliers(userId)` : UNE requête SQL (UNION participation
  via `tremplin_atelier_membres`+`tremplin_registrations`, animation via
  `tremplin_atelier_coachs`) → `{ atelierId, titre, date, heures, lienVisio,
  role: "participe" | "anime", editionNom }[]`, date ≥ aujourd'hui, tri asc.
- **Page** (`mon-espace/page.tsx`) :
  - Sous-titre « Mon espace » ; salutation sans repli « speakeuse ».
  - Hero fiche : rendu si `profile` existe, OU (tranché en revue, aligné sur
    la conception fonctionnelle) si le compte peut créer une fiche
    (`genre !== 'homme'`) et n'a RIEN d'autre à voir sur la page (ni atelier,
    ni édition, ni rôle coach) : une nouvelle venue garde l'onboarding
    complet. Sinon, carte reléguée « Créer ma fiche speakeuse ? » UNIQUEMENT
    si `users.genre !== 'homme'` (requête légère `getUserGenre`).
  - Bloc « Prochains ateliers » (rangées fixes, puce « Tu animes » si
    `role === "anime"` ET liste mixte).
  - Zone danger : copie conditionnelle (pas de « ta fiche, tes talks » sans
    fiche).
- **Tests** : intégration pg-mem `getMesProchainsAteliers` (participe seul,
  anime seul, les deux, passé exclu, tri) ; rendu coach-seul (pas de hero,
  bloc ateliers présent) vs speakeuse.

## C3 — Sous-nav d'édition, hub « À faire », sommaires

- **`src/app/admin/tremplins/[edition]/layout.tsx`** (nouveau — aucun layout
  existant à cet étage) : charge l'édition (nom) via `loadEditionOrNotFound`
  **enveloppé dans `React.cache()`** (aucune mémoïsation par requête dans le
  code aujourd'hui : sans ça, layout + page = double requête), rend le
  Breadcrumb raciné + `EditionSousNav` (6 pastilles :
  Édition, Ateliers, Participantes, Finale, Photos, Ressources ; actif par
  segment d'URL via `useSelectedLayoutSegment` dans un petit client
  component) au-dessus de `children`. Les pages cessent de rendre leur
  propre Breadcrumb (retrait dans chaque page du sous-arbre).
- **Hub édition** : les 7 `NavRow` domaines disparaissent → section « À faire
  sur cette édition » (moteur C1 filtré `editionId`) + bloc « L'édition »
  (EditEditionDialog) + zone danger. Jury et Récompenses restent des pages
  (URLs inchangées), liées depuis la page Finale (cross-links existants à
  compléter côté Récompenses).
- **Sommaires (une page = une fonction)** : fiche atelier →
  `/ateliers/[atelier]` devient sommaire (rangées : visio, présences,
  coachs, infos, documents — valeur actuelle en sous-titre) ; sous-pages
  `/visio`, `/presences`, `/coachs`, `/infos`, `/documents` qui REMONTENT les
  blocs existants (CarteSection + InlineActionForm/PersonPicker inchangés,
  déplacés). Idem fiche participante (rangées : visibilité+galerie, parcours/
  phases, récompenses, coaching, compte, documents, retrait). Pas de nouveau composant :
  `NavRow` (titre + sous-titre + href + flag) EST la rangée de sommaire.
- **Découpage interne** : C3a (layout + sous-nav + hub) puis C3b (sommaire
  atelier) puis C3c (sommaire participante) — trois PR courtes.
- **Tests** : sous-nav (actif par segment, 6 entrées), hub (tâches édition,
  plus de rangées domaines), chaque sous-page (rendu + action existante
  toujours branchée), redirections éventuelles d'anciennes ancres.

## C4 — Réglages plateforme

- **Base** : migration `029_plateforme_reglages.sql` (028 pris par conference_lieu) —
  `plateforme_reglages(cle TEXT PRIMARY KEY, valeur TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now())` + bloc idempotent
  `sync-to-latest.sql`. Pas de seed : les défauts vivent dans le code.
- **Lib `src/lib/reglages.ts`** :
  ```ts
  export const REGLAGES_DEFAUT = {
    validation_fiche_jours: 15,
    alerte_atelier_jours: 7,
    rappel_fiche_jours: 180,
  } as const;
  export type CleReglage = keyof typeof REGLAGES_DEFAUT;
  export async function getReglages(): Promise<Record<CleReglage, number>>
  // 1 SELECT, .catch → défauts (le moteur marche sans la table)
  export async function setReglage(cle: CleReglage, valeur: number): Promise<void>
  ```
- **Pages** : `/admin/reglages` sommaire (3 rangées, valeur en sous-titre) +
  sous-pages mono-fonction (`/admin/reglages/[cle]` générique : titre,
  input number borné, UN CTA) ; action serveur `setReglageAction`
  (requireOrgaId, zod int 1-365, revalidate `/admin` + `/admin/reglages`).
- **Branchements** : moteur C1 (`getReglages()` en tête de page `/admin`) ;
  cron de rappel existant (`getProfilesDueForReminder`,
  `src/lib/profiles.ts:265`) : l'INTERVAL « 6 mois » est en dur dans le SQL →
  le paramétrer en jours (`now() - ($1 * INTERVAL '1 day')`).
- **Tests** : lib (défauts si table absente, parse), action (garde, bornes),
  moteur avec seuils personnalisés.

## Ordre, risques, RGPD

- Ordre : C0 → C1 → C2 → C3a/b/c → C4 (C4 peut passer avant C3 si besoin).
- **Risques** : C0 touche le Header global (régression publique possible →
  tests de rendu + vérif manuelle preview) ; C1 change la signature de
  `getAtelierMembersByEdition` (appelants à balayer, type-check les attrape) ;
  C3 déplace des URLs internes de fiches (aucune URL publique).
- **RGPD** : rien de nouveau n'est exposé — les tâches citent des noms déjà
  visibles des seules orgas (pages gardées) ; `getMesProchainsAteliers` ne
  renvoie que les données de l'utilisatrice connectée ; les réglages sont
  des entiers sans donnée personnelle.
- **Perf** : `/admin` ≈ 1 + 6×N requêtes (N = éditions actives, 1-3),
  parallélisées ; « revoir si > 5 éditions » (agrégat SQL).
