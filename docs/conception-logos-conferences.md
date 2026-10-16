# Conception : rendre visible un talk donné plusieurs fois (logos des conférences)

> Statut : **implémentée** (même PR que cette conception). Aucune migration.
> Amont : `docs/conception-talk-multi-conferences.md` (le modèle talk →
> occurrences, déjà livré) et `docs/conception-registre-conferences.md`
> (`conferences` → `conference_editions`).
> Règle d'or respectée : `docs/principes-conception-ui.md` (une page = un rôle,
> un CTA principal) — ici on ne touche qu'à l'**affichage**, aucun formulaire
> n'est ajouté nulle part.

## Le besoin

Le modèle sait déjà qu'un talk est **rejoué** (une identité, N occurrences).
L'affichage, lui, ne le montre pas : chaque occurrence tient sur **une ligne de
texte gris** d'un seul tenant,

```
Sunny Tech 2026 · Montpellier · France · juin 2026
DevFest · Toulouse · France · novembre 2025
```

et un talk donné trois fois se lit comme trois lignes interchangeables. Le
travail de la speakeuse (« ce talk, je l'ai porté sur trois scènes ») disparaît
dans un pavé uniforme.

La capture qui a déclenché ce chantier (portail d'une speakeuse, 2026-08-01 —
la même référence que `conception-talk-multi-conferences.md`) fait l'inverse :
chaque intervention est une **ligne à trois étages** — le **logo** de la
conférence, son **nom** en gras, puis `date · lieu` en gris, puis les liens de
cette fois-là. On compte les scènes d'un coup d'œil, avant même de lire.

## 1. Ce qu'on affiche

Une occurrence, sur la fiche publique comme dans l'espace :

```
[logo]  DevFest Nantes
        octobre 2025 · Nantes · France
        Slides   Vidéo
```

- **logo** : l'icône de la conférence, 44 px, sur pastille blanche arrondie (les
  logos sont dessinés pour un fond clair, ils disparaîtraient sur notre navy) ;
- **nom** : le libellé figé de l'occurrence (snapshot), en gras ;
- **date · lieu** : `formatOccurrenceDateLieu` — la date d'abord, c'est elle qui
  situe l'intervention dans une liste triée du plus récent au plus ancien ;
- **liens** : inchangés (site de la conf, slides, vidéo, feedback), toujours
  attachés à **cette** occurrence.

Le compteur discret déjà présent en tête de carte (« 3 conférences ») reste : il
dit le volume, les logos le montrent.

**Repli sans logo : un monogramme** (initiales de la conférence sur une
pastille). Une conférence sans fichier déposé n'a donc aucun trou, et l'année du
libellé figé est retirée avant de calculer les initiales (« Sunny Tech 2026 » →
`ST`, pas `S2`).

**Repli sans nom de conférence** (occurrence historique en mention libre vide) :
la ligne d'un seul tenant d'avant, sans pastille orpheline.

Où ça s'applique :

| Écran | Avant | Après |
| --- | --- | --- |
| Fiche publique d'une speakeuse (`TalkCard`) | une ligne grise par occurrence | logo + nom + date/lieu + liens |
| Page d'un talk, espace membre (`TalkConferences`) | libellé + « Modifier » | + le logo, même repère que sur la fiche |
| `/conferences` (confs & assos partenaires) | titre texte | + le logo à côté du nom |

## 2. D'où viennent les logos

**Contrainte dure : la CSP.** `next.config.ts` fixe
`img-src 'self' data: blob: *.licdn.com *.googleusercontent.com`. Pointer le
logo hébergé chez la conférence serait **bloqué** ; ouvrir la CSP pour le
permettre ferait fuiter l'**IP de chaque visiteuse** vers les sites des
conférences (traceur tiers non consenti). Donc : **logos servis par notre
domaine**, point.

D'où le dispositif :

