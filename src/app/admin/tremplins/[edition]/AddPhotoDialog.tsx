"use client";

import { restoredValue, restoredChecked, champInitial } from "@/lib/action-state";
import { addPhotoAction } from "../actions";
import AdminDialog, { inputCls } from "./AdminDialog";

/**
 * Modale « + Ajouter une photo » : adresse de la photo, légende, moment, et
 * l'inventaire des participantes qui y figurent (droit à l'image — la photo
 * ne sera publiée que si toutes ont consenti à être publiques). Remplace
 * l'ancien formulaire inline en bas de page, dont la saisie se perdait à la
 * moindre erreur.
 */
export default function AddPhotoDialog({
  editionId,
  participantes,
}: {
  editionId: number;
  participantes: { id: number; label: string }[];
}) {
  return (
    <AdminDialog
      triggerLabel="Ajouter une photo"
      title="Ajouter une photo"
      action={addPhotoAction}
      submitLabel="Ajouter la photo"
      chainLabel="Ajouter et enchaîner"
      pendingLabel="Ajout…"
      successMessage={() => "Photo ajoutée. À la suivante !"}
    >
      {(state) => (
        <>
          <input type="hidden" name="editionId" value={editionId} />
          <label className="text-sm flex flex-col gap-1">
            Adresse de la photo
            <input
              type="url"
              name="url"
              required
              defaultValue={restoredValue(state, "url")}
              placeholder="https://…"
              className={inputCls}
            />
          </label>
          <label className="text-sm flex flex-col gap-1">
            Légende (optionnel)
            <input
              type="text"
              name="legende"
              defaultValue={restoredValue(state, "legende")}
              placeholder="Ex. Le jury et les finalistes"
              className={inputCls}
            />
          </label>
          <label className="text-sm flex flex-col gap-1">
            Moment
            {/* Restauration sur erreur uniquement (restoredValue renvoie ""
                hors erreur : un ?? sélectionnerait la 1ʳᵉ option, pas Soirée). */}
            <select
              name="kind"
              defaultValue={champInitial(state, "kind", "soiree")}
              className={inputCls}
            >
              <option value="podium">Podium</option>
              <option value="soiree">Soirée</option>
              <option value="autre">Autre</option>
            </select>
          </label>
          {participantes.length > 0 && (
            <fieldset className="border border-navy-lighter rounded-lg p-3">
              <legend className="text-xs text-gray-light px-1">
                Qui figure sur la photo ? (droit à l&apos;image)
              </legend>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 list-none">
                {participantes.map((p) => (
                  <li key={p.id}>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="personnes"
                        value={p.id}
                        defaultChecked={restoredChecked(state, "personnes", String(p.id))}
                        className="accent-cyan"
                      />
                      {p.label}
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          )}
          <p className="text-xs text-gray-light">
            La photo n&apos;apparaîtra sur la page publique que si toutes les
            personnes cochées ont accepté d&apos;être visibles.
          </p>
        </>
      )}
    </AdminDialog>
  );
}
