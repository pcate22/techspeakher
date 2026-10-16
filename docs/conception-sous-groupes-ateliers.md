# Ateliers : lieu, fenêtre de dates et sous-groupes — conception

> Fait suite à `docs/conception-phases-tremplin.md`. Le coaching DevFest 2026
> (phase 3) a montré que le modèle d'atelier ne suffit pas : il manque **où**
> (lieu physique en plus du lien visio), **quand** (une fenêtre de dates, pas
> une date unique) et **le suivi** des activités faites en autonomie (revue
> croisée en duo, point individuel avec la coach) — qu'on ne veut PAS éclater
> en une session par personne, mais suivre par **sous-groupe** (« si » et
> « quand »), les participantes pouvant se retrouver et poser la date.
>
> Remplace la piste « numéro de binôme » (colonne `groupe`) : un binôme n'est
> qu'un sous-groupe de deux ; le sous-groupe généralise (duo, trio, ou une
> participante + sa coach) et porte ce qu'il faut pour se coordonner.

## 1. Les trois manques (mots de l'orga)

1. **Où** : « on a aussi besoin de lieu physique et/ou lien de connexion pour
   les ateliers ». Aujourd'hui un atelier n'a que `lien_visio`.
2. **Quand** : « on doit donner un intervalle de dates entre deux ateliers pour
   les échanges entre duo ». Aujourd'hui une seule `date`.
3. **Suivi** : « on va pas créer plusieurs sessions de 1-1 mais savoir quand et
   si elles l'ont fait » ; « binôme, ou plutôt sous-groupe autonome (sans coach)
   ou avec coach ; les participantes doivent savoir comment se retrouver et
   mettre la date ».

## 2. Modèle

### 2.1 Atelier (`tremplin_ateliers`) — champs ajoutés

| Champ | Type | Rôle |
| --- | --- | --- |
| `lieu` | TEXT NULL | Lieu physique. Avec `lien_visio` : présentiel / visio / **hybride** (les deux). |
| `date_fin` | DATE NULL | Fin de **fenêtre**. `date` devient le **début** ; `date_fin` NULL ⇒ date unique (comportement actuel). CHECK `date_fin >= date`. |
| `nature` | TEXT NOT NULL `'collectif'` | `collectif` \| `sous_groupes`. Pilote le **suivi** et l'affichage. |

`nature` :
- **`collectif`** : un rendez-vous partagé (kickoff, répétitions, débrief, atelier
  visio) — on pointe la **présence** (existant, inchangé).
- **`sous_groupes`** : les participantes sont réparties en **sous-groupes**
  autonomes — on suit la **réalisation** par sous-groupe (fait + date).

`lieu`, `lien_visio` et la fenêtre (`date`/`date_fin`) sont **orthogonaux** à la
nature (un `collectif` peut avoir une fenêtre — ex. « slides » à caler dans une
semaine ; un `sous_groupes` peut avoir un lieu).

### 2.2 Sous-groupe (`tremplin_atelier_sous_groupes`) — table nouvelle

| Colonne | Rôle |
| --- | --- |
| `id`, `atelier_id` (FK, CASCADE) | Rattachement à l'atelier. |
| `libelle` TEXT NULL | **Mort depuis la migration 052.** On demandait un nom à la création (« Binôme 1 »…) : l'écran affichait donc des étiquettes qui n'apprenaient rien, et un nom saisi pouvait finir en désaccord avec son contenu. Le sous-groupe se **DÉSIGNE** désormais par qui est dedans, dérivé (`src/lib/sous-groupe-libelle.ts`). La colonne survit pour la bascule ; sa suppression est tracée en dette. |
| `coach_user_id` INTEGER NULL (FK users) | **MIROIR depuis la migration 052**, tenu par le code (la plus petite `user_id` de la table de liaison). Ne pas s'en servir comme source : les coachs vivent dans `tremplin_sous_groupe_coachs`, et il peut y en avoir **plusieurs**. Suppression tracée en dette. |
| `lien_visio` TEXT NULL | « Comment se retrouver » : le lien de réunion propre au sous-groupe. |
| `fait_le` DATE NULL | Date de **réalisation**, partagée par le sous-groupe. **NULL = pas encore fait** (le « si »). |

