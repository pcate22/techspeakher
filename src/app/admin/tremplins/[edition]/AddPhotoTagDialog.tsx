"use client";

import { restoredValue, champInitial } from "@/lib/action-state";
import { addPhotoTagAction } from "../actions";
import AdminDialog, { inputCls } from "./AdminDialog";

/**
 * Modale « + Identifier une personne » sur une photo. Trois voies exclusives :
 * une participante de l'édition, n'importe quel compte de la plateforme (jurée,
 * coach…) ou un nom libre (personne extérieure). Pour un compte ou un nom
 * libre, une case atteste que son consentement a été recueilli (une inscrite
 * gère le sien dans son espace). Saisie à la chaîne.
 */
export default function AddPhotoTagDialog({
  editionId,
  photoId,
  participantes,
  comptes,
}: {
  editionId: number;
  photoId: number;
  participantes: { id: number; label: string }[];
  comptes: { id: number; label: string }[];
}) {
  return (
    <AdminDialog
      triggerLabel="Identifier une personne"
      title="Identifier une personne sur la photo"
      action={addPhotoTagAction}
      submitLabel="Ajouter"
      chainLabel="Ajouter et enchaîner"
      successMessage={() => "Personne ajoutée. À la suivante !"}
    >
      {(state) => (
        <>
          <input type="hidden" name="editionId" value={editionId} />
          <input type="hidden" name="photoId" value={photoId} />
          <label className="text-sm flex flex-col gap-1">
            Une participante de l&apos;édition
            <select
              name="registrationId"
              defaultValue={champInitial(state, "registrationId")}
              className={inputCls}
            >
              <option value="">Choisir dans la liste…</option>
              {participantes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm flex flex-col gap-1">
            Ou un compte de la plateforme (jurée, coach…)
            <select
              name="compteId"
              defaultValue={champInitial(state, "compteId")}
              className={inputCls}
            >
              <option value="">Choisir dans la liste…</option>
              {comptes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm flex flex-col gap-1">
            Ou un nom libre (personne extérieure)
            <input
              type="text"
              name="nomLibre"
              defaultValue={restoredValue(state, "nomLibre")}
              placeholder="Ex. Photographe de la soirée"
              className={inputCls}
            />
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="consentement" className="mt-0.5 accent-cyan" />
            <span>
              J&apos;ai recueilli son accord pour publier cette photo.
              <span className="block text-xs text-gray-light">
                Pour une participante, son accord se gère dans son espace (case
                sans effet). Sans accord, la photo reste privée.
              </span>
            </span>
          </label>
        </>
      )}
    </AdminDialog>
  );
}
