# Journal des nouveautés

Suivi des évolutions livrées en production, écrit pour l'équipe. La copie
MEMBRE des nouveautés part par la lettre d'information (Brevo) — le futur fil de
l'espace connecté (conception v2, lot N2) racontera la communauté, jamais le
logiciel (conception :
`docs/conception-espace-fil-navigation.md`).

Format : date (AAAA-MM-JJ) + résumé. Plus récent en haut.

## 2026-08-10

- **La date d'une carte du fil reste d'un seul tenant.** Un nom long poussait
  la date au bord de l'écran, qui la cassait en plein milieu (« 22 » d'un
  côté, « juillet 2026 » de l'autre). Elle descend maintenant entière à la
  ligne. Le fait (« a rejoint l'annuaire ») garde le droit de passer à la
  ligne, lui : une phrase se lit coupée, une date non, et l'en-tête tient
  ainsi sur deux lignes plutôt que trois.

## 2026-08-08

- **Le fil se lit sur un téléphone.** L'intitulé de destination (« Voir sa
  fiche », « Lire l'article ») passe À LA LIGNE sous le texte au lieu de lui
  disputer une seconde colonne : sur un écran étroit, le titre du talk se
  coupait en deux mots par ligne. L'avatar s'aligne désormais sur le nom
  qu'il illustre.
- **Une réaction qui tombe ne coûte que sa ligne.** Quand l'appel n'arrive
  pas jusqu'au serveur (réseau coupé, ou nouvelle version livrée pendant
  qu'on lisait le fil), le bouton revient en arrière et la ligne le dit
  (« ta réaction s'est perdue en route : retape-la, ou recharge la page »).
  Le curseur reste sur le bouton, un re-tap réessaie, et le reste du fil
  continue de vivre. Avant, tout l'écran devenait la page « Oups ».
- **On se répond sur le fil (conception v2, lot N4).** Sous chaque carte, une
  ligne : un bouton et qui a réagi, en toutes lettres (« Toi, Salomé D. et
  3 autres »). Un geste, pas un texte : rien à modérer. **Le mot suit ce que
  la carte raconte** — 👏 **Bravo** pour un accomplissement (monter sur
  scène, publier un article), 👋 **Bienvenue** quand une speakeuse rejoint
  l'annuaire. Deux mots seulement : au-delà, on se demande pourquoi on a
  CE bouton-là. Nominatif (« un applaudissement anonyme ne vaut
  rien »), interne à l'espace connecté, retirable à tout moment d'un re-tap.
  Sur SA propre carte, pas de bouton : le compteur, c'est là que
  l'encouragement arrive. Une réaction va toujours à une PERSONNE, pour son
  geste : les actualités signées Tech Speak'Her n'en portent pas — il n'y a
  personne à féliciter. Retirer sa fiche retire aussi les réactions reçues
  (retrait rétroactif, comme promis) ; supprimer son compte emporte celles
  qu'on a données.
- **Les membres écrivent des articles (conception v2, lot N3).** Toute membre
  connectée peut écrire un article depuis la feuille ➕ (« Écrire un article » :
  une astuce, un retour d'expérience, un conseil — nouvelle catégorie
  « Conseils de speakeuse »). Le brouillon vit dans « Mes articles » (Mon
  profil), se soumet à la relecture d'une orga, revient avec un motif s'il y a
  à reprendre, et se publie signé du nom de l'autrice. La cession de droits se
  dit en toutes lettres au moment de soumettre : l'article reste en ligne,
  signé, même si la fiche se retire ou le compte se ferme — seul le lien vers
  la fiche se replie. L'article publié s'annonce dans le fil, incarné (nom et
  photo de l'autrice), et la relecture arrive dans « À faire » des orgas.
- **Le vocabulaire des contenus s'unifie.** « Actualité » = le flux,
  « article » = ce qui se lit chez nous ; « publication » reste un mot
  technique que l'écran ne dit jamais (un test le garantit).
- **L'Accueil connecté devient le fil (conception v2, lot N2).** Un seul
  flux, façon réseaux : « Léa · sur scène », « Salomé · a rejoint
  l'annuaire », les actualités signées Tech Speak'Her — chronologique, des
  faits incarnés, et « Tu es à jour ✓ » en fin de fil (pas d'archive, pas de
  scroll infini : les listes complètes restent publiques). L'incitation
  passe par l'exemple, jamais par des injonctions.
- **Le hub se redistribue, rien ne se perd.** La complétude, la soumission à
  l'annuaire et le retrait vivent sur « Ma fiche publique » ; l'espace
  tremplin d'une participante, l'incitation au regroupement des connexions
  et les talks repérés à confirmer (via « Ta prochaine marche ») vivent sur
  « Mon profil » ; l'agenda complet vit sur son onglet.
- **La navigation canonique de l'app (conception v2, lot N1).** La barre basse
  devient LA MÊME pour tous les rôles : `Accueil · Agenda · ➕ · Messages ·
  [ma photo]` — le travail de rôle quitte les onglets. Le ➕ central ouvre la
  feuille « Créer » : un talk (ou sa fiche, le vrai premier pas), et pour une
  orga une actualité ou un atelier (tremplin en cours direct, choix d'édition
  si plusieurs). Le burger passe à gauche et ne porte plus que le site.
- **Le « moi » en deux écrans, jamais mélangés.** « Mon profil » (onglet
  photo, pastille Privé) : ta prochaine marche dérivée de tes données, la
  porte vers ta fiche, tes accès de rôle, les réglages, la déconnexion.
  « Ma fiche publique » (`/mon-espace/fiche`, anciennes adresses redirigées) :
  exactement ce que le public lit, tes stats sobres (talks · scènes faites)
  et **« Partager ma fiche »** — le geste vers une orga de conférence, qui
  n'existait pas. Le menu du compte (ordinateur) s'aligne : Mon espace, Mon
  profil, Réglages, Se déconnecter.

## 2026-08-07

- **Le retour dans l'annuaire est discret.** Une fiche retirée puis re-publiée
  garde sa date d'entrée d'origine : elle réapparaît dans l'annuaire sans être
  ré-annoncée en tête des « Elles viennent d'arriver » de l'accueil. Le retrait
  est le geste de qui veut baisser d'exposition — la re-publication le
  respecte. Et la soumission le dit désormais en toutes lettres : « Une fiche
  publiée est annoncée sur l'accueil du site. »
- **Le menu mobile mène à l'accueil du site.** La section « Site » du tiroir
  s'ouvre sur « Accueil du site » : jusqu'ici seul le logo y menait, sans le
  dire — et l'onglet « Accueil » d'une connectée mène à son espace, pas au
  site.
- **Les actualités sont datées au jour de Paris.** Publier entre minuit et
  2 h datait l'actu de la veille (jour UTC de la base).
- **En coulisses** : la conception de l'espace connecté v2 (le fil façon
  réseaux, la navigation, le réseau entre speakeuses) est posée dans
  `docs/conception-espace-fil-navigation.md`, avec sa doctrine et ses lots.

## 2026-08-02

- **La lettre d'information passe par Brevo, et se refuse en un clic.** Écrire
  aux membres est du **marketing** : ça doit pouvoir se refuser **sans couper le
  service**. Les e-mails liés au compte (lien de connexion, décision sur la
  fiche, message reçu, rappel) continuent donc de partir de la plateforme, et la
  lettre d'information part désormais de **Brevo**, avec son désabonnement natif.
  - `/admin` → « Lettre d'information » **synchronise les contacts** vers la
    liste Brevo (`importContacts`, rejouable, aucun doublon) avec les étiquettes
    de ciblage demandées : `FICHE` (en ligne, à publier, en relecture, en
    retrait, aucune), `INVITER_FICHE`, `TREMPLIN` (années), `MONTEE_SUR_SCENE`,
    `COACH`, `ORGA`. Le même écran donne le **HTML des deux versions** à coller
    dans la campagne.
  - **Se désabonner** : le lien natif dans l'e-mail (un webhook Brevo reporte le
    refus côté plateforme) ou la case « Recevoir la lettre d'information » dans
    Mon espace → Réglages. Modèle **opt-out** (migration `057`), et la synchro ne
    ressuscite jamais une désinscription faite dans Brevo.
  - **Synchro quotidienne** : le cron de 17 h pousse la liste à jour (fiche
    publiée la veille, désabonnement, nouvelle participante), en best-effort et
    en dernier — un incident chez Brevo ne prive personne de son digest. Le
    bouton reste là pour ne pas attendre 17 h.
  - **La plateforme n'est pas l'association** : la liste synchronisée s'appelle
    « Comptes plateforme », pas « Membres ». L'association comptera des
    adhérentes et des adhérents **sans compte** ici (la plateforme est réservée
    aux femmes et aux personnes non binaires), plus des contacts d'écosystème.
    Ceux-là vivent dans leurs propres listes Brevo (HelloAsso, saisie manuelle) :
    notre synchro n'écrit que ses attributs et ne supprime aucun contact, donc
    les deux mondes cohabitent sans s'effacer. Qui écrit quoi :
    `docs/conception-synchro-contacts.md`.
  - Mentions légales complétées (finalité, base légale, sous-traitant, portée du
    désabonnement).
- **Fix : « Ma fiche » recolle sa phrase d'accueil.** Le statut et la phrase
  suivante s'affichaient collés (« …dans l'annuaire.Chaque partie… »).

