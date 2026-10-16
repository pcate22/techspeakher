/**
 * Statuts d'une adhésion (`user_memberships.status`). Aucune Server Action
 * n'écrit cette table : l'orga la tient à la main dans l'éditeur SQL de Neon
 * (HelloAsso plus tard, cf. docs/conception-synchro-contacts.md). C'est
 * précisément pour ce chemin d'écriture que la liste est fermée par un CHECK
 * en base (migration 073) : une faute de frappe doit être refusée À L'ÉCRITURE,
 * seul chemin étant l'éditeur Neon. À la LECTURE, le statut passe par une liste
 * blanche (`ADHESION_STATUTS_PERIMES`, `src/lib/comptes-inactifs.ts`) : un
 * statut inconnu ÉPARGNE le compte au lieu de le ranger en suppression.
 * Cette constante est le miroir TS que le banc d'intégration confronte au
 * vrai `db/schema.sql` (`listes-fermees-sql.integration.test.ts`).
 */
export const MEMBERSHIP_STATUSES = ["active", "expired"] as const;
