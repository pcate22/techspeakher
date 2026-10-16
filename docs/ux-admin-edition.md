# UX admin d'une édition — analyse et architecture cible

> Analyse du 2026-07-03, suite au constat orga (sur téléphone) : « l'UX de
> cette page à rallonge est vraiment pourrie ». Page auditée :
> `/admin/tremplins/[edition]` (616 lignes de JSX). Données de référence :
> 5 ateliers, 12 inscriptions, 15 documents, 10 photos.

## 1. Diagnostic chiffré

Avec les données de référence, la page rend :

- **105 formulaires** dans le DOM (84-96 inline + 21 modales) ;
- **88 boutons visibles** (105 avec les dépliants ouverts), dont des groupes au
  libellé strictement identique : « Supprimer » × 25, « Retirer de
  l'édition » × 12, « Enregistrer les détails » × 12, bascules visibilité et
  finaliste × 12 chacune — différenciés par le seul `aria-label` ;
- **~7 600 px de haut** sur un téléphone (390 px de large), soit **11-12
  écrans** à faire défiler (17 si les `<details>` sont ouverts). La 12ᵉ
  participante est à l'écran 8, le formulaire photo à l'écran 11-12 ;
- **5 arrêts de navigation par titres** (1 h1 + 4 h2) pour ces 12 écrans :
  aucun titre par participante/atelier/photo, aucune ancre, rien de sticky,
  aucune recherche ni filtre.

### Le coût réel des parcours (mesuré dans le code)

10 des 14 actions serveur terminent par un `redirect(?ok=…)` : navigation
complète → **scroll remis en haut** (où vit la bannière), **les 17 `<details>`
se referment**, 6 requêtes DB rejouées. Et la bannière ne nomme jamais la
personne concernée (« Détails publics enregistrés. »).

| Tâche orga réelle | Coût mesuré |
|---|---|
| Marquer la 12ᵉ participante finaliste et vérifier | 1 tap, 1 reload, **~16 écrans de scroll cumulé** |
| Basculer la visibilité (consentement) de 3 personnes | 3 taps, 3 reloads, **~20-24 écrans** — le geste le plus sensible RGPD de la page |
| Corriger la récompense d'une gagnante | 3 taps, 1 reload, ~16 écrans, le dépliant se referme |
| Photo taguée 6 personnes avec URL erronée | **saisie intégralement perdue** (URL, légende, 6 cases), re-scroll de 11 écrans, tout ressaisir |
| Retour jury pour 8 personnes (modale) | 24 taps, **0 reload, scroll conservé** — le seul parcours sain |

Le contraste du dernier parcours EST le diagnostic : les 4 actions passées en
modale (`AdminDialog` : état conservé, saisie restaurée sur erreur, feedback
nominatif dans la modale, focus géré) fonctionnent bien ; les 10 actions
redirect détruisent le contexte à chaque micro-geste.

## 2. Causes racines

1. **Une page = 4 domaines × N items, tout en mode ÉDITION.** Chaque ligne
   embarque ses ~6 formulaires en permanence, alors que 95 % du temps l'orga
   consulte. Le mode édition devrait être demandé, pas subi.
2. **Pattern redirect (PRG) appliqué à des micro-actions.** Correct pour un
   formulaire de page entière, destructeur pour une bascule dans une liste de
   12 écrans : perte de scroll, d'état des dépliants, feedback anonyme à
   l'autre bout de la page, `?ok=` qui reste dans l'URL.
3. **Aucune identité navigable par item** : pas de titre, pas d'ancre, pas de
   sous-page — donc pas de « aller à Marie », ni de retour après action.
4. **Formulaires d'entrée à position fixe** (photo tout en bas) au lieu d'être
   invocables là où on est.

## 3. Architecture cible

### Niveau 1 — la page d'édition devient un TABLEAU DE BORD

