# Plateforme Tech Speak'Her — Conception fonctionnelle

> **Statut** : v4 (animatrices multiples, finale + podium + lots, rattrapage édition passée, sécurité des données). Restent 2 questions techniques (sync HelloAsso, stockage sécurisé).
> **Périmètre de ce document** : le *quoi* (fonctionnalités, acteurs, données, parcours, écrans).
> **Hors périmètre pour l'instant** : le *comment* technique (auth sécurisée, base de données, intégration HelloAsso, hébergement) — traité dans un second temps.

Le site Tech Speak'Her passe d'un **site vitrine** (contenu en code, déjà en place) à une **plateforme** avec comptes et contenus gérés par les membres. Le contenu éditorial (pages, FAQ…) reste en code ; les données des membres vivront en base.

> ⚠️ **Document de conception (le *quoi* visé).** Le comportement réellement
> livré peut différer — la **source de vérité de l'implémentation** est
> `docs/architecture.md`. Écarts connus à ce jour : la publication passe par une
> **validation orga** (état `en_attente`, pas seulement « adhésion à jour ») et
> l'**adhésion HelloAsso est reportée** (non active).

---

## 1. Objectifs

- **Objectif 1 — Espace speakeuses** : chaque membre gère elle-même sa fiche (description, liens, talks/conférences). Seules les **adhérentes** apparaissent dans l'annuaire public.
- **Objectif 2 — Orga d'un Tremplin** : gérer une ou plusieurs éditions du Tremplin (inscriptions des participantes, ateliers, animatrices, liens visio/supports, et suivi de présence atelier par atelier).

Les deux objectifs partagent un **compte membre unique** : une même personne peut être speakeuse **et** participante à un Tremplin (la gagnante du Tremplin devient speakeuse sur scène).

### Pré-requis transverse : l'adhésion (HelloAsso)

L'**adhésion à l'association** est la porte d'entrée de la plateforme. Elle est gérée via **HelloAsso** (paiement / inscription membre). Conséquences :

- L'adhésion est **gratuite** et **valable 1 an** (renouvellement annuel). Des **relances** sont envoyées avant l'échéance ; sans renouvellement, la fiche est **masquée automatiquement** de l'annuaire.
- Seules les **adhérentes à jour** apparaissent dans l'annuaire et accèdent à l'espace membre.
- Il n'y a donc **pas de modération de contenu lourde** : on fait confiance aux membres. L'orga garde un droit de **masquage** en cas d'abus.
- *Cadré le 2026-10-15* : API HelloAsso (notification relue + rattrapage quotidien), rapprochement par l'adresse du membre ; l'annuaire réservé aux membres passe derrière `FLAG_ADHESIONS`. Voir `docs/conception-adhesions-helloasso.md`. (Le tarif a changé depuis ce doc : 10 € par an, gratuite sur déclaration, cf. `/adherer`.)
- **Au lancement** : pas encore de compte bancaire → **HelloAsso reporté**. En intérim, l'orga gère l'appartenance **à la main**, et l'**annuaire repart de 0** (les membres créent leur espace, à commencer par les gagnantes du Tremplin). Voir la conception technique pour le phasage.

### Pré-requis transverse : sécurité des données & code public

Le code du site a vocation à devenir **public** (dépôt ouvert en lecture ; licence **propriétaire** depuis le 2026-08-23, voir `LICENSE`), et il n'y a **pas encore de base de données**. Principe à tenir dès le départ :

- Les **données des membres** (profils, coordonnées, présences, résultats…) sont des **données personnelles** : elles doivent rester **hors du dépôt public** et dans un **stockage sécurisé** (base hébergée en UE + secrets en variables d'environnement).
- **Le code est public ; les données ne le sont jamais.** Le choix du stockage sécurisé se fera en phase technique.

---

## 2. Acteurs et rôles

| Rôle | Qui | Ce qu'il/elle fait |
|---|---|---|
| **Visiteur** | public, non connecté | Consulte l'annuaire public des speakeuses et les pages du site |
| **Membre** | adhérente (via HelloAsso) | Gère son profil speakeuse, ses talks, ses inscriptions Tremplin |
| **Animatrice** | membre avec un droit sur des ateliers | Sur **ses** ateliers : dépose les supports, fait l'appel (présences) |
| **Orga TSH** | bénévoles TSH (admin) | Gère les éditions Tremplin, les inscriptions, les ateliers ; masque une fiche si besoin ; suit les adhésions |

> « Membre », « Animatrice » et « Orga » sont des **droits** posés sur un même type de compte. Une orga est aussi membre ; une animatrice est une membre à qui on a confié des ateliers.

---

## 3. Objectif 1 — Espace speakeuses

### 3.1 Parcours speakeuse

1. **Adhésion** à l'association via **HelloAsso**.
2. **Connexion** à l'espace membre par **lien magique** (email, sans mot de passe).
3. **Remplissage du profil** :
   - Identité : prénom, nom
   - Rôle / poste · entreprise
   - Bio / description
   - Domaines d'expertise (tags, pour les filtres de l'annuaire)
   - Lien site web (optionnel)
   - Lien LinkedIn
   - Lien Instagram (optionnel)
   - **Talks / conférences** (liste, voir 3.2)
   - Coordonnées de contact : **email** + **téléphone (facultatif)** — **privées**, jamais publiées (voir 3.5). Le téléphone sert surtout au groupe WhatsApp animé par l'orga.
