# Implémentation — référence partagée des conférences

> Plan d'implémentation de `docs/conception-registre-conferences.md` (conception
> revue : fonctionnelle + technique). Ce doc est prescriptif : lots, SQL,
> contrats de code, tests, procédure de déploiement. TDD sur chaque lot
> (rouge → vert → refactor), rien ne merge en rouge.

## Vue d'ensemble des lots

| # | Lot | Merge | Risque principal |
|---|---|---|---|
| 1 | Référence + migration + rebranchement moissonneur | un seul merge, procédure §Déploiement | remap `event_id`, drift-test |
| 2 (D) | Seed France + sync meetups Toulouse Tech Hub | indépendant | format `events.json` non contractuel |
| 3 (A) | UI orga + contribution membre + moisson à la demande | indépendant | anti-abus, UX endpoint |
| 4 (B) | Talk manuel : `known[]` + `edition_id` + pré-remplissage | indépendant | datalist/champs non contrôlés |
| 5 (C) | Tremplins : `conference_edition_id` | indépendant | aucun (colonne posée au lot 1) |

Chaque lot : `npm run test` + `npm run type-check` + `npm run lint` verts
avant merge. Les lots 2-5 sont sans migration (tout le schéma passe au lot 1).

---

## Lot 1 — Référence + migration + rebranchement

### 1.1 Fichiers

- **Créer** : `db/migrations/027_conferences.sql`
- **Modifier** : `db/schema.sql`, `db/sync-to-latest.sql`,
  `src/lib/cfp-suggestions.ts`, `docs/exploitation.md`,
  `src/__tests__/cfp-suggestions-db.integration.test.ts`,
  `src/__tests__/talks-cfp-reads.integration.test.ts`,
  `src/__tests__/db-contract.test.ts`, `src/__tests__/cfp-suggestions.test.ts`
- **Intacts (à vérifier en CI, pas toucher)** : `src/lib/cfp-sync.ts`,
  `src/lib/cfp-import.ts`, `src/app/api/cron/sync-talks/route.ts`,
  `cfp-sync.test.ts`, `cron-sync-talks.test.ts`

### 1.2 SQL (migration `027`, dupliqué dans `sync-to-latest.sql`, état final dans `schema.sql`)

Contraintes de forme : `db-schema-drift.test.ts` compare colonnes + **noms** de
contraintes/index entre `schema.sql` et `sync-to-latest.sql` → mêmes noms
exacts partout. Placement : dans `schema.sql` (fichier 100 % `CREATE`, aucun
`ALTER`), `conferences` + `conference_editions` doivent être créées **avant
`speaker_talks`** (qui porte `edition_id` inline) — donc juste après les
tables Auth.js ; dans `sync-to-latest.sql`, avant le `CREATE TABLE
talk_suggestions`, dont la FK inline devient `REFERENCES
conference_editions(id) ON DELETE RESTRICT` (le vieux bloc DO de correction
CASCADE→RESTRICT vers `cfp_events` reste tel quel : no-op après remap).
`cfp_events` **conservée** dans les deux fichiers (vide sur base neuve),
retirée plus tard par une migration des deux fichiers en même temps.
L'en-tête du fichier `027` reprend la **procédure de déploiement** (§ final).

