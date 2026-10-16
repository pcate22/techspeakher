# Autorisation de diffusion : provenance du consentement et preuve démontrable

> 2026-07-22, cadrage orga. Comble un trou de **démontrabilité RGPD** : on sait
> aujourd'hui *qu'*une participante est visible publiquement et *quand* le
> consentement a été posé (`public_consent_at` + `tremplin_consent_log`), mais
> pas *sur quelle base* (elle-même dans son espace ? un formulaire d'inscription
> clausé ? un e-mail ?) ni *où retrouver la preuve*. Sans ça, publier les
> participantes du Tremplin 1 (consentement recueilli hors plateforme) repose
> sur un simple interrupteur orga, non tracé. On enrichit le journal existant
> plutôt que d'inventer un modèle parallèle.

## 1. Le besoin

On aura toujours **deux origines** de consentement à la diffusion, et il faut
pouvoir démontrer les deux (art. 7.1 RGPD, accountability) :

- **La personne elle-même** : elle accorde (et révoque) sa visibilité depuis son
  espace. C'est la preuve la plus forte, elle existe déjà (self-service).
- **Un recueil externe** : l'orga détient une autorisation obtenue hors du
  toggle self-service. Deux cas réels :
  - **Participantes Tremplin 1** : la clause de diffusion était dans le
    **formulaire d'inscription**. La preuve individuelle est la **soumission
    datée** de chaque personne ; la base commune est la clause du formulaire.
  - **Jurés / coachs / personnes extérieures** : accord recueilli par
    **e-mail**. Ces personnes ne sont pas des inscriptions : elles sont déjà
    couvertes par l'attestation « consentement recueilli » des tags photo
    (cf. `docs/photos-tremplin.md` §2), à qui il manque juste la même dimension.

Précédent direct : le modèle photos atteste déjà un consentement hors
self-service et l'horodate (`consentement_le`), « pendant du journal de
consentement des inscriptions ». On généralise ce pendant.

## 2. Décisions (tranchées avec l'orga)

1. **Consentement par personne, jamais global.** Pas d'interrupteur d'édition
   « on a l'autorisation de tout le monde » ni de PJ fourre-tout : ce serait plus
   faible juridiquement qu'une attestation individuelle. Chaque entrée du journal
   porte sa base et sa preuve.

2. **Provenance explicite (`base`).** Chaque `accorde`/`retire` enregistre d'où
   vient le consentement :
   - `self` — la personne a basculé dans son espace ;
   - `formulaire_inscription` — clause du formulaire d'inscription (plateforme ou
     Tremplin 1) ;
   - `email` — accord recueilli par e-mail ;
   - `autre` — cas résiduel, précisé dans la note.

3. **Preuve = un lien, jamais un binaire.** `preuve_lien` (optionnel) pointe vers
   la source (formulaire archivé + sa clause, fil d'e-mail dans un espace
   restreint). Cohérent avec l'existant (photos et documents sont des URLs, pas
   d'upload — cf. `docs/photos-tremplin.md` §5). Le lien mène à un espace
   **restreint** : la preuve contient des données personnelles (identité,
   éventuelle signature), elle n'est jamais publique. Data-minimization : on
   pointe la source, on ne la recopie pas.

4. **Consentement futur intégré au formulaire, mais libre.** Le prochain
   formulaire d'inscription portera la clause de diffusion directement dans la
   plateforme — comme au Tremplin 1. Garde non négociable : c'est une **case
   opt-in distincte, décochée par défaut**. L'inscription au tremplin **aboutit**
   que la personne accepte la diffusion ou pas ; refuser la diffusion ne bloque
   pas l'inscription. Sinon le consentement n'est plus « libre » (art. 4-11) et
   la preuve perd sa valeur. Base enregistrée alors : `formulaire_inscription`.

5. **Révocation à tout moment.** Inchangé : `setOwnRegistrationVisibility`
   (self-service) et `setRegistrationVisibility` (orga) posent `retire`, retrait
   **immédiat** (ISR revalidée). Le retrait est journalisé (`retire` + date +
   base), donc l'historique lit « accordé le X via formulaire → retiré le Y ».