## 2026-08-01

- **Un talk rejoué se voit enfin.** Sur une fiche speakeuse, chaque conférence
  où un talk a été donné s'affiche avec son **logo**, son nom en gras et la
  date/lieu en dessous, au lieu d'une ligne de texte grise indifférenciée : on
  compte les scènes d'un coup d'œil. Même repère dans l'espace membre et sur la
  page « Conférences & assos partenaires ». Une conférence dont le logo n'est
  pas déposé s'affiche avec ses initiales sur une pastille (aucun trou).
  Les logos sont servis par notre domaine (`public/conferences/`, récupérables
  via `npm run logos:conferences`) : rien n'est chargé depuis les sites des
  conférences, donc aucune fuite d'IP des visiteuses.

## 2026-07-21

- **Espace Tremplin : phase 3 séparée de la finale.** Le pitch de finale et le
  bouton de visibilité dans la galerie (concerns de la phase 2) ne s'affichent
  plus pour une participante qui n'est que sur la phase 3 (montée sur scène). Le
  pitch reste sur le chemin finale (phase 1 ou finaliste) ; la visibilité galerie
  est réservée aux finalistes confirmées. Plus de mélange entre l'accompagnement
  phase 3 et l'édition publique.

## 2026-07-20

- **Repérage : plus de conférences reconnues.** Le moissonneur Sessionize se
  replie sur les vues `Sessions` + `Speakers` quand l'organisateur ouvre
  seulement celles-ci (cas fréquent, resté muet jusqu'ici) : les talks de ces
  événements sont désormais repérés.

## 2026-07-11

- **Gestion des conférences en hub + page dédiée.** La page « Conférences »
  redevient une liste de consultation (un rôle, un CTA « Ajouter ») ; corriger
  une conférence, gérer ses éditions ou la supprimer se fait sur la page dédiée
  de chaque conférence, plus dans des formulaires empilés sur la liste.
- **Conférences du registre proposées à la saisie d'un talk.** Les conférences
  de la référence apparaissent désormais dans l'auto-complétion même sans
  édition rattachée (le seed n'en crée pas) : plus besoin de les retaper.
- **Modifier ou supprimer une conférence depuis l'admin.** Correction du nom
  (renommage possible), du type et des métadonnées, et suppression, refusée si
  des événements y sont rattachés.
- **Doublon corrigé.** « Flupa UX Days » et « UX Days » étaient le même
  événement : une seule entrée (« UX Days ») dans le catalogue d'amorçage.

## 2026-07-10

- **Référence partagée des conférences.** Nouvelles tables `conferences`
  (marque de conf ou asso) + `conference_editions` (édition datée ou meetup,
  avec lieu), qui remplacent `cfp_events` comme source du moissonneur
  (migration `027`, reprise idempotente, mémoire des refus préservée).
- **Repérage à la demande.** Dans l'espace membre, une speakeuse ajoute une
  conférence manquante avec son id Sessionize (testé à l'ajout, actif
  directement) et lance le repérage tout de suite : ses talks repérés
  s'affichent sans attendre le passage quotidien ni l'e-mail.
- **Conférences connues à la saisie d'un talk.** L'auto-complétion propose les
  conférences et meetups de la référence (même jamais saisis) ; choisir un
  événement connu pré-remplit ville, pays et lien, et relie le talk à la
  référence (lien revalidé côté serveur, le texte libre garde toujours la main).
- **Gestion orga des conférences.** Nouvelle page « Gérer les conférences »
  (amorçage du catalogue France, ajout/édition, test d'un endpoint Sessionize,
  activation de la moisson par édition, ajouts de la communauté badgés).
- **Meetups toulousains synchronisés.** Le cron quotidien importe les meetups
  du Toulouse Tech Hub (MIT) dans la référence : ils deviennent choisissables
  à la saisie d'un talk, avec leur date et leur lieu.
- **Tremplins reliés à la référence.** Une édition de Tremplin peut pointer sa
  conférence partenaire dans la référence (sélecteur facultatif, admin).

## 2026-07-03 (2)

- **Annuaire : filtres multi-sélection.** On peut cocher plusieurs zones,
  langues, secteurs ou sujets à la fois (OU dans une catégorie, ET entre
  catégories) : cocher un second filtre ne décoche plus le premier. Le bouton
  « Filtrer » est désormais un bouton secondaire visible, aligné à gauche.
- **Recherche directement dans l'annuaire.** Un champ de recherche (insensible
  aux accents) filtre les speakeuses par nom, poste, secteurs/sujets, zones,
  langues, et aussi le contenu détaillé des fiches (bio, ville, talks).
- **Cartes speakeuses plus lisibles.** Une mention « Voir la fiche » indique
  clairement qu'on peut cliquer pour ouvrir le profil complet.
- **Fix : les talks apparaissent tout de suite sur la fiche publique.** Ajouter,
  modifier ou supprimer un talk (et confirmer une suggestion) revalide la fiche
  et l'annuaire (même correctif de fraîcheur que la bio, qui manquait sur les
  talks). Couvert par des tests dédiés.
