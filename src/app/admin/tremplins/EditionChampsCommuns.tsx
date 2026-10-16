"use client";

import { restoredValue, type ActionState } from "@/lib/action-state";
import { inputCls } from "./[edition]/styles";
import ClearableInput from "@/components/ClearableInput";
import ConfLienField from "./ConfLienField";

/** Champs partagés par les deux modales d'édition (mêmes noms que le schéma). */
export type EditionChampNom =
  | "nom"
  | "inscriptionsDebut"
  | "inscriptionsFin"
  | "confDate"
  | "confLien"
  | "finaleDate"
  | "finaleLieu"
  | "description"
  | "conferenceEditionId";

/**
 * Bloc de champs éditoriaux commun aux modales « Créer une édition » et
 * « Modifier l'édition » : une seule définition du markup (libellés visibles,
 * marquage « (optionnel) » homogène), miroir du fragment Zod partagé
 * (`editionChampsCommuns` dans tremplin-form.ts). Sur erreur, la saisie
 * restaurée (`restoredValue`) prime sur les valeurs par défaut fournies.
 */
export default function EditionChampsCommuns<S extends object>({
  state,
  defaults = {},
  confLienKey,
  editionOptions = [],
}: {
  state: ActionState<S>;
  /** Valeurs initiales (édition existante, ou pré-remplissage de conf). */
  defaults?: Partial<Record<EditionChampNom, string | null>>;
  /** Change de valeur → le champ « Site de la conférence » se re-préremplit. */
  confLienKey?: string;
  /** Événements de la référence des conférences (lien facultatif). */
  editionOptions?: { id: number; libelle: string }[];
}) {
  // Restauration UNIQUEMENT sur erreur : restoredValue renvoie "" (jamais
  // undefined) hors erreur — un `??` masquerait les valeurs de l'édition et
  // un « Enregistrer » écraserait ses champs avec du vide (cf. InlineActionForm).
  const val = (name: EditionChampNom) =>
    state.status === "error" ? restoredValue(state, name) : (defaults[name] ?? undefined);

  return (
    <>
      <label className="text-sm flex flex-col gap-1">
        <span>
          Nom de l&apos;édition <span aria-hidden="true">*</span>
          <span className="sr-only"> (obligatoire)</span>
        </span>
        <input
          type="text"
          name="nom"
          required
          defaultValue={val("nom")}
          placeholder="Ex. Tremplin 2027"
          className={inputCls}
        />
      </label>
      <ClearableInput
        key={`inscriptionsDebut:${val("inscriptionsDebut") ?? ""}`}
        type="date"
        name="inscriptionsDebut"
        label="Début des inscriptions (optionnel)"
        defaultValue={val("inscriptionsDebut") ?? ""}
      />
      <ClearableInput
        key={`inscriptionsFin:${val("inscriptionsFin") ?? ""}`}
        type="date"
        name="inscriptionsFin"
        label="Fin des inscriptions (optionnel)"
        defaultValue={val("inscriptionsFin") ?? ""}
      />
      <p className="text-xs text-gray-light">
        Avec ces dates, le libellé public (« Inscriptions à venir / ouvertes /
        closes ») suit le calendrier automatiquement, sans toucher au statut.
      </p>
      <ClearableInput
        key={`confDate:${val("confDate") ?? ""}`}
        type="date"
        name="confDate"
        label="Date de la conférence (optionnel)"
        defaultValue={val("confDate") ?? ""}
      />
      <ConfLienField state={state} defaultLien={defaults.confLien} remountKey={confLienKey} />
      {editionOptions.length > 0 && (
        <label className="text-sm flex flex-col gap-1">
          Conférence partenaire dans la référence (optionnel)
          <select
            name="conferenceEditionId"
            defaultValue={val("conferenceEditionId") ?? ""}
            className={inputCls}
          >
            <option value="">Non reliée</option>
            {editionOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.libelle}
              </option>
            ))}
          </select>
        </label>
      )}
      <ClearableInput
        key={`finaleDate:${val("finaleDate") ?? ""}`}
        type="date"
        name="finaleDate"
        label="Date de la soirée finale (optionnel)"
        defaultValue={val("finaleDate") ?? ""}
      />
      <label className="text-sm flex flex-col gap-1">
        Lieu de la finale (optionnel)
        <input
          type="text"
          name="finaleLieu"
          defaultValue={val("finaleLieu")}
          placeholder="Ex. Toulouse"
          className={inputCls}
        />
      </label>
      <label className="text-sm flex flex-col gap-1">
        Description (optionnel)
        <textarea
          name="description"
          rows={2}
          defaultValue={val("description")}
          className={inputCls}
        />
      </label>
    </>
  );
}
