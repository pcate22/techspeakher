# Conception — Champ « personne » (#28) + action « Toutes » (#29)

> Statut : conception (technique + implémentation) pour arbitrage orga, **avant
> code**. Deux petites features d'admin sur les mêmes surfaces (fiche atelier,
> ajout de personnes). Réutilisent l'existant : `PersonPicker` (combobox ARIA,
> déjà en place) et les actions en lot `setAtelierMembres`/`setAtelierPresences`.

---

## #28 — Champ « personne » autocomplété + création

### Problème
`AddCoachDialog` et `AddParticipanteDialog` demandent aujourd'hui **soit** un
`<select>` de comptes **soit** un e-mail dans deux champs séparés — clunky, et le
select devient inutilisable quand il y a beaucoup de comptes. `PersonPicker`
(déjà utilisé par `AttachForm` pour relier un compte à une inscription) fait
exactement ça : on tape un nom, on choisit une personne existante, ou on active
« Inviter … » qui révèle les champs de création.

### Cible (à réutiliser tel quel)
`PersonPicker` : reçoit des `candidats` sérialisables `{id,label,sousTitre}`,
soumet le(s) id(s) choisis en `<input hidden name>`, et `children(query)` révèle
les champs de création quand on active « Créer/Inviter ». `onCreationChange`
laisse le parent basculer son bouton (« Ajouter » ↔ « Inviter »).

### Où l'appliquer
1. **`AddCoachDialog`** (coach d'atelier ET coaching individuel) : remplacer le
   `select compteId` + e-mail/nom par **un** `PersonPicker` sur les comptes
   plateforme. Sélection → `compteId` caché ; « Inviter par e-mail » → révèle
   `email` + `nom` + `genre` (genre obligatoire seulement en création, ce que
   `addCoachAction` impose déjà). **Aucun changement d'action** (elle accepte déjà
   `compteId` XOR `email`+`genre`).