```sql
-- 1. Tables
CREATE TABLE IF NOT EXISTS conferences (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  nom TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'conference',   -- 'conference' | 'asso'
  ville TEXT, pays TEXT, site_url TEXT
);
CREATE TABLE IF NOT EXISTS conference_editions (
  id SERIAL PRIMARY KEY,
  conference_id INTEGER NOT NULL REFERENCES conferences(id) ON DELETE RESTRICT,
  type TEXT NOT NULL DEFAULT 'edition',      -- 'edition' | 'meetup'
  nom TEXT,                                  -- titre du meetup ; NULL pour une édition
  annee INTEGER, date_debut DATE, date_fin DATE,
  ville TEXT, pays TEXT, lieu TEXT, url TEXT,
  source TEXT, endpoint TEXT,
  actif BOOLEAN NOT NULL DEFAULT FALSE,
  propose_par INTEGER REFERENCES users(id) ON DELETE SET NULL,
  meetup_id TEXT UNIQUE,
  CONSTRAINT conf_editions_source_endpoint_coherents
    CHECK ((source IS NULL) = (endpoint IS NULL))
);

-- 2. Index
CREATE UNIQUE INDEX IF NOT EXISTS conf_editions_source_endpoint_key
  ON conference_editions (source, endpoint) WHERE endpoint IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS conf_editions_conf_annee
  ON conference_editions (conference_id, annee) WHERE annee IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conf_editions_conference
  ON conference_editions (conference_id);
CREATE INDEX IF NOT EXISTS idx_conf_editions_date_debut
  ON conference_editions (date_debut);

-- 3. Reprise + remap, UNE FOIS : gardé par la CIBLE de la FK.
DO $$
BEGIN
  IF to_regclass('cfp_events') IS NOT NULL
     AND (SELECT confrelid::regclass::text FROM pg_constraint
           WHERE conname = 'talk_suggestions_event_id_fkey') = 'cfp_events' THEN

    -- 3a. Garde anti-collision : deux cfp_events avec suffixe d'année → même
    --     (conf, année) ⇒ stop. (Deux événements de même nom SANS année sont
    --     légitimes : annee NULL n'est pas contrainte par l'index partiel.)
    IF EXISTS (
      SELECT 1 FROM cfp_events
      WHERE substring(nom FROM '\s((19|20)\d{2})$') IS NOT NULL
      GROUP BY regexp_replace(nom, '\s+(19|20)\d{2}$', ''),
               substring(nom FROM '\s((19|20)\d{2})$')
      HAVING count(*) > 1
    ) THEN
      RAISE EXCEPTION 'cfp_events : doublon conf/année, réconciliation manuelle requise';
    END IF;

    -- 3b. Conférences (nom débarrassé du suffixe année ; slug dérivé).
    --     site_url volontairement NULL : cfp_events.url est une URL d'ÉDITION
    --     (elle va sur l'édition en 3c) ; le site de la conf sera posé via
    --     l'UI orga (lot 3).
    INSERT INTO conferences (slug, nom, ville, pays)
    SELECT DISTINCT
      trim(BOTH '-' FROM lower(regexp_replace(
        translate(regexp_replace(nom, '\s+(19|20)\d{2}$', ''),
                  'àâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ',
                  'aaaeeeeiioouuucAAAEEEEIIOOUUUC'),
        '[^a-zA-Z0-9]+', '-', 'g'))),
      regexp_replace(nom, '\s+(19|20)\d{2}$', ''), ville, pays
      FROM cfp_events
    ON CONFLICT (slug) DO NOTHING;

    -- 3c. Une édition PAR ligne (1-1) ; annee SEULEMENT si le nom finit par
    --     l'année (sinon NULL et le libellé recomposé = ancien nom, identique).
    INSERT INTO conference_editions
      (conference_id, annee, date_debut, ville, pays, url, source, endpoint, actif)
    SELECT c.id, substring(e.nom FROM '\s((19|20)\d{2})$')::int,
           e.date_debut, e.ville, e.pays, e.url, e.source, e.endpoint, e.actif
      FROM cfp_events e
      JOIN conferences c ON c.nom = regexp_replace(e.nom, '\s+(19|20)\d{2}$', '')
    ON CONFLICT (source, endpoint) WHERE endpoint IS NOT NULL DO NOTHING;

    -- 3c-bis. Garde loud-fail : TOUTE ligne cfp_events doit avoir son édition
    --     (une collision de slug en 3b — casse/accents — laisserait des
    --     lignes orphelines et le remap 3d pointerait la MAUVAISE édition en
    --     silence, les SERIAL des deux tables se chevauchant).
    IF EXISTS (
      SELECT 1 FROM cfp_events e
      LEFT JOIN conference_editions ce
        ON ce.source = e.source AND ce.endpoint = e.endpoint
      WHERE ce.id IS NULL
    ) THEN
      RAISE EXCEPTION 'cfp_events : ligne sans édition correspondante (collision de slug ?), réconciliation manuelle';
    END IF;

    -- 3d. DROP FK → remap par clé naturelle → ADD FK (même nom, RESTRICT).
    ALTER TABLE talk_suggestions DROP CONSTRAINT talk_suggestions_event_id_fkey;
    UPDATE talk_suggestions s SET event_id = ce.id
      FROM cfp_events e
      JOIN conference_editions ce
        ON ce.source = e.source AND ce.endpoint = e.endpoint
     WHERE s.event_id = e.id;
    ALTER TABLE talk_suggestions ADD CONSTRAINT talk_suggestions_event_id_fkey
      FOREIGN KEY (event_id) REFERENCES conference_editions(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- 4. Colonnes de rattachement (nullable, sans backfill)
ALTER TABLE speaker_talks ADD COLUMN IF NOT EXISTS edition_id
  INTEGER REFERENCES conference_editions(id) ON DELETE SET NULL;
ALTER TABLE tremplin_editions ADD COLUMN IF NOT EXISTS conference_edition_id
  INTEGER REFERENCES conference_editions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_speaker_talks_edition ON speaker_talks (edition_id);
```

