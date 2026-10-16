"use client";

import { useActionState } from "react";
import { toggleMoissonAction, type ToggleState } from "./actions";

/**
 * Interrupteur de moisson d'une édition, avec confirmation nominative dans une
 * région vivante permanente (pattern résultat : un geste dans une liste doit
 * dire ce qu'il a fait, pas seulement changer un libellé).
 */
export default function MoissonToggle({
  editionId,
  actif,
  nomConf,
}: {
  editionId: number;
  actif: boolean;
  nomConf: string;
}) {
  const [state, action, pending] = useActionState<ToggleState, FormData>(
    toggleMoissonAction,
    {},
  );
  return (
    <form action={action} className="shrink-0 flex items-center gap-2">
      <input type="hidden" name="editionId" value={editionId} />
      <input type="hidden" name="actif" value={(!actif).toString()} />
      <p role="status" className="text-xs text-cyan">
        {state.message ?? ""}
      </p>
      <button
        type="submit"
        disabled={pending}
        className={`rounded-full px-3 py-2 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan disabled:opacity-60 ${
          actif
            ? "bg-cyan/15 text-cyan"
            : "bg-navy border border-field-border text-gray-light"
        }`}
      >
        {actif ? "Moisson active" : "Moisson inactive"}
        <span className="sr-only">
          {" "}
          pour {nomConf} : {actif ? "désactiver" : "activer"}
        </span>
      </button>
    </form>
  );
}
