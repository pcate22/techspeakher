import type { ReactNode } from "react";
import { labelClass } from "@/components/ChampTexte";

export const checkboxClass =
  "accent-cyan rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan";

/**
 * Grille de cases à cocher (secteurs, sujets, régions, langues) : un seul
 * markup pour les quatre taxonomies. Non contrôlée via `defaultSelected`,
 * ou contrôlée via `selected`/`onToggle` (régions, pilotées par le raccourci
 * « Toute la France »). `children` s'insère entre la légende et la grille.
 *
 * Sortie de `ProfileForm` (lot I) : les mêmes taxonomies s'affichent désormais
 * dans l'assistant de création ET sur la page d'UNE section de la fiche.
 */
export default function CheckboxGrid({
  name,
  legend,
  hint,
  options,
  defaultSelected,
  selected,
  onToggle,
  children,
}: {
  name: string;
  legend: string;
  hint?: string;
  options: readonly string[];
  defaultSelected?: string[];
  selected?: Set<string>;
  onToggle?: (option: string) => void;
  children?: ReactNode;
}) {
  return (
    <fieldset>
      <legend className={labelClass}>
        {legend} {hint && <span className="text-gray-light">({hint})</span>}
      </legend>
      {children}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
        {options.map((option) => (
          <label
            key={option}
            className="flex min-h-[44px] items-center gap-2 text-sm text-white bg-navy border border-field-border rounded-lg px-3 py-2 cursor-pointer hover:border-cyan"
          >
            <input
              type="checkbox"
              name={name}
              value={option}
              {...(selected
                ? { checked: selected.has(option), onChange: () => onToggle?.(option) }
                : { defaultChecked: defaultSelected?.includes(option) ?? false })}
              className={checkboxClass}
            />
            {option}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
