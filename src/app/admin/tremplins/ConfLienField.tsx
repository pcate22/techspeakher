"use client";

import { restoredValue, type ActionState } from "@/lib/action-state";
import { inputCls } from "./[edition]/styles";

/**
 * Champ « Site de la conférence » (optionnel), PARTAGÉ par les modales d'édition
 * (`EditionChampsCommuns` pour créer/modifier, `DuplicateEditionDialog` pour
 * dupliquer). Centralise une sémantique subtile, à ne pas recopier :
 *
 * - la saisie restaurée prime UNIQUEMENT sur erreur (`restoredValue` renvoie ""
 *   hors erreur — un `??` laisserait un ré-envoi vide écraser le champ) ;
 * - `remountKey` (la conf choisie) force le remount pour re-préremplir le site
 *   au changement de conf (React ne rafraîchit pas un `defaultValue` seul).
 */
export default function ConfLienField<S extends object>({
  state,
  defaultLien,
  remountKey,
}: {
  state: ActionState<S>;
  /** Site de la conf connue (pré-remplissage hors erreur). */
  defaultLien?: string | null;
  /** Change de valeur → le champ se re-préremplit (remount). */
  remountKey?: string;
}) {
  const val =
    state.status === "error" ? restoredValue(state, "confLien") : (defaultLien ?? undefined);
  return (
    <label className="text-sm flex flex-col gap-1">
      Site de la conférence (optionnel)
      <input
        key={remountKey ?? "confLien"}
        type="url"
        name="confLien"
        defaultValue={val}
        placeholder="https://…"
        className={inputCls}
      />
    </label>
  );
}
