# Audit UX/UI mobile — Tremplin (2026-07-30)

> Audit exigeant mené sur **écrans réels** : app montée en local (Postgres +
> `seed-preview.sql` enrichi phase 3), sessions orga et participante forgées,
> 14 écrans capturés au format iPhone (393 px) sur les parcours public, orga et
> participante. Concerne la branche `claude/devfest-2026-coaching-cjzpsf`
> (PR #247, sous-groupes « version riche ») et quelques acquis antérieurs.
>
> Grille : hiérarchie de l'info, charge cognitive, wording
> (`principes-conception-ui.md`), RGAA/COGA, ergonomie tactile, cohérence
> inter-écrans. Priorités : **P0** (l'écran ment ou piège), **P1** (le système
> se contredit), **P2** (polish).

## Verdict d'ensemble

La **structure** est saine : hub-and-spoke respecté (hub édition → domaines →
fiches), un CTA primaire par page, wording majoritairement positif, timeline
« Parcours » de la fiche participante réussie. La faiblesse n'est pas la
structure : c'est que **les faits simples du planning (fenêtre de dates, lieu)
n'atteignent jamais les surfaces de lecture**, et que les écrans hérités
ignorent la **nature** d'un atelier. Le modèle sait ; l'affichage tait ou
contredit. C'est la source directe du ressenti « ça devient compliqué ».

## P0 — l'écran ment ou piège

### 1. La fenêtre de dates est invisible partout en lecture

Une activité « entre le 7 et le 13 septembre » s'affiche comme un rendez-vous
« le 7 septembre » sur TOUTES les surfaces de lecture :

| Surface | Affiché | Attendu |
| --- | --- | --- |
| Liste ateliers (admin) | pastille « LUN 7 SEPT » | « 7 → 13 sept. » |
| Sommaire atelier (admin) | « 7 sept. 2026 » | fenêtre |
| Programme espace participante | « lun. 7 sept. 2026 » | fenêtre |
| Agenda « À venir » (mon espace) | « 7 sept. » | fenêtre |
| Page publique (DTO `PublicAtelier`) | « 7 sept. 2026 » | fenêtre |

Seuls le formulaire « Informations » et la carte « Mes sous-groupes » disent la
vérité. **Une info trompeuse est pire qu'une info absente** : une participante
croit à un rendez-vous le lundi 7.
→ Correctif : un composant unique de période (« 7 → 13 sept. » / « semaine du
7 sept. »), utilisé par la pastille agenda, les métas d'atelier, l'agenda et le
DTO public (ajouter `dateFin` au DTO).

### 2. Le lieu physique est invisible partout en lecture

Raison d'être n° 1 de la demande (« on a besoin du lieu physique »), saisi au
formulaire… et affiché nulle part : ni le programme participante, ni l'agenda
« À venir », ni le sommaire atelier, ni la page publique ne le montrent. Une
participante ne sait pas OÙ se tient le présentiel du 1ᵉʳ septembre.
→ Correctif : `lieu` dans la méta d'atelier (espace, sommaire), à côté de
« Rejoindre la visio ». **Révisé le 2026-08-01 : plus côté public** — publier OÙ
et QUAND se retrouve un petit groupe identifiable n'a pas sa place sur une page
indexée. Le lieu vit dans l'espace des inscrites et de leurs coachs ; la page
publique garde celui de la finale, qui concerne tout le monde.

### 3. « Marquer comme fait » sans date = faux succès

Espace participante, carte sous-groupe : le bouton « Marquer comme fait » est
actif avec le champ date vide. Or date vide → l'action enregistre NULL
(= pas fait) et affiche « C'est noté, merci. ». Sur téléphone, le cas est
probable : **succès affiché, rien d'enregistré**.
→ Correctif : date du jour par défaut (le bouton « Marquer comme fait » pose
aujourd'hui ; l'input ne sert qu'à corriger), ou refus explicite si vide.

## P1 — le système se contredit

### 4. Le sommaire d'un atelier « en sous-groupes » parle encore présences

Carte « Participantes et présences · 3 présences à pointer » (orange) sur un
atelier où la présence ne se pointe plus → **alerte fausse et insoldable, à
vie**. S'y ajoutent « Coachs · À trouver » (une revue croisée autonome n'a pas
besoin de coach d'atelier) et « Lien de connexion · À ajouter » (le lien vit
par sous-groupe pour cette nature) : trois urgences oranges non pertinentes.
→ Correctif : le sommaire s'adapte à la nature — carte « Participantes et
sous-groupes · N sous-groupes · M réalisés », to-dos coachs/visio non alarmants
pour cette nature.

### 5. Fiche participante : « NON POINTÉE » permanent sur les activités en sous-groupes

Même cause que #4, sur la timeline du parcours : les activités en sous-groupes
affichent un badge présence qui ne sera jamais soldé. Devrait afficher la
réalisation (« fait le … » / « à faire ») — et au passage la forme positive
(« À pointer », jamais « NON POINTÉE »).

### 6. Sélecteur « Coach » du sous-groupe : contrôle cul-de-sac

La liste ne propose que les coachs déjà reliés à L'ATELIER. Si aucun :
« Aucune (autonome) » est la seule option, sans explication ni chemin. La
dépendance (relier d'abord un coach à l'atelier) est invisible.
→ Correctif : proposer tous les comptes coachs de l'édition, ou une aide sous
le champ « Ajoute d'abord une coach à l'atelier » avec lien.

### 7. Espace participante : la même activité apparaît deux fois, avec deux dates

« Revue croisée (1) » figure dans « Le programme » (datée « lun. 7 sept. ») ET
dans « Mes sous-groupes » (datée « entre le 7 et le 13 »). Duplication +
contradiction = la vraie origine du ressenti « super compliqué ».
→ Correctif : UNE entrée par activité. La carte programme d'un atelier en
sous-groupes porte la fenêtre, le binôme, le lien et « fait le … » (fusion des
deux sections), ou « Mes sous-groupes » disparaît au profit du programme enrichi.

### 8. Wording du point individuel : « Tu es seule dans ce sous-groupe pour l'instant »

Sur un 1-1 avec coach, ce texte laisse croire qu'il manque quelqu'un. Dire ce
qui EST : « En tête-à-tête avec ta coach Sofia Nguyen ».

### 9. Titres d'ateliers tronqués : l'identité disparaît

« Revue croisée entre speake… », « Point individuel avec ta coa… » : le
numéro (1)/(2) qui distingue deux séances jumelles est coupé sur 393 px
(liste ateliers, fiche participante, agenda). Avec 10 ateliers de phase 3,
plusieurs lignes deviennent indistinguables.
→ Correctif : autoriser 2 lignes de titre dans les listes (le fil d'Ariane l'a
déjà fait, cf. #234) — et bannir la troncature d'un caractère distinctif.

## P2 — polish

10. **« Effacer » répétés** : jusqu'à 5 liens identiques empilés sur le
    formulaire Informations (§6 du registre). Préférer un ✕ DANS le champ.
11. **« Supprimer le sous-groupe » en cyan** : couleur d'action sûre pour un
    geste destructif ; le palier 2 est orange discret (§10).
12. **Option Nature tronquée** dans le select fermé (« En sous-groupes (revue
    croisée, points indivi… ») : libellé court (« En sous-groupes ») +
    explication en aide sous le champ.
13. **Dates ISO brutes** (« 2026-09-07 ») sur les cartes parcours de la fiche
    participante, là où tout le reste affiche « 7 sept. 2026 ».
14. **Fil d'Ariane** : le maillon courant se tronque à une lettre (« … › P. »)
    sur les titres longs — le fil ne dit plus où on est (le H1 compense).
15. **Affordances d'ajout incohérentes** : « + Ajouter une participante »
    (texte cyan) vs « Ajouter un atelier / un sous-groupe » (magenta plein)
    pour la même classe d'action.
16. **Avertissement React réel** (console) : « A props object containing a
    "key" prop is being spread into JSX » sur les pages à `InlineActionForm`
    (le `key` doit être passé à part, pas dans le spread des props de champ).
17. **Sous-titres à rallonge** : « réservé (3) : Léa Dubois, Yasmine Roche,
    Manon Girard · coach : … » — à borner (« réservé (12) : Léa, Yasmine, +10 »).

## Ce qui est bon (à préserver)

- Hub édition : état + « à faire » + domaines, propre et scannable.
- Liste des sous-groupes post-refonte : consultation pure, un CTA, sous-titres
  d'état (« autonome · à faire ») — conforme à la règle d'or.
- Timeline « Parcours » de la fiche participante (Avant / Soirée / Après).
- Légende des badges sous la liste des participantes.
- Un seul CTA magenta par écran, respecté partout.
- Wording globalement positif et nominatif.

## Méthode (reproductible)

Postgres 16 local (`initdb` + port 5433), `db/sync-to-latest.sql` +
`db/seed-preview.sql` (+ ateliers phase 3 dont 2 « en sous-groupes »),
`.env.local` (AUTH_SECRET local), sessions JWT forgées via `@auth/core/jwt`
(orga + participante), captures Playwright plein-page 393×852 @2x. Erreurs
console vérifiées (2 artefacts dev à ignorer : CSP `eval`/`va.vercel-scripts` ;
1 avertissement React réel, cf. P2 #16).