Dans `schema.sql` : `talk_suggestions.event_id` référence directement
`conference_editions(id)` (le nom de FK généré doit rester
`talk_suggestions_event_id_fkey`).

### 1.3 Code

`src/lib/cfp-suggestions.ts` — deux requêtes changent, le reste est intact :

- `getActiveCfpEvents()` : **contrat `CfpEvent` inchangé** (id = id d'édition).
  ```sql
  SELECT e.id,
         c.nom || COALESCE(' ' || e.annee::text, '') AS nom,
         e.source, e.endpoint, e.url,
         COALESCE(e.ville, c.ville) AS ville,
         COALESCE(e.pays,  c.pays)  AS pays,
         to_char(e.date_debut, 'YYYY-MM-DD') AS date_debut
    FROM conference_editions e
    JOIN conferences c ON c.id = e.conference_id
   WHERE e.endpoint IS NOT NULL AND e.actif
   ORDER BY e.id
  ```
- `acceptSuggestion()` : `JOIN cfp_events` → `JOIN conference_editions`, et
  l'INSERT du talk ajoute `edition_id = s.event_id` (les talks moissonnés
  pointent la référence, comme les manuels). `source` est désormais nullable
  côté édition (une orga pourrait vider l'endpoint après création de la
  suggestion) → écrire `COALESCE(e.source, 'sessionize')` pour ne jamais
  violer le NOT NULL de `speaker_talks.source`.
- `refreshImportedTalk()` : **aucun changement**.
- Slugify : la migration slugifie en SQL ; le seed (lot 2), la sync meetups et
  Zod admin (lot 3) utiliseront un **`slugifyConference()` TS unique**
  (`src/lib/conferences.ts`) dont l'implémentation reproduit l'expression SQL
  — deux slugifies divergents = doublons de confs.

### 1.4 Tests (rouges d'abord)

- **Créer `src/__tests__/migration-conferences.integration.test.ts`** (PGlite).
  Recette (aucun test existant ne sait faire ça — les tests d'intégration
  chargent `schema.sql`, qui sera au NOUVEL état) : construire la base legacy
  par **DDL legacy inline** dans le test (users, speaker_profiles,
  speaker_talks sans `edition_id`, `cfp_events`, `talk_suggestions` avec FK
  **nommée exactement** `talk_suggestions_event_id_fkey` → `cfp_events`),
  peupler (suggestions `proposee`/`refusee`/`acceptee`), puis exécuter
  `sync-to-latest.sql` **2×** : remap 1-1, refus toujours refusés, 2ᵉ passage
  = no-op. Exécuter AUSSI `027_conferences.sql` sur une seconde base legacy
  (le SQL « dupliqué » ne doit pas diverger en silence). Cas : libellé
  « DevFest Toulouse 2026 » (année suffixe) ET pathologique « DevFest 2026
  Toulouse » (annee NULL, libellé inchangé) ; deux événements même nom sans
  année → PAS d'exception ; collision avec année → exception ; ligne orpheline
  (collision de slug simulée) → exception 3c-bis ; fallback ville/pays ;
  `acceptSuggestion` pose `edition_id` + bonne `source`.