2. **`AddParticipanteDialog`** (ajouter une candidate à l'édition) : idem, un
   `PersonPicker` sur les comptes speakeuses ; « Inviter par e-mail » révèle les
   champs. L'action existante gère déjà les deux voies.

### Hors périmètre (justifié)
**Ajout de candidates SUR un atelier** : depuis D, la fiche atelier liste toutes
les inscrites en interrupteurs filtrables (on coche celles à réserver). Sélectionner
parmi les inscrites existantes est donc déjà couvert — un `PersonPicker` y ferait
doublon. Le seul cas non couvert serait *créer une inscrite jamais inscrite
directement depuis l'atelier* ; à trancher (§Décisions).

### Implémentation (lots, TDD)
- Composants uniquement (les actions ne bougent pas) : réusiner les deux modales
  autour de `PersonPicker`. Tests de rendu (sélection → `compteId` soumis ;
  création → champs révélés + genre requis). A11y déjà portée par `PersonPicker`.

---

## #29 — Action « Toutes » (tout cocher / toutes présentes), phase-aware

### Problème
Sur la fiche atelier, réserver un atelier à tout un groupe = cocher chaque
inscrite une par une ; pointer une présence collective = idem. On veut un geste
« Toutes » d'un coup.

### Comportement (phase-aware avec D)
L'atelier a une **phase** (`cfp_et_pitch` / `montee_sur_scene`). « Toutes » cible
la **cohorte de cette phase** (appartenances de la table de liaison, cf. D), pas
toutes les inscrites de l'édition :

1. **« Activer toutes les participantes de la phase »** → `setAtelierMembres` (en
   lot, déjà en place) avec les inscriptions dont l'appartenance = la phase de
   l'atelier. Réserve l'atelier à cette cohorte.
2. **« Marquer toutes présentes »** → `setAtelierPresences` (en lot) : passe
   `presente` toutes les **membres actuelles** de l'atelier. Réversible par
   interrupteur individuel.

### UX
Deux boutons discrets **au-dessus** de la liste des participantes de la fiche
atelier. « Activer toutes … » change beaucoup d'un coup (et bascule l'atelier
« ouvert → réservé ») → **confirmation** (`ConfirmSubmitButton`) annonçant le
nombre concerné. « Marquer toutes présentes » n'apparaît que s'il y a des membres.
Idempotent, enregistrement immédiat, rafraîchissement (les interrupteurs
reflètent l'état).

### Implémentation (lots, TDD)
- lib : réutilise `setAtelierMembres` (liste = cohorte de phase) et
  `setAtelierPresences`. Une petite lecture « inscriptions de la phase P de
  l'édition » (via `getPhaseMembersByEdition`, déjà là) fournit la liste.
- actions : `setAtelierMembresAction`/`setAtelierPresencesAction` existent déjà ;
  éventuellement un `marquerToutesPresentesAction` fin (ou réutiliser l'action en
  lot avec toutes les présences à `presente`). Garde orga, scopé édition.
- UI : deux contrôles sur la fiche atelier. Tests d'action (garde, scope,
  phase-aware : n'active que la cohorte de la phase).

---

## Décisions à trancher (orga)

1. **#28 — cibles.** Appliquer `PersonPicker` à **AddCoachDialog + AddParticipanteDialog**
   (proposé) ? Et sur la fiche atelier, se contente-t-on des interrupteurs
   existants (proposé), ou veut-on aussi **inviter une toute nouvelle personne
   comme candidate depuis l'atelier** (ajoute une étape : créer l'inscription +
   l'ajouter) ?
2. **#29 — portée de « Toutes ».** Cibler la **cohorte de la phase de l'atelier**
   (proposé, cohérent avec D) — ou littéralement **toutes les inscrites** de
   l'édition (ignorer les phases) ?
3. **#29 — « toutes présentes ».** On la garde (marque présentes toutes les
   membres actuelles) ? Confirmation nécessaire sur « activer toutes » (proposé :
   oui, car ça réserve l'atelier) ?
4. **#29 — un « Toutes » aussi hors atelier ?** (ex. « marquer toutes finalistes »)
   — non proposé pour l'instant (périmètre = fiche atelier).

---

## Révision post-revue de conception (2026-07-06)

Deux relectures (simplify + risques/UX/a11y). Corrections **à intégrer avant code** :

### #29 — corrections (2 HIGH)
- **Sémantique ADDITIVE (union), pas replace.** `setAtelierMembers` DIFFE et
  **retire** les membres absents de la liste passée. « Activer toutes … » doit
  passer `union(membres actuels, cohorte de la phase)` — sinon il vire
  silencieusement une inscrite ajoutée à la main. (Si un vrai « remplacer » était
  voulu, la confirmation devrait annoncer « X hors cohorte seront retirées ».)
- **Garde cohorte vide.** Tôt dans une édition, une cohorte `montee_sur_scene`
  est souvent vide → un replace `[]` viderait l'atelier et le rendrait **public**
  (« ouvert à toutes »). Contrôle **masqué/désactivé si cohorte vide** ; ne jamais
  appeler `setAtelierMembers([])` par ce chemin (l'union rend le cas inoffensif).
- **Dérivation cohorte CÔTÉ SERVEUR.** Pour que « n'active que la cohorte de la
  phase » soit un invariant réel et testable (et non une liste postée par le
  client), une **action dédiée** dérive la cohorte de `atelier.phase` +
  `getPhaseMembersByEdition`, fait l'union avec les membres actuels, et applique.
  (Reste orga + scopé édition ; la sécurité cross-édition était déjà garantie par
  `tagAtelierWithinTx`, mais l'invariant « phase » devient vrai.)
- **Rafraîchissement.** Le contrôle en lot doit déclencher `router.refresh()` au
  succès (comme `SettingToggle`), sinon les interrupteurs par inscrite restent
  périmés. Donc **petit composant client** (`useActionState` + refresh), pas un
  `ConfirmSubmitButton` brut. Confirmation conservée sur « Activer toutes »
  (annonce le nombre + bascule ouvert→réservé).
- **« Toutes présentes ».** Passe `presente` toutes les membres actuelles (réutilise
  `setAtelierPresences`). N'apparaît que s'il y a des membres. Note : écrase un
  `absente` explicite → soit on l'assume (annoncé), soit on ne touche que les
  `non_renseignee`. **À trancher (§Décisions 3).**

### #28 — corrections
- **Ne PAS câbler `onCreationChange`** pour changer le libellé du bouton :
  `AdminDialog` a des libellés **statiques** ; les garder (« Ajouter ce coach » /
  « Inviter ») évite de toucher `AdminDialog`. Vrai « composants only ».
- **Préserver « compléter un compte sans nom ».** Aujourd'hui, choisir un compte
  existant + saisir un `nom` complète un compte anonyme (`setUserNameIfEmpty`).
  Dans `PersonPicker`, une sélection ne soumet que `compteId`. Pour ne pas perdre
  cette capacité : garder un **champ `nom` optionnel toujours visible** à côté du
  picker (soumis avec `compteId`). **À trancher (§Décisions 4).**
- **Réinitialiser le picker sur enchaînement.** « Ajouter et enchaîner » garde la
  modale ouverte ; `PersonPicker` conserve sa sélection → risque de re-soumettre
  la même personne. Remonter le picker (via `key`) au succès.

### Décisions FINALES proposées
1. **#29 portée** : cohorte de la **phase de l'atelier** (pas toutes les inscrites).
2. **#29 activer toutes** : **union/additive** (jamais de retrait silencieux) + garde cohorte vide.
3. **#29 toutes présentes** : conservée ; **proposition : n'affecter que les `non_renseignee`** (ne pas écraser un `absente` pointé). *(à confirmer)*
4. **#28 nom** : garder un champ `nom` optionnel visible à côté du picker (préserve la complétion d'un compte sans nom). *(à confirmer)*
5. **#28 périmètre** : `AddCoachDialog` + `AddParticipanteDialog` ; pas de picker sur la fiche atelier (interrupteurs suffisent).
