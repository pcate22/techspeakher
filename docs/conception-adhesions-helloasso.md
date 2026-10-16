# Adhésions HelloAsso dans la plateforme, et annuaire réservé aux membres

> **État : validé par Cateline le 2026-10-15, LIVRÉ le même jour** (PR des
> adhésions, interrupteur éteint). Ce doc décrit ce qui est construit ; les
> écarts avec la première version validée sont dits sur place (« recalé à
> l'implémentation »). Mise en service : `docs/exploitation.md`, « Adhésions
> HelloAsso ».
>
> Met en œuvre l'**option B** de `docs/conception-synchro-contacts.md` :
> HelloAsso reste la source de vérité, Brevo garde son propre import, et la
> plateforme ne retient que les adhésions qui **correspondent à un compte**.
> Décisions déjà prises (2026-10-15) : une adhésion vaut **12 mois de date à
> date à partir du paiement**, la gratuite sur déclaration compte pareil ;
> rapprochement **par l'adresse demandée pour chaque membre**, contre toutes
> les adresses du compte, jamais celle de la personne qui paie (une personne
> peut inscrire plusieurs membres) ; une
> adhésion sans compte n'est **jamais stockée** ; préavis daté puis mise en
> pause des fiches ; les orga ne sont pas concernées ; la règle passe derrière
> l'interrupteur `FLAG_ADHESIONS` (PR #212), **éteint par défaut**.

## 1. Deux constats en lisant le code

1. **La table existe déjà** : `user_memberships` (une ligne par compte,
   `"userId"` UNIQUE, `source` `'manuel'`/`'helloasso'`, `started_at`,
   `expires_at`, `status` fermé à `active`/`expired` par la migration 073).
   Elle est tenue à la main dans Neon, et deux codes la lisent déjà : la
   passe de conservation (une adhésion à jour **protège** un compte de la
   suppression) et `compteOrphelin`. On l'**étend** plutôt que d'en créer une
   seconde : deux tables « adhésion » finiraient par se contredire.
2. **Aucune table ne porte plusieurs e-mails par compte.** Un compte a une
   seule adresse, `users.email`. Quand on relie Google ou LinkedIn depuis
   « Mes connexions » avec une autre adresse, Auth.js crée une ligne
   `accounts`… **sans e-mail** : l'adresse du fournisseur est perdue. Pour
   rapprocher contre « toutes les adresses rattachées », il faut d'abord les
   garder. D'où la colonne `accounts.email`, écrite à chaque
   connexion OAuth (au même endroit que le rafraîchissement du jeton,
   `src/auth.ts`, sans bloquer la connexion). Les adresses fournies par
   Google et LinkedIn sont **vérifiées** : personne ne peut réclamer
   l'adhésion d'une autre en tapant son adresse. Les comptes déjà reliés
   gagnent leur adresse à leur prochaine connexion.

## 2. Le flux

```
HelloAsso ──notification (non signée)──► /api/helloasso/notification?token=…
                                             │  on ne lit QUE l'identifiant de commande
                                             ▼
                              API HelloAsso : GET /v5/orders/{id}  (jeton OAuth2 client)
                                             │  une adhésion du formulaire « adhesion » ?
                                             ▼  non : rien ne se passe
                              synchro complète (la même que le rattrapage)

Cron quotidien (17 h UTC, celui des notifications) : synchro de RATTRAPAGE
  GET /v5/organizations/tech-speak-her/forms/Membership/adhesion/items (tout l'historique)
  → rapprochement par l'adresse du membre ──► compte trouvé : écrit user_memberships
                                           └─► aucun compte : rien n'est écrit (compté au rapport)
```

- **Jamais la notification crue.** HelloAsso ne signe pas ses notifications :
  n'importe qui peut poster sur l'URL. On n'en garde que l'identifiant de
  commande, et on **relit la commande par l'API**. Une fausse notification ne
  peut donc que déclencher la relecture d'une vraie commande. En plus, l'URL
  porte une clé (`HELLOASSO_WEBHOOK_SECRET`, paramètre `?token=`, même
  convention que le webhook Brevo) : sans elle, réponse 401 et rien n'est lu.
  La route est limitée en débit (`src/lib/rate-limit.ts`).
- **Seul le formulaire d'adhésion compte** (type `Membership`, slug
  `adhesion`, dérivés de `HELLOASSO_ADHESION_URL`). Le soutien des membres
  bienfaitrices (`/partenaires`) n'est pas une adhésion : ignoré.