### 2.2 bis Coachs d'un sous-groupe (`tremplin_sous_groupe_coachs`) — migration 052

Retour orga : « éventuellement **une ou plusieurs** coachs dedans ». Une colonne
unique ne pouvait pas le dire.

| Colonne | Rôle |
| --- | --- |
| `sous_groupe_id`, `user_id` (PK) | La coach et le sous-groupe qu'elle coache. |
| `atelier_id` | Dénormalisée, mais elle ne peut pas mentir (FK composite vers `(id, atelier_id)` du sous-groupe). Elle porte l'**invariant**. |

**INVARIANT tenu en base** : les coachs d'un sous-groupe sont un sous-ensemble de
celles de son **atelier** — seconde FK composite vers
`tremplin_atelier_coachs (atelier_id, user_id)`, en `ON DELETE CASCADE`. Donc :

- un compte qui n'est pas coach de l'atelier est refusé par la base, pas
  seulement par l'écran (id forgé compris) ;
- retirer une coach de l'atelier la retire de ses sous-groupes, sans code
  applicatif à tenir en phase ;
- l'écran, qui ne coche que les coachs de l'atelier, ne peut donc pas afficher
  une liste incomplète — ni effacer en silence une coach qu'il n'aurait pas
  montrée.

**Aucune coach = « Autonome »**, un état NORMAL (revue croisée entre speakeuses),
jamais un manque : pas d'option « Aucune » à choisir, c'est le défaut.

### 2.3 Appartenance (`tremplin_atelier_membres`) — champ ajouté

