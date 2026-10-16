# Revue de conception — l'onglet « À faire » (étapes B et C)

> Revue demandée le **2026-08-16**, après le merge de l'étape A (#323, #332),
> sous quatre angles : **sécurité**, **RGPD**, **RGAA**, **accessibilité
> cognitive**. Porte sur `docs/conception-profil-et-a-faire.md` (§4.2, §3.4,
> §3.5) et `docs/conception-technique-profil-et-a-faire.md` (D1 → D5, §3, §4).
>
> **Rien de l'étape B n'est codé.** C'est le moment de la revue : les défauts
> relevés ici coûtent une phrase à corriger dans un document, et un lot entier
> une fois livrés.
>
> Méthode : `docs/revue-avant-pr.md` — **un agent par angle, en parallèle,
> chacun aveugle aux autres et à cette page**. Une revue menée en ligne par la
> tête qui a écrit la conception « confirme, elle ne cherche pas » : ce qui
> suit fusionne une passe en ligne (qui a servi à établir les faits dans le
> code) avec les rapports des relecteurs autonomes. Les constats que seuls les
> relecteurs autonomes ont vus portent la mention **(passe autonome)** — ils
> sont la moitié du lot, et pas la moins lourde.
>
> Chaque constat est vérifié dans le CODE actuel, jamais déduit du seul
> document. Les numéros de ligne cités ont été lus.

## 0. Le constat qui commande les autres

L'étape B fait une chose que ni la conception fonctionnelle ni la conception
technique ne nomment : **elle déplace du contenu réservé aux organisatrices
depuis `/admin` vers `/mon-espace`.**

Ce n'est pas un détail d'URL. `src/proxy.ts` protège au bord **par préfixe** :

```ts
// src/auth.config.ts:109-113
const prive = pathname.startsWith("/admin") || pathname.startsWith("/mon-espace");
if (!user) return prive ? "/connexion" : null;
if (pathname.startsWith("/admin") && user.isOrga !== true) return "/mon-espace";
```

`/admin/**` demande le rôle. `/mon-espace/**` demande seulement d'être
connectée. Le commentaire du proxy raconte d'ailleurs précisément l'incident
que cette frontière a déjà causé une fois : « une membre connectée traversait
le proxy jusqu'aux pages /admin (mesuré : 200 sur cinq d'entre elles) ».

Aujourd'hui, les tâches d'association vivent sur `/admin/taches` : **deux**
gardes indépendantes les couvrent (le préfixe au bord, puis `requireOrgaPage`
sur la page). Demain, sur `/mon-espace/a-faire`, il n'en reste **qu'une** — la
capacité passée à `chargerTaches` (D2). D2 est une bonne décision ; le problème
est qu'elle devient la seule, sur une route que n'importe quelle membre
connectée atteint, et pour un contenu **nominatif**.

Tout le reste de cette revue découle de là ou tourne autour.

---

## 1. Sécurité

### S1 — La route perd sa garde de préfixe, et rien ne la remplace 🔴

**Ce que dit la conception** : D5 crée `/mon-espace/a-faire`, D2 borne le
chargement par capacité.

**Ce qui manque** : une garde de ROUTE. D2 borne ce qu'on lit ; elle ne dit
rien de qui entre. Si un jour une régression fait passer `estOrga: true` (une
valeur par défaut, un paramètre inversé, un appel qui oublie l'argument), il
n'y a plus de second filet — alors qu'aujourd'hui le bord refoulerait.

**Correctif** : ne pas se contenter de la capacité.

1. `chargerTaches` prend un objet de capacités **sans valeur par défaut**, et
   `estOrga`/`estCoach` y sont **obligatoires** — pas de `estOrga = false` en
   signature, qui rendrait un oubli silencieux dans un sens comme dans l'autre.
2. Les capacités se lisent **dans la fonction elle-même**, depuis la session,
   pas dans les arguments : `chargerTaches()` appelle `getSession()` et en
   dérive ce qu'elle a le droit de lire. Une capacité qu'aucun appelant ne peut
   passer est une capacité qu'aucun appelant ne peut mentir. C'est la règle
   déjà écrite de CLAUDE.md — « l'identité vient de la session, jamais du
   client » — appliquée d'un cran plus bas.
3. Le test du §5 (« passer `estOrga: true` en dur → le test doit tomber ») ne
   peut alors même plus s'écrire, ce qui est le bon résultat : **rendre la
   faute impossible vaut mieux que la tester** (`docs/principes-tests.md`).

### S2 — Le compteur s'exécute sur chaque page, y compris là où il n'a rien à faire 🟠

`BottomNavServeur` est monté dans `src/app/mon-espace/layout.tsx:15` **et**
`src/app/admin/layout.tsx:17` : la barre est rendue sur toutes les pages des
deux espaces. D3 y ajoute `compterTaches`.

Deux conséquences que la conception ne pèse pas :

- **une requête par famille, sur chaque navigation**, y compris sur des pages
  qui n'ont rien à voir (une sous-page d'atelier, un formulaire) ;
- surtout : le compte de la famille `association` est calculé **pour toute
  personne connectée**, et c'est la capacité qui décide de ne pas le faire. Un
  compteur est peu de chose, mais un nombre est déjà une information (« il y a
  7 fiches en attente » renseigne sur l'activité de l'association).

**Correctif** : `compterTaches` ne calcule **que les familles autorisées**, et
le calcul de chaque famille est déclenché par la capacité, pas filtré après.
Écrire le test qui compte les requêtes émises pour une non-orga : **zéro** sur
la famille association, pas « une dont le résultat est jeté ».

### S2 bis — Le cron n'a pas de session, et casserait le correctif de S1 🟠 (passe autonome)

L'étape C fait lire le moteur par le cron de notifications
(`src/app/api/cron/notifications/route.ts`). Un cron **n'a pas de session** :
si `chargerTaches` lit la session elle-même (S1), le cron ne peut plus
l'appeler — et la sortie de facilité serait de lui laisser passer
`estOrga: true` en dur, c'est-à-dire de rouvrir exactement le trou qu'on
vient de fermer.

**Correctif** : une **porte séparée et nommée**, `chargerTachesAssociation()`,
sans capacité en argument, appelée uniquement par le cron déjà gardé par
`CRON_SECRET`. Deux entrées, deux gardes explicites, aucun booléen qui
voyage.

### S3 — Un IDOR latent si `profileId` entre dans la signature 🟠 (passe autonome)

`getPendingSuggestionsCount(profileId)` (`src/lib/cfp-suggestions.ts:284`) et
`getTransmittedMessagesForProfile(profileId)` (`src/lib/contact-message.ts:166`)
filtrent sur l'identifiant qu'on leur donne, **sans vérifier qu'il appartient à
qui demande**. Elles sont sûres aujourd'hui parce que leurs appelants le
dérivent de la session (`src/app/mon-espace/messages/page.tsx:22`).

Mettre `profileId` dans la signature de `chargerTaches` déplace cette
responsabilité chez l'appelant — pour rien : `getProfileByUserId` est déjà
mémoïsée par requête (`src/lib/profiles.ts:290`).

**Correctif** : `profileId` sort de la signature. Le loader le dérive de
`userId`, lui-même issu de la session.

