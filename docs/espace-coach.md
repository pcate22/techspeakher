# Espace coach — conception

> 2026-07-03. Matrice de droits validée par l'orga. À lire avec
> `docs/ux-admin-edition.md` (architecture fiches) et
> `docs/tremplin-edition-publique.md`.

## 1. Conception fonctionnelle

### Le rôle

Un **animateur / coach** est un compte de la plateforme (pas forcément une
speakeuse publiée, pas forcément une femme — l'annuaire et les inscriptions
Tremplin restent réservés aux femmes). Le rôle est **cumulable** avec orga et
speakeuse. Il est posé par l'orga au moment d'assigner la personne (genre
obligatoire, statistiques de mixité, jamais affiché).

Deux formes d'assignation, toutes deux **réservées aux orgas** :

- **coach d'atelier** (`tremplin_atelier_coachs`) : anime un atelier,
  collectif ou restreint ;
- **coach individuel** (`tremplin_registration_coachs`) : suit UNE
  participante (la liaison disparaît si l'inscription est retirée).

### Matrice de droits (validée)

| Droit | Coach | Orga |
|---|---|---|
| Voir SES ateliers (date, heure, visio, participantes, supports) | ✅ | ✅ |
| Voir SES coachées individuelles et leurs documents de suivi | ✅ | ✅ |
| Déposer un support sur SES ateliers / un document pour SA coachée | ✅ | ✅ |
| Lire les ressources générales de l'édition où il intervient | ✅ | ✅ |
| Voir les autres ateliers / participantes, e-mails, consentements | ❌ | ✅ |
| Gérer l'édition, inscriptions, visibilité, photos, coachs | ❌ | ✅ |

Décisions de périmètre :

- Le coach voit les **documents privés de SA coachée** (retour jury compris :
  c'est la matière du suivi) — jamais ceux des autres.
- Le libellé d'une coachée côté coach n'expose **jamais l'e-mail** (repli :
  « Participante n° X ») — l'e-mail est une donnée de gestion orga.
- Le coach peut **supprimer ses propres dépôts** (auteur), pas ceux des
  orgas ni d'un autre coach.
- Une orga qui est aussi coach voit l'espace coach comme n'importe quel
  coach (cumul naturel, pas de mode « aperçu » séparé).

### Parcours

1. L'orga assigne `coach@x.fr` (fiche atelier ou fiche participante).
2. Le coach se connecte avec cet e-mail (Google / LinkedIn / lien magique) →
   il retombe sur le compte pré-créé.
3. Sur `/mon-espace`, une carte « Mes coachings » apparaît (si `isCoach`).
4. `/mon-espace/coaching` liste ses missions par édition ; chaque édition
   ouvre `/mon-espace/coaching/[edition]` : ses ateliers (cartes) et ses
   coachées (cartes), avec dépôt de documents là où il intervient.

### Wording (exigence validée)

Cartes descriptives à la « Comptes Google », messages nominatifs, pas de
jargon : « Ton atelier du 5 mai », « Déposer un support pour l'atelier »,
« Déposer un document pour Sandrine ». Le terme UI est **« coach »**
(« animateur / coach » dans les textes explicatifs).

## 2. Conception technique

### Session et garde

- `auth.ts` : le callback JWT porte déjà `isOrga` (lu en base à la
  connexion) ; ajouter `isCoach` au même endroit (`getIsCoach` ou une seule
  requête `SELECT is_orga, is_coach`), types de session étendus.
  ⚠️ même piège que `is_orga` : le rôle est lu À LA CONNEXION — un coach
  assigné doit se (re)connecter pour voir son espace. Documenté dans l'UI
  d'ajout (« il verra son espace à sa prochaine connexion »).
- `auth-guards.ts` : `requireCoachId()` — session + `isCoach`, sinon
  redirection `/connexion` (même forme que `requireOrgaId`).

### Accès données (tout scopé par `userId` du coach, EN SQL)

Dans `src/lib/tremplin-coachs.ts` :

- `getCoachEditions(userId)` : éditions où il a ≥ 1 atelier OU ≥ 1 coachée
  (UNION des deux liaisons, jointe à `tremplin_editions`).
- `getCoachAteliers(userId, editionId)` : ses ateliers (join
  `tremplin_atelier_coachs`).
- `getCoachCoachees(userId, editionId)` : DTO minimal
  `{ registrationId, nom, sujet }` — nom = `participante_nom` ??
  `users.name` ?? « Participante n° X », **jamais l'e-mail**.
- `getCoachAtelierDocs(userId, editionId)` / `getCoachCoacheeDocs(userId,
  editionId)` : documents joints via la liaison coach (pas un filtre JS sur
  une liste plus large — le scope est dans la requête).
- `addDocumentAsCoach(userId, editionId, input)` : INSERT gardé par
  `WHERE EXISTS (liaison coach ↔ cible)` — un coach ne peut pas viser un
  atelier ou une coachée qui n'est pas à lui, même avec un id forgé.
  `auteur_id = userId`.
- `deleteOwnDocument(userId, documentId, editionId)` : DELETE
  `WHERE auteur_id = userId` (ses dépôts seulement).

### Routes et actions

- `/mon-espace/coaching/page.tsx` : `requireCoachId`, liste des missions.
- `/mon-espace/coaching/[edition]/page.tsx` : `requireCoachId` + 404 si
  l'édition ne fait pas partie de `getCoachEditions` ; cartes ateliers
  (titre, date, visio, participantes de l'atelier, supports + dépôt) et
  coachées (nom, sujet, documents + dépôt).
- `src/app/mon-espace/coaching/actions.ts` :
  `addCoachDocumentAction` (résultat, réutilise `parseDocumentForm` +
  `addDocumentAsCoach`) et `deleteOwnDocumentAction` (résultat).
  Réutilisation UI : `AdminDialog`/`AddDocumentDialog` (préconfiguré,
  saisie à la chaîne) et `InlineActionForm` — déjà partagés.
- Carte « Mes coachings » sur `/mon-espace` si `session.user.isCoach`.

### Sécurité / RGPD

- Identité TOUJOURS de la session ; chaque requête re-vérifie la liaison
  coach↔cible en SQL (pas de confiance dans les ids du client).
- Aucune donnée de consentement, de visibilité, ni d'e-mail participante ne
  transite vers l'espace coach.
- Mentions légales : compléter la phrase des documents (« visibles de la
  participante concernée, des organisatrices **et de son coach pour les
  documents de suivi** »).
- Les vidéos/retours restent non publiés — inchangé.

## 3. Plan d'implémentation (TDD)

1. **Session + garde** : `isCoach` dans le JWT/session (+ types), 
   `requireCoachId` — tests unitaires (auth-providers/guards existants
   comme modèles).
2. **Lib** : les 6 fonctions ci-dessus — tests d'intégration pg-mem
   (scope : coach A ne voit ni ne dépose chez coach B ; e-mail jamais
   exposé ; suppression limitée à ses dépôts).
3. **Actions** : dépôt + suppression — tests actions (garde coach,
   validation, cible forgée refusée).
4. **Pages** : /mon-espace/coaching + [edition] + carte d'entrée — smoke
   tests de rendu ; E2E garde (non connecté → /connexion).
5. **Wording + mentions légales + docs** (ce fichier tenu à jour,
   architecture.md complété).

Estimation : M (une session). Risque principal : le double JOIN documents ;
couvert par les tests d'intégration.

## 4. Hors périmètre (plus tard, si besoin réel)

- Notifications au coach (nouveau document, changement d'atelier).
- Le coach modifie le lien visio de SES ateliers (aujourd'hui orga).
- Page « équipe d'animation » publique par édition (avec consentement).