| Colonne | Rôle |
| --- | --- |
| `sous_groupe_id` INTEGER NULL (FK sous_groupes, ON DELETE SET NULL) | Le sous-groupe de la participante **dans cet atelier**. Une participante ↦ au plus un sous-groupe par atelier. Supprimer un sous-groupe délie ses membres (ils restent inscrits à l'atelier). |

Le suivi « réalisation » est donc porté par le **sous-groupe** (`fait_le`), pas
par la participante : l'échange est unique pour le duo/trio. La présence
(`presence`, existant) reste le suivi des ateliers `collectif`.

### 2.4 Comment ça couvre les cas

- **Revue croisée (duo autonome)** : `nature=sous_groupes`, sous-groupes de 2,
  aucune coach, fenêtre de dates ; chaque duo pose son `fait_le`.
- **Point individuel avec la coach** : `nature=sous_groupes`, sous-groupes d'**une**
  participante, une ligne dans `tremplin_sous_groupe_coachs` ; fenêtre de dates.
- **Duo suivi par deux coachs** : plusieurs lignes de liaison sur le même
  sous-groupe (ce que l'ancien modèle interdisait).
- **Trio autonome** : sous-groupe de 3.
- **Collectif présentiel / visio / hybride** : `nature=collectif`, `lieu` et/ou
  `lien_visio`, présence.

## 3. Côté participante (espace) — self-service

Pour un atelier `sous_groupes` où elle figure, la participante voit **son**
sous-groupe : les autres membres (noms — **jamais** l'e-mail), ses coachs s'il y
en a, le lien « comment se retrouver », la fenêtre de dates. Elle peut
**renseigner la date de réalisation** (`fait_le`) de son sous-groupe (« fait
le … »).

**Autorisation** : l'action participante n'agit QUE si le compte connecté est
membre du sous-groupe visé (vérifié en SQL, jamais depuis le client) — une
participante ne touche pas le sous-groupe d'une autre. L'orga garde la main
(création/affectation/coach/lien/date).

## 4. Public / interne

Interne : sous-groupes, coachs, liens et `fait_le` ne sont **pas** publics. Le
DTO public d'atelier reste `titre / date (fenêtre) / lieu ou visio / description`
— aucun sous-groupe ni nom exposé. Aucune donnée personnelle en git.

## 4 bis. La COUVERTURE : « tout le monde a-t-il un sous-groupe ? » (01/08)

Retour d'exploitation après la mise en prod du lot 3. Le modèle savait dire ce
que chaque sous-groupe contient ; il ne savait pas dire **qui n'est rangée
nulle part** — la seule question qui compte quand on répartit (mots de l'orga :
« s'assurer que tout le monde a un sous-groupe dans un ensemble donné »). Deux
conséquences concrètes :

- la répartition d'un atelier ne se voyait **nulle part** : ni sur la liste
  des ateliers, ni sur la fiche, et il fallait ouvrir chaque sous-groupe un par
  un pour reconstituer l'ensemble de tête ;
- faute de cette vue, un sous-groupe a fini par être créé comme un **atelier**
  de plus.

**L'ensemble à couvrir, c'est l'AUDIENCE de l'atelier** — pas une seconde
définition. Le lot « Qui voit cet atelier ? » (#257) a fait de l'audience un
choix unique et exclusif (`selection` / `phase` / `toutes`), résolu par
`getCohorteAtelier`. La couverture s'y branche : « qui est concerné » se répond
une fois, et sert à la fois la visibilité, les présences à pointer et la
répartition. `src/lib/atelier-sous-groupes.ts` ne fait donc plus qu'une chose —
confronter cette cohorte à ce qui est rangé.

Une inscription rangée mais SORTIE de la cohorte (audience resserrée, sortie de
phase) ne compte pas comme couverte : sinon « 4 sur 4 » masquerait un manque.

**Où ça se lit** — une seule dérivation, trois écrans qui ne se contredisent pas :

1. **Liste des ateliers** : le reste à ranger entre dans le QUI (« 2 participantes
   à ranger »), en toutes lettres. C'est là qu'on cherchait sans trouver. Une
   requête pour toute la page (`getTaillesCohortesByEdition`), tenue par un test
   d'intégration contre `getCohorteAtelier` — deux SQL, une seule vérité.
2. **Fiche atelier** : une rangée « Sous-groupes » à part de « Participantes »
   — *qui participe* et *comment c'est réparti* sont deux fonctions, donc deux
   pages (hub-and-spoke). Son sous-titre dit le manque, pas un simple compte.
3. **Page « Sous-groupes »** (nouvelle) : la couverture d'abord (« 8 rangées sur
   10 · 2 à ranger », sur un ensemble **nommé**), puis les personnes **sans
   sous-groupe**, puis les sous-groupes en lignes vers leur page dédiée.

Comme partout, le manque se **dit** avant de se colorer (RGAA 3.1), et ne
s'alarme qu'une fois l'atelier daté (règle 1 de `atelier-etat.ts`).

## 4 ter. Supprimer un atelier (01/08)

Rien ne permettait de supprimer un atelier : une séance annulée, ou un doublon
créé par erreur, restait dans l'agenda. Page dédiée `…/ateliers/[atelier]/retrait`
(le geste est rare et destructif : il ne vit pas au milieu des réglages).

Palier selon l'effet (`principes-conception-ui.md` §10) : la cascade emporte les
participantes et leurs présences, les sous-groupes, les coachs reliés et les
supports — donc des données d'autres personnes → **palier 3** (titre retapé,
revérifié serveur). Un atelier **vide** n'emporte rien → palier 2. Les
inscriptions, elles, ne bougent pas : on retire une séance, pas des personnes.

> ⚠️ **Cause racine des 12 doublons de prod** — elle n'était pas dans l'UI. Le
> seed 046 de `db/sync-to-latest.sql` se garde par TITRE, et le bloc 050 renomme
> ces mêmes titres (« (1) » → « (séance 1) »). Le renommage passant APRÈS le
> seed, chaque déploiement réinsérait les quatre séances qu'il ne reconnaissait
> plus : supprimer à la main n'aurait pas suffi, les lignes seraient revenues.
> Le renommage passe désormais EN TÊTE, et le seed porte les titres d'arrivée.
> Le seed gagne au passage une garde « **amorçage seulement** » : il ne
> s'exécute que sur une édition qui ne porte encore aucun atelier de la phase —
> sinon une séance supprimée exprès (le cas d'usage n° 1 ci-dessus) reviendrait
> au déploiement suivant, et la suppression ne tiendrait pas ses promesses.
> `seed-ateliers-idempotent.test.ts` tient les trois invariants.

## 5. Lots (TDD — rien ne merge en rouge)

1. **Migration + modèle** : colonnes atelier (`lieu`, `date_fin`, `nature`),
   table `tremplin_atelier_sous_groupes`, `tremplin_atelier_membres.sous_groupe_id` ;
   lib (lecture enrichie + CRUD sous-groupes, affectation, coach, lien, `fait_le`).
   Tests d'intégration (PGlite/pg-mem) + anti-drift. **← ce lot.**
2. **UI orga** : fiche atelier — sélecteur `nature`, `lieu`, fenêtre ; gestion des
   sous-groupes (créer, nommer, affecter les membres, coach, lien) et suivi
   « fait le … ». Adapte « Participantes et présences » selon la nature. Tests + RGAA.
3. **Espace participante** : voir mon sous-groupe (membres, coach, lien, fenêtre)
   et poser la date de réalisation. Action participante scopée. Tests + revue de
   sécurité (nouvelle surface d'écriture participante).
4. **Couverture + suppression** (cf. §4 bis et §4 ter) : l'ensemble à couvrir et
   le reste à ranger (fonctions pures partagées liste/fiche/répartition), la page
   « Sous-groupes », la suppression d'un atelier, et le correctif d'idempotence
   du seed qui recréait les doublons à chaque déploiement.

## 6. Hors périmètre

- Tirage automatique des sous-groupes (répartition assistée) — plus tard. La
  couverture (§4 bis) en est le préalable : elle dit qui reste à placer.
- Notifications e-mail « ton sous-groupe / ta fenêtre » — plus tard.
- Rien de public : les sous-groupes restent une organisation interne.

## 7. Alternative KISS étudiée et écartée (arbitrage orga, 2026-07-30)

Une variante minimale a été analysée : pas de table de sous-groupes, mais une
étiquette `groupe` posée UNE fois sur l'inscription (les groupes de la phase 3
sont stables), un `fait_le` par membre d'atelier (les activités « à période »
remplaçant la présence), et la nature dérivée de la présence d'une `date_fin`.
Zéro nouvelle table, zéro nouvelle page.

**Écartée par l'orga** au profit du modèle riche (cette conception) : sous-groupes
par atelier avec pages dédiées, coach par sous-groupe, lien « comment se
retrouver » par sous-groupe, et réalisation partagée posée par les participantes.

Points de vigilance assumés avec ce choix (à garder en tête en exploitation) :

- **Deux sources de « qui suit qui »** : le coaching individuel
  (`tremplin_registration_coachs`, rempli par l'orga) ET les coachs d'un
  sous-groupe (`tremplin_sous_groupe_coachs`, migration 052). Elles ne se
  synchronisent pas ; l'orga est la garante de leur cohérence.
- **Saisie répétée** : des groupes identiques d'une séance à l'autre (ex.
  séances « point individuel » 1 et 2) se reconstruisent sur chaque atelier.
- La `nature` d'un atelier et sa fenêtre de dates sont indépendantes : un
  atelier `collectif` peut porter une fenêtre (semaine à confirmer) sans basculer
  en sous-groupes.
