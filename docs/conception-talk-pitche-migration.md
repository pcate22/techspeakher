# Conception — Migration « sujet » → talk pitché & vue speakeuse

> Conception **fonctionnelle + technique** à valider (et à passer en revue de
> conception) **avant** de coder. Fait suite à la PR #146 (l'orga peut déjà
> désigner le talk pitché via `PitchedTalkPicker` ; `tremplin_registrations.talk_id`
> existe, migration 032). Contexte métier : `docs/parcours-participante.md`,
> principes UI : `docs/principes-conception-ui.md`.

## 1. Contexte

- Depuis #146, l'**orga** désigne le « talk pitché au Tremplin »
  (`registration.talk_id` → `speaker_talks`) avec `PitchedTalkPicker`.
- Mais la **participante** édite encore un **champ texte libre `sujet`** dans son
  espace (`mon-espace/tremplin/[edition]`, `setMonSujetAction`).
- Et c'est **`registration.sujet`** qui alimente aujourd'hui les **vues
  publiques** (galerie + palmarès dans `src/lib/tremplin-public.ts`, page
  `tremplin/[conf]/[annee]`), la vue **coach** (`tremplin-coachs`) et l'**admin**.

Deux sources concurrentes pour « son talk » : le champ libre `sujet` (public) et
le talk pitché (`talk_id`, orga). Objectif : **une seule source**, le talk.

## 2. Besoin (fonctionnel)

- La **speakeuse** choisit, dans son espace, **quel talk de son répertoire** elle
  pitche (et peut en créer/éditer un) — **le même écran que l'orga** (mutualisé,
  guide §3).
- L'**orga** garde la main (déjà en place).
- Le **public** continue d'afficher le **titre du talk pitché** (galerie,
  palmarès), **sans régression**.
- **Pas de code en double** (composant partagé piloté par capacités).
- Wording **à la forme positive** ; **un seul CTA** par page ; a11y/COGA.

## 3. Décisions de conception

1. **Le talk pitché devient la source** de « son talk » ; le champ libre `sujet`
   cesse d'être édité directement par la speakeuse.
2. **Stratégie « miroir » (recommandée)** : `registration.sujet` **reste la
   colonne d'affichage** (lue par public/coach/admin) mais devient **dérivée** du
   talk pitché — mise à jour à chaque changement de `talk_id` : `sujet = titre du
   talk`. On **ne réécrit aucune** des ~6 lectures publiques → risque minimal.
   - *Alternative rejetée pour l'instant* : remplacer toutes les lectures de
     `sujet` par une jointure `talk_id → speaker_talks.titre`. Plus « pur », mais
     touche les vues publiques (galerie/palmarès) = risque élevé pour un gain
     faible. À reconsidérer plus tard.
3. **Backfill** : une migration de données transforme chaque `sujet` libre
   existant en un talk « Sujet proposé » sur le profil de la personne, et pose
   `talk_id` — pour que le picker ait de la matière dès le départ.

## 4. Modèle de données

- **Aucune nouvelle colonne** (`talk_id` existe déjà — migration 032).
- **Nouvel invariant** : `sujet = titre(talk_id)` quand `talk_id` est non nul.
  Maintenu **au point d'écriture** (les actions qui posent `talk_id` écrivent
  aussi `sujet`) — normaliser au bord, pas dans chaque vue (guide §7).
- **`talk_id` nul** (aucun talk pitché) : voir Question Q1.

## 5. Flux

### Speakeuse (`mon-espace/tremplin/[edition]`)
- **Remplacer** l'éditeur de sujet libre (`setMonSujetAction`) par
  `PitchedTalkPicker`, branché sur une **nouvelle action de session**
  `setOwnPitchedTalkAction` : identité par **session** (`requireUserId`), scopée à
  **son** inscription et **ses** talks (ownership via son profil).
- Création/édition d'un talk : réutiliser ses pages existantes
  (`mon-espace/talks/nouveau`, `mon-espace/talks/[id]`).

### Orga
- Inchangé (déjà `PitchedTalkPicker` + actions orga).

### Écriture de l'invariant
- `setRegistrationTalk(talkId)` (et les actions orga + speakeuse) posent
  `talk_id` **et** `sujet = titre(talk)` dans la **même** requête/transaction.
- `talk_id := null` (option « Aucun ») → voir Q1.

## 6. Composant partagé (capacités)