6. **Historique lisible des deux côtés.** Le journal (`tremplin_consent_log`)
   devient visible :
   - **orga** — sur la sous-page *Visibilité* de la participante (démontrabilité) ;
   - **la personne concernée** — en lecture dans son espace tremplin
     (transparence / droit d'accès, art. 12-15) : « Ton consentement à la
     diffusion : accordé le … via …, tu peux le retirer. »

## 3. Modèle (migration 037, à venir)

Sur `tremplin_consent_log` (append-only, inchangé dans son principe) :

```sql
ALTER TABLE tremplin_consent_log
  ADD COLUMN base TEXT NOT NULL DEFAULT 'self'
    CHECK (base IN ('self', 'formulaire_inscription', 'email', 'autre')),
  ADD COLUMN preuve_lien TEXT;   -- URL vers la source (espace restreint), NULL si self
```

- `base = 'self'` pour tout le journal existant (défaut) : les entrées actuelles
  viennent du toggle self-service ou d'un geste orga « en son nom », on les
  qualifie a posteriori comme self (le plus prudent) sauf reprise manuelle.
- `preuve_lien` reste `NULL` pour `self` (la preuve est l'horodatage lui-même).
- Symétrie photos : ajouter `base` / `preuve_lien` au tag hors inscription
  (`tremplin_photo_personnes`), à côté de `consentement` / `consentement_le`,
  dans une migration jumelle. Même sémantique.

Rien ne change sur `tremplin_registrations.public` / `public_consent_at` : ils
restent l'état courant ; le journal porte la provenance et l'historique.

## 4. Écritures (lib)

- `setOwnRegistrationVisibility(userId, editionId, isPublic)` → journalise
  TOUJOURS `base = 'self'`, `preuve_lien = NULL`. Inchangé côté appelant.
- `setRegistrationVisibility(registrationId, editionId, isPublic, base='self', preuveLien=null)`
  → à l'OCTROI, l'orga choisit la base et fournit le lien. **La base et la preuve
  ne qualifient que l'octroi** : sur un retrait (`isPublic=false`), la fonction
  force `base='self'` et `preuve_lien=NULL` (un retrait ne « provient » de rien),
  même si des arguments sont passés. Discipline transactionnelle inchangée
  (UPDATE de l'état + INSERT du journal dans la même transaction, rollback si le
  journal échoue — cf. `tremplin-consent-tx.test.ts`).
- La Server Action orga **refuse `base='self'`** et une base absente : l'orga
  atteste un recueil EXTERNE (`formulaire_inscription` / `email` / `autre`) ; le
  cas « la personne elle-même » passe par son espace, pas par l'admin. Le lien de
  preuve est validé et normalisé comme une URL (`optionalUrl`, facultatif).
- `getConsentLog(registrationId)` retourne désormais `base` et `preuveLien` en
  plus de `action` / `createdAt`. Lecture protégée par un repli défensif côté
  pages (migration 037 pas jouée → journal vide, la page s'affiche quand même).
- `ConsentBase` + `isConsentBase` (garde de type PUR) exportés de
  `tremplin-registrations`, réutilisés par l'action et les tests.

## 5. UI

- **Composant mutualisé `ConsentJournal`** : rend le journal en lecture seule,
  côté orga ET côté personne (même vérité). Wording positif : « Accordé le
  JJ/MM/AAAA via le formulaire d'inscription » + lien « voir la preuve »
  (nouvelle fenêtre, `sr-only` RGAA) ; un retrait n'affiche pas d'origine.
- **Sous-page *Visibilité* (orga)** : quand l'orga rend visible, deux champs
  s'ajoutent à la bascule — **base** (sélecteur : formulaire d'inscription /
  e-mail / autre, avec une option vide « Choisis l'origine… » qui force un choix)
  et **lien de preuve** (URL facultative). Reste mono-fonction, un seul CTA
  principal (la bascule) — les champs qualifient le même geste, pas un second
  formulaire. Une carte *Journal de consentement* affiche l'historique dessous.
- **Espace de la personne** : dans la carte « Ma visibilité publique » déjà en
  place (bascule self-service), un bloc « Ton journal de consentement » affiche
  le même historique — elle voit d'où vient son consentement et le révoque quand
  elle veut.

## 6. Hors périmètre

Upload de fichiers de preuve (on stocke des liens), signature électronique,
notification automatique lors d'un changement de base. Reprise historique fine
des entrées `self` déjà journalisées (on les laisse en `self`).
