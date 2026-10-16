# Refonte UX/UI des fiches Tremplin — conception cible

> Fait suite à `docs/audit-ux-mobile-2026-07.md` (le constat) : ce document est
> la **cible**. Il refond le système de fiches — édition, atelier, participante,
> coach, espaces — au lieu de corriger écran par écran. Basé sur les 16 écrans
> réels capturés (parcours public, orga, participante, coach) et les captures
> prod de l'orga.
>
> **Statut : à valider avant implémentation.** Les lots sont en §9.

## 1. Le diagnostic de fond (au-delà des symptômes)

L'audit liste des défauts ; quatre **causes racines** les produisent tous :

1. **Des fiches qui ne montrent rien.** Le hub-and-spoke a été poussé jusqu'à
   l'os : une fiche (atelier, édition) n'est qu'une pile de portes
   (« Informations › », « Coachs › », « Visio › »). Pour répondre à « c'est
   quand, où, avec qui ? », il faut 2-3 navigations. Une fiche doit d'abord
   **montrer son objet**, puis donner les portes de gestion.
2. **Le vide crie.** Tout champ non rempli devient une alerte orange
   (« À trouver », « À ajouter », « NON POINTÉE », « En retard ») sans
   péremption, sans regroupement, sans « Passer ». Résultat prod : 11 cartes
   « À faire » avant la navigation, des badges insoldables à vie. L'urgence ne
   veut plus rien dire.
3. **La chronologie n'est pas la colonne vertébrale.** Les listes sont
   sectionnées par phase (ateliers, participantes) : avril s'affiche sous
   septembre, les personnes apparaissent en double/triple, le « prochain
   rendez-vous » n'existe nulle part. Or l'objet réel de l'orga est un
   **planning** et celui de la participante un **agenda**.
4. **Trois vocabulaires pour un même monde.** « Activer / ranger / pointer »,
   présence tri-état ici, réalisation là, horaires normalisés dans une lib et
   pas l'autre (`18:30:00` dans l'espace coach). Chaque surface réinvente.

## 2. Le système (invariants de TOUTES les fiches)

### 2.1 Anatomie de fiche — « montrer, puis gérer »

```
┌───────────────────────────────┐
│ IDENTITÉ    titre plein (2 lignes ok)      │  qui/quoi + état en UNE phrase
│             méta humaine                    │  humaine, jamais un code
├───────────────────────────────┤
│ L'ESSENTIEL montré, lisible SANS tap        │  répond aux 3 questions de
│  (quand · où · qui · avancement)            │  l'objet ; chiffres réels
├───────────────────────────────┤
│ PORTES de gestion (NavRow)                  │  gestes secondaires, dialogs
├───────────────────────────────┤
│ ZONE DESTRUCTIVE (orange, en dernier)       │  paliers §10 des principes
└───────────────────────────────┘
```

Règle de lecture : depuis la fiche, **zéro tap** pour savoir ; **un tap** pour
gérer. (La règle d'or « une page = un rôle » est respectée : le rôle de la
fiche est de montrer ; les formulaires restent dans leurs portes.)

### 2.2 Système d'états — trois tons, pas un de plus

| Ton | Usage | Rendu |
| --- | --- | --- |
| **Neutre** | fait, à venir, daté | texte normal, pastille discrète |
| **À compléter** | manque non bloquant (date, lieu, coach) | UNE ligne regroupée par fiche (« 2 infos à compléter »), jamais un badge par champ |
| **Urgent** | bloque quelqu'un d'autre (consentement manquant, présences du DERNIER atelier passé) | orange, rare |

Péremption : un « à faire » lié à un événement **expire** quand l'événement
perd son sens (présences de phase 1 après la finale → archivé, une ligne
« Présences non pointées sur 5 ateliers passés · Compléter ou passer »). Tout
« à faire » offre **« Passer »** (mémorisé).

### 2.3 Vocabulaire unifié (une notion, un mot, partout)

