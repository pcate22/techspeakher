# Conception technique — refonte hub Tremplin + modèles de page

> Applique le design système (`docs/design-system.md`) et les principes UX
> (`docs/principes-conception-ui.md`) à la plateforme Tremplin. Analyse UX
> chiffrée à l'origine : `docs/ux-admin-edition.md`.
>
> **Statut : conception VALIDÉE (revue + arbitrages du 2026-07-04).**
> Créé le **2026-07-04**.

## 0. Décisions tranchées (revue du 2026-07-04)

Revue à 3 angles (architecture/RSC, RGAA/RGPD, YAGNI/scope) + arbitrages orga :

1. **Création = page liste + MODALE** (pas de formulaire de création plein
   écran). Le hub reste un tableau de bord d'état ; chaque domaine a sa page
   liste ; l'ajout garde les **modales `AdminDialog` déjà fiabilisées iOS**.
   Cohérent avec la décision du 2026-07-03 (`ux-admin-edition.md` #2 : « les
   ajouts restent des modales »).
2. **Quick wins d'abord** : on livre le soulagement rapide (modale photo qui
   perd la saisie + filtre par nom sur les participantes) AVANT la refonte
   structurelle.
3. **Participantes en accès direct + filtre par nom** : le geste le plus
   fréquent (visibilité, finaliste) reste atteignable en 1 tap ; il n'est pas
   enterré sous la navigation.
4. **YAGNI sur les modèles de page** : seuls `NavRow`, `ListPageTemplate` et le
   pattern de création (modale `AdminDialog`) sont des composants.
   `HubTemplate`/`DetailTemplate` restent des **conventions de composition**
   documentées tant qu'ils n'ont qu'un usage.
5. **Découpage fin** : `AtelierDetail` = 1 PR par rôle ; les routes index = 1 PR
   par domaine. Pas de composant sans consommateur (tranches verticales).
6. **Invariant RGPD** (écrit et testé) : hub et pages index n'exposent que des
   **nombres**. Aucun email, motif, `userId`, ni liste d'ids côté client ; le
   nom/motif d'une personne bloquant une photo reste sur la fiche (tag orphelin
   = libellé anonyme « Personne n° … », cf. `photos-tremplin.md`).
7. **Invariant RGAA** : drapeau « à-traiter » jamais codé par la couleur seule
   (texte + `sr-only`) ; `<title>` distinct par route ; `Breadcrumb` obligatoire
   avec `aria-current="page"` ; suites de `NavRow` en `<ul>/<li>`.
8. **Invariant RSC** : `AtelierDetail` et ses appelants restent des composants
   **serveur** (sinon le render-prop `supportAction` casse) ; `NavRow` est
   **partagé** (server-safe), car `ParticipantesNav` (client) doit le rendre.

## 1. Objectif

1. La page édition orga devient un **hub** (état seulement) ; la création part
   sur des **pages liste par domaine**.
2. Les pages liste, création et fiche deviennent des **modèles de page** du
   design système, réutilisés par tous les domaines et les 3 rôles.
3. La présentation partagée entre orga / coach / participante est **mutualisée
   par capacités**, pas recopiée.

## 2. Architecture des routes

**Existant** (une seule page riche + fiches par item) :

```
/admin/tremplins/[edition]                    ← tout : listes + créations inline
/admin/tremplins/[edition]/ateliers/[atelier]
                          /participantes/[registration]
                          /photos/[photo]
                          /recompenses/[recompense]
```

**Cible** (hub + index par domaine) :

```
/admin/tremplins/[edition]                     ← HUB (5 NavRow, aucun formulaire)
/admin/tremplins/[edition]/ateliers            ← ListPageTemplate + CreateForm   (NOUVEAU)
                          /ateliers/[atelier]   ← DetailTemplate (existe)
                          /participantes        ← ListPageTemplate + CreateForm   (NOUVEAU)
                          /participantes/[id]    ← existe
                          /recompenses           ← ListPageTemplate + CreateForm   (NOUVEAU)
                          /recompenses/[id]       ← existe
                          /photos                 ← ListPageTemplate + CreateForm   (NOUVEAU)
                          /photos/[photo]          ← existe
                          /ressources              ← ListPageTemplate + CreateForm   (NOUVEAU)
```

