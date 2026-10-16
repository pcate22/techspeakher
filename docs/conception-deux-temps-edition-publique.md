# Les deux temps d'une édition, côté public — conception

> 2026-08-02. Fait suite à `docs/tremplin-edition-publique.md` (la page
> d'édition pilotée par la BDD) et à `docs/conception-phases-tremplin.md` (les
> phases comme colonne vertébrale). Cette conception **ne réimplémente pas** les
> phases : elle les fait remonter jusqu'aux pages publiques.
>
> **Statut : arbitré et livré.** La section 6 garde la trace de chaque point et
> de la décision prise — y compris celle qui va contre l'avis de ce document
> (§6.3), pour qu'on sache plus tard qu'elle a été pesée.

## 1. Le besoin (mots de l'orga)

> « Il faut mettre en avant le parcours avant la soirée finale, on n'y est plus,
> puis le parcours après la soirée finale, de préparation à la conférence. Il
> n'y a plus que celui-ci alors que la soirée tremplin a eu des ateliers en
> avril mai. »
>
> « Peut-être qu'on doit faire deux pages. Une pour la partie 1 tremplin et une
> autre pour l'après finale, car on n'a pas les mêmes speakeuses accompagnées :
> d'autres participantes ont postulé au CFP du DevFest et ont été prises, d'où
> la décision d'accompagner 6 speakeuses. »
>
> « On doit aussi sur chaque phase mettre en avant les membres de
> l'organisation qui ont accompagné. »
>
> « On a donc la page DevFest qui présente la conférence et qui permet d'avoir
> les liens vers le Tremplin 2026 et l'accompagnement à la montée sur scène. »

Quatre attentes : **séparer les deux parcours**, **nommer la cohorte de la
phase 3** (qui déborde le palmarès), **créditer celles qui accompagnent**, et
faire de `/devfest-toulouse` le **hub** des deux.

## 2. Le diagnostic : pourquoi un seul parcours s'affiche

Aucun bug. `getProgrammePublicByEdition` renvoie **les quinze séances** de
l'édition (les 5 d'avril-mai et les 10 de septembre-novembre), et le DTO
`PublicAtelier` **laisse tomber la phase**. La page rend donc une liste plate
ordonnée par `ordre`, où les deux programmes se suivent sans couture — et la
phrase d'accroche mesure « N semaines d'accompagnement, du premier atelier à la
scène » **d'avril à novembre**, en agrégeant deux parcours que rien ne relie
pour la lectrice.

Ce n'est pas une séance qui manque : c'est la **frontière** qui manque.

> À vérifier en base avant de conclure (`docs/exploitation.md` §programme
> public) : si des séances d'avril-mai portent `audience = 'selection'`, elles
> sont hors programme public depuis la migration 051 et il faut les rétablir en
> `phase` ou `toutes` — c'est un geste d'orga, pas un correctif de code.

## 3. L'arborescence retenue

| URL | Rôle | Une action principale |
| --- | --- | --- |
| `/devfest-toulouse` | La **conférence**, et le hub des deux parcours | Prendre sa place |
| `/tremplin/devfest-toulouse/2026` | Le **Tremplin** : des ateliers d'avril-mai à la soirée du 4 juin | Revoir la soirée |
| `/tremplin/devfest-toulouse/2026/montee-sur-scene` | La **montée sur scène** : de la finale au DevFest | Voir le programme du DevFest |

`tremplin` reste en tête d'URL, la hiérarchie `tremplin → conf → année → phase`
se lit de gauche à droite, et le quatrième segment reprend le mot de l'enum
(`montee_sur_scene`) et celui de l'orga (« la montée sur scène »).

### 3.1 L'asymétrie, assumée — et ce qu'elle coûte vraiment

Les deux chapitres ne sont **pas** des URL sœurs : le parent porte à la fois
« l'édition » et « le chapitre 1 ».