| Notion | Mot | Où |
| --- | --- | --- |
| Appartenance à un atelier | **participe** | orga (interrupteur) |
| Présence à un rendez-vous collectif | **présente** | orga (case) |
| Réalisation d'une activité autonome | **fait le …** | orga + participante |
| Audience interne | **sélection / phase / toutes** (un choix exclusif) | orga |
| Récit public | **au programme public** (dérivé de l'audience : cohorte oui, sélection nominative jamais) | partout |

### 2.4 La chronologie comme structure

Toute liste d'événements est un **agenda** : tri chronologique, séparateurs de
mois, « Aujourd'hui » comme repère, prochain élément mis en avant, **passé
replié** (« 5 ateliers passés ▸ »), périodes affichées comme périodes
(« 7 → 13 sept. »). Les phases deviennent des **pastilles** sur les items, pas
des sections. Un seul composant de présentation (période, lieu, visio) partagé
par l'admin, les espaces et le public (« un composant, des capacités », §3 des
principes) — c'est lui qui élimine les `18:30:00` et les fausses dates uniques.

### 2.5 Mobile d'abord

Titres sur 2 lignes plutôt que tronqués (l'identité d'un item ne disparaît
jamais : « Revue croisée (1) » ≠ « (2) ») ; cibles ≥ 44 px ; 1 seul CTA
primaire par écran ; affordances d'ajout homogènes (un seul style).

## 3. Fiche ÉDITION (le cockpit de l'orga)

Aujourd'hui : mur de tâches (11 cartes) + compteurs. Cible :

```
Tremplin 2026 · DevFest Toulouse
Finale passée · 6 en préparation DevFest        ← état en une phrase

PROCHAIN RENDEZ-VOUS                            ← LA carte (une seule)
┌ MAR 1 SEPT · 18h-20h20 · BPCE Toulouse ┐
│ Lancement et structure du talk · 6 part. │
└──────────────────────────────┘
Programme : 10 à venir · 6 passés → Ateliers    ← ligne, pas 16 cartes

À FAIRE (2)                                     ← REGROUPÉ, plafonné, passable
• Présences à compléter sur 5 ateliers passés → · Passer
• 6 ateliers à dater → Ateliers

GÉRER L'ÉDITION                                 ← inchangé (bon aujourd'hui)
Ateliers · Participantes · Finale · Photos · Ressources
RÉGLAGES / SUPPRESSION                          ← inchangé
```

Le générateur de tâches apprend : regroupement par type, plafond (~3 lignes),
« Passer », péremption post-finale, et **plus de « donner une date » pour une
activité à période** (la fenêtre EST sa date).

## 4. Fiche ATELIER (l'événement) + liste

**Liste Ateliers** = agenda (§2.4) : chronologie, mois, passé replié, pastille
période (« 7 → 13 SEPT »), nature en pastille (« sous-groupes »), titres
2 lignes. Fini le groupement par phase en sections (la phase est une pastille).

**Fiche atelier** (sommaire refondu) :

```
Revue croisée entre speakeuses (1)
Après la soirée · En sous-groupes

QUAND   7 → 13 septembre (à caler dans la semaine)
OÙ      En visio, lien par sous-groupe          ← ou : lieu + « Rejoindre »
QUI     6 participantes · 2 participantes à ranger · autonome
AVANCEMENT  1 sous-groupe sur 2 a fait sa revue

Modifier les informations ›
Participantes ›                                 ← QUI participe
Sous-groupes ›   2 sous-groupes · 2 à ranger sur 6   ← COMMENT c'est réparti
Supports (0) ›
Supprimer l'atelier ›                           ← destructif, en dernier
```

- « Coachs · À trouver » disparaît en tant qu'alerte : pour un atelier
  autonome, l'absence de coach est un état **normal** (« autonome »).
- Le bloc « Lien de connexion » n'apparaît que pour la nature collectif.
- Les fausses alertes présences (« 3 présences à pointer » sur un atelier en
  sous-groupes) disparaissent : l'avancement affiché dépend de la nature.
