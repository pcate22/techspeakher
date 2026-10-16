# Les phases comme colonne vertébrale d'une édition — conception (D)

> 2026-07-04. Fait suite à `docs/parcours-participante.md` (les 3 phases
> existent déjà comme **phase d'entrée** d'une inscription). Cette conception
> **ne réimplémente pas** ce qui est là : elle fait des phases le fil qui
> **organise** l'édition côté orga — ateliers rangés par phase, participantes
> vues par phase, et une phase 2 qui rassemble ce qui gravite autour de la
> soirée (jury, documents du jury, gagnantes, récompenses).
>
> **Statut : à valider avant implémentation.** Les points à trancher sont en
> section 7.

## 1. Le besoin (mots de l'orga)

> « On aura phase 1 avant la soirée / phase 2 (plus tard avec le jury, les
> documents du jury…) les gagnantes puis récompenses, etc. / phase 3
> préparation à la conférence DevFest. »
>
> « Il faudrait en fait dire **qui participe à quelle phase**, et que **les
> ateliers soient aussi par phase** : ceux avant et ceux après la soirée. »

Trois attentes concrètes :

1. **Les ateliers se lisent par phase** — un bloc « avant la soirée », un bloc
   « après la soirée ». Aujourd'hui c'est une liste plate ordonnée par `ordre`.
2. **Les participantes se lisent par phase** — on voit d'un coup qui est en
   phase 1, qui est arrivée à/après la soirée. Aujourd'hui la liste est triée
   par nom, la phase n'est qu'un compteur en tête.
3. **La phase 2 est un moment identifié** — la soirée et son après immédiat :
   jury, documents du jury, gagnantes, récompenses. Ces objets existent déjà
   (finalistes, documents `feedback_jury`, récompenses) mais sont éparpillés.

## 2. Ce qui existe déjà (ne rien réinventer)

| Brique | État | Où |
| --- | --- | --- |
| 3 phases (enum) | ✅ `PhaseEntree` = `cfp_et_pitch` \| `finale` \| `montee_sur_scene` | `tremplin-registrations.ts` |
| Phase d'entrée d'une inscription | ✅ colonne `phase_entree`, pré-remplie, éditable sur la fiche | migration 019 |
| Finalistes / présentes à la soirée | ✅ `finale_presente` | migration ≤ 019 |
| Récompenses + bénéficiaires | ✅ table dédiée, section publique | migration 018 |
| Documents « retour jury » | ✅ type `feedback_jury` | `tremplin-documents.ts` |
| Présences par atelier (tri-état) | ✅ `presence` | migration 019 |
| Compteurs par phase | ✅ ligne de synthèse | `participantes/page.tsx` |

**Le manque** : les phases ne sont pas une **dimension d'organisation**. Un
atelier n'a pas de phase ; les listes ne sont pas sectionnées ; la phase 2
n'est pas un endroit qu'on ouvre.

## 3. Vocabulaire : redéfinir les 3 phases avec les mots de l'orga

On garde l'enum (mêmes valeurs, migrations déjà en prod) mais on **réaligne les
libellés** sur la découpe « avant / soirée / après » :

| Valeur enum | Libellé actuel | Libellé proposé |
| --- | --- | --- |
| `cfp_et_pitch` | Phase 1 · Accompagnement CFP et pitch | **Phase 1 · Avant la soirée** — accompagnement CFP et pitch |
| `finale` | Phase 2 · Finale du tremplin | **Phase 2 · La soirée et le jury** — finale, délibération, gagnantes, récompenses |
| `montee_sur_scene` | Phase 3 · Accompagnement montée sur scène | **Phase 3 · Après la soirée** — préparation DevFest, montée sur scène |

> Pas de migration : ce sont des libellés (`PHASE_ENTREE_LABEL`). Un libellé
> court additionnel (`PHASE_ENTREE_LABEL_COURT` : « Avant la soirée » / « La
> soirée » / « Après la soirée ») sert d'en-tête de section.

## 4. Modèle : donner une phase aux ateliers