### S4 — La famille coach est gardée par un drapeau, alors que le risque est HORIZONTAL 🔴 (passe autonome)

C'est le finding le plus important que la passe en ligne avait manqué.

`estCoach` dit « cette personne est coach ». Il ne dit pas « ces ateliers sont
les siens ». Or les tâches candidates de B1 (« pointer les présences de SES
ateliers ») portent des noms de participantes. Si la famille coach réutilise
`chargerEditionEntrees` (`src/lib/taches-orga-chargement.ts:45`), qui charge
**tous** les ateliers et **toutes** les inscriptions d'une édition, une coach
reçoit les tâches des ateliers des autres : élévation horizontale, et fuite
nominative.

L'espace coach existant fait exactement l'inverse, et le dit :
« Tout est scopé EN SQL par la liaison coach ↔ cible »
(`src/lib/tremplin-coachs.ts:272`) ; « la garde est la liste elle-même :
`getCoachAteliers` ne renvoie QUE les ateliers que ce compte anime ». **D2
régresse ce modèle en drapeau de capacité.**

Aggravant : `markUserAsCoach` (`src/lib/tremplin-coachs.ts:267`) **n'a pas
d'inverse** — `is_coach` ne redescend jamais à `false`. Une coach d'une édition
passée reste `estCoach: true` à vie.

**Correctif** : la signature porte **`coachId`, pas `estCoach`**, et le
chargement coach passe par des requêtes bornées en SQL sur ses liaisons.
À écrire dans D2 **avant** B2, sinon le lot le réinventera au drapeau. Le §5
gagne la ligne « une coach ne voit que ses ateliers », avec son cassage
(élargir le `WHERE` → le test tombe).

### S5 — `?vue=` doit être intersecté avec les capacités, jamais les élargir 🟠 (passe autonome)

Le raccourci d'implémentation naturel de D4 — « la vue dit quelle famille
charger » — ferait d'un paramètre d'URL un **sélecteur de données** : une
requête forgée `?vue=association` deviendrait une élévation. Et même sans
ça, afficher le bandeau « Pour l'association » et son message de vide à qui
n'a pas le rôle **révèle le modèle de rôles**.

`cleVue` (`src/lib/vue-liste.ts:64`) borne déjà à une liste fermée, mais ne
connaît pas les capacités.

**Correctif** : la vue est **intersectée** avec les familles effectivement
chargées ; une vue non permise retombe silencieusement sur « Tout » — pas
d'erreur, pas de message.

### S6 — Deux garde-fous à inscrire dans D3 avant que le coût ne les fasse sauter 🟡 (passe autonome)

`BottomNavServeur` ne rend rien sans session et n'est monté que par les deux
layouts de l'espace connecté : le compteur ne s'exécutera jamais pour un
anonyme. `Cache-Control: no-store` est déjà posé. Correct.

Mais D3 met (à raison) la pression sur le coût, et c'est exactement la
pression qui mène à un cache :

1. **Aucun cache au-delà de la requête** pour `compterTaches`. Un
   `unstable_cache` ou un `"use cache"` dont la clé oublie l'identité
   servirait le compteur d'une orga à une membre.
2. La nouvelle route reprend `robots: { index: false }` et
   `dynamic = "force-dynamic"`, comme `/admin/taches` — D5 décrit la route
   sans ces deux lignes, qui sont la convention du dépôt.

### S7 — `estOrga` vient du JWT, qui est figé (préexistant, à ne pas aggraver) 🟡

`session.user.isOrga` est peuplé depuis le token (`auth.config.ts:132`), lui-
même écrit à la connexion. Une organisatrice à qui on retire le rôle **garde
`isOrga: true` jusqu'à expiration de son jeton**. C'est vrai aujourd'hui pour
tout `/admin` — donc **préexistant**, hors périmètre de cette conception.

Je le signale pour une seule raison : D2 fait du JWT la **garde unique** de
données nominatives (voir S1). Un défaut acceptable en deuxième ligne l'est
moins en première. Si S1 est corrigé comme proposé, ce point redevient ce
qu'il était : une dette connue, à traiter pour elle-même. Un `maxAge` de
session plus court, ou une relecture des rôles au rafraîchissement du jeton,
réglerait le point — ainsi que son jumeau `is_coach`, qui n'a pas d'inverse
(S4).

---

## 2. RGPD

### G1 — « Aucun identifiant de personne » est vrai, et à côté de la question 🔴

**Ce que dit B2** : « Aucun identifiant de personne, aucun e-mail — les noms
n'apparaissent que dans le libellé déjà composé côté serveur ».

**Ce que fait le moteur** (`src/lib/taches-orga.ts`) :

| Ligne | Libellé produit |
|---|---|
| 183 | `Valider la fiche d'Ada` |
| 198 | `Relancer la fiche de {nom}, en sommeil` |
| 215 | libellé d'article, avec `auteurNom` |
| 344 | `Relier {nom} à un compte` |

Le nom EST la donnée personnelle. Le sortir de l'identifiant et le composer
côté serveur ne change rien au fait qu'il est transmis. Et la ligne 344 est la
plus sensible du lot : `participantesSansCompte` désigne des personnes
**inscrites par une orga**, qui n'ont pas de compte et n'ont jamais rien
accepté sur la plateforme.

**Correctif** : reformuler B2 pour dire ce qui est vrai, et en tirer la
conséquence — « la famille `association` transporte des NOMS ; c'est
précisément pourquoi son chargement est gardé, et pourquoi elle ne sort jamais
de la plateforme (voir G3) ». Un document qui se rassure sur un point qu'il ne
tient pas est plus dangereux qu'un document qui l'assume.

**Et l'affirmation est fausse une seconde fois** *(passe autonome)* : le `href`
**est** un identifiant de personne, et il est dans le DTO —
`/speakeuses/${f.id}` (`taches-orga.ts:185`, `:202`),
`/admin/tremplins/{ed}/participantes/${p.id}/compte` (`:346`). Légitime pour un
écran, où le lien doit bien mener quelque part. Mais la phrase sert de
**garantie RGPD** dans le document, et elle est reprise telle quelle pour
rassurer sur l'étape C : un e-mail qui reproduit la dérivation n'emporte donc
pas seulement des noms, il emporte des **liens profonds vers le dossier
individuel** de chaque personne.

Formulation juste à écrire en B2 : « le DTO porte un libellé composé côté
serveur et une URL interne ; il ne porte ni e-mail ni corps de message — et les
URL ne quittent jamais la plateforme ».

### G2 — Le nom d'une speakeuse traverse une frontière qu'il ne traversait pas 🟠

Aujourd'hui, ces libellés vivent sur `/admin/taches`, sous la double garde du
§0. Demain, ils vivent sur une route `/mon-espace/**`. Même si la garde de
chargement tient, la **minimisation** (RGPD art. 5-1-c) demande de se
demander : est-il nécessaire que le nom soit dans le libellé ?

Pour « Valider la fiche d'Ada », oui : l'orga choisit par le nom.
Pour « Relier {nom} à un compte », oui aussi.
Pour le **compteur de la barre**, non — et il n'en a pas.

**Correctif** : garder les noms, l'aggravation est ailleurs (G3). Mais
l'écrire noir sur blanc dans la conception, pour qu'une future « vue partagée »
ou un « export » ne reprenne pas ces libellés sans y penser.

