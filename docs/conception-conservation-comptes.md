# Conservation des comptes : avertir, puis supprimer

> Limitation de la conservation (RGPD art. 5-1-e) appliquée aux comptes de la
> plateforme : un compte sans signe de vie depuis deux ans reçoit un
> avertissement, puis est supprimé s'il ne se réveille pas.
>
> Voisins : `docs/conception-cadence-rappels.md` (les rappels, qui se règlent —
> celui-ci ne se règle PAS), `docs/conception-relance-brouillons.md`.
> Principes de test : `docs/principes-tests.md`.
>
> Écrit le **2026-08-15**.

## Ce que la règle dit, et ce qu'elle ne dit pas

| | |
|---|---|
| **Imposé** (art. 5-1-e) | Ne pas conserver au-delà du nécessaire. |
| **Imposé** (art. 13-2-a) | **Annoncer la durée** dans l'information des personnes. |
| **Imposé** (art. 5-2) | Pouvoir démontrer qu'on applique ce qu'on annonce. |
| **Choisi** | La durée elle-même. Le RGPD n'écrit aucun « 2 ans ». Le repère CNIL le plus cité (3 ans après le dernier contact) vise les prospects ; pour une association, la base est la durée de la relation. **Deux ans est donc plus strict que l'usage courant**, et défendable dès lors que c'est écrit et appliqué. |
| **Non imposé** | Prévenir avant de supprimer. Aucun article ne l'exige. On le fait quand même : la suppression est irréversible, et le préavis laisse le temps d'exercer la portabilité (art. 20). |

### La durée est publiée, donc elle a UNE source

Les mentions légales disaient « les données d'un compte sont conservées tant que
la fiche est active » : un critère, pas une durée, et il devient faux le jour où
on supprime. La page lit désormais **les mêmes constantes que le cron**
(`DUREE_INACTIVITE_JOURS`, `PREAVIS_SUPPRESSION_JOURS`). Le texte publié ne peut
donc plus contredire le code — et c'est aussi pour ça que ces durées **ne sont
pas des réglages d'écran** : une orga qui changerait le délai dans `/admin`
ferait mentir la notice sans le savoir. Les changer est un geste délibéré, avec
la doc et la notice dans le même commit.

## Le piège central : « prévenue mais jamais supprimée »

Un compte averti qu'on ne supprime jamais est **pire que pas de politique du
tout** : il donne l'apparence de la conformité sans la substance. La suppression
part donc toute seule une fois le préavis écoulé, sans qu'une orga ait à cliquer.

Trois corollaires, chacun gardé par un test :

1. **L'avertissement ne remet pas le compteur à zéro.** Seule une action de la
   personne compte ; sinon l'horloge ne tourne jamais et la règle est décorative.
2. **Un signe de vie efface l'avertissement** (`suppression_annoncee_le → NULL`).
   Sans ça, une inactivité future supprimerait sans nouvel avertissement — donc
   sans que la personne ait jamais eu sa chance.
3. **Un avertissement PÉRIMÉ ne vaut pas préavis.** On peut sortir du champ
   autrement qu'en se réveillant — une adhésion saisie par une orga, un rôle
   accordé — puis y revenir. L'annonce d'il y a deux ans traînait alors sur la
   ligne, et la suppression tombait au premier passage, sans aucun préavis.
   Au-delà de `VALIDITE_AVERTISSEMENT_JOURS` (90), l'annonce est périmée : le
   compte **repart se faire avertir** au lieu d'être supprimé. La borne referme
   cette porte sans exiger qu'on pense à nettoyer la colonne à chaque changement
   d'état ailleurs dans le produit.
4. **On prouve le processus, pas les personnes.** L'art. 5-2 demande de pouvoir
   démontrer qu'on applique la règle. Garder la liste nominative des comptes
   supprimés annulerait la suppression : on garde des **compteurs**, et
   l'association décrit le processus dans son registre de traitements.

## Mesurer le signe de vie

**Rien en base ne dit aujourd'hui quand quelqu'un s'est connecté.** Les sessions
sont en JWT (`auth.config.ts`), la table `sessions` de l'adapter n'est jamais
alimentée. La règle est donc inapplicable sans une nouvelle colonne.