- **Déplacer** `PitchedTalkPicker` → `src/components/` (emplacement partagé).
- **Généraliser le lien « Modifier »** : passer un `editHref` **par option**
  (chaîne sérialisable — jamais de fonction passée du serveur au client, cf. le
  crash « oups » évité) : orga → route admin ; speakeuse → `/mon-espace/talks/[id]`.
- L'**action** est injectée (orga vs session) ; le composant ne décide d'aucune
  autorisation (comme `DocList`).

## 7. Impact public / non-régression

| Lecture de `registration.sujet` | Effet avec la stratégie miroir |
|---|---|
| Galerie + palmarès publics (`tremplin-public.ts`) | Inchangé (sujet = titre du talk) |
| Page publique `tremplin/[conf]/[annee]` | Inchangé |
| Vue coach (`tremplin-coachs`) | Inchangé |
| Admin (fiche, liste) | Inchangé |
| `mon-espace/tremplin` (éditeur libre) | **Remplacé** par le picker |

## 8. Migration de données (backfill) — migration 033

- Pour chaque `registration` avec `sujet` non vide **et** un compte relié
  (`userId`) : garantir un profil (`ensureProfileId`), **créer** un talk
  `type = 'Sujet proposé'` (`titre = sujet`), poser `talk_id`.
- **Idempotente** : `WHERE talk_id IS NULL` (on ne recrée jamais) ; marqueur de
  source pour retrouver les talks issus du backfill.
- Registrations **sans compte** : pas de profil → **pas** de backfill ; leur
  `sujet` libre reste affiché tel quel (statu quo). Voir Q2.
- Procédure projet : `schema.sql` (inchangé) + `sync-to-latest.sql` (le backfill
  idempotent) + `db/migrations/033_*.sql` + test de drift.

## 9. Risques & parades

- **Régression public si `sujet` se vide** quand on retire le talk → **Q1**.
- **Doublons de talks** si backfill rejoué → garde `talk_id IS NULL` + source.
- **Doublon de profil** (annuaire vs Tremplin, deux `users` par e-mails
  différents) → le talk se pose sur le profil du compte relié à l'inscription ;
  risque connu (survey), à documenter, hors périmètre immédiat.
- **Perte de saisie** : l'ancien `sujet` libre non backfillé (sans compte) doit
  rester lisible/éditable par l'orga (ne pas casser la saisie existante).

## 10. Conventions (rappels à tenir)

- **Forme positive** partout (règle CLAUDE.md / principes §5).
- **Un seul CTA** par page (règle d'or §1).
- a11y : radiogroup nommé, cibles ≥ 44 px, régions vivantes ; COGA (état en
  toutes lettres, pas de mémoire).

## 11. Plan de tests (TDD)

- **Unit** : `setOwnPitchedTalkAction` (scope session, ownership refusé sur un
  talk d'autrui) ; invariant `sujet = titre(talk)` posé à l'écriture ; option
  « Aucun » selon Q1.
- **Intégration (PGlite)** : backfill idempotent (rejouer = no-op) ; drift
  `schema.sql` ↔ `sync-to-latest.sql`.
- **Compo** : `PitchedTalkPicker` partagé (orga + speakeuse) via capacités.
- **E2E** : agnostique aux données.

## 12. Décisions (issues des revues de conception)

- **Q1 — `talk_id` nul** → **`sujet := null`** (option a), MAIS **garde palmarès** :
  interdire le passage à « Aucun » sur une inscription **classée** (`classement`
  non nul), pour ne pas effacer un titre primé archivé (public). Et **avertir**
  quand l'inscription est **publique** (l'effet galerie est immédiat).
- **Q2 — registrations sans compte** → **oui**, fallback : l'**orga** garde
  l'édition du `sujet` libre pour ces lignes, sur une surface admin dédiée (à
  créer). Côté speakeuse, l'édition libre est **retirée** (elle a un compte donc
  un profil → elle passe par le picker).
- **Q3 — dédoublonnage de profils** → hors périmètre ; documenter que la bascule
  **augmente l'impact** d'un mauvais rattachement (avant : titre erroné sur une
  carte Tremplin ; après : talk erroné sur une fiche annuaire indexée).

## 13. Revues de conception — findings consolidés & décisions

Trois revues indépendantes (fonctionnel/UX/a11y, technique/données/migration,
sécurité/RGPD). Findings retenus et décisions :

### Bloquants (à intégrer avant code)

