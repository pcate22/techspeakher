-- 045 — Article « Où héberger tes slides ? » (contenu éditorial, migration de DONNÉES).
--
-- Publie le premier article d'accompagnement (aide au choix d'un hébergement de
-- slides). Idempotent (ON CONFLICT slug DO NOTHING) : rejouable, ne réécrit jamais
-- une version éditée ensuite via l'admin. Hors flux RSS (au_flux = FALSE) :
-- l'article est lisible sur le site, sa diffusion se déclenche depuis l'admin.
-- Le formulaire de talk renvoie vers lui dès qu'il est publié (getAideSlidesHref,
-- résolu par le slug 'ou-heberger-tes-slides'). No-op sur base vierge (tests).
INSERT INTO contenus (type, slug, titre, chapo, corps, statut, publie_le, au_flux)
VALUES (
  'publication',
  'ou-heberger-tes-slides',
  $t$Où héberger tes slides ?$t$,
  $chapo$Tu as fini ton talk. Les lumières se rallument, la salle se vide, et tes slides restent là, sur ton écran. Reste une question toute bête, et pas si technique : où les poser, et jusqu'où les ouvrir ? Les partager, c'est prolonger ton talk. C'est aussi les rendre publiques. Voici de quoi choisir tranquillement, à ton rythme. Il n'y a pas de mauvaise réponse.$chapo$,
  $corps$## D'abord, pourquoi les partager ?

Parce qu'on te les réclame. Dans la salle, il y avait des femmes et des hommes, souvent beaucoup d'hommes. Celles et ceux qui étaient là veulent revenir sur une idée, une référence, un schéma. Celles et ceux qui ont raté ta session veulent la rattraper. Et la plupart des confs te le demandent : ça fait partie du deal.

Et puis il y a l'autre raison, plus discrète. Des slides en ligne, ça te fait exister au-delà de la salle. Ça te référence, ça ramène vers toi, ça travaille pour toi pendant que tu fais autre chose.

Un mot quand même, parce qu'il compte : partager, c'est rendre public. Une fois en ligne, tes slides se lisent par n'importe qui. C'est tout leur intérêt. C'est aussi ce qui fait hésiter. On en reparle plus bas.

## Les regarder, ou les emporter ?

Ça se joue sur un détail qu'on oublie souvent : la façon dont les gens vont y accéder.

Première option, tes slides s'affichent directement dans la page. On les feuillette sur place, sans rien télécharger, sans te quitter. C'est fluide, ça garde le monde chez toi, et c'est ce que fait une visionneuse (l'iframe de SpeakerDeck, par exemple).

Deuxième option, tu donnes un fichier, souvent un PDF, que la personne emporte. Pratique pour garder une copie sous le coude. Mais là, le fichier t'échappe et part vivre sa vie.

La plupart des plateformes te laissent choisir : montrer sans laisser télécharger, ou les deux. À toi de voir ce que tu as envie d'offrir. Et le PDF reste la valeur sûre : tout le monde l'ouvre, il garde ta mise en page au millimètre, il se regarde aussi bien qu'il se télécharge.

## Alors, où les poser ?

Il n'y a pas de bon endroit dans l'absolu. Juste des compromis, et quatre questions pour t'y retrouver : le lien tiendra-t-il dans deux ans ? Peux-tu repartir avec ton audience si tu changes d'avis ? Combien de place ça mange ? Et qu'est-ce que tu gardes sous ton contrôle ?

**Chez toi, ou chez un hébergeur français** (OVH, Infomaniak…). Tu maîtrises tout, tu emportes tout, rien ne bouge sans ton accord. Le revers : les fichiers s'accumulent et finissent par gonfler ton hébergement, et c'est toi qui gères la maintenance, les renouvellements, les certificats.

**SpeakerDeck.** Fait pour les slides, l'embed s'intègre tout seul. Le gratuit suffit souvent, mais il plafonne (autour de dix dépôts par jour, une centaine en tout), et ça vit chez eux.

**Notist.** Une page qui rassemble tous tes talks, comme un vrai portfolio de speaker. C'est beau et confortable. Mais les fonctions qui font la différence sont payantes, et l'abonnement revient chaque année.

**Canva.** Si tes slides y sont déjà nées, tu peux les publier et les partager sans rien déménager. En échange, tout reste accroché à ton compte.

**Google Slides.** Tu l'as sous la main, le partage est instantané. Surveille juste le réglage du lien, qui peut laisser passer une version modifiable : exporte en PDF pour figer ce que tu montres.

D'autres portes existent (GitHub Pages, Notion…), la grille de lecture reste la même. Et rien n'est gravé : tu changes d'endroit quand tu veux, tu mets ton lien à jour, et voilà.

## « Et si on me copie ? »

Posons-la, cette peur, parce qu'elle est légitime, surtout au début. Oui, le plagiat existe. Des slides recopiées telles quelles, une illustration reprise sans un mot de crédit jusque dans une formation payante, un talk rejoué ailleurs. Ça arrive pour de vrai.

La vraie question n'est pas de savoir si ça peut arriver. C'est de le mettre en face de ce que le partage t'apporte. Et là, celles qui partagent depuis des années sont plutôt sereines : à la longue, ça leur a bien plus rapporté que coûté. Trois raisons reviennent, toujours les mêmes.

Ce qui fait ton talk, c'est toi, sur scène. Ta manière de raconter, tes exemples, ta voix. Rien de tout ça ne rentre dans un fichier.

Une copie trop littérale se voit vite. Surtout si ta patte graphique est reconnaissable : ta signature visuelle te protège plus que tu ne crois.

Et puis, on avance toutes sur les épaules de celles d'avant. On s'inspire, on se répond, rien n'est jamais tout neuf. C'est comme ça que ça marche, et c'est très bien ainsi.

Prendre le risque au sérieux, ce n'est pas se taire. C'est partager en gardant la main.

## Garder la main, justement

Trois gestes simples, et ton travail est protégé sans rien verrouiller.

Signe tes slides. Ton nom, ton pseudo, l'adresse de ta fiche, sur la première et la dernière. On te retrouve, on sait que c'est toi.

Dis comment on peut te réutiliser. La reprise est la bienvenue, tant qu'on te cite. Une licence Creative Commons « BY » l'écrit en une ligne, et te donne un appui le jour où on t'oublie.

Et garde ta patte. Une charte qu'on reconnaît, c'est ta meilleure protection : on ne te copie pas sans que ça se voie. Le PDF aide aussi, plus dur à réécrire qu'un fichier source.

## Et Tech Speak'Her, dans tout ça ?

Tu te demandes peut-être pourquoi on ne les héberge pas nous-mêmes, tes slides. C'est un choix. D'autres le font déjà très bien, gratuitement, depuis longtemps. On préfère te laisser libre de tes outils plutôt que de t'attacher aux nôtres.

Notre place est ailleurs. Elle est là : rassembler tes talks et leurs liens au même endroit, et t'aider à être vue dans l'annuaire, là où on cherche des speakeuses à programmer, à interviewer, à faire monter sur scène.

Alors où que tu poses tes slides, il reste un dernier geste, le plus important : colle le lien sur ta fiche. Et si tu n'en as pas encore, c'est le moment. On la construit ensemble.$corps$,
  'publie',
  CURRENT_DATE,
  FALSE
)
ON CONFLICT (slug) DO NOTHING;
