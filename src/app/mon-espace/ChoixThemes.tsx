"use client";

import { Fragment, useId, useState } from "react";
import { CATEGORIES_THEMES } from "@/data/domaines";
import { checkboxClass } from "@/components/CheckboxGrid";

/**
 * Choix des thèmes en deux niveaux : sept catégories (boutons), une ouverte à
 * la fois, et dessous leurs thèmes en vraies cases à cocher.
 *
 * Une catégorie fermée garde ses cases dans le DOM (`hidden`, pas de
 * démontage) : un thème coché y reste soumis avec le formulaire. Les cases
 * sont contrôlées pour tenir les compteurs et le récapitulatif.
 *
 * Aucun groupe nommé ici : le fieldset et la légende de l'appelant nomment
 * déjà l'ensemble, un second groupe ferait annoncer le nom deux fois.
 */
export default function ChoixThemes({
  name,
  initial,
}: {
  name: string;
  initial: string[];
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
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {CATEGORIES_THEMES.map((c, i) => {
          const nb = c.themes.filter((t) => choisis.has(t)).length;
          const estOuverte = ouverte === c.categorie;
          return (
            <Fragment key={c.categorie}>
              <button
                type="button"
                aria-expanded={estOuverte}
                aria-controls={`${base}-${i}`}
                onClick={() => setOuverte(estOuverte ? null : c.categorie)}
                className={`min-h-[44px] rounded-full border px-4 py-2 text-sm text-white bg-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan hover:border-cyan ${
                  estOuverte || nb > 0 ? "border-cyan" : "border-field-border"
                }`}
              >
                {c.categorie}
                {nb > 0 && (
                  <>
                    <span aria-hidden="true" className="ml-2 font-semibold text-cyan">
                      {nb}
                    </span>
                    <span className="sr-only">
                      , {nb} {nb > 1 ? "thèmes cochés" : "thème coché"}
                    </span>
                  </>
                )}
              </button>
              <fieldset
                id={`${base}-${i}`}
                hidden={!estOuverte}
                className="basis-full"
              >
                <legend className="sr-only">{c.categorie}</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {c.themes.map((theme) => (
                    <label
                      key={theme}
                      className="flex min-h-[44px] items-center gap-2 text-sm text-white bg-navy border border-field-border rounded-lg px-3 py-2 cursor-pointer hover:border-cyan has-[:checked]:border-cyan has-[:checked]:bg-cyan/10 focus-within:ring-2 focus-within:ring-cyan"
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
            </Fragment>
          );
        })}
      </div>

      <p aria-live="polite" className="text-sm text-gray-light">
        {liste.length > 0
          ? `Tes thèmes (${liste.length}) : ${liste.join(", ")}`
          : "Aucun thème choisi."}
      </p>
    </div>
  );
}
