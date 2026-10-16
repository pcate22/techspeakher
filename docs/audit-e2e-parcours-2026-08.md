# Audit des tests E2E — couverture des parcours d'utilisation

> Août 2026. Périmètre : toute la plate-forme (public, espace membre, espace orga).
> Objet : **ce que la suite E2E ne garde pas**. Ce n'est pas un audit de qualité
> des tests existants — ils sont bons — mais un relevé de ce qui peut casser en
> prod sans qu'aucun test ne tombe.
>
> Tout ce qui est chiffré ici a été **mesuré** sur ce dépôt (suite jouée, app
> construite et interrogée), jamais déduit de la lecture seule.

---

## 1. Résumé

La suite E2E est **saine, rapide et bien pensée** : 151 tests verts en 1 min 12 s,
des garde-fous que peu de projets ont (axe en vrai navigateur, débordement
horizontal, mots collés au rendu, concurrence). Rien à y retirer.

Mais elle ne teste **qu'un seul parcours** : *une visiteuse anonyme ouvre une
page publique vide*. Tout le reste de la plate-forme — l'annuaire peuplé,
l'espace membre, l'espace orga, la totalité des écritures — est hors de portée,
parce que la CI E2E tourne **sans base de données et sans session**.

En chiffres :

| Mesure | Valeur |
|---|---|
| Surfaces de l'app | **117** (108 pages + 9 routes API) |
| Surfaces atteintes en E2E | **15** (~13 %) |
| Pages `/mon-espace` atteintes | **0 / 23** |
| Pages `/admin` atteintes | **0 / 60** |
| Server Actions exécutées en E2E | **0 / 106** |
| Routes API appelées en E2E | **0 / 9** |
| Parcours comportant une **écriture** couverts | **0** |

Et un constat plus gênant que les trous eux-mêmes : **le seul test de sécurité
d'accès de la suite ne peut pas échouer** (§3.1, démontré expérimentalement).

