# Conception détaillée — Lot N2 : le fil sur l'Accueil

> Statut : **exécutée sur maquette validée** (fil de fer v5.1, journée du
> 2026-08-07 avec Cateline : « l'accueil c'est le fil façon réseaux », fil
> PUR sans carte perso). Cateline a délégué l'enchaînement des lots dans la
> nuit du 2026-08-07 (« Tu continues lot par lot ») : les derniers choix de
> détail (copie des cartes, seuil, redistribution du hub) sont documentés
> ici et RÉGLABLES à son réveil — chacun tient en une retouche. Décline
> `conception-espace-fil-navigation.md` (§0 doctrine, §4 fil, §10
> conséquences, §11 lot N2).

## 1. Objectif du lot

L'onglet Accueil cesse d'être un hub fourre-tout : il devient **le fil,
pur** — ce qui se passe chez nous, et l'envie qui va avec. L'incitation
passe PAR L'EXEMPLE (« Léa · sur scène »), jamais par des injonctions.

Test doctrine (§0) : chaque carte montre quelqu'un qui avance vers une
scène, ou l'asso qui en crée l'occasion. Chronologique, fin de fil
« Tu es à jour ✓ » — on veut que les membres passent PEU de temps ici.

## 2. Les cartes du lot N2

Trois sources, posées au lot 1 précisément pour ça — protections en SQL
(fiche retirée = cartes disparues rétroactivement ; jamais de brouillon ;
scènes strictement passées à date exacte ; retour après retrait discret) :

| Carte | Copie (réglable) | Source | Mène à |
|---|---|---|---|
| **Sur scène** | « {Nom} · sur scène » puis « “{titre}” · {conférence}, {ville} » | `getScenesRecentes` | sa fiche |
| **A rejoint l'annuaire** | « {Nom} · a rejoint l'annuaire » puis {titre du profil} | `getNouvellesVenues` | sa fiche |
| **Tech Speak'Her** | « Tech Speak'Her · {titre} » puis {chapo} | `listPublicationsRecentes(avecDestination)` | l'actualité (`destinationContenu`) |

Une carte = un fait, incarné : avatar (photo ou initiales) + nom + fait,
la carte ENTIÈRE est le lien (une seule cible par carte). La date
s'affiche en toutes lettres relatives au jour (« aujourd'hui », « hier »,
sinon date longue) — jour de Paris partout.

**Mise en page : DEUX blocs, jamais trois colonnes.** Avatar (aligné en
haut, sur le nom qu'il illustre) puis la colonne de texte, qui EMPILE nom,
titre, détail et l'intitulé de destination (« Voir sa fiche », « Lire
l'article » — une flèche nue ne dit pas où l'on arrive, RGAA 6.1). Cet
intitulé a d'abord été posé en troisième colonne : sur un téléphone, il
disputait la largeur au titre du talk, qui se coupait en deux mots par
ligne (retour de Cateline, 2026-08-08). Il va à la ligne.

