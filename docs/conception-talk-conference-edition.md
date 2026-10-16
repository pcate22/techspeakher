# Conception : associer un talk à une conférence PUIS à son édition

> Statut : conception (fonctionnelle + technique + revue). Pas encore
> implémentée. Suite directe du registre de conférences (#128) et de la gestion
> orga (#133).
> Contexte : `docs/conception-registre-conferences.md` (modèle 2 tables).
> Suite : `docs/conception-talk-multi-conferences.md` (un même talk donné dans
> plusieurs conférences — réutilise le patron des deux sélecteurs liés d'ici).

## Le besoin

Aujourd'hui, le formulaire « Ajouter un talk » (`src/app/mon-espace/TalkForm.tsx`)
a **un seul champ « Conférence »** : un texte libre avec auto-complétion. Le lien
vers la référence (`speaker_talks.edition_id`) est posé quand la saisie
correspond **exactement** au libellé d'une édition connue (« Sunny Tech 2026 »).

Deux limites de ce champ unique :

1. **Le modèle est plat alors que la donnée est hiérarchique.** Une conférence
   (la marque, « Sunny Tech ») a des éditions (« 2025 », « 2026 »). Tout écraser
   dans une chaîne mélange les deux : on ne sait pas si « Sunny Tech 2026 »
   désigne la conf ou l'édition, et on ne peut pas proposer les éditions d'une
   conf connue.
2. **Le lien repose sur une égalité de chaîne**, fragile : retaper le libellé,
   renommer la conf côté orga, une espace en trop… et le lien saute (des
   garde-fous serveur limitent la casse, mais c'est du rattrapage).

**Objectif** : un parcours en deux niveaux, aligné sur le modèle
`conferences` → `conference_editions` : on **choisit une conférence**, puis **son
édition**. La saisie libre reste toujours possible (une conf hors référence).

---

# 1. Conception fonctionnelle

## 1.1 Parcours cible

Deux sélecteurs liés, chacun avec un repli « saisie libre ».

**Champ 1 — Conférence** (« où as-tu parlé ? », la marque/l'organisateur) :
- liste les conférences ET assos de la référence (triées, nom lisible) ;
- une option **« Autre (pas dans la liste) »** ouvre un champ texte libre ;
- choisir une conf connue **pré-remplit** ville et pays (métadonnées de la conf),
  sans jamais écraser une saisie déjà faite.

**Champ 2 — Édition** (« quelle édition ? », l'occurrence datée), affiché **une
fois la conférence choisie** :
- si la conf connue **a des éditions** : les propose (« 2026 », « 2025 », un
  meetup daté…), la plus récente d'abord ; choisir une édition **pré-remplit la
  date, la ville et le lien** et **relie le talk** (`edition_id`) ;
- une option **« Autre / année non listée »** laisse remplir la date à la main
  (les champs Date existants) sans relier d'édition ;
- si la conf connue **n'a aucune édition** (cas du seed : les 37 confs sont
  sans édition) ou si la conf est en **saisie libre** : pas de liste d'éditions,
  on remplit juste la date comme aujourd'hui.

## 1.2 États et règles

| Champ 1 (conférence) | Champ 2 (édition) | Ce qu'on enregistre |
| --- | --- | --- |
| Conf connue, édition connue choisie | édition datée | `edition_id` + `conference_id` (déduit) + libellé affiché |
| Conf connue, « Autre / année » | date libre | `conference_id` + date libre, `edition_id` NULL |
| Conf connue **sans édition** | (pas de liste) | `conference_id` + date libre, `edition_id` NULL |
| Saisie libre | (pas de liste) | texte libre, `conference_id` et `edition_id` NULL |

Règles invariantes :
- **La saisie libre reste toujours accessible** (exigence d'origine : « les
  autres confs en saisie libre »). Aucune conf n'est imposée.
- **Le pré-remplissage ne remplace jamais une saisie** : il ne remplit que les
  champs vides (règle déjà en place pour ville/pays/lien ; « France » est traité
  comme le défaut du champ, pas comme une saisie).
- **Un talk peut être relié à une conférence sans édition précise** (nouveau) :
  utile pour les 37 confs du seed, sans obliger la speakeuse à créer une édition.
- **Cohérence** : si une édition est choisie, elle doit appartenir à la
  conférence choisie (garde-fou serveur, cf. technique).

## 1.3 Édition d'un talk existant

- Un talk déjà relié (`edition_id`) ré-affiche sa conférence et son édition
  pré-sélectionnées.
- Un talk en texte libre ré-affiche « Autre » + son texte.
- Le lien ne doit jamais être cassé en silence par la réouverture du formulaire
  (garde-fou déjà présent : `revalidateEditionId` compare et préserve).

## 1.4 Données existantes (prod)

- Talks avec `edition_id` : on **rétro-remplit** `conference_id` depuis l'édition
  (déterministe) au moment de la migration.
- Talks en texte libre : **laissés tels quels** (`conference_id` NULL). Ils se
  relient naturellement à la prochaine édition de leur fiche, si la speakeuse
  rouvre le talk et choisit la conf dans la liste. Pas de rapprochement
  automatique par nom (risque de faux positif sur des orthographes proches).

## 1.5 UX (surtout mobile)

- Deux `<select>` natifs (bons au clavier et au tactile) plutôt qu'un
  `datalist` : le `datalist` ne signale pas de façon fiable qu'une valeur a été
  **choisie** (c'est la douleur actuelle) — or on a besoin de l'identité de la
  conf pour charger ses éditions.
- Le champ Édition n'apparaît (ou ne s'active) que lorsqu'il a du sens (conf
  connue avec éditions), pour ne pas alourdir le formulaire.
- La saisie libre reste à un clic (« Autre »), jamais enfouie.

## 1.6 Accessibilité (RGAA)

- `<label>` explicite par sélecteur ; le champ Édition annonce sa dépendance au
  champ Conférence (ordre DOM logique, pas d'apparition qui piège le focus).
- Messages d'erreur `role="alert"`, marqueur `(obligatoire)` en `sr-only` si un
  champ devient requis, `focus-visible` partout (conventions du projet).

## 1.7 Hors périmètre

- Pas de refonte de la moisson ni du Tremplin (qui a déjà son propre lien
  `conference_edition_id`).
- Pas de rapprochement automatique des talks texte libre historiques.
- Pas d'ajout de conférence à la volée depuis ce formulaire (la contribution
  communautaire existe déjà côté « repérage »). « Autre » reste du texte libre,
  pas une création d'entrée de registre.
- **Pas de fusion de conférences** : si l'orga a deux doublons, elle en supprime
  un (gardé, #133). Aucune réaffectation automatique des `conference_id` des
  talks de la conf perdante vers l'autre (une vraie fusion serait un lot à part).

---

# 2. Conception technique

## 2.1 Modèle de données

**Décision : ajouter `conference_id` à `speaker_talks`** (FK nullable vers
`conferences`), à côté de `edition_id` (déjà là). Raisons :
- rend « relier à une conférence puis à son édition » explicite et de premier
  ordre (fini l'égalité de chaîne) ;
- permet de relier un talk à une conf **sans** édition (les 37 du seed) ;
- ouvre des usages futurs (talks par conférence, stats) à faible coût.

Migration `db/migrations/NNN_talk_conference.sql` (+ `schema.sql` +
`sync-to-latest.sql`, drift-testés) :

```sql
ALTER TABLE speaker_talks
  ADD COLUMN IF NOT EXISTS conference_id INTEGER
  REFERENCES conferences(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_speaker_talks_conference
  ON speaker_talks (conference_id);

-- Rétro-remplissage déterministe depuis l'édition déjà reliée.
UPDATE speaker_talks t
   SET conference_id = e.conference_id
  FROM conference_editions e
 WHERE t.edition_id = e.id AND t.conference_id IS NULL;
```

`ON DELETE SET NULL` : supprimer une conf ne casse pas un talk (cohérent avec
`edition_id` et avec la suppression orga gardée de #133).

**Colonne `conference` (texte) conservée** comme libellé d'affichage et pour la
saisie libre. Règle de lecture (voir 2.4) : quand `conference_id`/`edition_id`
est posé, l'affichage suit le **nom courant de la référence** (jointure), pour
qu'un renommage orga se propage ; sinon on affiche le texte libre.

## 2.2 Accès aux données (`src/lib/talks.ts`)

- `TalkInput` / `Talk` : ajouter `conferenceId: number | null` à côté de
  `editionId`. `addTalk` / `updateTalk` écrivent la colonne (SQL paramétré).
- `getTalkSuggestions` renvoie une **structure hiérarchique** :

```ts
interface RegistreConf {
  id: number;
  nom: string;
  ville: string | null;
  pays: string | null;
  siteUrl: string | null;
  editions: KnownEdition[]; // déjà bornées (récentes), triées
}
interface TalkSuggestions {
  registre: RegistreConf[];     // confs + assos, avec leurs éditions
  conferencesLibres: string[];  // noms déjà saisis en texte libre (datalist du repli)
  villes: string[];
  pays: string[];
}
```

Une requête confs (`conferences`) + une requête éditions bornées
(`conference_editions`, `KNOWN_SELECT` existant), regroupées en mémoire par
`conference_id` (patron déjà utilisé par `listConferencesForAdmin`).

## 2.3 Composant `TalkForm`

Réutiliser le **patron** de `ConferenceFields` du Tremplin (sélecteur +
sentinelle « Autre »), **pas le composant lui-même** : il est câblé sur le
vocabulaire Tremplin (`confSlug`, `confMode`, création d'une entrée de conf)
alors qu'ici « Autre » = **texte libre, jamais une création dans le registre**
(cf. § 1.7). On en reprend la mécanique, pas le code.
- état contrôlé `conferenceId | "libre" | ""` ; `editionId | "autre" | ""`.
- Champ 1 : `<select>` des confs du registre + option « Autre (pas dans la
  liste) » → révèle l'input texte `conference` (repli, avec `datalist` des noms
  libres déjà saisis).
- Champ 2 : rendu seulement si une conf **du registre avec éditions** est
  choisie ; `<select>` de ses éditions + « Autre / année non listée ».
- Champs cachés soumis : `conferenceId`, `editionId`, `conference` (libellé).
- Pré-remplissage : choix d'une conf → ville/pays (si vides) ; choix d'une
  édition → date/ville/lien (si vides). Mêmes règles « ne jamais écraser ».

## 2.4 Server Actions & validation

- `talk-form.ts` : parser `conferenceId` (int > 0 ou null) en plus d'`editionId`.
- `actions.ts` (`addTalkAction` / `updateTalkAction`) : **revalidation serveur**
  (l'identité vient de la session, les champs cachés sont falsifiables) —
  généraliser `revalidateEditionId` en `revalidateConferenceLink` :
  1. si `editionId` fourni : vérifier qu'il existe ; en déduire le
     `conference_id` réel ; **forcer** `conferenceId` à cette valeur (le client
     ne peut pas relier une édition à une autre conf) ;
  2. si `conferenceId` fourni sans édition : vérifier qu'il existe (sinon NULL) ;
  3. le libellé `conference` affiché est aligné sur le nom de la référence quand
     un lien existe ; en saisie libre, on garde le texte tel quel.
- Garde-fou préservé : rouvrir/renommer ne casse pas un lien valide (comparaison
  contre le talk précédent, déjà en place).

**Chemin moissonneuse (à ne PAS oublier — trou relevé en revue).**
`acceptSuggestion` (`src/lib/cfp-suggestions.ts`) insère un talk avec
`edition_id = s.event_id` et **joint déjà** `conference_editions e` : il DOIT
désormais poser aussi `conference_id = e.conference_id` (une ligne de plus au
SELECT de l'INSERT). Sans ça, tout nouveau talk moissonné aurait `edition_id`
sans `conference_id`, violant l'invariant « édition posée ⇒ conférence dérivée ».
Vérifier de même les autres écritures de talk moissonné (`cfp-sync`, éventuel
`updateFromSuggestion`). La migration ne corrige que l'existant, une fois : le
chemin d'écriture continu doit poser la colonne lui-même.

**Invariant de source de vérité (à tester).** Quand `conference_id` ou
`edition_id` est posé, le texte `conference` n'est **jamais** la vérité : il
n'est que le fallback d'affichage (saisie libre) et le rescapé du
`ON DELETE SET NULL` (un talk dont la conf est supprimée garde une mention
lisible). La vérité d'un talk relié vient de la référence. À couvrir par un test
explicite.

## 2.5 Affichage (fiche publique, cartes de talk) — SNAPSHOT

**Décision (arbitrage B, cf. § 3) : libellé STOCKÉ (snapshot au save), pas de
jointure d'affichage.** Au moment d'enregistrer, on fige dans `conference` le
libellé courant (nom de la conf, ou `buildEditionLibelle` si une édition est
choisie). Raisons :
- un talk est un **fait historique** (« j'ai parlé à Sunny Tech 2024 ») :
  propager un renommage orga aux talks passés est un nice-to-have, pas une
  exigence ;
- le chemin de lecture reste **inchangé** : `getTalksByProfileId` demeure un
  simple SELECT et `TalkCard` affiche `talk.conference` tel quel (pas de
  jointure ni de recomposition `buildEditionLibelle` sur le chemin chaud) ;
- le texte est de toute façon déjà stocké (revalidation, fallback SET NULL).

Conséquence : pas d'ajout sur `getTalksByProfileId` ni sur le rendu. Le lien
`conference_id`/`edition_id` sert au pré-remplissage, à la cohérence et aux
usages futurs, **pas** à l'affichage.

Note (pas un DTO) : les talks n'ont pas de DTO public dédié —
`speakeuses/[id]/page.tsx` passe l'objet `Talk` à `TalkCard`, qui est un
**Server Component** : les ids non affichés ne partent pas dans le DOM. Le
risque n'est donc pas une fuite actuelle mais futur : **ne jamais passer l'objet
`Talk` complet à un composant client** (les ids internes fuiraient). À garder en
tête si `TalkCard` devenait client.

## 2.6 Tests (TDD)

- `talks.test.ts` : nouvelle forme de `getTalkSuggestions` (registre groupé +
  libres) ; `addTalk`/`updateTalk` écrivent `conference_id`.
- Intégration PGlite : migration (colonne + rétro-remplissage + idempotence),
  cohérence édition∈conférence, `ON DELETE SET NULL`.
- Actions : `conferenceId` falsifié corrigé serveur ; édition d'une autre conf
  refusée/re-alignée ; repli libre → aucun FK ; lien préservé à la réouverture.
- **Moissonneuse** : `acceptSuggestion` pose bien `conference_id` = conf de
  l'édition acceptée (non-régression de l'invariant sur le chemin d'import).
- **Invariant source de vérité** : un talk relié dont la conf est supprimée
  garde son texte `conference` lisible (fallback SET NULL).
- **Réouverture d'un vieux talk hors borne 18 mois** : conf + édition
  re-préselectionnées sans casser le lien (le cas UI le plus subtil du refactor).
- Composant : conf connue → éditions proposées ; conf sans édition → pas de
  liste ; « Autre » → texte libre ; pré-remplissages sans écrasement.

## 2.7 Lots

1. **Migration + accès données** (`conference_id`, `getTalkSuggestions` groupé,
   `addTalk`/`updateTalk`).
2. **Formulaire** (deux sélecteurs, repli libre, pré-remplissages).
3. **Revalidation serveur** généralisée + affichage par jointure.
Chaque lot en TDD, rien ne merge en rouge.

---

# 3. Revue de conception

Revue indépendante menée sur le doc + le code (`talks.ts`, `conferences.ts`,
`TalkForm.tsx`, `actions.ts`, `talk-form.ts`, `cfp-suggestions.ts`,
`schema.sql`). Verdict global : ossature solide et cohérente avec l'existant ;
un trou concret (chemin moissonneuse), une décision d'altitude (affichage) et
quelques imprécisions, tous intégrés ci-dessus. Détail des arbitrages :

## 3.1 Arbitrages sur les points ouverts

- **A. `conference_id` : OUI, retenu.** C'est le seul moyen d'exprimer « relié à
  une conf connue sans édition précise » (les 37 confs du seed, sans édition) et
  de sortir de l'égalité de chaîne. Coût : 1 colonne nullable + 1 index.
  Proportionné, pas de sur-ingénierie.
- **B. Affichage : SNAPSHOT (libellé stocké), PAS de jointure.** Un talk est un
  fait historique ; propager un renommage aux talks passés est un nice-to-have,
  pas une exigence. La jointure imposerait de recomposer `buildEditionLibelle`
  sur le chemin de lecture chaud (fiche + carte), là où le snapshot laisse
  `getTalksByProfileId` et `TalkCard` inchangés. KISS. (§ 2.5 mis à jour.)
  → **Point à confirmer avec toi** : ok pour que renommer une conf côté orga
  ne change PAS le libellé des talks déjà enregistrés ?
- **C. `<select>` natif pour la v1**, en assumant la perte du filtrage-au-clavier
  qu'offrait le `datalist` (type-ahead natif correct sur desktop, médiocre sur
  mobile au-delà de ~50 items). Si la liste dépasse ~50 confs, prévoir un
  combobox recherchable (APG) en évolution. Pas de sur-investissement maintenant.
- **D. Rétro-remplissage depuis `edition_id` seul, aucun matching par nom.**
  Retenu : le matching par orthographe proche relierait des talks à la mauvaise
  conf (faux positifs).
- **E. Repli libre : `datalist` conservé, mais EXCLUANT les noms du registre.**
  `conferencesLibres` = uniquement les saisies libres passées, pour ne pas
  suggérer en texte libre une conf qui devrait être choisie dans le sélecteur
  structuré.

## 3.2 Corrections intégrées au doc (issues de la revue)

1. **Chemin moissonneuse** ajouté (§ 2.4 + § 2.6) : `acceptSuggestion` doit
   poser `conference_id = e.conference_id` (le JOIN est déjà là) — sinon tout
   nouveau talk importé violerait l'invariant. C'était le trou majeur.
2. **Invariant de source de vérité** énoncé (§ 2.4) et à tester : le texte
   `conference` n'est jamais la vérité quand un lien existe ; il survit au
   `ON DELETE SET NULL` comme fallback lisible.
3. **`ConferenceFields` : patron, pas composant** (§ 2.3) — ne pas hériter de la
   création de conf du Tremplin (« Autre » = texte libre ici).
4. **« DTO public » corrigé** (§ 2.5) : il n'existe pas pour les talks ; le
   risque réel est de passer un jour l'objet `Talk` complet à un composant
   client. `TalkCard` est aujourd'hui un Server Component → pas de fuite.
5. **Fusion de confs** actée hors périmètre (§ 1.7).

## 3.3 Décisions validées

- **Arbitrage B tranché (2026-07-11) : SNAPSHOT.** Renommer une conférence ne
  réécrit PAS le libellé des talks déjà enregistrés (fait historique). Confirmé
  par l'utilisatrice. Toute la conception est donc figée ; prête à implémenter.
- Rappel : il y a **une migration** (`conference_id` sur `speaker_talks`), donc
  procédure Neon au déploiement comme pour la 027.
- **Dépendance de séquencement** : l'implémentation touche `getTalkSuggestions`
  et `TalkForm`, que la PR #133 modifie déjà. Partir d'un `main` FRAIS APRÈS le
  merge de #133 (sinon conflits / on rebâtit sur du code en instance).