- **Depuis le 01/08** : « qui participe » et « comment c'est réparti » sont deux
  rangées, donc deux pages (la répartition restait introuvable au fond de la
  page des présences), et la rangée « Sous-groupes » annonce le RESTE À RANGER
  plutôt qu'un simple compte. Détail : `docs/conception-sous-groupes-ateliers.md`
  §4 bis. La suppression de l'atelier ferme le sommaire (§4 ter).

## 5. Fiche PARTICIPANTE + liste

**Liste** : une personne = **une ligne** (fini les sections par phase qui
tripliquent : 22 cartes pour 10 personnes en prod).

```
[Filtres : Toutes · P1 · Finale · P3]           ← chips de filtre
Camille G.   ✓ ● ★ 🏆   P1·F·P3 ›
Léa D.       ✓ ●        P1 ›
```

**Fiche** : la timeline (bonne) est conservée et apaisée :

- En-tête enrichi : nom · talk pitché en une ligne · **coach** · **binôme** —
  ses liens stables, visibles sans navigation.
- Badges d'état : « fait le 7 sept. » / « à venir » / « à compléter » (§2.2),
  plus jamais « NON POINTÉE » en capitales ni de présence exigée sur une
  activité en sous-groupes ; dates localisées (« 28 avr. », plus de 2026-04-28).
- Une section de phase n'apparaît que si la participante y participe.

## 6. Espaces PARTICIPANTE et COACH

**Participante** : UN agenda unifié (plus de doublon programme / « Mes
sous-groupes ») :

```
TA COACH : Sofia · TON BINÔME : Camille          ← liens stables, en tête

AGENDA
┌ 7 → 13 SEPT · Revue croisée (1) · visio ┐
│ Avec Camille · Lien pour vous retrouver  │
│ Fait le [ 16/09 ] [Marquer fait aujourd'hui]│  ← défaut : aujourd'hui,
└─────────────────────────────┘     jamais de faux succès
┌ MAR 15 SEPT · 18h30-20h · Écrire son CFP ┐
│ BPCE Toulouse · Rejoindre la visio        │  ← lieu ENFIN affiché
└─────────────────────────────┘
```

**Coach** : même langage — ses ateliers en agenda (tri chronologique, horaires
normalisés HH:MM via le composant partagé, lieu affiché), ses coachées, ses
dépôts. La structure courte actuelle est bonne (§2 des principes) ; seul le
contenu des cartes s'aligne.

## 7. Le cycle de participation (invitées → réponses → venues)

> **Arbitrage orga (2026-07-30) : le RSVP intégré est REPORTÉ.** Les
> invitations partent par Google Meet/Agenda, qui collecte déjà les réponses —
> une deuxième boîte à réponses serait un doublon sans valeur aujourd'hui. Ce
> qu'on suit dans la plateforme : **qui est attendue** (l'inventaire
> « participe », existant) et **qui est réellement venue** (les présences,
> existantes — pointage à garder simple et rapide, cf. lot C). La conception
> ci-dessous reste consignée comme option future si le besoin d'une réponse
> in-app se confirme (ex. participantes hors Google Agenda) ; **le lot G n'est
> pas au plan.** Côté speakeuse, on garde du §7.3 la partie VISIBILITÉ (« tu es
> attendue », lieu, horaire, lien) — sans boutons de réponse.

Entre « celles qui doivent venir » et « celles qui sont réellement venues », il
n'y a aujourd'hui que deux états, tous deux posés par l'orga (l'inventaire
« participe », la présence pointée après coup). Conception (reportée) d'un
cycle en trois temps :

```
  ATTENDUE            SA RÉPONSE              VENUE
  (orga invite)   →   (speakeuse, avant)  →   (orga pointe, après)
  participe           j'y serai / absente     présente / absente
```

### 7.1 Modèle (minimal)

