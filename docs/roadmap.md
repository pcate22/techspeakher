# Roadmap produit — Tech Speak'Her

> Feuille de route **fonctionnelle** (décisions produit et pistes à venir). Pour
> la dette technique : `docs/dette-technique.md`. Pour l'étude d'import des
> talks : `docs/faisabilite-import-talks.md`.
>
> Dernière mise à jour : **2026-10-16** (section « Reprise humaine du code »
> seule) ; **2026-10-15** (sections « Navigation connectée »,
> « Chantiers repris des PR fermées », « Adhésions HelloAsso », « Partenaires
> par façon d'aider », « Header Nous rejoindre », « Landing partenaires »,
> « Textes après l'AGE » et
> « Kit de communication » seules ; le reste a été relu contre le code le **2026-08-23**). Les sections
> « état au … » valent à leur date ; celles qui portent une autre date n'ont
> PAS été revérifiées depuis. Une entrée qu'on solde se raye ici le jour même :
> ce fichier est la première chose que lit la session suivante.
>
> **Chantiers ouverts, chacun avec son état daté ci-dessous** (décompte à
> vérifier au 2026-10-16 : les sections du 15/10 n'y figurent pas) : la reprise
> humaine du code (audit livré le 16/10, plan en attente de validation),
> l'import et l'annuaire (le détecteur d'id Sessionize est livré depuis le 21/08 ; restent la
> ligne de dette `.invalid` et l'écoute d'un profil Notist), l'agenda public
> (plan livré en entier, deux décisions produit). L'**arbitrage** de la file
> côté orga est livré le 22/08 (PR #359) : voir l'item 1 ci-dessous, qui l'a
> déclenché. Aucune passation ne s'empile sur une autre : `CLAUDE.md` §Clore
> une session. La **licence** est tranchée le 23/08 : voir la section dédiée
> ci-dessous, qui ferme la piste « une autre communauté déploie la plateforme ».

## Reprise humaine du code — audit LIVRÉ le 2026-10-16, plan en attente de validation

Le dépôt est public depuis le 16/10 (`pcate22/techspeakher`). Le code restera
écrit à 95 % par des sessions Claude, mais une bénévole doit pouvoir le lire,
le lancer et proposer un changement sans passer par une session. L'audit
chiffré et le plan sont dans `docs/audit-reprise-humaine.md`.

Plan en quatre lots (numéros de lot, pas de PR ; le lot 1 est l'audit) :
**2** page d'accueil des docs, glossaire, démarrage local avec le décor,
parcours humain dans `CONTRIBUTING.md` ; **3** découpage des quatre fichiers
de plus de 1 000 lignes (une PR par fichier) ; **4** règle d'écriture des
commentaires, test, puis tri ; **5** archive de la dette soldée. Ordre
recommandé : 2, 5, 3, 4.

**Où reprendre** : rien n'est commencé. Six décisions attendent Cateline
(audit §5 : ordre, revues d'une PR humaine, connexion locale sans compte
tiers, rouverture de `tremplin-ateliers.ts`, archive de la dette, règle des
commentaires dans `CLAUDE.md`). Une fois tranchées, ouvrir le lot 2.

## Navigation connectée — rail bureau, « Ma fiche » à un geste, une date sans ouvrir le talk — PR #382 OUVERTE le 2026-10-15

Retour de Cateline (admin, sur bureau) : mettre à jour sa fiche, « LE truc qui
doit être hyper simple », était pénible. Mesuré dans le code : sur bureau, la
barre basse était masquée et rien ne la remplaçait ; la fiche coûtait 4 clics,
une date sur un talk existant 5 et un formulaire de dix champs.

Livré (maquette cliquable bureau + mobile validée le même jour, conception :
`docs/conception-espace-fil-navigation.md`, en-tête « Révision du 2026-10-15 ») :
rail à gauche sur grand écran (« Ajouter un talk » en tête, Ma fiche, Accueil,
Agenda, À faire, Messages, Créer, groupe Organisation pour les orgas, Mon
profil, Réglages) ; onglet-photo de la barre basse renommé « Ma fiche », vers
la fiche ; « Ma fiche » en tête du menu du compte ; ➕ « Ajouter une date à un talk » ;
bouton « Une date » sous chaque talk de la fiche, fenêtre réduite (conférence,
édition, ville, date).

**Tranché par Cateline le 2026-10-15, livré dans la même PR** : sur mobile,
l'onglet « Ma fiche » ne s'allume que sur la fiche et les talks ; ailleurs
(`/admin`, Réglages, Messages), aucun onglet ne s'allume. Les comptes sans
fiche possible voient « Mon profil » à la place de « Ma fiche ».

**À regarder en vrai après la fusion** : le rail sur un écran de 1 280 à
~1 440 px (il paraît à `xl`, au seuil de la barre basse et de la nav de
bureau de l'en-tête, et la colonne de contenu se resserre de 240 px), et si les orgas
veulent d'autres entrées dans le groupe Organisation (aujourd'hui Speakeuses,
Conférences, Tremplins, Espace organisatrices).

## Chantiers repris des PR fermées — tri du 2026-10-15

Le 15/10, les 30 PR ouvertes ont été triées contre `main` (préalable au passage
du code en public). Celles dont l'**idée** reste juste mais dont le **code** a
trop de retard sur `main` sont fermées ; leur branche est **gardée** (rien
n'est supprimé) et le chantier vit ici. Pour reprendre : repartir de `main`,
lire la PR et sa branche pour l'intention, **ne pas** rebaser l'ancienne.

| Chantier | PR d'origine | Où en est `main` | Taille |
|---|---|---|---|
| Une date du tableau de bord orga nomme son objet (« Atelier il y a 2 mois »), plus de « En retard » pour un atelier passé | #235 | défaut toujours là : `src/lib/taches.ts` (`echeance`, `libelleEcheance`) | M |
| Listes orga : rangées sans bordure, action en surtitre, objet en titre (principe §10 à écrire dans `principes-conception-ui.md`) | #225 | rien ; tableau de bord refait depuis par #247/#248 | M |
| Article « récit DevFest 2026 » relié à l'édition | #221 | le mécanisme existe (`RecitConference`), l'article non. **À vérifier** : sept talks ou six speakeuses ? Plus simple depuis `/admin/contenus` | S |
| « La relation appartient à l'événement » (conception) ; la bascule « visible sur le site » passe de Présences à Infos de l'atelier ; liens vers `/agenda` depuis l'édition | #282 | rien de tout ça | M |
| Ateliers : bouton en double retiré, sous-groupes limités à la cohorte (refus serveur), colonne `modalite` (visio / sur place / les deux) | #267 | rien ; **migration** à renuméroter (≥ 074), à scinder en deux PR | L |
| Remplir un talk depuis une capture d'écran ou un texte collé (OCR dans le navigateur, zéro euro) | #261 | conception seule, absente de `main` | conception |
| Lighthouse sur le décor Postgres en CI, seuils en `error` | #314 | dette P-infra encore ouverte ; la partie sitemap est déjà livrée | S, mesurer avant |
| `/tremplin` rafraîchie par les actions admin (`revalidatePath`), retrait de « 1ʳᵉ édition » | #358 | le reste de la PR est livré (0d850e9d) | XS |
| Marge de défilement sur le lien secondaire d'`EcheanceCard` (focus sous la bande de mois, WCAG 2.4.11) | #266 | lien principal corrigé (9d49be6f), le secondaire non | XS |
| « Soirée » → « finale » dans les écrans d'édition | #170 | « soirée » encore dans `EditionChampsCommuns.tsx`, `finale/page.tsx` | XS |
| Raccourci orga : ajouter une conférence directement au répertoire, sans la file de validation | #230 (et #236) | absent ; à refaire sur `ConferenceCombobox`, **si voulu** | S |
| Hébergement en France (OVHcloud) | #99 | **piste, pas décision** (15/10 : on reste sur Vercel et Neon). Déclencheurs : une exigence de souveraineté (subvention, partenaire) ou un coût Vercel | conception |

Repris aussi de l'issue #150 (liste « simple à lire » de juillet, fermée le
15/10 ; vérifié contre le code le même jour) :

| Chantier | Où en est `main` | Taille |
|---|---|---|
| Galerie Tremplin plus rapide : `next/image` avec `sizes` au lieu d'un `<img>` simple | `app/tremplin/[conf]/[annee]/page.tsx` (~l. 591) ; autoriser les domaines des photos dans `next.config.ts` | S |
| Une suppression se distingue d'une alerte : couleur propre et pictogramme (l'orange de `danger` sert aussi aux erreurs) | `components/Button.tsx`, boutons de retrait sans icône | S |
| Inviter une participante avec son prénom et son nom, comme une coach | `AddParticipanteDialog.tsx` ne demande que l'e-mail | XS |
| Inviter quelqu'un avec son seul numéro de téléphone | aucun champ téléphone, invitation forcément par e-mail | L (conception) |
| Le jury relié aux comptes des speakeuses au lieu d'être ressaisi à chaque édition | `AddJuryDialog.tsx` en saisie libre | M |
| Depuis un atelier, un clic sur le nom d'une coach mène à sa fiche (deux clics aujourd'hui) | `ateliers/[atelier]/page.tsx` | XS |
| Le jour de la semaine sur les deux dates qui ne l'ont pas encore (finale de l'édition, sous-groupes) | `[edition]/page.tsx` ~l. 112, `sous-groupes/page.tsx` ~l. 172 | XS |
| Annuler une suppression après coup, pas seulement avant de valider | rien | M (conception) |