**Reportée — carte « Fiche à jour »** : elle exige un horodatage des
talks (`speaker_talks` n'a AUCUN `created_at`) : c'est une décision de
SCHÉMA (+ le groupement anti-inondation par personne et par jour) qui
attend le réveil de Cateline — sous-lot N2.1. Le fil l'accueillera sans
rien changer d'autre (une source de plus dans la fusion).

## 3. La fusion (lib pure `fil-cartes.ts`)

- Chaque source est interrogée avec `limite = FIL_MAX` (l'invariant
  « limite par source » : une carte écartée après coup ne vole jamais la
  place d'une plus ancienne).
- Fusion antichronologique sur le JOUR (les sources datent au jour de
  Paris) ; à jour égal : scènes, puis venues, puis asso, puis id
  décroissant — un ordre STABLE, pas un aléa de tri.
- Plafond `FIL_MAX = 20` cartes (réglable), puis **« Tu es à jour ✓ »** :
  pas d'archive, pas de « voir plus » — les listes complètes restent
  publiques (/speakeuses, /agenda, /actualites), le fil pointe.
- Fil vide (communauté calme) : une phrase positive qui dit ce que le fil
  racontera, jamais un écran mort.

## 4. La redistribution du hub (conception v2 §10)

Le hub actuel porte du PERSO : tout déménage vers son écran de rôle,
rien ne disparaît.

| Quittait le hub | Vit désormais |
|---|---|
| Module fiche adaptatif (badge de statut, complétude, **Soumettre à l'annuaire**, erreurs de soumission, méta-dates) | **« Ma fiche publique »** — soumettre, compléter et retirer sont des gestes de fiche ; les actions redirigent vers `/mon-espace/fiche` |
| « Retirer ma fiche » (`RetirerFicheRow`) | « Ma fiche publique », sous l'adresse publique |
| « Mes talks » / « Mes messages » (rangées) | déjà couverts : les talks sont une section de la fiche, Messages est un onglet |
| Talks repérés « à confirmer » (badge) | **la marche de « Mon profil »** : `{n} talks repérés attendent ta confirmation` — une donnée qui appelle UN geste, c'est la définition de la marche |
| « À venir » (extrait d'agenda) | l'onglet **Agenda** le porte en entier (l'extrait doublonnait) |
| Rangées « Tremplin & coaching » (mes éditions, coaching) | **« Mon profil »** : une rangée par édition à laquelle je participe (« Mon coaching » y était déjà — `Mes coachées`) |
| Carte « Créer ma fiche » | la marche de « Mon profil » et la feuille ➕ la portent |
| Incitation « Retrouve ta fiche à coup sûr » (regroupement des connexions) | **« Mon profil »**, sous les accès — une opportunité du compte, pas de l'activité |
| Salutation « Bonjour {prénom} 👋 » | reste en tête de l'Accueil (une salutation n'est pas une carte perso) |

## 5. Données, RGPD, sécurité

Aucune table, aucune colonne, aucun cookie. Tout ce que le fil montre est
DÉJÀ public (annuaire, agenda, actualités) — le fil le réordonne. Les
gardes vivent en SQL (`status = 'publie'`, `published_at IS NOT NULL`,
sources tremplin exclues) : le retrait d'une fiche efface ses cartes
rétroactivement. Les actions de fiche gardent leurs gardes serveur
(identité de session, `raisonBlocageAnnuaire`) ; seule leur destination
de redirection change.

## 6. Accessibilité (RGAA)

Fil en `role="list"`, une carte = un lien au nom accessible complet
(nom + fait + destination implicite), dates en toutes lettres, sections
`aria-labelledby`, « Tu es à jour ✓ » porté par du texte (jamais la
coche seule), focus visible, cibles ≥ 44 px. Tests jest-axe sur le fil
et sur les deux pages enrichies (fiche, profil).

## 7. Étapes (TDD, une PR)

1. **F1 — la lib** : `fil-cartes.ts` (types + fusion pure) + tests.
2. **F2 — les cartes** : composant `CarteFil` + états (scène, venue,
   asso) + axe.
3. **F3 — l'Accueil** : `/mon-espace` = salutation + fil + fin de fil ;
   tests de page réécrits.
4. **F4 — la redistribution** : fiche publique (complétude + soumettre +
   retirer + erreurs), profil (rangées tremplin, incitation connexions,
   marche « talks repérés »), redirections d'actions ; tests migrés.
5. Revues (correction exigeante + `/security-review` + `/simplify`),
   CI, merge, vérification prod — comme aux lots N0-N1.

## 8. Réglable au réveil (une retouche chacun)

- La copie exacte des trois cartes et de la fin de fil (§2, §3).
- `FIL_MAX` (20) et les limites par source.
- La place de la salutation.
- Le sous-lot N2.1 « Fiche à jour » : GO/NO-GO sur l'horodatage des
  talks (migration) + groupement anti-inondation.
