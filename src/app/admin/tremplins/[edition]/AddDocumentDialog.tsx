"use client";

import type { DocumentType } from "@/lib/tremplin-documents";
import { restoredValue } from "@/lib/action-state";
import { createDocumentAction } from "../actions";
import AdminDialog, { inputCls } from "./AdminDialog";

const TYPE_OPTIONS: { value: DocumentType; label: string; portees?: string[] }[] = [
  { value: "support_atelier", label: "Support d'atelier" },
  // Documents PERSONNELS : proposés uniquement en portée « participante »
  // (la même règle est revérifiée côté serveur, parseDocumentForm) — un
  // retour du jury déposé en « partagé » serait servi à toutes les inscrites.
  { value: "feedback_jury", label: "Retour du jury", portees: ["participante"] },
  { value: "video_pitch", label: "Vidéo du pitch", portees: ["participante"] },
  { value: "note", label: "Note" },
  { value: "autre", label: "Autre" },
];

/**
 * Modale d'ajout de document, pré-remplie par la section qui l'affiche (portée
 * + cible via props). En portée « participante », la saisie à la chaîne ajoute
 * un AUTRE document à la MÊME personne : le message de succès le rappelle pour
 * éviter de coller le retour de la suivante dans la mauvaise fiche.
 */
export default function AddDocumentDialog({
  triggerVariant,
  editionId,
  portee,
  atelierId,
  registrationId,
  triggerLabel,
  title,
  defaultType = "autre",
  cible,
}: {
  triggerVariant?: "primary" | "secondary" | "ghost";
  editionId: number;
  portee: "generale" | "atelier" | "participante";
  atelierId?: number;
  registrationId?: number;
  triggerLabel: string;
  title: string;
  defaultType?: DocumentType;
  /** Contexte pour les intitulés accessibles (ex. « de l'atelier X »). */
  cible: string;
}) {
  return (
    <AdminDialog
      triggerVariant={triggerVariant}
      triggerLabel={triggerLabel}
      title={title}
      action={createDocumentAction}
      chainLabel="Ajouter et enchaîner"
      successMessage={(s) =>
        portee === "participante"
          ? `« ${s.titre} » ajouté ${cible}. Au suivant !`
          : `« ${s.titre} » ajouté. Au suivant !`
      }
    >
      {(state) => (
        <>
          <input type="hidden" name="editionId" value={editionId} />
          <input type="hidden" name="portee" value={portee} />
          {portee === "atelier" && atelierId !== undefined && (
            <input type="hidden" name="atelierId" value={atelierId} />
          )}
          {portee === "participante" && registrationId !== undefined && (
            <input type="hidden" name="registrationId" value={registrationId} />
          )}

          <label className="text-sm flex flex-col gap-1">
            Titre
            <input
              type="text"
              name="titre"
              required
              defaultValue={restoredValue(state, "titre")}
              placeholder="Ex. Slides, Retour jury…"
              className={inputCls}
            />
          </label>
          <label className="text-sm flex flex-col gap-1">
            Type
            <select
              name="type"
              defaultValue={restoredValue(state, "type") || defaultType}
              className={inputCls}
            >
              {TYPE_OPTIONS.filter((t) => !t.portees || t.portees.includes(portee)).map(
                (t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ),
              )}
            </select>
          </label>
          <label className="text-sm flex flex-col gap-1">
            Lien
            <input
              type="url"
              name="lien"
              defaultValue={restoredValue(state, "lien")}
              placeholder="https://…"
              className={inputCls}
            />
          </label>
          <label className="text-sm flex flex-col gap-1">
            …ou un texte (si pas de lien)
            <textarea
              name="contenu"
              rows={2}
              defaultValue={restoredValue(state, "contenu")}
              className={inputCls}
            />
          </label>
        </>
      )}
    </AdminDialog>
  );
}