- Tests PGlite existants : ajouter `conference_editions, conferences` aux
  `TRUNCATE … RESTART IDENTITY CASCADE` (`db-contract.test.ts`,
  `cfp-suggestions-db.integration.test.ts`,
  `talks-cfp-reads.integration.test.ts`) ; les helpers de seed (`newEvent`…)
  insèrent désormais via `conferences` + `conference_editions` et respectent
  le CHECK `(source IS NULL) = (endpoint IS NULL)`.
- `cfp-suggestions.test.ts` (unitaires mockés) : passe **quasi inchangé** (les
  rows mockées ont déjà les bons alias, `toContain("actif")` reste satisfait)
  — ne pas le réécrire.
- Non-régression : `cfp-sync.test.ts`, `cron-sync-talks.test.ts`,
  `db-schema-drift.test.ts` passent **sans modification**.

---

## Lot 2 (D) — Seed France + sync meetups

### 2.1 Fichiers

- **Créer** : `src/data/conferences-seed.ts` (données + en-tête crédit
  CC BY-NC developers.events / MIT Toulouse Tech Hub),
  `src/lib/conference-seed.ts` (insertion idempotente, appelable par script),
  `src/lib/meetup-sync.ts` (+ `src/__tests__/meetup-sync.test.ts`,
  `conference-seed` tests)
- **Modifier** : `src/lib/cfp-sync.ts` (étape meetups + `SyncResult.meetups`),
  `src/__tests__/cron-sync-talks.test.ts` (toEqual exacts),
  `src/app/a-propos/page.tsx` ou page crédits (attribution visible),
  `docs/exploitation.md`

### 2.2 Seed (statique, commité)

- Confs **tech FR** (extraction manuelle developers.events, ~30-50 entrées
  curées) + **product/UX FR** (~10 : Flupa UX Days, La Product Conf, UX Days,
  Future Product Days…) : `conferences` + 1 édition courante quand connue
  (année, ville, url). **Sans endpoint** (posés ensuite via UI/contribution).
- **Assos toulousaines** (~28, depuis `_groups/` du Tech Hub) :
  `type='asso'`, ville Toulouse, site/meetup url.