Déjà faits, rayés : la photo qui perdait la saisie en cas d'erreur
(`AddPhotoDialog` restaure les valeurs) ; les libellés de tâches coupés, la
recherche qui dit pourquoi une speakeuse sort, l'écran de suppression d'une
édition et l'article sur l'hébergement des slides sont déjà suivis dans ce
fichier ou dans la dette.

Fermées sans suite, parce que déjà livrées autrement ou contraires à une
décision : #237 (rituel de revues remplacé par `docs/revue-avant-pr.md`), #238
(gabarits CSV supprimés), #236 et #230 (recherche de conférence livrée par
2b04a9ea et ba0bf58b), #131 (déjà dans la dette, en mieux), #117 (licence du
23/08).
## Adhésions HelloAsso et annuaire réservé aux membres — LIVRÉ le 2026-10-15 (PR #383), interrupteur éteint, vérification de la première adhésion à faire

Conception validée par Cateline le 2026-10-15 :
`docs/conception-adhesions-helloasso.md`. Construit : synchro des adhésions
(notification HelloAsso relue par l'API + rattrapage au cron du soir, 17 h UTC),
rapprochement par **l'adresse demandée pour chaque membre** contre
`users.email` et `accounts.email` (jamais le payeur), échéance enchaînée
(12 mois à partir de l'échéance en cours), rangée « Mon adhésion » dans Mon
profil, vue orga `/admin/adhesions`, mentions légales. La règle de l'annuaire
(préavis daté de 30 jours, statut `en_pause`, relance à J-30, retour dès
l'adhésion) passe derrière `FLAG_ADHESIONS`, **éteint** ; elle s'appuie sur
les feature flags de la PR #212, fusionnée dans cette PR.

Identifiants d'API, clé de notification et URL de notification **posés par
Cateline le 2026-10-15** (Vercel + HelloAsso, pas-à-pas dans
`docs/exploitation.md` « Adhésions HelloAsso »). **Vérifié le 2026-10-15** :
l'adhésion de Cateline est reliée (« Active jusqu'au 15 octobre 2027 »), après
deux corrections d'exploitation : `CRON_SECRET` posée (tous les crons étaient
refusés) et l'adresse de l'adhérente corrigée sur HelloAsso. Le bilan de la
dernière relecture se lit sur `/admin/adhesions`, avec un bouton pour relire
HelloAsso à la demande (PR du bilan, 2026-10-15). **À DÉCIDER** : la date d'allumage de
`FLAG_ADHESIONS` (les préavis partent le soir même, les premières pauses
trente jours plus tard). **À TRANCHER avant l'allumage** : les fiches de la
migration sans adresse joignable (`.invalid`) ne reçoivent pas de préavis,
donc restent dans l'annuaire (dette P2). La consigne d'adresse est sur
`/adherer` depuis le 2026-10-15 (PR des e-mails).

**Ouverture des adhésions — PR OUVERTE le 2026-10-15** : tous les e-mails de la
plateforme harmonisés (salutation « Salut », forme positive, insécables, aucun
cadratin, garde commune `emails-redaction.test.ts`), l'invitation des fiches
migrées dit que les adhésions sont ouvertes, et une **invitation à adhérer**
pour les fiches en ligne part d'un bouton orga (`/admin/adhesions/inviter`,
migration 075, une fois par personne). **À FAIRE (Cateline)** : après la
première synchro réussie (cron du soir), cliquer « Inviter » ; la page relit
HelloAsso avant d'écrire. Dans la même PR : la page **« Mon adhésion »**
(`/mon-espace/adhesion` : dates, état, CTA « Renouveler » seulement quand il
sert), le délai validé « dans quelques minutes, et au plus tard le
lendemain » partout où il se dit, et une ligne `[adhesions]` de compteurs dans
les logs du cron pour diagnostiquer une adhésion non reliée.

## Header « Nous rejoindre », page bénévole, landing adhérer — PR OUVERTE le 2026-10-15

Le header passe de sept liens à cinq, plus un menu déroulant **« Nous
rejoindre »** : Adhérer (`/adherer`), Devenir bénévole (`/benevole`, page
**nouvelle**), Devenir bienfaitrice (`/partenaires`), chacun avec sa phrase
(`navRejoindre`, `src/constants/navigation.ts`). Le tiroir mobile reprend le
groupe sous le même titre. `/adherer` devient une landing (même grille Scalezia
que `/partenaires`) : les tarifs et le « à savoir » des statuts restent **mot
pour mot**.

**À relire** (collège) : `landingAdhesion` et `src/data/benevole.ts`, écrits par
Claude. Trois affirmations ont été retirées faute de source (temps à donner,
nombre de séances de coaching, accompagnement par une orga) : à remettre si le
collège les confirme. **Suite** : la landing partenaires par type de soutien,
PR suivante (section ci-dessous).

## Partenaires par façon d'aider — PR OUVERTE le 2026-10-15

Sur `/partenaires`, « Sponsors », « Écosystème » et « Comment nous aider ? »
laissent place à **une rangée de cartes défilantes par façon d'aider** :
mécénat financier, mécénat en nature, co-organiser un meetup, ouvrir votre
scène, siéger à notre jury, nous relayer et nous outiller (`typesSoutien`,
`src/data/partenaires.ts`). Une structure qui aide de plusieurs façons a une
carte dans chaque rangée, avec son rôle. Classement validé par Cateline le
2026-10-15 : **aucun mécène financier** pour l'instant (la rangée invite à être
la première), Berger-Levrault en nature (répétitions), The Playground est un
outil gratuit ouvert à toutes et tous (pas de `rel="sponsored"`), et tous les
partenaires ont donné leur accord pour apparaître.

