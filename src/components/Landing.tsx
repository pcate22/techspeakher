import type { ReactNode } from "react";

/**
 * Les deux blocs communs aux landings (/partenaires, /adherer, /benevole),
 * grille Scalezia : la cible AU-DESSUS de la promesse dans un seul H1 (la
 * petite ligne porte le mot-clé, le lecteur d'écran lit les deux ensemble),
 * puis des questions auxquelles on répond « oui » et la réassurance.
 */
export function LandingHero({
  id,
  cible,
  promesse,
  sousPromesse,
  children,
}: {
  id: string;
  cible: string;
  promesse: string;
  sousPromesse: string;
  /** L'action (ou les deux actions) de la page, et ce qui suit. */
  children: ReactNode;
}) {
  return (
    <section className="py-16 sm:py-24 px-4" aria-labelledby={id}>
      <div className="max-w-3xl mx-auto text-center">
        <h1 id={id} className="mb-6">
          <span className="block text-sm sm:text-base font-semibold text-cyan mb-4">{cible}</span>
          <span className="block text-3xl sm:text-5xl font-extrabold text-white leading-tight">
            {promesse}
          </span>
        </h1>
        <p className="text-gray-light max-w-2xl mx-auto mb-8 leading-relaxed">{sousPromesse}</p>
        {children}
      </div>
    </section>
  );
}

export function QuestionsOui({
  questions,
  reassurance,
  fonce = false,
}: {
  questions: readonly string[];
  reassurance: readonly string[];
  /** Section sur fond clair (`bg-navy-light`), cartes sur fond sombre. */
  fonce?: boolean;
}) {
  return (
    <section className={`py-16 px-4 ${fonce ? "bg-navy-light" : ""}`} aria-labelledby="reconnaissez-title">
      <div className="max-w-3xl mx-auto">
        <h2 id="reconnaissez-title" className="text-2xl font-bold text-center mb-8">
          Vous vous <span className="text-magenta">reconnaissez</span>&nbsp;?
        </h2>
        <ul className="space-y-4 list-none mb-10" role="list">
          {questions.map((q) => (
            <li
              key={q}
              className={`flex gap-3 ${fonce ? "bg-navy" : "bg-navy-light"} border border-navy-lighter rounded-xl p-5 text-white`}
            >
              <span className="text-cyan font-bold" aria-hidden="true">✓</span>{" "}
              <span>{q}</span>
            </li>
          ))}
        </ul>
        {reassurance.map((p) => (
          <p key={p} className="text-gray-light leading-relaxed mb-4">{p}</p>
        ))}
      </div>
    </section>
  );
}
