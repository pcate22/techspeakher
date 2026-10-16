# Faisabilité — importer / maintenir à jour les talks depuis une plateforme de CFP (Sessionize, Conference Hall)

> Étude de faisabilité (pas une implémentation). Besoin exprimé : lier le profil
> TSH à Sessionize / Conference Hall pour, au minimum, **importer les talks**,
> voire **maintenir la liste à jour** automatiquement.
>
> **Suite** : le moissonneur (scénario F) est livré. La conception des deux
> chaînons restants (orga qui alimente le registre via une UI, conférences du
> registre proposées aux speakeuses) est dans
> `docs/conception-registre-conferences.md`.

## TL;DR (le verdict)

- **L'idée « relier le profil d'une speakeuse → aspirer automatiquement tous ses
  talks » n'est réalisable sur AUCUNE des deux plateformes.** Sessionize ET
  Conference Hall exposent une API **centrée événement, accès organisateur** —
  pas d'API « tous les talks de telle personne ».
- **Ce qui est faisable proprement et officiellement** : importer et maintenir
  à jour les talks **des événements que TSH / GDG Toulouse organisent** sur ces
  plateformes (DevFest, Tremplin…). GDG dispose déjà de la clé API et d'un
  outil qui consomme l'API Conference Hall ([`conference-hall-toolkit`](https://github.com/GDGToulouse/conference-hall-toolkit)).