4. **Publication** dans l'annuaire public `/speakeuses`, **conditionnée à une adhésion à jour**.
5. **Mises à jour** : la membre édite sa fiche quand elle veut ; les changements sont publiés directement (pas de ré-modération). L'orga peut masquer en cas d'abus.

### 3.2 Modèle d'un talk / conférence

Chaque talk de la liste contient :

| Champ | Obligatoire | Exemple |
|---|---|---|
| Titre du talk | oui | « L'IA à l'épreuve du monde physique » |
| Événement / conférence | non | « DevFest Toulouse 2026 » |
| Date | non | « 19 novembre 2026 » |
| Description | non | Résumé en 1–2 phrases |
| Lien (vidéo, slides, page) | non | URL |

> Extension du modèle actuel (`talks: [{ title, url }]`) avec **événement, date et description** en plus.

### 3.3 États d'une fiche speakeuse

> Implémenté avec une **validation orga** (ci-dessous le modèle réel ; cf.
> `docs/architecture.md`). L'adhésion HelloAsso est reportée.

```
Brouillon ──soumettre──► En attente ──(orga) publier──► Publiée
   ▲                         │             (refuser → Refusée)   │ (orga) mettre en retrait
   │                         │                                   ▼
   └──── la speakeuse retire (depuis En attente / Publiée / Masquée) ──── Masquée
```

- **Brouillon** : en cours de remplissage / repris après retrait, non visible.
- **En attente** : soumise, en cours de relecture orga.
- **Publiée** : validée par l'orga, visible dans l'annuaire.
- **Refusée** : refusée avec motif ; la speakeuse corrige et re-soumet.
- **Masquée** : retirée de l'annuaire par l'orga (« mettre en retrait »). La
  speakeuse, elle, **retire** sa fiche → retour en **brouillon** (re-soumission).

### 3.4 Adhésion & connexion (simple pour commencer)

- **Adhésion** : gérée via **HelloAsso**. C'est elle qui ouvre droit à l'annuaire.
- **Connexion** : **lien magique par email** (passwordless), uniquement là où c'est utile — pas de mot de passe à gérer au début.
- **Rôle de l'orga** : suivre les adhésions et masquer une fiche en cas d'abus — pas de validation de contenu au cas par cas.

### 3.5 Données publiques vs privées (RGPD)

TSH est une association loi 1901 qui gère des **données personnelles**.

| Donnée | Public (annuaire) | Privé (orga + la personne) |
|---|---|---|
| Prénom, nom, rôle, bio, tags | ✅ | |
| Liens site / LinkedIn / Instagram | ✅ | |
| Talks (titre, événement, date, desc, lien) | ✅ | |
| **Email** | ❌ jamais | ✅ |
| **Téléphone** (facultatif) | ❌ jamais | ✅ |

