import type { Registration } from "@/lib/tremplin-registrations";
import type { AudienceAtelier } from "@/lib/atelier-audience";
import type { PhaseAtelier } from "@/lib/tremplin-ateliers";
import type { MembershipPhase } from "@/lib/tremplin-registration-phases";

/**
 * Qui peut consulter l'espace d'une édition (`/mon-espace/tremplin/[edition]`) ?
 * Une participante **inscrite** à cette édition, ou une **orga** (prévisualisation).
 * Un compte connecté quelconque ne doit PAS voir les supports d'un Tremplin
 * auquel il ne participe pas.
 */
export function canViewEditionSpace(
  registration: Registration | null,
  isOrga: boolean,
): boolean {
  return registration !== null || isOrga;
}

/**
 * Qui voit UN atelier ? Son AUDIENCE le dit, et elle seule (cf.
 * `src/lib/atelier-audience.ts`). Trois choix exclusifs :
 *
 * - `toutes`    : toute inscrite à l'édition ;
 * - `phase`     : les inscrites rattachées à la phase de l'atelier ;
 * - `selection` : les inscrites nommément désignées.
 *
 * Ce qui a changé, et pourquoi : la liste nominative n'ÉLARGIT plus rien.
 * Auparavant elle cohabitait avec un « ouvert à toutes », et le plus permissif
 * gagnait en silence — désigner une cohorte sur un atelier resté ouvert ne
 * changeait rien pour personne. `membres` ne sert donc plus qu'à l'audience
 * `selection` ; ailleurs, c'est le registre des présences, sans effet sur la
 * visibilité.
 *
 * Repli NON exposant : sans appartenance de phase connue (migration 025 pas
 * jouée), un atelier de phase ne s'ouvre à personne plutôt qu'à tout le monde.
 * Les supports d'atelier suivent la même règle (pas de fuite).
 */
export function atelierVisiblePour(a: {
  audience: AudienceAtelier;
  /** Phase de l'ATELIER (l'audience `phase` désigne ses rattachées). */
  phase: PhaseAtelier;
  /** Ids d'inscription désignés — ne comptent que pour l'audience `selection`. */
  membres: number[];
  registration: Registration | null;
  /** Phases de l'inscrite ; `undefined` = inconnues (repli fermé). */
  phasesDeLInscrite: ReadonlySet<MembershipPhase> | undefined;
  isOrga: boolean;
}): boolean {
  if (a.isOrga) return true;
  if (a.registration === null) return false;
  if (a.audience === "toutes") return true;
  if (a.audience === "phase") return a.phasesDeLInscrite?.has(a.phase) ?? false;
  return a.membres.includes(a.registration.id);
}
