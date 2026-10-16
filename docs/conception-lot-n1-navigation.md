# Conception détaillée — Lot N1 : la navigation canonique

> Statut : **VALIDÉE par Cateline le 2026-08-07** (maquette fil de fer v4,
> après quatre itérations le même jour : onglet « Profil », fiche publique
> et compte jamais mélangés, les noms des écrans portent la visibilité,
> atelier dans la feuille ➕). Décline la conception d'ensemble
> `conception-espace-fil-navigation.md` (§3 système, §5 profil, §6 ➕, §11
> lot N1).

## 1. Objectif du lot

Poser la coquille canonique de l'app : le header qui ne porte plus le
« moi », le burger qui ne porte plus que le site, LA barre identique pour
tous les rôles, et la page profil qui absorbe tout ce que la barre perd.
Le fil (N2) arrivera dans une coquille déjà stable.

Test doctrine (§0) : une barre stable et un ➕ central rapprochent d'une
scène — l'acte de créer (un talk, bientôt un article) occupe le centre de
l'écran, et le travail de rôle cesse de reconfigurer l'app.

## 2. Écran par écran : existant → cible

### 2.1 Header mobile

| | Existant | Cible |
|---|---|---|
| Gauche | logo + nom | **☰** (le site : geste rare, à gauche) |
| Centre | — | logo + nom (lien vers `/`, accueil du site) |
| Droite | loupe + ☰ | loupe |

Le « moi » a quitté le header (l'onglet-photo le porte). Sans avatar en
haut, le nom « TECH SPEAK'HER » retient sa place sur mobile (§3 : la mesure
iPhone 17 qui le condamnait comptait deux emplacements ajoutés ; il n'y en a
plus aucun).

Desktop : nav publique + loupe inchangées. Le sort d'`AccountMenu` est la
question Q1 (§8).

### 2.2 Burger ☰

Rôle unique : **aller au site public**. Identique connectée ou non pour la
navigation ; seule l'entrée de session diffère.

- La section « Mon compte » (Mon espace, Espace orga, Réglages) **sort** :
  ces portes vivent désormais sur la page profil (§2.5).
