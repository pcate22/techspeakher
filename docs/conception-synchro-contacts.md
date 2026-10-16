# Qui écrit quoi : plateforme, Brevo, HelloAsso

> Trois systèmes vont porter des informations sur les mêmes personnes — et sur
> des personnes différentes. Ce document fixe **une source de vérité par
> donnée**, parce que la panne typique d'une architecture à trois n'est pas la
> panne : c'est deux systèmes qui écrivent la même chose et se contredisent sans
> que personne le voie.
>
> Dernière mise à jour : **2026-10-15** (option B tranchée et livrée :
> `docs/conception-adhesions-helloasso.md`).

## Trois populations, qui ne se recouvrent pas

C'est le point à ne pas confondre : **la plateforme n'est pas l'association.**

| Population | A un compte ici ? | Vit où |
| --- | --- | --- |
| Speakeuses, coachs, orgas | oui | plateforme → Brevo (liste « Comptes plateforme ») |
| **Adhérentes et adhérents sans compte** | **non** | HelloAsso → Brevo (liste « Adhésions ») |
| Écosystème (confs, partenaires, sponsors) | non | Brevo seul, saisi à la main |

La plateforme est **réservée aux femmes et aux personnes non binaires** (la
fiche demande cette attestation). L'association, elle, accueille des adhésions
de personnes qui n'y auront jamais de compte — un soutien, un partenaire, un
allié. Une liste qui s'appellerait « Membres » et ne contiendrait que nos
comptes ferait donc croire qu'elle EST l'association, et produirait des
campagnes qui oublient une partie de ses membres. D'où le nom **« Comptes
plateforme »**, et la variable `BREVO_LIST_COMPTES`.

**Brevo est l'UNION** des trois populations. C'est sa raison d'être ici : le
seul endroit où « toutes les personnes à qui on écrit » existe.

## Le partage des écritures

