import {
  MOISSONNEUR_TITRE,
  MOISSONNEUR_INTRO,
  MOISSONNEUR_ETAPES,
  MOISSONNEUR_GARANTIES,
} from "@/data/moissonneur";

/**
 * Explication détaillée du moissonneur CFP, repliée par défaut (« Comment ça
 * marche ? »). Contenu statique (src/data/moissonneur.ts) ; réutilisée au profil
 * (au moment du consentement) et dans l'espace membre (près des suggestions).
 */
export default function MoissonneurExplainer({
  className = "",
}: {
  className?: string;
}) {
  return (
    <details className={`group ${className}`}>
      <summary className="flex items-center gap-2 cursor-pointer list-none text-sm font-medium text-cyan rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan">
        <span aria-hidden="true" className="transition-transform group-open:rotate-90">
          ›
        </span>
        {MOISSONNEUR_TITRE}
      </summary>
      <div className="mt-3 flex flex-col gap-4 text-sm text-gray-light">
        <p>{MOISSONNEUR_INTRO}</p>
        <ol className="flex flex-col gap-3 list-none">
          {MOISSONNEUR_ETAPES.map((etape, i) => (
            <li key={etape.titre} className="flex gap-3">
              <span
                aria-hidden="true"
                className="shrink-0 w-6 h-6 rounded-full bg-cyan/15 text-cyan text-xs font-bold flex items-center justify-center"
              >
                {i + 1}
              </span>
              <span>
                <span className="block font-semibold text-white">{etape.titre}</span>
                {etape.detail}
              </span>
            </li>
          ))}
        </ol>
        <ul className="flex flex-col gap-1 list-disc pl-5">
          {MOISSONNEUR_GARANTIES.map((g) => (
            <li key={g}>{g}</li>
          ))}
        </ul>
      </div>
    </details>
  );
}