**Ce n'est pas un sujet de référencement.** Aucun moteur n'attend de symétrie
entre URL sœurs, et l'option symétrique (`…/2026/tremplin` +
`…/2026/montee-sur-scene`, parent réduit à un sommaire) ne coûterait qu'une
redirection 301 — qui transmet l'autorité. Une première version de ce document
présentait cet argument comme lourd : il ne l'est pas.

Le **vrai** risque de référencement vient de la décision inverse : deux pages
qui partageraient le jury, les prix et la FAQ seraient traitées en quasi-
doublons. C'est le §3.2 qui protège, pas la forme de l'URL.

On garde donc l'asymétrie pour ce qu'elle est — la solution la plus simple, sans
redirection ni segment au nom absurde : `…/2026` **est** le Tremplin, et renvoie
vers sa suite.

### 3.2 Ce que la page 2 ne reprend pas

Le jury, la grille d'évaluation, les prix, les partenaires de la soirée et la
FAQ **appartiennent au chapitre 1**. Les recopier ferait une seconde page de
douze sections et rejouerait exactement ce qu'on est en train de corriger.

La page 2 porte : les speakeuses accompagnées, les séances de la phase, les
accompagnantes, la date de scène, et deux liens (le programme du DevFest, le
chapitre 1).

## 4. Ce que le DTO doit gagner

- `PublicAtelier.phase` — sans elle, aucune des deux pages ne sait quoi rendre.
- `PublicEdition.accompagnees` — le roster de la phase 3, lu sur
  `tremplin_registration_phases` (pas sur `phase_entree`, qui dit par où on est
  **entrée** et non où l'on est).
- `PublicEdition.accompagnantes` — par phase, dérivées de
  `tremplin_atelier_coachs` sur les séances **du programme public**.
- La durée du parcours devient **bornée par phase** (cf. §6.4).

## 5. Le contrat d'anonymat, revisité

`src/lib/tremplin-public.ts` refusait jusqu'ici de publier **même l'effectif** de
la phase 3 : tant que le roster se réduisait aux gagnantes, en publier le nombre
revenait à apprendre au public que telle gagnante nommée n'était plus
accompagnée.

L'édition 2026 change le **fait**, pas seulement l'avis : la cohorte déborde le
palmarès (des participantes retenues au CFP du DevFest s'y ajoutent). Le roster
devient une cohorte à part entière, avec sa page. L'orga a tranché de la
raconter.

Ce qui ne change pas : **aucun nom sans consentement** — et pas n'importe lequel
(§6.1, §6.2).

## 6. Les points à trancher

### 6.1 — TRANCHÉ. Republier un consentement collecté pour autre chose

> Décision orga (2026-08-02) : **voie 1**, un consentement par phase.
> Migration 055, et sa case sur la fiche participante (cf. §7).


`r.public` a été recueilli pour **la galerie des finalistes** (« me montrer parmi
les finalistes de la soirée »). S'en servir pour publier « elle est accompagnée
vers le DevFest » est un **changement de finalité** : une finaliste qui a accepté
d'apparaître en juin n'a pas, par ce geste, accepté de figurer en novembre dans
une liste d'accompagnées.

C'est d'autant plus visible que la cohorte **déborde les finalistes** : une
participante retenue au CFP sans être passée par la finale n'a jamais eu
d'occasion de consentir à quoi que ce soit de public.

Trois voies :

1. **Un consentement par phase** — une colonne dédiée sur l'appartenance
   (`tremplin_registration_phases`), horodatée, écrite depuis l'admin après
   accord. Le journal `tremplin_consent_log` existe déjà pour la traçabilité.
   Correct, et retirable indépendamment de la galerie. **Recommandé.**
2. **Réutiliser `r.public`** après avoir redemandé l'accord hors ligne.
   Pragmatique, mais un seul interrupteur pour deux finalités : celle qui veut
   sortir de l'une sort des deux.
3. **N'afficher que celles déjà au programme public du DevFest**
   (`speaker_talks.edition_id` + fiche publiée, comme `/devfest-toulouse`).
   Aucun consentement neuf à collecter, mais la page ne dit alors plus
   « accompagnée », seulement « à l'affiche » — elle perd son sujet.

### 6.2 — TRANCHÉ. Une fiche coach, distincte de la fiche speakeuse

> Décision orga (2026-08-02) : « Pour les coachs on peut avoir une fiche coach
> et pas speakeuse. On rattache à leur e-mail et elles pourront toujours
> révoquer leur nom et supprimer leur compte. »

Le défaut identifié était réel : gater sur `speaker_profiles.status = 'publie'`
revenait à demander à une coach d'**entrer dans l'annuaire des speakeuses** pour
être créditée. Deux finalités derrière un seul état, et une coach qui ne prend
pas la parole publiée dans un annuaire qui n'est pas le sien.

**Retenu** : une table `coach_profiles` — la fiche coach minimale, tenue par
l'orga pour celles qui ne se connectent jamais, rattachée au **compte** (donc à
l'e-mail, mécanisme d'invitation déjà en place via `getOrCreateUserByEmail`).
Elle porte le rôle affiché, un lien facultatif, et **le consentement à être
citée**, horodaté. Révocation : dépublier suffit, la suppression de compte
emporte tout par cascade.

Le consentement est **au niveau du compte**, pas de l'édition : « je veux bien
être citée comme accompagnante » est une position sur soi, pas sur une année, et
une seule révocation doit valoir partout. Une coach qui a accompagné trois
éditions n'a pas trois cases à décocher.

> **Annuaire des coachs bénévoles** (piste orga) : `coach_profiles` en est la
> fondation, mais l'annuaire lui-même est **un autre lot** — il demande sa
> conception (qui y figure, ce que porte une fiche, la modération, comment on
> se propose). Le construire ici ferait entrer une surface publique entière
> dans un lot qui porte déjà deux pages et deux migrations. À tracer dans
> `docs/roadmap.md`.

### 6.3 — TRANCHÉ, contre l'avis de cette conception

> Décision orga (2026-08-02) : « On conserve sur chaque édition le nombre même
> anonyme de chaque phase : participantes ou coachs. »

Le compteur par phase est donc publié, pour les participantes comme pour les
accompagnantes, indépendamment du nombre de noms affichés.

La réserve, consignée une fois et pas rejouée : afficher « 6 accompagnées » en
n'en nommant que 4 apprend au public que **deux femmes identifiables** ont
refusé. Sur une cohorte de cette taille, c'est une désignation par soustraction
plutôt qu'un agrégat. Le précédent de `counts.finalistes` (8 comptées, moins
nommées) couvre mal ce cas : une soirée avec du public dans la salle est
observable de l'extérieur, un roster d'accompagnement ne l'est pas.

