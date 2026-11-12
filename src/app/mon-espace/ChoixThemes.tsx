"use client";

import { useId, useState } from "react";
import { CATEGORIES_THEMES } from "@/data/domaines";
import { checkboxClass } from "@/components/CheckboxGrid";

/**
 * Choix des thèmes en deux niveaux : sept catégories (boutons), une ouverte à
 * la fois, et dessous leurs thèmes en vraies cases à cocher.
 *
 * Une catégorie fermée garde ses cases dans le DOM (`hidden`, pas de
 * démontage) : un thème coché y reste soumis avec le formulaire. Les cases
 * sont contrôlées pour tenir les compteurs et le récapitulatif.
 */
export default function ChoixThemes({
  name,
  initial,
  legendId,
}: {
  name: string;
  initial: string[];
  legendId: string;
}) {
  const base = useId();
  const [choisis, setChoisis] = useState<Set<string>>(() => new Set(initial));
  const [ouverte, setOuverte] = useState<string | null>(null);

  function basculer(theme: string) {
    setChoisis((prev) => {
      const next = new Set(prev);
      if (!next.delete(theme)) next.add(theme);
      return next;
    });
  }

  const liste = CATEGORIES_THEMES.flatMap((c) =>
    c.themes.filter((t) => choisis.has(t)),
  );

  return (
    <div role="group" aria-labelledby={legendId} className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {CATEGORIES_THEMES.map((c, i) => {
          const nb = c.themes.filter((t) => choisis.has(t)).length;
          const estOuverte = ouverte === c.categorie;
          return (
            <button
              key={c.categorie}
              type="button"
              aria-expanded={estOuverte}
              aria-controls={`${base}-${i}`}
              onClick={() => setOuverte(estOuverte ? null : c.categorie)}
              className={`min-h-[44px] rounded-full border px-4 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan hover:border-cyan ${
                estOuverte || nb > 0
                  ? "border-cyan bg-navy"
                  : "border-field-border bg-navy"
              }`}
            >
              {c.categorie}
              {nb > 0 && <span className="ml-2 font-semibold text-cyan">{nb}</span>}
            </button>
          );
        })}
      </div>

      {CATEGORIES_THEMES.map((c, i) => (
        <fieldset
          key={c.categorie}
          id={`${base}-${i}`}
          hidden={ouverte !== c.categorie}
        >
          <legend className="sr-only">{c.categorie}</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {c.themes.map((theme) => (
              <label
                key={theme}
                className="flex min-h-[44px] items-center gap-2 text-sm text-white bg-navy border border-field-border rounded-lg px-3 py-2 cursor-pointer hover:border-cyan"
              >
                <input
                  type="checkbox"
                  name={name}
                  value={theme}
                  checked={choisis.has(theme)}
                  onChange={() => basculer(theme)}
                  className={checkboxClass}
                />
                {theme}
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      <p aria-live="polite" className="text-sm text-gray-light">
        Tes thèmes ({liste.length}){liste.length > 0 && ` : ${liste.join(", ")}`}
      </p>
    </div>
  );
}