En-tête (statut dérivé + modale « Modifier l'édition », déjà en place), puis
4 sections **compactes en consultation seule** :

- une ligne par atelier / participante / photo = **un lien** vers son niveau 2,
  avec nom + badges (✓ rattachée, ● publique, ★ finaliste) + compteurs ;
- une **mini-nav sticky** (Ateliers · Inscriptions · Photos · Ressources) ;
- un **filtre par nom** au-dessus des inscriptions (12 items : filtrage
  client trivial) ;
- les ajouts restent des modales (+ Participante, + Atelier, + Document,
  **+ Photo — à convertir**, dernier formulaire inline majeur).

Résultat attendu : la page passe de ~12 écrans à **~3-4 écrans**, ~90
formulaires en moins, plus aucun bouton dupliqué.

### Niveau 2 — une sous-page par participante et par atelier

`/admin/tremplins/[edition]/participantes/[id]` : h1 = son nom, ses badges,
et TOUTES ses actions (visibilité, finaliste, détails publics, rattachement,
documents privés, retrait). Idem `/ateliers/[id]` (membres, coachs, visio,
supports).

Pourquoi une sous-page plutôt qu'un menu « ⋯ » ou un panneau :

- le **bouton retour du téléphone** fait office de « fermer », geste naturel ;
- URL partageable entre orgas (« regarde la fiche de Marie ») et re-visitable ;
- une page courte : les actions redirect y deviennent quasi inoffensives le
  temps de les migrer (reload d'une page d'un écran, feedback visible) ;
- pas de piège de focus long ni de modale-gigogne à gérer.

### Transversal — finir la migration des actions vers le pattern « résultat »

Les bascules et suppressions passent en `useActionState` + `router.refresh()`
(l'infra `AdminDialog`/`action-state` existe) : plus de reload complet, plus
de scroll perdu, feedback **inline et nominatif** à côté du bouton, les
bannières `?ok=`/`?err=` de haut de page disparaissent avec leurs codes.

## 4. Parcours cibles (mêmes tâches, après refonte)

| Tâche | Aujourd'hui | Cible |
|---|---|---|
| 12ᵉ participante finaliste + vérif | 16 écrans, 1 reload | filtre « Ma » → fiche → 1 tap, badge mis à jour sur place |
| Visibilité de 3 personnes | 20-24 écrans, 3 reloads | 3 × (fiche → 1 tap), 0 reload, retour = back |
| Photo à l'URL erronée | saisie perdue, 22-33 écrans | modale : erreur inline, saisie conservée |
| Récompense d'une gagnante | dépliant refermé, 16 écrans | fiche → formulaire court, confirmation sur place |

## 5. Phasage proposé

- **Lot A — vite fait, gros gain (S)** : modale « + Ajouter une photo »
  (supprime le pire formulaire) ; h3 + ancres par item ; mini-nav sticky ;
  filtre par nom ; nettoyage du `?ok=` de l'URL après affichage.
- **Lot B — la refonte (M)** : sous-pages participante et atelier ; la page
  d'édition devient tableau de bord ; migration des actions restantes vers le
  pattern résultat ; suppression des bannières et codes devenus inutiles.
- **Lot C — finitions (S)** : messages nominatifs partout, tri/filtres
  supplémentaires si besoin (par statut : non rattachées, publiques…).

## 6. Décisions produit — TRANCHÉES (2026-07-03)

1. **Fiche par participante** (et par atelier). Pas de menu « ⋯ » : navigation
   profonde à la « Comptes Google » (cartes titre + sous-titre descriptif →
   page dédiée), référence UX validée par l'orga.
2. **Les modales sont réservées aux ajouts rapides** et doivent être
   IRRÉPROCHABLES : un bug réel constaté sur iOS (dialog décalé à droite,
   coupé, sans titre ni bouton visibles, pas de défilement interne) → coquille
   à refaire : bottom sheet plein écran-largeur sur mobile, carte centrée sur
   desktop, en-tête (titre + fermer) et pied (actions) fixes, corps défilant,
   positionnement explicite (pas de dépendance aux styles UA du `<dialog>`).
3. **Tri alphabétique** des participantes.
4. **Exigence renforcée sur le wording** : chaque libellé relu — nominatif,
   descriptif, sans jargon (« aucune cochée = ouvert à toutes » et consorts à
   réécrire), sous-titres explicites sur les cartes comme dans la référence. (aujourd'hui : ordre d'insertion).

## 7. Acquis à conserver tels quels

`AdminDialog` (saisie à la chaîne, restauration sur erreur, régions vivantes),
les badges et compteurs alignés sur la page publique, les confirmations
nominatives des gestes destructifs (`ConfirmSubmitButton`), les gardes
serveur scopées à l'édition.

## 8. Mutualisation entre rôles (orga / coach / participante)

> Constat 2026-07-04 : le même objet est aujourd'hui recodé pour chaque rôle.
> La fiche atelier existe en 3 variantes (`/admin/.../ateliers/[id]`,
> l'espace coach, « Le programme » de la participante) et `DocList` est réécrit
> **3 fois** (dans `TremplinEspace`, dans coaching, inline chez l'orga). Le
> recouvrement est réel — mais il est au niveau des **écrans de détail**, pas
> du hub.

**Règle** : un objet vu par plusieurs rôles = **un composant de présentation
partagé, piloté par une prop de capacités** — jamais une copie par rôle. Voir
le principe général : `docs/principes-conception-ui.md` (§3).

| Écran | Orga | Coach | Participante |
|---|---|---|---|
| Liste d'ateliers | tout, éditable | ses ateliers (dépôt) | « Le programme » (lecture) |
| **Fiche atelier** | pleine édition | son atelier + dépôt | atelier + supports (lecture) |
| Liste de documents | ajout/suppr. tous | dépôt + suppr. les siens | lecture (partagés + privés) |
| Participantes | fiche complète | ses coachées | elle-même |

Composants cibles :

- **`AtelierDetail`** — coque commune (titre, date/heure, visio, supports),
  prop `capabilities` (`peutEditerInfos`, `peutGérerParticipantes`,
  `peutDéposer`, `voitDocsPrivés`). La donnée et l'autorisation restent côté
  serveur : chaque page-rôle ne charge que son périmètre et ne passe que son
  DTO ; le composant ne décide rien, il affiche.
- **`DocList`** — extrait une bonne fois (aujourd'hui dupliqué 3×), avec une
  action de suppression optionnelle selon `estAuteur` / rôle.

**Ce qu'on NE mutualise PAS** : la structure de navigation. Le hub (tableau de
bord) est une réponse à la surcharge de la page orga ; les espaces coach et
participante sont déjà légers (2-3 sections) et ne prennent pas de hub. On
partage le vocabulaire visuel, pas le gabarit de nav (`principes-conception-ui.md`
§2).