Le risque se referme de lui-même si les six consentent — ce qui est le cas
attendu. À rouvrir seulement si une édition future affiche un écart durable
entre effectif et noms.

### 6.35 — TRANCHÉ. La vitrine se coche, elle ne se déduit plus

> Demande orga (2026-08-02) : « Que ce soit explicite pour l'organisation : cet
> atelier sera visible (date, nom, description) sur le site public, ou non, avec
> possibilité de choisir. Si toutes les participantes d'une phase, c'est visible
> par défaut. »

Rouvre volontairement le commit `c1a00f3` (2026-08-01), qui avait **fusionné**
publication et audience. Il faut donc dire pourquoi ce n'est pas un retour en
arrière.

Ce que la fusion corrigeait n'était pas « deux réglages » : c'était un réglage
**invisible**. La publication dépendait du nombre de participantes désignées,
donc **pointer une présence publiait la séance**, avec son lieu, alors que
l'écran promettait « seules les inscrites que tu désignes la voient ». Personne
ne choisissait de publier : ça se déduisait d'un geste qui parlait d'autre chose.

Un interrupteur **écrit, coché, affiché en toutes lettres** est le contraire de
ce défaut. Et le lieu ne sort plus du DTO (`PublicAtelier`) : même mal réglée,
une séance ne peut plus livrer son adresse.

**Retenu** : colonne `au_programme_public` (migration 056), initialisée depuis
l'audience à la création (cohorte → visible, sélection → réservée), puis
**indépendante**. Changer l'audience ne publie ni ne dépublie plus rien — un
test d'intégration éprouve précisément ce découplage, sans quoi on aurait
seulement déplacé l'effet de bord d'un cran.

