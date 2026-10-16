# Conception — Conférence : nom sans année + lieu (ville ou pays)

> Statut : **conception, à valider avant code**. Déclencheur : la conf enregistrée
> est « DevFest Toulouse 2026 » (l'année est collée au nom de la conférence). Or
> une conférence **récurrente** ne porte pas l'année : celle-ci est l'**édition**.

## Problème

`tremplin_editions` dénormalise la conférence sur chaque édition : `conf_slug`,
`conf_nom`, `conf_lien` (site), `conf_date`. Il n'y a **pas** de champ lieu, et
le nom saisi (« DevFest Toulouse 2026 ») mélange trois axes distincts :

- la **conférence** (marque) : *DevFest* ;
- le **lieu** (ville ou pays) : *Toulouse* ;
- l'**édition** (année) : *2026*.

Conséquence : créer l'édition 2027 réutiliserait une conf mal nommée, et le
sélecteur propose « DevFest Toulouse 2026 » comme s'il s'agissait de la conf.

## Ce que font les vraies conférences (recherche)

| Conf | Portée | Lieu dans l'identité | Année |
|---|---|---|---|
| DevFest Toulouse / Nantes / Lille | marque Google multi-villes | **ville** | jamais dans le nom (sous-domaine `2019.devfesttoulouse.fr`) |
| Agile Tour Toulouse / Bordeaux… | franchise multi-villes | **ville** | jamais dans le nom (chemin/sous-domaine) |
| Devoxx France / Belgium / UK | multi-**pays** | **pays** (ccTLD `devoxx.fr`) | jamais dans le nom |
| Agile on the Beach, Mix-IT, Web2day, BreizhCamp, Sunny Tech | mono-lieu | **aucun** lieu dans le nom | jamais dans le nom |

Trois constats :

1. Le lieu n'apparaît dans l'identité **que** pour les marques multi-instances
   (DevFest, Agile Tour, Devoxx). Les confs mono-lieu ne mettent pas la ville
   dans leur nom. Le discriminant est une **ville** (DevFest, Agile Tour) **ou
   un pays** (Devoxx) → un seul champ souple « ville ou pays », **jamais requis**.
2. **Aucune conf ne met l'année dans son nom ni son slug.** L'année est toujours
   un axe séparé.
3. Le slug encode marque + discriminant de lieu quand la marque récurre
   (`devfest-toulouse` vs `devfest-nantes`), jamais l'année ; il est **stocké et
   éditable** (une marque peut se renommer : DevFest Lille → DevLille).

## Décision de modèle (recommandation)

On garde la **dénormalisation** actuelle (pas de table `conferences` séparée :
peu d'éditions par conf, KISS, cohérent avec l'existant). On sépare les axes :

- `conf_nom` = **marque, sans l'année et sans le lieu** : « DevFest », « Devoxx »,
  « Mix-IT », « Agile on the Beach ».
- `conf_lieu` = **nouveau, optionnel** : ville *ou* pays (« Toulouse », « France »,
  ou vide pour Mix-IT / Agile on the Beach).
- `conf_lien` = **site** (déjà là).
- `annee` = **édition** (déjà là), jamais dans le nom.

**Nom affiché** composé par un helper pur `nomConference(confNom, confLieu)` :
`[confNom, confLieu].filter(Boolean).join(" ")` → « DevFest Toulouse »,
« Devoxx France », « Mix-IT ». Avec l'année quand l'édition est en jeu :
« DevFest Toulouse 2026 ». Une seule règle de composition, jamais de nom composé
stocké (donc pas de dérive).

**Slug** : défaut = `slugify(`${confNom} ${confLieu}`)` → `devfest-toulouse`
(au lieu de `slugify(confNom)` seul qui donnerait `devfest` et perdrait la
ville). Toujours surchargeable et gelé après création (identité d'URL publiée).

**Garde-fou** : la validation refuse une année (regex `\b(19|20)\d{2}\b`) dans
`conf_nom` → message « N'inclus pas l'année dans le nom : c'est l'édition. » Ça
empêche de recréer « DevFest Toulouse 2026 ».

## Périmètre d'implémentation (TDD)

**Base**
- `db/schema.sql` : `conf_lieu TEXT` sur `tremplin_editions`.
- `db/sync-to-latest.sql` : `ADD COLUMN IF NOT EXISTS conf_lieu TEXT` (idempotent).
- `db/migrations/028_conference_lieu.sql`.
- **Correctif données prod + pré-prod** (édition existante) :
  ```sql
  UPDATE tremplin_editions
     SET conf_nom = 'DevFest', conf_lieu = 'Toulouse'
   WHERE conf_slug = 'devfest-toulouse';
  ```

**Lib**
- `tremplin-editions.ts` : `conf_lieu` dans Edition/EditionInput/EditionUpdate/
  Row/mapRow/COLS/INSERT/UPDATE ; `ConferenceRef.confLieu` ; `listConferences`
  remonte le lieu.
- `tremplin-form.ts` : `confLieu` optionnel dans le fragment Zod ; slug défaut =
  `slugify(nom + " " + lieu)` ; garde anti-année sur `confNom`.
- Nouveau helper pur `nomConference(confNom, confLieu, annee?)` (testable, sans
  base) — dans `tremplin-statut.ts` ou un petit `tremplin-conf.ts` déjà présent.

**UI**
- `AddEditionDialog` : placeholder nom « Ex. DevFest (sans la ville ni l'année) » ;
  nouveau champ « Ville ou pays (optionnel) » (`confLieu`) ; le sélecteur de conf
  existante affiche `nomConference(...)`.
- `EditEditionDialog` : champ `confLieu` éditable (le nom l'est déjà).
- Toutes les surfaces affichant `confNom` (~10 : fiches admin, espace speakeuse,
  page publique édition, hub conf, breadcrumb, `generateMetadata`) passent par
  `nomConference(...)`.

**Seed**
- `tremplin-seed.ts` : `confNom: "DevFest"`, `confLieu: "Toulouse"`.

## Non-retenu

- **Table `conferences` normalisée** : surdimensionné (peu d'éditions/conf) ;
  la dénormalisation actuelle suffit et reste cohérente.
- **Ville + pays en deux champs** : force une mauvaise donnée pour les confs
  « ni ville ni pays » (Agile on the Beach) et les confs pays (Devoxx). Un seul
  champ souple colle au réel.
- **Composer le nom automatiquement à partir d'une marque + ville obligatoires** :
  casse les confs mono-lieu (Mix-IT n'a pas de ville). D'où lieu **optionnel** +
  composition qui ignore le vide.