**Prise de contact** : pas de coordonnées exposées. Pour joindre une speakeuse, on passe par le **formulaire de contact TSH** (`/contact`) ou par son **LinkedIn**. Le **téléphone** est facultatif et sert en interne (groupe WhatsApp animé par l'orga).

À cadrer avec le RGPD (consentement à la publication, droit de retrait, durée de conservation) lors de la phase technique/auth.

### 3.6 Contact modéré d'une speakeuse (safe place)

Une speakeuse peut accepter d'être contactée via le site (`contact_email_ok`),
**sans jamais exposer son e-mail**. Pour garder une **safe place**, tout message
passe par un **sas de modération orga** avant d'atteindre la speakeuse.

**Décision : modération systématique.** Il n'y a pas de relais direct ; tout
message d'un visiteur est mis en file et relu par l'équipe.

**Parcours visiteur (envoi)**
1. Depuis la fiche publiée d'une speakeuse joignable, il ouvre le formulaire.
2. Il renseigne un **motif (obligatoire)**, son nom, son e-mail, son message.
   Motifs : **Conférence ou table ronde**, **Jury** (CFP, hackathon, prix…),
   **Interview / média / podcast**, **Autre** (champ libre). Liste en constante
   (source unique).
3. À l'envoi, le message est **enregistré en attente** (aucun e-mail immédiat).
   La page explique qu'il sera **lu par l'équipe et transmis seulement s'il
   respecte le règlement intérieur** (`/charte`).
4. **En cas de rejet, l'expéditeur n'est pas notifié** (on n'informe pas un
   abuseur potentiel).

**Parcours orga (modération)**
- Une file **« Messages »** dans `/admin` (réservée aux orgas) : motif,
  expéditeur, e-mail, corps, destinataire, date.
- Deux actions : **Transmettre** ou **Rejeter** (on trace qui/quand). Le rejet ne
  relaie rien mais **conserve le message** (audit, détection de récidive).

**Parcours speakeuse (réception & réponse)**
- Les messages **transmis** apparaissent dans son espace (**« Mes messages »**) :
  motif, corps complet, e-mail de l'expéditeur (qui a consenti en écrivant).
- Elle **répond depuis sa propre messagerie**. Son adresse reste masquée côté
  public.

**Notifications**
- La speakeuse est prévenue **immédiatement à la transmission** par e-mail, avec
  **le début du message uniquement** (extrait) ; elle se connecte pour lire le
  message complet et répondre. Le cron quotidien n'est qu'un **filet de
  rattrapage** si l'envoi immédiat échoue (voir §8 et `docs/exploitation.md`).
- La **décision de modération de son profil** (validé / à ajuster) est aussi un
  e-mail **immédiat**. Le quota Brevo (300/jour) le permet largement.
- L'orga est prévenue par le **digest de 17h** (fiches à valider + messages à
  modérer), seulement s'il y a du travail en attente.

**Données (RGPD)** — nouvelle entité **Message de contact** :
`{ speakeuse destinataire, motif, expéditeur (nom + e-mail), corps, statut
(en attente / transmis / rejeté), dates de création et de modération, orga
modératrice, date de notification }`. **Historique conservé** (audit / récidive),
à mentionner dans les mentions légales. Suppression du compte speakeuse → cascade
efface ses messages. Anti-abus : rate-limit sur l'envoi (IP + e-mail).

---

## 4. Objectif 2 — Orga d'un Tremplin

### 4.1 Entités

- **Édition Tremplin** : une promo rattachée à **une conférence majeure**. Champs :
  - nom, année, statut (`ouvert aux inscriptions` / `en cours` / `clos` / `archivé`), description
  - **conférence majeure associée** : nom, **date**, **lien** vers la conf
  - *Plusieurs éditions* peuvent coexister (conférences différentes, ex. DevFest Toulouse, Devoxx / CTO de France…). Pour l'instant **une seule ouverte à la fois**.
  - Une édition **passée** peut être saisie en **rattrapage** (cf. §4.5).
- **Inscription au Tremplin** : lien entre une participante (membre) et une édition. Champs : statut (`en attente` / `acceptée` / `refusée`), date, sujet pressenti / motivation.
- **Atelier** : une session de coaching d'une édition. Champs : numéro/ordre, titre, **date**, **heure de début** et **heure de fin**, description, **lien visio** (Google Meet ou autre), **lien support** (slides/doc), **une ou plusieurs animatrices**.
- **Présence à un atelier** *(optionnelle)* : pour chaque couple (participante × atelier) : `présente` / `absente` / `excusée`. Peut rester **non renseignée** (ex. édition rattrapée a posteriori).
- **Finale (soirée pitch)** : date, lieu. On y suit **qui est présente à la finale** (par participante) ; c'est là que se joue le classement.
- **Résultat / podium** : par édition, le **classement** des participantes (1ʳᵉ = gagnante, puis suivantes) avec le titre du talk.
- **Lot** : par édition, la liste des **lots** (libellé, rang associé éventuel, partenaire/donateur). **Suivi** : attribué à qui, **remis** (oui/non), date de remise.

### 4.2 Parcours participante

1. S'inscrit à l'édition **ouverte** depuis son compte membre.
2. Une fois **acceptée**, accède au **programme des ateliers** : dates, liens visio, supports.
3. (Optionnel) consulte son propre suivi de présence.

### 4.3 Parcours orga & animatrice

