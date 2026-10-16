"use client";

import PersonPicker from "@/components/PersonPicker";
import { restoredValue } from "@/lib/action-state";
import { addParticipanteAction } from "../actions";
import AdminDialog, { inputCls } from "./AdminDialog";

/**
 * Modale « + Ajouter une participante » : UN champ « personne » MULTI — on
 * tape un nom, on choisit une ou plusieurs speakeuses existantes (reliées
 * d'office), et/ou « l'inviter par e-mail » pour une inconnue (pré-créée,
 * reliée à sa première connexion) — sans perdre les speakeuses déjà choisies.
 * Toutes sont invitées par e-mail. Saisie à la chaîne.
 */
export default function AddParticipanteDialog({
  editionId,
  comptes,
}: {
  editionId: number;
  /** Comptes speakeuses proposés à la recherche (nom en libellé, e-mail en secours). */
  comptes: { id: number; label: string; sousTitre?: string }[];
}) {
  return (
    <AdminDialog
      triggerVariant="primary"
      triggerLabel="Ajouter une participante"
      title="Ajouter une participante"
      action={addParticipanteAction}
      submitLabel="Inviter"
      chainLabel="Inviter et enchaîner"
      successMessage={(s) => s.resume}
      wrapperClassName="mb-4"
    >
      {(state, resetKey) => (
        <>
          <input type="hidden" name="editionId" value={editionId} />
          <label id="part-compte-label" className="text-sm font-medium">
            La ou les speakeuses
          </label>
          <PersonPicker
            key={resetKey}
            name="compteId"
            candidats={comptes}
            multiple
            ariaLabelledBy="part-compte-label"
            placeholder="Tape son nom…"
            emptyLabel="Aucun compte à ce nom."
            createLabel={() => "Pas dans la liste ? L'inviter par e-mail"}
          >
            {() => (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-gray-light">
                  Un e-mail d&apos;invitation lui sera envoyé ; elle complétera son
                  profil à sa première connexion.
                </p>
                <label className="text-sm flex flex-col gap-1">
                  Son adresse e-mail
                  <input
                    type="email"
                    name="email"
                    required
                    defaultValue={restoredValue(state, "email")}
                    placeholder="prenom@exemple.fr"
                    className={inputCls}
                  />
                </label>
              </div>
            )}
          </PersonPicker>
          <p className="text-xs text-gray-light">
            Le statut finaliste se règle ensuite, après la soirée.
          </p>
        </>
      )}
    </AdminDialog>
  );
}
