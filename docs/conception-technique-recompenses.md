# Récompenses & classement — conception technique + implémentation (révisée)

> 2026-07-05. Suite fonctionnelle : `docs/recompenses-tremplin.md` §4. Ce
> document décrit le **modèle technique** et le **plan d'implémentation**. Il a
> été **révisé après une grosse revue** (sécurité, RGPD, UX, accessibilité,
> KISS — synthèse en §8) : la revue a **simplifié** le modèle (une seule
> colonne au lieu de trois ajouts) et **fermé un trou RGPD** (le motif public).
>
> **Statut : conception, non implémenté. Personas d'exemple FICTIFS** (« Ada »
> 1ʳᵉ, « Grace » 2ᵉ) — jamais de vraie personne dans un doc versionné.

## 1. Rappel des décisions (fonctionnel)

Trois notions distinctes, par speakeuse :

1. **Classement (podium)** : 1ʳᵉ / 2ᵉ / 3ᵉ. Mérite immuable. **Public**.
2. **Récompense du rang (barème)** : le lot associé à un rang de l'édition.
   **Public**.
3. **Récompense attribuée** : ce qu'une speakeuse reçoit réellement (plusieurs
   possibles), avec **transfert** (à la place de qui, et pourquoi) — **public** —
   et **suivi** (statut, date) — **interne**.

## 2. État actuel

- **Classement** = `registrations.recompense TEXT` (« 1ᵉʳ prix »), texte libre,
  lu tel quel au palmarès. Trié par texte, non joignable au barème.
- **Récompenses** = table `tremplin_recompenses` (`intitule`, `detail`, `rang`,
  `beneficiaire_registration_id`, `motif`, `statut`, `evenement_le`,
  `attribuee_le`).
- **Public** : expose `rang`, `intitule`, `detail`, `beneficiaireNom` **si la
  bénéficiaire a consenti** (`registration.public`). Le `motif` est **interne**
  (jamais sérialisé), statut/date non plus.

## 3. Modèle cible (RÉVISÉ par la revue — minimal)

> La revue KISS a montré que le trio initialement prévu (garder le classement
> en texte libre + ajouter `origine_registration_id` + ajouter `type`) était le
> combo non minimal : il gardait le podium non requêtable ET ajoutait une FK
> redondante saisie à la main. **Un seul changement structurant** suffit.

### 3.1 Classement = `classement INTEGER` (LA colonne à ajouter)

```sql
-- migration 0NN
ALTER TABLE tremplin_registrations
  ADD COLUMN IF NOT EXISTS classement INTEGER;   -- 1, 2, 3… ; NULL = non classée
```

- **Source de vérité** du rang. Le libellé « 1ᵉʳ prix » est **dérivé** à
  l'affichage (`rangLabel(n)`), plus de texte libre.
- Rend le palmarès triable proprement (`ORDER BY classement`) et **joignable au
  barème** (`classement = recompense.rang`).
- **Gagnante** = `classement IS NOT NULL` (remplace `recompense IS NOT NULL`
  dans le compteur et le palmarès).
- **Reprise** : backfill des 8 lignes historiques (« 1ᵉʳ prix » → 1, etc.),
  trivial. La colonne `recompense TEXT` est retirée une fois les lectures
  basculées (palmarès, compteur gagnantes, fiche participante, seed import).

### 3.2 Barème = dérivé, pas de table

Le barème public = `récompenses WHERE rang IS NOT NULL`. Une ligne « rang N » EST
le lot du rang N. Rien à créer.

### 3.3 Transfert = DÉRIVÉ (pas de colonne `origine`)

`origine_registration_id` est **abandonné**. L'origine d'une récompense de
barème est, par définition, **la lauréate de son rang** :
`origine = la registration dont classement = recompense.rang`. On la retrouve
par jointure, des deux côtés :

- côté bénéficiaire (fiche + palmarès) : « reçu … transmis depuis le rang N » ;
- côté lauréate du rang (sa fiche) : « ta récompense du rang N a été attribuée
  à … ».