> **Où en est-on (2026-08-09).** Les chiffres ci-dessus sont l'état AU MOMENT DE
> L'AUDIT ; ils restent la référence de départ.
>
> | Lot | État | Suite |
> |---|---|---|
> | Départ | — | 151 verts |
> | §5.1 — ce qui était jouable sans infra | ✅ livré | **196 verts** |
> | §5.2 — session | ✅ livré (un fichier, zéro code de prod) | — |
> | §5.2 — **décor de données** | ✅ **livré** | **224 verts** |
> | §5.3 — espaces connectés (smoke + portes) | ✅ **livré** | **286 verts** |
> | §5.7 — premières écritures (RGPD, parcours central) | ✅ livré | — |
> | §5.8 — **pilotage du Tremplin** (3 parcours d'orga) | ✅ **livré** | **298 verts** |
> | §5.9 — les **deux autres publications** du Tremplin (accompagnante, palmarès) | ✅ **livré** | **302 verts** |
>
> **151 → 302 tests verts**, en ~1 min 50 s. Les 83 pages connectées ne sont
> plus « intestables » : les portes RGAA et débordement les traversent, et
> l'espace orga — la surface la plus dense du produit — est audité pour la
> première fois. Les écritures sont ouvertes, et le pilotage du Tremplin — 54
> actions, la moitié du total — est traversé par ses cinq chemins les plus
> coûteux (§5.8, §5.9).

---

## 2. Méthode et mesures

- Suite jouée intégralement : `164` tests déclarés (82 × 2 projets `chromium` /
  `mobile`), **151 passés, 13 ignorés** (`mots-colles` se saute hors chromium),
  **1 min 12 s**.
- App construite (`npm run build`, vert) puis interrogée route par route, dans
  **la configuration exacte de la CI** : ni `DATABASE_URL`, ni `AUTH_SECRET`, ni
  `BREVO_API_KEY` (le job `e2e` de `ci.yml` n'a aucun bloc `env:`).
- Inventaire des surfaces par `find src/app -name page.tsx / route.ts`, des
  écritures par les `export async function` des 15 fichiers `actions.ts`.

### Ce que la suite couvre aujourd'hui

| Spec | Ce qu'elle garde | Verdict |
|---|---|---|
| `a11y.spec.ts` | WCAG 2.0/2.1/2.2 A+AA + 5 règles de repères, 13 pages | Excellent, et il se garde lui-même (`socle.total > 50`) |
| `largeur.spec.ts` | Aucun débordement horizontal, 13 pages, coupables nommés | Excellent |
| `mots-colles.spec.ts` | Espace perdue à la compilation + nom coupé | Excellent, introuvable autrement |
| `verbatims.spec.ts` | Carrousel : défilement réel, clavier, WCAG 2.2.2 | Le seul test qui exerce une **interaction** de bout en bout |
| `navigation.spec.ts` | 10 chemins + 404 + header/footer + skip-link | Bon, mais s'arrête au chargement |
| `actualites.spec.ts` | Filtres (`aria-pressed`), région de statut | Bon, sur une liste **vide** |
| `contact.spec.ts` | Validation client, `aria-invalid`, bandeau d'erreur | Bon, mais **jamais d'envoi** |
| `speakeuses.spec.ts` | Titre + région de liste | Coquille seule |
| `concurrence.spec.ts` | 20 requêtes simultanées, 5 pages | Bon, mais lectures seulement |
| `auth.spec.ts` | Redirections anonymes | **Ne peut pas échouer** — cf. §3.1 |

---

## 3. Trois angles morts — « silence ≠ succès »

Le dépôt connaît déjà ce piège et s'en protège explicitement dans `a11y.spec.ts`
(« une passe qui n'évalue presque rien passerait au vert sans rien garder »).
Trois endroits y sont encore exposés.

### 3.1 Le test des gardes d'accès ne peut pas échouer — **démontré**

`docs/dette-technique.md` §1.2 classe « zéro E2E sur les gardes d'accès » comme
**RÉSOLU** par `e2e/auth.spec.ts`. Ce n'est pas le cas.

En CI, `AUTH_SECRET` est absent. Auth.js échoue donc au décodage de session
(`MissingSecret`, visible dans les logs du `webServer`) : **`req.auth` est `null`
pour tout le monde, tout le temps**. Le proxy redirige alors vers `/connexion`
quelle que soit la logique de `authConfig.authorized`.

Vérifié expérimentalement : en remplaçant les deux gardes de `auth.config.ts` par
`return true` (`/admin` et `/mon-espace` ouverts à tous), en reconstruisant et en
rejouant la spec —

```
✓ /connexion se charge sans erreur
✓ /mon-espace anonyme redirige vers /connexion
✓ /admin anonyme redirige vers /connexion
3 passed
```

**Trois tests verts sur une garde d'autorisation entièrement supprimée.** Le test
mesure « l'auth est cassée dans cet environnement », pas « la garde fonctionne ».
Et le cas qui compte vraiment — **une membre connectée non-orga qui ouvre
`/admin`** (escalade de privilège) — n'est joué nulle part en vrai navigateur ;
il ne vit qu'en unitaire, sur le callback isolé (`auth-authorized.test.ts`).

> **Addendum (2026-08-09) — le test réparé a trouvé mieux qu'un test cassé.**
> J'avais conclu ici que « le défaut est dans le test, pas dans le code », en
> m'appuyant sur le fait que le callback `authorized` est bien *invoqué* par le
> proxy (`next-auth/lib/index.js:147`). Il l'est. Mais **sa réponse était
> jetée** : dans `handleAuth`, la branche `else if (userMiddlewareOrRoute)`
> court-circuite `else if (!authorized)`, et `src/proxy.ts` fournissait
> justement son propre gestionnaire. Le filtrage par rôle n'existait donc pas au
> bord. Mesuré avec une session de membre non-orga : **200 sur `/admin`,
> `/admin/speakeuses`, `/admin/messages`, `/admin/tremplins`, `/admin/reglages`**
> au lieu d'une redirection.
>
> Aucune exposition en pratique — les 60 pages admin portent chacune leur garde
> serveur, qui refoulait bien la membre. Mais la protection était **à une seule
> couche**, alors que le dépôt en avait écrit deux : une page admin ajoutée sans
> sa garde aurait été lisible par n'importe quelle personne connectée.
>
> Corrigé : la décision vit dans `refusDAcces` (`auth.config.ts`), appliquée
> explicitement par le proxy et réutilisée par le callback. Comportement visible
> inchangé (la non-orga rejoint son espace) ; c'est la couche qui l'applique qui
> change. C'est exactement ce qu'un test de câblage attrape et qu'un test
> unitaire sur le callback isolé ne peut pas voir — il jugeait une fonction dont
> personne ne lisait la réponse.

### 3.2 Les portes RGAA et débordement ne voient que l'**état vide** — ✅ corrigé

Sans base, 6 des 13 pages auditées rendent leur état vide : `/` (fil communauté,
compteur, agenda, actualités), `/speakeuses` (« L'annuaire arrive bientôt »),
`/agenda`, `/actualites`, `/conferences`, et une partie de `/devfest-toulouse`.

Conséquence : **aucune carte de speakeuse, aucune carte de talk, aucune rangée du
fil, aucune vignette vidéo n'a jamais été soumise à axe en vrai navigateur, ni au
contrôle de débordement mobile.** Or c'est exactement là que vivent le contraste,
les images, les listes, les libellés de lien — la matière première des violations
WCAG. La seule assertion de la suite qui compte des éléments de liste porte sur
les verbatims, alimentés par une donnée **statique**.

> **Corrigé le 2026-08-09.** Un Postgres éphémère en CI et le décor de
> `db/seed-preview.sql` rendent les pages pilotées par la base auditables.
> `PAGES_AVEC_DONNEES` les fait passer par les mêmes portes : la fiche d'une
> speakeuse (portrait, puces, liens externes) et la page d'édition du Tremplin
> (programme, galerie, palmarès) — **la plus dense du site public, et qui
> renvoyait 500 sans base**. Vertes du premier coup sur les deux tailles
> d'écran : le contenu réel était conforme, on le sait maintenant au lieu de
> l'espérer.

### 3.3 Le projet `mobile` rejoue des tests qui ignorent le viewport — ✅ corrigé

`concurrence.spec.ts` (fixture `request`, aucun navigateur) et `auth.spec.ts`
(redirections HTTP) étaient joués deux fois pour un signal strictement
identique. `mots-colles.spec.ts` avait raison de se sauter hors chromium ; ils
le font désormais aussi, via `testIgnore` sur le projet mobile.

Ce n'était pas qu'une économie : `contact-api.spec.ts`, écrit depuis, plafonne
volontairement le compteur anti-abus, qui vit dans la MÉMOIRE du serveur —
partagée par les deux projets. Rejoué en mobile, il trouvait le seau déjà vidé
par le passage chromium et échouait. Un test rejoué pour rien n'est pas neutre
dès qu'il touche à un état partagé.

---

## 4. Inventaire des parcours

Légende : ✅ couvert · ⚠️ partiel (coquille ou état vide seulement) · ❌ absent.

### 4.1 Visiteuse anonyme (public)

| # | Parcours | Statut | Ce qui manque |
|---|---|---|---|
| 1 | Découvrir l'asso (accueil → à propos → code de conduite) | ⚠️ | Le fil, le compteur, les cartes d'actu : jamais rendus |
| 2 | **Chercher dans le site** (la loupe du header) | ❌ | **Zéro test**, alors que c'est jouable aujourd'hui sans base (cf. §5.1) |
| 3 | Annuaire → filtrer → ouvrir une fiche → partager | ⚠️ | Liste vide ; `/speakeuses/[id]` jamais visitée ; filtres jamais joués en E2E |
| 4 | **Contacter une speakeuse** (relais modéré) | ❌ | Aucun test. Parcours le plus sensible du site : **l'e-mail ne doit jamais fuir dans le HTML** |
| 5 | Écrire à l'association (`/contact`) | ⚠️ | Validation **client** seule. Le POST vers `/api/contact` n'est jamais émis : ni la validation serveur, ni l'anti-abus, ni l'envoi (cf. encadré ci-dessous) |
| 6 | Agenda public / conférences partenaires | ⚠️ | Chargement d'une page vide |
| 7 | Lire une actualité / un article | ⚠️ | `/articles/[slug]` jamais visitée |
| 8 | Découvrir le Tremplin → édition → participantes | ❌ | `/tremplin/[conf]/[annee]` **renvoie 500 sans base** : impossible à ajouter à la porte aujourd'hui, alors qu'elle est au sitemap en priorité 0.9 |
| 9 | Se désabonner (Brevo) | ❌ | `/api/brevo/desabonnement` jamais appelée |
| 10 | Flux RSS, sitemap, robots, `llms.txt`, tokens de marque | ❌ | Tous à 200, tous hors E2E |

**`/api/contact` : la seule écriture ouverte aux anonymes, et deux tiers de ses
garde-fous sont vérifiables dès aujourd'hui.** Mesuré sans `BREVO_API_KEY` :

| Cas | Réponse mesurée | Testable en CI aujourd'hui |
|---|---|---|
| Nom vide | `400` | ✅ oui |
| Sujet hors liste (`"pirate"`) | `400` | ✅ oui |
| 6ᵉ envoi en moins d'une minute | `429` | ✅ oui |
| Envoi valide | `500` (Brevo absent) | ❌ demande un bouchon Brevo |

`contact.spec.ts` n'exerce que la validation **côté client** — celle qu'un
`curl` contourne. La validation serveur et le plafond anti-spam, eux, ne sont
gardés qu'en unitaire (`contact-api.test.ts`), jamais sur le vrai câblage HTTP.

**Pages publiques absentes des portes alors qu'elles rendent 200 sans base** —
correctif à coût nul, il suffit de les ajouter à `PAGES_PUBLIQUES` :
`/connexion/verifie`, `/connexion/deja-un-compte`. Elles échappent aujourd'hui
aux trois portes (a11y, largeur, typographie).

**Redirections jamais vérifiées** (toutes mesurées fonctionnelles, aucune gardée) :

| Chemin | Attendu | Mesuré |
|---|---|---|
| `/charte` | 301 → `/code-de-conduite` | ✅ 301 |
| `/articles` | → `/actualites` | ✅ 307 |
| `/tremplin/2026` | 308 → `/tremplin/devfest-toulouse/2026` | ✅ 308 |
| `/tremplin/participantes` | 308 → `…/2026#participantes` | ✅ 308 |
| `/mon-espace/profil/:section` | 308 → `/mon-espace/fiche/:section` | ✅ 308 |
| `/speakeuses/<id>` → slug | 307 (canonicalisation) | ⛔ 500 sans base |

Une de ces redirections qui saute, ce sont des liens d'e-mails et du
référencement perdus, en silence.

**En-têtes** : les 6 en-têtes de sécurité (dont une CSP à 11 directives) et le
`Cache-Control: no-store` des espaces privés sont posés dans `next.config.ts` et
**jamais assertés**. Mesurés présents ce jour ; une directive CSP retirée par
inadvertance (`img-src`, `frame-src`) casse un affichage sans faire tomber un test.

**Résilience** : `/[slug]` rattrape la panne base et rend un 404 propre ;
`/speakeuses/[id]` et `/articles/[slug]` la laissent remonter en **500**.

> **Tranché le 2026-08-09.** J'avais écrit « peut-être voulue » : formule
> d'évitement. Vérification faite, **une seule des trois avait choisi**, et pour
> une raison qui lui est propre — `/[slug]` capte TOUT chemin d'un seul niveau,
> donc sans filet une base muette transformerait chaque faute de frappe du site
> en 500. Les deux autres n'avaient ni `try`, ni commentaire : leur 500 n'était
> pas décidé, il restait.
>
> Il se trouve qu'il est **juste** : un 404 est une affirmation (« ceci n'existe
> pas ») qui inviterait les moteurs à désindexer une fiche réelle et publiée,
> quand un 500 dit seulement « je ne peux pas répondre là ». Bon comportement,
> raison nulle part, rien pour le garder — le risque concret étant qu'on
> « harmonise » un jour en recopiant le `catch` d'à côté.
>
> Les trois comportements sont désormais écrits à côté du code et verrouillés
> par `panne-base-pages-publiques.test.tsx`. Vérifié par mutation : ajouter le
> `catch` à la fiche fait tomber le test.

**Et la liste, elle, confondait la panne et le vide.** Le `catch` de
`/speakeuses` était muet : base injoignable et annuaire réellement vide
rendaient le même écran, donc la même phrase — « L'annuaire arrive bientôt ».
Vraie sur un site neuf, fausse en panne (l'annuaire existe, il est plein). Le
dépôt s'était déjà brûlé là-dessus : *« Constaté en prod (2026-07-23) : annuaire
vide alors que 5 fiches sont publiées »*, où le repli silencieux avait masqué la
panne avant que le cache ne la fige.

Corrigé en distinguant les deux états à la source, puis en répondant aux **deux
publics** que la page sert par deux canaux séparés :

| | Base muette | Annuaire réellement vide |
|---|---|---|
| La visiteuse lit | « L'annuaire revient dans un instant. » | « L'annuaire arrive bientôt. » |
| Les moteurs reçoivent | `noindex` | indexable |

Le `noindex` plutôt qu'un `503` est une contrainte assumée : une page App Router
ne peut renvoyer que 404 ou 307/308. Il empêche un incident d'une heure de se
graver dans l'index, sans priver la visiteuse d'une page lisible.

### 4.2 Membre connectée — **23 pages, ~28 actions, 0 test E2E**

| # | Parcours | Statut |
|---|---|---|
| 11 | Se connecter (lien magique, Google, LinkedIn) + écran « déjà un compte » | ❌ |
| 12 | Créer sa fiche par sections, suivre la complétude, la soumettre | ❌ |
| 13 | Publier / retirer sa fiche de l'annuaire | ❌ |
| 14 | Gérer ses talks, rattacher une conférence, accepter une suggestion CFP | 🟡 (conférences ✅ `parcours-talks.spec.ts`, import ✅ `parcours-import.spec.ts`, suggestion CFP ❌) |
| 15 | Écrire un article et le soumettre | ❌ |
| 16 | Agenda perso, documents, messages reçus, bravos | ❌ |
| 17 | Lier Google / LinkedIn / e-mail au même compte | ❌ |
| 18 | Réglages et notifications | ❌ |
| 19 | **Supprimer son compte** (RGPD) | ❌ |
| 20 | Participante Tremplin : inscription, ateliers, documents | ❌ |
| 21 | Coach : ses ateliers, ses missions | ❌ |

Le rendu de ces surfaces est bien couvert en composant (jsdom), et
`a11y-axe-espace.test.tsx` y passe axe sur **10 composants**. Mais jsdom
n'évalue ni le contraste, ni les repères, ni l'ordre réel du DOM — la raison
d'être de la porte E2E, telle que la spec elle-même la formule. Aucune des 60
pages `/admin` n'est dans ce scan jsdom non plus.

### 4.3 Orga — **60 pages, ~74 actions, 0 test E2E** *(au moment de l'audit)*

| # | Parcours | Statut | Note |
|---|---|---|---|
| 22 | Tableau de bord, tâches | ❌ | |
| 23 | Piloter une édition (ateliers, sous-groupes, présences, coachs, jury, finale, récompenses, photos, statut) | ⚠️ | Coachs (rattachement **et** accord de diffusion), récompenses et suppression d'édition traversés (§5.8, §5.9) ; le reste est de l'outillage interne réversible |
| 24 | Suivre une participante (parcours, classement, talk, visibilité, retrait) | ⚠️ | La **visibilité publique** et le **classement au palmarès** sont traversés de bout en bout (§5.8, §5.9) — ce sont eux qui exposent une donnée personnelle |
| 25 | **Modérer une fiche** et **modérer un message de contact** | ❌ | |
| 26 | Contenus éditoriaux et publication | ❌ | |
| 27 | Registre des conférences et éditions | ❌ | |
| 28 | Diffusion (newsletter Brevo) | ❌ | |

L'espace orga est **la surface la plus dense en tableaux et en listes longues**,
donc la plus exposée au débordement mobile — et c'est la seule que ni la porte de
largeur ni la porte axe n'atteignent.

### 4.4 Transverse

| Parcours | Statut | Note |
|---|---|---|
| Anonyme → `/connexion` | ⚠️ | Vert, mais ne peut pas échouer (§3.1) |
| Connectée non-orga → `/admin` | ❌ | Escalade de privilège, jamais jouée en navigateur |
| 404 sur segment dynamique | ❌ | Seul `/page-inexistante` est testé |
| Erreur serveur (`error.tsx`) | ❌ | Jamais rendue |
| **Sans JavaScript** | ❌ | Les Server Actions promettent l'amélioration progressive ; jamais vérifié |
| Concurrence sur les **écritures** | ❌ | Les lectures seules sont couvertes |
| a11y des pages connectées | ❌ | Dette déjà identifiée (`dette-technique.md` §résiduel) |
| Débordement mobile des pages connectées | ❌ | Non identifié jusqu'ici |

---

## 5. Priorisation

### 5.1 À faire tout de suite — sans rien changer à l'infra

> **LIVRÉ le 2026-08-09.** Les six points ci-dessous sont faits, et l'ouverture
> de session s'est révélée gratuite au passage (§5.2). Bilan mesuré : la suite
> passe de **151 à 196 tests verts**, à durée constante (~1 min 10 s), et le
> premier passage a trouvé un vrai défaut (encadré §3.1).

Ces lots ne demandent **ni base, ni session**. Ils sont jouables sur la CI
telle qu'elle est.

1. **Réparer `auth.spec.ts`.** Lui donner de quoi échouer : assertion de
   configuration (« une session est réellement décodable dans cet
   environnement ») sur le modèle du `expect(socle.total).toBeGreaterThan(50)`
   d'`a11y.spec.ts`. Tant que l'environnement ne le permet pas, **le test doit
   se déclarer ignoré plutôt que vert** — un `skip` explicite dit la vérité, un
   vert ment. Et corriger l'entrée « RÉSOLU » de `dette-technique.md`.
2. **Le parcours de recherche** (la loupe). `buildSearchList` fusionne l'index
   **statique** (`src/data/search-index`) avec les sources base
   (`site-search.ts:62`) : sans base, les sources renvoient `[]` et l'index
   statique répond quand même. Le parcours complet — ouvrir, saisir, obtenir des
   résultats, naviguer au clavier, atterrir sur la bonne page — est testable
   aujourd'hui, et n'a aucun test.
3. **Deux pages à ajouter à `PAGES_PUBLIQUES`** : `/connexion/verifie`,
   `/connexion/deja-un-compte`. Trois portes gagnées par ligne ajoutée.
4. **Les garde-fous de `/api/contact`** : validation serveur (400) et plafond
   anti-spam (429), mesurés atteignables sans Brevo. C'est la seule écriture que
   le site expose aux anonymes ; son anti-abus mérite un test sur le vrai
   câblage, pas seulement sur la fonction isolée.
5. **Redirections + en-têtes + ressources annexes** : une spec `contrat-http`
   qui fixe les 6 redirections, les en-têtes de sécurité, le `no-store` des
   espaces privés, et le 200 de `feed.xml` / `sitemap.xml` / `robots.txt` /
   `llms.txt`. Rapide à écrire (fixture `request`), et elle garde ce qui casse
   le plus discrètement.
6. **Ne plus rejouer** `concurrence.spec.ts` et `auth.spec.ts` sur le projet
   `mobile`.

### 5.2 Le socle — poser base + session en CI

C'est le déblocage. Le `docs/plateforme-conception-technique.md` §17 le prévoit
depuis le début (« provider de test gated en env de test ou mock, **étape
ultérieure** ») ; l'étape n'a jamais été faite, et c'est elle qui tient les 106
Server Actions hors de portée.

**Base.** Un service container `postgres:16` dans le job `e2e` de `ci.yml`,
`db/schema.sql` appliqué, puis un seed E2E dédié (`e2e/fixtures/seed.sql`) :
une orga, une coach, deux membres (fiche publiée / fiche en brouillon), une
édition de Tremplin, un talk, un article. Volontairement **petit et figé** — les
tests restent agnostiques aux données réelles, ils s'appuient sur un décor connu.

> PGlite (déjà en dépendance de dev) sert bien les tests d'intégration Vitest
> en in-process, mais l'app E2E parle à `pg` par socket : c'est un vrai Postgres
> qu'il faut ici, pas PGlite.

**Session — ✅ FAIT (2026-08-09), et ça n'a coûté qu'un fichier.** Aucun code de
prod modifié et **aucun provider de test exposé** : la stratégie est déjà `jwt`
(`auth.config.ts`) et le token ne porte que `sub`, `isOrga`, `isCoach`. Les
tests forgent donc le cookie avec la MÊME fonction que la prod (`encode()` de
`next-auth/jwt`, `salt` = nom du cookie) — le serveur ne fait pas la différence,
parce qu'il n'y en a pas. Voir `e2e/session.ts` ; le secret de test est fourni
au serveur par `webServer.env` dans `playwright.config.ts`, donc **la CI n'a
rien à déclarer**.

Ça débloque tout de suite ce que le proxy décide AVANT l'affichage d'une page,
c'est-à-dire les autorisations d'accès — et c'est ce qui a mis au jour le défaut
du §3.1. Ce qui reste derrière la base : le rendu des pages elles-mêmes.

**Base — ✅ FAIT (2026-08-09).** Service container `postgres:16` dans le job
`e2e`, schéma appliqué par `scripts/migrate.mjs` (le MÊME `sync-to-latest.sql`
qu'en production, donc le schéma testé est celui qui tourne), puis le décor par
`scripts/seed-e2e.mjs` — le tout derrière `npm run e2e:db`, rejouable en local.

**Le décor est `db/seed-preview.sql`, pas un second jeu de données.** Le dépôt
en maintenait déjà un pour les previews : fictif (RGPD — que des personnes
inventées, `@demo.techspeakher.test`), riche, et porteur de son propre garde-fou
anti-prod. En écrire un deuxième aurait créé deux vérités qui dérivent — la
panne exacte qu'avaient connue les trois copies de `PAGES_PUBLIQUES`.

**Absent ≠ ignoré en silence.** `e2e/decor.ts` sonde l'index public de
recherche : décor absent en local → les specs se déclarent IGNORÉES avec la
commande à lancer ; décor absent en CI → **échec bruyant**, parce qu'un skip
silencieux ferait disparaître ces garde-fous sans que personne ne le voie.
Vérifié dans les deux sens.

Restent hors de portée : les pages CONNECTÉES et les Server Actions, qui
demandent en plus des comptes reliés au décor.

### 5.3 Une fois le socle posé — par valeur décroissante

| Priorité | Parcours | Pourquoi celui-là |
|---|---|---|
| **P0** | Contacter une speakeuse, de bout en bout | Données personnelles. Le test doit affirmer que **l'e-mail de la speakeuse n'apparaît nulle part** dans le HTML servi, et que le message part en modération sans notification immédiate |
| **P0** | Connectée non-orga → `/admin` | Escalade de privilège, en vrai câblage |
| **P0** | Supprimer son compte | RGPD, irréversible |
| **P1** | Créer sa fiche → soumettre → modération orga → visible dans l'annuaire | **Le parcours central du produit**, et le seul qui traverse les trois rôles |
| **P1** | Annuaire peuplé : filtres, carte, fiche, partage | Débloque aussi axe et largeur sur du contenu réel (§3.2) |
| **P1** | `/tremplin/[conf]/[annee]` + `/montee-sur-scene` | 500 aujourd'hui sans base ; priorité 0.9 au sitemap |
| **P1** | Contact : l'**envoi réussi** | Le reste du parcours est déjà pris en 5.1 ; ne manque que le bouchon Brevo |
| ~~**P2**~~ ✅ | ~~Gérer un talk et ses occurrences~~ — livré 2026-08-15 (`e2e/parcours-talks.spec.ts`) | Volume d'usage. Le trou a coûté un lien mort en prod : la conférence hors répertoire renvoyait vers une page inexistante, et personne ne jouait le parcours. |
| **P2** | axe + largeur sur les pages connectées, `/admin` en premier | Ferme la dette résiduelle déjà écrite |
| **P2** | Modérer un message de contact (orga) | Second maillon du parcours P0 |
| **P3** | Pilotage d'une édition Tremplin | 54 actions ; à couvrir par les chemins qui écrivent, pas page par page |
| **P3** | Sans JavaScript, `error.tsx`, 404 sur segments dynamiques | Filet de robustesse |

---

### 5.4 Ce que le premier lot a effectivement livré (2026-08-09)

| Fichier | Ce qu'il garde désormais |
|---|---|
| `e2e/session.ts` | Ouvre une session sans OAuth ni base, en forgeant le cookie avec la fonction de prod. Trois rôles nommés : membre, coach, orga |
| `e2e/auth.spec.ts` (réécrit) | Les gardes d'accès **au bord**, dans les deux sens (refus ET passage), pour anonyme / membre / orga. C'est lui qui a trouvé le défaut du §3.1 |
| `e2e/recherche.spec.ts` | La palette : ouverture, résultats annoncés, parcours et validation au clavier, Échap qui rend le focus, recherche sans réponse |
| `e2e/contrat-http.spec.ts` | 5 redirections avec leur code exact, les en-têtes de sécurité, la CSP par directives, le `no-store` des espaces privés, les 5 ressources annexes |
| `e2e/contact-api.spec.ts` | La validation **serveur** (6 cas) et le plafond anti-spam de la seule écriture publique |
| `e2e/pages-publiques.ts` | `/connexion/verifie` et `/connexion/deja-un-compte` entrent dans les trois portes (RGAA, largeur, typographie) — vertes du premier coup |
| `playwright.config.ts` | Le secret de session pour le serveur de test ; les specs indépendantes du viewport ne sont plus rejouées en mobile |
| `src/auth.config.ts`, `src/proxy.ts` | La correction du §3.1 : `refusDAcces`, source unique, appliquée par le proxy |

**Deux vérifications par mutation**, parce qu'une porte qu'on n'a pas vue tomber
n'est pas une porte : en neutralisant `refusDAcces`, l'ancienne spec restait
verte (3/3) et la nouvelle tombe (3 échecs). C'est le contrôle qui manquait à
l'entrée « RÉSOLU » d'origine, et il vaut d'être refait à chaque fois qu'on
écrit une garde.

### 5.5 Le second lot : le décor de données (2026-08-09)

| Fichier | Ce qu'il garde désormais |
|---|---|
| `.github/workflows/ci.yml` | Un `postgres:16` éphémère dans le job E2E |
| `scripts/seed-e2e.mjs` + `npm run e2e:db` | Schéma (script de PROD) puis décor, en une commande, rejouable en local |
| `e2e/decor.ts` | Le contrat entre le décor et les tests, nommé une seule fois. Sonde de présence : ignoré en local, **échec bruyant en CI** |
| `e2e/contact-speakeuse.spec.ts` | **L'adresse d'une speakeuse ne fuite nulle part** (source servie, pas seulement l'écran), et on n'écrit qu'à qui a accepté d'être joignable |
| `e2e/annuaire.spec.ts` | Une fiche EN ATTENTE reste invisible (annuaire **et** index de recherche), les cartes mènent à la bonne personne, un filtre ne vide pas la liste |
| `a11y.spec.ts` · `largeur.spec.ts` | Les mêmes portes sur les pages PEUPLÉES (§3.2) |

**Vérifié par mutation, là encore.** En publiant les fiches `en_attente` dans
l'annuaire, et en laissant fuiter une adresse dans la fiche : les deux tests
tombent. Ces deux garde-fous protègent des données personnelles — c'est le seul
endroit du dépôt où une régression silencieuse serait irréversible, et ils
savent maintenant sonner.

*(Note trouvée au passage : le DTO `SpeakerProfile` ne PORTE pas l'adresse
e-mail — la fuite est déjà empêchée au niveau du type. Le test garde le niveau
au-dessus : ce qui est réellement servi.)*

### 5.6 Le troisième lot : les espaces connectés (2026-08-09)

Session + décor réunis, les 83 pages connectées s'ouvrent enfin à un test.

| Fichier | Ce qu'il garde |
|---|---|
| `e2e/espaces-connectes.spec.ts` | Les pages clés des deux espaces s'affichent **avec les bonnes données pour la bonne personne** (un 200 sur l'espace de quelqu'un d'autre resterait un 200) ; la fiche en attente **est bien** dans la file de modération ; aucune adresse d'un tiers dans l'espace membre |
| `a11y.spec.ts` · `largeur.spec.ts` | Les portes RGAA et débordement sur `/mon-espace` **et `/admin`** |

**La dette « résiduelle » est close.** `dette-technique.md` portait « scan axe des
pages connectées (nécessite l'auth en E2E) » comme un impossible ; il ne tenait
qu'à la session et à la base. L'espace orga — le plus dense en tableaux et en
listes longues, donc le plus exposé au débordement mobile — **passe désormais
les deux portes, sur les deux tailles d'écran**. Il était déjà conforme : on le
sait maintenant, au lieu de l'espérer.

**Le smoke est mince à dessein.** Couvrir 83 pages une à une produirait une
suite que personne ne tient. Ce qu'il garde est ce qu'aucun autre niveau ne
voit : qu'une page connectée ne tombe pas en 500 après un déploiement — ce qui,
jusqu'ici, ne se découvrait qu'en le vivant.

### 5.7 Le quatrième lot : les premières ÉCRITURES (2026-08-09)

« 0 des 106 Server Actions exécutée » était le plus gros trou du relevé. On
l'ouvre par les deux écritures dont une régression coûterait le plus cher.

| Parcours | Ce qu'il garde |
|---|---|
| **Supprimer son compte** (P0, RGPD) | Le compte et sa fiche disparaissent **réellement de la base** — une action qui redirige sans rien effacer passerait sinon pour un succès. Et une saisie de confirmation qui ne correspond pas laisse le compte intact |
| **Le parcours central** (P1) | Une membre soumet → l'orga valide → elle paraît dans l'annuaire. **Le seul parcours qui traverse les trois rôles**, avec l'invariante de confidentialité à chaque étape : tant qu'elle attend, elle reste invisible du public |

**Trois choix de méthode, tous appris en route :**

1. **Des comptes jetables** (`e2e/comptes-jetables.ts`), jamais le décor partagé.
   Publier la fiche en attente du décor ferait tomber `annuaire.spec.ts` au
   passage suivant : on aurait une suite dont le résultat dépend de l'ordre
   d'exécution, qui rougit sans qu'on ait rien cassé.
2. **On vérifie en base, pas à l'écran.** Une page peut afficher « c'est fait »
   pendant que l'écriture a échoué — exactement ce qu'un test de rendu laisse
   passer.
3. **On ne rejoue pas l'unitaire.** Le refus serveur d'une mauvaise confirmation
   est déjà couvert (`actions-espace.test.ts`) ; l'E2E garde ce que lui seul
   voit — que la ligne disparaît vraiment.

*Détail qui a coûté un aller-retour, et qui est maintenant écrit dans la
fixture : une fiche qui satisfait les règles de SOUMISSION peut n'afficher aucun
bouton, parce que l'écran attend en plus la checklist de complétude (dont **un
talk**). Le test échouait sur « bouton introuvable » et donnait l'air d'une
régression d'interface.*

**Vérifié par mutation** : en neutralisant la soumission, le parcours central
tombe.

### 5.8 Le cinquième lot : le pilotage du Tremplin (2026-08-10)

**54 Server Actions, 189 tests de pièces détachées, zéro parcours traversé.** La
gestion du Tremplin est la moitié des écritures du produit et la seule surface
que rien ne suivait de bout en bout. On l'ouvre par TROIS chemins, choisis par
le risque (`docs/principes-tests.md` §5) et pas par la complétude — viser les 54
actions produirait une suite que personne ne tient (§6).

| Parcours | Rang de risque | Ce qu'il garde |
|---|---|---|
| **Le consentement de diffusion** d'une participante | 1 — donnée personnelle | Elle paraît sur la page publique quand l'orga enregistre son accord, **et plus du tout** quand elle se ravise : nom, photo où elle figure, et le journal RGPD qui date les deux |
| **Rattacher / retirer une coach** | 2 — la mauvaise personne | Le rattachement ouvre exactement UN atelier et ses participantes ; l'atelier d'à côté et sa participante restent invisibles ; le retrait referme |
| **Supprimer une édition** | 3 — irréversible | Le nom que l'écran demande de retaper est bien celui que l'action attend, la cascade est réelle, et l'adresse publique devient un tombstone qui ne nomme plus personne |

**Ce que ce niveau voit, et lui seul.** Les validations et les écritures sont
déjà tenues par les 189 tests de pièces ; on ne les rejoue pas. Quatre choses
n'existent qu'ici :

1. **L'ISR.** La page publique d'édition est en cache 300 s. Les actions
   appellent `revalidatePath(PUBLIC_EDITION_ROUTE, "layout")` pour cette raison
   exacte, et rien ne le vérifiait : sans elle, un **retrait de consentement
   resterait affiché cinq minutes**. Le test visite la page avant le retrait
   (elle se met donc en cache) puis juste après.
2. **Le cloisonnement des consentements.** Galerie des finalistes
   (`registrations.public`), chapitre « montée sur scène »
   (`registration_phases.public`, migration 055) et fiche coach
   (`coach_profiles.public`) parlent de diffusions différentes. Le code les
   sépare avec insistance ; aucun test ne les regardait ENSEMBLE. Le parcours en
   couvre **deux** — accorder la galerie ne nomme personne sur le chapitre 2.
   Celui des accompagnantes est pris par le lot suivant (§5.9).
3. **La cascade photo.** `getPublicPhotos` bloque une photo dès qu'un tag n'est
   pas couvert : retirer le consentement d'une participante dépublie les photos
   où elle figure. Personne ne pense à cliquer là.
4. **L'accord des deux côtés du palier 3.** Le test tape une VARIANTE du nom
   affiché (majuscules, accent, espaces) : elle doit débloquer le bouton ET
   satisfaire la revérification serveur. Si un côté se met à comparer
   strictement, la suppression devient impossible — panne muette, puisque rien
   n'est détruit.

**Le décor : `e2e/tremplin-jetable.ts`, une édition entière par test.** Même
raison qu'au lot précédent, un cran au-dessus : publier une participante du
décor partagé, ou supprimer l'édition 2026, ferait tomber `annuaire.spec.ts`,
`a11y.spec.ts` et `largeur.spec.ts` au passage suivant. Chaque édition jetable a
son propre `conf_slug` (jamais `devfest-toulouse`), donc son adresse publique à
elle : deux tests parallèles ne peuvent ni collisionner sur l'index unique
`(conf_slug, annee)`, ni apparaître dans un hub que d'autres specs regardent.

**Vérifié par mutation, huit fois.** Une porte qu'on n'a pas vue tomber n'est pas
une porte (règle d'or). Chaque protection a été cassée une fois, et le test est
tombé **sur la bonne assertion** :

| Ce qu'on casse | La ligne qui tombe |
|---|---|
| La galerie publique cesse de filtrer sur le consentement | Elle est nommée avant d'avoir rien accordé |
| L'action de visibilité ne revalide plus la page publique | Le retrait n'a plus d'effet visible (ISR) |
| `getPublicPhotos` cesse de bloquer un tag non couvert | La photo paraît avant l'accord |
| Le chapitre 2 lit le consentement de la galerie | Elle est nommée sur une page où elle n'a pas consenti |
| L'espace coach cesse d'être borné à ses ateliers | Une coach sans mission ouvre l'édition |
| Retirer une coach d'un atelier n'a plus d'effet | Le rattachement survit au retrait |
| La suppression pose le tombstone sans effacer les données filles | Participantes / ateliers / photos survivent |
| Le serveur compare la confirmation au caractère près | La suppression devient impossible (`?err=edition_nom`) |

*Trouvé au passage, et écrit dans le test : `/mon-espace/coaching/<id>` répond
**200 même quand la page appelle `notFound()`** — la coquille de
`mon-espace/loading.tsx` part avant que le rendu ne décide. La garde tient (c'est
bien l'écran « Page introuvable » qui s'affiche), mais un test qui guetterait un
404 mesurerait le streaming, pas la garde. On juge donc sur l'écran.*

**Ce qui reste hors de portée, et assumé.** Les 40 et quelques autres actions du
Tremplin (sous-groupes, présences, récompenses, jury, documents, photos côté
admin) : outillage interne, réversible, sans donnée publiée. Elles sont tenues en
unitaire, et les couvrir en E2E coûterait plus cher que ce qu'une régression y
coûterait — c'est exactement l'arbitrage du §5 des principes.

### 5.9 Le sixième lot : les deux autres publications du Tremplin (2026-08-10)

Le lot précédent laissait deux endroits où le produit **publie un nom** sans que
rien ne suive le chemin complet. Ce sont les deux seuls qui restaient au rang de
risque 1 ; on les prend, et on s'arrête là (§6).

| Parcours | Ce qu'il garde |
|---|---|
| **L'accord d'une accompagnante** | Elle est citée sur la page de l'édition **et sur `/partenaires`** quand l'orga coche son accord, et quitte les deux quand elle se ravise — l'accord vit sur le COMPTE, donc il vaut pour toutes les éditions qu'elle a animées |
| **Le palmarès** | Récompenser **sans nommer** : le rang et le prix paraissent, « Gagnante (non communiquée) » tient la place du nom, et l'accord la nomme dans les DEUX canaux qui le calculent séparément |

**Ce que le premier a trouvé, et qui n'était visible qu'ici.** `/partenaires`
n'était revalidée par **aucune** action. C'est une page **statique** à
`revalidate = 300` (mesuré au build : `○ /partenaires … 5m`) dont la section
« Elles donnent de leur temps » vient de la base. Conséquence : un accord
recueilli n'y paraissait qu'au bout de cinq minutes, et un accord **retiré y
restait affiché autant**. Le retrait est un droit dont le dépôt écrit partout
qu'il doit être immédiat (art. 7-3) ; il l'était sur la page d'édition, pas ici —
le geste n'était branché que sur la surface qu'on a sous les yeux en le faisant.
C'est le même défaut que §5.8 avait prévenu pour l'édition, sur la page voisine
que personne n'avait reliée au Tremplin.

Corrigé en nommant cette seconde surface **une seule fois**
(`PUBLIC_PARTENAIRES_ROUTE`, avec sa règle : on la revalide partout où change
l'une des trois conditions de `listAccompagnantesPubliques`), puis en
l'appliquant aux gestes qui la changent — accord, fiche, rattachement et retrait
d'une coach, atelier au programme public, statut et suppression d'édition.
`retirerAtelierAction` garde son absence de revalidation : elle est **décidée,
mesurée et écrite** (elle démonterait la rangée avant son compte rendu), et le
délai public y est déjà assumé.

**Le second regarde deux gardes écrites dans deux langages.** Le nom du palmarès
est filtré en JavaScript (`nom: r.public ? r.nom : null`), celui de la carte de
récompense en SQL (`CASE WHEN r."public" THEN …`). Deux implémentations d'un
seul accord, sur une même page, que rien ne regardait ensemble — la paire qui
dérive.

**Vérifié par mutation, six fois.** Chaque garde cassée une fois, et le test
tombé **sur la bonne assertion** :

| Ce qu'on casse | La ligne qui tombe |
|---|---|
| `/partenaires` cesse de filtrer sur l'accord de la coach | Elle y est encore nommée **après** son retrait |
| L'accord d'une coach ne revalide plus `/partenaires` | Elle n'y paraît pas alors qu'elle vient d'accorder (ISR) — c'est le défaut trouvé, reproduit |
| La page d'édition cesse de filtrer sur l'accord de la coach | Elle est citée avant d'avoir rien accordé |
| Le palmarès nomme sans regarder le consentement | « Gagnante (non communiquée) » a disparu de l'écran |
| La carte de récompense nomme sa bénéficiaire sans son accord | Son nom paraît sur une page où elle a refusé |
| **Toutes** les écritures du palmarès cessent de revalider la page publique | Le titre du palmarès n'apparaît pas |

**Deux mesures qui corrigent ce qu'on croyait tenir** — les deux valent plus que
les tests eux-mêmes, et sont écrites à côté des assertions concernées :

1. **Une garde par ISR ne se juge qu'avec un cache CHAUD.** Neutraliser la
   revalidation du seul classement laissait le parcours du palmarès **vert** :
   l'écriture voisine (la récompense) revalide la même route et rafraîchit tout.
   Ce parcours garde donc « au moins une de ces écritures ramène la page à
   jour », pas chaque maillon — et c'est écrit dans le test pour que personne ne
   lui prête mieux.
2. **Une absence sur une page prérendue au build ne prouve rien.** L'étape 0 du
   parcours de l'accompagnante vérifie qu'elle n'est pas sur `/partenaires` —
   mais la page est prérendue, donc elle ne POUVAIT pas nommer quelqu'un créé
   après. Ce qui garde réellement l'accord est l'étape 5, après une revalidation
   réelle. La mutation l'a montré en tombant là, et pas à l'étape 0.

**Deux instruments réparés au passage** (mesurés sous charge, pas déduits) :

- un écran d'admin **streamé** derrière `loading.tsx` porte un INSTANT **deux
  copies du même formulaire** : un sélecteur global tombe alors en « strict mode
  violation » sans qu'aucune garde n'ait bougé. On vise dans la région, ou on
  prend la première — les deux copies disent la même chose ;
- le **message de succès** d'une action s'efface au rafraîchissement qu'elle
  déclenche : l'attendre, c'est courir contre lui. On juge en base, comme le
  reste du fichier.

Ces deux-là n'étaient pas des tests ratés mais des tests **instables**, c'est-à-
dire pires : ils auraient rougi un jour sur deux sans que rien ne soit cassé, et
`retries: 2` les aurait masqués (§6).

## 6. Ce qu'il ne faut pas faire

- **Ne pas viser les 117 surfaces.** L'espace orga se couvre par **parcours**
  (« créer un atelier, y placer une participante, saisir les présences »), pas
  par visite des 60 pages. Une porte qu'on n'arrive pas à tenir finit désactivée
  — le principe est déjà écrit dans `a11y.spec.ts`, il vaut ici aussi.
- **Ne pas remonter en E2E ce que l'unitaire tient déjà.** 293 fichiers Vitest,
  **3 227 tests verts en 2 min 47 s** (mesuré), couvrent la logique, les
  validations et l'accès base. L'E2E doit garder ce que seul un vrai navigateur
  voit : le câblage, le rendu, l'enchaînement.
- **Ne pas laisser `retries: 2` masquer une instabilité.** Une fois des tests
  écrivant en base, un test qui ne passe qu'au deuxième essai doit se voir.
- **Ne pas seeder depuis les tests.** Un décor figé, appliqué avant la suite ;
  sinon les tests parallèles se marchent dessus et la suite devient un
  générateur de faux rouges.

---

## 7. En une phrase

La suite E2E garde très bien **la coquille publique vide**, et rien d'autre : un
seul environnement CI à compléter (Postgres + `AUTH_SECRET`) fait passer 83 pages
et 106 Server Actions de « intestable » à « testable » — et, en attendant, le
test censé garder les accès est vert sur une garde supprimée.