- **Ce qui vaut adhésion** : un article de type `Membership` dans l'état
  `Processed` (payée) ou `Registered` (gratuite). Liste blanche : `Refunded`,
  `Canceled`, un état inconnu ne valent rien, ni un don glissé dans la
  commande. **À vérifier sur la première vraie commande** (celle de Cateline,
  2026-10-15) : l'état exact d'une adhésion gratuite.
- **Le rattrapage** relit tout l'historique du formulaire chaque jour
  (ouvert en octobre 2026, quelques centaines de lignes) : une notification perdue, une panne de l'API, un
  remboursement se rattrapent au plus tard le lendemain. C'est lui, pas la
  notification, qui garantit la justesse ; la notification n'apporte que la
  vitesse.
- **Rapprochement** (recalé à l'implémentation, décision de Cateline du
  2026-10-15) : **l'adresse demandée pour chaque membre**, lue dans les champs
  de l'article, comparée sans casse à `users.email` et `accounts.email`.
  **Jamais celle du payeur** : une même personne peut inscrire plusieurs
  membres, la rapprocher lui donnerait leurs adhésions. Un article sans
  adresse de membre ne se rapproche de personne. **À vérifier sur la première
  vraie commande** : que l'adresse du membre arrive bien dans
  `customFields` (sinon, `sansCompte` du rapport le dira). Le rattrapage ne rapproche que
  vers des comptes **existants** : quand une adhérente crée son compte plus
  tard, la synchro du lendemain la retrouve.
- **Calcul de l'échéance** : `date de la commande + 12 mois`, **à partir de
  l'échéance en cours** si l'adhésion court encore (tranché le 2026-10-15) :
  renouveler tôt ne fait perdre aucun jour, ce qui sert la relance à J-30.
  Les adhésions d'une personne s'enchaînent donc dans l'ordre des paiements.
  Une ligne saisie à la main (`source = 'manuel'`) n'est remplacée que par une
  adhésion qui finit plus tard.
- **Seuls les événements `Order` déclenchent la synchro** (revue du
  2026-10-15) : HelloAsso envoie aussi un `Payment` pour une commande payée,
  et traiter les deux lançait deux synchros complètes. Un remboursement se
  rattrape au cron du soir.