- **B-SEC — IDOR** : l'action speakeuse **ne doit jamais** recevoir
  `registrationId`/`profileId` du client. Créer `setOwnRegistrationTalk(userId,
  editionId, talkId)` scopé `WHERE "userId"=$1 AND edition_id=$2` (calqué sur
  `setOwnRegistrationVisibility`), identité par `requireUserId()`, profil dérivé
  `ensureProfileId(userId)`, ownership du talk par `getTalkById(talkId,
  profileId)`. Ne **jamais** utiliser `getTalkTitleById` (sans ownership) pour le
  miroir.
- **B-INV — invariant à l'édition du titre** : `sujet = titre(talk)` casse aussi
  quand on renomme un talk **sans** changer `talk_id` (chemins `updateTalkAction`
  speakeuse et `updateRegistrationTalkAction` orga). **Décision : porter
  l'invariant en base par un TRIGGER** `AFTER UPDATE OF titre ON speaker_talks →
  UPDATE tremplin_registrations SET sujet = NEW.titre WHERE talk_id = NEW.id`, +
  un chemin qui remet `sujet := null` quand `talk_id` passe à null (choix
  « Aucun » et suppression du talk via `ON DELETE SET NULL`). Un **seul point
  d'enforcement**, robuste à tous les writers présents/futurs.
  - Conséquence : le trigger vit dans `schema.sql` **et** `sync-to-latest.sql`,
    et **le test de drift doit être étendu** pour snapshotter `pg_trigger` /
    `pg_proc` (sinon un oubli passerait en silence).
- **B-RGPD — titre public non effaçable** : sans le trigger ci-dessus, supprimer
  le talk (`ON DELETE SET NULL`) laisse un `sujet` orphelin **ineffaçable par la
  personne** (l'éditeur libre a disparu). Le trigger (mise à null sur
  `talk_id → null`) referme ce trou.
- **B-BACKFILL — réconcilier les lignes déjà pitchées** : depuis #146 des
  inscriptions ont **déjà** un `talk_id` + un `sujet` libre indépendant. Le
  backfill doit faire **deux gestes** : (1) `talk_id IS NULL AND sujet non vide
  AND userId` → créer le talk + poser `talk_id` ; (2) `talk_id IS NOT NULL` →
  `sujet := titre(talk)` (réconciliation). Sinon miroir faux dès J+0.

### Importants

- **Wording mutualisé** : `PitchedTalkPicker` est écrit pour l'orga (« Quel talk
  pitche-t-**elle** ? », badge 3ᵉ personne). Rendre injectables `legend`,
  `pitchedBadge`, `autoSaveHint` (props sérialisables, comme `editHref`) — sinon
  la mutualisation « par capacités » est faite à moitié.
- **Boucle de création (speakeuse)** : `addTalkAction` redirige vers
  `/mon-espace#talks` → un talk créé depuis le picker éjecte la speakeuse et
  n'est **pas** auto-pitché. Prévoir un **retour contextualisé** (`returnTo`) et
  l'**auto-désignation** du talk créé depuis ce flux (comme la sous-page orga).
- **Bascule à impact public** (COGA) : le picker s'enregistre au `change`. Quand
  la registration est **publique**, afficher « ce titre s'affiche dans la galerie »
  et **confirmer** le passage à « Aucun ».
- **États vides côté speakeuse** : reprendre le garde `options.length > 0` de la
  page orga (répertoire vide / pas encore de talk), en **voix speakeuse**.
- **Retrait de `setMonSujetAction` / `setOwnRegistrationSujet`** (2ᵉ source
  concurrente) — pas de « fallback speakeuse ». Réécrire les tests couplés
  (`actions-ma-visibilite.test.ts`, `tremplin-db.integration.test.ts`), **pas**
  les contourner.
- **Fallback orga (Q2) sans domicile UI** : la sous-page orga « Talk » exige un
  compte ; il faut **créer** une surface admin qui édite le `sujet` libre pour
  les inscriptions `userId IS NULL` (sinon elles deviennent non éditables).
- **Backfill = migration ponctuelle** `db/migrations/033_*.sql` (**pas** dans
  `sync-to-latest.sql`, qui reste du DDL idempotent). Marqueur de source =
  `type = 'Sujet proposé'` (**convention de donnée**, pas de colonne → pas de
  drift). Décision SQL vs script TS : **SQL idempotent** (INSERT…ON CONFLICT +
  INSERT…SELECT) pour rester dans le modèle « joué dans Neon », en dupliquant a
  minima la logique de `ensureProfileId`.