- **Quick win sans dépendance API** : champ « lien Sessionize / Conference Hall »
  sur le profil (lien sortant + pré-remplissage manuel d'un talk). **Livré**
  (migration `010`, profil + fiche publique).
- À éviter : le **scraping** des profils publics (fragile, zone grise CGU,
  maintenance continue). Confirmé empiriquement : les pages profil renvoient
  **403** aux clients non-navigateur (voir §3.D).
- **Phase 2 (nouvelles pistes, §3 F-I)** : contourner l'absence d'API par
  speaker en faisant venir la donnée autrement — par les **événements publics**
  (moissonneur, F), par la **speakeuse elle-même** (collage de sa propre page,
  G), par sa **boîte mail** (transfert d'e-mail d'acceptation, H), le tout
  relancé par des **rappels intelligents** (I). Recommandé : **F d'abord,
  seul** ; G/H/I à décider après retour d'usage.

## 1. Le constat structurant : event-centric des deux côtés

| | Sessionize | Conference Hall |
|---|---|---|
| Nature | SaaS **propriétaire** | **Open source** (AGPL v3), self-hostable |
| API | `…/api/v2/{ENDPOINT_ID}/view/{vue}` (JSON/XML) | `GET /api/v1/event/{slug}` (+ `/schedule`), JSON |
| Qui détient l'accès | l'**organisateur** de l'événement (endpoint créé sur la page API/Embed) | l'**organisateur** de l'événement (clé `X-API-Key` par événement) |
| Périmètre d'un appel | **un événement** | **un événement** |
| API « tous les talks d'un speaker » | **non** | **non** |
| Token/OAuth speaker pour exporter ses talks | **non** | **non** |
| Données perso exposées | éviter de stocker l'e-mail | l'export **contient l'e-mail** du speaker → ne pas exposer |

Détail vérifié côté Conference Hall (lecture du code, version actuelle React
Router v7) :

- Routes API = `api/v1/event/:event` et `api/v1/event/:event/schedule`
  ([`app/routes.ts`](https://github.com/conference-hall/conference-hall/blob/main/app/routes.ts)).
- L'export est scopé `event.id`, instancié `'no-user'` → **aucun contexte
  utilisateur**, auth = clé API de l'événement (`docs/authorization.md`).
- La « talk library » d'un speaker (un talk écrit une fois, resoumis à plusieurs
  événements) existe dans le schéma (`Talk.creatorId`, `Proposal.talkId` +
  `eventId`) mais **n'est jamais exposée en API** : on n'y accède que par
  `eventId`, jamais par `userId`/`talkId`
  ([`prisma/schema.prisma`](https://github.com/conference-hall/conference-hall/blob/main/prisma/schema.prisma)).

Autrement dit : le modèle de données *est* centré speaker, mais la *surface
d'API* ne l'est pas. Même verrou que Sessionize.

## 2. Le décalage avec Tech Speak'Her

TSH est centré **speakeuse** (profil + ses talks). Les deux plateformes sont
centrées **événement**, et l'accès appartient à l'**organisateur** de chaque
événement. Une speakeuse parle dans N événements organisés par N personnes ;
nous ne possédons pas ces accès. D'où : pas de synchro « profil → historique
complet ».

Le besoin reformulé après le quick win : **aider les speakeuses à remplir leurs
talks passés et à venir, et maintenir un agenda à jour**, sachant que celles qui
donnent beaucoup de talks ne saisiront pas manuellement (trop long) et que les
autres oublieront. Conséquence sur la conception : tout ce qui demande plus
qu'une **confirmation en un clic** (ou un geste unique comme un copier-coller)
ne sera pas fait. C'est le cahier des charges des scénarios F à I.

## 3. Scénarios évalués

### A. Import par événement géré par TSH / GDG — ✅ faisable (généralisé par F)

C'est le seul chemin officiel et stable pour « importer + maintenir à jour ».
Pour les événements de la communauté (DevFest Toulouse, Tremplin…), TSH/GDG sont
organisateurs → on a l'endpoint (Sessionize) ou la clé API (Conference Hall).
Un cron :

1. tire l'événement (`/api/v1/event/{slug}` ou `…/view/All`) ;
2. matche chaque speaker à un `speaker_profiles` (voir §5) ;
3. **upsert** les talks avec l'id externe comme clé d'idempotence (re-sync sans
   doublon → « maintien à jour » assuré par la ré-exécution) ;
4. ~~talks importés en brouillon, validés par une orga avant publication~~
   **Corrigé à l'implémentation** : la speakeuse est maîtresse de sa fiche —
   un talk qu'elle confirme est publié sans validation orga par talk (la
   modération orga porte sur la fiche, pas sur chaque talk).

Couvre le besoin réel. Précédent existant : `GDGToulouse/conference-hall-toolkit`
consomme déjà cette API. Ne couvre **pas** les talks donnés hors écosystème.

### B. Lien CFP sur le profil + saisie assistée — ⚠️ partiel, mais bon ratio

Champs `sessionize_url` / `conference_hall_url` sur le profil → **lien sortant**
sur la fiche publique + bouton « créer un talk » qui **pré-remplit** le
formulaire (titre, pitch) que la speakeuse ajuste. Zéro dépendance API.

### C. Endpoint / clé fourni par la speakeuse — ❌ non viable

Supposerait qu'elle administre les événements. Faux en général.

### D. Scraping des profils publics — ❌ écarté (confirmé empiriquement)

Testé en juillet 2026 : une requête HTTP non-navigateur sur une page profil
publique (`sessionize.com/{slug}/`) renvoie **403 Forbidden**. Sessionize bloque
activement les accès automatisés. Scraper supposerait donc un navigateur
headless se faisant passer pour un humain (contournement de protection
anti-bot), du parsing de HTML non contractuel qui casse à chaque refonte, et une
zone rouge CGU/RGPD. Écarté définitivement **en tant que crawler côté serveur**.
La variante consentie « la speakeuse apporte elle-même le contenu de sa propre
page » reste, elle, saine : c'est le scénario G.

### E. Self-hosting Conference Hall avec endpoint custom — ❌ hors proportion

Techniquement on contrôlerait la base et pourrait écrire un endpoint par
speaker, mais : AGPL v3 (obligations de diffusion du code), coût d'exploitation,
et **aucun effet** pour les speakeuses qui utilisent l'instance publique.

### F. Moissonneur d'événements publics — ✅ recommandé (généralise A)

L'observation clé : l'API Sessionize est « par événement », mais **les endpoints
des conférences sont publics**. Quand un organisateur affiche son programme sur
son site via l'embed Sessionize, l'ID d'endpoint est visible dans la page ; le
JSON est servi sans secret (c'est le fonctionnement documenté de l'embed). On
n'a donc **pas besoin d'être organisateur** pour lire le programme publié d'un
DevFest, d'un Devoxx ou d'un MiXiT : l'organisateur l'a rendu public lui-même.

Le scénario A (événements TSH/GDG) se généralise alors en **registre
d'événements tech francophones** (table `cfp_events` : nom, source, endpoint ou
slug, dates), alimenté par l'orga et par la communauté (« ta conf n'y est pas ?
propose-la »). Le même cron que A moissonne tous les événements du registre.

Le matching speaker → speakeuse change de nature par rapport à A : on n'a pas
l'e-mail (endpoints publics Sessionize = pas de données de contact), donc on
matche par les **liens** du speaker dans l'export (LinkedIn, souvent renseigné,
à croiser avec le `linkedin` du profil TSH), par le `sessionize_url` du profil
(champ livré au quick win) et par nom normalisé en dernier recours.