Un atelier appartient à une phase. En pratique un atelier est **avant** (prépa
CFP/pitch) ou **après** la soirée (prépa DevFest) — la phase 2 est la soirée
elle-même, on n'y « fait » pas d'atelier. On réutilise donc les deux valeurs
utiles de l'enum plutôt qu'inventer un vocabulaire parallèle :

```sql
-- migration 0NN
ALTER TABLE tremplin_ateliers ADD COLUMN phase TEXT NOT NULL
  DEFAULT 'cfp_et_pitch'
  CHECK (phase IN ('cfp_et_pitch', 'montee_sur_scene'));
```

- **Pré-remplissage à la création** (comme `phase_entree`) : si l'édition a
  une `finaleDate` passée → `montee_sur_scene` (après), sinon `cfp_et_pitch`
  (avant). Modifiable sur la fiche de l'atelier (sélecteur, enregistré à la
  volée — cf. doctrine modales prévisibles).
- **Idempotent** dans `sync-to-latest.sql` (`ADD COLUMN IF NOT EXISTS`).
- **Reprise 2026** : les 5 ateliers importés restent en phase 1 (défaut) — ils
  étaient tous avant la soirée.

### Pourquoi une colonne plutôt qu'une dérivation par date

On pourrait déduire la phase de `atelier.date < edition.finaleDate`. Rejeté :

- un atelier peut ne pas avoir de date (créé en une ligne, complété ensuite) —
  il serait alors inclassable ;
- `finaleDate` peut être absente (édition en préparation) ;
- l'orga veut pouvoir **ranger** un atelier explicitement (ex. un atelier de
  prépa DevFest planifié avant la soirée reste « phase 3 »).

La colonne est la source de vérité ; la date pré-remplit, ne contraint pas.

## 5. UI : sectionner, sans alourdir le hub

Le hub reste **par domaine** (ateliers, participantes, photos, récompenses,
ressources) — la refonte #111 l'a posé, on ne le change pas ici. Les phases
structurent **l'intérieur** des listes concernées.

### 5.1 Liste des ateliers — regroupée par phase

```
Ateliers
  Avant la soirée (3)
    • Atelier CFP …        date · réservé (4) · coach …
    • …
  Après la soirée (2)
    • Coaching DevFest …   date · ouvert à toutes
```

- En-têtes de section (`<h2>` `aria-labelledby`), une `role="list"` par bloc.
- Une section n'apparaît que si elle contient au moins un atelier.
- La création en ligne reste identique ; le nouvel atelier tombe dans la phase
  pré-remplie et l'orga le déplace au besoin depuis sa fiche.

### 5.2 Liste des participantes — regroupée par phase

Les compteurs de tête deviennent des **sections** :

```
Participantes
  Phase 1 · Avant la soirée (13)   — dont 9 venues aux ateliers
    • …
  Phase 2 · La soirée et le jury (8 finalistes)
    • …  ★ (finaliste)  🏆 (récompensée)
  Phase 3 · Après la soirée (3)
    • …
```

- La section d'une participante = sa `phase_entree` (choix unique, cf. §7 A).
- Les badges existants (`✓` compte relié, `●` visible, `★` finaliste) sont
  conservés ; on ajoute un badge « 🏆 » si elle a une récompense.
- La ligne de synthèse actuelle est absorbée par les compteurs de section.

### 5.3 Phase 2 — une vue qui rassemble (pas une nouvelle table)

La phase 2 est surtout un **regroupement de vues** existantes. Deux options
d'implémentation (cf. §7 C) ; la plus légère : sur le **hub**, une carte
« La soirée et le jury » qui pointe vers un écran agrégé listant, pour
l'édition : finalistes, récompenses et leurs bénéficiaires, documents
`feedback_jury`. Rien de nouveau en base ; on relie ce qui existe.

### 5.4 Fiche atelier — sélecteur de phase

Carte « Parcours » (symétrique de la fiche participante) : un sélecteur
Avant la soirée / Après la soirée, enregistré à la volée. `setAtelierPhaseAction`
scopé à l'édition, réservé orga.

