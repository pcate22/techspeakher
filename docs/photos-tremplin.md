# Photos du Tremplin : tags libres, consentement par tag, fiche photo

> 2026-07-03, chantier validé par l'orga. Comble le trou RGPD : on ne
> pouvait taguer que des inscrites de l'édition — une jurée, un coach ou
> une personne extérieure présente sur la photo n'existait pas dans
> l'inventaire, donc son droit à l'image n'était pas vérifiable.

## 1. Modèle (migration 020)

`tremplin_photo_personnes` passe du tag « inscription » au tag « personne » :

```sql
id              SERIAL PRIMARY KEY            -- (photo_id, registration_id) ne suffit plus
photo_id        INTEGER NOT NULL → photos     -- inchangé (CASCADE)
registration_id INTEGER NULL → registrations  -- participante de l'édition
user_id         INTEGER NULL → users          -- n'importe quel compte (jurée, coach…)
nom_libre       TEXT NULL                     -- personne extérieure sans compte
consentement    BOOLEAN NOT NULL DEFAULT false -- « consentement recueilli » par tag
CHECK : au moins une identité (inscription, compte ou nom libre)
UNIQUE partiels : (photo_id, registration_id) et (photo_id, user_id)
```

## 2. Règle de publication (inchangée dans l'esprit, élargie)

Une photo est publiable si **chaque personne taguée est couverte** :

- tag **inscription** → son consentement de visibilité (`registration.public`,
  self-service dans son espace) — comme avant ;
- tag **compte** ou **nom libre** → la case « consentement recueilli » du tag
  (l'orga atteste l'avoir obtenu).

Une photo sans personne (lieu, ambiance) reste publiable. Le retrait d'un
consentement retire la photo immédiatement (ISR revalidée).

**Preuve (RGPD).** Pour un tag hors inscription (compte, nom libre), l'accord
recueilli par l'orga est HORODATÉ (`consentement_le`, posé à l'activation,
effacé au retrait) — pendant du journal de consentement des inscriptions.

**Nom libre sans accord.** Identifier une personne extérieure AVANT d'avoir son
accord est volontaire : c'est le mécanisme de suivi (« de qui dois-je recueillir
l'accord ? »). Tant que l'accord n'est pas coché, la photo reste PRIVÉE (base
légale = préparation du recueil de consentement, donnée minimale = un nom). Si
l'accord ne sera pas obtenu, l'orga retire le tag (la donnée disparaît) ou
supprime la photo — aucune publication n'a lieu entre-temps.

## 3. UI

- **Fiche photo** (navigation profonde, comme les autres fiches) :
  `/admin/tremplins/[edition]/photos/[photo]` — cartes : Légende & moment ;
  Personnes sur la photo (une ligne par tag : nom, origine du consentement,
  bascule « consentement recueilli » à la volée pour les tags hors
  inscription, retirer) ; Ajouter une personne (participante de l'édition OU
  compte de la plateforme OU nom libre, avec la case consentement) ;
  **Publication** (statut EXPLIQUÉ : « publiée » / « bloquée : X n'a pas
  donné son accord ») ; Supprimer (confirmé, PRG).
- **Tableau de bord** : les cartes photo deviennent des liens vers la fiche
  (sous-titre : moment · N personnes · publiée/bloquée) ; la suppression et
  l'édition vivent sur la fiche.

## 4. Suppression d'un compte / retrait d'une inscription taguée (migration 021)

> Arbitrage tranché avec l'orga : **défaut sûr** (retirer une personne dépublie
> ses photos), au lieu de laisser une photo se republier après coup.

Les tags photo pointent vers un compte (`user_id`) ou une inscription
(`registration_id`) en **ON DELETE SET NULL** (avant : `CASCADE`). Si une
personne taguée SANS accord (donc bloquante) supprime son compte — ou si l'orga
retire son inscription — son tag **ne disparaît plus** : il subsiste, orphelin
et anonyme (libellé « Personne n° … »), et **reste bloquant** tant que
« consentement recueilli » n'est pas coché dessus. La photo reste donc PRIVÉE
(elle peut encore montrer cette personne) jusqu'à décision de l'orga :
recueillir l'accord (elle coche le tag), ou retirer le tag / la photo.

Un tag consenti (`consentement = true`) dont le compte est supprimé reste, lui,
couvert : l'accord à l'image ne dépend pas du compte TSH. La photo demeure
publiable, la personne y figurant désormais de façon anonyme.

Conséquence assumée : le CHECK d'identité (« au moins une identité ») est retiré
(un tag orphelin n'a plus d'identité). La garde « un tag a une identité à la
CRÉATION » reste **applicative** (`addPhotoTag` refuse un tag sans identité) —
le `SET NULL` est le seul chemin vers un tag orphelin.

## 5. Hors périmètre v1

Upload de fichiers (les photos restent des URLs), détection automatique,
notification aux personnes taguées.
