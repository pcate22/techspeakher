/** Indicateur d'étapes réutilisable et accessible (assistant / stepper). */
export default function StepIndicator({
  current,
  steps,
}: {
  current: number;
  steps: string[];
}) {
  // UNE seule ligne, à toutes les tailles. Sur mobile, la version verticale
  // (une étape par ligne) mangeait tout le premier écran : sous le titre et son
  // intro, plus aucun champ visible. On garde donc la rangée de pastilles et on
  // ne nomme à l'œil que l'étape courante ; les autres libellés restent dans le
  // DOM (`sr-only`) pour les lecteurs d'écran, et réapparaissent dès `sm`.
  return (
    <ol
      // `role="list"` explicite : WebKit/VoiceOver retire la sémantique de liste
      // dès `list-style: none`, et les numéros de pastille sont `aria-hidden` —
      // la position dans le parcours serait perdue (jsdom ne le voit pas).
      role="list"
      aria-label="Progression"
      className="flex flex-wrap items-center gap-2 sm:gap-x-1 list-none mb-6"
    >
      {steps.map((label, i) => {
        const done = i < current;
        const isCurrent = i === current;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={`w-6 h-6 shrink-0 rounded-full border flex items-center justify-center text-xs font-bold ${
                done
                  ? "bg-cyan/15 text-cyan border-cyan/50"
                  : isCurrent
                    ? "bg-magenta text-navy border-magenta"
                    : "bg-navy border-field-border text-gray-light"
              }`}
            >
              {done ? "✓" : i + 1}
            </span>
            <span
              aria-current={isCurrent ? "step" : undefined}
              className={`text-sm ${
                isCurrent
                  ? "text-white font-medium"
                  : "text-gray-light sr-only sm:not-sr-only"
              }`}
            >
              {label}
              {done && <span className="sr-only"> (terminée)</span>}
            </span>
            {i < steps.length - 1 && (
              <span aria-hidden="true" className="hidden sm:inline text-gray-light mx-1">
                ›
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