- **Annuaire (RGPD)** : les talks backfillés (`'Sujet proposé'`) deviennent
  visibles/cherchables sur la **fiche annuaire** à sa publication. Les **exclure
  de l'annuaire** (ou les marquer « à confirmer ») tant que la personne ne les a
  pas validés ; documenter `sujet` = **donnée personnelle** (déjà nullifiée dans
  `deleteAccount` — rester cohérent).

### Mineurs

- **Perf** : avec le miroir, `sujet` contient déjà le titre (déjà chargé) → sur
  la fiche admin, remplacer `getRegistrationTalkId` + `getTalkTitleById` (2
  requêtes) par `r.sujet` pour l'affichage ; garder un accès à l'`id` seulement
  pour la présélection du picker.
- **Miroir vs jointure** : miroir confirmé (écriture rare / lecture chaude ISR).
- **Test public** : figer « le DTO public n'expose que le **titre**, aucune autre
  colonne de `speaker_talks` ».
- **`createRegistration` / import** : tolérer `sujet` libre quand `talk_id` nul ;
  aligner l'import sur le backfill si les lignes importées ont un compte.

### Décision produit — « proposition de talk » (validée)

Il faut pouvoir **préciser qu'un talk est une proposition** (un sujet pas encore
donné). C'est le champ **`type = « Sujet proposé »`** (`TALK_PROPOSAL`,
`src/data/domaines.ts`) du formulaire de talk (page « Ajouter/Modifier un talk »).
Décisions :
- Le **backfill** pose `type = 'Sujet proposé'` sur les talks créés depuis un
  `sujet` (c'est aussi le marqueur de source du §8).
- Le **picker** et la fiche **affichent** le type (ex. pastille « Proposition »)
  pour que l'orga/la speakeuse voient d'un coup d'œil que c'est une proposition.
- Cohérent avec la décision #3 : une proposition backfillée reste **masquée de
  l'annuaire** tant que la personne ne l'a pas confirmée/complétée.

### Points VALIDÉS par la cliente (produit)

1. **Invariant par trigger DB** (robuste, mais ajoute un objet DB + étend le test
   de drift) vs application seule (plus simple, plus fragile). *Reco : trigger.*
2. **Q1 + garde palmarès** : interdire « Aucun » sur une inscription **classée**
   (préserver le titre primé archivé). *Reco : oui.*
3. **Annuaire** : masquer les talks backfillés jusqu'à confirmation de la
   personne. *Reco : oui.*
4. **Le « pitch/accroche »** libre devient un **titre de talk** (plus plat) —
   acceptable ? *Reco : oui, le talk porte titre + description.*

## 14. Revues POST-code (avant PR) — corrigé & différé

Deux revues indépendantes sur le code livré (correction/qualité ; sécurité/RGPD).
**Aucun bloquant.** Le modèle anti-IDOR (identité par session, `registrationId`
ignoré, ownership `getTalkById`), l'exclusion annuaire (fiche **et** recherche),
les triggers byte-identiques (test de drift) et la couverture PGlite tiennent.

### Corrigé avant PR
- **Wording positif** : les actions speakeuse renvoyaient « … n'a pas été
  trouvée … » → « Inscription introuvable pour cette édition. » (aligné sur la
  jumelle orga).
- **Durcissement trigger** : `SET search_path = public, pg_temp` sur les deux
  fonctions (défense en profondeur ; elles ne sont PAS `SECURITY DEFINER`).
  Byte-identique dans les 3 fichiers SQL, vérifié par le test de drift.

### Différé — décisions produit à trancher (échec **sûr** : masqué par défaut,
aucune fuite, aucune régression). À arbitrer par la cliente.
- **Mécanisme de confirmation d'une proposition backfillée** (revue : « important »).
  `source='tremplin'` exclut la proposition de l'annuaire, mais **rien ne
  l'efface** aujourd'hui : une speakeuse qui **complète** ce talk pour sa fiche
  ne le verra jamais publié (piège silencieux). Ce n'est **pas une régression**
  (l'annuaire n'a jamais affiché le `sujet`) et le cas exige que la migration 033
  ait tourné **et** une curation active. **À décider** : « éditer = confirmer »
  (côté speakeuse seulement, jamais l'édition orga) efface le marqueur `source` ?
  ou un contrôle « Confirmer » explicite ? Ne pas trancher sans la cliente (choix
  produit sur le sens de « confirmée/complétée » de la décision §3).
- **Boucle de création (returnTo + auto-pitch)** : « Ajouter un talk » renvoie à
  l'espace général puis oblige à revenir désigner le talk. UX perfectible (pas de
  régression : ce flux n'existait pas). À câbler comme la sous-page orga.
- **Avertir avant « Aucun » sur une inscription PUBLIQUE** (COGA) : l'auto-save
  vide aussitôt le titre en galerie. **Pas une régression** (l'éditeur de sujet
  libre effaçait déjà sans confirmation). À gater par un `confirm` quand
  `registration.public`.

### Bords assumés (documentés, pas de sur-ingénierie)
- **« Aucun » sur une inscription classée est AUTORISÉ** (pas interdit comme le
  disait Q1) : effet net **sûr** — le trigger conserve le titre primé archivé
  (`sujet`, `NEW.classement IS NULL` seul l'efface). `talk_id` passe à NULL, le
  palmarès reste juste.
- **Renommer un talk d'une édition passée met à jour le `sujet` archivé** (le
  trigger de propagation ne filtre pas `classement`). Cadré comme une
  **rectification** par le propriétaire (RGPD-positif) ; conflit assumé avec
  l'intention « archive gelée ».
- **Backfill 033 = one-shot** : pas de dédup entre un même `sujet` sur plusieurs
  éditions, ni contre un talk manuel de même titre. Joué **une** fois en Neon,
  donc sans incidence ; la garde `talk_id IS NULL` protège seulement du re-run.
- **Doublon de numéro de migration `032`** (`032_contact_messages`,
  `032_registration_talk`) : **préexistant sur `main`**, hors périmètre ; à
  renuméroter séparément.

## 15. Suite — retrait DÉFINITIF de la colonne `sujet` (décision cliente)

Après le miroir (§3, stratégie retenue), la cliente a tranché : **supprimer
carrément la colonne `sujet`** (l'« ancien système ») et lire le titre
directement depuis le talk. L'« alternative rejetée pour l'instant » du §3
devient la cible. Contrainte posée : **conserver le palmarès des gagnantes a
minima**.

### Modèle
- Le titre pitché est lu **directement depuis le talk** (`talk_id →
  speaker_talks.titre`) partout où il s'affiche : galerie publique, vue coach,
  liste + fiche admin (jointure `LEFT JOIN speaker_talks`). Plus de colonne
  miroir, plus de trigger.
- Le **palmarès** lit une **archive dédiée `titre_palmares`**, FIGÉE au
  classement (`updateRegistrationDetails` copie le titre du talk pitché quand un
  rang est posé). Elle **survit** à la suppression / au renommage du talk et au
  retrait de `sujet`. Les finalistes T1 (saisies orga, sans compte ni talk) sont
  figées par le seed (classées) et par la migration 034 (prod).
- **DTO inchangés** (`PublicFinalist.sujet`, `PublicAward.sujet`,
  `CoachCoachee.sujet`) : le champ garde son nom mais sa **source** change —
  blast radius minimal sur les pages publiques.

### Conséquence assumée
Les **finalistes non classées sans compte** (5 des 8 du T1) perdent leur titre
en **galerie** (elles n'ont pas de talk). Conforme au « palmarès a minima » : le
podium (3 gagnantes) est préservé via `titre_palmares` ; le reste se re-remplit
quand chacune relie un compte + un talk (cf. dette-technique « galerie T1 »).

### Déploiement (expand / contract)
1. **Migration 034** (additive) : `ADD COLUMN titre_palmares` + backfill des
   classées. **Jouée en Neon AVANT le code** (faite).
2. **Déploiement du code** : lectures basculées sur le talk / l'archive.
3. **Migration 035** (destructive) : `DROP` des triggers de miroir + `DROP
   COLUMN sujet`. **Jouée en Neon APRÈS le déploiement.**

`schema.sql` + `sync-to-latest.sql` reflètent l'état final (pas de `sujet`, pas
de trigger, `titre_palmares` présent) ; le test de drift le vérifie. Les bords
du §14 (rename d'un talk classé, « Aucun » sur classée) **disparaissent** : le
palmarès ne dépend plus du talk vivant, il lit son archive figée.