**Consentement à trois niveaux** (réglage dans le profil, révocable à tout
moment) :

1. **Rien** : le moissonneur ignore cette speakeuse.
2. **Me proposer** (défaut) : suggestion un-clic. « On a trouvé N talks qui
   semblent être à toi, tu confirmes ? » ; un match refusé est mémorisé pour ne
   pas re-suggérer. Zéro risque de faux positif publié.
3. **Ajouter automatiquement** (opt-in, pour celles qui font beaucoup de
   talks) : l'auto-ajout ne s'applique qu'aux **matchs forts** — speaker matché
   via son `sessionize_url` déclaré ou un id externe qu'elle a déjà confirmé.
   Un match par simple nom reste une suggestion, même avec l'opt-in. Chaque
   auto-ajout déclenche une **notification** (« on a ajouté "X" à ta fiche, tu
   peux le retirer ») : contrôle a posteriori.

Dans tous les cas (même en mode « me proposer »), la **mise à jour d'un talk
déjà confirmé** (même `external_id` : changement de date, de titre, annulation)
est appliquée **silencieusement** au re-sync : le rattachement a été validé une
fois, on ne fait que rafraîchir des infos factuelles. Cohérent avec la règle
existante des fiches publiées : les modifications restent visibles, l'orga est
informée.

Ce que ça couvre : l'**agenda à venir** (programmes publiés avant les confs) et
une bonne part du **passé** (événements dont le programme reste en ligne).
Limites honnêtes : couverture = contenu du registre (à maintenir) ; usage
poli d'endpoints publiés pour l'embed → cache systématique, fréquence modérée
(1 à 2 moissons/jour), retrait immédiat d'un événement qui le demanderait.

### G. Collage magique (import déclenché par la speakeuse) — ✅ LIVRÉ (2026-08, sous forme d'import de fichier)

