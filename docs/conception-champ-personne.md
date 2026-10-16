# Conception — champ « personne » autocomplété + création (coachs)

> Remplace, **pour les coachs**, le trio actuel (liste déroulante d'e-mails +
> champ e-mail + champ nom) par un champ où l'on **tape un nom**, qui **propose
> les comptes existants** et permet d'en **ajouter plusieurs**, ou de **créer**
> une personne absente. Demande orga (recette hub, 2026-07-04).
>
> Design système : `docs/design-system.md`. Principes : `docs/principes-conception-ui.md`.
>
> **Statut : conception (révisée après arbitrages) — à valider avant implémentation.**

## 0. Arbitrages orga (tranchés)

1. **Candidates d'atelier : on garde les cases à cocher.** Elles sont déjà
   inscrites à l'édition (une dizaine) ; ajouter une candidate à un atelier =
   cocher parmi les inscrites. **Hors périmètre** de ce composant.
2. **Multi-sélection : oui.** Un atelier a plusieurs candidates (cases) **et
   plusieurs coachs / animatrices** → le champ coach doit permettre d'en
   ajouter **plusieurs**.
3. **Périmètre recentré : les COACHS.** C'est là qu'était le vrai souci
   d'e-mails. (La modale « Ajouter une participante » a le même trio ; adoption
   **optionnelle** plus tard, cf. §5.)

## 1. Problème (UX coach actuelle — `AddCoachDialog`)

Pour désigner **une** personne, trois entrées coexistent : un `<select>` « Un
compte de la plateforme » (options = e-mails/noms), **+** un champ e-mail, **+**
un champ nom (**+** genre). On doit reconnaître un e-mail au lieu de taper un
nom, « choisir » et « créer » sont deux mécaniques distinctes, et pour plusieurs
coachs il faut rouvrir la modale à chaque fois.

## 2. Proposition : `PersonPicker` (combobox), multi

Un **combobox accessible** (patron ARIA `combobox` + `listbox`), client :

1. On **tape un nom** → la liste des comptes se filtre au fil de la frappe
   (insensible casse/accents, comme `ParticipantesNav`).
2. On **sélectionne une ou plusieurs** personnes existantes (jetons retirables).
3. Si absente → **« Créer “Nom tapé” »** révèle, dans le même flux, les champs
   minimaux (**e-mail + genre**) ; à l'ajout, la personne est invitée (compte
   pré-créé, profil coach) et reliée à sa 1ʳᵉ connexion.

```tsx
<PersonPicker
  name="coachIds"                    // ids sélectionnés (multi)
  candidats={{ id: number; label: string; sousTitre?: string }[]}  // comptes, sérialisable
  multiple                           // plusieurs coachs par atelier
  placeholder="Tape un nom…"
  creation={{ champs: ["email", "genre"], aide: "…" }}  // « Créer … »
/>
```

- **Client**, filtrage **côté client** (comptes ~dizaines → pas de requête).
- Reçoit une **liste sérialisable** (nom en label ; e-mail seulement en secours
  si le compte n'a pas de nom). Le picker **ne crée rien** : il porte la
  sélection et révèle les champs de création ; la **Server Action `addCoachAction`
  reste la source de vérité** (adaptée pour accepter plusieurs ids existants +
  éventuellement une création).

## 3. A11y & frontière RSC

- **Patron ARIA combobox** : `role="combobox"` + `aria-expanded` +
  `aria-controls` sur l'input ; `role="listbox"`/`option` ; navigation clavier
  (↑↓, Entrée, Échap, Backspace retire le dernier jeton) ; `aria-activedescendant` ;
  nombre de résultats annoncé (`role="status"`) ; focus visible partout ; cible
  tactile ≥ 44 px.
- **Client** rendu dans `AdminDialog` ; la page serveur passe `candidats`
  (sérialisable). Le picker ne lit ni session ni base.
- **RGPD** : label = **nom** ; e-mail en secours seulement, contexte orga ;
  genre facultatif, jamais public (statistiques de mixité).
- **Mobile** : largeur pleine (garde contrôles de formulaire déjà en place).

## 4. Impact serveur

`addCoachAction` accepte aujourd'hui `compteId` **ou** (`email` + `nom` + `genre`).
À étendre pour : **une liste d'ids** (ajout groupé d'existants) **+** un bloc
création optionnel. Les gardes restent (identité par session, scope édition,
`markUserAsCoach`, validation Zod). Pas de changement de schéma.

## 5. Décision — tranchée

- **Modale « Ajouter une participante »** : adoption du picker **PLUS TARD**
  (décidé). On se concentre sur les coachs ; la participante s'ajoute une par
  une avec sa phase, moins prioritaire.

## 6. Phasage (TDD, après validation)

- **Lot 1** : `PersonPicker` (client, multi + création) + tests (filtre,
  clavier, ARIA, jetons, « créer »).
- **Lot 2** : brancher sur **coach** (`AddCoachDialog` → picker multi ;
  `addCoachAction` étendue aux ids multiples + création) + tests de l'action.

## 7. Hors scope

Cases à cocher des candidates d'atelier (conservées). Recherche serveur (listes
courtes). Changement de schéma. Participante-add (optionnel, §5).
