/**
 * État standard des Server Actions « à résultat » (modales à saisie chaînée,
 * via `useActionState`) : pas de redirect, la modale reste ouverte.
 *
 * `values` sur l'erreur : React 19 RÉINITIALISE le formulaire non contrôlé à
 * chaque soumission, même en échec. Pour ne pas perdre la saisie de l'orga,
 * l'action renvoie les valeurs soumises et les champs les réutilisent en
 * `defaultValue` (le reset de React ré-applique les defaultValue courants).
 */

export type FormValues = Record<string, string | string[]>;

export type ActionState<S extends object = object> =
  | { status: "idle" }
  | ({ status: "success" } & S)
  | { status: "error"; error: string; values: FormValues };

export const IDLE: { status: "idle" } = { status: "idle" };

/** Capture les champs texte d'un FormData (multi-valeurs → tableau). */
export function formValues(formData: FormData): FormValues {
  const out: FormValues = {};
  for (const key of new Set(formData.keys())) {
    const all = formData.getAll(key).filter((v): v is string => typeof v === "string");
    if (all.length === 0) continue;
    out[key] = all.length === 1 ? all[0] : all;
  }
  return out;
}

/** Valeur simple d'un champ à restaurer (`defaultValue`), sinon "". */
export function restoredValue(state: ActionState<object>, name: string): string {
  if (state.status !== "error") return "";
  const v = state.values[name];
  return typeof v === "string" ? v : "";
}

/**
 * Valeur INITIALE d'un champ non contrôlé : la saisie restaurée SUR ERREUR
 * (React 19 vide le formulaire à chaque soumission), sinon la valeur par
 * défaut fournie. Encapsule le piège de `restoredValue` (qui renvoie "" hors
 * erreur, jamais undefined) : un `restoredValue(...) ?? defaut` n'appliquerait
 * JAMAIS le défaut et écraserait la donnée à l'enregistrement. Passer par ce
 * helper évite de recopier le garde `status === "error" ? … : …` partout.
 */
export function champInitial(
  state: ActionState<object>,
  name: string,
  defaut = "",
): string {
  return state.status === "error" ? restoredValue(state, name) : defaut;
}

/** Vrai si `value` fait partie des valeurs soumises du champ (cases à cocher). */
export function restoredChecked(
  state: ActionState<object>,
  name: string,
  value: string,
): boolean {
  if (state.status !== "error") return false;
  const v = state.values[name];
  return Array.isArray(v) ? v.includes(value) : v === value;
}