**En attente** (2026-10-15) : JS&Co, Tech PAF, IA Innovateurs et Bureau des
recruteurs co-organisent des meetups en préparation, mais ne vont sur la page
**qu'une fois leur accord validé** (règle de Cateline ; validés à cette date :
Agile Toulouse, Flupa, Yeeso, déjà sur la page). JS&Co en a été retiré le même
jour. Il faudra aussi leur
site. Même règle pour Women Tech Makers Paris, French Product et le Tremplin
Tech Rocks.

## Landing partenaires — LIVRÉ le 2026-10-15 (PR #375), d'autres soutiens à venir

`/partenaires` devient une landing de conversion (grille Scalezia, revue
d'Audrey Jargot du 06/10 et du 08/10, notes dans Notion) : cible puis promesse
dans le H1, preuves (soutiens et chiffres) avant la demande, questions « oui »,
réassurance, formules (dont co-organisation de meetup, lieu et buffet),
pourquoi nous soutenir, qui sommes-nous, appel final, FAQ, bandeau mobile.
**Une action principale** : « Soutenir sur HelloAsso » (`HELLOASSO_SOUTIEN_URL`) ;
**une secondaire** : « Nous contacter », pour les autres formes d'aide. En-tête :
« Partenaires » remplace « Contact » ; pied de page : colonne « Nous soutenir ».

**Soutiens** : 15 en ligne depuis le 15/10 (`src/data/partenaires.ts`) ; **à fournir** (Cateline) : les suivants (nom, apport, occasion, accord, lien), rien n'est inventé ; des témoignages de partenaires (emplacement non créé tant
qu'il n'y en a pas). **À relire** : tous les textes de la landing
(`landingPartenaires`), écrits par Claude.
Textes ouverts au-delà de Toulouse le 2026-10-15 (Toulouse reste l'ancrage). Partenariat
Devoxx France en cours : à ajouter dans `src/data/partenaires.ts` **une fois signé**, pas avant.

## Textes après l'AGE du 29/09 — LIVRÉ le 2026-10-15 (PR #373), adhésions ouvertes, liens posés le même jour

Mentions légales (directrice de la publication, DPO, droits, photos, traceurs),
code de conduite recopié de l'annexe 1 du RI v1.0 (`src/data/charte.ts`,
`/charte` redirige toujours), page `/adherer` (`src/data/adhesion.ts`). URL de la campagne renseignée le
2026-10-15 (`HELLOASSO_ADHESION_URL`) : bouton visible, page indexée et au
sitemap dès la fusion. « Formulaire séparé » mène à la campagne de soutien
(`HELLOASSO_SOUTIEN_URL`). Widgets HelloAsso non intégrés : bouton du site
gardé (a11y, un seul CTA).

Liens vers `/adherer` posés le 2026-10-15 : menu principal (7e entrée), pied
de page, `/connexion`, `/a-propos` ; textes « à venir » recalés (brève retirée
de `A_VENIR`, e-mail d'invitation).
**À décider** (Cateline) : aucun formulaire d'inscription aux événements
n'est sur le site (Meetup.com, The Playground) — la case de refus d'image et
le badge promis par les mentions légales sont à mettre dans CES outils ;
`docs/google-ad-grants.md` §4 bis disait « le site reste muet sur les
montants », `/adherer` les affiche désormais (texte du 13/10).

## Kit de communication — LIVRÉ le 2026-10-14, modèle de présentation le 2026-10-15, fichiers et une décision en attente (tutoiement)

Page `/kit-de-communication` (liée depuis `/partenaires` et le pied de page) :
aperçu et téléchargement de chaque logo, **présentation de l'association**
pour les partenaires (PPTX, 9 diapositives, construite dans Canva le
2026-10-15 depuis la finale du Tremplin ; métadonnées personnelles de
l'export retirées), **modèle de présentation** PPTX
(14 diapositives, ajouté le 2026-10-15, texte alternatif de ses logos nettoyé
d'un chemin local nominatif), archive ZIP construite au build sans
dépendance (`src/lib/zip.ts`), palette aux codes copiables, typographies, règles
d'usage. Données et sources : `src/data/kit-communication.ts`. Fichiers servis
depuis `public/kit/`, **copiés tels quels** du Drive (aucun généré).

**À FOURNIR** (Cateline) — chaque format manquant est un emplacement vide que la
page affiche « à venir » ; pour le remplir, déposer le fichier dans
`public/kit/` et renseigner nom, dimensions et poids dans
`src/data/kit-communication.ts` (le test refuse l'un sans l'autre) :

- `tech-speakher-logo-complet-fond-sombre.svg`, `tech-speakher-logo-complet-fond-clair.svg`,
  `tech-speakher-icone-fond-sombre.svg` — **aucun SVG du logo n'existe**, ni
  dans le dépôt ni dans le Drive (le PDF Canva « Logo carré » embarque une
  image 1024×768, pas des vecteurs) ;
- des PNG **à fond transparent** du logo complet et de l'icône — aucun fichier
  du Drive n'a de canal alpha, `tsh_logo_white.png` compris (fond blanc) ;
- l'**icône sur fond clair**, si on la veut (la charte n'en parle pas) ;
- des PNG plus grands que 500 px pour l'impression (kakémono 3213×7560 :
  `tokens.json` § format).

**TRANCHÉ le 2026-10-14** (Cateline), là où la charte de marque
(`TSH_Charte_Marque.pptx`, mai 2026) contredisait le code :

1. **Logo sur fond clair** : autorisé, **pour l'impression uniquement**. La page
   et `tokens.json` (`theme.light`) le disent ; la charte est à recaler.
2. **Le wordmark** : c'est **TECH SPEAK'HER en capitales cyan**, celui des
   fichiers du logo. La mention « Quicksand Bold, casse mixte » de la charte est
   périmée, `tokens.json` (`font.family.wordmark`) est recalé. `logo tech
   speakher.jpg` (Drive, casse mixte blanche) est une ancienne version, écartée.

**À DÉCIDER** : le **tutoiement**. La charte proscrit le vouvoiement ;
`/partenaires` vouvoie, et le kit (même public) aussi.

## Licence et réutilisation — TRANCHÉ le 2026-08-23

Le code reste **public** (on le lit, on y contribue, les issues et les pull
requests restent ouvertes), sous **licence propriétaire** : déployer la
plateforme, en reprendre une partie ou garder un fork actif demande une
**autorisation écrite** (`LICENSE`, `TRADEMARK.md`, README).

Ce que cette décision **ferme**, et qui n'est donc plus à faire :

- ~~l'externalisation de la marque en configuration (couleurs, textes, SEO)
  pour qu'une autre communauté déploie son tremplin~~ — la réutilisation passe
  par une demande à `techspeakher@gmail.com`, au cas par cas, pas par un
  produit à rendre générique ;
- ~~le label d'issues `réutilisabilité`~~ — à retirer côté GitHub (réglage, pas
  code) ; le modèle d'issue « évolution » ne le suggère plus.

Ce qu'elle **laisse ouvert** : l'attribution « Propulsé par Tech Speak'Her »
n'existe dans aucun écran (dette P2 du 23/08). Elle ne coûte rien tant qu'aucun
déploiement n'est autorisé, et devient un pré-requis le jour du premier.