- **Moissonneur CFP expliqué aux speakeuses.** Un « Comment ça marche ? »
  détaillé (lecture des programmes publics, reconnaissance prudente, contrôle
  total, e-mail de repérage, mise à jour des talks confirmés) s'affiche au
  profil (au moment du consentement) et près des « Talks repérés pour toi ».
- **E-mail de repérage.** Quand le moissonneur trouve de nouveaux talks pour une
  speakeuse, elle reçoit un e-mail récap (un seul par run, opt-out respecté)
  pointant vers son espace.
- **Espace orga : vues par statut.** Le suivi des fiches se filtre par statut
  (publiées / en attente / brouillon…), avec compteurs.

## 2026-07-03

- **Fix : la fiche reflète les modifs du profil tout de suite.** `saveProfile`
  revalide désormais la fiche et l'annuaire (plus d'ancienne bio servie depuis
  le cache après « Prévisualiser ma fiche »).
- **Annuaire : filtres repliés par défaut** (« Filtrer » + chevron) : les
  speakeuses sont visibles d'emblée, sans scroller sous un mur de puces.
- **Recherche plein-texte enrichie** : la recherche du site retrouve une
  speakeuse via sa bio, ses secteurs/sujets, sa ville et le contenu de ses
  talks (indexés sans alourdir l'aperçu du résultat).

## 2026-07-02 (3)

- **Localisation : revue complète (code, sécurité, UX, a11y, tests).** Étape
  « Localisation » dédiée dans le profil ; « Toute la France » expliqué, annoncé
  aux lecteurs d'écran, et son décochage restaure la sélection précédente ;
  cohérence raccourci ⇔ 13 régions garantie côté serveur ; la ville n'est plus
  envoyée dans le payload de la liste de l'annuaire (minimisation, fiche
  uniquement) ; mentions légales mises à jour (ville, zones, langues) ; filtres
  de l'annuaire groupés par catégorie (Secteurs / Sujets / Zones / Langues),
  tri alphabétique français, navigation clavier Home/End ; fiche : « Toute la
  France » remplace les 13 puces ; « Occitanie » ou « Anglais » remontent dans
  la recherche du site ; JSON-LD durci ; moisson Sessionize tolérante aux
  exports incomplets ; test d'orthographe étendu aux nouveautés et taxonomies.