## 6. Phasage TDD (une fois la conception validée)

Rien ne merge en rouge ; tests avant code.

1. **Migration 0NN** (`schema.sql` + `sync-to-latest.sql` + `migrations/0NN_*.sql`)
   — `tremplin_ateliers.phase`. Test de dérive de schéma (PGlite).
2. **Lib** `tremplin-ateliers.ts` — `phase` dans `Atelier`/`AtelierInput`/`mapRow`,
   pré-remplissage à la création, `setAtelierPhase(atelierId, editionId, phase)`,
   `isPhaseAtelier`. Helper de regroupement `grouperParPhase`. Tests unitaires
   (intégration pg-mem pour `setAtelierPhase` scopé édition).
3. **Action** `setAtelierPhaseAction` — garde orga, `revalidatePath(..., "layout")`.
   Tests d'autorisation + scope + valeur inconnue.
4. **UI** — sections dans `ateliers/page.tsx` et `participantes/page.tsx`,
   sélecteur sur la fiche atelier, libellés courts. (Vue phase 2 = lot séparé,
   cf. §7 C.)
5. **RGAA** — en-têtes de section, `role="list"`, `focus-visible`.

Chaque lot = un commit ; conception d'abord, puis rouge → vert → refactor.

## 7. Décisions à trancher (orga)

**A. Une inscription appartient-elle à UNE phase, ou peut-elle participer à
plusieurs ?**
Recommandation : **une seule** (sa `phase_entree`). Les faits transverses sont
déjà portés à part — `finale_presente` (a fait la soirée), récompense (a gagné).
Un modèle multi-phases (table de liaison) est plus lourd sans besoin démontré.
→ *Si tu confirmes, on section par `phase_entree` et on garde les flags.*

**B. Ateliers : colonne `phase` explicite (recommandé) ou dérivée de la date ?**
Recommandation : **colonne explicite**, pré-remplie par la date, éditable.
Raisons en §4. → *Alternative : pas de migration, on dérive de
`date < finaleDate` (mais ateliers sans date inclassables).*

> Distinction classement / récompenses : la phase 2 doit garder **le podium
> (1ère/2ᵉ/3ᵉ, mérite immuable) séparé des récompenses** (attribuables,
> transférables). Modèle détaillé — classement, récompense théorique du rang,
> récompenses réellement attribuées, transfert dans les deux sens — dans
> `docs/recompenses-tremplin.md` §4 (révision 2026-07-05, à valider).

**C. Phase 2 : simple vue agrégée (recommandé) ou nouvel espace « jury » ?**
Recommandation pour ce lot : **vue agrégée** (carte hub → écran qui liste
finalistes + récompenses + documents jury). Un vrai rôle « jury » (membres du
jury, accès dédié à des documents) est un chantier à part — à ouvrir seulement
si l'orga en a besoin. → *Dis-moi si « documents du jury » = juste des
documents typés (déjà là) ou un espace où le jury dépose/consulte.*

**D. Libellés de phase** — OK pour « Avant la soirée / La soirée et le jury /
Après la soirée » (§3) ? → *Sinon, donne les intitulés que tu préfères.*

## 8. Hors périmètre (rappels)

- **Rien de public** : les phases sont une organisation interne. La galerie et
  le palmarès publics restent pilotés par le seul consentement.
- **Tâche C (#29)** « Toutes » (tout cocher candidates / présences) devient
  *phase-aware* une fois D en place (« cocher toutes les phase 1 ») — traité
  après D.
- **Tâche E** (page /admin en hub) : indépendante ; les phases n'y changent
  rien.

## 9. Arbitrages tranchés (orga, 2026-07-05)

> Ces décisions PRÉCISENT et modifient §7 sur deux points (participation
> multi-phase, jury à lister). Personas d'exemple fictifs.

### 9.1 Libellés (arbitrage D)

- Phase 1 — **Préparation CFP** (avant la soirée)
- Phase 2 — **Finale** (soirée, jury, gagnantes, récompenses)
- Phase 3 — **Préparation conférence** (montée sur scène, DevFest)

On garde les valeurs d'enum existantes (`cfp_et_pitch` / `finale` /
`montee_sur_scene`), on ne change que les libellés `PHASE_ENTREE_LABEL`.
*(Proposition de raffinage possible : « Préparation au CFP » / « Finale » /
« Préparation à la conférence » — à confirmer, sinon on garde tes intitulés.)*

