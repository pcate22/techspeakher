# Conception : un même talk donné dans plusieurs conférences

> Statut : **implémentée** (même PR que cette conception). Migration
> `db/migrations/044_talk_occurrences.sql` (expand-only : le contract — drop des
> colonnes legacy de `speaker_talks` — viendra dans une migration ultérieure,
> une fois le déploiement vérifié).
> Contexte amont : `docs/conception-registre-conferences.md` (modèle
> `conferences` → `conference_editions`) et
> `docs/conception-talk-conference-edition.md` (lien talk → conf → édition).
> Règle d'or à respecter : `docs/principes-conception-ui.md` (une page = un
> rôle, un CTA principal).
> Suite : `docs/conception-logos-conferences.md` — l'affichage des occurrences
> (logo de la conférence, nom, date/lieu), qui rend enfin visible un talk rejoué.

## Le besoin

Un bon talk est **rejoué** : la même conférence part à Devoxx, puis au DevFest
Nantes, puis en meetup en ligne. La capture qui a déclenché ce chantier (portail
d'une speakeuse, « Charmer les dragons ») le montre bien : **un titre**, puis une
**liste d'événements** (NCL Days juin 2026 · en ligne, Devoxx avril 2026 · Paris,
DevFest Nantes oct. 2025 · Nantes), **chacun avec ses propres slides**.

Aujourd'hui, `speaker_talks` est **plat** : une ligne = un talk **donné une seule
fois** à un seul événement. Redonner le même talk oblige à **recréer une ligne**,
en **recopiant** titre, type et description. Conséquences :

1. **Duplication de l'identité.** Le titre et le résumé vivent en trois
   exemplaires. Corriger une coquille = la corriger trois fois. C'est
   exactement l'écueil « modèle plat pour une donnée hiérarchique » déjà
   diagnostiqué pour les conférences (`conception-talk-conference-edition.md`
   § 1).
2. **La fiche publique ment sur le volume.** Trois lignes « Charmer les
   dragons » se suivent : on lit trois talks là où il y en a un, donné trois
   fois. La carte de l'annuaire (`getPublicTalkTitlesByProfile`) répète le même
   titre.
3. **Rien ne relie les occurrences.** Impossible d'afficher « ce talk, je l'ai
   donné 3 fois » ni de trier « mes talks les plus rodés ».

**Objectif** : modéliser explicitement **un talk (identité)** et ses **N
occurrences** (une prise de parole datée, à une conférence, avec ses liens
propres). La saisie d'un talk **jamais encore donné** (le « Sujet proposé »
d'aujourd'hui) reste un talk **à zéro occurrence** — le modèle l'exprime
naturellement.

Vocabulaire du doc : **talk** = l'identité (titre, type, résumé) ;
**occurrence** = une fois où ce talk a été donné (conférence + date + lieu +
liens). Côté UI, on ne dira jamais « occurrence » à l'utilisatrice : on parlera
de **« conférences »** ou d'**« interventions »** rattachées au talk.

---

# 1. Conception fonctionnelle

## 1.1 Le modèle mental

Un talk se décrit **une fois** (titre, type, résumé) et se **rejoue** autant de
fois qu'on veut. Chaque fois qu'on le donne :

- **où** (conférence de la référence, ou saisie libre) et **quelle édition** ;
- **quand** (date, éventuellement partielle : « juin 2026 ») et **où** (ville,
  pays, ou « en ligne ») ;
