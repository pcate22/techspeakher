import Link from "next/link";
import { nb } from "@/lib/format";
import type { AnneeArchive } from "@/lib/agenda-public";

/**
 * Les portes vers les comptes rendus d'année, depuis l'horizon comme depuis une
 * autre année. Chaque année dit **ce qu'elle porte** : un lien nu (« 2025 »)
 * laisse deviner s'il y a deux interventions ou quarante, et une facette qui
 * n'annonce pas son rendement fait cliquer dans le vide.
 *
 * Aucun seuil : une année existe dès UNE intervention (décision du 2026-08-16).
 * Le passé se remplit à retardement, à mesure que les speakeuses complètent
 * leur fiche — masquer une année maigre reviendrait à cacher la page pendant
 * qu'elle grandit.
 */
export default function ArchiveLiens({
  annees,
  actuelle,
}: {
  annees: AnneeArchive[];
  /** Année déjà affichée, à montrer comme repère plutôt que comme lien. */
  actuelle?: number;
}) {
  if (annees.length === 0) return null;
  return (
    <ul role="list" className="flex list-none flex-wrap gap-2">
      {annees.map(({ annee, nombre }) => {
        const compte = nb(nombre, "intervention");
        if (annee === actuelle) {
          return (
            <li key={annee}>
              <span
                aria-current="page"
                className="inline-flex items-center gap-2 rounded-full border border-cyan bg-navy-lighter px-4 py-2 text-sm font-bold text-white"
              >
                {annee}
                <span className="text-xs font-semibold text-cyan">{compte}</span>
              </span>
            </li>
          );
        }
        return (
          <li key={annee}>
            <Link
              href={`/agenda/${annee}`}
              // Le compte fait partie du nom accessible : « 2025, 15
              // interventions » se comprend seul dans une liste de liens.
              aria-label={`${annee}, ${compte}`}
              className="inline-flex items-center gap-2 rounded-full border border-field-border px-4 py-2 text-sm font-bold text-white transition-colors hover:border-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
            >
              {annee}
              <span aria-hidden="true" className="text-xs font-semibold text-gray-light">
                {compte}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
