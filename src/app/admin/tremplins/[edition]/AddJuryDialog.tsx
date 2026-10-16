"use client";

import { restoredValue } from "@/lib/action-state";
import { addJuryAction } from "../actions";
import AdminDialog, { inputCls } from "./AdminDialog";

/**
 * Modale « + Ajouter un juré » : nom, prénom, fonction, entreprise (publics,
 * accord recueilli) et e-mail (interne, contact orga, jamais publié). Saisie à
 * la chaîne pour composer le jury d'un coup.
 */
export default function AddJuryDialog({ editionId }: { editionId: number }) {
  return (
    <AdminDialog
      triggerLabel="Ajouter un juré"
      title="Ajouter un juré"
      action={addJuryAction}
      chainLabel="Ajouter et enchaîner"
      successMessage={(s) => `${s.label || "Juré"} ajouté au jury. À la suivante !`}
      wrapperClassName="mb-4"
    >
      {(state) => (
        <>
          <input type="hidden" name="editionId" value={editionId} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-sm flex flex-col gap-1">
              Prénom (facultatif)
              <input
                type="text"
                name="prenom"
                defaultValue={restoredValue(state, "prenom")}
                placeholder="Ada"
                className={inputCls}
              />
            </label>
            <label className="text-sm flex flex-col gap-1">
              Nom (obligatoire)
              <input
                type="text"
                name="nom"
                required
                defaultValue={restoredValue(state, "nom")}
                placeholder="Lovelace"
                className={inputCls}
              />
            </label>
          </div>
          <label className="text-sm flex flex-col gap-1">
            Fonction (facultatif)
            <input
              type="text"
              name="fonction"
              defaultValue={restoredValue(state, "fonction")}
              placeholder="Directrice technique"
              className={inputCls}
            />
          </label>
          <label className="text-sm flex flex-col gap-1">
            Entreprise (facultatif)
            <input
              type="text"
              name="entreprise"
              defaultValue={restoredValue(state, "entreprise")}
              placeholder="Acme"
              className={inputCls}
            />
          </label>
          <label className="text-sm flex flex-col gap-1">
            E-mail (facultatif, interne)
            <input
              type="email"
              name="email"
              defaultValue={restoredValue(state, "email")}
              placeholder="ada@exemple.fr"
              className={inputCls}
            />
          </label>
          <p className="text-xs text-gray-light">
            Nom, prénom, fonction et entreprise s&apos;affichent publiquement (avec
            son accord). L&apos;e-mail reste interne : il ne sera jamais publié.
          </p>
        </>
      )}
    </AdminDialog>
  );
}