Il y a **transfert** quand `beneficiaire.classement ≠ recompense.rang` (la
récompense d'un rang est allée à quelqu'un d'autre que la lauréate de ce rang).

> Coût assumé : on ne peut pas tracer un transfert d'une récompense **sans
> rang** (hors barème) « depuis une personne nommée ». Aucune décision §4 ne le
> demande (tous les transferts sont des lots de barème). Si le cas surgit, la
> raison énumérée (§3.4) le narre sans PII.

### 3.4 Motif public = raison ÉNUMÉRÉE (fermeture du trou RGPD)

Le `motif` texte libre **ne devient pas public** (revue sécurité + RGPD : il
contournerait le consentement, pourrait nommer un tiers non consentant ou
révéler une donnée sensible, et casserait le droit à l'effacement). À la place,
une **raison énumérée**, sans nom :

```sql
ALTER TABLE tremplin_recompenses
  ADD COLUMN IF NOT EXISTS transfert_raison TEXT
    CHECK (transfert_raison IN ('cfp_officiel','autre'));
```

- **Publique**, par construction sans donnée personnelle. Deux valeurs
  (décision orga) : `cfp_officiel` → « Retenue via le CFP officiel de
  l'événement », `autre` → « Autre raison ». `NULL` = pas de transfert.
- Le `motif` texte libre **existant reste INTERNE** (note orga, jamais
  sérialisée au public). Les valeurs déjà saisies **ne sont pas publiées**
  (revue sécurité : pas de publication rétroactive).
- Pas d'`origine` stockée : le « à la place de {lauréate du rang} » vient de la
  dérivation (§3.3), gaté par consentement (§4).

### 3.5 `type` = DIFFÉRÉ (YAGNI)

Rien ne branche sur `type` aujourd'hui, il est exclu du DTO public, et
`podium` faisait doublon avec `rang`. On **ne l'ajoute pas maintenant** ; on
l'ajoutera (valeurs `atelier|coaching|meetup|conference|autre`, sans `podium`)
**dans le lot qui construira la vue stats/suivi** qui le consomme.

### 3.6 Bilan migration

**Une** migration : `classement INTEGER` (+ backfill, bascule des lectures,
retrait de `recompense TEXT`) et la petite colonne `transfert_raison`. Pas
d'`origine_registration_id`, pas de `type`.

## 4. Frontière public / interne + consentement

**Règle en deux lignes** (remplace la matrice) :
- Le **suivi** (`statut`, `evenement_le`, `motif` interne) n'est **jamais**
  public.
- Tout le reste est public, mais **un NOM n'apparaît que si CETTE inscription a
  `public = true`** — bénéficiaire et lauréate d'origine gatées **indépendamment**.

**Gating technique** (revue sécurité) : dans `getPublicEdition`, deux jointures
distinctes — `r` (bénéficiaire) et `ro` (lauréate du rang, dérivée) — chacune
gatée par SON propre `public` :
`CASE WHEN ro.public THEN COALESCE(ro.participante_nom, uo.name) END`. Ne jamais
gater l'origine sur le consentement de la bénéficiaire.

**Matrice d'affichage du transfert** (4 cas, à implémenter tels quels ;
« Présentée » accordé au féminin, pas de cadratin, espaces insécables) :

| bénéf. consent | origine consent | Affichage public |
| :---: | :---: | --- |
| oui | oui | « Présentée par Grace (2ᵉ) à la place d'Ada (1ʳᵉ) : déjà retenue via son CFP. » |
| oui | non | « Présentée par Grace (2ᵉ). » (on **n'expose ni le nom ni le rang** de l'origine) |
| non | oui | « Récompense du 1ᵉʳ prix, transmise (déjà retenue via un CFP). » (bénéf. anonyme) |
| non | non | rien de nominatif ; on retombe sur le barème seul |

**Ré-identification (revue RGPD)** : le rang est public et unique par édition
(vivier de ~8). Dire « à la place du 1ᵉʳ prix » ré-identifie la lauréate même
sans nom. Donc : **si l'origine n'a pas consenti, on n'affiche pas le lien à son
rang** (ni « à la place d'Ada », ni « à la place du 1ᵉʳ prix ») — cf. cas 2.

**Finalité — tranchée (orga 2026-07-05)** : le consentement `public` est
**global au Tremplin** et recueilli une fois ; il couvre l'apparition, transfert
compris. **Pas de « sur-consentement »** propre au transfert (« ça va être lourd
pour tout le monde »). On applique donc simplement le gating par personne sur le
flag existant : chaque nom (bénéficiaire, lauréate d'origine) s'affiche dès que
CETTE personne a `public = true` — les quatre cas de la matrice ci-dessus, sans
étape de consentement supplémentaire. C'est l'orga qui ré-attribue la place.

## 5. Lib

- `registrations` : `classement: number | null` ; helper `rangLabel(n)`
  (« 1ᵉʳ prix »/« 2ᵉ prix »…). Compteur gagnantes = `classement IS NOT NULL`.
- `tremplin-recompenses.ts` : `transfertRaison` (union + garde + libellés) sur
  `Recompense` ; `RecompenseInput` inchangé côté rang. `setRecompenseBeneficiaire`
  ne prend **pas** d'origine (dérivée) ; le `motif` interne reste géré à part.
- `tremplin-public.ts` : `PublicRecompense` gagne `transfertRaison` et, par
  dérivation, la lauréate du rang **gatée** (`ro.public`). Ne sérialise jamais
  `statut`/`evenement_le`/`motif` interne (test DTO l'asserte).

## 6. Actions

- `requireOrgaId()`, SQL paramétré, scope édition revérifié (déjà le cas).
- Classement : `setRegistrationClassement(registrationId, editionId, n|null)`
  (entier 1..N ou null), garde orga, scope édition.
- `transfert_raison` : validée par sa garde (défaut `null`).
- `revalidatePath(PUBLIC_EDITION_ROUTE, "page")` (le transfert change le public).
- Plus de champ `origine` à valider (supprimé).

## 7. UI

**Vocabulaire figé partout (docs + UI)** — revue UX :
- **« Classement »** (jamais « podium » comme label) sur la fiche participante :
  champ « Classement (1ʳᵉ, 2ᵉ, 3ᵉ…) ».
- **« Récompense du rang »** pour le barème (abandonner « barème » / « théorique »
  dans l'UI). Champ récompense : « Rang récompensé (facultatif) ».
- **« Récompense attribuée »** pour l'attribution réelle.

**Public — palmarès** : une gagnante = un titre (`h3` : son nom si consenti,
sinon « Gagnante (non communiquée) »), rang en texte (jamais couleur seule),
lot du rang, puis la phrase de transfert selon la matrice §4 (phrase
autoportante, pas d'icône/couleur porteuse de sens).

**Interne — fiche récompense** : attribution = un seul bouton
« Enregistrer l'attribution » (bénéficiaire via PersonPicker + raison de
transfert énumérée) ; l'origine n'est **pas** un champ (dérivée), une aide
vivante l'affiche : « Rang 2 : revient à Grace (2ᵉ). » Suivi : `statut` et
(futur) `type` en sélecteurs **submitOnChange** (doctrine des commandes
discrètes), la date derrière son bouton. Selects **étiquetés** (`label for`),
regroupés en `fieldset`/CarteSection, focus géré par `AdminDialog`, confirmations
`role=status` / erreurs `role=alert`.

**Interne — tableau de bord** : liste `NavRow` (intitulé · bénéficiaire ·
statut), badges avec équivalent texte (`TagBadge`), jamais la couleur seule.

**Fiche participante — carte dédiée « Classement et récompenses »** (revue UX :
matérialise « les 2 informations ») :
```
Classement : 2ᵉ
Récompense de ce rang : un talk en meetup
Reçu : une présentation au DevFest 2026 (transmise depuis le 1ᵉʳ prix)
```
Côté lauréate du rang : « Ta récompense du 1ᵉʳ prix a été attribuée à … ».

## 8. GROSSE REVUE (synthèse des 5 angles)

**Sécurité** — (1) l'origine, si elle avait été stockée, aurait exigé un
`EXISTS` édition distinct (IDOR) : **résolu en la dérivant** (plus de FK
saisie). (2) Gating de la lauréate du rang sur SON `public` via un **alias de
jointure distinct** (`ro`), jamais celui de la bénéficiaire. (3) `motif` public
= trou majeur → **fermé** (raison énumérée, motif libre reste interne, pas de
publication rétroactive). (4) `type`/`statut`/dates hors DTO public (test).
Rendu **texte brut** (échappement JSX), jamais markdown/HTML.

**RGPD** — le trou central était le motif libre public (nommait un tiers non
consentant, donnée potentiellement sensible, effacement incomplet) →
**raison énumérée sans nom** le supprime par construction. **Ré-identification**
par le rang public (vivier ~8) → on masque le lien au rang quand l'origine n'a
pas consenti. **Finalité** (« a cédé sa place » ≠ « a gagné ») → à confirmer
avec l'orga, défaut prudent = transfert nominatif seulement si les deux
consentent. **Effacement** : `ON DELETE`/dérivation → aucun nom figé (pas de
motif libre public, pas de nom copié).

**UX** — vocabulaire figé (classement/récompense du rang/attribuée) ; l'origine
**dérivée et pré-affichée** (un champ en moins) ; repli « transmise ? » ; phrase
publique **sans cadratin**, accordée au féminin, insécables ; motif interne
étiqueté « jamais affiché » ; sélecteurs de suivi en submitOnChange ; carte
participante dédiée aux 3 notions.

**Accessibilité (RGAA)** — palmarès en titres (`h3` par gagnante), rang en
texte, transfert en phrase autoportante (pas couleur/icône seule) ; selects
étiquetés + `fieldset` ; sauvegardes à la volée annoncées `role=status`, erreurs
`role=alert` ; focus via `AdminDialog`, deux PersonPicker à ids/labels distincts
(ici un seul, l'origine étant dérivée) ; badges de statut avec équivalent texte
(`TagBadge`), filtre non basé sur la couleur ; hiérarchie de titres sans saut,
info non dupliquée.

**KISS** — une seule colonne structurante (`classement INTEGER`) au lieu de
trois ajouts ; `origine` dérivée ; `type` différé ; « barème » = vue dérivée
(`rang IS NOT NULL`), pas une table ni un concept de schéma ; matrice publique
réduite à une règle + la table des 4 cas de transfert (nécessaire, elle, pour
la correction RGPD).

## 9. Plan d'implémentation TDD (après validation)

1. **Migration 0NN** : `classement INTEGER` (+ backfill, retrait `recompense
   TEXT` une fois les lectures basculées) + `transfert_raison`. `schema.sql` +
   `sync-to-latest.sql` + `db/migrations/`. Test de dérive (PGlite).
2. **Lib** (rouge → vert) : `classement` + `rangLabel` + compteur gagnantes ;
   `transfertRaison` ; `PublicRecompense` (raison + lauréate du rang gatée,
   dérivation). Tests unitaires + intégration pg-mem (gating consentement des
   deux côtés indépendamment ; suivi jamais public).
3. **Actions** : `setRegistrationClassement`, `transfert_raison` validée,
   autorisation + scope. Tests.
4. **UI publique** : palmarès (titres, rang texte, matrice de transfert des 4
   cas). Test page (DTO mocké, un test par cas de consentement).
5. **UI interne** : fiche récompense (raison énumérée, origine dérivée affichée,
   suivi submitOnChange), fiche participante (carte dédiée), tableau de bord.
6. **RGAA** : titres, labels, `role=status`/`alert`, `TagBadge`, focus.

Un lot = un commit. Rien ne merge en rouge.

## 10. Décisions orga — tranchées le 2026-07-05

1. **Finalité du transfert** : ✅ consentement **global au Tremplin**, pas de
   sur-consentement ; gating par personne sur le flag `public` existant (§4).
2. **Raisons de transfert** : ✅ deux valeurs — `cfp_officiel` (« Retenue via le
   CFP officiel de l'événement ») et `autre` (« Autre raison ») (§3.4).
3. **`type` + vue stats** : ✅ **plus tard** (hors de ce lot, §3.5).

→ Conception close. Implémentation en TDD selon le plan §9.