| Donnée | Source de vérité | Va où |
| --- | --- | --- |
| Compte, fiche speakeuse, talks, Tremplin, coach, orga | **Plateforme** | → Brevo (attributs) |
| Désabonnement de la lettre | **Brevo** (le clic dans l'e-mail) | → plateforme (webhook) |
| Adhésion à l'association | **HelloAsso** | → Brevo (toutes), → plateforme (celles qui ont un compte) |
| Contacts écosystème | **Brevo**, saisis à la main | nulle part |

Règle qui découle du tableau : **un attribut Brevo n'a qu'un seul écrivain**.

- La plateforme écrit `PRENOM`, `NOM`, `FICHE`, `INVITER_FICHE`, `TREMPLIN`,
  `MONTEE_SUR_SCENE`, `COACH`, `ORGA`.
- L'import HelloAsso écrit des attributs `ADHESION_*`, et **rien d'autre**.
- Personne n'écrit `EMAIL_BLACKLISTED` : c'est Brevo qui le tient.

Notre import passe `emptyContactsAttributes: false` et ne retire jamais un
contact : il met à jour SES attributs et laisse intact le reste. **L'import
HelloAsso doit faire pareil**, sans quoi chaque passage effacerait le travail de
l'autre. C'est la seule discipline qui rend la cohabitation sûre. (La
suppression d'un compte, elle, retire bel et bien — avec sa propre règle :
voir « La suppression d'un compte va jusqu'à Brevo » plus bas.)

Conséquence utile : quand une adhérente **crée un compte** plus tard, notre
synchro retrouve son contact par l'adresse e-mail et lui ajoute les attributs de
fiche, sans toucher à son adhésion. Les deux mondes se rejoignent tout seuls.

## La suppression d'un compte va jusqu'à Brevo

> Ajoutée 2026-08-16. Avant, la synchro ne savait que POUSSER : un compte
> supprimé devenait simplement absent de la poussée suivante, et son contact
> restait dans « Comptes plateforme » avec ses attributs, indéfiniment — la
> lettre d'information continuait de lui parvenir. La donnée que la suppression
> RGPD existe pour effacer survivait chez le sous-traitant.

`deleteAccount` (plateforme) appelle `supprimerContactBrevo` **avant** d'écrire
en base. Deux chemins, dictés par le tableau ci-dessus — on efface ce qu'on a
écrit, jamais ce qu'un autre écrit :

| Le contact est… | Ce qu'on fait | Pourquoi |
| --- | --- | --- |
| dans notre liste seulement (ou dans aucune) | **supprimé** chez Brevo | il ne vit que par nous |
| aussi dans une autre liste (Adhésions, écosystème) | **détaché** de notre liste, nos attributs de ciblage vidés | la personne reste membre de l'association ; supprimer effacerait le travail de HelloAsso |

`PRENOM` / `NOM` survivent au détachement : ce sont les champs d'identité que
les trois populations partagent, et la personne demeure joignable par une autre
porte. Le jour où HelloAsso cesse de la porter, son contact tombe dans le
premier cas.

**L'ordre porte la règle.** L'adresse est le seul moyen d'aller chercher le
contact : effacer la base d'abord et échouer ensuite le perdrait pour toujours.
Une panne du sous-traitant fait donc **renoncer** à la suppression — la passe de
conservation du lendemain retente, et le compte-rendu du cron compte l'échec
(`suppressionsEchouees`). Le geste manuel, lui, le dit à l'écran et laisse
retenter. À l'inverse, si la base échoue APRÈS Brevo, le compte reste et la
synchro suivante le repousse : la seule des deux pannes qui se répare seule.

## Le point à trancher : l'adhésion revient-elle dans la plateforme ?

L'adhésion arrive sur HelloAsso, pour **tout le monde**. La question n'est donc
pas « où vit-elle » (HelloAsso), mais « la plateforme doit-elle en connaître la
part qui la concerne ».

**A. HelloAsso → Brevo seulement.** Le plus rapide (intégration native ou export
CSV). La lettre d'information peut cibler les adhérentes. Mais la **plateforme
reste aveugle** : elle ne peut ni conditionner l'annuaire à une adhésion à jour
(règle prévue dans `docs/plateforme-conception-fonctionnelle.md`), ni relancer
avant l'échéance, ni afficher son statut à la personne. L'orga tient ça à la
main.

**B. HelloAsso → Brevo *et* plateforme.** En plus de l'import Brevo, la
plateforme reçoit les adhésions (API HelloAsso ou webhook) et retient celles qui
**correspondent à un compte** (rapprochement par e-mail). Les adhésions sans
compte restent hors de la base : elles n'ont rien à y faire, et les stocker
serait collecter des données personnelles sans usage (RGPD, minimisation). Ce
qui devient possible : annuaire conditionné aux membres, relance avant échéance,
statut visible dans son espace.

**Recommandation : B**, dès que l'adhésion doit avoir un effet DANS la
plateforme — c'est le cas prévu. A reste acceptable si l'adhésion ne sert qu'à
segmenter des e-mails.

> **Tranché le 2026-10-15 : B**, livré le même jour
> (`docs/conception-adhesions-helloasso.md`). Le rapprochement se fait par
> l'adresse demandée **pour chaque membre** (jamais celle de la personne qui
> paie), contre `users.email` et `accounts.email`. L'import HelloAsso → Brevo
> reste à part, avec ses attributs `ADHESION_*`.

Dans les deux cas, **HelloAsso reste la source de vérité** : la plateforme n'en
garderait qu'une copie de travail, jamais un second registre à tenir.

## Le piège des doublons

Une même personne peut adhérer sur HelloAsso avec une adresse et se connecter à
la plateforme avec une autre : Brevo verra **deux contacts**. Aucune magie ne
règle ça — les pistes, par ordre de coût :

1. demander l'adresse au bon moment (le formulaire HelloAsso peut afficher
   « utilise l'adresse de ton compte Tech Speak'Her, si tu en as un » ; les
   e-mails de préavis et de relance le disent depuis le 2026-10-15) ;
2. fusionner à la main dans Brevo quand le cas se présente ;
3. plus tard, un rapprochement côté plateforme (« est-ce toi ? ») si le volume
   le justifie.

À l'échelle actuelle, 1 + 2 suffisent. Le noter ici évite de redécouvrir le
problème le jour où deux compteurs divergent.
