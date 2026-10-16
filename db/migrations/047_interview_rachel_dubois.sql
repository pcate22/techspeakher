-- Migration 047 — Corps de l'article « Interview de Rachel Dubois » (23/03/26).
--
-- Backfill de DONNÉES (pas de schéma). Charge le TEXTE COMPLET (version intégrale)
-- de la première interview Behind the Scenes dans le corps Markdown de la
-- publication : chaque QUESTION devient un titre « ## » (→ h2), chaque RÉPONSE le
-- texte qui suit. Le lien LinkedIn reste en base (CTA de fin d'article, #241).
--
-- La publication est déjà en base (seed des actualités, corps vide) : on lui POSE
-- son corps. INSERT ... ON CONFLICT (slug) DO UPDATE SET corps : en prod, ne touche
-- QUE le corps (chapô/lien/tag/date viennent du seed = src/data/actualites.ts, source
-- unique) ; sur une base neuve, insère la publication complète. Le corps est donc
-- piloté par le REPO (re-posé au déploiement tant qu'il diffère, garde IS DISTINCT) :
-- éditer cette interview se fait par PR, pas via l'éditeur web. Slug =
-- slugify('Interview de Rachel Dubois'). au_flux = false (pas de repost RSS).
-- Aucune donnée personnelle. Appliquée au déploiement via db/sync-to-latest.sql.

INSERT INTO contenus
  (type, slug, titre, chapo, corps, categorie, tag, lien_externe, lien_label,
   statut, publie_le, au_flux)
VALUES (
  'publication',
  'interview-de-rachel-dubois',
  'Interview de Rachel Dubois',
  $chapo$« On t'a prise parce que t'étais la seule fille. » Première interview Behind the Scenes, sur LinkedIn.$chapo$,
  $corps$_Première interview de notre série Behind the Scenes. Rachel Dubois pratique le produit depuis plus de 25 ans. Elle revient sans filtre sur son rapport à la scène, sur le choix des conférences et sur la place des femmes dans la tech. Propos recueillis par Cateline Puccetti pour Tech Speak’Her._

## Peux-tu nous raconter qui tu es dans la tech et ce que tu fais au quotidien ?

Je m’identifie dans la tech, plutôt côté produit. J’ai fait un peu de développement en début de carrière, mais cela reste anecdotique par rapport au produit, que je pratique depuis plus de 25 ans. Je suis très orientée produit et business. Ce qui m’intéresse, c’est une question très simple : comment faire pour que les logiciels soient réellement utilisés.

## Comment décrirais-tu ton rapport à la prise de parole aujourd’hui ?

Ça va mieux ! Mais cela reste une petite torture auto-infligée. Une petite violence nécessaire qui me fait grandir à chaque fois. Le positif reste supérieur au stress. C’est plus facile aujourd’hui, notamment grâce à de meilleures techniques de préparation, de gestion du stress et à ma capacité à me convaincre d’y aller. Mais il y a toujours ce moment de speed juste avant de monter sur scène. Encore à Devoxx, j’ai perdu mon latin au début, et malgré ça, c’était chouette. J’ai des copines qui font du théâtre, et le trac est toujours là après 20 ans.

## Comment la prise de parole est-elle entrée dans ton parcours ?

La première fois, c’était de façon forcée et pas forcément consentie. J’étais toute jeune. En 2008, lors d’un des tout premiers Agile Tour, on m’a forcé la main. Je ne l’ai pas très bien vécu, et j’ai opposé un refus assez frontal le jour J. La personne voulait me pousser pour de mauvaises raisons : « t’es une fille », « l’agilité est à la mode »… Bref.

La vraie première fois est arrivée quelques mois plus tard, à Bordeaux, lors d’un Agile Tour (Agile Tour Bordeaux). Il y avait très peu de femmes dans la tech, dans le produit, dans l’agile. Cette fois, j’ai volontairement soumis une idée. Le talk a été sélectionné. J’ai ressenti une énorme pression. J’étais arrivée avec des slides, mais au final, je les ai trouvées hyper tristes. Il n’y avait pas vraiment de narratif. Le jour J, dans un grand amphi, j’ai eu de gros doutes. J’ai fait des erreurs. J’ai dépassé le temps. Mais c’était fait. Et surtout, j’ai ressenti une immense fierté. Puis un des organisateurs m’a dit :

> On t’a prise parce que t’étais la seule fille.

Ça m’a donné la rage. Et surtout l’envie de faire entendre davantage de voix de femmes sur scène. À l’époque, nous étions trois ou cinq. Beaucoup plus aujourd’hui.

## Qu’est-ce qui t’a semblé le plus difficile dans ce parcours de prise de parole ?

Beaucoup de choses se sont facilitées avec le temps. Un vrai changement s’est opéré le jour où j’ai commencé à travailler pour Spotify, où j’étais la seule Française. Je n’avais plus besoin de prouver.

Mais dans toutes les conférences, il y a une constante très marquante : le comportement d’une partie de l’audience quand tu es une femme sur scène. Il y aura presque toujours ce mec qui n’accepte pas, qui interrompt, qui pose son point de vue en plein talk pour montrer que ce n’est pas carré. Qu’ils ont une plus grande bite que les autres. Devant toute la salle.

J’ai dû faire pas mal de psychothérapie pour travailler ma légitimité. J’ai aussi pratiqué l’improvisation, l’absurde.

En Angleterre, certaines conférences rappellent dès le début que ce type de comportement n’est pas toléré. Ce n’est pas encore le cas en France. Cela m’a d’ailleurs beaucoup motivée à devenir animatrice et organisatrice de conférences, pour que les femmes puissent se sentir en sécurité.

Il y a encore trop de conférences sans parité.

Ma grande motivation reste ma fille. On m’a souvent dit que l’informatique, ce n’était pas pour les nanas. Je veux qu’elle comprenne qu’elle peut tout faire. Et j’essaie aussi d’éduquer mon fils. La tech reste un milieu très validiste, très blanc, très occidental. Les personnes transgenres restent largement invisibilisées en France. Le handicap, c’est pareil.

J’ai un respect immense pour Aurélie Vache, qui est extraordinairement intelligente et qui a un courage énorme de monter sur scène.

## Peux-tu nous raconter une prise de parole qui t’a particulièrement marquée, et pourquoi ?

C’est ça le problème, il y en a vraiment plein. Il y en a plein, plein, plein. Il y en a plusieurs, mais je finirai par celle qui m’a le plus marquée. Une qui m’a vachement marquée, c’est la première fois où je suis allée parler en Angleterre, à Agile on the Beach, parce que c’est une conférence dont je rêvais depuis des années et qui est vraiment difficile d’accès. Ça m’a énormément touchée. Et puis tu parles en anglais, en Angleterre, au bout du monde, c’est trop rigolo. Ça m’a super touchée aussi quand on m’a invitée à Devoxx et qu’ils m’ont fait le coup de la petite salle bleue. Je ne m’attendais pas du tout à me retrouver dans l’amphi complet de Devoxx. Énorme claque. Mais la prise de parole qui m’a le plus marquée, c’est celle de Tech.rocks 2023, en décembre 2023.

## Pourquoi ?

Parce que je travaillais chez Spotify à l’époque. Le 4 décembre, donc 48 heures avant la conférence, Spotify fait une vague de layoffs. Je perds tout le monde du jour au lendemain. Je me retrouve la dernière. Ça a été d’une violence incroyable. Je me dis : je ne vais pas aller faire une conférence où je dois parler de comment on fait de l’innovation chez Spotify. Je contacte Tech.rocks, je leur dis que je ne le sens pas du tout. Ils ne m’ont mis aucune pression. Ils m’ont dit : viens quand même. Même si tu ne montes pas sur scène. Je viens. Le jour J, ils me redemandent si je veux parler. Je me dis que ça va mieux. Je monte sur scène. À un moment du talk, je parle à quel point ce qui compte dans cette démarche d’innovation, ce sont les gens. Et là, j’ai une vague d’émotion. Sur scène. Je suis limite à pleurer.

Et la salle a été d’une bienveillance incroyable. Il y a eu une espèce de feedback hyper touchant, hyper soutenant. Ça m’a redonné confiance. Je me suis sentie portée. J’ai essuyé mes larmes et j’ai terminé mon talk. Et c’était cool, parce que j’ai pu donner un talk très sincère de ce que je pensais. Respectueux de la boîte que j’aimais malgré tout. Sans cacher l’émotion d’avoir perdu tous les gens que je connaissais. C’est un talk qui m’a énormément émue.

## Finalement, on comprend que le choix de la conférence et des organisateurs joue un rôle énorme. Qu’est-ce qui est déterminant pour toi dans le choix d’une conférence ?

Clairement, il y a des conférences que je ne ferai jamais, même pour tout l’or du monde. Et puis il y a des conférences… je suis tellement contente de les avoir faites.

Il y a une toute petite conférence, même quand je ne veux plus faire de conférences, quand je n’ai plus d’énergie, il suffit qu’ils me disent « viens » et je viens : Agile Pays Basque. C’est une petite conférence, pas connue, peut-être 150 personnes maximum. Mais l’ambiance est incroyable. C’est presque familial. Tu peux y aller avec tes enfants. À une époque, on faisait des grillades sur le parking, tu vas à la plage, tu apprends à surfer… Il y a un tel bon esprit chez ces gens-là que tu as trop envie d’y aller, même quand tu n’as pas l’énergie.

Après, il y a aussi des conférences connues pour leurs standards d’inclusion. Par exemple Mix-IT, qui a des standards très élevés sur la diversité, la protection des femmes, l’inclusion.

Et puis il y a des conférences où je me suis déjà sentie mal à l’aise ou pas en sécurité. Je les ai faites une fois. Je ne les referai pas.

Il y a aussi des fois où je me suis trompée. J’avais un a priori négatif sur certaines conférences, et en fait, j’étais très contente de m’apercevoir que je me trompais. On a tous des a priori, des croyances. Il ne faut pas hésiter à se remettre en question là-dessus.

## Quel conseil donnerais-tu à une femme qui hésite à se lancer aujourd’hui ?

1. **Il ne faut pas hésiter, mais il ne faut pas partir seule.** Partir avec une communauté, c’est extrêmement important. Aujourd’hui, il existe plein de choses pour ça. Des tremplins, des dispositifs pour aider les gens à se lancer. Il y a aussi plein de communautés qui peuvent soutenir.
2. **Ensuite, bien choisir sa conférence.** Regarder s’il existe une charte de comportement. S’il n’y en a pas, c’est déjà plutôt un mauvais signal. Regarder aussi le line-up des éditions précédentes : est-ce qu’il y a des femmes ? Est-ce que la représentativité est OK pour nous ? Je connais des speakers qui refusent des conférences uniquement pour cette raison. Et ils ont raison.
3. **Puis écouter son feeling.** Pendant toute la phase de préparation, on échange avec les organisateurs. On peut très vite sentir si l’état d’esprit est bon ou pas. Si on ne se sent pas en sécurité, on dit non. Il y a plein de conférences. Il ne faut jamais l’oublier.
4. **Et surtout, ne pas oublier une chose essentielle : les conférences ont besoin des speakers autant que l’inverse.** On a un pouvoir énorme. C’est nous qui amenons la valeur, la qualité, les contenus. Donc il ne faut pas hésiter à choisir.

## Tu inverses complètement la posture. Là où beaucoup de personnes se demandent « est-ce que je vais être acceptée ? », toi tu dis plutôt « c’est à nous de choisir ».

Oui, complètement. Les conférences, si elles n’ont pas de speakers, elles n’ont rien. Donc ce pouvoir, il est de notre côté. On est en capacité de proposer des contenus de qualité, pertinents, intelligents. C’est nous qui amenons la valeur.

On peut aussi faire grandir les conférences en donnant du feedback. Dire quand une conférence n’est pas au niveau de la parité, de l’inclusion. Signaler quand certains comportements ne sont pas acceptables.

Et il faut aussi que, collectivement, on ose dire quand une conférence n’est pas au niveau.

## Finalement, ce que tu dis, c’est qu’il ne faut pas renoncer à choisir la bonne conférence, même quand on débute.

C’est ça. Il ne faut pas renoncer. Et il ne faut pas oublier certaines réalités aussi…

La plupart des conférences ne proposent pas de rémunération aux speakers, ni même de prise en charge des frais. Alors que dans la plupart des cas, elles sont payantes. Donc au minimum, il faut poser la question.

« Est-ce que c’est une conférence communautaire ou pas ? »

Quand c’est communautaire, je ne demande pas d’argent, mais au moins la prise en charge des frais de déplacement, c’est la moindre des choses.

Quand c’est commercial, c’est différent. Parce que préparer une conférence, ça prend énormément de temps. Et il ne faut pas oublier qu’une journée de conférence, pour un indépendant, c’est une journée de chiffre d’affaires en moins.

Et les femmes, en particulier, ne doivent pas hésiter à demander.

## Même sur la question financière, tu as une posture très claire.

Oui, parce qu’il y a un truc qu’il ne faut pas oublier.

Quand tu es speaker et que tu n’es pas rémunérée, au minimum tu dois être défrayée. Les conférences sont payantes. Elles vendent des billets. Et en face, on te dit : « oui, mais tu as le billet gratuit », « t’as de la chance de parler, on te donne de l’audience ».

Heureusement. C’est moi qui viens parler. C’est moi qui t’amène de l’audience. Je ne vais pas payer pour travailler. Quand je parle dans une conférence, moi je perds une journée de chiffre d’affaires. Donc je suis déjà gentille de ne pas te faire payer. Quand je fais des conférences privées pour des entreprises, c’est beaucoup plus cher que ça.

Et la plupart du temps, ce n’est même pas complètement vrai qu’on te fait une « pub gratuite ». Parce qu’en réalité, on te demande aussi de faire la promotion de la conférence.

## Donc il faut demander.

Évidemment qu’il faut demander. Si une femme ne le demande pas, on ne va pas lui proposer. Les hommes, eux, demandent beaucoup plus systématiquement. Au pire, on te dit non. Mais si tu ne demandes pas, tu n’auras rien.

Moi, en tant qu’organisatrice, je vois très bien qui demande la prise en charge : ce sont majoritairement des hommes. Ou des femmes très aguerries, qui ont l’habitude du circuit. Donc il faut demander.

## C’est un peu comme les augmentations de salaire.

Ouais, vraiment. Vraiment.

## Quelque part, ça crédibilise aussi la démarche.

Bien sûr. Tu ne demandes pas une faveur. Tu demandes quelque chose de parfaitement normal. Préparer une conférence, c’est énormément de travail. Et économiquement, ça a un impact réel. Si on ne demande pas, on ne nous proposera rien.

## Tu as déjà refusé des conférences pour ces raisons ?

Oui, complètement. Il y a une conférence à Grenoble qui m’avait invitée. J’ai dit OK au début, puis j’ai creusé. Ils ne prenaient pas les frais de déplacement, pas l’hébergement, rien. Et les billets étaient chers. On me donnait un ticket… mais seulement pour le jour où je parlais. Si je voulais assister aux autres jours, je devais payer.

Là, j’ai dit non. Je ne vais pas venir pour travailler gratuitement, payer en plus, et ne même pas pouvoir profiter de la conférence.

Du coup, je n’y suis pas allée. Et maintenant, ils ont changé. Aujourd’hui, ils donnent le ticket pour les deux jours.

## Et aujourd’hui, concrètement, comment ça se passe quand tu es invitée ?

Là par exemple, je vais à Dresde, en Allemagne. La conférence me plaît bien, mais c’est très loin. Je ne m’étais pas rendu compte à quel point. Mais ils sont sympas, ils prennent une partie des frais. Donc j’y vais.

## C’est hyper intéressant. Je pense que les speakeuses en devenir auront plein de tips à récupérer de tout ce que tu racontes.

Et on va les accompagner dans le groupe en plus, donc c’est trop cool quoi. (NDLR : avec le Tremplin Tech Speak’Her & DevFest Toulouse 2026.)

## Comment tu vois la suite de ton parcours de prise de parole aujourd’hui ?

L’année dernière, j’ai fait pas mal de conférences parce que je lançais ma boîte, donc je voulais aussi en profiter pour rencontrer des gens. C’était un investissement personnel intéressant, mais pas forcément le plus intelligent usage de mon temps.

Du coup cette année, j’ai décidé de faire moins de conférences, et de vraiment me concentrer sur celles qui me plaisent profondément. Faire plus de conférences techniques. Moins de conférences généralistes, management, agilité, etc.

Et puis quitte à se balader, autant aller se balader à l’étranger. Donc j’ai priorisé les conférences à l’étranger. Je trouve ça plus rigolo.

## En anglais… en allemand aussi ?

En allemand, je suis une quiche. Donc tout en anglais.

J’ai un pari quand même avec une copine d’arriver à faire une conférence en espagnol. On verra ce que ça donne. Et idéalement, j’aimerais bien arriver à faire un jour une conférence en japonais… juste pour pouvoir justifier le fait que j’aille à Tokyo. Mais ça, c’est pas réaliste du tout.

## Tu as des notions de japonais ?

Oui, mais pas suffisamment pour faire une conférence.

L’espagnol c’est beaucoup plus facile parce que je l’ai déjà pratiqué, j’étais quasiment bilingue à une époque. J’ai vécu une grosse partie de mon enfance en Amérique du Sud. Donc c’est juste à remettre en route.

Le japonais, il faut vraiment que je bosse pour de vrai.

## Et tu penses continuer longtemps ?

Oui. Je pense que je continuerai toute ma vie à faire des conférences. Parce que c’est vraiment important d’aller écouter les gens en conférence. J’adore ça. J’aimerais bien faire certaines conférences en tant qu’auditrice aussi.

Et puis préparer un sujet de conférence, ça t’oblige à te poser, à réfléchir à ton état de l’art sur un sujet. C’est hyper bon intellectuellement. Ça te fait progresser.

## En parlant de formation, est-ce que tu as des ressources à conseiller ?

Il y en a un sur la prise de parole en public, le côté storytelling… je crois qu’il s’appelle d’ailleurs « Storytelling » (NDLR : voir les indispensables conseillés par Rachel en fin d’article).

Après, il y a des choses vraiment géniales pour la prise de parole.

Moi je trouve que le théâtre d’impro, c’est une des meilleures écoles de l’univers pour apprendre à gérer. Quoi qu’il arrive, ça se passera bien.

Il y a aussi une super association qui s’appelle Toastmasters International. C’est une association qui existe partout dans le monde. Il y en a à Toulouse, il y en a à Paris. Ce sont des gens qui s’entraînent à prendre la parole en public sur n’importe quel sujet. Ils ont des techniques, c’est très bien structuré, et c’est assez fun.

## Et les coachs ?

Il y a aussi des coachs de prise de parole en public. Mais ça coûte cher. Moi j’aimerais bien en prendre un pour corriger certains tics que j’ai en présentation. Mais il faut mettre 5 000 ou 6 000 euros. Ça vaut le coup, je critique pas du tout. Mais c’est un investissement. C’est pour corriger des tics de langage, de préparation, d’animation.

## Pour passer un cap finalement ?

Oui. Quand tu veux monter d’un niveau, il y a des choses que tu apprends sur le terrain, mais qui ne sont pas « propres ». Avec un coach, tu peux aller beaucoup plus loin. Par exemple, si je voulais faire un TEDx, je passerais par un coach. Parce que ce n’est pas encore assez propre.

## Tu te lances aussi des défis ?

Oui. Par exemple à Devoxx, j’ai proposé un talk de 15 minutes. Je n’ai jamais fait de format aussi court. C’est une expérimentation. Et ça m’oblige à écrire différemment, à parler différemment, à raconter différemment. C’est un gros défi.

## D’autres astuces ?

Oui. Il y a des conférences qui proposent des formats type « forum ouvert ». Tu peux proposer un sujet au dernier moment, le tester, recevoir du feedback. C’est super bien pour commencer.

Et puis… s’inscrire à un tremplin.

## Tu proposes aussi des formats pour s’entraîner ?

Oui. On a un atelier avec Montaine Marteau à Devoxx, un atelier de deux heures sur la prise de parole. Ça s’appelle « Pitcher ton produit ». On l’avait fait pour le DevFest de Nantes (GDG Nantes).

L’idée, c’est d’emprunter des techniques du marketing, du produit, de la vente, pour apprendre à présenter ses sujets techniques. À pitcher, à défendre ses idées. Et c’est assez marrant.

## Et ça a bien marché ?

Oui, ça nous a vachement surpris. On pensait avoir une vingtaine de personnes… et la salle était blindée. On a dû refuser du monde. On a eu des super feedbacks. Les gens ont vraiment kiffé. Du coup on l’a reproposé à Devoxx.

## C’est vrai que savoir se vendre, même dans des métiers très techniques, c’est clé.

Oui. Les gens ne savent pas le faire, parce qu’on ne leur apprend pas.

## Un petit mot de la fin ?

Si t’es une fille et que t’as des choses à dire, n’hésite pas à l’ouvrir très grand et à le dire. Et si t’as peur de le faire toute seule, viens. Il y a plein d’associations comme nous. On va serrer les rangs derrière toi. Et tu vas y arriver. On a besoin de beaucoup plus de femmes. Le monde a besoin de beaucoup plus de femmes au pouvoir. Ça fait 15 000 ou 20 000 ans de leadership masculin. On voit ce que ça donne. Ça suffit.

## Les ressources indispensables pour Rachel Dubois

- **Talk Like TED**, de Carmine Gallo. Décryptage concret des talks TED (structure, émotion, simplicité). Utile pour structurer une keynote qui marque.
- **Confessions of a Public Speaker**, de Scott Berkun. Pas théorique du tout : du terrain, des erreurs, des situations réelles. De quoi éviter les illusions du « speaker parfait ».
- **The Art of Public Speaking**, de Dale Carnegie. Un classique. Basique mais structurant. Un peu daté, mais utile pour les fondamentaux.
- **Made to Stick**, de Chip Heath & Dan Heath. Pourquoi certaines idées restent et d’autres meurent. Framework clé : SUCCES (Simple, Unexpected, Concrete, etc.).
- **Resonate**, de Nancy Duarte. La structure narrative des grandes présentations. Très sous-estimé alors que c’est l’un des meilleurs.
- **The Storytelling Animal**, de Jonathan Gottschall. Pourquoi le cerveau humain pense en histoires.

_Encore un grand merci à Rachel Dubois de s’être prêtée au jeu pour cette interview sans filtre. Behind the Scenes, par Cateline Puccetti (plume Cateline Sola) pour Tech Speak’Her._$corps$,
  'Interview',
  'Passé',
  'https://www.linkedin.com/pulse/behind-scenes-avec-rachel-dubois-ta-prise-parce-que-t%C3%A9tais-3m3de/',
  'Lire sur LinkedIn',
  'publie',
  DATE '2026-03-23',
  FALSE
)
-- Le CORPS est piloté par le repo : ON CONFLICT DO UPDATE le (re)pose tant qu'il
-- DIFFÈRE du texte ci-dessus (garde IS DISTINCT : pas d'écriture inutile au rejeu).
-- Conséquence assumée : éditer CETTE interview se fait dans le repo (PR), pas dans
-- l'éditeur web — une modif faite dans l'éditeur serait réécrite au déploiement.
-- Chapô/lien/tag ne sont touchés QUE sur une base neuve (insert) ; en prod (ligne
-- déjà seedée) seul le corps est posé, la métadonnée reste celle du seed.
ON CONFLICT (slug) DO UPDATE
  SET corps = EXCLUDED.corps,
      maj_le = now()
  WHERE contenus.corps IS DISTINCT FROM EXCLUDED.corps;