> **Livré** : `/mon-espace/talks/importer` — la speakeuse téléverse ou colle un
> export **JSON** (dont l'export Notist, qu'elle seule peut produire : consentement
> propre) ou un **CSV** (tableur, colonne « titre » au minimum). Le parseur
> (`src/lib/import-talks.ts`) groupe un même titre en UN talk à N occurrences,
> rapproche les conférences du répertoire, et une **prévisualisation** montre le
> plan exact avant d'écrire. Conférence hors répertoire → proposition (migration
> 068), la saisie attend l'arbitrage orga hors de tout affichage public.
> Rejouer le même fichier n'écrit rien de plus (dédoublonnage par titre et par
> (conférence, année)). La condition posée ci-dessous (« si des speakeuses
> réclament un import massif du passé ») s'est réalisée : la fiche d'Aurélie
> Vache portait 4 talks pour ~40 sur son Notist.
>
> **Le format RÉEL, vérifié sur son fichier (16/08/2026)** — le format
> documenté ne suffisait pas, et l'écart était silencieux :
> `noti.st/<profil>.json` renvoie un document JSON:API dont la racine `data`
> porte **l'autrice**, ses présentations étant nichées dans
> `relationships.data`. Sans dépliage, le parseur lisait le `name` de
> l'autrice comme un titre et importait UN talk « Aurélie » sans erreur.
> Corrigé (`deplierRessources`), avec les dates à l'heure près
> (« 2026-07-09 14:00:00 ») dont l'horaire est coupé. Son fichier donne
> **178 présentations → 73 talks** groupés, toutes datées.
>
> **Limite levée (PR #326)** : ce fichier ne contient aucun nom de
> conférence — seulement un lien `links.event` vers la fiche de l'événement
> (154 distinctes pour ses 178 présentations). L'import les résout désormais
> côté serveur (`src/lib/notist-evenements.ts`, hôte figé `noti.st`, une
> fiche par événement du lot, concurrence bornée, plafond 200, timeout 8 s,
> fiche en échec = scène « date seule »). Éclaireur du 16/08 : Notist répond
> 200 en ~1,5 s depuis une IP de centre de données, la fiche porte titre,
> ville, code pays et fenêtre de dates. L'année d'un titre d'événement
> (« WeAreDevelopers Europe 2026 ») sort en ÉDITION via le plan ordinaire ;
> l'annuaire reste la seule mémoire (proposition → validation → annuaire).

Analyse d'origine (le « collage » pur, écarté au profit du fichier) :

Le pendant consenti du scraping : dans son espace, la speakeuse ouvre **sa**
page Sessionize dans **son** navigateur (aucun 403 : c'est un humain), copie le
contenu (Ctrl+A, Ctrl+C) et le colle dans un champ « importer mes talks ». Un
parseur côté serveur extrait titre / événement / date / lien, affiche un écran
de vérification, et importe en **brouillon éditable**. C'est elle qui apporte
ses propres données : propre côté CGU comme côté RGPD.

Pourquoi optionnel et non recommandé :

- Le besoin « historique complet » est déjà largement couvert par le lien
  « Aussi sur Sessionize » de la fiche (phase 1) : l'orga qui veut tout le CV
  clique et voit tout, à jour, chez Sessionize. Ce qui fait vivre l'annuaire,
  ce sont les talks récents et à venir → F.
- Il contredit la prémisse « pas de saisie manuelle » : geste unique, mais
  volontaire — une partie des speakeuses ne le fera jamais, là où F travaille
  pour toutes sans rien demander.
- Coût réel au-dessus de l'estimation : parseur de texte collé (formats
  variables, mobile/desktop, page en anglais), écran de vérification, tests…
  pour une feature utilisée une fois par speakeuse.

Ce qui le garde au catalogue : il couvre les confs **hors registre** et le
passé lointain, sans dépendance externe. À construire seulement si, F en
route, des speakeuses réclament un import massif du passé.

### H. Transfert d'e-mail (« forward et c'est fait ») — ⚠️ bonne brique ultérieure

Sessionize et Conference Hall écrivent aux speakers (proposition acceptée,
programme publié). On expose une adresse dédiée (ex. `talks@techspeakher.fr`) ;
la speakeuse **transfère** l'e-mail d'acceptation, un webhook entrant (Brevo
inbound parsing) l'analyse et crée le talk en brouillon dans son espace,
rattaché par l'adresse d'expédition (celle du compte TSH). Couvre les **talks à
venir**, y compris hors registre. Dépend du format des e-mails des plateformes
(à surveiller) et demande une habitude, mais un transfert prend trois secondes,
même à quinze confs par an. À construire après F+G si le registre laisse des
trous.

### I. Rappels intelligents — ✅ petit, s'appuie sur F

Le rappel semestriel promis dans l'espace membre devient utile plutôt que
culpabilisant : ne relancer que les speakeuses dont le dernier talk date de plus
de N mois, et pré-remplir l'e-mail avec les suggestions du moissonneur (F) pour
que la relance soit « clique pour confirmer », pas « pense à remplir ». Filet de
sécurité pour celles qui oublient ; quasi gratuit une fois F en place (Brevo
déjà branché).

### J. Écoute d'un profil Notist déclaré (le G qui se rejoue tout seul) — ✅ faisable, petit une fois la PR #326 en prod

> Piste consignée à la demande de l'utilisatrice (16/08/2026), née du parcours
> réel d'Aurélie Vache : plutôt que de re-téléverser son export à chaque
> nouvelle conf, la speakeuse **déclare son profil Notist** dans son espace et
> la plateforme **relit `noti.st/<profil>.json` périodiquement** pour proposer
> les nouveaux talks. La moissonneuse, mais côté speakeuse : la source est SON
> profil (consentement explicite et révocable), pas une édition du registre.

Pourquoi c'est petit : **toutes les briques sont livrées par G + la PR #326**.

- Le parseur lit déjà le format réel (`deplierRessources`, horaires coupés) et
  la résolution des fiches d'événements donne conférence + lieu + fenêtre de
  dates (`notist-evenements.ts`, hôte figé, bornes, budget).
- L'import est **idempotent** (dédoublonnage par titre et par (conférence,
  année)) : rejouer le profil entier n'écrit que les nouveautés — le re-sync
  EST l'import, aucun pipeline séparé à maintenir.
