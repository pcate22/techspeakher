# Audit du menu compte (lanceur d'espaces) — speakeuses & orga

> Audit UX du **menu compte** (header desktop + tiroir mobile) pour les deux
> rôles (speakeuse, orga), mené à la demande de l'orga. Ce document trace les
> **constats**, les **décisions prises**, ce qui est **livré**, et ce qui
> **reste ouvert** — pour ne pas reperdre le raisonnement d'une session à
> l'autre. Voir aussi la revue globale : `docs/revue-ux-rgaa.md`, et la
> roadmap produit : `docs/roadmap.md`.
>
> Dernière mise à jour : **2026-07-26**.

## Contexte

Le menu compte est le **lanceur d'espaces** de la personne connectée : il donne
accès à son espace membre, à sa fiche speakeuse et, pour une orga, aux accès
rapides d'administration. L'audit a couvert la **cohérence desktop/mobile**, la
**conscience du rôle** (afficher les bonnes entrées sans les dupliquer), et les
**impasses** (CTA menant à du vide).

## Constats de l'audit

1. **Incohérences desktop/mobile** : les deux surfaces n'exposaient pas les
   mêmes entrées ni le même vocabulaire.
2. **Entrées manquantes** : pas d'accès direct « Ma fiche speakeuse », pas de
   « Tremplin en cours » côté orga, pas de raccourci « ＋ Ajouter un article ».
3. **Bug « Mes talks »** : ancre morte (atterrissage en haut de page sans
   feedback) ; et une **fuite de rôle** à supprimer.
4. **Impasse « Ma fiche »** : un compte **sans fiche** ne voyait aucune
   invitation à en créer une — le menu restait muet.
5. **Attestation en cul-de-sac pour les personnes non binaires** : la carte
   d'onboarding était proposée à tout compte non « homme », mais l'attestation
   demandait « être une femme » — sans issue pour une personne non binaire.
6. **Double rôle peu lisible** : un compte à la fois orga ET speakeuse voyait
   les deux jeux d'entrées empilés sans hiérarchie.

## Décisions prises

- **Menu role-aware, une source par capacité** : les entrées apparaissent selon
  le rôle réel, jamais par copie desktop→mobile.
- **Personnes non binaires accueillies** dans l'annuaire. On **élargit
  l'attestation** (« femme ou personne non binaire ») mais on **conserve
  l'identité de marque** « communauté de femmes de la tech » partout ailleurs.
  Le champ interne `isWoman` est **gardé** (contrat BDD + garde serveur), seul
  le libellé affiché porte le sens.
- **Le menu incite à créer sa fiche** quand le compte est éligible et sans
  fiche (même garde que la carte d'onboarding : genre ≠ « homme »).
- **Double rôle** : les deux zones sont **nommées** (« Espace speakeuse » /
  « Espace orga »), jamais distinguées par la seule couleur. Une speakeuse
  « pure » garde un menu court, sans intitulé redondant.
- **Essentiels orga** : laissés **tels quels** (pas de curation supplémentaire à
  ce stade — décision assumée, à rouvrir si le menu s'allonge).

## Livré

### Lot 1 — menu role-aware et cohérent (PR #213)

- « Ma fiche speakeuse », « Mes talks », « Tremplin en cours »,
  « ＋ Ajouter un article » ; harmonisation desktop ⇄ tiroir mobile.
- **Bug corrigé** : « Mes talks » (ancre réelle) + **fuite de rôle supprimée**.

### Lot 2 — non binaire + incitation à créer + double rôle (PR #228)

- **Attestation élargie** (`ProfileForm`, message d'erreur `mon-espace/page`,
  hint de la checklist `espace.ts`) — le champ `isWoman` est inchangé.
- **« Créer ma fiche speakeuse »** (→ `/mon-espace/profil`) proposé à tout
  compte éligible sans fiche, sur desktop et mobile. Nouveau champ serveur
  `AccountMenuData.peutCreerFiche` (le `genre` n'est **jamais** sérialisé, seul
  le booléen l'est ; le court-circuit évite d'interroger le genre si une fiche
  existe déjà).
- **Libellé « Espace speakeuse »** pour un compte double rôle.
- **Menu jamais figé** : le Header vit dans le layout et persiste entre les
  pages ; il re-récupère ses données à chaque navigation (`usePathname`), sinon
  il proposerait « Créer ma fiche » juste après qu'on l'a créée.

### Vérification — fuite de rôle

Aucune fuite résiduelle : le DTO `PublicSpeaker` est une **projection explicite**
(ni rôle, ni e-mail, ni userId, ni statut), `/api/account-menu` ne renvoie que
`fiche`/`peutCreerFiche`/`tremplin`, et `ModerationPanel` (fiche publique) n'est
rendu qu'à un **viewer orga** (gate serveur). Le rôle de la personne connectée
utilisé côté client est le sien (session), ce qui n'est pas une fuite.

## Reste ouvert

- **Premier article d'accompagnement** (« Où héberger tes slides ? ») : purement
  **éditorial**, le socle technique existe (éditeur orga `/admin/contenus` +
  `/articles/[slug]`), cf. `docs/roadmap.md`.
- **Recherche de l'annuaire + accès orga** : UX à revoir (recherche d'abord,
  filtres repliables) et point d'entrée orga à concevoir, cf. `docs/roadmap.md`.
- **Curation des essentiels orga** : à rouvrir si le menu s'allonge.