- les fichiers vivent dans **`public/conferences/<slug>.<ext>`**, nommés d'après
  le **slug du registre** (`conferences.slug`) ;
- ils sont **déclarés** dans `src/data/logos-conferences.ts` (convention du
  repo : le contenu statique vit dans `src/data`, jamais en dur dans une page) ;
- un **test** verrouille les deux sens : un logo déclaré sans fichier (image
  morte) et un fichier non déclaré (poids mort jamais servi) échouent en CI ;
- `npm run logos:conferences` **rapatrie** les icônes publiées par les sites du
  catalogue d'amorçage (`apple-touch-icon`, `icon`, à défaut `/favicon.ico`),
  les dépose et imprime les lignes à coller. À lancer depuis un poste avec un
  accès réseau ouvert : l'environnement des agents n'atteint pas ces domaines.

**Attribution / retrait.** Ces logos appartiennent aux conférences ; on les
reproduit pour **identifier** l'événement où une speakeuse est passée. Une
conférence qui demande le retrait du sien : on supprime le fichier et sa ligne,
l'affichage retombe seul sur le monogramme. C'est écrit dans
`public/conferences/README.md` et dans l'en-tête du déclaratif.

### Pourquoi pas une colonne `logo_url` en base ?

Trois raisons : (1) une URL distante est de toute façon bloquée par la CSP, donc
la colonne ne pourrait contenir qu'un chemin local — c'est-à-dire un fichier
qu'il faut committer, donc un déploiement ; le déclaratif et le fichier
voyagent alors ensemble, et le test peut les vérifier ; (2) pas d'upload de
fichier côté orga aujourd'hui, donc rien à gagner côté saisie ; (3) une
migration pour une donnée qui suit le code, ce serait de la dette gratuite.
Si un jour l'orga téléverse des logos depuis l'admin, la colonne se posera
alors, et `ConferenceLogo` sera le seul point à changer.

## 3. Technique

- **`src/lib/initiales.ts`** : `initials` sort de `Avatar` (composant *client*)
  pour être appelable par `ConferenceLogo` (composant *serveur*). Avatar
  l'importe désormais.
- **`src/components/ConferenceLogo.tsx`** : `{ nom, slug, taille }` → logo
  déposé, sinon monogramme. Image **décorative** (`alt=""`, `aria-hidden`) : le
  nom est écrit juste à côté, l'annoncer deux fois n'apporte rien (RGAA 1.2).
  Pastille et bordure à `field-border` (contraste non textuel ≥ 3:1).
  `<img>` plutôt que `next/image` : icône locale de 44 px, parfois en SVG (que
  l'optimiseur refuse) — l'optimisation n'apporterait rien.
- **`TalkOccurrence.conferenceSlug`** : le slug arrive par **jointure**
  (`LEFT JOIN conferences c ON c.id = o.conference_id`) dans les lectures de
  `src/lib/talks.ts` ; ce n'est pas une colonne de `talk_occurrences` et rien
  n'est dénormalisé. `NULL` pour une mention libre legacy → monogramme.
- **`formatOccurrenceDateLieu`** rejoint `formatOccurrenceMeta` dans
  `src/lib/talk-date.ts` : le format d'une intervention se décide en un endroit.

## 4. Hors périmètre (assumé)

- **Logos sur la carte de l'annuaire** (`SpeakeuseCard`) : la carte met en avant
  les **titres** de talks, pas les scènes. À reconsidérer si le besoin remonte.
- **Téléversement des logos depuis l'admin** : voir § 2, pas de besoin tant que
  l'ajout reste rare (une conf entre au registre, son logo suit).
- **Redimensionnement / normalisation automatique** des icônes récupérées : le
  script télécharge, l'œil humain valide (une icône illisible en 44 px vaut
  moins qu'un monogramme).
- **Co-speakeuses** (le « Duo · … » de la capture) : toujours un autre axe, le
  modèle n'a pas de co-orateur.
