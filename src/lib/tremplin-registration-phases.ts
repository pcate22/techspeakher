import { pool, type Queryable } from "@/lib/db";
import { siTableAbsente } from "@/lib/pg-errors";

/**
 * Appartenance MULTI-PHASE d'une inscription (cf. docs/conception-phases-tremplin.md).
 *
 * Une inscription peut participer à plusieurs phases, avec des rosters
 * différents par phase. Cette table de liaison gère les phases 1 (préparation
 * au CFP) et 3 (préparation à la conférence). La phase 2 (finale) reste pilotée
 * par `finale_presente` — source de vérité unique du roster de la soirée, dont
 * dépend déjà la galerie publique (pas de double source).
 */
// Types et libellés : partie PURE, extraite dans `tremplin-phases.ts` pour
// qu'un composant CLIENT puisse les lire sans tirer `pg` dans son bundle.
// Ré-exportés ici : les appelants existants n'ont rien à changer.
export {
  isMembershipPhase,
  MEMBERSHIP_PHASE_LABEL,
  MEMBERSHIP_PHASES,
} from "@/lib/tremplin-phases";
export type { MembershipPhase } from "@/lib/tremplin-phases";

import type { MembershipPhase } from "@/lib/tremplin-phases";

/**
 * Quelles sections « finale » (phase 2) montrer dans l'espace membre, SANS les
 * mélanger avec la phase 3 (montée sur scène). Règle produit :
 * - `showPitch` (pitch DE FINALE) : sur le chemin finale = phase 1
 *   (`cfp_et_pitch`) OU finaliste confirmée.
 * - `showVisibility` (visibilité GALERIE des finalistes) : finaliste confirmée
 *   uniquement.
 * Une inscrite seulement en phase 3 non finaliste ne voit donc ni l'un ni
 * l'autre. Repli non exposant si l'appartenance de phase est inconnue.
 */
export function espaceFinaleSections(
  registration: { finalePresente: boolean | null } | null,
  phases: ReadonlySet<MembershipPhase> | undefined,
): { showPitch: boolean; showVisibility: boolean } {
  if (!registration) return { showPitch: false, showVisibility: false };
  const finaliste = registration.finalePresente === true;
  const enPhaseCfp = phases?.has("cfp_et_pitch") ?? false;
  return { showPitch: enPhaseCfp || finaliste, showVisibility: finaliste };
}

/**
 * Ajoute l'appartenance de phase d'une inscription fraîchement créée, dérivée de
 * sa phase D'ENTRÉE (mono-phase historique) — même logique que le backfill de
 * la migration 025 : une entrée « montée sur scène » appartient à la phase 3 ;
 * toute autre entrée (CFP, finale) appartient à la phase 1 (phase 2 ⊂ phase 1).
 * Idempotent ; passe le handle de transaction pour rester atomique avec
 * l'inscription. `entryPhase` est une chaîne libre (évite un cycle d'import) :
 * seule « montee_sur_scene » est distinguée.
 */