Une colonne, donc **une donnée personnelle de plus** — et l'art. 13-1-c veut
qu'on la dise. Les mentions légales l'annoncent avec sa précision (« à la semaine
près ») et sa raison (elle rend applicable la durée de conservation, et rien
d'autre). Publier la durée sans annoncer la mesure qui la déclenche reviendrait à
appliquer une règle sur une donnée tue.

`users.last_seen_at` est horodatée **dans le callback `jwt`**, pas dans un
évènement de connexion : une session JWT vit longtemps, quelqu'un peut utiliser
le site pendant des mois sans se reconnecter, et on l'aurait déclaré inactif
alors qu'il vient de lire l'annuaire. Le callback tourne à chaque rafraîchi de
jeton ; on écrit donc **au plus une fois par semaine et par compte**, le jeton
portant lui-même la date du dernier passage (aucune lecture base pour décider).

Le jeton ne suffit pourtant pas seul : sur le chemin des composants serveur,
`auth()` le relit sans jamais reposer de cookie, donc la date qu'on vient d'y
inscrire est perdue à la requête suivante. Une **mémoire de processus**
(`signesDeVieEcrits`, dans `src/auth.ts`) double donc le jeton — sinon, passé une
semaine de session, chaque page authentifiée refaisait un aller-retour base pour
un `UPDATE` qui ne touche aucune ligne. Cache mou : un processus froid réécrit
(sans effet), jamais l'inverse ; la vraie borne reste la clause `WHERE`.

Le signe de vie est le plus récent de deux choses :

- `users.last_seen_at` — elle est passée ;
- `speaker_profiles.updated_at` — sa fiche a bougé (talks compris depuis la PR
  #315 : une écriture de talk réveille la fiche).

### Une mesure ABSENTE ne vaut pas une inactivité prouvée

C'est la condition la plus importante du fichier, et elle a failli manquer. Un
compte créé par une voie qui ne passe pas par la connexion (invitation Tremplin,
rattachement par une orga) naissait sans `last_seen_at`. Lu comme « dormant
depuis toujours », il recevait l'avertissement au premier passage du cron et
disparaissait trente et un jours plus tard.

Deux parades, et on garde les deux : la colonne a un **`DEFAULT now()`** (le cas
ne se présente plus), et la clause exige **`last_seen_at IS NOT NULL`** (si une
ligne arrivait quand même sans mesure, elle est épargnée). Rendre la faute
impossible, puis garder quand même le cas.

### On ne date pas une inactivité qu'on n'a jamais mesurée

À la migration, `last_seen_at` vaut **`now()` pour tout le monde**. La première
suppression possible est donc dans deux ans. C'est volontaire : prétendre « deux
ans d'inactivité » sur une mesure qui n'existait pas serait une décision prise
sur une preuve absente, et c'est précisément ce qu'on ne saurait pas défendre si
on nous le demandait. Le coût est un délai ; le bénéfice est que chaque
suppression repose sur des faits observés.

## Qui n'entre pas dans le champ

Trois exclusions, chacune avec sa raison — et toutes portées par la clause `WHERE`.

- **Les adhérentes à jour** (`user_memberships`, `expires_at` dans le futur).
  La base de conservation est **l'adhésion**, pas l'usage de la plateforme : une
  adhérente qui paie sans jamais se connecter n'est pas une donnée en trop.
- **Les orgas et les coachs.** Comptes opérationnels, peu nombreux, et leur
  suppression casserait des attributions (`validated_by` d'une fiche validée,
  missions de coaching). Traités à la main.
- **Les comptes injoignables** (adresse absente, ou suffixe `.invalid` de la
  cohorte migrée sans adresse connue). On ne supprime **jamais** quelqu'un qu'on
  n'a pas pu avertir : le préavis n'est pas une formalité, c'est la contrepartie
  de l'automatisme. Le sort de ces fiches est un autre sujet, avec une autre
  réponse — elles restent visibles de l'orga.

## L'avertissement ignore le réglage de cadence

Quelqu'un qui a choisi « Aucun rappel » (PR #316) **reçoit quand même** cet
e-mail. C'est exactement la frontière posée là-bas : un **rappel** pousse et
revient, il se règle ; une **notification** annonce un fait, et celle-ci annonce
la disparition prochaine de son compte. Couper cette annonce-là au motif qu'on a
refusé les rappels supprimerait des comptes en silence — le contraire du but.

C'est écrit dans le code à l'endroit de l'envoi, pour que personne ne
« harmonise » un jour en y ajoutant le garde-fou de cadence.

## Deux étapes, un seul cron

Le cron quotidien de 17 h (`/api/cron/notifications`) accueille les deux, dans
cet ordre — mais la règle elle-même vit dans `src/lib/passe-conservation.ts`, la
route ne faisant que l'appeler. C'est la seule section du cron qui compose
plusieurs lectures dans un ordre qui compte et qui finit sur un acte
irréversible : elle mérite de se rejouer autrement qu'à travers une requête HTTP
et six modules simulés. Même découpe que la synchro Brevo voisine.

1. **Avertir** — inactifs depuis `DUREE_INACTIVITE_JOURS` (730) et jamais
   avertis : e-mail nominatif disant la date de suppression, ce qui disparaît,
   ce qui survit, et qu'**une simple connexion suffit** à tout annuler.
2. **Supprimer** — avertis il y a plus de `PREAVIS_SUPPRESSION_JOURS` (30) et
   toujours sans signe de vie depuis. La condition d'inactivité est **revérifiée
   à la seconde étape** : entre l'avertissement et le couperet, la personne a pu
   revenir.

La suppression appelle `deleteAccount()`, qui existe déjà et tranche finement ce
qui survit (palmarès public figé, inscriptions privées anonymisées, consentements
de phase révoqués). Une seconde voie de suppression divergerait de la première au
premier changement.

Depuis le 2026-08-16, la suppression complète vit dans `supprimerCompte()`
(`src/lib/suppression-compte.ts`) et va **jusqu'à Brevo** : sans quoi le
compte disparaissait d'ici pendant que son contact restait chez le sous-traitant,
avec ses attributs, à recevoir la lettre d'information — la donnée que cette
passe existe pour effacer lui survivait (règle : `docs/conception-synchro-contacts.md`).
La moitié SQL garde le nom `effacerCompteEnBase`, qui dit ce qu'elle NE fait
pas : `src/lib/profiles.ts` est un module d'accès base, importé par une
soixantaine d'autres — y poser l'appel réseau faisait entrer le SDK du
sous-traitant dans le graphe de l'accueil, du sitemap et de l'annuaire, et
mettait les tests d'intégration base à une variable d'environnement d'appeler
vraiment Brevo.

Conséquence pour cette passe : une suppression peut désormais échouer sur une
panne du sous-traitant. Elle **renonce** alors (l'adresse est le seul moyen
d'aller chercher le contact), le compte-rendu COMPTE l'échec
(`suppressionsEchouees`, à côté des `aSupprimer` dus), et le lendemain retente.
Sans ce compteur, un jour où tout échoue se lirait exactement comme un jour sans
personne à supprimer — et le compte aurait reçu un second avertissement 90 jours
plus tard pour une suppression jamais faite.

**Compté n'est pas signalé**, et c'est la limite du dispositif : ce compte-rendu
part dans le corps JSON rendu à l'invocateur du cron. Aucun écran orga ne
l'affiche, aucune alerte ne s'en nourrit — il faut aller le lire. C'est l'étage
« alerte sur les erreurs réelles » que `docs/principes-tests.md` décrit comme
manquant, et que la dette P0-3 porte.

**Chaque passage est borné** (200 avertissements, 200 suppressions) et vit dans
son propre `try`. Deux raisons : la migration horodate toute la base le même
jour, donc dans deux ans une cohorte entière devient dormante d'un coup — sans
plafond, un seul passage tenterait des milliers d'envois et serait coupé en
route. Et une base indisponible ici ne doit pas emporter la synchro Brevo qui
suit. Le compte-rendu dit ce qui **reste** : une troncature silencieuse se lirait
« tout est fait ».

Le marquage suit **chaque envoi**, pas le lot : un passage coupé perdrait sinon
la trace de ce qui est déjà parti, et le lendemain réécrirait aux mêmes personnes.

Deux limites **assumées**, et elles ne se paieront qu'au jour du drainage : la
requête ramène toute la cohorte pour n'en traiter que le lot (c'est le prix d'un
compte-rendu exact plutôt que d'un « il en reste »), et les envois se font à la
file. Sur une base de la taille de l'association, un passage quotidien qui lit
quelques milliers de lignes ne coûte rien ; le jour où la cohorte devient réelle,
c'est ici qu'il faudra un `LIMIT` et une concurrence bornée, pas avant.

## Ce qui est gardé, et par quoi

| Ce qu'on protège | Où |
|---|---|
| Aucune suppression sans avertissement envoyé | Clause SQL + `comptes-inactifs.integration.test.ts` |
| Aucune suppression avant la fin du préavis | Clause SQL + test d'intégration |
| Un retour annule tout (avertissement effacé) | `toucherSigneDeVie` + test d'intégration |
| L'avertissement ne prolonge PAS le sursis | Test d'intégration (le compteur suit le signe de vie, pas l'envoi) |
| Adhérentes, orgas, coachs et injoignables hors champ | Clause SQL + tests d'intégration |
| L'avertissement ignore le réglage de cadence | `cron-notifications.test.ts` |
| La durée publiée est celle du code | `mentions-legales.test.tsx` |
| La mesure qui déclenche la règle est ANNONCÉE (art. 13-1-c) | `mentions-legales-conservation.test.tsx` |
| La notice cesse de dire les rappels de fiche non réglables | Même fichier |
| L'envoi échoué ne fait pas courir le préavis | Marquage par envoi + test du cron |
| Une mesure absente n'est jamais une inactivité | Clause SQL + `DEFAULT now()` + test d'intégration |
| Une annonce périmée renvoie à l'avertissement | Clause SQL + test d'intégration |
| Un passage borné, et ce qui reste est dit | Plafond + compteurs + test du cron |
| Une panne de conservation laisse passer le reste | `try` dédié + test du cron |
| La suppression efface aussi le contact chez Brevo | `suppression-compte.test.ts` (l'ordre des deux gestes) + `brevo-contacts.test.ts` (la règle) |
| L'adresse ne fuit pas dans les journaux, même en panne | `brevo-contacts.test.ts` |
| Une suppression échouée se COMPTE (jamais muette) | Compteurs + test du cron |
| La notice ne se contredit pas (durée totale) | `mentions-legales-conservation.test.tsx` |