### G3 — L'étape C multiplie par cinq les données personnelles envoyées à une boîte partagée 🔴

**Ce que dit la conception** (§4.4 fonctionnelle, §4 technique) : l'e-mail
quotidien « lit la même dérivation que l'écran » au lieu de ses deux
compteurs.

**Ce que fait l'e-mail aujourd'hui** (`src/lib/digest-email.ts:20-44`) :

```
- 3 fiches à valider
- 1 message à modérer
Tout se passe ici : {BASE_URL}/admin
```

**Des comptes. Aucun nom.** Et il part vers `CONTACT_EMAIL`
(`src/app/api/cron/notifications/route.ts:79`), c'est-à-dire
`techspeakher@gmail.com` — **une boîte Gmail partagée, qui est aussi
l'adresse de contact publique du site** (`src/constants/site.ts:5`).

Lire la même dérivation ferait donc partir chaque jour, vers une boîte
partagée hébergée hors de la plateforme, une liste du genre :

```
- Valider la fiche d'Ada Lovelace
- Relancer la fiche de Nawel B., en sommeil
- Relier Marie C. à un compte
- Recueillir l'accord pour 4 photos
```

C'est un changement de nature, pas de volume : on passe d'un signal
(« il y a du travail ») à un **transfert quotidien de données nominatives**
vers un canal que l'association ne maîtrise pas, dont la liste des lecteurs
n'est pas nominative, et dont la rétention est celle de Gmail.

*(passe autonome)* Trois précisions qui durcissent le constat :

1. **Ce n'est pas une liste d'organisatrices.** `CONTACT_EMAIL` est l'adresse
   **publique** de l'association : publiée en `mailto:` sur le code de conduite
   (`src/app/code-de-conduite/page.tsx:198`), destinataire du formulaire de
   contact (`src/app/api/contact/route.ts:111`), `replyTo` des liens magiques
   (`src/lib/magic-link.ts:25`). Son périmètre d'accès n'est pas
   `users.is_orga` : c'est celui du partage d'une boîte Gmail. Et il est chez
   Google, alors que la base est délibérément en région UE.
2. **La copie survit à la suppression du compte.** Le projet a poussé
   l'effacement jusqu'à Brevo (`docs/conception-synchro-contacts.md`) et
   `passeConservation` efface en cascade — aucun de ces mécanismes n'atteint un
   e-mail déjà distribué. L'étape C créerait donc, pour la première fois, une
   **durée de conservation que personne n'outille**.
3. **Le cron lui-même applique déjà la bonne doctrine, sur le canal d'à côté** :
   son compte rendu ne journalise que des compteurs, avec la raison écrite en
   commentaire — « un journal nominatif annulerait la suppression »
   (`src/app/api/cron/notifications/route.ts:168-171`). L'étape C, telle
   qu'écrite, contredirait la règle que le fichier voisin énonce.

**Correctif — la bonne façon de tenir l'intention de la conception** :
l'e-mail lit bien la **même dérivation** (c'est ce qui règle le vrai défaut :
deux définitions de « à faire »), mais il n'en publie que la **forme agrégée**
— le nombre par famille de règle, et un lien. Les noms restent derrière
l'authentification.

```
- 3 fiches à valider
- 2 ateliers à dater (Tremplin DevFest 2026)
- 1 article en relecture
Le détail est dans ton espace : {BASE_URL}/mon-espace/a-faire?vue=association
```

Un canal du moteur, comme voulu, sans faire du courrier un second entrepôt.
Et le défaut visé par la conception — « il imprime 0 fiche à valider dès que
l'autre ligne est non nulle » — est corrigé au passage, puisque les lignes à
zéro se taisent.

### G4 — Ce qui est bien, et qu'il faut garder explicitement ✅

Le moteur **ne stocke rien** : « une tâche apparaît parce que sa condition est
vraie et disparaît parce qu'on a agi » (`taches-orga.ts`, en-tête). Aucune
table de notifications, donc aucune durée de conservation à définir, aucun
droit d'effacement à outiller, aucune purge à écrire.

C'est un choix d'architecture qui vaut plusieurs pages de conformité. **À
défendre explicitement le jour où quelqu'un proposera de « marquer une tâche
comme lue »** — ce serait un état par personne et par tâche, donc une table,
donc un traitement, donc une durée de conservation, un droit d'effacement et
une purge, d'un seul coup. Voir C2 : cette pression viendra.

Deux autres points à conserver *(passe autonome)* :

- **`ListeTaches` est un composant SERVEUR** (aucun `"use client"`) : rien
  n'est sérialisé vers le navigateur. Comme D4 met le filtre dans l'URL, on
  peut le garder ainsi — **le DTO le plus sûr est l'absence de DTO**, et ça
  mérite d'être écrit en B2 plutôt que laissé au hasard du prochain besoin
  d'interactivité.
- **Le compteur de la barre est un nombre, jamais un libellé.** Rendu sur
  toutes les pages de l'espace connecté, il ne transporte rien de nominatif.
  C'est ce qui rend la barre inoffensive — à ne pas « enrichir ».

### G5 — Des personnes sans compte, qui n'ont jamais vu la plateforme 🟠 (passe autonome)

`participantesSansCompte` (`taches-orga-chargement.ts:82-84`, filtre
`!r.userId`) désigne des personnes inscrites via un formulaire externe ou
saisies à la main par une orga. **Pas de compte, donc pas de notice, pas de
réglages, pas de bouton de suppression** — et leur nom devient un libellé
(`Relier {nom} à un compte`).

Aujourd'hui ce nom reste derrière `requireOrgaPage`, usage interne cohérent
avec la notice. Sous l'étape C il sortirait de la plateforme, pour précisément
la population qui a le moins de moyens de s'en apercevoir et d'agir.

**Correctif** : quoi qu'il advienne de G3, **jamais** de personne sans compte
dans un libellé sortant. La forme groupée existe déjà et suffit — « Relier 3
participantes à un compte » (`taches-orga.ts:348-352`).

### G6 — L'argument RGPD de D2 est contredit par le document lui-même 🟡 (passe autonome)

> D2 : « les seules tâches nominatives sont dans la famille `association` »

Faux d'après §3 B1 et la maquette §3.4 du document fonctionnel : « **Répondre à
Nawel** » est classé **perso**. Ce n'est pas une fuite — c'est un message qui
lui est adressé, elle a déjà le droit de le lire — mais c'est la seule phrase
du document qui porte l'argument RGPD, et elle est inexacte.

**L'invariant juste, et testable** : *chaque famille ne porte que des données
que la personne peut déjà voir sur une autre page de son espace.*

Point d'attention associé : `getTransmittedMessagesForProfile` renvoie des
lignes **complètes**, `senderEmail` et `body` compris
(`src/lib/contact-message.ts:166-177`). Seul le libellé doit survivre au
chargement.

### G7 — Deux protections bon marché, à poser AVANT de toucher à l'étape C 🟡 (passe autonome)

