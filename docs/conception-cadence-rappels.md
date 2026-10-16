# La speakeuse choisit la fréquence de ses rappels

> Suite directe de `docs/conception-relance-brouillons.md`, qui a livré la
> relance des fiches en sommeil **sans donner à la personne le moyen de la
> refuser**. Ce document règle cette dette.
> Principes d'écran : `docs/principes-conception-ui.md`.
> Principes de test : `docs/principes-tests.md`.
>
> Écrit le **2026-08-15**.

## Le problème

La plateforme envoie deux **rappels** sur une fiche :

| Rappel | Cible | Message |
|---|---|---|
| Rappel de mise à jour (cron quotidien) | Fiches **publiées** sans changement depuis `rappel_fiche_jours` | « pense à ajouter tes prochaines dates de talk » |
| Relance de brouillon (orga) | Fiches en **brouillon** en sommeil | « il te reste N étapes » |

Aucun des deux ne se refuse. Le seul réglage côté membre est
« Recevoir la lettre d'information » ; tout le reste est classé « e-mail de
service », et un e-mail de service ne se coupe pas. La seule sortie est la
suppression du compte.

Ce classement tient pour la connexion, une décision de modération ou un message
reçu : ces e-mails **annoncent un fait**, on les subit une fois et ils
s'arrêtent. Il tient beaucoup moins pour un rappel, qui **revient** et qui
pousse. Le pied de la relance disait d'ailleurs « on te réécrira le jour où ta
fiche bougera » : une promesse que le code ne tenait pas, puisqu'une fiche restée
en sommeil rentrait dans le lot suivant.

## La distinction qui porte tout

> **Un rappel, c'est nous qui poussons. Une notification, c'est nous qui
> informons de ce qui vient d'arriver.**

Personne ne devrait pouvoir couper la seconde ; tout le monde devrait pouvoir
régler la première. Le nouveau réglage porte donc **exactement** les deux
rappels du tableau ci-dessus, et rien d'autre. Le libellé le dit en toutes
lettres, avec la même phrase de réassurance que le réglage de la lettre
d'information — deux réglages, une promesse formulée pareil :

> **Rappels sur ma fiche**
> Un message de temps en temps pour compléter ta fiche et ajouter tes prochaines
> dates de talk. Les e-mails liés à ton compte (lien de connexion, décision sur
> ta fiche, message reçu) continuent d'arriver.

## Une cadence, pas un interrupteur

Un interrupteur pose une question binaire à quelqu'un qui, le plus souvent,
veut « moins souvent » et pas « jamais ». Quatre choix :

| Choix | Cadence |
|---|---|
| Tous les mois | 30 jours |
| Tous les 2 mois | 60 jours |
| Tous les 6 mois | 180 jours |
| Aucun | jamais |

Le défaut est **le délai réglé par l'équipe**, et il reste `NULL` en base tant
que la personne n'a rien choisi : la colonne distingue ainsi « elle a choisi
6 mois » de « elle laisse faire », et un changement de réglage côté orga suit
pour toutes celles qui n'ont pas tranché.

## Deux questions différentes, deux répondants

C'est le point à ne pas rater : la cadence personnelle **ne remplace pas** les
réglages de l'équipe, elle s'y ajoute.

| Question | Qui répond | Où |
|---|---|---|
| À partir de quand une fiche mérite un coup de pouce ? | L'équipe | `rappel_fiche_jours` (180), `relance_brouillon_jours` (30) |
| À quelle fréquence **j'accepte** d'être rappelée ? | La speakeuse | `rappel_cadence` |

Les deux conditions valent ensemble : une fiche entre dans le champ selon le
seuil de l'équipe, et le message part seulement si la cadence de la personne est
écoulée.

**Une personne hors cadence sort de la liste de relance**, et c'est voulu : la
page porte un seul CTA, « Relancer les N ». Y laisser quelqu'un qu'on ne peut
pas écrire ferait mentir le compte, et le lot la sauterait sans rien dire. La
liste répond à « qui puis-je relancer maintenant ? », pas à « qui dort ? ».

