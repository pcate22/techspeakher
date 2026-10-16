# Google Ad Grants : conformité du site

> Dossier refusé au motif de la **règle relative aux sites web** :
> <https://support.google.com/nonprofits/answer/1657899?hl=fr>
>
> Le courriel de refus est le message type et **ne nomme aucun motif précis** :
> il renvoie à la règle et demande de mettre le site à jour avant de renvoyer
> la demande d'activation. Il n'y a donc rien à corriger « en face » d'un
> reproche : il faut lever chaque doute possible, ce que fait cet audit.
>
> Ce document sert deux usages : la liste des critères avec le verdict pour
> `techspeakher.fr`, et la checklist à repasser avant de redemander une revue.

## 0. Identité de référence (source : statuts et PV)

Ce que le site doit afficher **mot pour mot** comme le dossier déposé. Source :
procès-verbal de l'assemblée générale constitutive du **13 juin 2026** (livré
hors dépôt).

| Élément | Valeur |
|---|---|
| Dénomination | Tech Speak'Her |
| Forme | Association loi du 1er juillet 1901 et décret du 16 août 1901, à but non lucratif |
| Objet social (art. 5) | «&#160;Promouvoir la prise de parole publique et la représentativité des femmes dans les événements et métiers du numérique, soutenir leur développement professionnel et leur visibilité, organiser ou contribuer à toute action favorisant l'égalité dans le secteur tech.&#160;» |
| Siège social (art. 6) | 136 chemin de Lanusse, 31200 Toulouse |
| Gouvernance (art. 7) | Collégiale, collège dirigeant de cinq membres, décisions par consensus |
| N° RNA | W313042349 |
| N° SIREN | 108095993 |
| N° SIRET | 10809599300011 (NIC 00011) |

Les trois numéros sont affichés sur `/mentions-legales`, le RNA et le SIREN
aussi sur `/a-propos`, et les trois dans le JSON-LD `NGO` du `layout` sous forme
canonique (sans les espaces de lisibilité) pour qu'un outil qui recoupe le site
et un registre les retrouve tels quels. Les clés de contrôle (Luhn) du SIREN et
du SIRET sont vérifiées par `src/__tests__/identite-association.test.ts` : un
chiffre transposé casserait le rapprochement en silence.

Le **SIREN compte autant que le RNA** pour l'instruction. Le RNA est un numéro
de déclaration préfectorale, propre à la France et illisible pour un validateur
international ; le SIREN est l'immatriculation INSEE, celle qu'un tiers peut
vérifier dans un registre ouvert. Une association déclarée mais sans SIREN
affiché ressemble à une structure informelle.

**Attention aux deux dates**, qui ne désignent pas la même chose : l'assemblée
constitutive s'est tenue le **13 juin 2026**, la déclaration en préfecture (qui
porte le numéro RNA) date du **23 juin 2026**. Le site affiche la seconde, ce
qui est correct pour un numéro RNA ; le PV porte la première. Un relecteur qui
compare les deux documents doit pouvoir les réconcilier, d'où cette note.

## 1. Comment lit un relecteur Ad Grants

Le relecteur ouvre le site à froid, sans rien savoir de l'association, et
cherche à répondre à quatre questions en quelques minutes :

