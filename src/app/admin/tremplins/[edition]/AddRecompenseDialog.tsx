"use client";

import { restoredValue } from "@/lib/action-state";
import { addRecompenseAction } from "../actions";
import AdminDialog, { inputCls } from "./AdminDialog";

/**
 * Modale « + Ajouter une récompense » : on crée l'intitulé (et le rang si
 * c'est un lot du podium) ; l'attribution à une bénéficiaire et le suivi se
 * font ensuite sur la fiche de la récompense. Saisie à la chaîne.
 */
export default function AddRecompenseDialog({ editionId }: { editionId: number }) {
  return (
    <AdminDialog
      triggerLabel="Ajouter une récompense"
      title="Ajouter une récompense"
      action={addRecompenseAction}
      chainLabel="Ajouter et enchaîner"
      successMessage={(s) => `Récompense « ${s.intitule} » ajoutée. À la suivante !`}
      wrapperClassName="mb-4"
    >
      {(state) => (
        <>
          <input type="hidden" name="editionId" value={editionId} />
          <label className="text-sm flex flex-col gap-1">
            Intitulé
            <input
              type="text"
              name="intitule"
              required
              defaultValue={restoredValue(state, "intitule")}
              placeholder="Une présentation au DevFest Toulouse"
              className={inputCls}
            />
          </label>
          <label className="text-sm flex flex-col gap-1">
            Détail (facultatif)
            <input
              type="text"
              name="detail"
              defaultValue={restoredValue(state, "detail")}
              placeholder="Salle communauté"
              className={inputCls}
            />
          </label>
          <label className="text-sm flex flex-col gap-1">
            Rang du podium (facultatif)
            <input
              type="text"
              inputMode="numeric"
              name="rang"
              defaultValue={restoredValue(state, "rang")}
              placeholder="1"
              className={inputCls}
            />
          </label>
          <p className="text-xs text-gray-light">
            Laisse le rang vide pour une récompense hors podium (talk en meetup,
            coaching CFP…). L&apos;attribution à une participante se fait ensuite,
            sur la fiche de la récompense.
          </p>
        </>
      )}
    </AdminDialog>
  );
}
