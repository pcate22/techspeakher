# Conception — Suppression d'une édition de Tremplin

> **Mise à jour 2026-07-26 — ce document décrit l'état d'avant les paliers.**
> La suppression d'une édition est passée au **palier 3 quel que soit le statut**
> (cf. `principes-conception-ui.md` §10) : une édition « en préparation » part en
> hard delete cascadant, elle efface donc PLUS qu'une publiée, qui garde un
> tombstone. Le nom est retapé et revérifié serveur **dans les deux cas**, avec
> le repli commun `plierConfirmation` (et non plus une comparaison stricte).
> `DeleteEditionDialog` a été supprimé au profit du `ConfirmSubmitButton`
> partagé. Les passages ci-dessous qui conditionnent la garde au statut, ou qui
> citent `DeleteEditionDialog`, sont **périmés**.


> Statut : conception (technique + implémentation), **décisions orga tranchées**
> (2026-07-06), après revues simplify + risques. À implémenter en TDD.
> Contexte : l'orga doit pouvoir supprimer une édition (erreur, édition de test,
> doublon). Action rare et destructive.

## 1. Besoin & décisions

Depuis la fiche d'une édition (`/admin/tremplins/[edition]`), l'orga supprime
l'édition. **Deux comportements selon que l'édition est publique ou non** (une
édition `preparation` n'a jamais d'URL publique ; une édition publiée oui, et ses
liens peuvent vivre ailleurs — e-mails d'invitation, site DevFest, index) :

| Édition | Suppression | URL publique après |
| --- | --- | --- |
| **`preparation`** (jamais publiée) | **hard-delete** (ligne + cascade) | n'existe pas |
| **publiée** (`ouvert`/`en_cours`/`clos`/`archive`) | **soft-delete** : efface les données (perso comprises) mais **garde la coquille** | **tombstone** « Cette édition a été supprimée » |

Arbitrages tranchés :
1. **Friction** : modale maison (`ConfirmSubmitButton`) pour une édition en
   préparation ; **type-to-confirm (saisir le nom)** pour une édition **publiée**.
2. **Édition publiée** : suppression autorisée, mais en **soft-delete + tombstone**
   (pas de 404 : l'URL répond « supprimée », en 410).
3. **Comptes orphelins** : **ménage RGPD** — après suppression, on efface les
   comptes devenus totalement orphelins (invités jamais connectés : e-mail seul,
   sans profil, sans autre rattachement/adhésion/coaching).
4. **Garde « aucune inscrite »** : non.

## 2. Modèle technique

### Marqueur
Migration **026** : `ALTER TABLE tremplin_editions ADD COLUMN deleted_at TIMESTAMPTZ`
(NULL par défaut). Orthogonal au `statut`. `NOT NULL` = tombstone.

### Hard-delete (édition en préparation)
`DELETE FROM tremplin_editions WHERE id = $1`. Toutes les FK du sous-arbre sont
`ON DELETE CASCADE` (vérifié `schema.sql`, aucune `RESTRICT`) → inscrites, phases,
présences, journal de consentement, ateliers, coachs, récompenses, jury,
documents, photos, tags partent. Aucune URL publique → rien à préserver.

### Soft-delete (édition publiée)
Dans **une transaction** :
1. Efface les **données filles** (perso comprises) par `edition_id` :
   `tremplin_registrations` (→ cascade phases/présences/consentement/tags/coachs),
   `tremplin_ateliers`, `tremplin_jury`, `tremplin_recompenses`,
   `tremplin_documents`, `tremplin_photos`. RGPD : plus aucune donnée personnelle.
2. `UPDATE tremplin_editions SET deleted_at = now() WHERE id = $1` — garde la
   **coquille non-personnelle** (nom, conf_slug, annee, conf_nom) pour le tombstone.
3. **Ménage des comptes orphelins** (cf. §2.4).

### 2.4 Ménage RGPD des comptes orphelins
Après suppression (hard OU soft), supprimer les `users` devenus **totalement
orphelins** — définis strictement pour ne jamais toucher un vrai membre :
aucun `speaker_profiles`, aucun `user_memberships`, aucune `tremplin_registrations`,
aucun `tremplin_atelier_coachs`/`tremplin_registration_coachs`, et `is_orga = false`.
(Les `accounts`/`sessions` cascadent depuis `users`.) Ce sont les stubs créés par
`getOrCreateUserByEmail` lors d'une invitation jamais honorée. `DELETE ... WHERE
id IN (SELECT ... NOT EXISTS ...)`, scellé dans la même transaction que la suppression.

## 3. Garde-fous serveur

1. `requireOrgaId()` — `is_orga` est **global** (pas d'appartenance par édition →
   pas d'IDOR) ; l'`editionId` du client ne fait que désigner la cible.
2. **Type-to-confirm revérifié serveur UNIQUEMENT pour une édition publiée** :
   l'action recharge l'édition ; si publiée et `confirmation.trim() !== nom` →
   refus (`redirect(base + "?err=edition_nom")`). Pour une édition en préparation,
   pas de saisie (la modale maison suffit). *(La revue simplify notait la re-
   vérification comme « théâtre » en général ; on ne la garde donc QUE là où l'UI
   l'exige — édition publiée avec type-to-confirm — pour que la garde serveur soit
   cohérente avec le contrat client, pas comme contrôle de sécurité.)*
3. **PRG** : succès → `redirect("/admin/tremplins")`. Introuvable (double-submit,
   course) → `redirect("/admin/tremplins?err=edition")` (jamais la fiche → 404).
4. **Révalidation** = le même jeu que `updateEditionAction` : `/admin/tremplins`,
   `PUBLIC_EDITION_ROUTE` (page), `/tremplin/[conf]` (page), `/devfest-toulouse`.

## 4. UX de confirmation

Zone danger (`CarteSection` « Supprimer l'édition », texte orange) en bas de
`[edition]/page.tsx`. Le message annonce le **périmètre chiffré** (compteurs déjà
chargés par la fiche) : « Supprime définitivement **N participantes, N ateliers,
N photos**, le jury et les récompenses de « {nom} ». Irréversible. »

- **Édition en préparation** → `ConfirmSubmitButton` (modale maison à deux temps),
  pas de saisie.
- **Édition publiée** → composant `DeleteEditionDialog` (client) : même chrome,
  mais **champ où taper le nom** + bouton rouge actif seulement si la saisie = nom,
  et le message précise que l'URL publique affichera « supprimée » (plus 404).
  A11y : vrai `<label>`, `aria-describedby` sur la consigne, `role="alert"` pour
  l'erreur ; **bouton en `aria-disabled`** (focusable, annoncé) plutôt que `disabled`
  matériel — validation à la soumission.

## 5. Tombstone public

`getPublicEdition` : si `deleted_at` non nul → renvoyer un **sentinel** `"deleted"`
(distinct de `null`). La page `/tremplin/[conf]/[annee]` :
- `null` (inexistante ou `preparation`) → `notFound()` (404, inchangé) ;
- `"deleted"` → rend une page sobre « **Cette édition a été supprimée.** » + lien
  vers le hub de la conférence. Page **hors index** (`robots: noindex` via
  `generateMetadata`) — un vrai `410` n'est pas atteignable proprement depuis un
  Server Component (il faudrait un route handler/middleware) ; le `noindex` suffit
  à la déréférencer.

Le hub conf (`getEditionsByConfSlug`) et l'admin (`listEditions`) **excluent** les
éditions `deleted_at IS NOT NULL` (elles ne sont plus listées ni éditables ; seule
leur URL directe rend le tombstone).

## 6. Conception d'implémentation (lots, TDD)

1. **Migration 027** (`deleted_at`) : `schema.sql` + `sync-to-latest.sql`
   (idempotent `ADD COLUMN IF NOT EXISTS`) + `db/migrations/026_*.sql`.
2. **lib** (`tremplin-editions.ts`) : `deleteEdition(editionId): Promise<DeleteOutcome>`
   (`"hard" | "soft" | "introuvable"`), transaction, choisit hard/soft selon le
   statut, + ménage orphelins ; `listEditions`/`getEditionsByConfSlug`/
   `getPublicEdition` filtrent/signalent `deleted_at`. Tests intégration pg-mem :
   hard (prep → tout parti) ; soft (publiée → données filles + perso parties,
   coquille + `deleted_at` restent, autre édition intacte) ; orphelins nettoyés
   mais **vrai membre conservé** ; introuvable.
3. **action** `deleteEditionAction` (garde orga ; type-to-confirm serveur si
   publiée ; PRG ; révalidation §3.4 ; message `edition`/`edition_nom`). Tests unit.
4. **UI** : zone danger `[edition]/page.tsx` (modale maison si prep,
   `DeleteEditionDialog` si publiée) ; tombstone sur la page publique.
5. **Revue** (sécurité / RGPD / UX / a11y / KISS) puis livraison + SQL migration 027.