## 2026-07-02 (2)

- **Localisation et langues sur le profil.** Ville de résidence, zones
  d'intervention (régions françaises + « Toute la France » + International + « À
  distance ») et langues (français, anglais, espagnol, italien, allemand).
  Cases à cocher au profil (étape « Domaines »), filtrables dans l'annuaire
  (au même titre que secteurs/sujets) et affichées sur la fiche publique.
  Migration `012`.

## 2026-07-02

- **Moissonneur CFP (phase 2 de l'étude).** Un cron quotidien parcourt le
  registre d'événements (`cfp_events`, alimenté par l'orga) via les endpoints
  JSON publics Sessionize, matche les speakers avec les profils TSH (liens
  LinkedIn / Sessionize, puis nom) et propose les talks trouvés dans l'espace
  membre : « Talks repérés pour toi », à confirmer ou écarter en un clic. Rien
  n'est publié sans l'accord de la speakeuse ; un refus n'est jamais re-proposé ;
  un talk confirmé est rafraîchi automatiquement aux re-syncs suivants.
  Migration `011` (talks.source/external_id, cfp_events, talk_suggestions,
  cfp_sync_mode). Conference Hall : à brancher ensuite.
- **Consentement et garde-fous du moissonneur** (revue de code, UX, a11y,
  sécurité). Réglage révocable dans le profil (étape « Autres liens ») ;
  « Écarter » demande confirmation (refus définitif) ; les éditions manuelles
  d'un talk importé ne sont plus jamais écrasées par le re-sync ; homonymes
  jamais départagés au hasard (aucune suggestion) ; plafonds anti-inondation ;
  liens sortants limités à http(s) ; timeouts sur la moisson.

## 2026-06-30

- **Liens Sessionize / Conference Hall sur le profil.** Champs « Sessionize » et
  « Conference Hall » dans le profil (étape « Autres liens »), affichés dans la
  section « Talks & conférences » de la fiche publique et ajoutés au `sameAs`
  des données structurées Person (SEO). Pas d'import automatique : l'étude
  `docs/faisabilite-import-talks.md` montre que Sessionize et Conference Hall
  n'exposent qu'une API par événement (accès organisateur), sans flux par
  speakeuse.
- **Bandeau « Nouveautés de la plateforme ».** À l'entrée de l'espace membre,
  fermable (croix), mémorisé par navigateur — réapparaît à la nouveauté suivante.
- **Étude de faisabilité import des talks** (`docs/faisabilite-import-talks.md`).
