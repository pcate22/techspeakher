"use client";

import PersonPicker from "@/components/PersonPicker";
import { restoredValue } from "@/lib/action-state";
import { addCoachAction } from "../actions";
import AdminDialog, { inputCls } from "./AdminDialog";

/**
 * Modale « + Ajouter un coach » : UN champ RECHERCHE + sélection. On tape un
 * nom, on choisit un compte existant… ou, si la personne est inconnue, on
 * l'ajoute — et SEULEMENT là apparaît le mini-formulaire (prénom/nom, e-mail,
 * genre). Rien ne traîne à l'écran tant qu'on n'invite pas : le nom saisi
 * pré-remplit « Prénom et nom ». Le compte est pré-créé et relié à sa première
 * connexion.
 */
export default function AddCoachDialog({
  triggerVariant,
  editionId,
  atelierId,
  registrationId,
  cible,
  comptes = [],
}: {
  triggerVariant?: "primary" | "secondary" | "ghost";
  editionId: number;
  /** Cible : un atelier OU une participante (coaching individuel). */
  atelierId?: number;
  registrationId?: number;
  /** Libellé de la cible pour le titre (nom d'atelier ou de participante). */
  cible: string;
  /** Comptes de la plateforme proposés à la recherche. */
  comptes?: { id: number; label: string; sousTitre?: string }[];
}) {
  return (
    <AdminDialog
      triggerVariant={triggerVariant}
      triggerLabel="Ajouter un coach"
      title={`Coach pour ${cible}`}
      action={addCoachAction}
      submitLabel="Ajouter ce coach"
      chainLabel="Ajouter et enchaîner"
      pendingLabel="Ajout…"
      successMessage={(s) =>
        s.created
          ? `${s.email} ajouté (compte créé : la personne sera reliée à sa première connexion).`
          : `${s.email} ajouté comme coach.`
      }
    >
      {(state, resetKey) => (
        <>
          <input type="hidden" name="editionId" value={editionId} />
          {atelierId && <input type="hidden" name="atelierId" value={atelierId} />}
          {registrationId && <input type="hidden" name="registrationId" value={registrationId} />}
          <label id="coach-compte-label" className="text-sm font-medium">
            Le coach
          </label>
          <PersonPicker
            key={resetKey}
            name="compteId"
            candidats={comptes}
            ariaLabelledBy="coach-compte-label"
            placeholder="Rechercher un compte…"
            emptyLabel="Aucun compte à ce nom."
            createLabel={(q) => `Personne inconnue ? Ajouter « ${q} »`}
          >
            {(nomTape) => (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">Nouvelle personne</p>
                <label className="text-sm flex flex-col gap-1">
                  Prénom et nom
                  <input
                    type="text"
                    name="nom"
                    defaultValue={restoredValue(state, "nom") || nomTape}
                    placeholder="Ex. Ada Lovelace"
                    className={inputCls}
                  />
                </label>
                <label className="text-sm flex flex-col gap-1">
                  Son e-mail
                  <input
                    type="email"
                    name="email"
                    required
                    defaultValue={restoredValue(state, "email")}
                    placeholder="prenom.nom@exemple.fr"
                    className={inputCls}
                  />
                </label>
                <label className="text-sm flex flex-col gap-1">
                  <span>
                    Genre
                    <span className="text-orange" aria-hidden="true"> *</span>
                    <span className="sr-only"> (obligatoire)</span>
                  </span>
                  <select
                    name="genre"
                    required
                    defaultValue={restoredValue(state, "genre")}
                    className={inputCls}
                  >
                    <option value="">Choisir…</option>
                    <option value="femme">Femme</option>
                    <option value="homme">Homme</option>
                    <option value="non_binaire">Non-binaire</option>
                  </select>
                </label>
                <p className="text-xs text-gray-light">
                  Le genre sert aux statistiques de mixité, jamais affiché.
                </p>
              </div>
            )}
          </PersonPicker>
        </>
      )}
    </AdminDialog>
  );
}