**Le passage en public — état au 2026-10-15 : DÉCIDÉ, en cours.** Méthode
tranchée par Cateline : un **nouveau dépôt public**, créé d'un seul commit à
partir de `main` nettoyé ; l'actuel reste **privé**, en archive (ses 374 PR,
ses issues et son historique restent privés, donc aucune réécriture
d'historique ni demande au support GitHub). Balayage du 15/10 sur les 1 246
commits : **aucun secret**. Relecture des 374 PR et 3 issues par six agents :
rien de grave. Fait le 15/10 :

- ~~`sheets-templates/*.csv`~~ (personnes réelles) : **supprimés** ;
- ~~vraies finalistes dans `src/lib/tremplin-seed.ts`~~ (nom, bio, LinkedIn,
  publiables hors consentement dans un dépôt public) : **remplacées par des
  figurantes** ; `seeds-figurants.test.ts` exige que tout LinkedIn de seed finisse
  par `-demo` et le retour des CSV ;
- les 30 PR ouvertes triées (section « Chantiers repris des PR fermées »).

**Reste, dans l'ordre** : créer le dépôt public (Cateline : nom, compte),
y pousser `main` en un commit ; rebrancher Vercel sur le nouveau dépôt et
recopier les secrets de la CI ; poser la protection de `main` (possible en
public sur un compte gratuit : lint, unitaires, E2E, build obligatoires) ;
archiver l'ancien. **Restent publiques par choix** (contenu déjà sur le site) :
les intervenantes du DevFest (`src/data/devfest.ts`), les crédits de
`/tremplin`, les fondatrices ; les migrations SQL déjà appliquées gardent leurs
commentaires nominatifs, et quelques tests prennent des noms de fondatrices
comme exemples (relevés et remplacés le 15/10 : Géraldine Corrales, les LinkedIn de deux fondatrices).

Soldé le 23/08 dans la même PR : le nom d'une membre servait d'exemple SQL dans
`docs/exploitation.md` (placeholder de migration), remplacé par un générique.

## Chantier import & annuaire — état au 2026-08-21

> **Cette section a été relue LIGNE PAR LIGNE CONTRE LE CODE le 21/08**, parce
> qu'elle annonçait comme « à faire » trois choses livrées depuis le 16/08 — dont
> « le seul finding prod encore ouvert », corrigé le jour même où on l'écrivait.
> Un doc de suivi qu'on ne raye pas ne vieillit pas seulement, il **bloque** : le
> 18/08, une factorisation sûre a été refusée sur la foi d'une autre liste
> périmée. Ce qui suit ne porte donc plus que ce qui est **vérifié ouvert**.

