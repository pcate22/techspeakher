# Implémentation — provenance et journal du consentement à la diffusion

> Suit `docs/conception-autorisation-diffusion.md`. Deux phases : la phase 1
> (consentement des **inscriptions**) est livrée ; la phase 2 (symétrie sur le
> consentement **photo**) est cadrée ici en fast-follow.

## Phase 1 — consentement des inscriptions (livré)

### Base de données (migration 037, additive)

`db/migrations/037_consent_provenance.sql` + reflet dans `schema.sql` et
`sync-to-latest.sql` (CREATE à jour pour les bases fraîches + `ALTER … ADD
COLUMN IF NOT EXISTS` idempotent pour les bases existantes) :

```sql
ALTER TABLE tremplin_consent_log
  ADD COLUMN IF NOT EXISTS base TEXT NOT NULL DEFAULT 'self'
    CHECK (base IN ('self', 'formulaire_inscription', 'email', 'autre'));
ALTER TABLE tremplin_consent_log
  ADD COLUMN IF NOT EXISTS preuve_lien TEXT;
```

Rétro-compatible : les entrées existantes prennent `base='self'`, `preuve_lien
NULL`. Aucune colonne retirée, aucun type changé → revert du code sûr.

### Accès données (`src/lib/tremplin-registrations.ts`)

- `ConsentBase` (`'self' | 'formulaire_inscription' | 'email' | 'autre'`),
  `CONSENT_BASES`, `isConsentBase` (garde de type pure).
- `setRegistrationVisibility(…, base='self', preuveLien=null)` : à l'octroi,
  journalise la base + le lien ; au retrait, force `'self'` / `NULL`.
- `setOwnRegistrationVisibility` : journalise toujours `'self'` / `NULL`.
- `getConsentLog` : renvoie `base` + `preuveLien` (+ `action`, `createdAt`).

### Server Action (`src/app/admin/tremplins/actions.ts`)

`setRegistrationVisibilityAction` : à l'octroi, lit `base` (refuse une base
absente ou `'self'` — l'orga atteste un recueil externe) et `preuveLien`
(validé/normalisé par `optionalUrl`). Identité orga vérifiée (`requireOrgaId`),
scope édition conservé, SQL paramétré. Le self-service
(`setMaVisibiliteAction`) est inchangé.

### UI

- `src/components/ConsentJournal.tsx` : composant présentational mutualisé
  (lecture seule, wording positif, lien de preuve en nouvelle fenêtre `sr-only`).
- Sous-page *Visibilité* orga : champs base + lien de preuve à l'octroi ; carte
  *Journal de consentement*. Lecture du journal avec repli défensif (migration
  037 pas jouée → journal vide).
- Espace participante (`mon-espace/tremplin/[edition]`) : bloc « Ton journal de
  consentement » dans la carte visibilité existante ; lecture ajoutée au batch
  parallèle avec repli défensif.

### Tests (TDD)

- `tremplin-db.integration.test.ts` : provenance journalisée à l'octroi
  (base + preuveLien), forcée à `self`/`NULL` au retrait ; self-service en
  `self`.
- `actions-tremplin.test.ts` : octroi sans base / base=self refusés ; lien
  normalisé ; retrait en `self`/`NULL`.
- `consent-journal.test.tsx` : wording positif, lien de preuve (nouvelle
  fenêtre), retrait sans origine, repli vide.
- `tremplin-consent-tx.test.ts` (existant) : atomicité inchangée.

### Mise en prod (ordre impératif)

Les migrations **ne sont pas auto-appliquées** (cf. `docs/exploitation.md`).
Comme le code lit les nouvelles colonnes, l'ordre est :

1. **Neon (prod)** : exécuter `db/migrations/037_consent_provenance.sql` (ou
   `db/sync-to-latest.sql`, idempotent) dans l'éditeur SQL **avant** le merge.
2. Merger sur `main` → deploy auto Vercel.

Le repli défensif rend l'inversion non catastrophique (journal vide au lieu
d'une page cassée), mais l'écriture (octroi/retrait) échouerait tant que les
colonnes manquent : appliquer la migration d'abord.

## Phase 2 — symétrie photo (fast-follow, à faire)

Le consentement à l'image des tags photo hors inscription
(`tremplin_photo_personnes.consentement` / `consentement_le`) n'a qu'un **état
courant**, sans historique ni provenance. Pour la parité avec les inscriptions :

- migration jumelle : `base` + `preuve_lien` sur le tag (ou un petit journal
  `tremplin_photo_consent_log` si on veut l'historique complet des retraits) ;
- fiche photo : sélecteur de base + lien de preuve à l'attestation, journal en
  lecture ;
- réutiliser `ConsentJournal` (adapter la source des entrées).

Séparé car : autre table, autre écran (fiche photo), et le besoin urgent
(diffusion Tremplin 1) est couvert par la phase 1. Pas de dépendance technique
entre les deux.

## Hors périmètre (rappel conception §6)

Upload de fichiers de preuve (on stocke des liens), signature électronique,
table d'audit générique, registre des traitements art. 30 (document séparé).