**Orga**
1. Crée une **édition** (conférence majeure + date + lien, dates, statut).
2. Crée les **ateliers** (horaires début/fin) et y associe **une ou plusieurs animatrices**.
3. Gère les **inscriptions** : accepte / refuse.
4. Saisit la **finale** : présence à la soirée et **classement** (gagnante + podium).
5. Gère les **lots** et leur **suivi de remise**.
6. Vue **matrice de présence** (participantes × ateliers) pour l'assiduité — quand elle est renseignée.

**Animatrice** (sur ses ateliers uniquement)
1. Ajoute / met à jour le **lien support** et le **lien visio**.
2. **Fait l'appel** : coche la présence de chaque participante.

### 4.4 États

- **Inscription** : `en attente` → `acceptée` / `refusée`.
- **Édition** : `ouvert aux inscriptions` → `en cours` → `clos` → `archivé`. Une édition peut être créée directement en **archivé** (rattrapage).
- **Lot** : `à attribuer` → `attribué` → `remis`.

### 4.5 Rattrapage d'une édition passée

On doit pouvoir **enregistrer le Tremplin 1 (déjà terminé)** sans refaire l'appel : on connaît les participantes, la finale, la gagnante, le podium et les lots, **mais pas la présence atelier par atelier**. Donc :

- la **présence aux ateliers est optionnelle** et peut rester vide pour une édition rattrapée ;
- on saisit quand même : participantes, **présence à la finale**, **classement / gagnante**, **lots et suivi**.

---

## 5. Modèle de données fonctionnel (vue d'ensemble)

```
Membre (compte)
 ├─ adhésion ► statut HelloAsso (à jour / expirée)
 ├─ a un  ► ProfilSpeakeuse (0..1)
 │            └─ a plusieurs ► Talk (0..n)
 ├─ droits ► Orga ? Animatrice ?
 └─ a plusieurs ► InscriptionTremplin (0..n)

EditionTremplin
 ├─ conférence majeure ► { nom, date, lien }
 ├─ a plusieurs ► Atelier (0..n)
 │                  ├─ animé par ► Membre/Animatrice (1..n)   ← plusieurs animatrices
 │                  └─ horaires ► début / fin
 ├─ a plusieurs ► InscriptionTremplin (participantes)
 ├─ a une ► Finale { date, lieu }
 ├─ a un  ► Podium (classement des participantes, 1ʳᵉ = gagnante)
 └─ a plusieurs ► Lot { libellé, rang, partenaire } + suivi de remise

Presence atelier  =  (InscriptionTremplin × Atelier) → présente / absente / excusée   [optionnel]
Presence finale   =  (InscriptionTremplin)           → présente / absente
```

> Modèle **fonctionnel** : les tables/colonnes réelles seront définies à la phase technique.

---

## 6. Matrice des permissions (qui peut quoi)

| Action | Visiteur | Membre | Animatrice | Orga |
|---|:--:|:--:|:--:|:--:|
| Voir l'annuaire des speakeuses | ✅ | ✅ | ✅ | ✅ |
| Gérer SON profil + SES talks | | ✅ | ✅ | ✅ |
| S'inscrire à un Tremplin ouvert | | ✅ | ✅ | ✅ |
| Voir le programme d'ateliers (si acceptée) | | ✅ | ✅ | ✅ |
| Supports + appel sur SES ateliers | | | ✅ | ✅ |
| Créer/gérer une édition + ateliers | | | | ✅ |
| Accepter/refuser des inscriptions | | | | ✅ |
| Saisir la finale, le podium & la gagnante | | | | ✅ |
| Gérer les lots & leur suivi de remise | | | | ✅ |
| Masquer une fiche speakeuse (abus) | | | | ✅ |
| Désigner les animatrices (plusieurs/atelier) | | | | ✅ |

---

## 7. Écrans à prévoir

**Public**
- `/speakeuses` — annuaire (déjà existant, alimenté par les fiches publiées)

