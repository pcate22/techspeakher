# Relancer les fiches en sommeil

> Doc de conception du geste « relancer une speakeuse dont la fiche dort ».
> Principes d'écran appliqués : `docs/principes-conception-ui.md`.
> Principes de test appliqués : `docs/principes-tests.md`.
>
> Écrit le **2026-08-14**.

## Le problème

Des speakeuses créent un compte, commencent leur fiche, et s'arrêtent. La fiche
reste en `brouillon`, donc **invisible de tout le monde** : elle ne paraît pas
dans l'annuaire, et elle n'entre dans aucune file de modération. Personne ne
sait qu'elle existe, ni côté orga (la liste `/admin/speakeuses` a bien un onglet
« Brouillon », mais sans notion d'ancienneté) ni côté speakeuse (elle a peut-être
oublié qu'elle avait commencé).

Le seul rappel automatique de la plateforme (cron quotidien, `rappel_fiche_jours`,
défaut 180) ne vise que `status = 'publie'` : **un brouillon ne reçoit jamais
rien**. C'est exactement la population qui aurait besoin d'un mot.

## Ce qu'on livre

Deux surfaces pour un seul geste, plus le moyen de le voir venir.

| Surface | Rôle | CTA |
|---|---|---|
| `/admin/speakeuses/relances` | La liste de celles dont la fiche dort | **Relancer les N** |
| Fiche en vue orga (`/speakeuses/[id]`) | Le geste dans le contexte d'UNE personne | **Relancer** |
| « À faire » du tableau de bord | Signaler qu'il y a des fiches en sommeil | (lien) |

**Page dédiée, pas un bloc de plus sur `/admin/speakeuses`.** La liste des fiches
est une page de **consultation** ; y empiler un second CTA groupé la ferait
basculer dans l'erreur du § 1 (hub-and-spoke). `/admin/speakeuses` porte donc une
**rangée** vers la page de relance, visible seulement quand il y a matière.

## Qui est « en sommeil »

Le lot groupé vise une population volontairement étroite :

- `status = 'brouillon'` — une fiche soumise attend une orga, pas une relance ;
  une fiche refusée a déjà reçu un motif, c'est une autre conversation ;
- `updated_at` plus vieux que `relance_brouillon_jours` (nouveau réglage,
  **défaut 30 jours**, modifiable dans `/admin/reglages`) ;
- **jamais relancée dans la même fenêtre** (`last_reminder_at`) ;
- **joignable** : une adresse existe, et elle ne porte pas le suffixe `.invalid`
  des comptes de migration sans e-mail ;
- **hors cohorte de migration en attente d'invitation** (`migrated = true` et
  `invited_at IS NULL`). Ces fiches ont été pré-remplies **par l'association** :
  leur premier courrier doit être l'invitation « tu as la main sur ta fiche »,
  pas une relance qui parlerait d'un brouillon dont la personne ignore
  l'existence.

`last_reminder_at` est **réutilisée**, pas doublée : elle veut dire « dernier
rappel envoyé à cette fiche », que la fiche soit publiée (rappel semestriel) ou
en brouillon (relance). Une seule colonne, une seule question — et donc aucune
chance qu'une speakeuse reçoive deux rappels le même jour depuis deux compteurs.
Aucune migration : les deux colonnes utilisées (`last_reminder_at`, `updated_at`)
existent déjà, et le nouveau délai vit dans la table clé-valeur des réglages.

### « Sans changement » veut dire sans AUCUN changement

`updated_at` ne bougeait que sur une écriture du profil : quelqu'un qui ajoutait
des talks sans toucher à son identité était compté endormi. On aurait relancé,
avec « ta fiche attend encore un peu de toi », la personne la plus active de la
semaine. Les écritures de talks et d'occurrences réveillent donc maintenant la
fiche (`toucherFiche`, dans `src/lib/talks.ts`), ce qui rend aussi le rappel
semestriel plus juste — son texte demande justement d'ajouter ses dates de talk.

### Deux lectures pour une seule règle

`getProfilesEnSommeil` rend les fiches COMPLÈTES (l'e-mail a besoin du profil, du
compte de talks et de l'adresse) ; `getProfilesEnSommeilBrefs` rend un id et un
nom, pour le compteur de `/admin/speakeuses` et la tâche du tableau de bord. Les
deux partagent le même fragment de `WHERE`, et un test d'intégration vérifie
qu'elles désignent exactement les mêmes personnes : un tableau de bord qui
annonce un nombre introuvable sur la page de relance serait pire que muet.

## Le geste individuel a sa propre règle

Depuis la fiche, l'orga **voit** la personne : elle décide. Le bouton
« Relancer » ignore donc le critère d'ancienneté (une fiche de trois jours peut
mériter un mot après un échange en meetup) mais **garde tous les autres**
(brouillon, joignable, hors cohorte d'invitation, pas déjà relancée dans la
fenêtre).