- Insertion : `ON CONFLICT (slug) DO NOTHING` (conf) / index partiels
  (éditions) → rejouable. Exposée comme script npm (`npm run seed:conferences`)
  documenté dans `exploitation.md` (pas d'exécution auto au build).

### 2.3 Sync meetups (`src/lib/meetup-sync.ts`)

- `fetchTechHubEvents()` : GET `https://toulouse-tech-hub.fr/events.json`,
  patterns `cfp-import.ts` (timeout 10 s, garde taille, no-store).
  ⚠️ **Première tâche du lot** : capturer le JSON réel et figer le schéma Zod
  tolérant (le format exact n'a pas pu être vérifié depuis l'environnement de
  dev — champ par champ : titre, groupe, date, lieu, url, id Meetup).
- Mapping : entrée par entrée, ligne bancale sautée ; titres tronqués 160,
  URLs `isHttpUrl`, groupe → `conferences type='asso'` (matching slug si
  dispo, sinon nom ; inconnu → créé) ; upsert
  `ON CONFLICT (meetup_id) DO UPDATE` (nom, date_debut, lieu, ville, url,
  conference_id). Jamais de suppression.
- `0 meetup parsé` → compté en `erreurs` du run (visible).
- Intégration cron : ⚠️ `syncCfpEvents()` fait `if (events.length === 0)
  return` **avant tout** — une étape placée « après la moisson » ne tournerait
  jamais tant qu'aucune édition CFP n'est active. L'étape meetups s'exécute
  **indépendamment de ce court-circuit** (avant lui, ou le early-return ne
  saute que la boucle CFP). Cas de test explicite : « 0 événement CFP actif →
  meetups quand même synchronisés ».

---

## Lot 3 (A) — UI orga + contribution + moisson à la demande

### 3.1 Fichiers

- **Créer** : `src/lib/conferences.ts` (lib DB, pattern
  `tremplin-editions.ts`), `src/lib/conference-form.ts` (Zod),
  `src/app/admin/conferences/page.tsx` + composants (dialogs pattern
  `AddEditionDialog`), `src/app/admin/conferences/actions.ts`, tests
  (`conference-form.test.ts`, `conferences-db.integration.test.ts`,
  `actions-conferences.test.ts`)
- **Modifier** : `src/app/admin/page.tsx` (lien), `src/app/mon-espace/…`
  (section « repérage » : ajout de conf + lancement), `src/lib/cfp-sync.ts`
  (extraction `runHarvestForProfile`), `src/data/moissonneur.ts` (étape
  « ajoute tes conférences »)

### 3.2 Server Actions

| Action | Garde | Règles |
|---|---|---|
| `upsertConference` | `requireOrgaId` | Zod : nom ≤ 160, slug `[a-z0-9-]`, type enum |
| `upsertEdition` | `requireOrgaId` | annee 1990-2100, dates cohérentes, url `optionalUrl`, endpoint `/^[a-z0-9]{6,32}$/i` facultatif, source implicite `sessionize` si endpoint |
| `setEditionActive` | `requireOrgaId` | activable seulement si endpoint non NULL |
| `testEndpoint` | `requireOrgaId` OU membre (réutilisé à la soumission) | rate-limit `test-endpoint:{userId}` 10/min ; renvoie `{sessions, speakers}` ou code d'erreur stable |
| `addEditionAsMember` | `requireUserId` | rate-limit `propose-edition:{userId}` 5/h ; test endpoint obligatoire avant INSERT ; `actif=TRUE`, `propose_par=userId` ; 23505 endpoint → « déjà référencée » ; même conf/année → rattacher à l'existante |
| `runHarvestForProfile` | `requireUserId` → son profil | rate-limit `harvest:{profileId}` 2/10 min ; index de matching réduit à SON profil ; éditions actives récentes (borne partagée, cf. note) et **nombre d'éditions borné par run** ; pas d'e-mail ; retourne `{suggestions, majs, erreurs}` pour affichage immédiat |

Notes lot 3 :
- Les actions membres vivent dans `src/app/mon-espace/actions.ts` (pattern
  existant) ; les actions orga dans `src/app/admin/conferences/actions.ts`,
  chacune suivie de `revalidatePath` (`/admin/conferences`, `/mon-espace`).
- `runHarvestForProfile` : extraire de `cfp-sync.ts` une fonction
  `harvestEventsForIndex(events, index, options)` partagée par le cron (tous
  profils, e-mails) et l'action (un profil, pas d'e-mail) — pas de
  duplication ; invisible pour `cfp-sync.test.ts` (qui mocke les modules).
- **Durée** : N fetchs Sessionize à 10 s de timeout chacun dépassent vite le
  défaut Vercel → `export const maxDuration = 60` sur le segment hébergeant
  l'action, et borne du nombre d'éditions par run (ex. 30, les plus
  récentes).
- La **borne temporelle** (18 mois) est une constante exportée définie ICI
  (ex. `EDITIONS_RECENTES_MOIS` dans `src/lib/conferences.ts`), réutilisée par
  le lot 4 pour `known[]` (le lot 4 merge après).

### 3.3 UI

- `/admin/conferences` : liste groupée par conférence (éditions dessous),
  badge « ajoutée par la communauté » (`propose_par`), badge actif/inactif,
  dialog ajout/édition avec « Tester cet endpoint », attribution des sources
  du catalogue en pied de page. A11y : pattern des pages admin existantes
  (aria-labelledby, focus-visible, role=alert sur erreurs).