export async function seedDefaultPhaseMembership(
  registrationId: number,
  entryPhase: string = "cfp_et_pitch",
  db: Queryable = pool,
): Promise<void> {
  const phase: MembershipPhase =
    entryPhase === "montee_sur_scene" ? "montee_sur_scene" : "cfp_et_pitch";
  await db.query(
    `INSERT INTO tremplin_registration_phases (registration_id, phase)
     VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [registrationId, phase],
  );
}

/**
 * Appartenances (phases 1 et 3) de toutes les inscriptions d'une édition, en une
 * requête (anti N+1). Map inscription → ensemble de ses phases d'appartenance.
 * La phase 2 (finale) n'y figure pas : elle se lit sur `finale_presente`.
 */
export async function getPhaseMembersByEdition(
  editionId: number,
): Promise<Map<number, Set<MembershipPhase>>> {
  const { rows } = await pool.query(
    `SELECT rp.registration_id, rp.phase
       FROM tremplin_registration_phases rp
       JOIN tremplin_registrations r ON r.id = rp.registration_id
      WHERE r.edition_id = $1
        AND rp.phase IN ('cfp_et_pitch', 'montee_sur_scene')`,
    [editionId],
  );
  const map = new Map<number, Set<MembershipPhase>>();
  for (const row of rows as { registration_id: number; phase: MembershipPhase }[]) {
    const set = map.get(row.registration_id) ?? new Set<MembershipPhase>();
    set.add(row.phase);
    map.set(row.registration_id, set);
  }
  return map;
}

/**
 * Les appartenances de phase, ou une map VIDE si la table n'est pas encore
 * migrée. Le repli vit ICI, au bord (principes §7), et plus dans chaque page :
 * plusieurs vues recopiaient le même `catch` — qui avalait au passage TOUTE
 * erreur base, pas seulement la migration en attente.
 */
export function getPhaseMembersOuVide(
  editionId: number,
): Promise<Map<number, Set<MembershipPhase>>> {
  return getPhaseMembersByEdition(editionId).catch(
    siTableAbsente(new Map<number, Set<MembershipPhase>>()),
  );
}

/**
 * Phases d'UNE inscription. Lecture ciblée pour les pages qui n'ont besoin que
 * d'elle (la visibilité d'un atelier de phase, par exemple) : charger la carte
 * de toute l'édition pour une seule ligne serait du gaspillage, et exposerait
 * l'appartenance des autres à un code qui n'en a pas l'usage.
 */
export async function getPhasesForRegistration(
  registrationId: number,
): Promise<Set<MembershipPhase>> {
  const { rows } = await pool.query(
    `SELECT phase FROM tremplin_registration_phases
      WHERE registration_id = $1 AND phase IN ('cfp_et_pitch', 'montee_sur_scene')`,
    [registrationId],
  );
  return new Set((rows as { phase: MembershipPhase }[]).map((r) => r.phase));
}

/**
 * Cohorte d'une phase encore à ajouter à un atelier : les inscriptions qui
 * appartiennent à `phase` mais ne sont pas déjà membres. PUR (pas d'accès base) :
 * même règle pour le compteur/libellé côté UI et pour la cible côté action
 * (#29 « Activer toutes »), une seule définition à faire évoluer. La cible de
 * l'action reste alors `[...membresActuels, ...cohorteAAjouter(...)]` (union
 * sans doublon, puisque la cohorte exclut déjà les membres actuels).
 */
export function cohortePhaseAAjouter(
  phaseMembers: ReadonlyMap<number, ReadonlySet<MembershipPhase>>,
  phase: MembershipPhase,
  membresActuels: Iterable<number>,
): number[] {
  const dejaMembre = new Set(membresActuels);
  return [...phaseMembers.entries()]
    .filter(([regId, phases]) => phases.has(phase) && !dejaMembre.has(regId))
    .map(([regId]) => regId);
}

/**
 * Ajoute ou retire une appartenance de phase (1 ou 3) pour une inscription.
 * Scopé à l'édition (`edition_id = $2`) : on ne touche jamais une inscription
 * d'une autre édition, même avec un id forgé. L'ajout est idempotent
 * (`ON CONFLICT DO NOTHING`). Renvoie `false` si l'inscription n'appartient pas
 * à l'édition (0 ligne vérifiée).
 */
export async function setRegistrationPhaseMembership(
  registrationId: number,
  editionId: number,
  phase: MembershipPhase,
  present: boolean,
): Promise<boolean> {
  const scope = await pool.query(
    `SELECT 1 FROM tremplin_registrations WHERE id = $1 AND edition_id = $2`,
    [registrationId, editionId],
  );
  if (scope.rows.length === 0) return false;
  if (present) {
    await pool.query(
      `INSERT INTO tremplin_registration_phases (registration_id, phase)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [registrationId, phase],
    );
  } else {
    await pool.query(
      `DELETE FROM tremplin_registration_phases
        WHERE registration_id = $1 AND phase = $2`,
      [registrationId, phase],
    );
  }
  return true;
}

/**
 * Les phases sur lesquelles CETTE inscription a consenti à être NOMMÉE
 * publiquement (migration 055).
 *
 * Lecture ciblée : la fiche d'une participante n'a besoin que d'elle, et
 * charger la carte de toute l'édition exposerait l'accord des autres à un écran
 * qui n'en a pas l'usage.
 */
export async function getPhasesPubliquesForRegistration(
  registrationId: number,
): Promise<Set<MembershipPhase>> {
  const { rows } = await pool.query(
    `SELECT phase FROM tremplin_registration_phases
      WHERE registration_id = $1 AND "public" = true
        AND phase IN ('cfp_et_pitch', 'montee_sur_scene')`,
    [registrationId],
  );
  return new Set((rows as { phase: MembershipPhase }[]).map((r) => r.phase));
}

/**
 * Recueille (ou retire) l'accord d'être NOMMÉE sur la page publique d'une phase.
 *
 * Scopé à l'édition comme son voisin : un id forgé ne publie pas l'inscrite
 * d'une autre édition. L'accord s'horodate (`public_consent_at`) pour être
 * démontrable, et le retrait l'efface — on ne garde pas la trace d'un accord
 * qui n'a plus cours.
 *
 * L'APPARTENANCE doit exister : cocher l'accord d'une phase à laquelle
 * l'inscrite n'est pas rattachée ne crée pas le rattachement en douce (0 ligne
 * touchée → `false`). C'est l'ordre des gestes à l'écran : on rattache, puis on
 * demande l'accord.
 */
export async function setRegistrationPhasePublic(
  registrationId: number,
  editionId: number,
  phase: MembershipPhase,
  consent: boolean,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    // Sous-requête plutôt qu'un alias d'UPDATE : même effet, et la forme reste
    // lisible par pg-mem (les tests d'intégration jouent ce SQL).
    `UPDATE tremplin_registration_phases
        SET "public" = $4, public_consent_at = CASE WHEN $4 THEN now() END
      WHERE registration_id = $1 AND phase = $3
        AND registration_id IN (
          SELECT id FROM tremplin_registrations WHERE edition_id = $2)`,
    [registrationId, editionId, phase, consent],
  );
  return (rowCount ?? 0) > 0;
}