- **Correction de revue (2026-08-08)** : connectée, l'entrée du tiroir est
  LA porte « Mon espace » (à la place de « Rejoindre l'annuaire » / « Se
  connecter »). Sur une page du site public, la barre basse n'existe pas
  (elle vit dans les layouts de l'app) : sans cette porte, une connectée
  mobile restait coincée côté site. Une porte, jamais l'inventaire.
- La **carte d'identité** sort aussi : l'onglet-photo dit en permanence qui
  est connectée, la réassurance a déménagé avec le « moi ».
- **Se déconnecter** sort : rangée de la page profil.
- Déconnectée (pas de barre basse) : le tiroir garde « Rejoindre
  l'annuaire » et « Se connecter » en tête — c'est l'entrée du site pour une
  visiteuse, pas du travail de rôle.
- « Accueil du site » en tête de la section Site : livré (PR #291), conservé.

### 2.3 La barre basse canonique

LA MÊME pour tous les rôles — la stabilité de la barre est l'identité du
produit. Cinq emplacements, plus jamais de logique de priorité :

| Onglet | Cible | Note |
|---|---|---|
| **Accueil** 🏠 | `/mon-espace` | Hub actuel en N1 ; devient le fil en N2 |
| **Agenda** 📅 | `/mon-espace/agenda` | Inchangé |
| **➕** | ouvre la feuille Créer (§2.4) | Un BOUTON (`aria-haspopup`), pas un lien ; visuellement central et saillant (patron Vinted) |
| **Messages** ✉️ | `/mon-espace/messages` | La boîte ; les messages orga restent dans le tableau de bord |
| **[Ma photo]** | `/mon-espace/profil` | Avatar de la personne (patron Instagram), libellé visible « Profil » — retour de Cateline du 2026-08-07 : la page est plus large que la fiche, le mot doit le dire (amende la v2 §3 qui gardait « Ma fiche ») |

Conséquences code : `BottomNav` perd `estParticipante`/`estCoach`/`estOrga`
(plus de slots variables) ; `BottomNavServeur` cesse d'interroger les
inscriptions (la requête `getEditionsForUser` disparaît) et passe photo +
nom de la session pour l'onglet-photo. `aria-current` : préfixe le plus
spécifique, conservé. Les onglets variables actuels (À faire, Orga,
Coaching, Documents, Talks, Messages en slot) deviennent des rangées du
profil — coût assumé et chiffré en conception v2 : ~3 orgas paient un tap de
plus pour que ~200 membres aient une app canonique.

### 2.4 La feuille ➕ Créer

Bottom sheet (`<dialog>` natif, titre « Créer », focus piégé, Échap, cibles
≥ 44 px). Le ➕ n'invente aucun formulaire, il raccourcit vers l'existant :

| Entrée | Qui | Mène à |
|---|---|---|
| **Ajouter un talk** | fiche existante | `/mon-espace/talks/nouveau` |
| **Créer ma fiche speakeuse** | compte sans fiche (éligible) | `/mon-espace/fiche` — un talk vit sur une fiche : l'entrée dit le vrai premier pas |
| **Ajouter une actualité** | orga | `/admin/contenus/publication/nouveau` |
| **Ajouter un atelier** | orga | les ateliers du tremplin EN COURS, formulaire d'ajout ouvert (`AddAtelierDialog` existant). Plusieurs éditions actives : la feuille glisse vers un choix d'édition AVANT le formulaire — tranché par Cateline le 2026-08-07 |

« Écrire » (article) arrive au lot N3, « Demander de l'aide » au lot N5 —
la feuille grandit lot par lot.

### 2.5 Le « moi » : DEUX écrans, jamais mélangés

Retour de Cateline (2026-08-07, captures LinkedIn en exemples) : **ne pas
mélanger la fiche publique et le compte/préférences — la speakeuse doit
être rassurée sur ce qu'on voit publiquement.** Second retour, aussitôt :
les phrases d'explication alourdissent — **la visibilité est portée par
les NOMS des écrans** (« Ma fiche publique » parle d'elle-même), pas par
des bandeaux-phrases. Il reste une pastille sobre « Privé » sur le profil,
la seule visibilité qu'un nom ne dit pas.

**Écran A — « Mon profil » `/mon-espace/profil`** (cible de l'onglet
Profil), pastille « Privé » près du titre. De haut en bas :

1. **En-tête** : photo, nom, état de la fiche en une ligne (statuts
   existants, en mots).
2. **Ta prochaine marche** : LE CTA de la page (règle d'or : un CTA
   principal maxi). UNE carte dérivée des données — sans fiche → la créer
   (écartable « Aucune fiche pour moi », mécanisme existant) ; fiche sans
   talk → proposer son premier talk ; sans date à venir → viser une scène ;
   datée → la préparer. La complétude existante devient son détail.
3. **Rangée « Ma fiche publique »** : LA porte vers l'écran B, jamais le
   public lui-même. Le nom suffit, aucune phrase d'accompagnement.
4. **En rangées discrètes, sous le pli** (le travail de rôle, une rangée =
   une porte, style tiroir existant) :

   | Rangée | Qui | Mène à |
   |---|---|---|
   | À faire | orga | `/admin/taches` (l'unification `Toutes · Perso · Asso · Coach` est un lot ultérieur ; la rangée est déjà à sa place canonique) |
   | Tableau de bord orga | orga | `/admin` |
   | Ateliers {édition en cours} | orga, si édition active | `/admin/tremplins/{id}/ateliers` — l'accès direct promis « avec la refonte » (conception v2 §5) |
   | Mes coachées | coach | `/mon-espace/coaching` (renommage : la direction dans le mot) |
   | Documents | participante | `/mon-espace/documents` |
   | Réglages | toutes | `/mon-espace/reglages` |
   | Se déconnecter | toutes | action (rangée distincte, style orange existant) |

**Écran B — « Ma fiche publique » `/mon-espace/fiche`** : l'écran actuel
de la fiche (rendu `FicheSpeakeuseCorps` partagé avec la page publique,
crayons par section, promesse par statut, adresse publique). Le titre
porte la visibilité, aucun bandeau. Son CTA :
**« Partager ma fiche »** — partage natif (`navigator.share`) avec repli
« Copier le lien », fiche publiée seulement (hors annuaire, la promesse par
statut explique, pas de bouton inerte). Les **stats sobres** (« 3 talks ·
2 scènes faites », jamais comparatives) vivent ICI : ce sont des faits
publics, elles rassurent sur ce que le public lit. **Les talks y sont une
section** (modèle « expériences LinkedIn ») : l'onglet Talks disparaît, les
pages `/mon-espace/talks/*` restent les écrans d'édition, atteints par les
crayons de la section.

Une page = un rôle : l'écran A est « moi et mes accès » (CTA : la marche),
l'écran B est « ce que le public voit » (CTA : partager). Le hub
`/mon-espace` actuel ne bouge pas en N1 (il devient le fil en N2) ; les
cartes du hub qui doublonnent le profil seront retirées par N2, pas par
N1 — un seul écran change de rôle par lot.

### 2.6 Routes et redirections

- L'assistant de création (compte sans fiche) et les pages de section
  (crayons) suivent la fiche : `/mon-espace/profil/[section]` devient
  `/mon-espace/fiche/[section]`, et l'ancienne adresse **redirige** (308
  permanent dans `next.config.ts`, le mécanisme maison des renommages —
  précédent `/charte`) : liens profonds et e-mails passés continuent
  d'aboutir.
- `/mon-espace/talks` reste servie : la liste devient un écran de gestion
  atteint depuis la fiche, plus un onglet. Aucune URL ne casse.

## 3. Ce qui disparaît

- Les onglets variables et leur logique de priorité (`prioritaires` dans
  `BottomNav`).
- La section « Mon compte » du burger, la carte d'identité, la déconnexion
  du tiroir.
- L'onglet « Talks » (absorbé), l'onglet « Ma fiche » texte (remplacé par
  l'onglet-photo).

## 4. Données et RGPD

Aucune table, aucune colonne, aucune donnée nouvelle. Les stats de la
fiche publique sont dérivées de l'existant (talks, occurrences passées).
« Partager ma fiche » utilise l'API de partage du navigateur : rien n'est
tracé, aucun cookie. La photo de l'onglet vient de la session (fournisseur
OAuth), affichée à la personne elle-même uniquement. La transparence RGPD
passe par les noms des écrans (« Ma fiche publique », pastille « Privé »
sur le profil) : à aucun moment la speakeuse ignore la portée de ce
qu'elle regarde.

## 5. Accessibilité (RGAA)

- Barre : landmark `nav` nommé, libellés VISIBLES sous chaque icône (y
  compris « Profil » sous la photo — l'avatar est `aria-hidden`, le
  libellé porte le nom accessible), `aria-current="page"` unique (préfixe
  le plus spécifique), cibles ≥ 44 px, safe-area iOS, `data-bottom-nav`
  pour le dégagement du footer.
- ➕ : `aria-haspopup="dialog"`, la feuille est un dialogue Radix titré
  (focus, Échap, clic extérieur), libellé visible « Créer ».
- Profil et fiche : sections `aria-labelledby`, rangées en listes
  `role="list"`, l'état de la fiche en mots (jamais la couleur seule),
  focus visible partout. La pastille « Privé » est du TEXTE — une icône
  seule ne porte jamais l'information.
- Tests jest-axe sur la barre, la feuille, la page profil et la fiche.

## 6. Étapes de réalisation (TDD, une PR pour le lot)

1. **E1 — header + burger** : ☰ à gauche, tiroir Site pur, sorties (compte,
   identité, déconnexion). Tests `header-auth.test.tsx` mis à jour.
2. **E2 — barre canonique + feuille ➕** : 5 onglets fixes, onglet-photo,
   feuille par rôle. Tests unitaires + axe.
3. **E3 — le « moi » en deux écrans** : « Mon profil » (marche, carte fiche
   publique, rangées rôle, bandeau privé) et « Ma fiche publique »
   (bandeau public, stats, Partager, déménagement `/mon-espace/fiche` +
   redirections). Tests par rôle (orga, coach, participante, speakeuse
   simple) et par statut de fiche.
4. **E4 — nettoyage** : props mortes, `getEditionsForUser` retiré de la
   barre, E2E navigation, docs amendés (`conception-tableau-de-bord-orga.md`).

Revues avant PR : revue de correction explicite + `/simplify` ;
`/security-review` (la page profil lit la session et des données perso).
CI verte, merge, vérification prod — comme au lot N0.

## 7. Hors périmètre N1 (rappel)

Le fil (N2), les articles (N3), Bravo (N4), demandes d'aide et messagerie
(N5), commentaires (N6), l'unification de la page À faire, l'e-mail de
rappel à cadence choisie.

## 8. Questions : tranchées et restantes

Tranché par Cateline le 2026-08-07 :

- **Q2 — feuille ➕ orga** : « Ajouter une actualité » ET « Ajouter un
  atelier » dès N1. L'atelier se crée dans le tremplin en cours ; plusieurs
  éditions actives → choix du tremplin dans la feuille avant le formulaire
  (§2.4).
- **Q3 — burger connectée** : strictement le site, carte d'identité et
  déconnexion sorties (§2.2). Validé.
- **Retour sur l'onglet 5** (trois temps) : la page est « Mon profil », pas
  seulement la fiche → libellé d'onglet « Profil ». Puis, captures LinkedIn
  à l'appui : fiche publique et compte/préférences JAMAIS mélangés, la
  speakeuse doit être rassurée sur ce qu'on voit publiquement → le « moi »
  en deux écrans (§2.5). Enfin : les phrases d'explication alourdissent,
  les noms des écrans portent la visibilité (« Ma fiche publique » parle
  d'elle-même).

- **Q1 — desktop** (feu vert global du 2026-08-07 sur la recommandation) :
  la barre basse est mobile (`lg:hidden`, passée à `xl:hidden` le
  2026-10-15 : sous 1 280 px, la nav desktop chevauchait le logo ; limite connue : entre
  1 024 et 1 279 px, les onglets s'étirent sur toute la largeur, piste : une
  `max-w` centrée sur leur liste). Sur grand écran, `AccountMenu`
  (avatar en haut à droite) devient le pendant de l'onglet Profil et
  MAIGRIT au même modèle : **Mon espace, Mon profil, Réglages,
  Se déconnecter** — les portes de rôle vivent sur le profil. « Mon
  espace » reste : sans barre basse, c'est la seule porte desktop vers
  l'app.
- **Q4 — Documents** (même feu vert) : rangée du profil pour une
  participante. Le fil (N2) portera les rappels d'ateliers au bon moment.