- Espace membre : dans la section moissonneur existante, « Ta conf n'y est
  pas ? Ajoute-la » (dialog : nom, année, ville, endpoint + aide « où trouver
  l'id »), bouton « Lancer le repérage » avec état pending et résultat
  (`role="status"` : « N talks repérés »), suggestions rafraîchies
  (`revalidatePath`).

---

## Lot 4 (B) — Talk manuel

### 4.1 Fichiers

**Modifier** : `src/lib/talks.ts`, `src/lib/talk-form.ts`,
`src/app/mon-espace/TalkForm.tsx`, `src/app/mon-espace/actions.ts`,
`src/__tests__/talks.test.ts`, `talks-cfp-reads.integration.test.ts`,
`talk-form.test.ts`, `talk-form-ui.test.tsx`, `talk-form-errors.test.tsx`,
`actions-espace.test.ts` (le mock `parseTalkForm` est typé `TalkInput` →
`editionId` casse son type-check ; y tester les règles de revalidation),
fixtures TalkForm (`a11y-axe-espace.test.tsx` : `known: []`). Vérifier
l'impact E2E (`e2e/`) du passage de ville/pays/lienConf en contrôlés.

### 4.2 Contrats

```ts
// talks.ts
export interface KnownEdition {
  editionId: number;
  libelle: string;
  ville: string | null;     // COALESCE(édition, conf)
  pays: string | null;
  url: string | null;
}
export interface TalkSuggestions { conferences; villes; pays; known: KnownEdition[] }
// Talk / TalkInput : + editionId: number | null
```

**Libellé = UN seul helper.** Trois consommateurs potentiels (SQL de
`getActiveCfpEvents`, `known[]`, revalidation serveur) : si la revalidation ne
produit pas le même octet-à-octet que le pré-remplissage client, `edition_id`
serait **systématiquement annulé** (échec silencieux). Donc un helper exporté
`buildEditionLibelle(edition)` (côté `src/lib/conferences.ts`) utilisé par
`known[]` ET par la revalidation. Format meetup **sans cadratin** (convention
repo) : « GDG Toulouse · 12 mars 2026 » (`Intl.DateTimeFormat('fr-FR')`).
Seul `getActiveCfpEvents` garde sa recomposition SQL (contrat cron, éditions
de conf uniquement : `nom + ' ' + annee`, même résultat que le helper sur ce
sous-ensemble — couvert par un test).

- Requête `known` : jointure bornée (`date_debut >= now()-'18 months' OR
  date_debut IS NULL`), `ORDER BY date_debut DESC NULLS LAST LIMIT 500`.
- `parseTalkForm` : `editionId` optionnel (int > 0 sinon ignoré) — reste
  **pur** (aucun accès DB, comme aujourd'hui).
- Action serveur (add + update) : revalidation via une fonction lib
  `getKnownEditionById(id)` (SQL dans `src/lib/*`, pas inline dans l'action) —
  édition inexistante → `edition_id NULL` ; `buildEditionLibelle(édition)` ≠
  `conference` soumis → `edition_id NULL` (texte libre gagne, pas d'erreur).
  `updateTalk` écrit `edition_id` dans le même UPDATE.
- `TalkForm` : `editionId` en `useState` + input hidden ; au change du champ
  conférence, lookup `known` par libellé exact → set `editionId` + pré-remplir
  ville/pays/lienConf **vides** (passer ces 3 champs en contrôlés) ; toute
  modification qui ne matche plus efface `editionId`.

---

## Lot 5 (C) — Tremplins

`src/lib/tremplin-editions.ts` (+ `conference_edition_id` dans Edition/Input/
COLS/INSERT/UPDATE), `EditionChampsCommuns.tsx` (sélecteur d'édition de la
référence, facultatif, pré-remplit conf_nom/conf_date/conf_lien), tests
associés. Aucun backfill.

---

## Déploiement (lot 1 uniquement)

1. Merger sur `main` un jour SANS moisson imminente (cron 07:00 UTC).
2. Jouer `db/migrations/027_conferences.sql` dans Neon (console SQL).
3. Vérifier immédiatement que le déploiement Vercel du merge est terminé
   (l'ordre migration → deploy limite la fenêtre à ~2 min où l'ancien code ne
   peut pas confirmer une suggestion — acceptable, aucune perte de données).
4. Smoke test : `/mon-espace` (suggestions visibles), confirmation d'une
   suggestion de test si possible.

Lots 2-5 : déploiement standard (pas de migration).

## Definition of done (par lot)

- Tests écrits avant le code, verts, y compris non-régression listée.
- `npm run test && npm run type-check && npm run lint` verts (E2E : vérifier
  l'impact au lot 4).
- `docs/exploitation.md` à jour si le lot change une procédure.
- **Lots visibles des membres (3 et 4)** : entrée `CHANGELOG.md` +
  `src/data/nouveautes.ts` (conventions du repo).
- Pas de secret ni donnée personnelle committée ; attributions présentes.
- Sitemap / `llms.txt` : rien à faire (aucune nouvelle page publique —
  `/admin/conferences` est privée) ; mention llms.txt du repérage à la
  demande optionnelle.
