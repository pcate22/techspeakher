"use client";

import { restoredValue, champInitial } from "@/lib/action-state";
import { addCoachDocumentAction } from "./actions";
import AdminDialog, { inputCls } from "@/app/admin/tremplins/[edition]/AdminDialog";

/**
 * Modale de dépôt d'un document par un COACH, préconfigurée sur sa cible
 * (un de ses ateliers ou une de ses coachées). Même coquille que côté orga :
 * saisie conservée sur erreur, dépôts à la chaîne, feedback nominatif.
 */
export default function CoachDepotDialog({
  editionId,
  atelierId,
  registrationId,
  cible,
  defaultType,
}: {
  editionId: number;
  atelierId?: number;
  registrationId?: number;
  /** « l'atelier « X » » ou le nom de la coachée (intitulés + succès). */
  cible: string;
  defaultType: "support_atelier" | "feedback_jury" | "video_pitch" | "note";
}) {
  return (
    <AdminDialog
      triggerLabel="Déposer un document"
      title={`Document pour ${cible}`}
      action={addCoachDocumentAction}
      submitLabel="Déposer"
      pendingLabel="Dépôt…"
      successMessage={(s) => `« ${s.titre} » déposé pour ${cible}. Un autre ?`}
    >
      {(state) => (
        <>
          <input type="hidden" name="editionId" value={editionId} />
          {atelierId ? (
            <>
              <input type="hidden" name="portee" value="atelier" />
              <input type="hidden" name="atelierId" value={atelierId} />
            </>
          ) : (
            <>
              <input type="hidden" name="portee" value="participante" />
              <input type="hidden" name="registrationId" value={registrationId} />
            </>
          )}
          <label className="text-sm flex flex-col gap-1">
            Type
            <select
              name="type"
              defaultValue={champInitial(state, "type", defaultType)}
              className={inputCls}
            >
              <option value="support_atelier">Support d&apos;atelier</option>
              <option value="note">Note de suivi</option>
              <option value="feedback_jury">Retour</option>
              <option value="video_pitch">Vidéo de pitch</option>
              <option value="autre">Autre</option>
            </select>
          </label>
          <label className="text-sm flex flex-col gap-1">
            Titre
            <input
              type="text"
              name="titre"
              required
              defaultValue={restoredValue(state, "titre")}
              placeholder="Ex. Slides de l'atelier, points de travail…"
              className={inputCls}
            />
          </label>
          <label className="text-sm flex flex-col gap-1">
            Lien (optionnel si tu écris un contenu)
            <input
              type="url"
              name="lien"
              defaultValue={restoredValue(state, "lien")}
              placeholder="https://…"
              className={inputCls}
            />
          </label>
          <label className="text-sm flex flex-col gap-1">
            Contenu (optionnel si tu donnes un lien)
            <textarea
              name="contenu"
              rows={3}
              defaultValue={restoredValue(state, "contenu")}
              className={inputCls}
            />
          </label>
        </>
      )}
    </AdminDialog>
  );
}