**En prod** : « proposition hors répertoire » (#317), « import JSON/CSV » (#318,
corrigé par #322 : vrai format Notist), « recherche de conférence » (#319),
« dates multi-jours » (#320), « actions Mes talks » (#322), « honnêteté de
l'import » (#324). L'**import Notist** (#326) est en prod aussi : les fiches
d'événements donnent conférence, lieu et dates, deux bugs parseur sont corrigés,
et les items 4-5 de la dette sont soldés.

**Soldé depuis, et rayé ici plutôt que laissé à croire :**

- ~~Dette item 7 — proposition partagée modifiée en place~~ → **RÉSOLU le
  16/08.** `updateConferenceProposition` ne corrige en place que ce que la
  saisie appelante est SEULE à tenir (troisième condition du `WHERE`) ; sinon la
  saisie se détache sur sa propre proposition. La revue a trouvé au passage un
  second trou de la même famille, fermé dans la foulée. Détail : dette item 7 et
  `docs/conception-registre-conferences.md`.
- ~~Dette Brevo — la suppression RGPD n'efface pas le contact~~ → **RÉSOLU le
  16/08** (#330). Reste le point P2 « échecs de suppression muets ».

Ordre de reprise :

1. ~~**Valider le parcours réel d'Aurélie en prod**~~ → **FAIT le 21/08, et ça
   a marché** : l'import est passé, les talks sont en place. Ce que la ligne
   « à prévoir côté orga » annonçait est arrivé tel quel — **113 propositions
   d'un coup dans la file** — et a révélé que l'autre bout n'existait pas : la
   file n'entrait dans aucune tâche (« À faire » disait « Tout roule »), et
   aucun écran ne montrait la saisie qu'on arbitre. Livré le 22/08 par la
   PR #359 (`docs/conception-arbitrage-conferences.md`) : la règle
   `valider-conference`, la file avec l'indice de rapprochement au répertoire,
   la page d'une proposition, et la correction avant validation. **Le tri de sa
   file, chiffré le 22/08** en jouant la fonction livrée sur les 112 noms lus
   dans sa capture, contre le catalogue d'amorçage : **31 déjà au répertoire**
   (valider ne crée rien), **14 ressemblent** à une conférence existante,
   **67 noms neufs** — et ce tri a fait tomber un faux positif de la fonction
   elle-même, corrigé dans la même PR. Reste ouvert,
   en dette : l'année corrigée par l'orga est encore réversible par la membre
   (mesuré, effort S). Contexte d'origine, conservé parce qu'il explique le
   chiffre : son fichier
   (noti.st/aurelievache.json) → importer → vérifier 73 talks AVEC conférences
   résolues, puis que l'orga voie les propositions en file. Mesuré le 16/08
   sur son fichier réel : 154 propositions distinctes (nom, année) — le
   plafond de 20/lot imposait 8 lots sur 3 h, il est RELEVÉ à 200 (PR dédiée
   du 16/08). À prévoir côté orga : ~154 propositions d'un coup dans la file
   de modération à son premier import.
2. ~~**Moissonneuse — détecteur d'id Sessionize**~~ → **LIVRÉ**, et la ligne
   « vérifié ouvert le 21/08 » était déjà fausse en l'écrivant : la même journée
   a mergé le détecteur (`src/lib/detecteur-sessionize.ts`, PR #355 — commits
   `e7be357` puis quatre passes de durcissement de la garde SSRF). Relu contre
   le code le **22/08** : les deux écrans d'édition d'une conférence acceptent
   l'adresse de la page programme (`endpointOuPageField` →
   `resoudreEndpointSaisi` → détecteur), et l'écran de correction d'une
   proposition l'accepte aussi depuis la PR #359. La garde est là (https seul,
   port standard, IP privées refusées à chaque saut de redirection, taille et
   temps bornés). Décision utilisatrice inchangée : on GARDE la moissonneuse et
   on la nourrit.
   **Reste ouvert du même esprit** : l'écoute d'un profil Notist déclaré
   (re-sync automatique des futurs talks d'Aurélie), instruite au scénario J de
   `docs/faisabilite-import-talks.md` — demande utilisatrice du 16/08, toutes
   les briques livrées. Le parcours d'import en prod étant validé (item 1),
   plus rien ne la séquence après.
3. **Dette `.invalid` — le cron de rappel poste les adresses de migration à
   Brevo** *(vérifié ouvert le 21/08)*. `getProfilesDueForReminder` est la SEULE
   requête d'envoi qui laisse passer `…@a-completer.invalid`, là où ses quatre
   sœurs les excluent. `.invalid` étant réservé par la RFC 2606, chaque envoi est
   un rebond dur inscrit contre l'expéditeur partagé — celui qui porte aussi les
   liens de connexion. **Une condition, une ligne, effort XS**, et c'est le
   meilleur rapport de la liste : ça protège la délivrabilité des liens magiques.

Notes d'exploitation : le plafond de dépense mensuel de l'org a tué des
agents de revue le 16/08 — prévoir la rallonge avant les grosses passes
multi-agents.

**Les E2E en local demandent trois précautions**, chacune payée par un faux
verdict le 21/08 et consignée au registre de `docs/principes-tests.md` : le
décor doit être compté avant de conclure (sans lui, Playwright **ignore** les
tests et « skipped » se lit comme un vert) ; le port 3000 doit être libéré avant
chaque exécution (`reuseExistingServer: !CI` fait réutiliser un serveur fuité,
donc juger l'ancien build) ; et `pkill -f next-server` depuis un script tue le
script lui-même — écrire le motif `next-serv[e]r`. La CI, elle, reste fiable :
elle monte sa base et son serveur à chaque fois.

## Agenda public — plan LIVRÉ en entier (état au 2026-08-21)

**Les cinq lots du plan (0 à 4) sont en prod.** Il ne reste de ce chantier
qu'une action à la main et deux décisions produit, listées en fin de section —
plus aucun code prévu. L'audit `docs/audit-ux-agenda-2026-08.md` fait foi :
**§7 porte l'état lot par lot**, **§8 les décisions prises et les questions
encore ouvertes**. Ce qui suit n'en est que l'entrée.

**En prod** : l'horizon glissant sur `/agenda`, les années révolues sur
`/agenda/[annee]`, la mémoire complète (aucun plafond silencieux), les données
structurées `Event`, l'entrée dans la loupe et dans `llms.txt`, le socle
géographique des occurrences et la saisie de ville sur la Base Adresse Nationale
(PR #334, #336, #337, #338, #341).

**Le lot 1 est fait** : `/agenda` et `/agenda/[annee]` ont enfin une ENTRÉE —
un champ de recherche, trois facettes (ville, région, conférence) qui annoncent
chacune son rendement, et l'état **dans l'URL** (`?q=`, `?ville=`, `?region=`,
`?conference=`), lu côté serveur. Le résumé nomme le filtre actif, et une date
en ligne apparaît partout où on la cherche. Le détail, et les **deux écarts
assumés** au plan (des listes déroulantes plutôt que des puces ; le compte de la
page d'année descendu sous la barre), sont écrits en §7 de l'audit.

**La revue avant PR a rendu un rapport NON vide**, et le lot en est sorti
différent : dix correctifs, dont une commande qui disparaissait quand la
recherche resserrait la vue, une facette qui promettait 1 et rendait 0 (une clé
de conférence tronquée), des commandes qui gardaient l'ancienne valeur après un
retour arrière, et — le plus grave hors écran — une date EN SALLE qui pouvait
traverser tous les filtres géographiques parce que `REGIONS` autorisait
« À distance (visio) » à la saisie. Le détail des dix, et des cinq points
justifiés plutôt que corrigés, est en §7 de l'audit.

Ordre de reprise :

1. ~~**Le lot 4**, facultatif : un flux iCalendar de l'horizon.~~ **LIVRÉ le
   21/08** : `/agenda.ics` sert l'horizon aux dates exactes, en journées
   entières, avec un lien discret sous le CTA de `/agenda`. **Le plan de l'audit
   est donc entièrement livré** (lots 0 à 4). Détail en §7.2.
2. **Trancher la question 2 de §8** — quelles vues filtrées mérite-t-on
   d'indexer ? Le défaut est en place (`canonical` vers la page nue), donc rien
   ne presse : la question se posera le jour où `?ville=toulouse` vaudra une
   adresse à elle.
3. Reprendre la liste de `docs/dette-technique.md`, où l'agenda laisse deux
   entrées mineures : `talkType` traverse le DTO sans qu'aucun consommateur ne le
   lise (à servir ou à retirer, décider plutôt que transporter), et le jour
   répété à l'identique sous une même tranche (§5 de l'audit). `lienConf` y
   figurait aussi : il en est SORTI le 21/08, il porte désormais l'`url` des
   `Event` et du flux iCalendar.

**Vérifié en prod le 18/08** (depuis un téléphone, cf. §7 de l'audit) : `/agenda`
déclare 8 éléments valides, dont ses 7 `Event`, et les avertissements restants
sont des champs facultatifs — deux absents exprès (`offers`, `image`), trois qui
demanderaient d'élargir le DTO public (`endDate`, `description`, l'URL de
l'`organizer`) et attendent une décision. `/agenda/2025` ne déclare aucun `Event`
et c'est correct : ses deux dates sont au mois près.

Cette vérification a fait tomber un défaut d'écran, corrigé le 18/08 : l'aperçu
du passé de `/agenda` annonçait « Voici la plus récente. » au-dessus de rien,
parce qu'il empruntait la lecture du fil connecté, qui exige un jour exact.
`/agenda` a désormais la sienne (`getApercuPasse`), et l'invariant « l'aperçu voit
exactement ce que l'archive compte » a son test. Détail en §7.1 de l'audit.

Reste à faire tourner à la main, hors CI : `npm run geo:occurrences -- --essai`
puis la vraie passe (le chemin nominal de la BAN reste non prouvé, cf. §7). Tant
qu'il n'a pas tourné, les dates saisies AVANT la migration 072 se rangent en
« International » dans la facette « région », faute de code INSEE — elles restent
trouvables par ville et par la recherche.

Deux brouillons d'articles attendent une relecture dans
`docs/brouillons-articles/` : ils sont écrits **à la première personne** et les
souvenirs qu'ils contiennent sont des placeholders à réécrire.

## Piste — « À faire » à un tap, et l'onglet Messages

> Ajoutée 2026-08-15. Audit : `docs/audit-ux-profil-orga-2026-08.md`.
> Conception et maquettes : `docs/conception-profil-et-a-faire.md`.

**Constat.** Le chantier navigation fermé, il reste `/mon-espace/profil` : pour
une orga, huit rangées en une seule liste (quatre mondes mélangés), un « À
faire » sans compteur, et deux rangées « Tremplin 2026 » qui ne parlent pas de
la même chose. L'app ne dit nulle part qu'il y a du travail : le seul canal est
un e-mail quotidien vers une adresse d'équipe. En face, l'onglet **Messages**
occupe un cinquième de la barre canonique pour la surface la moins vivante du
produit, et les bravos (livrés) ne préviennent personne.

**Piste.** Deux surfaces, deux verbes : l'**Accueil** dit ce qui se passe (les
bravos y arrivent), et l'emplacement qui porte aujourd'hui **Messages** devient
**« À faire »** — une liste unique par personne (puces
`Toutes · Perso · Asso · Coach`, décision du 2026-08-07) avec un compteur. La
barre ne change pas : c'est le contenu derrière l'emplacement qui varie, comme
le ➕ le fait déjà. `/mon-espace/messages` reste la page où on lit un message,
elle perd juste son onglet.

**Tranché le 2026-08-16** : oui pour l'onglet, et il s'appelle « À faire ».
Restent ouvertes : les bravos au fil ou à la liste, le mot « bénévolat »,
« Espace orga » partout, et l'ouverture sur `Toutes` ou `Perso`.

## Piste à concevoir — un espace phase 3 (montée sur scène) qui lui est propre

> Ajoutée 2026-07-21, à partir d'un retour orga sur sa propre fiche.

**Constat.** L'espace membre d'une édition mélangeait des concerns de phases
différentes : une participante « uniquement en phase 3 » (montée sur scène,
préparation à la conférence, après la soirée) se voyait proposer le **pitch de
finale** et la **visibilité dans la galerie des finalistes** (phase 2).
**Corrigé** (livré) : ces deux sections sont désormais gatées (pitch = phase 1
ou finaliste ; visibilité galerie = finaliste confirmée), donc plus de mélange.

**Vision à concevoir (pas encore faite).** La phase 3 mérite une **présentation
dédiée**, sans emprunter aux phases 1/2 :
- associer le Tremplin à **la conférence** (DevFest…) et à une **galerie des
  talks** portés sur scène ;
- **mettre en avant l'accompagnement de phase 3** : les personnes concernées et
  leurs ateliers de préparation à la conférence ;
- garder tout ça **distinct** des phases 1 (CFP & pitch) et 2 (finale/galerie
  des finalistes).

À spécifier avec l'orga avant implémentation (périmètre public/privé, ce qu'on
montre de qui, articulation avec le palmarès existant).

## Proposition de valeur (le cap)

Ce qui rend Tech Speak'Her unique : **l'accompagnement des speakeuses et leur
mise en avant dans un annuaire** (femmes de la tech, Toulouse). Tout arbitrage
se fait à cette aune : on privilégie ce que personne d'autre ne fait pour cette
communauté, et on évite de réimplémenter des services déjà commoditisés et
gratuits ailleurs.

Deux principes qui en découlent, appliqués partout :

1. **Agréger des liens, pas ingérer des fichiers/données.** On renvoie vers là
   où le contenu vit déjà (Sessionize, Notist, SlideShare…), on ne stocke pas.
2. **Neutralité.** On ne pousse jamais UNE solution à une speakeuse (aucun
   partenariat commercial) : on explique la problématique et on donne
   **plusieurs** alternatives avec leurs compromis, elle choisit.

## Fait (en prod)

> Recalé le **2026-08-21** : trois entrées annonçaient encore « En PR » des lots
> mergés depuis longtemps (#98, #152). Vérifié dans le code de `main` — page
> « Mes connexions », `cfp_sync_mode`, migrations `011` et `012` sur les 82 du
> dossier.

- **Upload d'images du site (Vercel Blob)** : adaptateur `src/lib/media.ts`
  (isolé, migration OVH prévue sans impact ailleurs, cf.
  `docs/conception-articles.md` §6), branché sur les images d'articles/pages
  (`/admin/contenus`, lot 6 d'`docs/implementation-articles.md`). Mise en place
  du store : `docs/exploitation.md`. **Distinct** de l'hébergement de slides
  (toujours écarté, voir ci-dessous) : ce sont des visuels **du site**, déposés
  par l'orga, pas des documents personnels de speakeuses.
- **Photo de la fiche = photo de compte** : upload depuis la fiche
  (`ChampsIdentite`, étape « Profil » de `/mon-espace/fiche`), là où se gèrent
  déjà nom/bio/slug — pas depuis `/mon-espace/connexions` (essayé puis
  retiré : personne ne va chercher sa photo de fiche dans un écran de
  connexions). Même colonne `users.image`, même adaptateur `src/lib/media.ts`
  que la reprise de photo Google/LinkedIn (qui reste sur `/mon-espace/connexions`,
  inchangée). Détail : section ci-dessous (« Hébergement des slides »).
- **Liens CFP au profil** (Sessionize / Conference Hall), affichés dans « Talks
  & conférences » + `sameAs` SEO. Livré (PR #100).
- **Moissonneur CFP** (scénario F de l'étude) : cron qui lit les endpoints
  publics Sessionize d'un registre d'événements, matche par liens/nom, propose
  des « Talks repérés pour toi » à confirmer en un clic. Consentement révocable
  (`cfp_sync_mode`). En prod (PR #98, migration `011`).
- **Localisation & langues du profil** : ville de résidence, zones
  d'intervention (régions FR + Toute la France + International + À distance),
  langues (FR/EN/ES/IT/DE). Filtrables dans l'annuaire + affichées sur la fiche.
  En prod (PR #98, migration `012`).
- **Anti-doublons de compte (inscription mixte)** : prévenir qu'une même
  personne crée deux comptes en se connectant tantôt via Google, tantôt via
  LinkedIn ou lien magique, quand ses adresses diffèrent. Décision produit :
  modèle **mixte** (inscription libre ET invitation), **prévention sans
  blocage**, et **pas** d'outil de fusion côté orga (aucun nettoyage manuel).
  Deux briques : (1) page « Mes connexions » pour rattacher plusieurs méthodes
  à un même compte ; (2) écran non bloquant « tu as peut-être déjà un compte »
  quand une connexion créerait un compte homonyme (détection par le nom, seul
  indice à la 1ʳᵉ connexion, donc best-effort : on propose, on n'impose pas).
  En prod (PR #152).

### Carte « Créer ma fiche speakeuse ? » et genre non binaire — tranché le 2026-07-25, livré (vérifié contre le code le 2026-08-21)

**Décision.** Les personnes **non binaires sont accueillies** dans l'annuaire.
L'attestation (étape 5 du profil) devient « J'atteste être une femme **ou une
personne non binaire**. » ; l'**identité de marque** (« communauté de femmes de
la tech ») est **conservée** partout ailleurs. Le champ interne `isWoman` est
gardé (contrat BDD + garde serveur), seul le libellé affiché porte le sens.

**Livré.** Wording de l'attestation (`ProfileForm`) + message d'erreur
(`mon-espace/page`) ; et le **menu compte** propose désormais « Créer ma fiche
speakeuse » à tout compte éligible **sans** fiche (desktop + tiroir mobile),
alignant le lanceur d'espaces sur la carte d'onboarding.

## En réflexion / à décider

> **Ce que cette section contient, au 2026-08-21.** Des sujets à trancher — et
> deux qui ne le sont plus : « Contact modéré des speakeuses » (décidé, la spec
> est écrite, il reste à implémenter) et « Section blog / ressources » (socle
> livré, reste de l'éditorial). Ne pas les re-litiger : ils attendent du travail,
> pas une décision. Ce qui est tranché quitte cette section le jour où on le
> tranche (`docs/clore-une-session.md`, le cliquet de sortie).

### Centraliser les formulaires et le consentement dans la plateforme — à concevoir

> Ajoutée 2026-07-23, à partir du chantier « consentement à la diffusion »
> (`docs/conception-autorisation-diffusion.md`, `docs/implementation-autorisation-diffusion.md`).
> Question ouverte par l'orga : **et si on faisait les formulaires dans la
> plateforme ?**

**Constat.** L'inscription au Tremplin, le recueil du consentement
(mention / diffusion d'image), les retours de satisfaction et les citations
passent aujourd'hui par des **Google Forms externes**. Le consentement vit donc
**hors** de la plateforme : export PDF, réconciliation manuelle des Oui/Non,
provenance rétro-saisie (`base = 'formulaire_inscription'`), preuve à relier à
la main (`preuve_lien`). Rien n'est horodaté ni journalisé automatiquement au
moment du recueil. On a le modèle pour le prouver (journal + `ConsentJournal`,
migration 037), mais la **source** reste externe.

**Vision.** Faire les formulaires **dans** la plateforme pour capter
consentement + provenance + preuve **à la source** :
- **Formulaire d'inscription Tremplin natif** : chaque question de consentement
  est un **opt-in explicite**, horodaté et journalisé d'office
  (`tremplin_consent_log`) ; la **preuve, c'est la soumission** (plus de PDF ni
  de `preuve_lien` à coller). La `base` devient `formulaire_inscription`
  **automatiquement**, sans backfill.
- **Consentement granulaire par usage** : distinguer la **diffusion**
  (nom / bio / talk / image, site **et** réseaux) de la **citation / témoignage**.
  Cette dernière avec un mode **« valider avant chaque publication »** — cas réel
  rencontré (une finaliste l'a demandé sur son verbatim). Statut **par personne
  et par usage**, révocable, lisible des deux côtés.
- **Wording de consentement maîtrisé** : couvrir explicitement **le site Tech
  Speak'Her, ses réseaux, et distinguer l'annuaire** (démarche séparée) — le
  Google Form actuel ne parlait que de « réseaux sociaux ».
- **Feedback / satisfaction natif (option)** : garder les verbatims **et** leur
  consentement de reprise reliés à la personne, au lieu d'un export à recouper.

**Bénéfices.** Démontrabilité RGPD **automatique**, fin de la réconciliation
manuelle, une seule **source de vérité**, provenance et preuve posées au bon
moment.

**À trancher.**
- **Périmètre** : n'internaliser **que** le formulaire d'inscription + les
  consentements (le reste peut rester externe), plutôt qu'un moteur de
  formulaires générique. Garde-fou proposition de valeur : **ne pas
  réimplémenter Google Forms** — on ajoute le strict nécessaire au service de
  l'accompagnement et du consentement.
- **Modèle de données du consentement par usage** : étendre le journal avec une
  dimension `usage` (`diffusion` / `citation` / …) et un indicateur
  « validation préalable » ? ou une table `consentements (personne, usage,
  edition, etat, preuve, date)` ? À concevoir avec l'existant
  (`setRegistrationVisibility`, `ConsentJournal`, migration 037).
- **Articulation citations** : où vit une citation consentie, et comment l'UI
  orga signale « à valider avant publication » avant tout affichage public.
  > Premier pas fait (2026-08-01) : les verbatims publiés sur la home vivent
  > dans `src/data/verbatims.ts`, avec l'accord de reprise porté par la donnée
  > (`consentement: "libre" | "validation_prealable"`) et un filtre qui ne
  > publie que les accords libres (`src/__tests__/verbatims.test.ts`). Le cas
  > « validez avec moi avant chaque publication » reste hors du dépôt tant
  > que la phrase n'est pas revue avec la personne : c'est du contenu statique
  > tenu à la main, pas encore l'état par personne et par usage décrit
  > ci-dessus.

### Contact modéré des speakeuses — décidé, à implémenter

Une speakeuse peut accepter d'être contactée via le site sans exposer son e-mail ;
pour garder une **safe place**, tout message passe par une **modération orga**
avant d'être transmis. Conception fonctionnelle détaillée :
`docs/plateforme-conception-fonctionnelle.md` (§3.6).

- **Modération systématique** (pas de relais direct). File « Messages » dans
  `/admin` : transmettre / rejeter. Rejet non notifié à l'expéditeur.
- **Motif de contact obligatoire** : Conférence ou table ronde · Jury · Interview
  / média / podcast · Autre (libre).
- **Historique des messages conservé** (audit, récidive) → mention légale.
- La speakeuse lit ses messages transmis dans son espace et **répond depuis sa
  messagerie** (e-mail de l'expéditeur visible, le sien reste masqué).
- **Notifications groupées par cron** (choix produit anti-spam ; Brevo laisse
  **300 e-mails/jour**, donc pas de contrainte de quota, cf.
  `docs/exploitation.md`) : digest orga à 17h (fiches + messages à traiter) et
  digest speakeuse quotidien (extrait des messages transmis). La décision de
  modération de profil reste un e-mail immédiat.

### Hébergement des slides — décision : on n'héberge PAS

- **Verdict** : ne pas héberger les fichiers de slides. Marché commoditisé
  (Notist, SpeakerDeck, Google Slides, SlideShare), incumbents gratuits et
  permanents ; coût euros faible mais **charge réelle** (bande passante,
  modération, droits/copyright, RGPD, durabilité, maintenance) pour zéro valeur
  différenciante. **Toujours valable** pour les documents personnels d'une
  speakeuse (ses propres slides de conférence).
- **Ce qu'on fait à la place** : la speakeuse colle son lien (champ `lienSlides`
  déjà là), on l'affiche. La rétention (« donner une raison de revenir ») est
  couverte par le moissonneur + les suggestions + le rappel semestriel, pas par
  le stockage.
- **Nuance posée le 2026-08-08** : cette décision visait l'auto-hébergement de
  fichiers **tiers** (slides d'une speakeuse). Elle ne couvre pas les **visuels
  du site lui-même** (images d'articles, illustration), qu'on héberge désormais
  (voir « Fait » ci-dessus, `src/lib/media.ts`).
  - **Photo de profil (upload) — livré (2026-08-08).** `speaker_profiles` n'a
    jamais eu de colonne photo dédiée : l'avatar vient de `users.image`, posé
    par OAuth (Google/LinkedIn, sur `/mon-espace/connexions`) ou, désormais,
    par upload direct **depuis la fiche** (`ChampsIdentite`, étape « Profil »,
    route `POST /api/mon-espace/avatar`, même colonne, mêmes règles MIME/taille
    que `src/lib/media.ts`, limitée à 10 envois/10 min/compte) — une PREMIÈRE
    version l'avait posé sur `/mon-espace/connexions`, corrigée le jour même
    (retour terrain : la photo de la fiche se gère avec le reste de la fiche,
    pas dans un écran de connexions). Pas de recadrage en v1 (KISS,
    `object-fit: cover` suffit à l'`Avatar` rond existant). Le token de session
    est rafraîchi (`unstable_update`, `pickManualImageUpdate`) pour que le
    header ne garde pas l'ancien avatar jusqu'à la reconnexion.
  - **Documents déposés par l'orga** (chartes, supports d'atelier) : cas
    **différent** du refus ci-dessus — contenu **officiel de l'association**,
    déposé et modéré par l'orga elle-même (pas un dépôt ouvert à des tiers).
    Décidé le 2026-08-08 : **réservé aux orgas**, jamais aux speakeuses/
    participantes. Réutiliserait `src/lib/media.ts` (élargi aux MIME PDF) ; pas
    encore cadré (où les afficher, taille max, remplacement/suppression).

### Section blog / ressources — socle livré, reste éditorial

- **Tranché** : pas de section `/blog` séparée. On a **étendu `actualites`**
  (« article = actualité », liste unique) avec un **éditeur orga**
  (`/admin/contenus`, raccourci « ＋ Ajouter un article » dans le menu compte) et
  une page de lecture `/articles/[slug]`. Le socle technique est **livré**.
- **Pourquoi** : meilleur foyer pour le contenu d'accompagnement. Sert la
  proposition de valeur (expliquer une problématique + plusieurs solutions),
  apporte du **SEO/acquisition** (l'annuaire n'amène pas de trafic, le blog si).
- **Reste (éditorial)** : écrire le premier article « Où héberger tes slides ? »
  — neutre, multi-solutions (Notist, SpeakerDeck, Google Slides, ton propre
  site…), compromis de chacun (permanence, portabilité, coût, embed). Puis un
  lien discret depuis le champ slides du formulaire de talk (« Pas sûre où
  héberger ? »), sans reco intégrée.
- **Coût** : éditorial (garder les articles à jour), pas technique.

### Notist comme source de données — analysé, à intégrer à l'étude

- **Constat** : Notist est **centré speaker** (`noti.st/{nom}` = portfolio d'une
  personne) — l'axe qui manquait à Sessionize / Conference Hall. Expose du JSON
  (`rel="alternate"`) et une API **oEmbed** (`noti.st/api/oembed?url=…`).
- **Mais même mur** : accès automatisés **bloqués (403)** comme Sessionize, et
  l'oEmbed **embarque une présentation dont on a déjà l'URL** — il n'énumère pas
  les talks d'un speaker. Donc **pas** d'import automatique de l'historique.
- **Ce que ça débloque** : un **bel embed** quand la speakeuse colle son lien
  Notist (cohérent avec « agréger des liens »). À ajouter comme 3ᵉ plateforme
  dans `docs/faisabilite-import-talks.md` (verdict : embed d'un lien fourni, pas
  d'import).

### Attestation retirée sur une fiche PUBLIÉE — à trancher

> Ajoutée 2026-08-01, en donnant sa page à l'attestation (lot I).

`raisonBlocageAnnuaire` garde la SOUMISSION à l'annuaire : sans attestation, on
ne peut pas soumettre. Mais rien ne garde la suite — `upsertProfile` conserve
délibérément un profil publié (« on NE rebloque PAS un profil publié »). Une
speakeuse qui décoche son attestation reste donc dans l'annuaire public.

Le comportement est ANTÉRIEUR au lot I (l'assistant permettait déjà de la
décocher et d'enregistrer), mais il devient plus atteignable maintenant qu'une
page porte l'attestation. Trois options :

1. **Retrait automatique** : décocher retire la fiche de l'annuaire. Franc, mais
   brutal — un clic de trop et la fiche disparaît sans qu'on l'ait demandé.
2. **Confirmation explicite** sur la page attestation quand la fiche est
   publiée, avec la conséquence écrite noir sur blanc, puis retrait.
3. **Signalement à l'orga** (file de modération) sans rien retirer tout de suite.

L'option 2 tient la règle du projet (annoncer la conséquence avant d'agir) sans
faire disparaître une fiche par accident. À trancher avec l'orga.

### Recherche de l'annuaire speakeuses — UX à revoir + accès orga — à trancher

Sur l'annuaire public, ce sont surtout les **filtres** qui sautent aux yeux,
alors que la **recherche** (par nom / sujet) serait le point d'entrée le plus
utile : à remettre en avant (la recherche d'abord, les filtres en second /
repliables). Les **orgas** doivent aussi pouvoir chercher une speakeuse (elles
n'ont aujourd'hui pas le même point d'entrée). Question de conception à
trancher : est-ce **la même page** avec des **vues** différentes (public vs
orga) plutôt que deux écrans → éviter le « double code » ? Impact : facteur
commun (liste + recherche + filtres) mutualisé, la vue orga ajoutant ses
actions (accès fiche, rattachement…). À concevoir avant de coder.

### Pages « conférences » (répertoire + fiche édition Tremplin) — UX à refaire

> Ajoutée 2026-07-24, retour orga en manipulant `/admin/conferences` et la fiche
> édition Tremplin (« l'UX est vraiment dégueu sur ces pages »).

**Constat UX.** Ces pages sont pénibles à utiliser :
- **Doublon sur la fiche édition Tremplin** : la conférence est demandée **deux
  fois** — en haut en texte libre (« Conférence » + ville + date + site) et en
  bas via « Conférence partenaire dans la référence » (lien au répertoire). Deux
  sources pour la même chose, sans articulation claire.
- **Sélecteur quasi vide** : « Conférence partenaire dans la référence » liste
  des **éditions datées** (`conference_editions`), or le catalogue seedé (~28
  conférences : DevFest Nantes, Devoxx, MiXiT…) n'a **aucune édition** → il
  n'apparaît pas. Seules les confs ayant une édition (DevFest 2026, et jadis la
  junk communautaire) remontaient. On croit le répertoire vide alors qu'il est
  riche.
- Mise en page et hiérarchie générales à revoir (formulaire long, actions peu
  lisibles).

**Direction (chantier, après #211).**
- **Sélecteur = catalogue complet des conférences**, à la place du dropdown
  d'éditions quasi vide.
- **Peupler les éditions** au besoin, en **vérifiant par recherche web** qu'elles
  ont réellement eu lieu (pas de rangs inventés).
- **Ajout d'une année/édition** possible si elle manque, mais **uniquement pour
  une conférence déjà connue** — jamais créer une nouvelle conférence (cohérent
  avec le retrait de l'ajout-conférence par les membres, livré). Qui peut
  l'ajouter (speakeuse vs orga) : à trancher.
- **Un seul champ conférence** sur la fiche édition Tremplin (le haut en texte
  libre se dérive du répertoire → fin du doublon).

Lié au socle « article ↔ conférence » (PR #211), qui réutilise le même
sélecteur `listEditionOptions` et hérite donc de la même limite.

### Thème clair / lisibilité en plein soleil — reporté (sombre renforcé retenu d'abord)

- **Constat terrain (2026-07-12)** : sur téléphone en plein soleil avec lunettes
  de soleil, l'interface sombre est difficile à lire. Le contraste WCAG n'est
  pas en cause (blanc 17:1, gris-clair 7:1, au-delà de AAA) : c'est la
  **luminosité absolue** d'un fond très foncé qui, en extérieur, se fait noyer
  par l'éblouissement. Aucun réglage sombre-sur-sombre ne corrige ça.
- **Le vrai correctif serait un thème clair** (fond très lumineux qui bat
  l'éblouissement), idéalement optionnel (`prefers-color-scheme` + bascule
  manuelle, cf. personnalisation COGA).
- **Décision (2026-07-12) : reporté.** Test comparatif au soleil : le thème
  clair **casse l'identité** (violets sombres + magenta/cyan) et ses accents
  clairs échouent dehors (le teal `#0C7A72` reste peu lisible plein soleil).
  On retient d'abord le **« sombre renforcé »** : texte à lire en crème/blanc
  **gras** (jamais `gray-light` atténué), coches et pastilles de statut
  **pleines**, hiérarchie par taille/graisse. Règles à inscrire dans
  `docs/principes-conception-ui.md`, verrouillées par `contrast.test.ts` + un
  garde-fou anti-opacité.
- **À rouvrir si** : besoin d'usage terrain récurrent en extérieur (pointer les
  présences un jour d'événement). Piste : thème clair réservé à `/admin`,
  sombre gardé pour le site public. Chantier propre (tokens par thème,
  variantes d'accents foncées : teal, magenta foncé, orange foncé déjà chiffrés).

## Plus tard (backlog, non priorisé)

- **oEmbed** : rendre un embed riche quand le lien collé est Notist / SpeakerDeck
  (au lieu d'un simple lien sortant).
- **Étude, scénarios différés** : I (rappels intelligents pré-remplis par le
  moissonneur), G (collage manuel de l'historique), H (transfert d'e-mail
  d'acceptation), Conference Hall (clé API par événement TSH/GDG).
- **Recherche par ville → région** (v2 du filtre localisation) : taper « Lyon »
  et faire remonter les speakeuses ayant coché « Auvergne-Rhône-Alpes » ou
  « Toute la France ». Demande une table ville→région (mapping des grandes
  villes). En v1, on filtre par les puces de régions directement.
- **Nits de revue laissés de côté** : CTA héro « Ajouter un talk » à rendre
  cohérent quand des suggestions attendent ; index `idx_talk_suggestions_profile_statut`
  possiblement redondant avec l'UNIQUE `(profile_id, event_id, external_id)`.