- Le matching speaker → speakeuse, point dur du F, est ici **trivial** : le
  profil est déclaré par elle, tout match est fort par définition. Les trois
  niveaux de consentement du F s'appliquent tels quels, et le niveau 3
  (auto-ajout notifié) est sûr d'entrée.
- En régime de croisière le besoin réseau décroît : l'annuaire mémorise les
  conférences validées au premier import massif, un re-sync ne résout que les
  fiches des événements NOUVEAUX (quelques-unes par mois), et les confs hors
  répertoire suivent la file de propositions ordinaire, sous le même plafond
  par lot.

Ce qu'il reste à construire : un champ `notist_username` au profil (borné
`[A-Za-z0-9-]`, consentement révocable, même esprit que `sessionize_url`), un
cron gardé par `CRON_SECRET` (fréquence modérée, 1/jour max), et l'écran de
suggestions un-clic du niveau 2 (réutiliser la mémoire des refus prévue au F).
À séquencer APRÈS la validation du parcours réel d'Aurélie en prod (G + #326 +
plafond relevé) : son import initial est le meilleur test du re-sync.

## 4. Recommandation

1. **Phase 1 — fait** : champ « lien Sessionize / Conference Hall » au profil
   (scénario B), affiché dans « Talks & conférences » sur la fiche publique et
   dans le `sameAs` SEO. Livré (migration `010`).
2. **Phase 2 — F, seul** : le moissonneur d'événements publics. Registre +
   cron + suggestions un-clic maintiennent l'**agenda** à jour sans effort et
   pour toutes. Le scénario A (événements TSH/GDG avec clé API Conference Hall)
   devient un cas particulier du registre, avec des données plus riches (e-mail
   pour le matching, en mémoire seulement). L'historique, lui, est servi par le
   lien « Aussi sur Sessionize » de la fiche (phase 1).
3. **Phase 3 — selon les manques constatés en usage** : I (rappels
   intelligents, quasi gratuit une fois F en place), G (collage magique) si des
   speakeuses réclament un import massif du passé, H (transfert d'e-mail) si le
   registre ne couvre pas assez d'événements.

> Rappel : l'annuaire (liste des speakeuses) se remplit quand des femmes créent
> et publient un profil — c'est l'onboarding/migration, pas l'import Sessionize.
> L'import **enrichit les fiches** (talks d'une speakeuse déjà inscrite) ; il ne
> fait pas apparaître de nouvelles speakeuses.

## 5. Esquisse technique (scénarios A et F)

### Schéma — migration `NNN_import_talks.sql`

```sql
-- Idempotence de l'import (1 talk externe = 1 talk au plus)
ALTER TABLE talks ADD COLUMN IF NOT EXISTS source        TEXT NOT NULL DEFAULT 'manuel'; -- 'manuel' | 'sessionize' | 'conference-hall'
ALTER TABLE talks ADD COLUMN IF NOT EXISTS external_id   TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS talks_source_external_id_key
  ON talks (source, external_id) WHERE external_id IS NOT NULL;
```

(Les colonnes `sessionize_url` / `conference_hall_url` du profil sont déjà en
prod, migration `010`.)

### Registre d'événements (scénario F)