Les fiches `[item]` existantes ne bougent pas (URLs stables). Le hub pointe vers
les index ; les index pointent vers les fiches. Le fil d'Ariane porte la
remontée (hub = « back » naturel du téléphone).

## 3. Le hub : que montre-t-il ?

Par domaine, une `NavRow` : **compteur + résumé + drapeau « à-traiter »**. Les
drapeaux orange (déjà calculés côté serveur aujourd'hui sur la page édition) :

| Domaine | Compteur | Drapeau à-traiter (orange) |
|---|---|---|
| Ateliers | nb ateliers | — (info : n ouverts / n réservés) |
| Participantes | nb inscrites | `nbSansCompte` sans compte relié |
| Récompenses | nb | récompenses `à attribuer` |
| Photos | nb | photos **bloquées** (tag non couvert = accord manquant) |
| Ressources | nb | — |

Aucune requête nouvelle : ces agrégats sont déjà dérivés dans
`[edition]/page.tsx` (`nbSansCompte`, `publiableIds`, statuts récompenses). On
les **déplace** dans le hub. Le sommaire ancré (`sections[]`) est **supprimé**.

Le drapeau « à-traiter » porte un **texte** (ex. « 2 sans compte relié ») + un
équivalent `sr-only`, pas seulement la couleur orange (§0.7). Le hub n'expose
que des **nombres** — aucun nom, email, motif ni liste d'ids (§0.6).

## 4. `AtelierDetail` — mutualisation par capacités (portée réaliste)

**Ce qu'on mutualise** : la **coque de présentation** aujourd'hui recodée 3× —
en-tête (titre, date/heure normalisée `HH:MM`, coach, visio) + **supports**
(`DocList`). C'est le tronc commun orga / coach / participante.

**Ce qu'on NE mutualise pas** : la gestion lourde propre à l'orga (membres,
présences tri-état, CRUD coachs). Elle reste sur la fiche orga, en
`CarteSection` autour de la coque commune. Vouloir tout fusionner créerait un
composant paramétré à l'excès (anti-altitude).

Contrat :

```tsx
type AtelierViewCaps = {
  peutDeposer?: boolean;       // coach : dépose des supports
  voitDocsPrives?: boolean;    // participante : bloc « mes documents »
};

<AtelierDetail
  atelier={{ titre, date, heureDebut, heureFin, coachLabel, lienVisio }}  // sérialisable
  as="h1" | "h2" | "p"         // niveau/élément du titre : les 3 rendus diffèrent
  wrapper="section" | "li" | "none"  // conteneur : orga=fiche, coach=section, participante=li
  supports={DocListItem[]}
  supportAction={(doc) => ReactNode}   // optionnel (suppr. selon rôle) — réf. Server Action côté client OK
  caps={AtelierViewCaps}
/>
```

**Attention (relevé en revue)** : les 3 rendus actuels divergent au-delà de la
coque — conteneur + niveau de titre (orga `h1` standalone, coach `section/h2`,
participante `li` sans titre) → d'où `as` / `wrapper`. Et la date est formatée
différemment (orga court, coach long, participante **ISO brut**) + l'heure passe
en `HH:MM` : la normalisation est donc un **changement d'affichage assumé** pour
coach et participante, à couvrir par les tests (pas une extraction neutre).

`AtelierDetail` est un **composant serveur** : il reçoit des données
sérialisables + des booléens de capacités + éventuellement des références de
Server Actions (transmissibles à `InlineActionForm`, qui est client). Il ne lit
jamais la session ni la base : **la donnée et l'autorisation restent côté page**
(orga charge tout ; coach `getCoachAteliers` ; participante ne reçoit que les
docs partagés). Le composant *affiche*, il ne *décide* pas.

## 5. Frontière RSC (point de vigilance)

- `ListPageTemplate`, `DocList`, `AtelierDetail` = **composants serveur** (pas
  d'état, pas de handler).
- `NavRow` = composant **partagé** (server-safe, aucune dépendance server-only) :
  `ParticipantesNav` est client (`useState` du filtre) et doit pouvoir le rendre —
  un composant client ne peut pas importer un composant serveur.
- Seul `InlineActionForm` (et `ConfirmSubmitButton`, `ParticipantesNav`) est
  client. Les composants serveur lui passent une **référence de Server Action**
  et des specs de champs **sérialisables** — jamais une fonction de rendu vers
  le client. Le `action` / `supportAction` en render-prop reste **exécuté côté
  serveur** (il produit du JSX serveur incluant le client `InlineActionForm`).

## 6. Phasage (incréments TDD, 1 PR par lot)

**Quick wins d'abord (décision ②), puis composants partagés, puis structure.**

- **Lot 0a — modale photo** — ✅ **déjà en prod** (`AddPhotoDialog` = `AdminDialog`,
  saisie conservée).
- **Lot 0b — filtre par nom participantes** — ✅ **déjà en prod**
  (`ParticipantesNav`, filtre instantané + `role="status"`).
- **Lot 1 — `DocList` mutualisé** — ✅ fait (7 tests verts), câblé aux 3 usages.
- **Lot 2 — `AtelierDetail`** : coque commune + tests par matrice de capacités,
  **1 PR par rôle** (participante lecture, puis coach dépôt, puis orga). Il a
  **3 consommateurs existants** → extraction justifiée (pas spéculative). Le
  contrat porte `as`/`wrapper` (cf. §4) ; la normalisation `HH:MM` est assumée.
- **Lot 3 — routes index, 1 PR par domaine** (`…/ateliers`, puis `/photos`,
  `/recompenses`, `/ressources`) : listes + modale d'ajout, hors du hub.
  `ListPageTemplate` extrait avec sa 1ʳᵉ page réelle.
- **Lot 4 — `NavRow`** (composant *partagé*, server-safe) : extrait **quand son
  2ᵉ consommateur apparaît** (le hub + les lignes des pages index), pas avant
  (YAGNI). `ParticipantesNav` et les lignes du hub migrent alors dessus.
  **`EditionListItem` reste à part** (année inline, route publique ISR).
- **Lot 5 — le hub** : `[edition]/page.tsx` réduit à des lignes + drapeaux
  (équivalent texte, cf. §0.7) ; sommaire ancré supprimé.

`HubTemplate`/`DetailTemplate` : **conventions de composition** documentées, pas
des composants, tant qu'ils n'ont qu'un usage (décision ④). Chaque lot :
rouge → vert → refactor, CI verte, mergé seul.

## 7. Stratégie de tests

- **Composants** (Vitest + Testing Library) : `DocList` (fait), `NavRow` (lien,
  badges, drapeau, troncature), `AtelierDetail` (matrice caps : coach voit le
  dépôt, participante voit ses docs privés, aucun ne voit la gestion orga).
- **Modèles de page** : rendu des slots, état vide, présence du `CreateForm`.
- **Server Actions** : inchangées (déjà couvertes) ; on vérifie que les gardes
  (`requireOrgaId/CoachId/UserId`) restent en tête des nouvelles pages index.
- **E2E** : agnostiques aux données ; smoke sur la navigation hub → index →
  fiche.

## 8. Risques & décisions — TRANCHÉS

Toutes tranchés en §0 (revue + arbitrages orga du 2026-07-04) :

1. Coût navigation +1 tap à la création : **accepté**, atténué par les modales
   (pas de page de création séparée) et le filtre participantes (§0.1, §0.3).
2. Participantes : **accès direct + filtre par nom** (§0.3).
3. `AtelierDetail` limité à la coque (en-tête + supports) : **validé** ; contrat
   complété (`as`/`wrapper`, cf. §4).
4. Ampleur : **1 PR par lot**, découpée par rôle/domaine (§0.5, §6).
5. Modèles de page : **YAGNI** — `NavRow` + `ListPageTemplate` + pattern modale
   seulement ; `HubTemplate`/`DetailTemplate` = conventions (§0.4).

## 9. Hors scope

Pas de hub pour les espaces coach / participante (déjà légers). Pas de refonte
des Server Actions ni du schéma DB. Pas de nouveau domaine fonctionnel.
