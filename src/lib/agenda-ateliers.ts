import { estPasse } from "@/lib/tremplin-statut";
import { trierAteliersParDate } from "@/lib/tremplin-ateliers";
import { grouperPar, type Tranche } from "@/lib/groupement";

/**
 * La liste des ateliers vue en AGENDA (lot F, refonte §4) : chronologie, mois
 * en repère, passé à part (replié à l'affichage), « à dater » en fin. Remplace
 * le groupement par phase, qui coupait le temps en deux et obligeait à lire
 * deux sections pour savoir ce qui vient (la phase reste dite en pastille).
 *
 * Fonction PURE : la page fournit la liste et le jour, on ne fait que ranger —
 * avec le tri (`trierAteliersParDate`) et le groupement (`grouperPar`) déjà
 * partagés, aucun comparateur local.
 */

/** Le minimum pour ranger un atelier dans l'agenda. */
export interface AtelierAgenda {
  id: number;
  date: string | null;
  dateFin: string | null;
  /** Ordre de saisie : départage deux activités du même jour (tri stable). */
  ordre: number;
}

/** Un mois d'agenda : sa clé YYYY-MM (l'affichage la met en français via
 * `moisAgendaFr`) et ses ateliers. */
export type MoisAteliers<T> = Tranche<T, string>;

export interface AgendaAteliers<T> {
  /** À venir, groupés par mois, du plus proche au plus lointain. */
  moisAVenir: MoisAteliers<T>[];
  /** Passés, du plus récent au plus ancien (on remonte le fil). */
  passes: T[];
  /** Sans date : ils attendent une décision, pas une place dans le temps. */
  aDater: T[];
}

export function agendaAteliers<T extends AtelierAgenda>(
  ateliers: readonly T[],
  aujourdhui: string,
): AgendaAteliers<T> {
  // Le tri partagé range déjà les datés en chronologie puis les « à dater » en
  // fin, chaque groupe départagé par `ordre` puis `id`.
  const tries = trierAteliersParDate(ateliers);
  const aDater = tries.filter((x) => !x.date);
  const dates = tries.filter((x) => x.date);
  // « Passé » = sa FIN effective l'est (une fenêtre en cours reste à venir) :
  // même définition partagée que l'agenda personnel et le moteur de tâches.
  const passes = dates.filter((x) => estPasse(x, aujourdhui)).reverse();
  const aVenir = dates.filter((x) => !estPasse(x, aujourdhui));

  return { moisAVenir: grouperPar(aVenir, (x) => x.date!.slice(0, 7)), passes, aDater };
}
