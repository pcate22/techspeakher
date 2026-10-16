# Brouillon 2/2 — à coller dans `/admin/contenus`

**Type** : Article · **Catégorie** : Conseils de speakeuse · **Autrice** : vous
**Slug suggéré** : `trouver-ou-parler-outils`

> Écrit à la première personne, en speakeuse qui raconte ses outils. Insécables
> posées, aucun cadratin, forme positive.
> **Section « À vérifier » en bas.**

---

## Titre

Trouver où parler : les outils que j'utilise, et celui qui manquait

## Chapô

Une fois qu'on a un sujet, reste la vraie question : où le raconter ? Voilà les outils qui répondent à ça, ce que chacun résout, et pourquoi nous avons fini par en ajouter un.

## Corps

Quand j'ai voulu proposer mon premier talk, j'ai buté sur une question bête : **où ?** Je connaissais deux ou trois conférences de nom. J'ignorais qu'un appel à orateurs se ferme des mois avant l'événement, et qu'il en existe des dizaines ouverts en même temps.

Ce sont des outils qui m'ont débloquée, pas des conseils. Les voici, rangés par ce qu'ils résolvent.

### Savoir quelles conférences existent, et jusqu'à quand proposer

**[developers.events](https://developers.events/)**, maintenu par Aurélie Vache, recense les conférences pour développeuses et développeurs du monde entier : les dates, la ville, et surtout la **date limite de l'appel à orateurs**. On peut lire en liste, en calendrier ou sur une carte, et n'importe qui peut proposer un ajout. C'est un travail de fourmi, tenu depuis des années, et c'est le premier onglet que j'ouvre quand je cherche où proposer un sujet.

Nous lui devons d'ailleurs une partie de notre référentiel : le catalogue de conférences proposé quand vous ajoutez une date sur votre fiche vient de là, sous licence Creative Commons.

Ce que cet outil résout : **quels événements existent, et combien de temps il me reste**.

### Déposer une proposition, et gérer ses sessions

**Conference Hall** et **Sessionize** sont les guichets : on y écrit sa proposition une fois, on la soumet à plusieurs conférences, on suit les réponses. Sessionize donne en plus à chaque oratrice une page publique qui liste ses sessions.

Ce qu'ils résolvent : **la mécanique de la candidature**.

### Savoir qui parle, et de quoi

Un annuaire répond à une autre question : trouver une personne. **Expertes France** sert les médias en quête d'une spécialiste. **134onstage** recense des centaines de femmes qui prennent la parole sur la tech, avec leur domaine et leur profil.

Ce qu'ils résolvent : **qui contacter**.

### Ce qui manquait, et qu'on a fini par faire

Aucun de ces outils ne répond à la question qui m'a le plus manqué au début : **où des femmes comme moi parlent, dans les mois qui viennent**.

Un agenda de conférences me dit que le DevFest Toulouse a lieu le 19 novembre. Il ne me dit pas que six femmes de ma communauté y montent sur scène ce jour-là, ni sur quels sujets. Un annuaire me dit qui elles sont. Il ne me dit pas où elles seront jeudi prochain.

C'est ce croisement que fait [notre agenda](/agenda) : une intervention, c'est **une personne, un talk, une date, un lieu**. Rien d'autre à retenir.

Je ne l'ai pas construit pour la statistique. Je l'ai construit parce que la chose qui m'a le plus aidée à oser, c'est de voir des dates réelles portées par des femmes ordinaires. Une liste de noms inspire moyennement. Une liste de dates prouve que c'est faisable, et qu'on peut aller voir.

### Le trajet complet, en une fois

Pour que ce soit concret, voici comment ça s'enchaîne quand tout fonctionne :

1. J'ai un sujet, encore flou. Un meetup ou le Tremplin m'aide à le tailler.
2. J'ouvre **developers.events** et je repère trois appels à orateurs, dont un se ferme dans dix jours.
3. Je dépose ma proposition sur **Conference Hall**.
4. Je suis retenue. J'ajoute la date sur ma fiche.
5. Elle apparaît dans **l'agenda**, et une autre développeuse la voit passer.

Cinq étapes, quatre outils, et aucun ne remplace les autres. C'est très bien ainsi.

### Si vous démarrez

Un seul conseil, celui que j'aurais voulu recevoir : ouvrez developers.events **avant** d'avoir un talk fini. Les dates limites d'appel à orateurs se ferment beaucoup plus tôt qu'on ne l'imagine, et savoir qu'il vous reste trois semaines fait plus pour un sujet flou que six mois de réflexion.

Et quand votre date est posée, [mettez-la sur votre fiche](/mon-espace/talks) : elle rejoint l'agenda, et elle sert à la suivante.

---

## À vérifier avant publication

| Affirmation | Confiance | À confirmer |
|---|---|---|
| developers.events : conférences + appels à orateurs, mondial, maintenu par Aurélie Vache, vues liste/calendrier/carte, contribution ouverte | **bonne** (lu sur le dépôt GitHub `scraly/developers-conferences-agenda`) | rien de bloquant |
| « Notre référentiel de conférences vient de là, sous licence Creative Commons » | **vérifié dans le dépôt** | `src/data/conferences-seed.ts` porte l'attribution CC BY-NC 4.0, et `/admin/conferences` la cite déjà |
| Conference Hall : proposition multi-conférences | moyenne | le partage exact des rôles avec Sessionize |
| Sessionize : page publique par oratrice listant ses sessions | bonne | — |
| Expertes France, 134onstage | bonne / **vérifié** | — |

### Deux points à trancher

1. **Aurélie Vache est nommée.** C'est mérité, vérifiable, et elle est membre de
   la communauté : assurez-vous que la mention lui convient. Elle est aussi la
   speakeuse la plus prolifique de l'agenda, ce qui rend le clin d'œil plutôt
   heureux, mais c'est à elle de le dire.
2. **Le récit à la première personne** (« mon premier talk », « ce qui m'a
   débloquée ») suppose que c'est bien votre parcours. Réécrivez les deux ou
   trois passages où je vous ai prêté des souvenirs : je les ai posés pour
   donner la forme, ils vous appartiennent.

### Note

Cet article et le premier (`ou-aller-femmes-tech-france`) se répondent sans se
répéter : l'un cartographie **les associations**, l'autre **les outils d'une
speakeuse**. Chacun renvoie à l'autre en une phrase. Publiés le même jour ou à
une semaine d'écart, au choix.