- `registrationLabel` retombe sur `userEmail`
  (`src/lib/tremplin-registrations.ts:55`). Le chemin actuel est sûr (le filtre
  `!r.userId` garantit qu'aucune adresse n'est jointe), mais un libellé de
  tâche est du **texte libre** : le jour où ce filtre s'élargit, une adresse
  entre dans un libellé — et, sous l'étape C, dans un e-mail. **Un test qui
  casse si un libellé contient un `@` coûte trois lignes.**
- `src/__tests__/digest-email.test.ts` ne teste aujourd'hui que le compte et
  l'extrait : **l'étape C changerait la nature de cet e-mail sans qu'aucun test
  ne tombe.** Poser l'assertion « le digest orga ne contient aucun nom » AVANT
  d'y toucher — c'est le second temps du TDD appliqué à l'envers, et c'est le
  seul ordre qui protège.

---

## 3. RGAA

### R1 — « Le nombre entre dans le nom accessible » sans dire comment, sur un piège déjà payé 🔴

**Ce que dit B3** : le nombre entre dans le nom accessible (« À faire, 5 en
attente »). L'intention est juste ; le mécanisme manque — et c'est exactement
là que le dépôt a un précédent CHIFFRÉ *(passe autonome)*.

Un `<span class="sr-only">` accolé à un libellé s'énonce **collé**, parce que
le calcul du nom accessible concatène les nœuds sans séparateur : le registre
des erreurs porte le cas « Modifier**le** talk ». Avec la structure actuelle de
`BottomNav` (`<span aria-hidden>icône</span>` + le libellé en texte nu), la
solution évidente — ajouter un `sr-only` après le libellé — produirait
« À faire**5 en attente** ».

Et la solution inverse est pire : `aria-label="5 tâches à faire"` ne contient
plus la chaîne visible « À faire » **dans l'ordre** → échec **WCAG 2.5.3
(Label in Name)**, et la commande vocale « cliquer À faire » cesse de
fonctionner.

**Correctif à écrire dans B3** : un `aria-label` portant la phrase entière sur
le `<Link>`, le libellé visible contenu tel quel et **en tête** —
`aria-label="À faire, 5 en attente"`. Le badge chiffré reste `aria-hidden`.
À zéro : pas de badge, **pas d'`aria-label` du tout**, le nom redevient
« À faire ». Singulier géré.

**Sur le `<Suspense>`, je me corrigeais mal.** J'avais écrit que le nom
accessible changerait après le premier rendu. Vérifié : les deux layouts
enveloppent **tout** `BottomNavServeur` dans un `<Suspense fallback={null}>` —
la barre arrive donc d'un bloc, ou pas du tout. Le nom ne bouge pas
aujourd'hui. **Le danger est d'ajouter un `<Suspense>` imbriqué autour du seul
badge** pour gagner du temps de rendu : là, le nom d'un contrôle déjà
focalisable changerait sous la lectrice. À écrire dans D3 comme une
interdiction, pas comme un constat.

### R2 — Les puces s'appuient sur un mécanisme qui ne porte AUCUN état accessible 🔴 (passe autonome)

**Critère** : WCAG 1.4.1 (info par la couleur seule), RGAA 10.1 / 11.x.

D4 dit « le dépôt a déjà le mécanisme » et renvoie à `src/lib/vue-liste.ts`.
Vérifié : ce module est un **contrat d'URL et rien d'autre** — trois champs de
texte et deux fonctions pures. `BandeauVue.tsx` est un `div` + `p` + un lien de
retour : **zéro `role`, zéro `aria-current`, zéro `aria-live`**. Et côté puces,
il n'existe **rien** dans le produit : les deux pages qui consomment `cleVue`
n'affichent qu'un bandeau. `ChipGroup` n'est pas candidat non plus (R7).

Les puces de D4 sont donc un **contrôle NEUF**, et la conception ne spécifie ni
son élément, ni son marquage d'état. Rien ne distingue « Tout » de « Pour
l'association » autrement que par la couleur.

**Correctif** :
- les puces sont des **liens** (`<a href="?vue=…">`) — ce qui satisfait au
  passage le test « filtrable sans JS » du §5 ;
- la puce active porte **`aria-current="page"`**.

> **Je m'étais trompé ici**, et la correction est instructive. J'avais écrit
> `true`, par réflexe après #332. Mais la règle qu'on vient d'écrire dit
> `page` **quand le lien mène à la page affichée** — et le `href` d'une puce
> active EST l'URL courante, requête comprise. `true` est la valeur d'un
> onglet-repli, pas d'un filtre. Corollaire : le `href` de « Tout » est
> `/mon-espace/a-faire` **sans paramètre**, sinon l'identité ne colle plus.

- l'état est doublé **autrement que par la couleur** : puce active en **aplat
  plein**, puces au repos en contour. Plein/contour est une différence de
  forme, pas de teinte.

### R3 — Le contour d'une puce au repos tombe à 2,13:1 si on reprend les tokens existants 🔴 (passe autonome)

**Critère** : WCAG 1.4.11 (contraste des éléments non textuels, ≥ 3:1) — et la
règle §9 déjà écrite : « tout contour de champ, toggle ou bouton fantôme doit
atteindre ≥ 3:1 ».

Calcul sur `globals.css` : `border-cyan/30` — le contour de `ChipGroup` et de
`BandeauVue` — donne `#2D5174` sur `navy`, soit **2,13:1**. Sur un bandeau
décoratif, sans conséquence. Sur une **puce interactive**, le contour est la
frontière du contrôle : 1.4.11 s'applique, et le seuil est manqué de moitié.

Au soleil ou en basse vision, la rangée se lit comme du texte flottant — on ne
voit pas qu'il y a quatre commandes.

**Correctif** : `cyan/50` (3,81:1) au minimum, ou un fond distinct. `tokens.json`
est muet sur les contours (dette déjà consignée) : l'occasion d'y poser le token.

### R4 — Vue filtrée + puces absentes = impasse, et la redirection 308 y mène 🔴 (passe autonome)

Trois règles de la conception se contredisent une fois composées :

- D4 : `?vue=association` est lu depuis l'URL ;
- §4.2 / P4 : les puces **ne s'affichent pas** si la personne n'a qu'une famille ;
- D5 : `/admin/taches` redirige en 308 vers `/mon-espace/a-faire?vue=association`.

Une personne qui n'est **plus** orga — ou qui suit un lien d'e-mail déjà
envoyé, ce que le §6 risque 3 revendique explicitement — atterrit sur une vue
filtrée **dont aucune puce n'est affichée**. Aucun contrôle visible ne ramène à
« Tout » : la seule sortie est de retoucher l'URL à la main. Même piège pour
une orga qui partage son lien à une membre.

**Correctif, deux verrous** :

1. la liste des clés permises passée à `cleVue` est **dérivée des capacités
   réelles**, pas figée à la page : une clé qu'on n'a pas le droit de voir
   donne `null`, donc « Tout ». C'est le D2 appliqué à la vue (et c'est aussi
   le correctif de S5, par un autre chemin) ;
2. **dès qu'une vue est active, un retour visible vers « Tout »** — c'est
   précisément ce que `BandeauVue` existe pour faire, et le seul morceau de
   `vue-liste` qui vaut d'être réutilisé ici. Avec sa condition (puces absentes
   → bandeau présent), sinon les deux se doublonnent quand les puces sont là :
   deux commandes, deux libellés, une destination — ce que le registre interdit.