Une colonne sur l'appartenance (`tremplin_atelier_membres.reponse`) :
`sans_reponse` (défaut) | `jy_serai` | `absente`. Écrite par la **speakeuse
pour SA ligne** (même garde anti-IDOR que `fait_le` : identité de session,
appartenance vérifiée en SQL) ; l'orga peut corriger. La présence existante
reste la **vérité du réel**, pointée par l'orga — la réponse ne l'écrase
jamais, elle la **pré-remplit** (pointer les présences d'un atelier passé :
les « j'y serai » sont proposées cochées, un écart se corrige d'un tap).

Un atelier **ouvert à toutes** invite implicitement toutes les inscrites ; un
**réservé** invite nommément ses participantes. Le RSVP concerne les
rendez-vous **collectifs** ; les activités en sous-groupes ont déjà leur
« fait le … » (on ne double pas).

### 7.2 Côté orga — l'entonnoir, lisible d'un coup

Sur la fiche atelier (§4), la ligne QUI devient un entonnoir :

```
QUI   8 attendues · 6 ont répondu « j'y serai » · 1 excusée
      (après l'atelier) 8 attendues · 5 venues
```

Et la liste « Participantes et présences » affiche la réponse de chacune à
côté de son interrupteur (« j'y serai » / « absente » / « sans réponse ») —
l'orga sait AVANT la séance qui manquera, au lieu de le découvrir sur place.

### 7.3 Côté speakeuse — être attendue, répondre, retrouver son historique

Sur son agenda (§6), chaque rendez-vous collectif où elle est attendue :

```
┌ MAR 15 SEPT · 18h30-20h · Écrire son CFP ┐
│ BPCE Toulouse · Rejoindre la visio        │
│ Tu es attendue ·  [ J'y serai ]  [ Je serai absente ] │
└──────────────────────────────┘
```

- Un tap, modifiable jusqu'au jour J, état affiché en toutes lettres
  (forme positive : « J'y serai » / « Je serai absente », jamais de « ne …
  pas »).
- Un atelier ouvert où elle n'est pas nommée affiche « Ouvert à toutes » sans
  injonction.
- Après coup, sa fiche/son espace montrent son historique réel (« venue »),
  qui alimente déjà le compteur « venues aux ateliers » de l'orga.

## 8. Page PUBLIQUE d'édition — la vitrine

Son rôle est stratégique : **montrer ce qu'on fait** — aux futures candidates
(« voilà ce que tu vivras »), aux sponsors et partenaires (« voilà ce que vous
soutenez »), à la communauté. Elle doit raconter une édition VIVANTE, pas un
dépliant figé.

- **Le récit d'abord** : le kicker d'état dit où en est l'aventure en une
  phrase (« Finale le 4 juin · 3 gagnantes · en préparation du DevFest avec
  6 speakeuses »), pas un statut administratif (« Finale passée »).
- **Le parcours complet et véridique** : les ateliers dont l'audience vise une
  **cohorte** (toute l'édition, ou les rattachées d'une phase ; une sélection
  nominative reste dehors), avec **périodes** mais **sans lieu** — révision du
  2026-08-01 : publier OÙ et QUAND se retrouve un petit groupe identifiable
  n'avait pas sa place sur une page indexée, et le lieu vit désormais dans
  l'espace des inscrites. « Fait » sur le passé — la frise montre
  l'accompagnement réel, du premier atelier d'avril jusqu'à la scène du
  DevFest. C'est l'argument n° 1 du Tremplin : on accompagne VRAIMENT,
  30 semaines durant.
- **Structure scannable** : la page fait ~20 écrans mobiles ; on la découpe en
  actes lisibles (l'aventure en chiffres → le parcours → la finale et le
  palmarès → les speakeuses → la suite : DevFest → FAQ), chaque acte court,
  la FAQ en accordéon. Rien de nouveau à écrire : hiérarchiser l'existant.
- **Aucune donnée interne** : périodes, lieux et titres seulement — jamais
  l'inventaire nominatif, les présences ni les sous-groupes (DTO inchangé).

## 9. Lots de mise en œuvre (TDD ; captures avant/après par lot)

| Lot | Contenu | Corrige |
| --- | --- | --- |
| **A. Fondations d'affichage** | composant Période/Lieu/Horaire partagé ; DTO public enrichi ; espaces + sommaire + listes l'utilisent ; horaires coach normalisés | P0 fenêtre/lieu, `18:30:00`, fausses dates |
| **B. Hub cockpit** | prochain rendez-vous ; À faire regroupé/plafonné/passable/périmable ; fin du « dater » les activités à période | mur de 11 cartes |
| **C. Fiche atelier événement** | sommaire « montrer puis gérer », avancement selon nature (entonnoir §7.2), fin des fausses alertes | P1 nature |
| **D. Participantes** | liste une-ligne + filtres ; fiche apaisée (badges, dates, en-tête coach/binôme) | duplication, NON POINTÉE |
| **E. Espaces** | agenda unifié participante (fusion sous-groupes/programme, « fait » sans piège) ; agenda coach | doublon espace, P0 « Marquer fait » |
| **F. Liste ateliers agenda** | chronologie, mois, passé replié, pastilles période/nature | liste illisible |
| **G. Vitrine publique** | kicker narratif, parcours avec périodes/lieu/« Fait », découpage en actes, FAQ en accordéon | §8 : la page qui montre ce qu'on fait |

Chaque lot est livrable seul ; A est le prérequis de tous. Le RSVP (§7) est
REPORTÉ (arbitrage orga : Google Meet collecte déjà les réponses) — seul le
suivi des présences reste au plan (lot C). Les P2 de l'audit
(« Effacer » répétés, suppression en orange, libellés de selects, fil d'Ariane)
s'absorbent dans le lot qui touche leur écran.

## 10. Ce qu'on ne change PAS

Le hub-and-spoke (on le complète : les fiches montrent), les gardes serveur,
le modèle de données (la refonte est présentationnelle — seul le générateur de
tâches et un éventuel « passer » stockent un état), la palette et les
composants d'accessibilité existants (SettingToggle, dialogs, régions vivantes).

## 11. Navigation d'app pour les connectées (arbitrage orga, 2026-07-31)

> « Un footer type app avec 4 boutons quand on est connectée, et une home
> tableau de bord simple. » Décision : OUI — c'est la réponse d'architecture au
> manque d'agenda (le programme par édition n'en est pas un).

- **Barre d'onglets basse (mobile, connectées)** : **Accueil · Agenda ·
  Documents · Ma fiche**. Icône + libellé visible, `aria-current="page"`,
  cibles ≥ 44 px, safe-area iOS ; landmark `nav` dédié. Sur desktop, les mêmes
  pages restent accessibles par l'en-tête (la barre est mobile-first).
- **Accueil = tableau de bord SIMPLE** : bonjour, LE prochain rendez-vous,
  2-3 rappels maxi, raccourcis. Tout le reste vit dans son onglet.
- **Agenda = personnel et trans-éditions** : ateliers où elle participe ou
  anime, fenêtres en cours (avec « fait le … » in situ), et les JALONS
  (finale, jour de la conférence). Chronologie, mois, passé replié (§2.4).
- **Documents** : ses documents privés + les supports de ses ateliers, toutes
  éditions confondues (les gardes de visibilité existantes s'appliquent).
- **Ma fiche** : fiche speakeuse + talks (l'existant, re-ciblé).
- **Orga** : la barre sert l'espace personnel ; l'espace orga reste par le
  menu compte (un 5ᵉ onglet orga est une évolution possible, pas ce lot).
- **Rituel de livraison** : chaque lot est LIVRÉ (commit + push + captures) et
  passe les revues : réutilisation/simplification/efficacité/altitude + RGAA +
  RGPD (+ sécurité si actions/données touchées).

Les lots B→G restent, re-priorisés derrière un nouveau **lot H — coquille
d'app** (barre d'onglets + Accueil tableau de bord + Agenda personnel +
Documents), qui absorbe le volet « participante » du lot B (le cockpit orga
reste le lot B).