- **ses liens à elle** : slides (une version peut différer d'un événement à
  l'autre), vidéo, feedback, page de la conf.

Un talk à **zéro conférence rattachée** est un **sujet** : proposé, prêt à être
pitché, pas encore donné. C'est le cas d'entrée pour une speakeuse qui débute
(la mission de l'asso), et celui des sujets remontés du Tremplin.

## 1.2 Ce qu'on voit — fiche publique (cible = la capture)

Une **carte par talk**, pas par occurrence :

- en tête : le **type** (badge « Conférence »), le **titre**, le **résumé** ;
- en dessous : la **liste des conférences** où il a été donné, **la plus récente
  d'abord**, chaque ligne portant `conférence · lieu · date` et **ses liens**
  (Slides, Vidéo, Feedback, site de la conf) ;
- un talk **sans conférence rattachée** s'affiche seul (type + titre + résumé),
  sans liste — c'est un sujet proposé, pas un manque à signaler.

Bénéfice direct : la carte de l'**annuaire** cesse de répéter le même titre (un
titre = un talk), et la fiche dit la vérité (« donné 3 fois »).

## 1.3 Ce qu'on fait — gestion (mon espace)

Application stricte de la **règle d'or** (`principes-conception-ui.md`) : *une
page = un rôle, un CTA*. On ne pose **jamais** un formulaire par occurrence
empilé sur une page de consultation (l'erreur `/admin/conferences` du registre
des erreurs).

- **`/mon-espace/talks`** (liste = hub) : une ligne par talk, **cliquable vers
  sa page**. Un seul CTA : « Ajouter un talk ». La ligne peut afficher un
  compteur discret (« 3 conférences »).
- **`/mon-espace/talks/[id]`** (page du talk = le contexte de l'item) :
  - **haut** : l'**identité** (titre, type, résumé) — un seul formulaire, le CTA
    de la page ;
  - **bas** : la **liste des conférences rattachées** (lecture seule : `conférence
    · lieu · date`), chacune avec **« Modifier »** vers **sa page dédiée** ; un
    bouton **« Ajouter une conférence »** mène à la page d'ajout. On n'empile
    aucun formulaire d'occurrence sur la page du talk.
- **Page dédiée d'une conférence** (`/mon-espace/talks/[id]/conference/nouveau`
  et `…/conference/[occId]`) : le formulaire d'occurrence vit **dans le contexte
  de son item** (hub-and-spoke, `principes-conception-ui.md` § 1 : « page dédiée
  de l'item »). Le **« Retirer »** (geste destructif, `ConfirmSubmitButton`) vit
  sur la page de l'occurrence, pas en série sur la liste — on évite ainsi les
  boutons « Retirer » identiques (registre des erreurs § 6).
- **Créer un talk** : **minimal** (titre + type), puis on atterrit sur sa page
  pour, si on veut, rattacher une première conférence. On applique l'acquis
  « créer minimal, compléter sur la fiche » (registre des erreurs : éviter deux
  pages création/édition distinctes). Rattacher une conférence **n'est jamais
  obligatoire** (un sujet proposé est un talk valide).

Le **formulaire de conférence** (`OccurrenceForm`) fait **choisir dans le
registre qu'on a déjà** (`conferences` → `conference_editions`, migration 027) :
d'abord **la conférence** (la marque : Devoxx, DevFest Nantes…), puis **son
édition** quand elle existe. Il réutilise le **patron** des deux sélecteurs liés
conçu en `conception-talk-conference-edition.md`, avec pré-remplissage
ville/pays/date/lien sans écrasement. **Pas de saisie libre** : si la conférence
manque, un lien « Ma conférence n'est pas dans la liste » renvoie vers le
**formulaire de demande d'ajout** (flux `conference_propositions` existant).
Détail du modèle, des trois cas et du flux de proposition : § 2.1 bis.

## 1.4 Wording (forme positive, `principes-conception-ui.md` § 5)

Toujours dire ce qui **est** ou ce qu'on **fait** :

- talk sans conférence : **« Aucune conférence rattachée »** (jamais « n'a
  pas encore… ») ;
- l'action de détacher : **« Retirer »** (jamais « ne plus rattacher ») ;
- confirmations **nominatives** : « La conférence "Devoxx 2026" est retirée de
  ce talk. », « "Charmer les dragons" est enregistré. » ;
- ajouter : **« Ajouter une conférence »** / **« Ajouter un talk »**.

## 1.5 Accessibilité (RGAA)

- Section « conférences » du talk en `aria-labelledby` ; erreurs `role="alert"` ;
  mention « nouvelle fenêtre » en `sr-only` sur les liens externes (déjà l'usage
  de `TalkCard`) ; `focus-visible` partout.
- Le formulaire de conférence vit sur une **page dédiée** (pas de piège de focus
  à gérer, contrairement à un dialog) ; le retrait passe par une modale de
  confirmation (`ConfirmSubmitButton`, Radix AlertDialog) ; cibles tactiles ≥ 44 px.
- Chaque ligne de conférence est **dans le contexte de son item** : pas de
  série de boutons « Retirer » identiques différenciés par le seul `aria-label`
  (registre des erreurs § 6). Le libellé nomme la conférence.

## 1.6 Hors périmètre (assumé)

- **Co-speakeuses** (le « Duo · Rachel Dubois » de la capture) : c'est un **autre
  axe** (le modèle n'a aucun co-orateur aujourd'hui). Le modèle d'occurrences ne
  l'empêche pas ; à traiter à part.
- **Fusionner deux talks existants** (j'ai importé le même talk en double via le
  moissonneur, je veux les regrouper) : voir § 2.5, arbitrage. v1 = on crée le
  talk une fois puis on **ajoute** ses conférences ; la fusion de doublons
  historiques est un nice-to-have (peu de données : le site est jeune).
- **Rapprochement automatique par titre** des sessions moissonnées : **refusé**
  (faux positifs), cohérent avec le refus du matching par nom pour les
  conférences (`conception-talk-conference-edition.md` § 3.1 D).
- **Type par occurrence** (le même talk en « Conférence » ici, « Lightning »
  ailleurs) : le `type` reste sur l'**identité** en v1 (§ 3, arbitrage B).
- **Réordonner à la main** les conférences : l'ordre est **dérivé de la date**
  (récente d'abord), pas de glisser-déposer.

---

# 2. Conception technique

## 2.1 Modèle de données — deux tables

**Décision (arbitrage A, § 3) : séparer identité et occurrences.**
`speaker_talks` devient la **table d'identité** ; les colonnes « par événement »
partent dans une nouvelle table `talk_occurrences`.

`speaker_talks` **garde** : `id`, `speaker_profile_id`, `titre`, `type`,
`description`, et **`source`** (voir la nuance ci-dessous). Elle **perd** :
`conference`, `ville`, `pays`, `date`, `lien_conf`, `lien_slides`, `lien_video`,
`lien_feedback`, `edition_id`, `external_id`.

```sql
CREATE TABLE IF NOT EXISTS talk_occurrences (
  id                 SERIAL PRIMARY KEY,
  talk_id            INTEGER NOT NULL REFERENCES speaker_talks(id) ON DELETE CASCADE,
  -- Dénormalisé depuis le talk parent : nécessaire à l'index d'idempotence du
  -- moissonneur (un index unique partiel ne peut pas traverser deux tables).
  -- Invariant garanti par le chemin d'écriture (cf. § 2.3) et testé.
  speaker_profile_id INTEGER NOT NULL REFERENCES speaker_profiles(id) ON DELETE CASCADE,
  -- Lien de PREMIER ORDRE au registre existant (migration 027). La conférence
  -- d'une occurrence est CHOISIE dans `conferences` (la marque) puis, si elle
  -- existe, dans `conference_editions` (l'édition datée). Cf. § 2.1 bis.
  conference_id INTEGER REFERENCES conferences(id) ON DELETE SET NULL,
  edition_id    INTEGER REFERENCES conference_editions(id) ON DELETE SET NULL,
  -- Libellé figé (SNAPSHOT du nom de la conf choisie AU SAVE) : sert d'affichage
  -- et de rescapé du ON DELETE SET NULL ; jamais tapé « en dur » par la
  -- speakeuse (pas de saisie libre, § 2.1 bis), jamais la vérité du lien (§ 2.5).
  -- Les talks texte-libre HISTORIQUES gardent ici leur ancienne mention (legacy).
  conference    TEXT,
  ville         TEXT,
  pays          TEXT,
  date          TEXT,                 -- même sémantique texte que today (dates partielles)
  lien_conf     TEXT,
  lien_slides   TEXT,
  lien_video    TEXT,
  lien_feedback TEXT,
  -- Provenance moisson d'une occurrence : 'manuel' | 'sessionize' | 'conference-hall'
  source        TEXT NOT NULL DEFAULT 'manuel',
  external_id   TEXT
);

CREATE INDEX IF NOT EXISTS idx_talk_occurrences_talk
  ON talk_occurrences (talk_id);
CREATE INDEX IF NOT EXISTS idx_talk_occurrences_conference
  ON talk_occurrences (conference_id);
CREATE INDEX IF NOT EXISTS idx_talk_occurrences_edition
  ON talk_occurrences (edition_id);

-- Idempotence du moissonneur : une session externe = au plus une occurrence
-- par profil (déplace speaker_talks_profile_source_external_id_key).
CREATE UNIQUE INDEX IF NOT EXISTS talk_occurrences_profile_source_external_id_key
  ON talk_occurrences (speaker_profile_id, source, external_id)
  WHERE external_id IS NOT NULL;
```

`ON DELETE CASCADE` sur `talk_id` : supprimer un talk emporte ses occurrences
(cohérent avec « le talk est l'identité »). `ON DELETE SET NULL` sur
`conference_id` **et** `edition_id` : identique à la politique du registre —
supprimer une conf ou une édition côté orga ne casse pas une occurrence, son
libellé texte (SNAPSHOT) survit comme mention lisible.

### 2.1 bis — Lier au registre existant (`conferences` → `conference_editions`)

**Exigence (confirmée le 2026-07-25) : une occurrence est rattachée au registre
qu'on a déjà, pas à du texte libre.** Le registre, ce sont les deux tables de la
migration 027 : `conferences` (la marque : Devoxx, DevFest Nantes, MiXiT…) et
`conference_editions` (l'édition datée : « Devoxx 2026 », un meetup). Une
occurrence porte donc **deux FK de premier ordre** :

- `conference_id` → **quelle conférence** (la marque de la liste) ;
- `edition_id` → **quelle édition** de cette conférence, quand elle existe.

Le parcours de saisie est le **patron des deux sélecteurs liés** déjà conçu
(`conception-talk-conference-edition.md`) : on choisit la conférence, puis son
édition. Trois cas, tous couverts :

| Choix | Ce qu'on enregistre |
| --- | --- |
| Conférence connue **avec** édition choisie | `conference_id` + `edition_id` (l'édition en déduit la conf, garde-fou serveur) |
| Conférence connue **sans** édition (les 37 du seed n'en ont pas encore) | `conference_id` seul, `edition_id` NULL, date saisie à la main |
| Conférence **hors registre** | **PAS de saisie libre** → on **demande l'ajout** (flux `conference_propositions`) ; l'occurrence n'est rattachable qu'une fois la conf validée par l'orga |

**Décision (confirmée le 2026-07-25) : aucune saisie libre de conférence sur une
occurrence.** Une occurrence se rattache **uniquement** à une conférence du
registre validé. Si la conférence manque, la speakeuse **demande son ajout** —
elle ne la tape pas « en dur ». C'est un **durcissement volontaire** par rapport
à `conception-talk-conference-edition.md` (§ 1.7, qui gardait la saisie libre) :
on privilégie ici l'intégrité du registre et un annuaire public propre (aucun
nom de conf non validé affiché).

Le flux « demander l'ajout » **existe déjà** et est réutilisé tel quel :
- **membre** : `proposeConferenceAction` → `createConferenceProposition`
  (`src/lib/conference-propositions.ts`), rate-limité, écrit dans
  `conference_propositions` — une **quarantaine** que ni les sélecteurs ni le
  moissonneur ne lisent (zéro fuite) ;
- **orga** : `validateConferenceProposition` promeut vers `conferences`
  (+ `conference_editions`) depuis `/admin/conferences`, ou
  `refuseConferenceProposition`.

Depuis le formulaire de conférence, « Ma conférence n'est pas dans la
liste » renvoie vers **le formulaire de proposition** (pré-rempli de ce qui a été tapé)
et confirme « Ta demande d'ajout est envoyée, tu pourras rattacher cette
conférence une fois validée. » **L'occurrence n'est pas créée** avec une conf non
validée (voir arbitrage G, § 3 : rattacher-après-validation plutôt que créer une
occurrence « en attente » — plus simple, aucun état fantôme public).

> **Réconciliation avec `conception-talk-conference-edition.md`.** Ce doc-là
> proposait d'ajouter `conference_id` **sur `speaker_talks`** (table plate). Avec
> le split identité/occurrences, la donnée « à quelle conf, quelle édition »
> appartient à l'**occurrence** : `conference_id` et `edition_id` vivent donc sur
> `talk_occurrences`, **pas** sur `speaker_talks`. Les deux chantiers convergent ;
> celui-ci **absorbe** le `conference_id` de l'autre au bon niveau. À séquencer
> pour ne pas poser la colonne deux fois (cf. § 3.3).

### La nuance `source` (un overload à démêler, pas à recopier)

`speaker_talks.source` porte **aujourd'hui deux sens** dans une seule colonne :

1. **provenance moisson** (`'manuel' | 'sessionize' | 'conference-hall'`) — c'est
   un fait **par occurrence** ;
2. **`'tremplin'`** = talk **rétro-créé** depuis le sujet Tremplin,
   **masqué de l'annuaire** tant qu'il n'est pas confirmé
   (`getPublicTalksByProfileId` filtre `source IS DISTINCT FROM 'tremplin'`) —
   c'est un fait **d'identité** (visibilité).

Le split les **sépare proprement** :

- **identité** : `speaker_talks.source` ne garde que le sens **visibilité**
  (`'manuel'` par défaut, `'tremplin'` = masqué jusqu'à confirmation). Le filtre
  public reste sur l'identité, inchangé ;
- **occurrence** : `talk_occurrences.source` / `external_id` portent la
  **provenance moisson** et l'idempotence.

C'est un bénéfice du split : on cesse de faire porter deux invariants à une même
colonne.

## 2.2 Migration (expand / contract, cf. § 3 arbitrage C)

`db/migrations/NNN_talk_occurrences.sql` + `schema.sql` + `sync-to-latest.sql`
(idempotents, drift-testés). Séquence **expand → migrer le code → contract** pour
qu'il n'y ait jamais de fenêtre où schéma et code divergent :

**Migration N (expand + backfill, sans rien supprimer) :**

```sql
-- 1. Table + index (cf. § 2.1).

-- 2. Backfill : chaque talk DÉJÀ DONNÉ devient une occurrence. Un talk sans
--    aucune donnée d'événement (sujet proposé pur) reste à ZÉRO occurrence.
--    conference_id est RÉTRO-REMPLI depuis l'édition déjà reliée (déterministe,
--    même logique que conception-talk-conference-edition.md § 2.1).
INSERT INTO talk_occurrences
  (talk_id, speaker_profile_id, conference_id, edition_id, conference, ville, pays,
   date, lien_conf, lien_slides, lien_video, lien_feedback, source, external_id)
SELECT t.id, t.speaker_profile_id, e.conference_id, t.edition_id, t.conference,
       t.ville, t.pays, t.date, t.lien_conf, t.lien_slides, t.lien_video,
       t.lien_feedback, t.source, t.external_id
  FROM speaker_talks t
  LEFT JOIN conference_editions e ON e.id = t.edition_id   -- déduit la conf de l'édition
 WHERE t.conference IS NOT NULL OR t.ville IS NOT NULL OR t.pays IS NOT NULL
    OR t.date IS NOT NULL OR t.edition_id IS NOT NULL OR t.external_id IS NOT NULL
    OR t.lien_conf IS NOT NULL OR t.lien_slides IS NOT NULL
    OR t.lien_video IS NOT NULL OR t.lien_feedback IS NOT NULL;
-- Talks en texte libre historique (edition_id NULL) : laissés SANS conference_id
-- (aucun matching par nom, risque de faux positif). Ils se relieront au registre
-- si la speakeuse rouvre l'occurrence et choisit la conf dans la liste.

-- 3. Normaliser speaker_talks.source pour son sens résiduel « visibilité » :
--    tout ce qui était 'sessionize'/'conference-hall' (provenance d'occurrence,
--    désormais portée par l'occurrence) redevient 'manuel' au niveau identité ;
--    'tremplin' est conservé (masquage public).
UPDATE speaker_talks SET source = 'manuel'
 WHERE source NOT IN ('manuel', 'tremplin');
```

Idempotence : le backfill est **rejouable** sans doublonner (garde
`WHERE NOT EXISTS (SELECT 1 FROM talk_occurrences o WHERE o.talk_id = t.id)` dans
`sync-to-latest.sql`).

**Migration N+1 (contract, une fois le code déployé) :** `DROP` des colonnes
mortes de `speaker_talks` (`conference`, `ville`, `pays`, `date`, `edition_id`,
`lien_*`, `external_id`) et de l'ancien index
`speaker_talks_profile_source_external_id_key`. On peut fusionner N et N+1 en une
seule migration si l'on assume de déployer le code dans le même mouvement.
Retenu ici : **expand seul** (contract plus tard) — arbitrage C.

## 2.3 Accès aux données (`src/lib/talks.ts`)

Nouveau type + identité enrichie :

```ts
export interface TalkOccurrence {
  id: number;
  conferenceId: number | null; // FK registre : la conférence (marque) choisie
  editionId: number | null;    // FK registre : l'édition datée, si elle existe
  conference: string | null;   // libellé figé (snapshot) / repli saisie libre
  ville: string | null;
  pays: string | null;
  date: string | null;
  lienConf: string | null;
  lienSlides: string | null;
  lienVideo: string | null;
  lienFeedback: string | null;
}

export interface Talk {
  id: number;
  profileId: number;
  titre: string;
  type: string;
  description: string | null;
  occurrences: TalkOccurrence[]; // triées récente d'abord (ordre d'affichage)
}
```

- **Lecture** : `getTalksByProfileId` / `getPublicTalksByProfileId` / `getTalkById`
  font **un SELECT talks + un SELECT occurrences** (bornées au périmètre) puis
  **regroupent en mémoire** par `talk_id` (patron déjà utilisé par
  `listConferencesForAdmin`). Le filtre public (`source IS DISTINCT FROM
  'tremplin'`) reste **sur l'identité**.
- **`getPublicTalkTitlesByProfile`** (carte annuaire) : lit `speaker_talks`
  seul → **un titre = un talk**, la déduplication est gratuite (corrige au
  passage la répétition de titres identiques).
- **`getPublicTalkTextByProfile`** (recherche) : agrège titre + description de
  l'identité ; on peut y **ajouter les noms de conférences** des occurrences
  pour retrouver « le talk qu'elle a donné à Devoxx » (Fuse.js). Optionnel.
- **Écritures identité** : `addTalk` (titre + type + description → renvoie l'id) ;
  `updateTalk` ; `deleteTalk` (CASCADE emporte les occurrences).
- **Écritures occurrence** : `addOccurrence(talkId, profileId, input)`,
  `updateOccurrence(occId, profileId, input)`, `removeOccurrence(occId, profileId)`.
  **Toutes scopées par `speaker_profile_id`** (ownership), SQL paramétré.
  `addOccurrence` **pose `speaker_profile_id` = celui du talk parent** (invariant
  de dénormalisation, § 2.1) : jamais une valeur venue du client.

## 2.4 UI — composants

- **`TalkCard`** (Server Component, reste serveur — ne jamais passer l'objet
  `Talk` complet à un composant client, les ids internes fuiraient) : rend
  l'identité puis **map les occurrences** (chaque ligne = `conférence · lieu ·
  date` + liens). Zéro occurrence → pas de liste. Pilotable par **capacités**
  (`{ editHref, peutGérer }`) pour être partagé fiche publique / espace / orga
  (principe § 3 « un composant, N capacités »), sans recoder par rôle.
- **Dialog « conférence »** : réutilise le **patron** des deux sélecteurs liés
  (`conception-talk-conference-edition.md`) — conf du registre → édition,
  pré-remplissage ville/pays/date/lien **sans écraser une saisie**. **Pas de
  saisie libre** : « Ma conférence n'est pas dans la liste » renvoie au formulaire
  de **demande d'ajout** (`proposeConferenceAction`), il ne crée pas d'occurrence
  en texte libre. `OccurrenceForm` vit sur une page dédiée (pas de dialog à
  gérer).
- **Micro-actions** (retirer une conférence, basculer) : **pattern résultat**
  (`useActionState` + `router.refresh()`), **pas** de PRG (sinon on perd le
  scroll et le contexte — `principes-conception-ui.md` § 4). Feedback inline
  nominatif à côté du bouton.

## 2.5 Server Actions & validation (sécurité)

- Identité **toujours issue de la session** ; ré-vérifier `session.user` et
  l'ownership du talk **côté serveur** à chaque action (ajout/màj/retrait
  d'occurrence). Entrées validées par Zod (réutiliser / étendre
  `talk-form.ts`), SQL **paramétré**.
- **Revalidation du lien au registre** (généralisée dans
  `conception-talk-conference-edition.md` § 2.4) : appliquée **par occurrence**,
  les champs `conferenceId`/`editionId` étant des champs cachés **falsifiables** —
  la vérité vient du serveur :
  1. si `editionId` fourni : vérifier qu'elle existe, en **déduire** sa
     `conference_id` réelle et **forcer** `conferenceId` à cette valeur (le
     client ne peut pas rattacher une édition à une autre conf) ;
  2. si `conferenceId` fourni sans édition : vérifier qu'il **existe dans le
     registre** ; sinon **rejet** (pas de repli en texte libre) ;
  3. **aucune saisie libre acceptée** : une occurrence sans `conference_id`
     valide est refusée (la conf manquante passe par « demander l'ajout », qui
     ne crée pas d'occurrence). Le `conference` texte est **dérivé du registre**
     au save, jamais lu du client.
  Le libellé `conference` est **figé au save** (SNAPSHOT, arbitrage inchangé,
  § 3 D) — un talk est un fait historique, renommer une conf côté orga ne
  réécrit pas les occurrences passées. **Invariant testé** : quand
  `conference_id`/`edition_id` est posé, le texte `conference` n'est jamais la
  vérité, seulement l'affichage et le rescapé du `ON DELETE SET NULL`.
- **Chemin moissonneur** (`src/lib/cfp-suggestions.ts`, `acceptSuggestion`) :
  crée désormais **un talk + une occurrence** (au lieu d'une ligne plate). La
  décision « est-ce le même talk qu'un existant ? » **n'est pas automatique**
  (pas de matching par titre) : chaque session acceptée = **un talk d'une
  occurrence**. Le regroupement reste **manuel** (§ 2.6). L'`external_id` et la
  `source` de moisson vont **sur l'occurrence** (nouvel index d'idempotence).
  L'occurrence importée **pose son `conference_id`** = celle de l'édition
  acceptée (`acceptSuggestion` joint déjà `conference_editions` : une ligne de
  plus au SELECT), sans quoi tout talk moissonné aurait une édition sans conf.
  Vérifier de même `cfp-sync` et tout autre chemin d'écriture de talk moissonné.
- **Retirer la dernière conférence** d'un talk est **autorisé** : le talk
  redevient un sujet (zéro occurrence), aucune orpheline (l'identité est sa
  propre ligne).

## 2.6 Impacts transverses

- **Tremplin** (`tremplin_registrations.talk_id → speaker_talks`) : **inchangé et
  plus propre**. Le pitch pointe l'**identité** ; le titre pitché se lit toujours
  par jointure `talk_id → speaker_talks.titre`. Les occurrences s'accumulent
  indépendamment. Cas : un sujet remonté du Tremplin (`source='tremplin'`, zéro
  occurrence) réellement donné plus tard → on lui **ajoute une occurrence** ;
  faut-il **auto-confirmer** (basculer `source` → `'manuel'`, le rendre public) ?
  → arbitrage E : **rester explicite en v1** (ne pas coupler « ajouter une
  conférence » et « rendre public »).
- **Regrouper des talks existants** (doublons d'import) : hors v1. Piste simple
  si besoin plus tard : une action « rattacher cette conférence à un autre
  talk » (déplace l'occurrence, puis supprime le talk vidé). Pas de fusion
  d'identités automatisée.
- **Carte annuaire / recherche** : déjà couvert (§ 2.3), bénéfice net (dédup).

## 2.7 Tests (TDD — rien ne merge en rouge)

- **Migration (intégration PGlite)** : backfill = **une** occurrence par talk
  donné, **zéro** pour un sujet proposé pur ; **`conference_id` rétro-rempli
  depuis l'édition** (talk relié à une édition ⇒ occurrence porte la conf
  déduite) ; talk texte libre ⇒ occurrence **sans** FK ; idempotence (rejouer ne
  doublonne pas) ; `source` d'identité normalisée (`'tremplin'` préservé, reste
  → `'manuel'`) ; `ON DELETE CASCADE` (supprimer un talk supprime ses
  occurrences) ; `ON DELETE SET NULL` sur `conference_id` **et** `edition_id`.
- **Idempotence moisson** : deux acceptations de la même session (même
  `external_id`) → une seule occurrence (nouvel index unique partiel).
- **Reads** : `getPublicTalkTitlesByProfile` dédup (un titre par talk) ;
  occurrences triées récente d'abord ; filtre `'tremplin'` sur l'identité.
- **Actions (garde-fous)** : ownership (occurrence d'une autre speakeuse
  refusée) ; `speaker_profile_id` de l'occurrence **forcé** = celui du talk
  (jamais le client) ; **`conferenceId` falsifié corrigé serveur** ; **édition
  d'une autre conf refusée / réalignée** (le `conference_id` est déduit de
  l'édition, pas cru du client) ; **occurrence sans `conference_id` valide
  refusée** (aucune saisie libre) ; lien préservé à la réouverture ; retrait de
  la dernière occurrence autorisé.
- **Demande d'ajout** : « conf pas dans la liste » crée une
  `conference_propositions` (rate-limitée) et **aucune occurrence** ; la conf
  proposée n'apparaît dans le sélecteur qu'**après** `validateConferenceProposition`.
- **Tremplin** : la jointure `talk_id → titre` lit toujours le bon titre ;
  supprimer un talk pitché met `talk_id` à NULL (SET NULL déjà en place).
- **UI** : `TalkCard` sans occurrence (sujet) → pas de liste ; avec N → N lignes,
  liens par occurrence ; wording en **forme positive** ; a11y
  (`aria-labelledby`, `role="alert"`, focus-visible).

## 2.8 Lots (chacun en TDD)

1. **Migration expand + accès données** (`talk_occurrences`, backfill, `Talk` +
   `TalkOccurrence`, lectures regroupées, écritures identité/occurrence).
2. **Moissonneur** : `acceptSuggestion` → talk + occurrence, index
   d'idempotence déplacé.
3. **UI** : `TalkCard` (identité + liste), page du talk (identité + gestion des
   conférences sur pages dédiées), actions serveur + revalidation par occurrence.
4. **Contract** : drop des colonnes mortes de `speaker_talks` (migration N+1),
   une fois 1-3 déployés.

---

# 3. Revue de conception — arbitrages

## 3.1 Décidés (avec justification)

- **A. Deux tables (identité + occurrences) — RETENU.** La donnée est
  hiérarchique (1 talk, N interventions) ; le modèle plat force la duplication de
  l'identité et l'anti-pattern déjà nommé pour les conférences. Alternative
  écartée : une **clé de regroupement** (`parent_talk_id`) sur la table plate —
  elle laisse l'identité soit dupliquée (deux sources de vérité, contraire au
  § 7 « normaliser au bord »), soit portée par une ligne « primaire » qui est à
  la fois identité **et** occurrence (supprimer « la première » orpheline le
  reste, et chaque lecture doit `coalesce` vers le parent). Le split est plus
  simple à lire et à faire évoluer. Coût : une table + un backfill lossless.
- **B. `type` sur l'identité — RETENU en v1.** Le type (« Conférence »,
  « Meetup », « Sujet proposé »…) décrit le talk et alimente la carte annuaire.
  Cas limite assumé : le même talk réduit en « Lightning » ailleurs — perte
  acceptable en v1 ; un `type` par occurrence est une évolution à faible coût si
  le besoin remonte.
- **C. Migration expand / contract — RECOMMANDÉ.** Séparer « ajouter + backfill »
  et « supprimer les colonnes » évite toute fenêtre où code et schéma divergent.
  Retenu : expand-only maintenant, contract dans une migration ultérieure.
  La migration s'applique AUTOMATIQUEMENT au déploiement (vercel-deploy.yml →
  `npm run db:migrate` sur `sync-to-latest.sql`, idempotent), pas de manip Neon.
- **D. Libellé conférence SNAPSHOT (figé au save)** — on **hérite** de la
  décision déjà validée (`conception-talk-conference-edition.md` § 3.3) : un talk
  est un fait historique, renommer une conf ne réécrit pas les occurrences
  passées. Le lien `edition_id` sert au pré-remplissage et à la cohérence, pas à
  l'affichage.
- **E. Moisson = pas de matching automatique par titre.** Chaque session
  acceptée = un talk d'une occurrence ; le regroupement est manuel. Cohérent avec
  le refus du rapprochement par nom pour les conférences (faux positifs).
- **F. Occurrences liées au REGISTRE existant (conf + édition) — CONFIRMÉ le
  2026-07-25.** Une occurrence porte `conference_id` (→ `conferences`) **et**
  `edition_id` (→ `conference_editions`), les deux tables qu'on a déjà (migration
  027). On choisit dans la liste. C'est ce qui rend possibles les usages « ce
  talk à toutes ses éditions », stats par conférence, et propage la cohérence du
  registre. Ce lot **absorbe** le `conference_id` que
  `conception-talk-conference-edition.md` posait sur `speaker_talks` : la donnée
  descend au niveau **occurrence**.
- **G. Aucune saisie libre : conf manquante → demander l'ajout — CONFIRMÉ le
  2026-07-25.** Durcissement volontaire par rapport au repli texte libre de
  `conception-talk-conference-edition.md` § 1.7. Une conf hors registre passe par
  le flux `conference_propositions` **déjà en place** (proposition rate-limitée →
  validation orga → promotion au registre). Recommandation retenue :
  **rattacher-après-validation** (la demande n'ouvre pas une occurrence « en
  attente ») — plus simple, aucun nom de conf non validé ne peut apparaître sur
  l'annuaire public. Alternative plus lourde (occurrence en attente reliée à la
  proposition, promue à la validation) explicitement **reportée**.

## 3.2 À confirmer avec toi

1. **Profondeur du modèle** : on part bien sur les **deux tables** (arbitrage A)
   et pas sur un simple regroupement de la table plate ? (recommandé : deux
   tables.)
2. **Migration** : expand/contract en **deux temps** (plus sûr) ou **une seule**
   migration destructive assumée au déploiement ? (arbitrage C.)
3. **Sujet Tremplin donné pour de vrai** : ajouter une conférence à un sujet
   `source='tremplin'` **auto-confirme** (le rend public) ou on garde les deux
   gestes **séparés** ? (recommandé : séparés, arbitrage E du § 2.6.)
4. **Co-speakeuses** (le « Duo » de la capture) : bien **hors périmètre** de ce
   lot, à traiter comme un axe distinct ? (recommandé : oui.)

## 3.3 Dépendances de séquencement

- Le formulaire de conférence **réutilise le patron** des deux sélecteurs liés de
  `conception-talk-conference-edition.md` (talk → conf → édition). Si ce chantier
  n'est **pas** encore implémenté, ce lot peut soit l'embarquer, soit démarrer
  avec la saisie « conférence » libre actuelle et brancher les sélecteurs quand
  ils arrivent. À séquencer pour éviter de bâtir deux fois le même sélecteur.
- Il y a **une migration structurante** (nouvelle table + backfill). Elle est
  **jouée automatiquement au déploiement** via `db/sync-to-latest.sql`
  (`npm run db:migrate`, avant la livraison du code) : aucune manip Neon
  manuelle. Le drop des colonnes legacy est reporté à une migration CONTRACT.