- **Une liste vide est refusée** quand des adhésions HelloAsso sont actives
  (slug changé, bac à sable, anomalie de l'API) : tout expirer couperait la
  protection de la passe de conservation, qui suit dans le même cron. La
  synchro lève, la règle de l'annuaire est suspendue, rien n'est écrit.
- **`helloasso_item_id` est une trace, sans unicité** : un article peut
  changer de compte (une adresse qui passe d'un compte à un autre) ; l'index
  unique de la première version bloquait alors toute la synchro.
- **Un seul calcul** (recalé à l'implémentation) : une notification d'adhésion
  déclenche la **même synchro complète** que le rattrapage, au lieu
  d'additionner une adhésion à la ligne. Deux calculs auraient pu diverger
  (une notification en retard comptée deux fois) ; à quelques centaines
  d'adhésions, relire tout l'historique coûte quelques appels. Une adhésion
  HelloAsso qui disparaît de la liste (remboursée) passe `expired` — seulement
  sur une lecture **complète** de HelloAsso.
- **Sans identifiants HelloAsso** (preview, local), la synchro est inerte et
  le dit dans le rapport du cron, comme la synchro Brevo.

## 3. Le schéma (migration `074_adhesions_helloasso.sql`)

Comme toujours : `schema.sql` **et** `sync-to-latest.sql` **et** la migration.

| Où | Colonne | Pourquoi |
| --- | --- | --- |
| `user_memberships` | `helloasso_item_id BIGINT` | trace de l'article HelloAsso qui a posé l'échéance (pour le retrouver dans HelloAsso), sans unicité |
| `user_memberships` | `relance_envoyee_le TIMESTAMPTZ` | la relance avant échéance part une fois par échéance (remise à NULL quand l'échéance change) |
| `accounts` | `email TEXT` | l'adresse du fournisseur OAuth, pour le rapprochement (§ 1) |
| `speaker_profiles` | `annuaire_retrait_le TIMESTAMPTZ` | la date annoncée dans le préavis ; NULL = aucun préavis en cours |
| `speaker_profiles.status` | nouvelle valeur `en_pause` | la fiche est hors annuaire faute d'adhésion (≠ `masque`, qui est une décision d'orga) |

**Rien d'autre n'est stocké** : ni montant, ni nom HelloAsso, ni réponses au
formulaire. Une adhésion sans compte ne laisse **aucune ligne**.

Pourquoi un statut `en_pause` plutôt qu'un filtre à la lecture : `status =
'publie'` est lu par une douzaine de requêtes publiques (annuaire, fiche,
agenda, fil, sitemap, conférences…). Changer le **statut** à un seul endroit
les garde toutes justes d'un coup ; ajouter une condition à chacune en
oublierait une. Les tableaux exhaustifs de `profile-status.ts` forcent à
ranger le nouveau statut partout où la question se pose (la galerie du
Tremplin, par exemple : le consentement d'édition y reste valable, la fiche
y reste jointe).

## 4. La règle de l'annuaire (derrière `FLAG_ADHESIONS`)

Une personne est **à jour** si `status = 'active'` et `expires_at > maintenant`.
Les orga ne sont jamais concernées.

Chaque jour, quand l'interrupteur est **allumé** :

1. **Préavis.** Toute fiche `publie` dont la titulaire ne sera plus à jour
   dans 30 jours (aucune adhésion, ou échéance dans moins de 30 jours) et
   sans préavis en cours reçoit un e-mail daté ; on pose
   `annuaire_retrait_le = aujourd'hui + 30 jours`. Au premier allumage, c'est
   le préavis de toutes les fiches sans adhésion ; ensuite, il tombe tout
   seul 30 jours avant chaque échéance.
   La date n'est posée **qu'après l'envoi réussi** de l'e-mail : un envoi raté
   laisse la fiche sans date, donc hors d'atteinte de la pause.
2. **Mise en pause.** À la date annoncée, si la personne n'est toujours pas à
   jour : `publie` → `en_pause` (`mettreFichesEnPause`, `src/lib/profiles.ts`).
   Jamais sans préavis daté : la condition vit dans le SQL. C'est une sortie
   de « publié » comme les autres : les bravos de la fiche partent (lot N4).
3. **Retour.** Dès qu'une adhésion à jour existe (HelloAsso ou saisie à la
   main) : `en_pause` → `publie`, préavis effacé, annuaire invalidé. Rien
   n'a été supprimé, la fiche revient telle quelle — y compris sans nom de
   compte : une pause est un aller-retour, pas une publication (exiger un nom
   coinçait la cohorte migrée en pause à vie, seconde revue du 2026-10-15). Un préavis en cours
   ne s'efface que si l'adhésion **couvre la date annoncée** : effacé pour
   une adhésion qui finit avant, il repartait chaque jour (revue du
   2026-10-15).

**Garde-fou ajouté à l'implémentation** : la règle ne tourne que si la
synchro du **même passage** a réussi. Une synchro en panne ou non configurée
ferait paraître toutes les membres sans adhésion ; le rapport dit alors
`regle: "suspendue"`, et rien ne part.

**Une décision d'orga** (publier, masquer, refuser) efface un préavis en
cours : une fiche republiée sans adhésion reçoit un nouveau préavis de trente
jours, au lieu de repartir en pause le lendemain sans un mot.

Quand l'interrupteur est **éteint** : aucun e-mail, aucune pause, et les fiches
`en_pause` repassent `publie` au cron suivant (préavis effacés). Éteindre est
donc un vrai retour arrière ; rallumer renvoie des préavis avec une nouvelle
date.

La synchro elle-même (et le statut affiché dans Mon espace et chez les orga)
tourne **dès que les identifiants HelloAsso sont posés**, interrupteur éteint :
on peut vérifier que les adhésions arrivent bien avant d'en faire dépendre
l'annuaire.

## 5. Les écrans

- **« Mon profil »** (recalé à l'implémentation : l'accueil de l'espace est un
  fil « zéro carte personnelle », décision du lot N2 ; le personnel vit sur
  « Mon profil »). Une rangée **« Mon adhésion »** dans le groupe « Mon
  compte », porte vers `/adherer`, jamais un second CTA. Son sous-titre dit
  l'état (`src/lib/adhesion-libelle.ts`) :
  - « Active jusqu'au 15 octobre 2027 » ;
  - « À renouveler avant le … » (échéance dans 30 jours) ;
  - « Échue le … · à renouveler sur HelloAsso » ;
  - « Aucune adhésion reliée à ton compte · adhérer sur HelloAsso » ;
  - fiche en pause : « Ta fiche revient dans l'annuaire dès ton adhésion ».
  Une fiche en pause fait aussi de « Adhérer » **la prochaine étape** de Mon
  profil (le CTA de la page), avant tout autre geste.
  La rangée n'apparaît que si la synchro est configurée : sans elle, elle
  dirait « aucune adhésion » à toutes. La page « Ma fiche publique » dit aussi
  la pause (« Elle est en pause dans l'annuaire, et revient dès ton
  adhésion »). La consigne d'adresse (« indique, pour toi comme adhérente,
  l'adresse de ton compte ») est dans les e-mails, et sur `/adherer` depuis le
  2026-10-15 (`landingAdhesion.adresseCompte`, sous l'appel final).
- **Orga** : une page `/admin/adhesions`, de consultation avec un seul geste
  secondaire (relire HelloAsso, ci-dessous), trois groupes
  (« À renouveler dans les 30 jours », « À jour », « Échues »), chaque ligne
  disant l'échéance, l'état de la fiche et un préavis en cours. Elle dit aussi
  si la synchro est configurée et si l'interrupteur est allumé. Elle ne montre
  que les comptes rapprochés : les adhésions sans compte restent dans
  HelloAsso, qui en est le registre.
- **Page « Mon adhésion »** (`/mon-espace/adhesion`, demande de Cateline du
  2026-10-15) : un rôle, consulter son adhésion. L'état en pastille texte
  (Active, À renouveler, Échue, Arrêtée), le début et l'échéance (dates lues à
  l'heure de Paris, `dateLongueParis`), le préavis en cours ou la pause de la
  fiche. Chaque phrase n'est dite que là où elle est vraie (revue UX du
  2026-10-15) : le cumul des douze mois pour une adhésion HelloAsso en cours
  seulement, le reçu « dans l'e-mail de HelloAsso » seulement pour une adhésion
  HelloAsso (le montant n'est pas copié : minimisation), « enregistrée par
  l'équipe » pour une adhésion `manuel`. Sans adhésion : le délai, la consigne
  d'adresse, et « Écris-nous » pour qui a adhéré avec une autre adresse. UN
  CTA, seulement quand il sert : « Renouveler mon adhésion » (échéance proche,
  échue), « Adhérer de nouveau » (arrêtée), « Adhérer » (aucune). La rangée de
  Mon profil y mène quand une adhésion est reliée, vers `/adherer` sinon ; son
  sous-titre reste court (deux lignes de téléphone, gardé par un test).
  404 sans synchro configurée (elle dirait « aucune » à toutes).
- **Le délai d'apparition**, mot pour mot validé par Cateline :
  « dans quelques minutes, et au plus tard le lendemain » (`DELAI_ADHESION`,
  `src/lib/adhesion.ts`) — la notification relie l'adhésion et remet la fiche
  en ligne aussitôt, le cron du soir rattrape. Dit sur la rangée et la page
  quand rien n'est relié, au retour d'une fiche en pause (prochaine étape,
  page fiche, préavis) et sur `/adherer` (`landingAdhesion.delai`).
- **Orga, bilan de la dernière relecture** (ajouté le 2026-10-15, quand les
  logs d'une heure de Vercel ont manqué pour diagnostiquer la première
  adhésion) : chaque synchro (cron, notification, invitation, bouton)
  enregistre son bilan (compteurs seulement, ou l'erreur) dans
  `plateforme_reglages` (`src/lib/bilan-adhesions.ts`, aucune migration). La
  page `/admin/adhesions` l'affiche (« Sans compte » expliqué) avec un bouton
  secondaire « Relire HelloAsso maintenant », sans e-mail. Les compteurs
  sont des ARTICLES : reliés + sans compte = lus (une adhérente qui renouvelle
  pèse deux articles, un compte). Le bouton se freine : une relecture au
  bouton de moins d'une minute n'est pas refaite (`FREIN_MS`,
  `src/app/admin/adhesions/actions.ts`).
- **Orga, `/admin/adhesions/inviter`** (ajouté le 2026-10-15, à l'ouverture
  des adhésions) : la liste des fiches en ligne dont la titulaire est encore
  sans adhésion et jamais invitée, et UN bouton confirmé « Inviter N
  speakeuses ». Au clic, l'action relit HelloAsso d'abord (sans synchro
  réussie, aucun envoi : les membres à jour recevraient l'invitation), puis
  écrit par lots de 40, en posant `speaker_profiles.adhesion_invitee_le`
  (migration 075) après chaque envoi réussi : une seule invitation par
  personne. Mêmes exclusions que le préavis (orga, adresse injoignable).
- **Badge de statut** `en_pause` : libellé « En pause », dans l'admin des
  speakeuses comme dans l'espace.

## 6. Les e-mails (service, pas lettre d'information)

| E-mail | Quand | Contenu |
| --- | --- | --- |
| **Préavis** | fiche publiée, titulaire bientôt sans adhésion | la date de sortie de l'annuaire (et l'échéance s'il y en a une), le tarif et la gratuité sur déclaration, l'adresse à indiquer pour le membre, et que la fiche reste intacte et revient dès l'adhésion. Lien `/adherer` |
| **Relance avant échéance** | 30 jours avant `expires_at`, adhérente sans fiche publiée (orga comprises) | l'échéance, « renouveler tôt est sans perte », l'adresse à indiquer. Lien `/adherer` |
| **Invitation à adhérer** (2026-10-15) | une fois, au clic d'une orga sur `/admin/adhesions/inviter` ; fiche en ligne, titulaire encore sans adhésion | l'ouverture des adhésions, l'annuaire qui va devenir réservé aux membres, le tarif et la gratuité, l'adresse à indiquer, et la promesse d'un message daté au moins trente jours avant tout changement. Lien `/adherer`. **Hors interrupteur** : c'est l'orga qui choisit le moment |

Textes : `src/lib/adhesion-email.ts`. Depuis la revue UX du 2026-10-15 : la
consigne d'adresse vient AVANT le bouton (on clique avant de lire la suite),
le cumul des douze mois n'est promis qu'à une adhésion HelloAsso (`cumul`),
les dates se lisent à l'heure de Paris, et le tarif reprend les mots des
statuts (« gratuite, sur déclaration sur l'honneur »). Les règles de rédaction (salutation
« Salut », forme positive, insécables, aucun cadratin) sont tenues pour TOUS
les e-mails de la plateforme par `src/__tests__/emails-redaction.test.ts`
(inventaire et contenus : page Notion « TSH — les e-mails envoyés par la
plateforme »).

Une titulaire de fiche dont l'adhésion arrive à échéance reçoit **un seul**
e-mail (le préavis, qui dit aussi l'échéance), pas les deux. Préavis et
relance passent derrière l'interrupteur ; l'invitation, non. Ils ignorent le désabonnement de la lettre (ce sont
des e-mails de service, comme la modération).

## 7. RGPD

- **Base légale** : l'exécution du contrat d'adhésion (statuts, règlement
  intérieur) et l'intérêt légitime de l'association à réserver l'annuaire à
  ses membres.
- **Minimisation** : seules la date de début, l'échéance et l'identifiant de
  l'article HelloAsso sont copiés, et seulement pour un compte existant.
- **Conservation** : la ligne vit avec le compte et part avec lui
  (`ON DELETE CASCADE`). Une adhésion échue protège le compte de la passe de
  conservation jusqu'à son échéance, comme aujourd'hui.
- **Mentions légales** (`src/app/mentions-legales/page.tsx`, complétées dans
  la même PR) : HelloAsso comme source des adhésions (et responsable de son
  propre traitement du paiement), les données copiées, la finalité (annuaire
  réservé aux membres, rappel d'échéance), la durée.

## 8. Mise en service

Le pas-à-pas vit à un seul endroit : `docs/exploitation.md`, « Adhésions
HelloAsso » (identifiants dans HelloAsso, variables dans Vercel, URL de
notification, vérification sur une vraie adhésion, puis l'interrupteur).
Aucune valeur secrète ne passe par le dépôt ni par Claude.

## 9. Points tranchés par Cateline (2026-10-15)

1. **Adresses multiples** : colonne `accounts.email` (§ 1).
2. **Renouvellement anticipé** : les 12 mois partent de l'échéance en cours
   si l'adhésion court encore.
3. **Délais** : préavis de 30 jours, relance à J-30.
4. **Statut `en_pause`** plutôt qu'un filtre à la lecture (§ 3).
