# Inscription express à l'annuaire : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** publier une fiche speakeuse en 2 écrans (nom, thèmes), et créer un talk avec son seul titre.

**Architecture :** une taxonomie à deux niveaux dans `src/data/domaines.ts` (on stocke la sous-catégorie dans `sujets`, colonne inchangée) ; une page `/mon-espace/bienvenue` et une Server Action `publierFicheExpress` qui décide côté serveur entre publication directe et relecture via une fonction pure `doitEtreRelue` ; le reste de l'ancien assistant devient facultatif.

**Tech Stack :** Next.js 16 App Router (lire `node_modules/next/dist/docs/` avant d'écrire une page), TypeScript, Zod, Postgres (`pg`), Vitest + Testing Library, Playwright.

**Spec :** `docs/superpowers/specs/2026-11-12-inscription-express-design.md`

## Global Constraints

- Tout texte affiché en français, espace insécable avant `! ? : ;`, pas de cadratin, forme positive (pas de « ne … pas / plus »), pas de tournure IA.
- Identité depuis la session, jamais du client ; SQL paramétré ; validation Zod.
- Schéma : `schema.sql` + `sync-to-latest.sql` (idempotent) + migration `db/migrations/077_themes_categories.sql` (076 est pris par `claude/tech-speakher-devoxx-669331`).
- Ne pas toucher `src/app/page.tsx` ni les fichiers Tremplin.
- TDD en deux temps : test rouge, code, vert, puis casser une fois la garde et voir le test tomber.
- Ménage machine : tests ciblés seulement (`npx vitest run <fichier>`), `nice -n 10` ; la suite complète une seule fois, à la fin, par l'orchestrateur.
- RGAA : `aria-labelledby` sur les sections, `role="alert"` pour les erreurs, `focus-visible` partout.

## Écart avec la spec, tranché ici

- **Relecture après publication** : le code actuel garde une fiche publiée visible quand elle change (`upsertProfile`, `src/lib/profiles.ts:842`) et trace la modif via `updated_at` vs `validated_at`. On garde ce comportement : `doitEtreRelue` ne décide qu'à la **première** publication. Créer un talk ou modifier un texte d'une fiche déjà publiée ne la dépublie pas. La spec est corrigée dans la tâche 7.
- **Contact** : `raisonBlocageAnnuaire` (`src/lib/profiles.ts:904`) exige LinkedIn ou `contactEmailOk`. Le bouton « Publier ma fiche » pose `contact_email_ok = true` avec la mention « Les organisateurs pourront t'écrire par le site, ton e-mail reste caché. » sous le bouton. **À confirmer par Cateline avant la tâche 4.**

## Review Focus

1. Une speakeuse déjà publiée qui ouvre `/mon-espace/bienvenue` : elle est renvoyée vers `/mon-espace`, sa fiche ne change pas de statut (test tâche 4).
2. Thème forgé hors liste envoyé à l'action : ignoré, et s'il ne reste aucun thème, refus « Choisis au moins un thème » (test tâche 4).
3. Nom vide ou fait d'espaces après `trim` : refus sur l'étape 1, rien n'est écrit (test tâche 4).
4. Fiche existante dont le seul sujet était « Autre » : après migration, `sujets = '{}'`, statut inchangé, et « Choisis tes thèmes » apparaît en tête de « Pour aller plus loin » (tests tâches 2 et 6).
5. Titre de talk de 301 caractères : refus avec le compteur visible ; 300 accepté (test tâche 5).

---

### Task 1 : taxonomie à deux niveaux

**Files :**
- Modify : `src/data/domaines.ts` (remplace `SUJETS`)
- Test : `src/__tests__/domaines-themes.test.ts`

**Interfaces :**
- Produces :
  - `export const CATEGORIES_THEMES: readonly { categorie: string; themes: readonly string[] }[]` (les 7 catégories et sous-catégories de la spec, dans l'ordre de la spec)
  - `export const THEMES: readonly string[]` (toutes les sous-catégories, aplaties)
  - `export function categorieDuTheme(theme: string): string | null`
  - `export const filterSujets` garde son nom et filtre désormais sur `THEMES`
  - `SUJETS` est supprimé ; ses usages (`ChampsSection.tsx:17,246`) passent à `THEMES` jusqu'à la tâche 3.

- [ ] **Step 1 : test rouge** — `THEMES` a 28 entrées ; aucune en double ; `categorieDuTheme("Accessibilité") === "Design"` ; `categorieDuTheme("Product marketing") === "Produit"` ; `categorieDuTheme("Autre") === null` ; `filterSujets(["Cloud", "Autre", "x"])` vaut `["Cloud"]`.
- [ ] **Step 2 :** `npx vitest run src/__tests__/domaines-themes.test.ts` → FAIL.
- [ ] **Step 3 :** implémenter dans `src/data/domaines.ts`, mettre à jour l'en-tête du fichier (deux niveaux, on stocke la sous-catégorie).
- [ ] **Step 4 :** relancer le test → PASS ; `npm run type-check` → 0 erreur (corriger les imports de `SUJETS`).
- [ ] **Step 5 :** casser : dupliquer « Cloud » dans deux catégories → le test d'unicité tombe ; remettre.
- [ ] **Step 6 :** commit `feat: thèmes en catégories et sous-catégories`.

### Task 2 : migration des anciens sujets

**Files :**
- Create : `db/migrations/077_themes_categories.sql`
- Modify : `db/sync-to-latest.sql` (même bloc, en fin de fichier)
- Create : `src/lib/reprise-sujets.ts`
- Test : `src/__tests__/reprise-sujets.test.ts`

**Interfaces :**
- Produces : `export const REPRISE_SUJETS: Readonly<Record<string, readonly string[]>>` (table de la spec, « Autre » → `[]`) et `export function reprendreSujets(anciens: string[]): string[]` (dédoublonne, garde un sujet déjà nouveau tel quel).

- [ ] **Step 1 : test rouge** — chaque clé des 11 anciens sujets est présente ; chaque valeur est dans `THEMES` ; `reprendreSujets(["Cloud / DevOps / Infra", "Cloud"])` vaut `["Cloud", "DevOps"]` ; `reprendreSujets(["Autre"])` vaut `[]` ; `reprendreSujets(["Accessibilité"])` vaut `["Accessibilité"]` (rejouable).
- [ ] **Step 2 :** lancer → FAIL.
- [ ] **Step 3 :** implémenter `reprise-sujets.ts`, puis écrire la migration SQL qui applique la même table : un `UPDATE speaker_profiles SET sujets = (SELECT ARRAY(SELECT DISTINCT … FROM unnest(sujets) …))` avec un `CASE` par ancien sujet ; idempotente (un sujet déjà nouveau passe tel quel). En-tête : le pourquoi, en quelques lignes, sans date ni PR.
- [ ] **Step 4 :** test → PASS. Ajouter à `src/__tests__/reprise-sujets.test.ts` un test qui lit le fichier SQL et vérifie que chaque clé de `REPRISE_SUJETS` y figure (garde la cohérence TS/SQL).
- [ ] **Step 5 :** `npm run e2e:db` en local (Postgres éphémère) pour vérifier que la migration passe deux fois sans erreur.
- [ ] **Step 6 :** casser : retirer une ligne du `CASE` SQL → le test de cohérence tombe ; remettre.
- [ ] **Step 7 :** commit `feat: reprise des anciens sujets vers les thèmes`.

### Task 3 : composant `ChoixThemes`

**Files :**
- Create : `src/app/mon-espace/ChoixThemes.tsx` (client)
- Modify : `src/app/mon-espace/ChampsSection.tsx:240-250` (`ChampsSujets` rend `ChoixThemes`)
- Test : `src/__tests__/choix-themes.test.tsx`

**Interfaces :**
- Consumes : `CATEGORIES_THEMES` (tâche 1).
- Produces : `export default function ChoixThemes(props: { name: string; initial: string[]; legendId: string })` ; soumet une case `name="sujets"` par thème coché.

- [ ] **Step 1 : test rouge** — 7 boutons de catégorie avec `aria-expanded="false"` ; clic sur « Design » → `aria-expanded="true"` et 4 cases visibles ; ouvrir « Produit » referme « Design » ; cocher « Accessibilité » et « UX / UI » → le bouton « Design » contient « 2 » ; le récapitulatif (`aria-live="polite"`) affiche « Tes thèmes (2) » ; un thème `initial` caché reste soumis (case présente dans le formulaire même catégorie fermée) ; tout se fait au clavier (Tab, Espace).
- [ ] **Step 2 :** lancer → FAIL.
- [ ] **Step 3 :** implémenter. Cases réelles stylées en pastilles ; une catégorie fermée garde ses cases cochées dans le DOM (`hidden` sur le conteneur, pas de démontage).
- [ ] **Step 4 :** test → PASS ; lancer aussi le test existant de `ChampsSection` s'il en a un (`grep -l ChampsSujets src/__tests__`).
- [ ] **Step 5 :** casser : démonter les cases des catégories fermées → le test « thème caché soumis » tombe ; remettre.
- [ ] **Step 6 :** commit `feat: choix des thèmes en catégories`.

### Task 4 : publication express (règle, action, page)

**Files :**
- Create : `src/lib/relecture.ts`
- Modify : `src/lib/profiles.ts:904-911` (`raisonBlocageAnnuaire`) ; ajouter `publierFiche(userId: number, statut: "publie" | "en_attente")` près de `submitForValidation` (`:1020`)
- Create : `src/lib/fiche-express-form.ts`
- Modify : `src/app/mon-espace/actions.ts` (nouvelle action)
- Create : `src/app/mon-espace/bienvenue/page.tsx`, `src/app/mon-espace/bienvenue/BienvenueForm.tsx`
- Test : `src/__tests__/relecture.test.ts`, `src/__tests__/publier-fiche-express.test.ts`

**Interfaces :**
- Consumes : `ChoixThemes`, `filterSujets`.
- Produces :
  - `export function doitEtreRelue(nomSaisi: string, nomCompte: string | null): boolean` — vrai si `nomSaisi.trim()` diffère de `nomCompte?.trim()`.
  - `export function parseFicheExpress(fd: FormData): { ok: true; data: { nom: string; sujets: string[] } } | { ok: false; errors: Record<string, string> }`
  - `export async function publierFicheExpressAction(prev: SaveState, fd: FormData): Promise<SaveState>` ; redirige vers `/mon-espace?ok=fiche_publiee` ou `/mon-espace?ok=fiche_envoyee`.
  - `raisonBlocageAnnuaire` : motifs `"nom"`, `"themes"`, `"contact"`, `"attestation"`, dans cet ordre.

- [ ] **Step 1 : tests rouges, règle** — `doitEtreRelue("Léa Martin", "Léa Martin") === false` ; `doitEtreRelue(" Léa Martin ", "Léa Martin") === false` ; `doitEtreRelue("Léa M.", "Léa Martin") === true` ; `doitEtreRelue("Léa", null) === true`. `raisonBlocageAnnuaire` sur un profil sans thème → `"themes"`.
- [ ] **Step 2 : tests rouges, action** (base mockée comme dans les tests d'action existants, `grep -l "saveProfileSection" src/__tests__`) — sans session → redirection `/connexion`, rien d'écrit ; nom `"   "` → `errors.nom`, rien d'écrit ; `sujets=["x"]` seul → `errors.sujets === "Choisis au moins un thème"` ; cas valide avec nom du compte → statut `publie`, `is_woman = true`, `contact_email_ok = true` ; nom modifié → statut `en_attente` ; profil déjà `publie` → redirection `/mon-espace`, aucun appel d'écriture ; un champ `statut=publie` forgé dans le FormData est ignoré.
- [ ] **Step 3 :** lancer les deux fichiers → FAIL.
- [ ] **Step 4 :** implémenter `relecture.ts`, `fiche-express-form.ts`, `publierFiche`, l'action. Le nom s'écrit là où `profile.name` est lu (`users.name`, vérifier dans `getProfileByUserId`).
- [ ] **Step 5 :** implémenter la page : étape 1 « Comment t'appelles-tu&nbsp;? » (prérempli depuis `session.user.name`), étape 2 « De quoi parles-tu&nbsp;? » avec `ChoixThemes` ; bouton « Publier ma fiche » ; sous le bouton : « En publiant, j'atteste être une femme ou une personne non binaire. » et « Les organisateurs pourront t'écrire par le site, ton e-mail reste caché. » Une fiche existante redirige vers `/mon-espace`.
- [ ] **Step 6 :** tests → PASS.
- [ ] **Step 7 :** casser : faire lire le statut depuis le FormData → le test « champ forgé ignoré » tombe ; retirer la garde « déjà publiée » → son test tombe ; remettre.
- [ ] **Step 8 :** commit `feat: publication express de la fiche`.

### Task 5 : talk express

**Files :**
- Modify : `src/lib/talk-limits.ts:6` (`TITRE_MAX = 300`)
- Modify : `src/app/mon-espace/talks/nouveau/page.tsx`, `src/app/mon-espace/TalkForm.tsx` (mode création : titre seul)
- Test : `src/__tests__/talk-form.test.ts` (existant, à compléter), `src/__tests__/talk-nouveau.test.tsx`

**Interfaces :**
- Consumes : `addTalkAction` (inchangée, `actions.ts:414`).
- Produces : `TalkForm` accepte `mode: "creation" | "edition"` ; en création, seul le champ `titre` est rendu.

- [ ] **Step 1 : tests rouges** — `parseTalkIdentityForm` accepte 300 caractères, refuse 301 ; la page `nouveau` rend un seul champ (`titre`), le compteur « 0 / 300 », le bouton « Enregistrer » et le lien « Importer » vers `/mon-espace/talks/importer`.
- [ ] **Step 2 :** lancer → FAIL.
- [ ] **Step 3 :** implémenter. Le champ titre reste en mode `multiligne` (il s'agrandit déjà). Texte sous le champ : « Le reste s'ajoute après, si tu veux. » Lien bas de page : « Tes talks sont sur Notist ou dans un fichier&nbsp;? Importer ».
- [ ] **Step 4 :** tests → PASS.
- [ ] **Step 5 :** casser : remettre `TITRE_MAX = 200` → le test 300 tombe ; remettre.
- [ ] **Step 6 :** commit `feat: talk créé avec son titre seul`.

### Task 6 : Mon espace, routage, annuaire

**Files :**
- Modify : `src/app/mon-espace/page.tsx` (redirection sans fiche, messages, « Pour aller plus loin »)
- Modify : `src/app/mon-espace/profil-etapes.ts` et `src/app/mon-espace/profil/page.tsx` (les `?step=` mènent à `fiche/[section]`)
- Modify : `src/app/speakeuses/SpeakeusesFilter.tsx:27` (filtre « Thèmes » par catégorie)
- Test : `src/__tests__/mon-espace-bienvenue.test.tsx`, `src/__tests__/speakeuses-filter.test.tsx` (existant ou nouveau)

**Interfaces :**
- Consumes : `categorieDuTheme`, `CATEGORIES_THEMES`.

- [ ] **Step 1 : tests rouges** — connectée sans fiche → redirection `/mon-espace/bienvenue` ; `?ok=fiche_publiee` affiche « Ta fiche est en ligne. » ; `?ok=fiche_envoyee` affiche « Ta fiche est envoyée. L'équipe la relit, en général sous 48&nbsp;h. » ; « Pour aller plus loin » liste talk, photo, ville, présentation, secteurs et liens ; fiche avec `sujets = []` → « Choisis tes thèmes » en premier ; `?step=contact` mène à la section contact ; filtre « Design » garde une fiche ayant « Accessibilité » et écarte une fiche n'ayant que « Cloud ».
- [ ] **Step 2 :** lancer → FAIL.
- [ ] **Step 3 :** implémenter.
- [ ] **Step 4 :** tests → PASS.
- [ ] **Step 5 :** casser : filtrer sur la sous-catégorie au lieu de la catégorie → le test du filtre tombe ; remettre.
- [ ] **Step 6 :** commit `feat: mon espace et annuaire à l'heure des thèmes`.

### Task 7 : E2E, docs, ménage

**Files :**
- Create : `e2e/parcours-inscription-express.spec.ts`
- Modify : `docs/superpowers/specs/2026-11-12-inscription-express-design.md` (écarts tranchés ci-dessus), `docs/dette-technique.md`, `docs/roadmap.md`, `docs/audit-e2e-parcours-2026-08.md`

- [ ] **Step 1 :** E2E avec compte jetable (`e2e/comptes-jetables.ts`) : étape 1, étape 2 avec deux thèmes dans deux catégories, « Publier ma fiche » → message attendu selon le nom ; puis « Ajouter un talk », titre seul, « Enregistrer » → page du talk. Décor via `npm run e2e:db`.
- [ ] **Step 2 :** `nice -n 10 npx playwright test e2e/parcours-inscription-express.spec.ts` → PASS.
- [ ] **Step 3 :** docs : spec corrigée, dette (soldée et nouvelle, avec date et chemin), roadmap (une seule passation, état et date dans le titre), audit E2E.
- [ ] **Step 4 :** une seule fois : `nice -n 10 npm run test`, `npm run type-check`, `npm run lint` → tout vert ; `src/__tests__/docs-passation.test.ts` vert.
- [ ] **Step 5 :** commit `test: parcours d'inscription express` puis `docs: dette et roadmap, inscription express`.
- [ ] **Step 6 :** revue avant PR selon `docs/revue-avant-pr.md` (quatre passes en agents parallèles). Rebaser sur `main` si la branche Tremplin Devoxx a été fusionnée, puis faire l'union des docs item par item.