Note clavier : chaque puce est une navigation complète, donc le focus repart en
tête de document. Placer la rangée **immédiatement avant** la liste limite les
tabulations à repayer à chaque filtre.

### R5 — Le compteur dans le `h1` est déjà condamné par le dépôt, et il mentira 🔴 (les deux passes autonomes)

**Critère** : la règle maison « un titre nomme l'endroit, rien d'autre »,
écrite le 2026-08-16 après le cas de la pastille « Privé » dans le `h1`.

La maquette §3.4 écrit `À faire (5)` en titre — et **c'est déjà le code
livré** : `src/app/admin/taches/page.tsx:32` passe
``title={taches.length > 0 ? `À faire (${taches.length})` : "À faire"}`` à
`ListPageTemplate`, qui le rend en `h1`. La conception reconduit donc telle
quelle la forme qu'on a fait retirer d'un autre `h1` la veille.

Deux conséquences distinctes :

- **le nom du repère de page bouge tout seul** : la même page s'appelle « À
  faire (5) » puis « À faire (4) ». Qui navigue par titres n'a plus de nom
  stable ;
- **deux nombres contradictoires** dès qu'une puce est active : le badge de
  l'onglet compte toujours « Tout » (P4, à raison), pendant que le `h1`
  compterait la vue filtrée. « À faire (2) » sous un onglet qui affiche 5, sans
  un mot pour l'expliquer.