1. **Qui est cette organisation ?** Le site nomme-t-il l'entité juridique du
   dossier (raison sociale, forme, numéro d'enregistrement) ?
2. **Quelle est sa mission, et que fait-elle concrètement ?** Y a-t-il du
   contenu original et substantiel, ou une coquille ?
3. **Le site vit-il de sa mission, ou d'une activité commerciale ?** Vend-il
   quelque chose, affiche-t-il de la publicité, existe-t-il surtout pour
   envoyer du trafic ailleurs ?
4. **L'expérience est-elle correcte ?** HTTPS, chargement rapide, aucun lien
   rompu, aucune page « en construction ».

Tout ce qui suit se ramène à ces quatre questions. Un refus est prononcé sur
un doute, pas sur une preuve : l'enjeu est de lever le doute, pas de plaider.

## 2. Critères et verdict pour techspeakher.fr

| # | Critère de la règle | Verdict | Détail |
|---|---|---|---|
| 1 | **Propriété du domaine** : l'association contrôle le domaine des URL de destination | ✅ | `techspeakher.fr`, domaine propre, déploiement Vercel maîtrisé, et **vérifié** via l'adresse propriétaire du dossier Google pour les associations. |
| 2 | **HTTPS** sur tout le site | ✅ | Vercel force le TLS. Aucune ressource en clair. |
| 3 | **Description détaillée de l'organisation, de sa mission et de ses activités** | ⚠️ → ✅ | La mission et les activités étaient bien décrites (`/a-propos`, `/tremplin`, `/actualites`), mais **l'entité juridique n'apparaissait que dans les mentions légales**, page mise en `noindex`. Corrigé : section « L'association » sur `/a-propos`, mentions légales indexables. |
| 4 | **Contenu original**, propre à l'association | ✅ | Articles, récits de Tremplin, verbatims, annuaire des speakeuses : tout est produit par l'association. Aucun contenu syndiqué. |
| 5 | **Aucune publicité commerciale tierce** (AdSense, régie, affiliation) | ✅ | Aucun script publicitaire. Mesure d'audience Vercel Analytics, sans cookie ni traceur. |
| 6 | **Activité commerciale limitée et au service de la mission** | ⚠️ → ✅ | Deux points de friction levés dans ce lot : le pitch sponsors promettait un emplacement de logo sur le site (lecture possible : vente d'espace publicitaire), et `/devfest-toulouse` avait pour action principale l'achat d'un billet sur une billetterie tierce. Voir §3. |
| 7 | **Le site n'existe pas surtout pour envoyer du trafic ailleurs** | ⚠️ → ✅ | Mesuré page par page sur un build de production, pas estimé à l'œil (§3). `/partenaires` sortait à **82 %** de ses liens : chaque carte n'avait qu'une action, quitter le site. Les liens de sponsors portent désormais `rel="sponsored"`, les cartes liées au jury mènent aussi chez nous, et chaque carte de `/conferences` renvoie à l'agenda. `/agenda` n'a aucun lien sortant propre. |
| 8 | **Aucun lien rompu, aucune page en construction** | ⚠️ → ✅ côté code | Le crawl du build de production ne trouve **aucun lien interne cassé** sur 25 pages. Deux points traités : `/conferences` affichait « la liste arrive bientôt », soit une page en construction (§3), et deux pages du parcours Tremplin renvoient 500 au lieu de dégrader (§4.3). Les liens **sortants** restent à vérifier depuis une machine qui atteint la prod (§5). |
| 9 | **Dons** : page dédiée, sécurisée, fonctionnelle, avec l'usage des fonds | n/a | Le site ne collecte aucun don aujourd'hui. Les adhésions HelloAsso prévues en septembre feront rentrer ce critère : page dédiée, HTTPS, et une phrase sur ce que finance l'adhésion. |
| 10 | **Contenu prohibé** (adulte, jeu d'argent, politique partisane…) | ✅ | Rien de tel. Code de conduite public. |

## 3. Ce que ce lot corrige

**Identité juridique visible et indexable.** Un relecteur, comme le crawler,
doit pouvoir rapprocher le site du dossier déposé sans chercher.

- `/a-propos` gagne une section « L'association » : forme juridique
  (association loi 1901), date de déclaration, numéro RNA, siège complet,
  objet social statutaire cité mot pour mot, but non lucratif, gouvernance
  collégiale, activités, et d'où vient l'argent. La gouvernance y figure
  parce qu'un relecteur qui cherche une présidente ou une trésorière n'en
  trouvera pas : l'association est collégiale par statuts.
- `/mentions-legales` passe en indexable (le `noindex` cachait la seule page
  qui portait le RNA), et porte le siège social complet ainsi que l'objet
  social cité mot pour mot d'après les statuts.
- Le JSON-LD `NGO` du `layout` portait déjà `identifier: RNA`. Il devient
  cohérent avec ce qui est écrit dans la page, ce qui compte davantage.

**Mots collés au rendu, corrigés et sous garde-fou.** La relecture visuelle des
pages touchées a montré « meetupset rencontres » et « annuaire publicde
speakeuses » : en JSX, un texte qui suit un élément en ligne et se poursuit à la
ligne d'après perd son espace de tête à la compilation. L'espace EST dans la
source, donc ni le type-check, ni ESLint, ni le test d'orthographe (qui lit des
littéraux) ne le voient. `e2e/mots-colles.spec.ts` teste la cause en vrai
navigateur, sur onze pages publiques ; il a révélé quatre défauts de plus,
antérieurs à ce lot (`/devfest-toulouse`, `/mentions-legales`,
`/code-de-conduite`), tous corrigés. Le remède en source est un `{" "}`
explicite, déjà la convention ailleurs dans le dépôt.

**Une page en construction, supprimée.** `/conferences` affichait « La liste
arrive bientôt » dès que la requête ne renvoyait rien, et la « page Partenaires »
qu'elle citait n'était même pas un lien. Une page en construction est
explicitement proscrite par la règle, et c'est ce qu'un relecteur voit si la
base a un raté. L'état vide dit désormais à quoi sert la page et mène à
`/agenda` et `/partenaires`. Le sous-titre a suivi : il décrivait la mécanique
du site (« la liste se construit toute seule à partir de nos talks »), il décrit
maintenant ce que le visiteur y trouve.

**Trafic sortant : mesuré, puis rééquilibré.** Plutôt que d'estimer à l'œil, la
part de liens sortants a été comptée page par page sur un build de production :

| Page | Sortants / total | Lecture |
|---|---|---|
| `/partenaires` | **9 / 11 (82 %)** | le vrai problème : chaque carte n'avait qu'une action, quitter le site |
| `/devfest-toulouse` | 7 / 12 (58 %) | six sont les profils LinkedIn de nos speakeuses : éditorial, légitime |
| `/mentions-legales` | 6 / 14 (43 %) | hébergeurs et sous-traitants, exigés par la loi |
| `/agenda` | **0** | ses actions sont déjà internes |
| `/conferences` | non mesurable en local | ses cartes viennent de la base, vide hors production |

Trois corrections en découlent. Les liens de sponsors portent `rel="sponsored"`,
la divulgation que Google demande pour un lien obtenu en contrepartie d'un
soutien : elle dit « ce lien vient d'un mécène » là où l'absence de `rel`
laissait planer « nous vendons des liens ». Les cartes d'écosystème dont le lien
passe par notre jury mènent aussi vers `/tremplin#jury-title`. Et le décompte
« N évènements avec nous » de chaque carte de `/conferences` devient un lien
vers l'agenda, pour que la carte ait une destination chez nous.

Un choix à garder en tête : `/tremplin/{slug}` aurait été plus précis que
`/agenda` sur les cartes de conférence, mais ce hub n'existe que pour les
conférences ayant une édition de Tremplin. Le lien aurait cassé sur les autres,
ce qui aurait échangé un problème de critère 7 contre un problème de critère 8.

**Signaux commerciaux désamorcés.**

- `/partenaires` : « Votre logo sur nos supports, notre site et nos
  événements. On touche un public tech qui s'intéresse vraiment » se lisait
  comme une offre d'espace publicitaire tarifée. Reformulé en remerciement
  d'un soutien, avec la mention explicite du but non lucratif et de la
  destination des soutiens.
- `/devfest-toulouse` : la billetterie tierce (BilletWeb) **quitte la page**.
  Ses deux actions sont désormais internes (le programme des speakeuses, le
  Tremplin), et le bloc `Offer` du JSON-LD disparaît : annoncer une offre
  `InStock` sur notre domaine revenait à déclarer, en lisible par machine, que
  nous vendons l'entrée d'un évènement organisé par un tiers. GDG Toulouse
  reste crédité comme organisateur, ce qui suffit à situer l'évènement. La
  page informe sans servir de vitrine de vente.

## 3 bis. Ce que le contenu réel a révélé (après le deuxième refus)

Les trois premiers lots ont été audités **sur le code source**. C'était un angle
mort : la moitié des pages publiques est alimentée par la base (annuaire, fiches,
agenda, éditions du Tremplin), et cette moitié-là n'avait jamais été lue. Une
lecture des pages rendues en production a sorti quatre choses, dont aucune
n'était visible dans le dépôt.

**L'annuaire se lisait comme une place de marché.** Mis bout à bout, « speakeuses
disponibles partout en France », les filtres (secteurs, sujets, langues, zone
d'intervention), le bouton « Contacter » et l'appel « vous cherchez des
intervenantes ? » décrivent une mise en relation entre une offre et une demande.
C'est-à-dire du placement et de la génération de contacts pour des tiers, deux
motifs d'inéligibilité. Ce qui se passe réellement, c'est que des speakeuses
donnent du temps aux suivantes : la phrase de contexte de `/speakeuses` le dit
maintenant, et les descriptions (meta, OpenGraph, JSON-LD) perdent le vocabulaire
de disponibilité.

**Les liens sortants saisis par les utilisatrices n'étaient pas divulgués.** Site
perso, LinkedIn, Sessionize d'une speakeuse, « Site » d'une finaliste, lien d'une
accompagnante : autant de destinations que l'association n'a ni choisies ni
relues, et qui mènent souvent à une activité indépendante. Elles partent
désormais en `rel="ugc nofollow"` (prop `ugc` sur `ExternalLink` et `Button`).
Les liens **éditoriaux**, eux, restent suivis : la divulgation vise ce qu'on n'a
pas choisi, et un lien de partenaire garde sa valeur.

**Deux des trois « sponsors » étaient les sociétés d'une fondatrice.** bttrways
et Montaine Consulting appartiennent à Montaine Marteau. Rangées sous
« Sponsors », elles donnaient à voir une association qui met en avant les
entreprises de ses dirigeantes. C'est aussi un contresens de fond : personne ne
sponsorise, une fondatrice paie le Notion et prête sa visio. Elles **quittent la
page**, et la place revient à celles qui animent les ateliers du Tremplin
(`listAccompagnantesPubliques`, gardée par le double consentement déjà en place :
fiche coach publique + atelier au programme public). Déclarer un lien d'intérêt
aurait suffi à lever l'ambiguïté ; ne plus en avoir vaut mieux, et ce que
l'association reçoit vraiment, c'est du temps.

**Les bios sont du contenu d'utilisatrices.** Plusieurs contiennent une offre de
prestation (« Fractional CPO/CPTO », « freelance spécialisée en… », « elle
accompagne les transformations qui mêlent innovation, stratégie et dynamique
humaine »). Les réécrire une fois ne tient pas : elles reviendront à la
prochaine édition de fiche. L'action est donc **à la saisie**, par une phrase
d'aide sous le champ `bio` de `/mon-espace` qui oriente vers le parcours. Les
bios déjà en ligne restent celles de leurs autrices.

Leçon de méthode : sur un site dont le contenu vient de la base, **auditer le
dépôt ne suffit pas**. Les prochaines revues doivent partir des pages servies.

## 4. Ce qui reste à faire hors du code

Ces points ne sont pas dans le dépôt et conditionnent l'activation autant que
le site lui-même.

1. ~~**Validation du domaine.**~~ **Fait.** `techspeakher.fr` est vérifié via
   l'adresse propriétaire du dossier Google pour les associations. C'était le
   motif de refus le plus probable, et le plus trompeur : il cite la règle
   relative aux sites web alors qu'il n'y a rien à corriger dans le contenu.
   La case est cochée, et elle l'est sous le **bon compte** — c'est la
   condition qui compte, une vérification faite depuis un autre compte Google
   ne servirait à rien.
2. **Cohérence dossier / site.** Le nom, la forme juridique, l'adresse et le
   numéro d'enregistrement transmis à Google pour les associations (validation
   via Goodstack/Percent) doivent être **mot pour mot** ceux du §0. Un écart
   d'orthographe sur la dénomination ou une adresse absente suffit à faire
   échouer le rapprochement. C'était le point faible avant ce lot : le site
   n'affichait **aucune** adresse, et le RNA vivait sur une page `noindex`.
3. **Liens sortants en prod.** Le crawl des liens **internes** est fait et vert
   (25 pages, aucun cassé). Restent les 18 hôtes externes, qu'aucune session
   d'ici ne peut atteindre : `npx linkinator https://techspeakher.fr --recurse
   --skip "linkedin.com|licdn.com|googleusercontent.com"`. Les huit sites de
   partenaires sont les plus susceptibles d'avoir bougé.
4. **Deux pages qui plantaient au lieu de dégrader.** *Sorties du chemin
   chaud, pas rendues résilientes* — la nuance compte, et la première rédaction
   de ce point la gommait.

   `/tremplin/[conf]/[annee]` était rendue à la demande : le premier visiteur
   après un déploiement interrogeait la base sur le chemin chaud, et un réveil
   de Neon raté lui servait un 500, sur le parcours vers lequel pointeraient les
   annonces. Elle est désormais **pré-rendue** au build, et l'ISR la rafraîchit
   en arrière-plan ; un échec de revalidation ressert la page précédente au lieu
   d'une erreur.

   En dessous, `src/lib/db.ts` reprend l'**acquisition de connexion**, et elle
   seule. La sûreté vient de cet endroit, pas d'une liste de codes : `pool.query`
   reprend un client inactif quand il y en a un, et si cette socket meurt en vol,
   `pg` rejette l'instruction avec un `ECONNRESET` brut. Envelopper l'appel
   entier rejouerait donc un `INSERT` déjà commité. On laisse aussi `pool.query`
   à `pg-pool`, qui pose sur le client sorti du pot l'écouteur `'error'` sans
   lequel une socket morte lève une exception non rattrapée — un crash au lieu
   d'un 500. Les délais ne sont pas rejoués : cinq secondes d'attente prouvent
   déjà que l'hôte ne répond pas, et les rejouer porterait le pire cas à ~16 s,
   soit une dégradation plus lente que le délai lui-même.

   **Des deux correctifs, c'est la reprise qui est générale** : elle couvre les
   routes restées dynamiques, les Server Actions et les crons. Le pré-rendu est
   le correctif étroit, limité aux paramètres connus au build.

   **Ce que ce lot ne fait pas, et qu'il faut savoir :**
   - une édition **fraîchement publiée** n'est pas dans la liste gelée au build :
     elle reste rendue à la demande jusqu'au déploiement suivant, donc exposée ;
   - la sous-page « montée sur scène » reste volontairement dynamique : elle
     `notFound()` quand l'édition n'a pas de chapitre, et déterminer lesquelles
     qualifient coûte ce que le pré-rendu voulait économiser (mesuré : une page
     pré-rendue sur deux était un 404, à une douzaine de requêtes pièce) ;
   - **le pré-rendu déplace une panne** : une base injoignable *pendant* le
     rendu des pages fait maintenant **échouer le build** (vérifié : `next build`
     sort en 1), là où elle passait inaperçue. Le `try/catch` ne protège que le
     listage, pas le rendu. C'est un compromis assumé — la reprise le rend
     improbable — mais il est réel, et c'est le prix du pré-rendu.

   `notFound()` a été écarté : il dirait « cette page n'existe pas » pour
   quelque chose de momentanément indisponible, et inviterait Google à
   désindexer une page réelle.

> **2026-10-15 — `/partenaires` en landing.** L'action principale est un
> **don** à l'association elle-même (campagne HelloAsso « membres
> bienfaitrices », 100 € minimum, cité dans la FAQ « à partir de quel
> montant »). Ce n'est pas la billetterie tierce reprochée à `/devfest-toulouse` :
> l'argent va à l'association, et la page dit où il va (événements,
> accompagnement). Le bloc des contreparties s'appelle « Pourquoi nous
> soutenir » et parle de remerciement au titre du mécénat, jamais d'espace
> vendu. À relire si un examen re-signale la page.

## 4 bis. L'adhésion, porte d'entrée de la plateforme

**La règle.** L'adhésion à l'association et l'acceptation de son règlement
intérieur ouvrent l'accès à la plateforme et à ses services (fiche d'annuaire,
agenda, accompagnement). L'adhésion passe par HelloAsso.

> **Mis à jour le 2026-10-15** : le texte de `/adherer` validé le 13/10 affiche
> les tarifs (10 € par an, gratuité sur déclaration, membres bienfaitrices
> à partir de 100 €). Le paragraphe ci-dessous décrit le choix d'avant ; reste
> à ajouter sur `/adherer` une phrase sur ce que finance l'adhésion (critère 9).

**Le site reste muet sur les montants, et c'est tenable.** Un montant vit là où
l'on s'engage : le formulaire HelloAsso l'affiche avant tout paiement, ce qui
satisfait l'information précontractuelle. Une page « à propos » qui détaille une
grille tarifaire ferait, elle, exactement le signal commercial qu'on cherche à
retirer du site.

**Le silence, oui ; une promesse fausse, non.** Trois textes affirmaient la
gratuité et devenaient faux avec ce modèle. Ils ont été corrigés :

- `/a-propos` disait « Tout est **gratuit** pour les femmes qui participent » ;
  la page énonce désormais la règle d'adhésion. Une page qui promet l'inverse du
  bulletin se retourne contre l'association, devant un examinateur comme devant
  une adhérente.
- `/partenaires` disait « la participation reste **gratuite** pour les femmes
  accompagnées ». La phrase garde ce qui reste vrai : chaque soutien va aux
  événements et à l'accompagnement.
- `src/lib/invitation-email.ts` promettait « (l'adhésion est **gratuite**) » aux
  speakeuses dont la fiche a été migrée. C'était le plus exposé des trois : un
  engagement écrit, envoyé nominativement, à des personnes qu'on invite ensuite
  à payer. La parenthèse est retirée.

**Côté Google, le modèle passe.** Une cotisation est une ressource associative
prévue par la loi de 1901, pas une vente. La règle Ad Grants demande que
l'activité commerciale reste **secondaire** et que le site dise **où va
l'argent** : `/a-propos` et `/partenaires` disent tous deux que les ressources
reçues financent les événements et l'accompagnement, sans citer de montant.

**Le point à surveiller.** Les annonces mèneront vers `/speakeuses` et la
plateforme. Si le parcours « je veux ma fiche » débouche sur une adhésion, la
condition doit se lire **avant** le formulaire de connexion, pas après. C'est le
seul endroit où le silence deviendrait trompeur.

## 5. Checklist avant de redemander une revue

- [x] Adresse du siège et objet social affichés (`/mentions-legales`, `/a-propos`)
- [x] Domaine validé (adresse propriétaire du dossier Google pour les associations)
- [ ] Dénomination, adresse et n° RNA identiques entre le dossier et le §0
- [ ] Aucun lien rompu en prod : passer un crawler sur `https://techspeakher.fr`
      (`npx linkinator https://techspeakher.fr --recurse`), y compris les liens
      sortants de `/conferences`, `/partenaires` et `/agenda`
- [ ] Aucune page vide ou « bientôt » atteignable depuis la navigation
- [ ] `/mentions-legales` et `/a-propos` indexées (Search Console → Inspection
      d'URL)
- [ ] Sitemap soumis, `robots.txt` ouvert (déjà le cas)
- [ ] **Renvoyer la demande d'activation** — le refus le demande explicitement,
      rien ne se relance tout seul une fois le site corrigé

## 6. Après l'activation

Le site ouvre la porte ; le compte se garde ensuite avec les
[règles de gestion du compte](https://support.google.com/nonprofits/answer/117827?hl=fr),
qui suspendent sans préavis :

- **CTR de 5 % minimum** par mois sur l'ensemble du compte (deux mois
  consécutifs sous la barre = suspension)
- **Aucun mot clé d'un seul mot** ni mot clé trop générique
- **Score de qualité** : pas de mot clé sous 3
- **Ciblage géographique** renseigné (Toulouse / Occitanie / France selon les
  campagnes)
- **Au moins 2 groupes d'annonces par campagne, 2 annonces par groupe**, et
  **2 extensions de lien annexe** au minimum
- **Enchères** : maximiser les conversions (le CPC manuel plafonne à 2 $)
- Une **connexion par mois**, et une revue du compte tous les 90 jours
- Un **suivi des conversions** valide et actif

Concrètement, pour ce site : les conversions à déclarer sont la création de
fiche speakeuse, la candidature au Tremplin et l'inscription à la lettre
d'information. Les campagnes évidentes suivent les pages qui portent déjà du
contenu propre : Tremplin, annuaire, articles « Behind the Scenes ».