**Membre (connectée)**
- `/connexion` — connexion par lien magique
- `/mon-espace` — mon profil speakeuse (édition, statut d'adhésion)
- `/mon-espace/talks` — gérer mes talks
- `/mon-espace/tremplin` — mes inscriptions Tremplin + programme d'ateliers

**Animatrice**
- `/mon-espace/ateliers` — mes ateliers : supports + appel des présences

**Orga (admin)**
- `/admin` — tableau de bord
- `/admin/tremplins` — liste des éditions (par conférence majeure)
- `/admin/tremplins/[edition]` — détail : ateliers (horaires + animatrices) + inscriptions
- `/admin/tremplins/[edition]/presences` — matrice de présence aux ateliers
- `/admin/tremplins/[edition]/finale` — présence à la finale + podium / gagnante
- `/admin/tremplins/[edition]/lots` — lots & suivi de remise
- `/admin/membres` — suivi des adhésions / masquage de fiche

---

## 8. Notifications email (V1)

> **Choix produit : notifications groupées en digests.** On ne déclenche
> **jamais** un e-mail par événement : les notifications sont **regroupées dans
> des digests quotidiens par cron** (rien envoyé si rien en attente), pour ne pas
> spammer les speakeuses. Brevo autorise 300 e-mails/jour (large), donc c'est du
> confort, pas du rationnement. Seul le **lien magique** reste transactionnel
> immédiat. Détail ops : `docs/exploitation.md`.

- **Connexion** : envoi du lien magique (transactionnel, jamais groupé).
- **Digest speakeuse** (quotidien, groupé) : message(s) de contact transmis
  (extrait seulement). La décision de modération de profil reste un e-mail
  immédiat ; à terme les notifs membre/participante/animatrice pourront rejoindre
  ce digest.
- **Digest orga** (17h, groupé) : fiches à valider + messages de contact à
  modérer, vers `techspeakher@gmail.com`, seulement s'il y a du travail.
- Notifs à faire porter par le digest speakeuse (au lieu d'envois unitaires) :
  « profil en ligne », « inscription Tremplin acceptée / refusée », « tu animes
  l'atelier X » + rappel, relances d'adhésion et masquage à l'échéance.

---

## 9. Décisions prises (26 juin) & questions restantes

**Tranché**
1. **Modération** → pas de validation de contenu : l'**adhésion HelloAsso** est la porte d'entrée ; seules les adhérentes sont dans l'annuaire. Orga = droit de masquage.
2. **Lien magique** → **connexion** (passwordless) uniquement, là où c'est utile.
3. **Coordonnées** → **aucun email ni téléphone public** ; contact via le formulaire `/contact` ou le LinkedIn.
4. **Éditions Tremplin** → une seule ouverte à la fois pour l'instant, mais le modèle gère **plusieurs éditions par conférence cible** (DevFest, Devoxx / CTO de France…).
5. **Animatrices** → elles ont un **compte** (supports + appel sur leurs ateliers).
6. **Inscription** → réservée aux **membres** (adhésion via HelloAsso).
7. **Adhésion** → **gratuite**, **valable 1 an** (renouvellement annuel), avec **relances avant expiration** et **masquage automatique** de la fiche si non renouvelée.
8. **Tremplin & adhésion** → on **suppose les participantes adhérentes** (on ajustera plus tard le moment exact de l'adhésion).
9. **Données de contact** → on stocke **email** (obligatoire) **+ téléphone** (facultatif, utile pour le groupe WhatsApp orga), tous deux **privés**.
10. **Animatrices** → **plusieurs possibles par atelier**.
11. **Ateliers** → **heure de début et de fin**.
12. **Conférence majeure** → chaque édition y est rattachée : **nom, date, lien**.
13. **Finale** → on suit **la présence à la finale** et le **classement (gagnante + podium)**.
14. **Lots** → liste des lots par édition + **suivi de remise** (à attribuer → attribué → remis).
15. **Rattrapage** → une édition **passée** se saisit en `archivé` **sans présence atelier** (présence atelier **optionnelle**).
16. **Sécurité / code public** → dépôt public, **données membres hors dépôt**, stockage sécurisé (UE) — choix en phase technique.

**Questions restantes (phase technique)**
- A. ~~**HelloAsso** : comment la plateforme connaît le statut d'adhésion ?~~ Tranché le 2026-10-15 : `docs/conception-adhesions-helloasso.md`.
- B. **Stockage sécurisé** : quelle solution pour héberger les données membres hors dépôt (base UE managée, etc.) ?

---

## 10. Phasage proposé

- **Phase 1a** — Espace speakeuses : compte, connexion lien magique, profil, talks, annuaire conditionné à l'adhésion.
- **Phase 1b** — Auth sécurisée + intégration HelloAsso (sujet technique dédié : méthode, rôles, RGPD).
- **Phase 2** — Orga Tremplin : éditions (par conférence cible), inscriptions, ateliers, animatrices, présences.

> Ce document décrit le besoin fonctionnel. L'étape suivante (technique) précisera l'authentification, l'intégration HelloAsso, la base de données, l'hébergement (UE/RGPD) et la migration des speakeuses actuelles (aujourd'hui dans `src/data/`) en premières fiches de la plateforme.