### 9.2 Participation MULTI-PHASE (arbitrage 1 — change §7 A)

> « Pour chaque étape on peut avoir des participantes différentes ; la phase 2
> dépend de la phase 1, mais pas la phase 3. »

Donc **pas** une phase d'entrée unique : une inscription peut participer à
**plusieurs phases**, avec des rosters différents par phase.

- **Modèle** : table de liaison `tremplin_registration_phases (registration_id,
  phase)` — l'ensemble des phases auxquelles chaque inscription participe.
- **Phase 2 (finale)** : le roster = les finalistes. On **réutilise
  `finale_presente`** comme source de vérité du roster phase 2 (pas de double
  source ; la galerie publique en dépend déjà). Les phases 1 et 3 sont gérées
  par la table de liaison.
  *(Alternative uniforme : tout dans la table de liaison, `finale_presente`
  dérivé — plus lourd, à trancher à l'implémentation.)*
- **Dépendances** : phase 2 ⊂ phase 1 (aide UI : proposer les membres phase 1) ;
  phase 3 indépendante (on peut ajouter quelqu'un qui n'était pas en phase 1).
- **`phase_entree`** existant : devient soit « phase d'entrée » informative, soit
  retiré au profit de l'appartenance. À trancher à l'implémentation (probable :
  on garde `phase_entree` pour l'affichage « entrée en phase N », l'appartenance
  pilote les rosters).

### 9.3 Ateliers par phase + cohérence des dates (arbitrage 2)

- Colonne `phase` sur `tremplin_ateliers` (cf. §4), pré-remplie à la création.
- **Contrôle de cohérence date ↔ phase** (nouveau) : à l'enregistrement, refuser
  une date incohérente avec la phase relativement à la finale
  (`finaleDate`) — un atelier « Préparation CFP » (phase 1) daté APRÈS la finale,
  ou « Préparation conférence » (phase 3) daté AVANT, est rejeté avec un message
  clair. Si la finale n'a pas de date, on ne contraint pas.

### 9.4 Jury à lister (arbitrage 3)

Vue agrégée pour l'instant, MAIS on veut **lister le jury**, y compris des
personnes **sans compte** :

- **Modèle** : `tremplin_jury (id, edition_id, nom, prenom, fonction, entreprise
  NULL, email NULL)` — pas de compte requis (comme les tags photo « nom libre »).
- **Données personnelles** : nom/prénom/fonction/entreprise/e-mail de tiers →
  **e-mail jamais public** ; l'affichage public de la liste (nom + fonction +
  entreprise) est **à confirmer** (cf. décision ci-dessous).

### 9.5 Décisions restantes (avant implémentation)

1. **Jury public ou interne ?** Affiche-t-on la liste du jury sur la page
   publique d'édition (nom + fonction + entreprise, e-mail jamais) — comme on
   ferait pour des partenaires — ou reste-t-elle **interne** (orga) pour
   l'instant ? *(défaut prudent proposé : interne, e-mail jamais exposé.)*
2. **Réconciliation `finale_presente` / appartenance phase 2** : réutiliser
   `finale_presente` (proposé) ou tout mettre dans la table de liaison ?

### 9.6 UX de la fiche participante (arbitrage 1, suite — 2026-07-05)

> « Quand un paramètre en conditionne un autre : un TOGGLE niveau 1 qui donne
> accès à une case à cocher niveau 2. »

La Finale (phase 2) dépend de la phase 1 → structure hiérarchique :