```sql
-- Registre moissonné par le cron. Alimenté par l'orga (et propositions communauté).
CREATE TABLE IF NOT EXISTS cfp_events (
  id          SERIAL PRIMARY KEY,
  nom         TEXT NOT NULL,                 -- « DevFest Toulouse 2026 »
  source      TEXT NOT NULL,                 -- 'sessionize' | 'conference-hall'
  endpoint    TEXT NOT NULL,                 -- id d'endpoint public (Sessionize) ou slug (CH)
  ville       TEXT,
  pays        TEXT,
  date_debut  DATE,
  actif       BOOLEAN NOT NULL DEFAULT TRUE, -- FALSE = retiré du moissonnage
  UNIQUE (source, endpoint)
);

-- Consentement au moissonnage, par speakeuse (défaut : suggestions un-clic).
ALTER TABLE speaker_profiles ADD COLUMN IF NOT EXISTS
  cfp_sync_mode TEXT NOT NULL DEFAULT 'suggestions'; -- 'aucun' | 'suggestions' | 'auto'

-- Suggestions du moissonneur, en attente de confirmation par la speakeuse.
-- Un refus reste en base (statut 'refuse') pour ne pas re-suggérer.
CREATE TABLE IF NOT EXISTS talk_suggestions (
  id          SERIAL PRIMARY KEY,
  profile_id  INTEGER NOT NULL REFERENCES speaker_profiles(id) ON DELETE CASCADE,
  event_id    INTEGER NOT NULL REFERENCES cfp_events(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  titre       TEXT NOT NULL,
  statut      TEXT NOT NULL DEFAULT 'proposee', -- 'proposee' | 'acceptee' | 'refuse'
  UNIQUE (event_id, external_id, profile_id)
);
```

À répercuter dans `db/schema.sql` **et** `db/sync-to-latest.sql`.

### Client (sur le modèle de `brevo-client.ts`)