Les garde-fous qui rendent la séparation tenable, et qui existaient déjà :
les pastilles « au programme public » / « hors programme public » sur la liste
**et** sur la fiche. Une séance ne peut pas quitter la vitrine sans que ça se
voie.

> **Reste à trancher** : autoriser une séance en **sélection nominative** à être
> publique. L'implémentation le permet (le lieu ne sort jamais, et publier
> « Point individuel avec ta coach, semaine du 14 septembre » ne désigne
> personne), mais c'est la porte que l'incident avait fermée. À confirmer, ou à
> refermer par une garde côté action.

### 6.4 — La durée d'accompagnement, silencieusement fausse

`recitEdition` mesure « du premier atelier à la scène ». Une fois les parcours
séparés, ce calcul court **toujours** d'avril à novembre : le chapitre 1
annoncerait 29 semaines pour un parcours qui en dure 6. Les bornes doivent
suivre la phase rendue — sinon la page ment sans que rien n'échoue.

### 6.5 — La vitrine `/tremplin` dit encore « la gagnante »

`tremplinSteps` §4 : « **La gagnante** est accompagnée sur la durée » ; §5 :
« **Elle** présente son talk ». Et la FAQ : « la gagnante montera sur scène au
DevFest le 19 novembre ». C'est la prémisse même de la demande qui est démentie
là : elles sont six. Le concept evergreen doit être réécrit au pluriel, sans
quoi les deux nouvelles pages contrediront la page qui les présente.

### 6.6 — Les surfaces qui indexent le site

À mettre à jour dans le même lot, sans quoi la page 2 existe sans exister :
`src/app/sitemap.ts` (liste en dur), `public/llms.txt` (décrit `…/2026` comme
couvrant tout le parcours), `src/data/search-index.ts`.

### 6.7 — Le vrai sujet, en dette : la longueur du chapitre 1

Retirer une section ne règle pas que `…/2026` en compte douze (héros, chiffres,
parcours, palmarès, prix, récompenses, retours, finalistes, replay, photos,
format + grille + jury, partenaires, FAQ). Le signal d'alerte de
`docs/principes-conception-ui.md` §1 (« ~4 écrans mobile ») est franchi depuis
un moment. Hors périmètre de ce lot, **à tracer en dette**.

## 7. Où recueillir les accords

Les deux consentements sont **fermés par défaut et sans backfill** : sans écran
pour les saisir, la fonctionnalité entière serait morte — pire, la page aurait
annoncé « 6 speakeuses accompagnées » suivi d'aucun nom, ce qui est le maximum
du risque décrit en §6.3. Deux gestes d'orga existent donc :

| Accord | Où | Portée |
| --- | --- | --- |
| Être **nommée** sur la page « montée sur scène » | Fiche participante → *Parcours*, case fille de la phase 3 | Cette édition, cette phase |
| Être **citée** comme accompagnante | Fiche coach (liste des coachs d'un atelier → son nom) | Le compte : toutes les éditions qu'elle a animées |

Deux règles tenues côté serveur, et éprouvées :

- **Rattacher d'abord, demander ensuite.** Cocher l'accord d'une phase à
  laquelle personne n'est rattachée ne crée pas le rattachement en douce : 0
  ligne touchée, et l'écran dit « rattache d'abord la participante à cette
  phase ». Publier quelqu'un dans une cohorte où elle ne figure pas serait un
  fait inventé.
- **Décrire n'est pas publier.** Saisir le rôle et le lien d'une coach laisse sa
  fiche fermée ; l'accord a son propre interrupteur, horodaté, et ré-enregistrer
  le rôle ensuite ne le réinitialise pas.

Le `lien` d'une fiche coach s'affiche sur une page publique en cache : il est
refusé à l'écriture s'il n'est pas en http(s), **en plus** d'être dégradé au
rendu par `ExternalLink`. Une seule garde finit toujours par sauter.