- **Toggle « Phase 1 · Préparation CFP »** (appartenance, table de liaison). Une
  fois activé, il débloque au niveau 2 :
  - **Case « Finaliste (phase 2 · Finale) »** → pilote `finale_presente`
    (source de vérité du roster phase 2, cf. §9.2). Désactivée si la phase 1 est
    off (on ne peut pas être finaliste sans avoir participé à la phase 1).
- **Toggle « Phase 3 · Préparation conférence »** (appartenance) — indépendant.

Remplace l'ancien sélecteur unique « phase d'entrée » (option A retenue). La
liste des participantes se section par phase : une personne apparaît dans chaque
phase où elle participe (roster de chaque phase).

### 9.7 Décisions d'implémentation (Lot 3, 2026-07-05)

- **Table de liaison** : `tremplin_registration_phases` gère les phases 1 et 3 ;
  la phase 2 (finale) reste sur `finale_presente` (source de vérité unique).
- **Entrée par défaut en phase 1** : toute inscription (reprise, saisie orga,
  invitation) reçoit l'appartenance `cfp_et_pitch` à la création
  (`seedDefaultPhaseMembership`, même transaction). La reprise de l'existant se
  fait par backfill idempotent dérivé de `phase_entree` (migration 025).
- **Invariant phase 2 ⊂ phase 1** : retirer la phase 1 retire aussi le statut
  finaliste (côté action) ; la fiche prévient l'orga par une confirmation quand
  la personne est finaliste.
- **UI (KISS)** : on réutilise l'idiome bouton-bascule existant (comme
  Finaliste / Visibilité) plutôt qu'un nouveau composant client. La phase 2
  n'apparaît que si la phase 1 est active (« donne accès à »).
- **`phase_entree`** : colonne conservée (compat, `setRegistrationPhaseAction`
  toujours exposée) mais plus pilotée depuis la fiche ; l'appartenance pilote
  désormais les rosters.

### 9.8 Jury (Lot 4, 2026-07-05)

Décision 9.5.1 tranchée : le jury est **public** (nom, prénom, fonction,
entreprise ; accord recueilli). L'e-mail reste **interne** (contact orga),
jamais sérialisé : le DTO public `PublicJury` ne le porte pas.

- **Modèle** : `tremplin_jury` (migration 025), personnes sans compte.
- **Orga** : page `jury/` (ajout via modale, liste, retrait) + carte au hub.
- **Public** : la base fait foi dès qu'un juré y est saisi ; sinon repli sur la
  liste éditoriale `src/data/tremplin` (même logique que les prix, pour ne pas
  dupliquer ni vider la section jury de la page publique).

### 9.9 Vue finale / phase 2 (Lot 5, 2026-07-05)

Page `finale/` (carte au hub) : cockpit de la soirée réunissant le roster sur
scène (finalistes, triés podium d'abord), leurs récompenses et l'état de leur
retour du jury (déposé / à déposer), et la liste du jury. Lecture agrégée ; les
modifications se font sur les fiches dédiées (participante, récompense, jury).

### 9.10 UX interrupteurs (retour orga sur preview)

Pattern « réglages » (interrupteur niveau 1 → contrôle dépendant niveau 2),
composant réutilisable `SettingToggle` (interrupteur ou case à cocher,
accessible, enregistrement à la volée) :

- **Fiche participante** : phases 1 et 3 en interrupteurs ; la case « Finaliste
  (phase 2) » n'apparaît que si la phase 1 est active (dépendance).
- **Fiche atelier** : « Qui participe » et « Présences » FUSIONNÉES en une seule
  liste (fini les deux endroits). Chaque inscrite est un interrupteur
  « participe » ; sa case « Présente » n'apparaît qu'une fois activée. Activer la
  1ʳᵉ inscrite réserve l'atelier (sinon ouvert à toutes). La présence devient
  binaire (présente / absente via la case) au lieu du tri-état — cochée =
  présente, décochée = absente ; « non renseignée » reste l'état initial non
  pointé (case décochée). Ajouter une membre est idempotent et préserve sa
  présence déjà pointée.
