# Conception — référence partagée des conférences (éditions + lieux)

> Conception KISS (pas une implémentation). Suite de
> `docs/faisabilite-import-talks.md` (scénario F, le moissonneur) qui est
> **déjà livré** (migration `011`, `src/lib/cfp-*`, cron `sync-talks`).
>
> Le besoin a été élargi en discussion : au-delà du moissonneur, on veut une
> **référence partagée** des conférences (leurs éditions, leurs lieux) que
> réutilisent le **moissonneur**, l'**ajout de talk manuel** et les
> **Tremplins**. Décision d'architecture prise : **table DB partagée** (pas un
> fichier statique). Périmètre d'amorçage : **France** — tech, **product/UX**,
> et **assos toulousaines**.

> **Statut : conception revue (fonctionnelle + technique), prête pour le doc
> d'implémentation.** Décisions actées en revue :
> (1) les talks **pointent la référence** (`edition_id`) dès la V1 — vraie
> source unique, pas seulement une aide à la saisie ; (2) assos toulousaines
> **et leurs meetups datés** : le Toulouse Tech Hub publie `events.json`
> (**MIT**, sync Meetup auto) → on **synchronise** les meetups au lieu de les
> seeder ou de les faire saisir ; (3) **la speakeuse est maîtresse de sa
> fiche** : un talk confirmé/ajouté est publié sans validation orga par talk
> (aligne le code livré ; on corrige la faisabilité qui promettait l'inverse) ;
> (4) une **speakeuse peut contribuer un id d'endpoint Sessionize**, actif
> **directement** (testé automatiquement à la soumission) — les orga sont
> simplement **informées** des ajouts communautaires, elles ne valident pas ;
> (5) **moisson à la demande** : après avoir renseigné son lien Sessionize et
> ajouté ses conférences, la speakeuse **lance le repérage elle-même** et
> vérifie/valide les talks trouvés dans la foulée (le cron quotidien reste le
> filet de fond). Amendements techniques : recomposition du
> libellé de conf au moissonnage, énumération de **tous** les lecteurs de
> `cfp_events` à rebrancher, bouton « Tester l'endpoint », `domaine` retiré.

## Le besoin

> « On a déjà plein d'endroits où on fait référence aux conférences. On a besoin
> de référencer les conférences principales, leurs éditions et lieux pour le
> moissonneur mais aussi pour les ajouts de talk manuel, les potentiels
> Tremplins… Donc dans tous les cas, c'est top. S'il faut ajouter les id
> Sessionize à la main, on le fera. »

Trois usages, une seule référence :

1. **Moissonneur** : une orga déclare qu'une **édition** est à moissonner (id
   d'endpoint Sessionize) → le cron existant la parcourt.
2. **Ajout de talk manuel** : la speakeuse **choisit** une conférence connue
   (nom + ville/pays/lien pré-remplis), et **saisit librement les autres**.
3. **Tremplins** : la « conférence partenaire » d'une édition de Tremplin
   pointe la même référence, au lieu de re-saisir nom/date/lien.

## L'existant : la conférence est déjà modélisée 3 fois (et diverge)

| Endroit | Comment une conférence est stockée | Limite |
|---|---|---|
| `cfp_events` (moissonneur) | `nom, source, endpoint, url, ville, pays, date_debut, actif` | = une **édition** à moissonner, mais isolée |
| `tremplin_editions` | `conf_slug, conf_nom, conf_date, conf_lien` | re-saisi à la main, pas relié au reste |
| `speaker_talks` | `conference, ville, pays` en **texte libre** | pas de source commune → fautes de frappe, doublons |

Le moissonneur (matching, suggestions un-clic, mémoire des refus, refresh
silencieux) est **livré et correct** : on ne touche pas à sa logique, on
**rebranche** juste sa table sous la référence commune.

## Modèle cible (KISS : 2 tables + 1 type)

Le parent = **qui organise** (récurrent) ; l'enfant = **l'événement daté**
(date + lieu). C'est symétrique : une **marque de conférence** organise ses
**éditions** ; une **asso** organise ses **meetups**. Un meetup a donc une
date, un lieu, et une asso qui l'organise = son parent.

```sql
-- L'organisateur récurrent : une MARQUE de conférence OU une ASSO/communauté.
CREATE TABLE conferences (
  id          SERIAL PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,          -- 'devfest-toulouse', 'gdg-toulouse'
  nom         TEXT NOT NULL,                 -- 'DevFest Toulouse', 'GDG Toulouse'
  type        TEXT NOT NULL DEFAULT 'conference', -- 'conference' | 'asso'
  ville       TEXT,                          -- ville d'attache (surtout pour une asso)
  pays        TEXT,
  site_url    TEXT
);

-- L'événement daté : une ÉDITION de conf OU un MEETUP d'asso.
-- Porte la date, le LIEU, et (pour les confs) les champs de moisson (ex-cfp_events).
CREATE TABLE conference_editions (
  id             SERIAL PRIMARY KEY,
  -- RESTRICT (pas CASCADE) : supprimer une conf/asso qui a des événements est
  -- un geste conscient — cohérent avec « on désactive, on ne supprime pas ».
  conference_id  INTEGER NOT NULL REFERENCES conferences(id) ON DELETE RESTRICT,
  type           TEXT NOT NULL DEFAULT 'edition', -- 'edition' (conf) | 'meetup' (asso)
  -- Titre de l'événement : NULL pour une édition de conf (libellé =
  -- conferences.nom + annee) ; titre du meetup pour un meetup (« Apéro Web #57 »)
  -- — sinon deux meetups d'une même asso sont indistinguables.
  nom            TEXT,
  annee          INTEGER,                     -- éditions annuelles ; NULL pour un meetup ponctuel
  date_debut     DATE,                        -- date de l'événement (le meetup EN A une)
  date_fin       DATE,
  ville          TEXT,
  pays           TEXT,
  lieu           TEXT,                        -- salle / hôte (« chez BPCE », « La Cantine »…)
  url            TEXT,                        -- page de cet événement
  -- Moisson (nullable : un événement connu n'est pas forcément moissonné ;
  -- en pratique seules les confs le sont) :
  source         TEXT,                        -- 'sessionize' | 'conference-hall' | NULL
  endpoint       TEXT,                        -- id d'endpoint public ; NULL = pas moissonné
  actif          BOOLEAN NOT NULL DEFAULT FALSE, -- TRUE = dans le lot du cron
  -- Provenance communauté : renseigné quand une membre a ajouté l'endpoint
  -- (actif directement ; les orga sont informées, pas sollicitées).
  propose_par    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  -- Sync meetups Toulouse Tech Hub : id Meetup = clé d'idempotence
  -- (UNIQUE global : NULLs multiples OK, ON CONFLICT (meetup_id) fonctionne).
  meetup_id      TEXT UNIQUE,
  -- Une édition « sessionize sans endpoint » (ou l'inverse) ferait lever le
  -- cron en silence : interdit par construction.
  CONSTRAINT conf_editions_source_endpoint_coherents
    CHECK ((source IS NULL) = (endpoint IS NULL))
);
-- Idempotence de moisson : index PARTIEL obligatoire — un UNIQUE inline avec
-- des NULLs ne matche jamais dans ON CONFLICT (NULLs jamais égaux en Postgres),
-- et les upserts de seed/meetups créeraient des doublons silencieux.
CREATE UNIQUE INDEX conf_editions_source_endpoint_key
  ON conference_editions (source, endpoint) WHERE endpoint IS NOT NULL;
-- Éditions annuelles uniques par conf ; les meetups (annee NULL) ne sont pas contraints ici.
CREATE UNIQUE INDEX conf_editions_conf_annee
  ON conference_editions (conference_id, annee) WHERE annee IS NOT NULL;
CREATE INDEX idx_conf_editions_conference ON conference_editions (conference_id);
CREATE INDEX idx_conf_editions_date_debut ON conference_editions (date_debut);
```

- **« Connu » vs « moissonné »** tombe naturellement : un événement connu a une
  date et un lieu ; il n'est **moissonné** que si `endpoint IS NOT NULL AND
  actif` (en pratique, des confs — pas les meetups).
- **Meetup = événement, asso = organisateur** : GDG Toulouse / AFUP sont des
  `conferences` de `type = 'asso'` ; un meetup est une `conference_edition`
  de `type = 'meetup'` rattachée à l'asso, avec sa date et son lieu. Les
  meetups toulousains sont **synchronisés** depuis le Toulouse Tech Hub
  (`events.json`, MIT — voir D) : trop nombreux pour un seed ou une saisie
  manuelle, mais la donnée existe déjà, on la prend. Une speakeuse peut
  référencer l'asso seule (« au GDG Toulouse ») ou un meetup daté précis.
- **Un talk pointe la référence** : `speaker_talks` gagne `edition_id`
  (nullable). Rempli quand une conf/édition connue est choisie (B) → la fiche
  peut dériver nom/ville/pays/année de l'édition ; NULL = saisie 100 % libre
  (rétrocompatible). C'est ce qui fait la **source unique** (pas 3 libellés
  pour une même conf).
- **Id Sessionize à la main** : assumé (cf. besoin). L'orga colle l'`endpoint`
  sur l'événement ; rien d'automatique.

### Migration (idempotente, `db/migrations/NNN_conferences.sql` + `schema.sql` + `sync-to-latest.sql`)

Phasée pour ne rien casser du moissonneur livré. (Hygiène : la nouvelle
migration utilise les **vrais** noms `speaker_talks` / `speaker_profile_id` —
le commentaire de `011` parlait à tort de `talks`/`profile_id`.)

Contrainte structurelle du repo : `db-schema-drift.test.ts` exige que
`schema.sql` et `sync-to-latest.sql` produisent des catalogues **identiques**
(colonnes, noms de contraintes, index) — mêmes noms exacts partout, et les
nouvelles tables créées **avant** `talk_suggestions` dans les deux fichiers
(sa FK les référencera).

1. Créer `conferences` + `conference_editions` (+ index, cf. modèle).
2. **Reprendre `cfp_events`** (le point délicat — plusieurs lecteurs livrés),
   dans un bloc `DO $$` **gardé par la cible de la FK** (le seul marqueur
   d'idempotence fiable : `sync-to-latest.sql` est rejoué sur des bases déjà
   migrées, et les ids SERIAL des deux tables se chevauchent — un re-remap
   corromprait la mémoire des refus) :
   ```sql
   IF (SELECT confrelid::regclass::text FROM pg_constraint
        WHERE conname = 'talk_suggestions_event_id_fkey') = 'cfp_events' THEN …
   ```
   - **Année** : posée sur l'édition **seulement si** le `nom` finit par une
     année (`\s(19|20)\d{2}$`), retirée du nom de conf ; sinon `annee = NULL`
     et le libellé reste l'ancien nom à l'identique (empêche « DevFest 2026
     Toulouse 2026 »). Garde **anti-collision** avant reprise : deux lignes
     `cfp_events` dérivant la même (conf, année) → `RAISE EXCEPTION`
     (réconciliation manuelle, style maison du sync).
   - **Remap par clé naturelle** `(source, endpoint)` — pas de table
     temporaire, rejouable : `DROP CONSTRAINT talk_suggestions_event_id_fkey`
     → `UPDATE … FROM cfp_events e JOIN conference_editions ce ON (source,
     endpoint)` → `ADD CONSTRAINT` (même nom, `ON DELETE RESTRICT`). L'ordre
     DROP → UPDATE → ADD est impératif (sinon violation de FK pendant le
     remap). `actif` copié explicitement (le défaut a changé : FALSE).
   - Conserver `cfp_events` (vide sur base neuve, dans les DEUX fichiers —
     drift-test) ; retirée par une migration ultérieure des deux fichiers.
3. `speaker_talks.edition_id` et `tremplin_editions.conference_edition_id`
   (nommé ainsi : `edition_id` désignerait l'édition de Tremplin — piège de
   relecture), **nullable**, FK `ON DELETE SET NULL`, index sur
   `speaker_talks (edition_id)`. Aucune réécriture rétroactive.
4. **Rebranchement code, même merge** : `getActiveCfpEvents()` réécrite en
   jointure SQL qui **recompose le libellé** (`c.nom || COALESCE(' ' ||
   e.annee, '')`, fallback ville/pays édition → conf) en préservant le contrat
   `CfpEvent` → `cfp-sync.ts`, `cfp-import.ts`, le cron et leurs tests ne
   changent **pas d'une ligne**. `acceptSuggestion()` : JOIN repointé sur
   `conference_editions` **et pose `edition_id = s.event_id` sur le talk
   créé** (sinon les talks moissonnés ne pointeraient pas la référence — la
   décision V1 vaut pour tous les flux). `refreshImportedTalk` : inchangé.
5. **Procédure de déploiement (lot 1)** : jouer la migration dans Neon **puis**
   déployer immédiatement, hors 07:00 UTC (cron) ; fenêtre résiduelle ~2 min où
   l'ancien code ne peut pas confirmer une suggestion — acceptable. À écrire
   dans l'en-tête de la migration et `docs/exploitation.md` (dont le runbook
   INSERT `cfp_events`, devenu faux, à réécrire dans le même merge).

## Les 3 consommateurs

### A — Moissonneur : UI orga (remplace le SQL à la main)

Aujourd'hui `cfp_events` se remplit **en SQL à la main** (commentaire en fin de
migration `011`). On expose une page orga `/admin/conferences` (garde
`requireOrgaId()`, liée depuis `/admin`, sur le modèle de `/admin/tremplins`) :

- lister les conférences / éditions de la référence (les **ajouts de la
  communauté** signalés par un badge, récents en tête, cf. ci-dessous) ;
- **ajouter/éditer** une conférence et ses éditions (choisir dans le catalogue
  amorcé, cf. D, pré-remplit nom/ville/pays/url) ;
- pour moissonner : coller l'`endpoint` Sessionize sur l'édition, **« Tester
  cet endpoint »**, puis l'**activer** (interrupteur `actif`) ;
- **pas de suppression** d'une édition moissonnée (contrainte `RESTRICT` des
  suggestions) : on désactive.

**« Tester cet endpoint »** — le garde-fou d'adoption. Coller un id d'endpoint
est le geste le plus casse-gueule du parcours (3 notions proches : `slug` de
conf, slug d'URL CFP, id d'endpoint d'embed) et le cron logue ses erreurs en
console, invisibles pour l'orga. Le bouton fait un fetch synchrone de
`…/api/v2/<ID>/view/All` (réutilise `fetchSessionizeEvent` : timeout 10 s +
garde de taille) et affiche « N sessions, M speakers trouvés » ou l'erreur
HTTP. Sans ce retour, l'UI ne remplace pas le SQL à la main, elle déplace
juste le point de silence. Durcissement : l'id est validé par **Zod
`/^[a-z0-9]{6,32}$/i`** en amont (la vraie défense — `encodeURIComponent` ne
serait qu'un filet), hôte `sessionize.com` codé en dur (pas de SSRF),
**rate-limit** par utilisatrice (`rate-limit.ts`), et on ne renvoie à l'UI que
`{sessions, speakers}` ou un code d'erreur stable — jamais le corps de la
réponse.

**Contribution d'une membre — sans validation orga** : depuis son espace
(« Ta conf n'y est pas ? Ajoute-la »), une speakeuse connectée ajoute une
conférence/édition, **y compris avec un id d'endpoint Sessionize**. L'ajout
est **actif directement** (`actif = TRUE`, `propose_par = son userId`) : pas
de goulot d'étranglement humain. Les garde-fous sont techniques :

- l'endpoint est **testé à la soumission** (même code que « Tester cet
  endpoint ») — s'il ne répond pas un JSON Sessionize valide, l'ajout est
  refusé avec une erreur claire ; on ne peut pas mettre un id cassé en base ;
- rate-limit (`src/lib/rate-limit.ts`) + validation Zod (longueurs, format) ;
- le risque de fond est borné par construction : un endpoint, même hostile,
  ne produit que des **suggestions** — rien n'est publié sans confirmation de
  chaque speakeuse, et le plafond par profil/événement existe déjà
  (`MAX_SUGGESTIONS_PAR_PROFIL_PAR_EVENEMENT`).

Les orga sont **informées, pas sollicitées** : la liste `/admin/conferences`
affiche un badge « ajoutée par la communauté » (`propose_par` non NULL), les
ajouts récents en tête. Le nom de la contributrice n'est visible que côté
admin (JOIN `users` serveur, jamais sérialisé vers un composant public).
Elles gardent la main a posteriori (désactiver un événement, corriger ses
métadonnées) — modération par exception, pas par défaut. Doublons gérés en
erreurs douces : endpoint déjà connu → « déjà référencée » (23505 attrapé,
pas une 500) ; même conf/année → rattacher à l'existante plutôt qu'échouer.

**Moisson à la demande — la boucle complète, sans attendre le cron.** Le
parcours cible d'une speakeuse qui arrive : (1) elle renseigne son
`sessionize_url` dans son profil ; (2) elle ajoute les conférences manquantes
(id d'endpoint, avec l'aide « où le trouver » : dans la page programme de la
conf qui embarque le widget, `sessionize.com/api/v2/<ID>/view/…`) ; (3) elle
clique **« Lancer le repérage »** → les talks trouvés apparaissent
immédiatement dans « Talks repérés pour toi », elle **confirme/écarte dans la
foulée**. Pas d'attente du cron du lendemain ni d'e-mail.

Mécanique : une Server Action `runHarvestForProfile` **scopée à SON profil**
(index de matching réduit à elle seule — on ne re-moissonne pas tout le monde
depuis une action utilisateur), qui réutilise la machinerie du cron
(`fetchSessionizeEvent`, `mapSessionizeEvent`, `matchSpeakerToProfile`,
`upsertSuggestion`, `refreshImportedTalk`) sur les éditions actives
**récentes** (même borne que l'auto-complétion, cf. B). Garde-fous :
rate-limit (ex. 2 lancements / 10 min), erreurs par événement non bloquantes
(modèle du cron), **pas d'e-mail** pour un run à la demande (elle est devant
son écran), `maxDuration` adapté. Le cron quotidien reste le filet de fond
pour toutes.

Server Actions (`src/app/admin/conferences/actions.ts` + une action côté
espace membre), conventions du projet (identité serveur, Zod
`src/lib/conference-form.ts`, SQL paramétré) : `upsertConference`,
`upsertEdition`, `setEditionActive`, `testEndpoint`, `addEditionAsMember`
(membre, actif direct après test). `source` verrouillée à `'sessionize'` — pas de choix dans l'UI —
tant que le cron ne gère que ça (`syncCfpEvents` lève sur source inconnue).

Le cron et le matching gardent leur logique, mais le rebranchement est **plus
que `getActiveCfpEvents()`** (cf. Migration) : lecture des éditions
`endpoint IS NOT NULL AND actif`, recomposition du libellé (`nom` + année), et
`acceptSuggestion()` repointé. `cfp-import` (client + matching) est inchangé.

### A bis — La conférence manquante n'arrête plus la saisie (migration 068)

> Signalé par Aurélie Vache le 15/08/2026 : « quand on veut ajouter une
> conférence qui n'existe pas, le lien renvoie vers la page des talks, pas pour
> ajouter une conférence ». Deux défauts empilés — le renvoi tombait au mauvais
> endroit (`proposeHref="/mon-espace/talks"`, aucune page `/conferences/proposer`
> n'a jamais existé), et **même bien branché il aurait fait perdre la saisie en
> cours** : partir proposer sa conférence ailleurs, revenir, tout retaper, puis
> attendre la validation pour retaper encore.

**Principe** : une speakeuse n'est jamais bloquée par l'état du répertoire. Elle
saisit, ça part aux orga, et **la validation met en ligne ce qu'elle avait
saisi** — pas un formulaire à re-remplir.

- **Un seul écran** : le sélecteur de conférence du formulaire d'occurrence
  gagne une dernière option, « Ma conférence manque dans la liste… », qui ouvre
  un champ « Nom de la conférence » **sur place**. Pas de lien sortant, pas de
  second CTA (règle d'or : une page = un rôle).
- **La saisie est enregistrée tout de suite**, avec date, lieu et liens. Elle
  pointe la proposition (`talk_occurrences.proposition_id`) au lieu du
  répertoire. La proposition reprend le contexte de la saisie (nom, année, ville,
  lien) : l'orga arbitre en connaissance de cause, et voit combien de talks
  attendent derrière chaque proposition.
- **Invariant de visibilité, une seule condition** :
  `proposition_id IS NOT NULL` ⇔ en attente ou écartée ⇒ **jamais publique**.
  Tenu à deux niveaux. En SQL applicatif, par `OCCURRENCE_PUBLIABLE`
  (`src/lib/occurrence-visibilite.ts`), importé par les lectures qui filtrent
  là-dessus : la fiche annuaire (`getPublicTalksByProfileId`) et le périmètre
  des scènes (`scenesVisiblesWhere` — agenda + fil). Le filtre est posé dans le
  **ON** du LEFT JOIN, pas le WHERE : un talk dont la seule conférence attend
  reste affiché comme sujet proposé, il perd juste cette ligne.
  En BASE, par un CHECK : `proposition_id IS NULL OR (conference_id IS NULL AND
  edition_id IS NULL)`. Les autres lectures publiques (`conference-speakers.ts`,
  pages d'une conférence) filtrent par `edition_id`, pas par `proposition_id` :
  elles sont sûres parce qu'une saisie en attente ne PEUT pas porter d'édition.
  Sans ce CHECK, elles ne l'étaient que par habitude du writer actuel.
- **À la validation**, `validateConferenceProposition` promeut la conférence,
  rattache les occurrences (libellé recomposé depuis le répertoire, lieu saisi
  prioritaire sur celui de la proposition) et **remet `proposition_id` à NULL** :
  la saisie passe en ligne telle quelle, rien d'autre à filtrer ensuite.
- **Un doublon (conf, année) n'est plus une impasse** : on rattache à l'édition
  existante au lieu d'échouer (l'édition curée par l'orga n'est jamais réécrite).
  Avant, le doublon aurait laissé les saisies en attente pour toujours.
- **Écarter ne détruit rien** : la proposition change de `statut` au lieu d'être
  supprimée (FK `RESTRICT`). La saisie reste dans l'espace de son autrice, badgée
  « Conférence écartée », et elle peut la re-soumettre corrigée ou choisir une
  conférence du répertoire.
- **Une seule porte** : `soumettreProposition` (`conference-propositions.ts`)
  est le point de passage des DEUX écrans qui déposent une proposition (le
  formulaire d'occurrence et « Ta conf n'y est pas ? Propose-la » du repérage).
  Elle porte le regroupement par **(conférence, année)** — une proposition
  promeut UNE édition datée, et toutes les saisies derrière elle en héritent, donc
  regrouper 2023 et 2024 les publierait sur la même édition — et le refus d'un
  nom déjà écarté. Rangées au niveau du call site, ces règles se seraient
  contournées en changeant d'écran.
- **Corriger sa saisie ne réécrit pas celle des autres** (correctif 2026-08-16).
  Le regroupement ci-dessus a un revers : plusieurs saisies tiennent la même
  ligne, et la validation les estampille **toutes** avec le nom et l'année que
  la proposition porte à cet instant. Corriger la sienne en place republiait
  donc les autres sous une édition que leur autrice n'avait jamais tapée — une
  correction de date, ou même une faute de frappe sur le nom, suffisait.
  `updateConferenceProposition` ne corrige donc en place que ce que la saisie
  appelante est **seule** à tenir : `NOT EXISTS` dans le `WHERE` du `UPDATE`
  plutôt qu'un `if` au-dessus, ce qui ramène la fenêtre de course d'un
  aller-retour applicatif à une instruction. Elle ne se ferme pas pour autant —
  en READ COMMITTED, une saisie insérée en parallèle et validée juste après
  échappe au comptage. Sans effet en pratique (même personne des deux côtés) ;
  le jour où ça compterait, il faudrait verrouiller la proposition, pas
  déplacer la condition.
  Sinon on repart sur `soumettreProposition`, par le chemin qui servait déjà
  aux propositions arbitrées. Ce qui suit dépend de ce qui a changé :
  - **le nom ou l'année bouge** → la saisie **se détache** sur une proposition
    à elle (rejointe si elle existe, ouverte sinon, et le quota se paie dans ce
    second cas — c'est bien une ligne de plus pour l'orga) ;
  - **seules la ville ou l'URL changent** → la clé est inchangée, donc c'est la
    **même ligne** qui est retrouvée et la saisie y reste. Rien ne se détache,
    aucun quota n'est consommé, et la correction vaut pour la saisie sans
    remonter à la ligne d'arbitrage. Le nom et l'année sont ce que l'orga
    arbitre ; le reste est du contexte, et on ne réécrit pas la ligne sur
    laquelle le talk d'une autre repose.

  Effet de bord assumé : quand une saisie seule-tenante rejoint une **autre**
  proposition, celle qu'elle quitte reste en file avec zéro talk derrière.
  L'orga voit une ligne à arbitrer pour rien — moins nocif que le doublon
  d'avant, mais un ramassage des propositions à zéro occurrence reste à écrire.
- **Corriger en place est une PORTE, et porte donc les mêmes arbitrages**
  (même correctif). `soumettreProposition` n'est « la » porte que des dépôts ;
  la correction d'une proposition en attente en est une seconde, et elle ne
  consultait `dejaEcartee` qu'**après** avoir écrit. Renommer sa saisie vers un
  nom que l'équipe avait écarté le remettait donc en file — le contournement
  que le point « Une seule porte » ferme pour l'écran « Propose-la », resté
  ouvert sur celui-ci. L'état de la file (`findPropositionByNom`) se lit
  désormais **avant** toute écriture, sur tous les chemins : un nom écarté est
  refusé, et un (nom, année) que porte déjà une AUTRE de ses propositions est
  rejoint plutôt que dupliqué. Sa propre proposition ne compte pas comme un
  doublon : c'est le cas « je corrige la ville de ma saisie ».
- **Portée du refus** : « déjà écartée » se juge sur les propositions de **cette
  personne** (`propose_par`), toutes années confondues. Une orga qui écarte un
  nom ne le bloque donc pas pour les autres membres : un refus vaut arbitrage
  d'une demande, pas mise à l'index d'un nom pour toute la communauté.
- **Garde-fous** : identité par la session, nom validé par le MÊME `nomConfField`
  que le formulaire orga (importé, pas recopié), rate-limit partagé entre les
  deux portes (5/h, et une réutilisation ne le consomme pas), talk vérifié avant
  d'ouvrir une proposition, et la proposition à corriger relue depuis la **base**
  (ownership), jamais depuis un id soumis.
- **Validation atomique** : promotion, rattachement des saisies et passage en
  `validee` dans UNE transaction. Un conflit qu'on ne sait pas résoudre
  (endpoint déjà pris ailleurs) annule tout et laisse la proposition dans la
  file — annoncer « validée » sans édition l'aurait sortie de la file en
  laissant ses saisies invisibles pour toujours.

Corollaire assumé : le catalogue d'amorçage a été élargi dans le même lot
(≈ 110 conférences, FR récurrentes + internationales fréquentées depuis la
France). Débloquer la saisie était nécessaire ; avoir un répertoire si mince que
chaque conférence passait par une demande d'ajout l'était tout autant.

> **Suite, 2026-08-21 — l'arbitrage côté orga** :
> `docs/conception-arbitrage-conferences.md`. Ce qui précède décrit ce que la
> speakeuse vit ; il manquait l'autre bout. La file n'entrait dans aucune tâche
> (« À faire » disait « Tout roule » avec 113 propositions en attente), l'orga
> n'avait aucun écran où LIRE la saisie qu'elle arbitre — l'invariant de
> visibilité ci-dessus la tient hors du public, et aucune page orga ne montre
> les talks d'une membre —, rien ne signalait qu'une proposition doublait une
> marque du répertoire (le rapprochement de l'import se fait au slug exact :
> « DevoxxFR » ne rejoint pas « Devoxx France »), et corriger avant de valider
> était impossible alors que le message de conflit d'endpoint le demandait.

### A ter — Import en masse (JSON / CSV) : le même geste, en lot

`/mon-espace/talks/importer` (2026-08) fait en masse ce que le formulaire
d'occurrence fait à l'unité, avec les MÊMES briques : `addTalk`/`addOccurrence`
(ownership dans le SQL) et `soumettreProposition` pour les conférences hors
répertoire — l'import n'ouvre aucun chemin de publication que la saisie manuelle
n'a pas. Trois temps sur un écran : analyser (parseur pur
`src/lib/import-talks.ts`, JSON dont export Notist + CSV), vérifier (le plan —
groupage par titre, rapprochement au répertoire, dédoublonnage contre la fiche —
est LA vérité partagée entre prévisualisation et écriture), confirmer.
Détail des garanties : `docs/faisabilite-import-talks.md` § G.

### B — Ajout de talk manuel : conférences connues proposées

`TalkForm` a déjà un `<datalist>` pour le champ « Conférence », alimenté par
`getTalkSuggestions()` (= `DISTINCT` des talks passés). On l'enrichit :

1. `getTalkSuggestions()` unionne la **référence** avec les talks passés, et
   expose les événements datés (éditions **et meetups**) avec leur libellé :

   ```ts
   export interface TalkSuggestions {
     conferences: string[];   // datalist : union référence + talks passés (dédupliqué)
     villes: string[];
     pays: string[];
     known: {
       editionId: number;     // → speaker_talks.edition_id à l'enregistrement
       libelle: string;       // « DevFest Toulouse 2026 », « GDG Toulouse — 12 mars 2026 »
       ville: string | null;  // fallback : ville de l'édition, sinon celle de la conf
       pays: string | null;
       url: string | null;
     }[];
   }
   ```

   Les meetups apparaissent donc **choisissables avec leur date** — la
   granularité modélisée est réellement consommée. Règle de fallback ville :
   édition → conférence (conf itinérante : la ville de l'édition gagne).
   **Borne de volumétrie** (les meetups s'accumulent sans fin, ~200-400/an) :
   `date_debut >= now() - 18 mois OR date_debut IS NULL`, tri décroissant,
   `LIMIT 500` — sinon le payload RSC du formulaire enfle indéfiniment. Le
   `libelle` est construit en TS (`Intl.DateTimeFormat`, pas de `to_char`
   fragile) depuis des champs structurés.

2. `TalkForm` : choisir une entrée connue **pré-remplit les champs vides**
   (ville, pays, lienConf) sans réécrire ce que la speakeuse a déjà tapé, et
   pose `edition_id` (champ caché) → le talk **pointe la référence** (décision
   V1). Si elle modifie ensuite le nom à la main, `edition_id` est effacé
   (le lien ne doit jamais mentir). Le champ **reste un `<input>` libre** →
   « qu'elles saisissent les autres » marche sans état « autre… ».

   ⚠️ Point technique à ne pas sous-estimer : `TalkForm` utilise des champs
   **non contrôlés** (`defaultValue`, dont `lienConf` dans `LinkField`) et un
   `<datalist>` ne signale pas « une entrée a été choisie » — comparer la
   saisie aux `known` sur le **libellé exact** (celui que le serveur
   revérifiera), `editionId` dans un `useState` + `<input type="hidden">`, et
   ne passer en contrôlé que les champs touchés par le pré-remplissage
   (ville, pays, lienConf). Cas à tester : frappe partielle, collage,
   correction après choix (bug classique « ça a écrasé ce que j'avais tapé »).

3. **Revalidation serveur** (champ caché falsifiable, et un bug JS suffirait) :
   si `editionId` est soumis, le serveur recharge l'édition ; inexistante →
   `edition_id = NULL` (pas de 500 sur violation de FK) ; libellé recomposé ≠
   champ `conference` soumis → **`edition_id = NULL`, le texte libre gagne**
   (le lien ne doit jamais mentir — pas d'erreur bloquante, ça couvre aussi
   « choisi puis renommé » si l'effacement client a raté). `updateTalkAction`
   écrit `edition_id` dans le même UPDATE que le reste. Corollaire : le
   pré-remplissage client doit écrire le **libellé exact** de la référence,
   sinon la revalidation annulerait systématiquement le lien.

### C — Tremplins : pointer une édition (suite, pas bloquant)

`tremplin_editions` gagne `edition_id` nullable ; l'admin Tremplin peut relier
la « conférence partenaire » à la référence (ex. DevFest Toulouse 2026) au lieu
de re-saisir `conf_nom/conf_date/conf_lien`. À faire **après** A/B, sans
migration de données (les éditions existantes gardent leurs champs texte).

## D — Amorçage du catalogue (France d'abord)

But : que ni les speakeuses ni l'orga ne partent d'une page blanche. **Décision
KISS** : extraire **une fois** les données, les commiter comme **seed** de la
référence (script de seed idempotent, ou `src/data/conferences-seed.ts` importé
par un script d'insertion) — **pas d'intégration live** (sources anti-bot,
licences, politique réseau). On rafraîchit par commit quand utile.

### Sources retenues (toutes vérifiées)

| Périmètre | Source | Note / licence |
|---|---|---|
| **Conférences tech FR** | **developers.events** (`all-events.json`, open source `scraly/…`) | nom, ville, pays, site, souvent lien CFP Sessionize. **CC BY-NC 4.0** → créditer + non commercial (OK pour TSH assoc.). Anti-bot → extraction manuelle, pas de fetch serveur. |
| **Conférences product / UX FR** | Flupa UX Days, La Product Conf Paris, Future Product Days, UX Days… (souvent Sessionize) | à lister à la main (petit volume, ~10). |
| **Assos toulousaines** (amorçage) + **leurs meetups** (sync continue) | **Toulouse Tech Hub** (`GDGToulouse/toulouse-tech-hub`, ~28 communautés, **licence MIT**) | **même famille que TSH (GDG)**, données faites pour être consommées : `_groups/` (assos) + `events.json`/`.ics`/atom (meetups, sync Meetup plusieurs fois par jour). Assos = seed unique (`type='asso'`) ; **meetups = sync automatique** (voir ci-dessous). |
| **Talks de speakeuses connues** | **Notist** (`noti.st/aurelievache`…) + **Sessionize** (Montaine Marteau, Rachel Dubois) + **`montaine-consulting.fr`** (page « Conférences et Podcasts ») | Notist est **par speaker et public**, Sessionize event-centric. Le site de Montaine liste ses talks avec conf + date + ville → **lecture manuelle pour le seed** : NCL Days (en ligne), Devoxx France (Paris), DevFest Nantes, Yeeso (Toulouse), Agile Pays Basque (Bidart), BDX I/O (Bordeaux), Volcamp (Clermont-Ferrand), DevLille (Lille), Cloud Toulouse, MiXiT (Lyon), Tech.Rocks (Paris), FrenchProduit SudOuest (Toulouse), Agile Tour Toulouse, Meetup IA Innovateur (asso) — et Tech Speak'Her elle-même (asso, ses meetups accueillent des talks). Confirme aussi le modèle : un même talk donné à N événements = N fiches talks, chacune pointant son édition. |

### Sync des meetups toulousains (la seule intégration live, et elle est saine)

Contrairement à developers.events (CC BY-NC + anti-bot → extraction manuelle),
le Toulouse Tech Hub est **MIT** et expose ses événements en flux
machine-readable (`events.json`) précisément pour la réutilisation. Trop de
meetups chaque mois pour un seed ou une saisie manuelle → **sync
automatique** :

- une étape du cron quotidien existant (`sync-talks`) lit
  `toulouse-tech-hub.fr/events.json` et **upserte** les meetups en
  `conference_editions type='meetup'` (nom, date, lieu, url), rattachés à leur
  asso (`_groups/` seedé ; matching par slug stable si le flux en expose un,
  sinon par nom — un groupe renommé crée alors une nouvelle asso, doublon
  assumé, fusion manuelle orga) ;
- idempotence par **`meetup_id`** avec `ON CONFLICT DO UPDATE` (nom, date,
  lieu, ville, url) : un meetup **déplacé ou renommé** est corrigé au run
  suivant ; un meetup **disparu du flux** (annulé, purgé) **reste en base** —
  jamais de suppression : des talks pointent `edition_id` ;
- le flux est un artefact Jekyll, **pas une API contractuelle** : validation
  Zod tolérante entrée par entrée (on saute la ligne bancale, on ne fait
  jamais échouer le lot — modèle `mapSessionizeEvent`), titres tronqués à 160
  (`optionalText`), URLs filtrées `isHttpUrl`, timeout + garde de taille
  (patterns `cfp-import.ts`). **« 0 meetup parsé » compte comme une erreur**
  du run (format qui a changé → visible, pas silencieux) ;
- aucune donnée personnelle dans ce flux (événements publics) ; politesse :
  1 fetch/jour, tolérance aux pannes (run suivant) ;
- un groupe inconnu du seed est créé `type='asso'` à la volée (le Tech Hub est
  la source de vérité des communautés toulousaines) ;
- `SyncResult` gagne `meetups: number` (les tests du cron à `toEqual` exact
  seront adaptés dans le même lot).

### « Référencer leurs talks simplement » (Montaine, Rachel, Aurélie)

Deux plateformes, deux natures :

- **Sessionize** (Montaine, Rachel) est *event-centric* : pas d'API par
  speaker. Le levier existe déjà — champ `sessionize_url` du profil (migration
  `010`) + matching du moissonneur **par ce lien** : pour chaque **conférence
  du catalogue** où elles parlent, le talk est rattaché et proposé en un clic.
  Couverture = contenu du catalogue.
- **Notist** (Aurélie Vache : `noti.st/aurelievache`) est **par speaker et
  public** : la page liste ses talks **avec l'événement, la date et la ville**.
  C'est ce qui manquait à Sessionize. On l'exploite **sans crawl** (Notist
  renvoie 403 aux non-navigateurs, comme Sessionize) par deux voies saines :
  1. **Champ profil `notist_url`** (sur le modèle de `sessionize_url`) →
     lien « Aussi sur Notist » sur la fiche + `sameAs` SEO. Immédiat, zéro
     dépendance : la fiche pointe le portfolio public complet.
  2. **Amorçage du catalogue** : lecture *manuelle, une fois* des pages Notist
     des speakeuses connues → on en tire les **conférences/éditions** (Sunny
     Tech, Volcamp/Clermont-Ferrand…) pour peupler la référence.
  3. *(Plus tard, optionnel)* **import consenti** : Notist permet à la
     propriétaire d'**exporter son JSON** ; elle le fournit, on importe son
     historique en brouillon. Consentement propre, données structurées — plus
     net que le collage Sessionize (scénario G de la faisabilité).

**Limite honnête** : rien de tout ça n'aspire un historique par simple lien
(anti-bot). Le lien profil (Notist/Sessionize) sert le CV complet ; le
catalogue + le moissonneur servent l'agenda ; l'import consenti (Notist JSON)
comble le reste si besoin.

### Attribution (licences) — côté produit, pas seulement dans le code

- **developers.events (CC BY-NC 4.0)** : l'attribution doit être **visible des
  utilisateurs**, pas seulement en commentaire de seed. Reco : une ligne
  « Sources du catalogue » sur `/admin/conferences` + mention dans la page
  À propos/crédits. Le « NC » est tenu par le statut associatif de TSH
  (loi 1901) — à réévaluer si le modèle évoluait.
- **Toulouse Tech Hub (MIT)** : attribution non exigée, créditée par courtoisie
  au même endroit (famille GDG).

## Ce qu'on ne fait PAS (limites KISS)

- Pas d'**intégration live** de developers.events (extraction statique
  commitée : CC BY-NC + anti-bot). **Exception assumée** : la sync des meetups
  Toulouse Tech Hub (MIT, flux prévu pour ça).
- Pas de **scraping** de fiches Sessionize/sites perso (403 anti-bot confirmé) :
  on passe par les données ouvertes (developers.events, Toulouse Tech Hub) et
  par le `sessionize_url` déclaré au profil.
- Pas d'**import par speaker** (impossible côté Sessionize) : couverture =
  contenu du catalogue.
- Pas de **rapprochement automatique** d'un talk saisi à la main et du même
  talk moissonné (doublon possible sur une fiche) : assumé en V1, `edition_id`
  fournit la future clé de rapprochement (même édition + titre proche).
- Pas de **suppression** d'édition moissonnée (RESTRICT) : désactivation.
- Pas de **Conference Hall** dans l'UI orga tant que le cron ne le gère pas
  (`source` verrouillée, pas de choix affiché).
- **Tremplins (C)** : rebranchement en second, sans migration de données.

## Tests (TDD, avant le code)

- **Migration** : reprise `cfp_events` → `conference_editions` idempotente et
  re-jouable ; **remap 1-1 de `talk_suggestions.event_id`** (une suggestion
  refusée reste refusée et n'est jamais re-suggérée après migration) ; FK
  `RESTRICT` recréée ; unicité `(profile_id, event_id, external_id)` intacte.
- **Moissonneur rebranché** : `getActiveCfpEvents()` lit les éditions
  `endpoint IS NOT NULL AND actif` ; **libellé recomposé** `nom [+ année]`
  identique à l'existant (non-régression sur `speaker_talks.conference`) ;
  `acceptSuggestion()` lit `source` depuis `conference_editions`.
- **UI orga (A)** : refus non-orga ; Zod (nom/slug/endpoint sans espace) ;
  `source` verrouillée `sessionize` ; upsert idempotent ;
  `setEditionActive(false)` retire du lot ; `testEndpoint` renvoie le compte
  sessions/speakers ou l'erreur HTTP (mocké).
- **Contribution membre** : `addEditionAsMember` requiert une session ; crée
  `actif=TRUE` + `propose_par` **seulement si** le test d'endpoint passe
  (endpoint invalide → erreur claire, rien en base) ; rate-limité ; doublon
  endpoint → erreur douce « déjà référencée » ; l'ajout apparaît badgé
  « communauté » côté orga.
- **Moisson à la demande** : `runHarvestForProfile` ne matche QUE le profil de
  la session (une autre speakeuse ne reçoit rien du run) ; rate-limité ;
  n'envoie pas d'e-mail ; un événement en erreur n'interrompt pas le run ;
  les suggestions créées sont visibles immédiatement.
- **Reprise année** : `nom` sans suffixe année → `annee NULL` et libellé
  inchangé (jamais « DevFest 2026 Toulouse 2026 ») ; garde anti-collision
  (deux endpoints → même conf/année) lève une exception explicite ;
  `sync-to-latest.sql` rejoué sur base déjà migrée = no-op (garde par cible de
  FK) ; drift-test `schema.sql` ↔ `sync-to-latest.sql` vert.
- **Talk (B)** : `getTalkSuggestions()` inclut la référence (éditions **et
  meetups**, libellés datés) ; choisir une entrée connue pré-remplit les
  champs **vides** sans écraser et pose `edition_id` ; modifier le nom à la
  main efface `edition_id` ; saisie libre inchangée (frappe partielle,
  collage, correction après choix).
- **Sync meetups** : upsert idempotent par `meetup_id` (re-sync sans doublon) ;
  groupe inconnu créé `type='asso'` ; flux en panne = run suivant, pas de
  crash ; aucun champ personnel stocké.
- **Seed (D)** : catalogue non vide, `pays` renseigné, `type` valide, crédit
  CC BY-NC présent (en-tête de seed **et** mention produit).

## Effort indicatif

| Lot | Contenu | Ordre de grandeur |
|---|---|---|
| Réf. + migration | 2 tables, reprise `cfp_events` + remap `event_id`, rebranchement (`getActiveCfpEvents`, libellé, `acceptSuggestion`), tests | ~2 j |
| D — seed + sync | seed confs FR (developers.events, product/UX) + assos Tech Hub ; **sync meetups** (cron, `meetup_id`) ; attributions | ~1,5 j |
| A — UI orga + contribution | page + actions Zod, « Tester l'endpoint », activation, `addEditionAsMember` + **moisson à la demande** (`runHarvestForProfile`), tests | ~2 à 2,5 j |
| B — talk manuel | `getTalkSuggestions()` (éditions + meetups, borné) + pré-remplissage `TalkForm` + `edition_id` (+ revalidation), tests | ~1 j |
| C — Tremplins | `edition_id` sur `tremplin_editions` + UI admin (suite) | ~0,5 à 1 j |

## Ordre de mise en œuvre

**Réf. + migration** (fonde tout, sans casser le moissonneur) → **D** (le
catalogue amorce l'UI et l'auto-complétion) → **A** (l'orga active la moisson
d'une édition) → **B** (la speakeuse profite des confs connues) → **C**
(Tremplins), en dernier. Chaque lot passe en vert (test + type-check + lint)
avant le suivant.

## Sources

- developers.events / `scraly/developers-conferences-agenda` (données confs, CC BY-NC 4.0)
- `GDGToulouse/toulouse-tech-hub` (communautés toulousaines) · `toulouse-tech-hub.fr`
- **Notist** (`noti.st/aurelievache`) : portfolio public par speaker (talks +
  événement + date + ville), export JSON par la propriétaire, oEmbed
- Sessionize : fiches speaker (Montaine Marteau, Rachel Dubois), CFP Flupa UX Days / La Product Conf
- dev.events (annuaire, sans API publique — écarté comme source de données)
