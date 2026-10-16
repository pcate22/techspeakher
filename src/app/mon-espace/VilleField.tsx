"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { communeRetenue, memeNomDeCommune, type Commune } from "@/lib/communes";
import { inputClass, labelClass, errorClass } from "@/components/ChampTexte";

/**
 * LES NOMS POSTÉS, parce qu'ils diffèrent d'un formulaire à l'autre : une FICHE
 * parle de « région de résidence » et garde un code postal, une OCCURRENCE
 * parle de « région » et n'a pas de code postal. Les coder en dur ici obligeait
 * le second formulaire à poster les champs du premier — donc à écrire dans des
 * colonnes qui n'existent pas.
 */
export type ChampsCommune = {
  /** Nom du champ de saisie (et racine des ids : label, aide, erreur). */
  ville: string;
  /** Absent = ce formulaire ne stocke pas de code postal. */
  codePostal?: string;
  codeInsee: string;
  region: string;
};

type Props = {
  champs: ChampsCommune;
  label: ReactNode;
  error?: string;
  /**
   * Ville DÉJÀ enregistrée : valeur de départ du champ (mode non piloté), et
   * nom de référence de la géographie ci-dessous — tant que la saisie lui
   * ressemble, cette géographie est reposée telle quelle.
   */
  defaultVille?: string | null;
  defaultCodePostal?: string | null;
  defaultCodeInsee?: string | null;
  defaultRegion?: string | null;
  /**
   * Saisie PILOTÉE de l'extérieur (choisir une conférence pré-remplit la
   * ville). Fournir `value` ET `onChange` ; sinon le champ tient sa valeur
   * lui-même depuis `defaultVille`. Même convention que `ChampTexte`.
   */
  value?: string;
  onChange?: (v: string) => void;
  /**
   * Villes déjà enregistrées, proposées EN PLUS des communes de la BAN. La BAN
   * ne connaît que la France : sans elles, « Bruxelles » se retape en entier à
   * chaque fois, et s'orthographie différemment d'une saisie à l'autre — ce qui
   * éclaterait la facette « ville » de l'agenda.
   */
  villesConnues?: string[];
};

/**
 * Champ « Ville » avec autocomplétion de communes (Base Adresse Nationale, via
 * le proxy same-origin /api/communes). Progressif : le `<datalist>` natif reste
 * accessible et un POST sans JS garde la ville en texte libre. Quand une commune
 * est reconnue SANS ambiguïté, les champs cachés portent sa localisation ;
 * sinon ils restent vides (le serveur les remet à zéro).
 *
 * La règle de reconnaissance est celle du rattrapage géographique
 * (`communeRetenue`), et c'est volontaire : l'écran et le script écrivent dans
 * la même colonne, ils n'ont pas à être d'accord « à peu près ».
 */
export default function VilleField({
  champs,
  label,
  error,
  defaultVille,
  defaultCodePostal,
  defaultCodeInsee,
  defaultRegion,
  value: valeur,
  onChange,
  villesConnues,
}: Props) {
  const [saisie, setSaisie] = useState(defaultVille ?? "");
  const value = valeur ?? saisie;
  const [suggestions, setSuggestions] = useState<Commune[]>([]);

  const id = champs.ville;
  const aideId = `hint-${id}`;
  const erreurId = `err-${id}`;

  // Commune préremplie (édition) : repli tant qu'aucune suggestion fraîche ne
  // correspond à la saisie.
  const initial = useMemo<Commune | null>(
    () =>
      defaultCodeInsee
        ? {
            nom: defaultVille ?? "",
            codePostal: defaultCodePostal ?? "",
            codeInsee: defaultCodeInsee,
            region: defaultRegion ?? "",
          }
        : null,
    [defaultVille, defaultCodePostal, defaultCodeInsee, defaultRegion],
  );

  // Autocomplétion debouncée. Tous les setState vivent dans le timer (différé),
  // jamais dans le corps de l'effet. Réseau en échec → saisie libre conservée.
  useEffect(() => {
    const q = value.trim();
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      if (q.length < 2) {
        setSuggestions([]);
        return;
      }
      try {
        const res = await fetch(`/api/communes?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as { communes?: Commune[] };
        setSuggestions(data.communes ?? []);
      } catch {
        /* réseau : on garde la saisie libre */
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

  // Commune retenue : correspondance UNIQUE et exacte (un homonyme ambigu ne
  // renseigne pas la localisation). Tant que la ville n'a pas changé, ce qui est
  // DÉJÀ enregistré est reposé tel quel — sans quoi ouvrir un formulaire et
  // n'y toucher à rien effacerait la géographie de l'occurrence.
  const resolved = useMemo<Commune | null>(() => {
    if (!value.trim()) return null;
    return (
      communeRetenue(value, suggestions) ??
      (initial && memeNomDeCommune(initial.nom, value) ? initial : null)
    );
  }, [value, suggestions, initial]);

  // Les villes déjà saisies complètent la BAN, sans la doubler.
  const autresVilles = (villesConnues ?? []).filter(
    (v) => !suggestions.some((c) => c.nom === v),
  );

  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input
        id={id}
        name={champs.ville}
        list={`${id}-communes`}
        autoComplete="off"
        value={value}
        onChange={(e) => {
          setSaisie(e.target.value);
          onChange?.(e.target.value);
        }}
        aria-invalid={error ? true : undefined}
        aria-describedby={[error ? erreurId : null, aideId].filter(Boolean).join(" ")}
        placeholder="Toulouse"
        className={inputClass}
      />
      <datalist id={`${id}-communes`}>
        {suggestions.map((c) => (
          <option key={c.codeInsee || c.nom} value={c.nom}>
            {[c.codePostal, c.region].filter(Boolean).join(" · ")}
          </option>
        ))}
        {autresVilles.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
      <p id={aideId} className="text-xs text-gray-light mt-1">
        {resolved?.region
          ? `Région : ${resolved.region}`
          : "On te propose les communes au fil de ta saisie."}
      </p>
      {error && (
        <p id={erreurId} role="alert" className={errorClass}>
          {error}
        </p>
      )}
      {/* Localisation structurée, remplie par l'autocomplétion (repli : vide). */}
      {champs.codePostal && (
        <input type="hidden" name={champs.codePostal} value={resolved?.codePostal ?? ""} />
      )}
      <input type="hidden" name={champs.codeInsee} value={resolved?.codeInsee ?? ""} />
      <input type="hidden" name={champs.region} value={resolved?.region ?? ""} />
    </div>
  );
}