Cette règle vit **dans la clause `WHERE` de `getFicheARelancer`**, pas dans un
`if` de l'action : `docs/principes-tests.md` § 4 — une écriture bornée en SQL ne
s'oublie pas dans une branche. L'affichage du bouton, lui, n'est qu'un indice ;
si l'écran et la base divergent, l'action répond « déjà relancée » au lieu
d'envoyer un doublon. La faute possible est un bouton inutile, jamais un e-mail
de trop.

## L'e-mail dit ce qu'il reste à faire

Un « pense à ta fiche » générique se classe sans être lu. La relance liste donc
**les chantiers qui restent** (« Prénom et nom », « Un talk ou une proposition de
sujet », « Attestation »…), tirés de `espaceChecklist` — **la même source** que la
checklist de `/mon-espace`. L'e-mail et l'écran d'arrivée disent ainsi toujours la
même chose : deux listes séparées auraient dérivé au premier chantier ajouté.

Deux e-mails possibles, selon ce que la personne a déjà fait :

- **il reste des chantiers** → « il reste N étapes », suivies de la liste ;
- **tout est rempli, rien n'a été soumis** → « ta fiche est prête », un seul geste
  à faire (le bouton « Soumettre »). C'est le cas le plus rentable : la fiche
  existe déjà, elle est à un clic de l'annuaire.

## Ce qu'on ne fait PAS (et pourquoi)

**Aucun envoi automatique.** Le cron aurait pu prendre les brouillons en sommeil
comme il prend les fiches publiées. On garde le geste **à la main de l'orga**,
pour deux raisons : la population est petite (on peut la lire avant d'écrire), et
une relance de brouillon touche des personnes qui n'ont **rien demandé** — se
tromper de ton s'y paie plus cher qu'ailleurs. Si le geste devient routinier, le
basculer dans le cron sera une évolution de deux lignes : la sélection et
l'e-mail sont déjà des fonctions autonomes, exactement comme le rappel semestriel.

**Aucun lot marqué à la fin.** Chaque fiche est horodatée juste après SON envoi,
et non toutes ensemble à la sortie de la boucle : une fonction serveur peut être
coupée en cours de route, et un marquage groupé perdrait alors la trace de tout
ce qui est déjà parti. Le rejeu écrirait une deuxième fois aux mêmes personnes.

**Aucune case à cocher.** Le lot prend toute la liste affichée, avec confirmation
chiffrée. Pour épargner quelqu'un, l'orga la relance individuellement depuis sa
fiche : elle sort alors du lot pour toute la fenêtre. La granularité existe donc
sans peser sur l'écran commun.

**Aucune fiche refusée.** Une fiche refusée a reçu un motif ; la relancer avec
« il te reste 3 étapes » ignorerait cet échange. Piste ouverte si le besoin se
présente, avec un autre texte.

## RGPD

La relance est un e-mail de **service**, lié au compte de la personne et à un
objet qu'elle a elle-même créé — au même titre que le rappel semestriel ou une
décision de modération. Elle est donc indépendante du désabonnement à la lettre
d'information (`newsletter_optout_at`), qui ne coupe jamais le service (cf.
`db/schema.sql`, migration 057, et `docs/conception-synchro-contacts.md`). Le
texte rappelle que la fiche reste privée, et que le compte se supprime depuis les
réglages.

## Ce qui est gardé, et par quoi

| Ce qu'on protège | Où |
|---|---|
| Seule une orga relance | `requireOrgaId` + `actions-relances.test.ts` |
| Aucun doublon dans la fenêtre | Clause SQL + `profiles-relance.integration.test.ts` |
| Aucun envoi à une adresse `.invalid` | Clause SQL + test d'intégration |
| Aucune relance à une migrée jamais invitée | Clause SQL + test d'intégration |
| Un échec d'envoi laisse la fiche relançable | `markRemindersSent` sur les seuls succès + test d'action |
| L'e-mail dit les bons chantiers | `relance-email.test.ts` |
| L'écran est branché | `PAGES_ORGA` (E2E) + fiche en sommeil dans le décor |