```ts
// src/lib/cfp-import.ts
// Conference Hall — clé API par événement (header X-API-Key)
async function fetchConferenceHallEvent(slug: string, apiKey: string) {
  const res = await fetch(`https://conference-hall.io/api/v1/event/${slug}`, {
    headers: { "X-API-Key": apiKey },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`Conference Hall ${slug}: ${res.status}`);
  return res.json();
}
// Sessionize — endpoint public à ID unique, sans secret
async function fetchSessionizeEvent(endpointId: string) {
  const res = await fetch(`https://sessionize.com/api/v2/${endpointId}/view/All`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`Sessionize ${endpointId}: ${res.status}`);
  return res.json();
}
```

### Mapping proposition/session → talk

| Source | `talks` | Note |
|---|---|---|
| `title` | `titre` | |
| `abstract` / `description` | `description` | tronquer à 1000 (cf. `talk-form.ts`) |
| date de l'événement | `date` | format `YYYY-MM-DD` (`talk-date.ts`) ; CH ne porte pas toujours la date côté proposition → prise sur l'event |
| nom/ville/pays de l'événement | `conference`, `ville`, `pays` | depuis la config de l'event synchronisé |
| `id` de la proposition/session | `external_id` (+ `source`) | clé d'idempotence |

### Matching speaker → profil

Par fiabilité décroissante : id externe déjà connu → e-mail (présent dans
l'export CH, **non stocké**, juste pour matcher) → LinkedIn → `fullName`
normalisé. Tout match incertain reste **non rattaché** → file de modération.

### Déclenchement (sur le modèle de `api/cron/reminders`)

`GET /api/cron/sync-talks`, gardé par `CRON_SECRET` (`isAuthorizedCron`),
déclaré dans `vercel.json`. Le cron parcourt `cfp_events` (actifs), moissonne,
met à jour les `talk_suggestions` et upserte les talks confirmés. Fréquence
modérée (1 à 2 fois par jour) + réponses en cache : usage poli d'endpoints
publics.

### Env (`.env.example`)

```
# Conference Hall — clés API par événement (secrètes, événements TSH/GDG
# uniquement : les endpoints Sessionize publics vivent dans cfp_events)
CONFERENCE_HALL_EVENTS=""   # ex. "devfest-toulouse-2026:CLE,tremplin-2026:CLE"
```

## 6. Risques et points d'attention

- **Couverture partielle assumée** : le moissonneur (F) couvre le contenu du
  registre `cfp_events`, à faire vivre ; le collage (G) et le transfert (H)
  couvrent le reste, à l'initiative de la speakeuse.
- **Politesse sur les endpoints publics (F)** : publics parce que publiés pour
  l'embed par l'organisateur → cache systématique, moisson 1 à 2 fois/jour,
  retrait immédiat sur demande d'un organisateur. Jamais de HTML, uniquement le
  JSON documenté.
- **Publication automatique = opt-in explicite (F)** : par défaut un talk
  moissonné n'apparaît qu'après confirmation par la speakeuse (un clic) —
  sans validation orga par talk. L'auto-ajout (`cfp_sync_mode = 'auto'`)
  est un choix de la speakeuse, révocable, limité aux matchs forts (jamais sur
  simple homonymie) et notifié après coup. Les mises à jour de talks déjà
  confirmés sont silencieuses dans tous les modes. Un refus est mémorisé (pas
  de re-suggestion).
- **RGPD** : l'export Conference Hall contient l'e-mail du speaker → l'utiliser
  uniquement en mémoire pour le matching, **ne jamais le stocker** ni l'exposer ;
  DTO `PublicSpeaker` inchangé.
- **Matching prudent** : jamais de rattachement sur simple homonyme.
- **Publication** : un talk n'apparaît qu'après confirmation par la speakeuse
  (un clic) — pas de validation orga par talk (décision : la speakeuse est
  maîtresse de sa fiche ; la modération porte sur la fiche entière).
- **Clés API secrètes** (Conference Hall) en env, jamais committées.
- **Licences/CGU** : API officielles uniquement, pas de scraping ; AGPL si
  self-hosting modifié.
- **Tests (TDD)** : mapping, idempotence (re-sync sans doublon), matching, garde
  `CRON_SECRET` — avant le code.

## 7. Effort indicatif

| Lot | Contenu | Ordre de grandeur |
|---|---|---|
| Quick win (B) — **fait** | champs liens, lien fiche, `sameAs` SEO | ~0,5 j |
| Moissonneur (F, inclut A) — **phase 2** | migrations (`talks.source`/`external_id`, `cfp_events`, `talk_suggestions`, `cfp_sync_mode`), client, mapping, matching par liens, suggestions un-clic dans l'espace, cron, tests | ~3 à 4 j |
| Rappels intelligents (I) | ciblage + suggestions dans l'e-mail de rappel | ~0,5 j (après F) |
| Collage magique (G) — optionnel | champ d'import, parseur, écran de vérification, import brouillon, tests | ~1 à 2 j |
| Transfert d'e-mail (H) — optionnel | adresse dédiée, webhook Brevo inbound, parsing, rattachement, tests | ~1 à 1,5 j |

## Sources

### Sessionize
- [API: Access your data from code](https://sessionize.com/playbook/api) · [API / Embed for Developers](https://sessionize.com/developers) · [Using your data](https://sessionize.com/playbook/using-data)
- [Embedding](https://sessionize.com/playbook/embedding) (endpoints créés pour l'embed → consommés côté client, donc publics)
- [Pricing / licence communautaire](https://sessionize.com/pricing) (SaaS propriétaire, gratuit pour événements communautaires)
- Constat 403 : requête HTTP non-navigateur sur une page profil publique
  (`sessionize.com/{slug}/`), testée le 2026-07-01 → `403 Forbidden`.

### Conference Hall (vérifié dans le code)
- [Dépôt](https://github.com/conference-hall/conference-hall) · [Routes API `app/routes.ts`](https://github.com/conference-hall/conference-hall/blob/main/app/routes.ts) · [Schéma `prisma/schema.prisma`](https://github.com/conference-hall/conference-hall/blob/main/prisma/schema.prisma)
- [Outil GDG Toulouse consommant l'API event](https://github.com/GDGToulouse/conference-hall-toolkit)
