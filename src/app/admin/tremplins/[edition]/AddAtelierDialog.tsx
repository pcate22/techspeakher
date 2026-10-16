"use client";

import { restoredValue } from "@/lib/action-state";
import { PARAM_CREER } from "@/lib/creer-atelier";
import { createAtelierAction } from "../actions";
import AdminDialog, { inputCls } from "./AdminDialog";

/**
 * Modale « + Ajouter un atelier » : UN champ (le titre) — on nomme l'atelier
 * ici, on le complète (date, participantes, coachs, supports…) sur sa fiche.
 *
 * La création vit dans un DIALOG (un bouton), pas en formulaire inline en tête
 * de la liste : une page de liste montre et laisse choisir, elle n'héberge pas
 * un formulaire de saisie (règle d'or + §1 ; cf. l'erreur `/admin/conferences`
 * du registre). Cohérent avec AddCoachDialog / AddDocumentDialog.
 */
export default function AddAtelierDialog({
  editionId,
  defaultOpen = false,
}: {
  editionId: number;
  /** `?creer=1` (feuille ➕ de la barre) : le formulaire s'ouvre d'emblée. */
  defaultOpen?: boolean;
}) {
  return (
    <AdminDialog
      defaultOpen={defaultOpen}
      paramConsomme={PARAM_CREER}
      triggerVariant="primary"
      triggerLabel="Ajouter un atelier"
      title="Nouvel atelier"
      action={createAtelierAction}
      submitLabel="Créer l'atelier"
      chainLabel="Créer et enchaîner"
      pendingLabel="Création…"
      successMessage={(s) =>
        `Atelier « ${s.titre} » créé. Ouvre-le pour le compléter (date, participantes, coachs…).`
      }
    >
      {(state) => (
        <>
          <input type="hidden" name="editionId" value={editionId} />
          <label className="text-sm flex flex-col gap-1">
            Titre de l&apos;atelier
            <span className="text-orange" aria-hidden="true">
              {" "}
              *
            </span>
            <span className="sr-only"> (obligatoire)</span>
            <input
              type="text"
              name="titre"
              required
              defaultValue={restoredValue(state, "titre")}
              placeholder="Ex. Coaching DevFest : préparer ses slides"
              className={inputCls}
            />
          </label>
          <p className="text-xs text-gray-light">
            Il reste <strong>invisible</strong> (des inscrites comme du
            public) jusqu&apos;à ce que tu l&apos;ouvres à toutes ou le réserves
            à des participantes, sur sa fiche.
          </p>
        </>
      )}
    </AdminDialog>
  );
}
