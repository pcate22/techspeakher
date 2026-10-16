# Conception — Audit espace orga, Lot A (bugs + a11y + typo + états vides)

> Suite de l'audit UX de l'espace orga. Lot A = correctifs contenus, faible
> risque, fort impact, testables. Les lots B (cycle de vie), C (navigation),
> D (systématisation) suivent, chacun dans le pipeline complet.

## Items

### Bugs de saisie / interaction
- **A1 — restauration de saisie des modales d'invitation.** `AddParticipanteDialog`
  et `AddCoachDialog` passent un render-prop `() => …` qui ignore `state` ; sur
  erreur serveur, React 19 vide le formulaire et la saisie du bloc de création
  (e-mail, genre, nom) est perdue. Fix : `(state) => …` + `defaultValue={restoredValue(state, "…")}`
  comme le font déjà `EditEditionDialog`/`AddEditionDialog`.
- **A2 — Échap dans PersonPicker ferme toute la modale.** Le `<dialog>` natif capte
  Échap (action `cancel`). Fix : quand la liste est ouverte, `e.preventDefault()`
  + `e.stopPropagation()` avant `setOpen(false)` — Échap replie d'abord la liste.
- **A4 — sélection + bloc « inviter » coexistent.** `creer()` ne vide pas la
  sélection → un `compteId` + un e-mail partent ensemble → rejet serveur. Fix :
  en mode simple (`!multiple`), vider la sélection à l'ouverture du bloc création.

### Accessibilité (RGAA)
- **A3 — PersonPicker : `aria-expanded`/`aria-controls` fantômes + live region vide.**
  Quand 0 résultat, `aria-expanded=true` et `aria-controls` pointent une listbox
  absente. Fix : dériver de `open && itemCount > 0`. Et rendre la région d'état
  « Aucune personne… » PERSISTANTE (montée en permanence, texte mis à jour) pour
  une annonce fiable.
- **A5 — descriptions de `SettingToggle` non liées.** Le nom accessible n'est que
  `aria-label` ; la description (conséquence du toggle) et la note « s'enregistre
  automatiquement » ne sont pas reliées. Fix : `id` sur la description + note,
  `aria-describedby` sur le bouton `role=switch|checkbox`.
- **A6 — divulgation du contrôle dépendant.** `ToggleWithDependent` révèle un
  contrôle sans relation programmatique. Fix : `SettingToggle` accepte
  `controlsId`/`expanded` optionnels ; le bouton porte `aria-expanded`/`aria-controls`,
  la région dépendante reçoit l'`id`.
- **A11 — genre coach : obligatoire annoncé mais non appliqué.** Le `<select>`
  n'est rendu que dans le bloc création → le marquer `required` + indicateur
  visible « (obligatoire) » (+ `sr-only`).

### Mobile / cibles
- **A7 — focus masqué par les deux barres collantes.** `html { scroll-padding-top }`
  ≈ 6rem (header 64px + fil d'Ariane ~33px) : les ancres et le focus ne passent
  plus sous les barres.
- **A8 — cibles tactiles < minimum** sur des actions destructrices et de fermeture :
  boutons texte `px-0 py-0` (garder une hauteur de frappe), `×` des chips
  PersonPicker (`p-1 -m-1`), `×` Fermer d'`AdminDialog` (`p-3`).

### Contenu / typo
- **A9 — nbsp + jargon.** Insérer l'espace insécable avant `? ! : ;` dans les
  chaînes admin affichées ; corriger « vois les logs » → « préviens l'équipe
  technique » ; « Saisie historique » → « Coachs saisis en texte libre ».
- **A10 — états vides utiles.** Ajouter un slot `empty` à `ListPageTemplate` et
  des messages qui pointent l'action de création (comme le fait déjà la Finale),
  pour ateliers/jury/photos/récompenses/ressources/participantes.

## Hors Lot A (reporté)
- Association erreur↔champ (`aria-invalid`/`aria-describedby` par champ) : demande
  des clés d'erreur par champ côté actions → plus lourd, ira en lot ultérieur.
- Extension du test typographique à `src/app/admin` : dette (éviter les régressions).

## Principe
Aucun changement de comportement métier ; que des correctifs de robustesse,
d'a11y et de copie. Tests d'abord là où c'est observable (restauration, aria,
slot `empty`, genre requis) ; inspection pour le purement visuel (scroll-padding,
padding tactile).