L'orga n'est pas aveugle pour autant : en ouvrant la fiche, elle voit le panneau
expliquer pourquoi le bouton manque — et, dans le cas d'un « Aucun », que c'est
un choix de la personne. C'est le bon endroit pour cette information : au moment
où on se demande pourquoi, pas au milieu d'une liste d'envoi.

Corollaire : tant que personne n'a choisi, **rien ne change**. Le défaut de
chaque flux est sa propre valeur d'aujourd'hui (30 jours pour la relance de
brouillon, 180 pour le rappel semestriel), donc le comportement existant est
reconduit à l'identique.

## « Aucun » ferme aussi le bouton de l'orga

Le geste manuel « Relancer par e-mail », depuis la fiche en vue orga, respecte
le choix : sur un « Aucun », le bouton laisse place à la raison écrite. Sinon le
réglage mentirait précisément dans le cas où il compte, et **mieux vaut pas de
réglage du tout qu'un réglage qu'on contourne**.

La règle vit dans la clause `WHERE` partagée (`conditionsRelance`), pas dans un
`if` d'écran : c'est la même parade que pour les autres exclusions.

## Le chemin de retour

Chacun des deux rappels porte désormais, dans son pied, un lien vers
`/mon-espace/reglages` libellé **« Choisir la fréquence de ces rappels »**.

- Le lien dit ce qu'il fait. « Se désabonner » ferait croire qu'on coupe tout,
  alors que la lettre d'information et les e-mails de compte sont ailleurs.
- Il mène derrière la connexion, et c'est normal : c'est son compte, et un
  réglage qui se changerait depuis un lien non authentifié serait un moyen de
  couper les rappels de quelqu'un d'autre.
- Le pied de la relance cesse de promettre ce qu'il ne tient pas : il dit la
  cadence réelle (« on te réécrira dans un mois si ta fiche dort encore »), et
  la propose à régler juste à côté.

## Le SQL, et pourquoi il a cette forme

La cadence est stockée en toutes lettres (`'mensuel' | 'bimestriel' |
'semestriel' | 'aucun'`, ou `NULL`) plutôt qu'en nombre de jours : un `0` pour
« aucun » se lit trop facilement comme « tout le temps », et la base dit ainsi
elle-même ce que le choix signifie.

Les quatre instants de seuil sont calculés **côté application** et passés en
paramètres, la requête ne faisant qu'un `CASE` pour choisir lequel comparer.
Même raison que dans la relance : `pg-mem`, le Postgres en mémoire de nos tests
d'intégration, refuse l'arithmétique `integer * interval` — une clause écrite
ainsi serait invérifiable, donc silencieuse le jour où elle tombe
(`docs/principes-tests.md` § 3). Une seule lecture d'horloge sert les quatre :
le délai de l'équipe joue deux rôles (seuil de sommeil d'un côté, cadence par
défaut de l'autre), et deux `Date.now()` pour une même notion se répondraient à
une milliseconde près.

Le fragment de conditions est une **fonction** (`sqlRappelPermis(depart)`), pas
une constante figée en `$1..$4` : c'est elle qui numérote ses placeholders. La
constante obligeait quatre requêtes réparties dans deux fichiers à se souvenir
que leurs propres paramètres commencent à `$5` — une convention qu'aucun
compilateur ni aucune base ne peut faire respecter, et qu'un paramètre ajouté ou
déplacé aurait cassée en silence, dans des requêtes qui décident qui reçoit un
e-mail.

## Ce qui est gardé, et par quoi

| Ce qu'on protège | Où |
|---|---|
| « Aucun » coupe le rappel automatique | Clause SQL + `profiles-cadence.integration.test.ts` |
| « Aucun » ferme le bouton orga | Même clause (`getFicheARelancer`) + test d'intégration |
| Une cadence longue espace vraiment les envois | Clause SQL + test d'intégration |
| Un choix absent reconduit le délai de l'équipe | Test d'intégration (les deux flux) |
| Le réglage ne touche PAS aux e-mails de compte | `cadence-rappels.test.ts` (la lib ne connaît que les rappels) |
| L'identité vient de la session | `actions-reglages.test.ts` |
| Le lien de réglage est dans les deux e-mails | `relance-email.test.ts`, `cron-notifications.test.ts` |