**Correctif** : `h1` = « À faire », point. Le compte vit **à côté** — dans le
`meta` de `ListPageTemplate` ou dans le bandeau — et il dit lequel il compte
(« 5 en attente, dont 2 pour l'association »).

**C'est un défaut LIVRÉ, pas seulement de conception** : il se corrige tout de
suite sur `/admin/taches`, indépendamment de l'étape B.

### R6 — Le badge en absolu doit rester DANS la boîte de l'onglet 🟠 (passe autonome)

Réponse à la question que je posais : non, un enfant en position absolue ne
sort **pas** de la zone cliquable — il reste descendant du `<Link>`. Mais il
sort de la **hauteur déclarée de la barre**, et c'est ça qui coûte.

`--hauteur-onglets` (`globals.css:163`) est la **source unique** de trois
choses : le dégagement du pied, le `scroll-padding-bottom` (WCAG 2.4.11) et le
`bottom` de `.barre-action-collante`, posée bord à bord avec la barre. Un badge
en `-top-1` déborde donc au-dessus de cette réserve, avec `z-40` contre `z-10` :
il se peint **par-dessus le bouton « Enregistrer »** d'un formulaire long.
C'est mot pour mot la collision que le registre documente (32 px sur 44
recouverts, `elementFromPoint` renvoyant l'onglet voisin).

**Correctif** : le badge se positionne **à l'intérieur** du `min-h-14` — il y a
la place — sans décalage négatif franchissant le bord supérieur du `<nav>`. Et
sa taille reste **≥ `text-xs`** : `typographie-lisible.test.ts` gèle 12 px comme
plancher, `BottomNav.tsx` n'est pas dans la liste, la CI tomberait.

### R7 — Cibles tactiles : ce qui s'applique vraiment 🟡 (passe autonome)

Les exceptions vérifiées **avant** de conclure, vu le précédent des « 44 cibles
tactiles » dont zéro n'était non conforme :

- exception « lien en ligne dans une phrase » : **ne s'applique pas**, une
  rangée de puces n'est pas de la prose ;
- exception « espacement » (cercle de 24 px sans intersection) : **ne
  s'applique pas** si les puces gardent le `gap-2` de `ChipGroup` ;
- minimum intrinsèque : avec `text-xs px-3 py-1` + bordure, la hauteur calculée
  est de **~26 px**. **WCAG 2.5.8 passe**, de justesse. Il n'y a donc **aucune
  non-conformité AA à annoncer**.

En revanche c'est sous le **plancher de 44 px que le dépôt s'est donné**, et le
produit sait déjà y répondre sans perdre de densité : `BandeauVue.tsx:30` fait
exactement ça (`min-h-[44px] py-3 -my-3`, commentaire à l'appui). C'est le
patron à reprendre.

### R8 — Le plan de titres et les repères de la page ne sont spécifiés nulle part 🟠 (passe autonome)

Ni D5 ni §3 ne disent quoi que ce soit de la structure de
`/mon-espace/a-faire`. Quatre points à trancher avant de coder, sous peine de
refaire des erreurs déjà payées :

- **un seul `h1`, et pas de `<main>` de page** — `ListPageTemplate` rend
  délibérément un `<div>`, le layout racine portant `#main-content` ; une règle
  ESLint le tient. Réutiliser le gabarit règle la question ;
- **la rangée de puces n'est PAS un `<nav>`** : un second repère de navigation
  sur un écran qui en porte déjà encombre la liste qui sert à sauter. Un `<ul>`
  de liens, nommé par `aria-label="Filtrer"`, suffit ;
- **la liste porte le nom de la vue active** (`aria-label="Tâches — pour
  l'association"`) : seule façon, pour qui saute de liste en liste, de savoir
  sur quel sous-ensemble il est tombé ;
- **pas de fil d'Ariane** : la page devient une destination d'onglet, elle n'a
  plus de parent. `admin/taches` en rend un aujourd'hui, il part avec la route.

### R9 — Trois pièges de réutilisation 🟡 (passe autonome)

- **`ChipGroup` n'est pas réutilisable** : ce sont des `<span>` décoratifs, sans
  `href`, sans `focus-visible`, sans état. Et son `label` porte la typographie
  condamnée — le fichier est **dans la liste gelée** de
  `typographie-lisible.test.ts`. L'étendre pour les filtres rouvrirait une
  entrée que le cliquet ne peut que faire raccourcir. Composant neuf.
- **B4 est faux de deux côtés.** L'onglet 5 est une **photo** (`Avatar`,
  `aria-hidden`, nom porté par le libellé visible) : la remplacer par un SVG
  casserait le patron et contredit la maquette 3.2, qui montre toujours `(CP)`.
  Et le ➕ n'est pas dans `BottomNav` : c'est un `<button>` de `FeuilleCreer`,
  qui partage seulement la classe `ONGLET_BARRE`. Formuler : **trois icônes de
  lien + le déclencheur ➕**, l'avatar inchangé, les SVG `aria-hidden`.
- **L'état vide de §3.5 ne peut pas tenir sa promesse** : « le vide renvoie
  vers le fil » suppose un LIEN, or `ListeTaches` type son vide en
  `vide: string`, rendu en `<p>` — aucun focalisable possible. À trancher :
  soit c'est de la prose et on l'assume (la porte vers l'Accueil est l'onglet
  1), soit la prop change de type, avec sa cible ≥ 44 px.

### R10 — La porte axe n'auditerait plus la page 🟠 (passe autonome)

`e2e/pages-publiques.ts` liste `/admin/taches` dans `PAGES_ORGA`. Après le 308
de D5, cette entrée auditerait en réalité `/mon-espace/a-faire?vue=association`
— Playwright suit la redirection et le `expect(status).toBe(200)` passe. Donc :
un doublon déguisé, et **`/mon-espace/a-faire` en vue « Tout » ne serait
auditée par personne**.

C'est la seule porte qui évalue le contraste réel, `target-size` avec ses
exceptions, et les repères — donc R3, R7 et R8 s'y jugent. À ajouter à
`PAGES_MEMBRE`, et décider du sort de `/admin/taches` (le garder pour tester la
redirection, ou le retirer).

## 4. Accessibilité cognitive

### C1 — Le compteur ne retombera jamais à zéro pour une orga 🔴

C'est le constat le plus lourd, et il oppose la conception à **sa propre
règle** :

> « Une liste doit pouvoir finir. Un compteur qui ne retombe jamais à zéro
> devient un reproche permanent : culpabilité côté TDAH, règle qu'on ne peut
> pas refermer côté TSA. » — `docs/principes-conception-ui.md`, checklist COGA

Or le moteur dérive, pour une édition active, des tâches qui ne se referment
pas au rythme d'une personne : photos dont l'accord reste à recueillir,
participantes à relier, ateliers à dater, présences à pointer, fiches en
sommeil à relancer. Sur **deux** éditions actives, la liste est structurellement
non vide. Un badge permanent « 12 » sur la barre, à chaque page, à chaque
visite.

**Le relecteur autonome a fait le travail que je n'avais pas fait** : passer
chaque règle du moteur au test « *un geste de la personne qui voit la ligne
la referme-t-il aujourd'hui ?* ». Trois échouent, et la troisième est franchement
mauvaise :

| Règle | Pourquoi elle ne se referme pas | Source |
|---|---|---|
| « Ouvrir au public l'édition « X » » | une édition se prépare pendant des MOIS ; le code le dit lui-même (« c'est l'orga qui décide du bon moment ») | `taches-orga.ts:232-243` |
| « Relier X à un compte » | le geste de l'orga (inviter) ne referme rien : l'inscription se relie **à la première connexion de la participante**. Si elle ne vient jamais, la ligne est éternelle | `:341-354` |
| « Recueillir l'accord pour N photos » | `photoPubliable` exige que TOUS les tags soient couverts, et pour une inscrite `couverte = registration.public`, **son consentement à elle**. Si elle a dit NON, l'app réclame indéfiniment à l'orga un accord déjà refusé | `:355-361` |

Et une quatrième cause, structurelle : une édition reste dans le moteur tant
qu'elle n'est pas `archive` (`chargerTachesOrga:120`). Une édition **close**
continue donc de produire des photos, des comptes, des récompenses. Le code
sait pourtant déjà faire l'inverse — `presencesPerimees` retire les présences
après la finale — la règle n'a simplement pas été étendue.

La conception ne pose jamais la question. Elle doit la poser, et trois sorties
existent :

| Sortie | Ce que ça donne | Coût |
|---|---|---|
| **(a) Le badge ne compte que l'ÉCHU** | le nombre est « ce qui est en retard », et il retombe vraiment à zéro | le moteur trie déjà par échéance ; la vue reste complète |
| (b) Un geste « plus tard » | la liste se referme à la main | un état par personne et par tâche → **une table** (voir G4) |
| (c) Pas de badge pour la famille association | l'onglet reste muet pour l'orga | annule le bénéfice principal de l'audit (C3) |

**Recommandation : (a).** Elle tient la règle, ne crée aucun traitement de
données, et dit quelque chose de plus utile qu'un total : le total mesure la
charge, l'échu mesure l'urgence. La liste, elle, reste complète — c'est le
COMPTEUR qui se restreint, pas la vue, et c'est exactement la nuance que le
principe autorise (« un compteur compte toujours la vue complète » vise le
mensonge par filtre, pas le choix d'une définition dite en toutes lettres).

**Révisé après la passe autonome** : « l'échu » était une approximation. Le
bon critère n'est pas la date, c'est **qui peut refermer la ligne**. Une tâche
entre dans le décompte si un geste de la personne qui la voit la referme ;
sinon elle reste dans la liste (elle est vraie, elle informe) mais le compteur
l'ignore. Les trois règles du tableau ci-dessus en sortent, et l'édition
`clos` retombe comme `presencesPerimees` le fait déjà.

Deux conséquences pour D3 :

1. l'invariant devient `compterTaches(c) === deriverTaches(chargerTaches(c)).filter(refermableParSoi).length` ;
2. **et il ne suffit pas.** L'invariant ne garde que la cohérence entre deux
   chemins. Il faut EN PLUS un test qui dit : *il existe un état de la base où
   le compte vaut zéro pour une orga à deux éditions actives*. Sans lui, la
   règle « une liste doit pouvoir finir » n'est gardée nulle part — et c'est
   exactement le genre de règle qu'on croit tenir parce qu'on l'a écrite.

### C2 — La boîte aux lettres d'une membre perd sa seule porte 🔴

Vérifié dans le code : `/mon-espace/messages` **n'est atteignable que depuis
l'onglet de la barre** (`src/components/BottomNav.tsx:56` — c'est la seule
occurrence dans tout `src/`, hors la page elle-même et un lien dans un
e-mail).

L'étape B remplace cet onglet. La conception dit qu'« un message devient une
ligne parmi d'autres » — mais une ligne « Répondre à Nawel » n'existe que
**tant qu'il y a quelque chose à traiter**. Le jour où elle a répondu, la
ligne disparaît, et avec elle le dernier chemin vers ses messages **lus**.

Ce n'est pas une gêne d'accessibilité cognitive, c'est une fonctionnalité qui
disparaît — et pour ces publics c'est le pire cas : quelque chose qui était
toujours au même endroit n'y est plus, sans que rien ne dise où c'est parti.

**Correctif obligatoire avant de coder** : une porte permanente vers
`/mon-espace/messages`. La place naturelle est le **profil**, dans le groupe de
tête (celui de « Ma fiche publique » et « Mes articles ») — une rangée
« Mes messages », affichée dès qu'il y en a eu au moins un. L'état vide de
« À faire » peut y renvoyer en plus, mais un état vide n'est pas une
navigation.

Côté organisatrices, le problème ne se pose pas : `/admin/messages` est une
rangée du menu de `/admin`, qui reste.

**Et il y a un second défaut, qui interdit la sortie facile** *(passe
autonome)*. `getTransmittedMessagesForProfile` sélectionne `status =
'transmis'`, et `setContactMessageStatus` ne fait que passer `en_attente` →
transmis/rejeté : **il n'existe aucun état « lu » ni « répondu »**. Sur
`/mon-espace/messages`, répondre est un `mailto:` — la réponse quitte le
produit, rien ne la trace. Une ligne « Répondre à X » dérivée de cette source
est donc **perpétuelle, pour toute membre** : une speakeuse qui reçoit trois
messages sa première année porte un « 3 » à vie (et C1 revient par la porte du
fond, cette fois pour tout le monde, pas seulement pour les orgas).

Les deux défauts s'annulent d'une façon qui n'est PAS une solution : rendre la
ligne refermable rend l'archive des messages inatteignable ; la laisser
perpétuelle bloque le compteur. **Il faut traiter les deux.** D'où l'ordre de
livraison : la rangée « Mes messages » du profil part **avant** que l'onglet
change, jamais après.

### C3 — Trois grammaires pour quatre puces 🟠

Les libellés de 3.4 : **« Tout »**, **« Pour moi »**, **« Pour
l'association »**, **« Mes coachées »**. C'est un adjectif indéfini, deux
locutions prépositionnelles et un possessif — sur quatre contrôles voisins,
lus d'affilée.

La conception a pourtant écrit la règle deux pages plus haut (§4.0) : « une
étiquette est Mon / Ma / Mes + un nom courant », et elle vient d'être payée une
fois (« Tes coachées » vs « Mes coachées », #332).

**La passe autonome tranche mieux que moi.** Ma proposition
(`Tout · Mes tâches · Mon bénévolat · Mes coachées`) alignait les possessifs,
mais « Mes tâches » est ambigu : *toutes* le sont. Le relecteur note que les
quatre puces répondent à une seule question — **pour qui est-ce ?** — et que
l'axe du bénéficiaire donne une parallèle parfaite :

> **`Tout · Pour moi · Pour l'association · Pour mes coachées`**

Une seule grammaire, lisible d'un coup d'œil, et « Tout » reste hors patron
parce qu'il est l'absence de filtre.

Il relève au passage un troisième mot que j'avais laissé passer : **le fil de
fer §3.4 étiquette les lignes « Association » et « Pour moi »**, alors que §4.2
promet « les mêmes mots servent d'étiquette sur chaque ligne » et que la
maquette HTML écrit « Pour l'association ». Qui code depuis §3.4 écrira un
troisième libellé. **§3.4 est la source dans laquelle on codera : c'est elle
qu'il faut corriger.**

### C4 — Deux noms pour le même ensemble, à un tap de distance 🟠

Le profil dit **« Mon bénévolat »** (livré en #323). La puce dit **« Pour
l'association »**. C'est le même ensemble de choses, nommé de deux façons sur
deux écrans reliés par un lien — exactement le défaut corrigé la veille entre
la rangée « Mes coachées » et le titre « Tes coachées ».

Mon premier correctif — « Mon bénévolat » des deux côtés — ne tient pas une
fois C3 tranché sur l'axe du bénéficiaire. Et §4.1 interdit d'avance
« Mon association » (le possessif serait faux) : les deux mots **ne peuvent pas
converger** sans décision.

**La décision, à écrire dans §4.1** : le profil et la liste ne répondent pas à
la même question. Le profil nomme **ce que je donne de moi** — « Mon
bénévolat », un possessif vrai, qui groupe des *pages*. La liste nomme **pour
qui la tâche est faite** — « Pour l'association », qui filtre des *tâches*. Ce
n'est pas deux mots pour un concept, c'est deux concepts voisins ; mais tant
que ce n'est pas écrit, personne ne peut le deviner, et ça se lit comme
l'incohérence « Tes coachées » / « Mes coachées » de la veille.

**Réversible** : si tu préfères un seul mot, l'axe possessif tient aussi
(`Tout · Pour moi` devient `Tout · Mes tâches`), au prix de l'ambiguïté de
« Mes tâches ». Une phrase à changer dans la conception, rien de plus.

### C6 — Une étiquette de famille sur chaque ligne, alors qu'il n'y en a qu'une 🟡 (passe autonome)

P4 fait disparaître les puces quand il n'y a qu'une famille. La même logique
n'a pas été appliquée aux **étiquettes de ligne** : pour une speakeuse simple,
chaque ligne dirait « Pour moi » — un mot qui ne distingue rien et double la
lecture. Idem par construction dans une vue filtrée.

**Correctif** : l'étiquette de famille apparaît à la même condition que les
puces (≥ 2 familles), et jamais dans une vue filtrée. Et vérifier sur téléphone
la ligne à deux concepts du fil de fer (« Pour l'association · Tremplin 2026 »)
avant de la figer — `ListeTaches` ne rend aujourd'hui que le contexte.

### C7 — Le mot de l'écran ne descend pas dans le code : `famille: "perso"` 🟠 (passe autonome)

La règle est explicite : « un seul mot par concept, partout… **de l'écran au
code** » — précédent « marche » → « étape », où le module lui-même a été
renommé.

D1 propose `famille: "perso" | "association" | "coach"` et D4 `?vue=perso`.
**« perso » est exactement la troncature que V1 condamne** dans les puces, et
`?vue=perso` est **visible dans la barre d'adresse** et dans tout lien partagé.

Et rien ne l'attrapera : `mots-entiers.test.ts` ne couvre que « orga » et
« asso », et son filtre `estDeLaProse` ne juge que les chaînes contenant une
espace. Le test le dit lui-même : « une étiquette d'un seul mot passe entre les
mailles ». Le relecteur me cite ma propre limite documentée.

**Correctif** : `"personnel" | "association" | "accompagnement"`,
`?vue=personnel`. Et si les puces disent « Pour mes coachées », la clé dit
`coachees`, pas `coach` — V6 a déjà tranché qu'accompagner et coacher sont une
seule chose.

### C8 — Trois détails de copie 🟡 (passe autonome)

- **§3.4 tronque la phrase d'aide** : « La liste se met à jour toute seule. »
  La page livrée dit « …toute seule **: une tâche disparaît quand c'est
  fait.** » C'est la seconde moitié qui répond à « pourquoi ma ligne a
  disparu ? », la question d'une lectrice littérale. Garder la phrase entière.
- **Deux états vides pour un état** : §3.5 dit « Rien en attente. Tout
  roule. », `/admin/taches` dit « Rien à faire pour l'instant. Tout roule. »
  En choisir un. Et noter que le nom accessible proposé pour l'onglet
  (« À faire, 5 **en attente** ») introduit un troisième mot pour le concept
  que « À faire » nomme déjà.
- **§2 et §4.2 écrivent « l'asso » dans la prose du document qui interdit le
  mot.** Sans conséquence produit — sauf que §4.2 est la source depuis laquelle
  on codera les puces, et que la leçon de §6 était précisément « une règle
  nouvelle se repasse sur le document qui l'a produite ».

### C5 — « À faire » et « Ta prochaine étape » se ressemblent 🟡

Le profil porte une carte **« Ta prochaine étape »** (une action, dérivée). La
barre porte **« À faire »** (des actions, dérivées). Deux surfaces, deux mots,
un même concept apparent : « la chose que je dois faire ».

Ce n'est pas rédhibitoire — l'étape est *une* suggestion d'avancement, la liste
est *tout* ce qui attend — mais la distinction n'est écrite nulle part, et elle
ne se devine pas.

**Correctif** : la trancher dans la conception, en une phrase opposable. Ma
proposition : **l'étape suggère, la liste réclame.** Corollaire vérifiable — ce
qui apparaît dans « Ta prochaine étape » ne doit **jamais** apparaître aussi
dans « À faire », sinon la même chose est demandée deux fois sur deux écrans.
C'est testable, et ça mérite un test.

---

## 5. Ce qui tient (à ne pas casser en corrigeant)

- **D1, le moteur pur et les trois familles.** Zéro accès base, testable sans
  Postgres : c'est ce qui rend une famille peu coûteuse à ajouter, et c'est
  aussi ce qui rend G4 (rien de stocké) tenable.
- **D3, deux chemins et un invariant testé.** La décision d'autoriser un
  chemin rapide *à condition* qu'un test le colle au moteur est exactement la
  bonne forme. Seule sa formule change si C1(a) est retenue.
- **D2, la capacité borne le chargement.** Bonne intuition, à durcir (S1), pas
  à remplacer.
- **La redirection 308 plutôt qu'une suppression sèche** (D5, risque 3) : les
  liens des e-mails déjà partis survivent.
- **Le refus de masquer en CSS** (A4) : le registre des erreurs est appliqué.
- **La famille `coach` assumée vide** (B1) : une structure qui accepte le vide
  sans mentir vaut mieux qu'une famille inventée.

## 6. Tranché en autonomie, la nuit du 2026-08-16 (réversible)

Cateline dormait et avait demandé qu'on avance. Ces cinq réponses sont donc les
**miennes**, prises sur les recommandations des relecteurs. Chacune tient en une
phrase de la conception : en renverser une n'en défait aucune autre.

| # | Question | Décision prise | Pourquoi |
|---|---|---|---|
| **Q1** | Le badge compte quoi ? | **Ce qu'un geste de la personne referme.** Pas « tout », pas « l'échu » | Seule sortie qui tienne « une liste doit pouvoir finir » **sans créer de table** — donc sans créer une durée de conservation, un droit d'effacement et une purge (G4). Trois règles en sortent, dont « recueillir l'accord » qui réclamait indéfiniment un consentement déjà refusé |
| **Q2** | La porte vers les messages ? | Une rangée **« Mes messages »** dans le groupe de tête du profil, **livrée AVANT** que l'onglet change | C'est aujourd'hui la seule porte du produit, et une tâche « Répondre à X » est perpétuelle (aucun état « lu ») : il faut traiter les deux, dans cet ordre |
| **Q3** | L'e-mail quotidien ? | **Comptes par règle + lien.** Aucun nom | Il lit bien le même moteur (l'objectif produit est tenu), sans faire d'une boîte Gmail publique un entrepôt que la suppression d'un compte n'atteint pas |
| **Q4** | Les puces ? | **`Tout · Pour moi · Pour l'association · Pour mes coachées`** | Une seule grammaire, un seul axe : « pour qui ? ». La divergence avec « Mon bénévolat » est assumée et **écrite** en §4.1 (le profil groupe des pages, la liste filtre des tâches) |
| **Q5** | Étape vs liste ? | **L'étape suggère, la liste réclame** — et rien n'apparaît dans les deux | Testable, donc opposable |

**Ce qui n'est pas un arbitrage et se corrige, point** : tous les constats de
sécurité (§1), de RGPD (§2) et de RGAA (§3), plus C1, C2, C6, C7 et C8. Ils ne
demandent aucun choix produit.

**Le seul point que je laisse ouvert** : R9 sur l'état vide — « le vide renvoie
vers le fil » suppose un lien, et `ListeTaches` type son vide en `string`. Soit
c'est de la prose et on l'assume (la porte vers l'Accueil est l'onglet 1), soit
la prop change de type. Je prends **la prose** pour ne pas élargir le lot, et
je le signale : c'est une phrase à changer si tu veux le lien.

## 7. Ce que la conception technique doit changer avant la première ligne de code

**Sécurité et RGPD**

1. **D2 devient une garde, pas un paramètre** : `chargerTaches` et
   `compterTaches` lisent la session elles-mêmes ; aucun appelant ne passe de
   capacité (S1). Le cron passe par une porte nommée
   `chargerTachesAssociation()`, gardée par `CRON_SECRET` (S2 bis).
2. **`profileId` sort de la signature** — le loader le dérive de `userId` (S3).
3. **La famille coach porte `coachId`, jamais `estCoach`**, et son chargement
   est **borné en SQL** par les liaisons coach ↔ cible, comme l'espace coach le
   fait déjà (S4).
4. **`?vue=` est intersecté avec les capacités** ; une vue non permise retombe
   silencieusement sur « Tout » (S5, R4).
5. **Aucun cache au-delà de la requête** pour `compterTaches` ; la route reprend
   `robots: { index: false }` et `dynamic = "force-dynamic"` (S6).
6. **B2 est réécrit** : la famille `association` transporte des NOMS, le `href`
   **est** un identifiant de personne, et `ListeTaches` reste un composant
   serveur — le DTO le plus sûr est l'absence de DTO (G1, G4).
7. **§4 (étape C) est réécrit** : même moteur, sortie **agrégée**, jamais de
   personne sans compte dans un libellé sortant (G3, G5).

**Accessibilité**

8. **Le compteur** : `aria-label` portant la phrase entière sur le `<Link>`,
   libellé visible en tête, badge `aria-hidden`, rien du tout à zéro. Et
   **interdiction** d'un `<Suspense>` imbriqué autour du seul badge (R1).
9. **Les puces** sont un composant NEUF : des liens, `aria-current="page"` sur
   l'active, `href` de « Tout » sans paramètre, contour ≥ 3:1 (`cyan/50`),
   cible ≥ 44 px sur le patron de `BandeauVue`, aplat plein vs contour pour ne
   pas dépendre de la teinte (R2, R3, R7).
10. **Le `h1` ne porte plus le compte** — y compris sur `/admin/taches`
    aujourd'hui, où c'est un défaut **livré** (R5).
11. **Le badge reste dans la boîte de l'onglet**, sans décalage négatif
    franchissant le bord du `<nav>` : `--hauteur-onglets` est la source unique
    du dégagement du pied, du `scroll-padding-bottom` et de la barre d'action
    collante (R6).
12. **La structure de la page est spécifiée** : un `h1`, pas de `<main>`, les
    puces dans un `<ul aria-label="Filtrer">` et **pas** un `<nav>`, la liste
    nommée par la vue active, aucun fil d'Ariane (R8).
13. **`ChipGroup` n'est pas étendu** (il est dans la liste gelée du cliquet
    typographique), et B4 est reformulé : trois icônes de lien + le ➕,
    l'avatar inchangé (R9).
14. **`/mon-espace/a-faire` entre dans `PAGES_MEMBRE`** de la porte axe, sinon
    la vue « Tout » n'est auditée par personne (R10).

**Wording et code**

15. **`famille` et `?vue=` disent des mots entiers** : `"personnel" |
    "association" | "accompagnement"` (C7).
16. **§3.4 est corrigé** — c'est la source dans laquelle on codera : mêmes mots
    sur les puces et sur les lignes, phrase d'aide entière, un seul état vide
    (C3, C8).
17. **Une rangée « Mes messages »** entre dans §2 A1, avec sa condition, et
    part **avant** le changement d'onglet (C2).

**Tests (§5 en gagne cinq, chacune avec sa mutation)**

18. « une coach ne voit que ses ateliers » — on élargit le `WHERE`, le test
    tombe (S4).
19. « le compteur ne compte que ce que la personne a le droit de lire » (S2).
20. « **il existe un état de la base où le compte vaut zéro** pour une orga à
    deux éditions actives » — sans lui, la règle « une liste doit pouvoir
    finir » n'est gardée nulle part (C1).
21. « le digest orga ne contient aucun nom », posée **avant** de toucher à
    l'étape C (G7).
22. « un libellé de tâche ne contient jamais de `@` » — `registrationLabel`
    retombe sur l'e-mail si un filtre s'élargit un jour (G7).
