# Brouillons d'articles — en attente de relecture

Ce dossier tient des **textes qui ne sont pas publiés**, écrits par assistance et
destinés à être collés dans `/admin/contenus` **après réécriture**. Ils vivent
ici pour une seule raison : une session d'assistance est éphémère, et un
brouillon qui n'existe que dans une conversation est un brouillon perdu.

## Ce que ce dossier n'est pas

Ce n'est **pas** `src/data/`. Le contenu de `src/data/` est la source unique de
ce que le site affiche, il est importé par les pages et surveillé par
`french-spelling.test.ts`. Ici, rien n'est importé nulle part : ces fichiers sont
inertes. Un brouillon devient un article en passant par l'éditeur orga, pas en
étant déplacé dans le code.

## L'état de chaque brouillon

| Fichier | Sujet | Ce qui bloque la publication |
|---|---|---|
| `ou-aller-femmes-tech-france.md` | Panorama des associations françaises pour les femmes de la tech, et ce qui distingue Tech Speak'Her | Une dizaine d'affirmations sur des **structures tierces** restent à confirmer (tableau en bas du fichier). Le piège « Women in Tech » y est documenté : deux entités portent un nom presque identique. |
| `trouver-ou-parler-outils.md` | Les outils pour trouver où proposer un talk, et ce que l'agenda ajoute | **Aurélie Vache y est nommée** : son accord est requis. |

## Ce qui bloque les deux, et qui ne se délègue pas

Ils sont écrits **à la première personne**, du point de vue de Cateline. Les
souvenirs qu'ils contiennent (« mon premier talk », « ce qui m'a débloquée »)
sont des **placeholders** : ils donnent la forme, ils ne racontent le parcours de
personne. Un article signé qui invente les souvenirs de sa signataire est le seul
défaut de ce dossier qu'aucune relecture technique ne rattrapera.

## Typographie

Les **corps d'article** respectent déjà les règles maison : insécables avant
`! ? : ;`, aucun cadratin, forme positive dans les libellés. Les cadratins qui
subsistent sont dans les **sections méta** (titre du brouillon, cellules vides
des tableaux « À vérifier »), qui ne partent jamais dans l'éditeur. La coupure se
fait au séparateur `---` qui précède « À vérifier avant publication » : au-dessus
se colle, en dessous se lit et se jette.
