"use client";

import { restoredValue, type ActionState } from "@/lib/action-state";
import type { ConferenceRef } from "@/lib/tremplin-editions";
import { nomConference } from "@/lib/tremplin-conf";
import { inputCls } from "./[edition]/styles";

/** Valeur sentinelle du sélecteur = « saisir une nouvelle conférence ». */
export const NOUVELLE_CONF = "__nouvelle__";

/**
 * Sélecteur de conférence, PARTAGÉ par les modales « Créer une édition » et
 * « Dupliquer une édition ». La conférence définit l'identité d'URL
 * (`conf_slug`, non modifiable ensuite) : on la choisit dans les confs déjà
 * connues (cohérence des slugs, pas de doublon d'orthographe) ou on ouvre la
 * saisie libre (« Nouvelle conférence… », slug déduit du nom).
 *
 * Composant **contrôlé** (`value` / `onChange` gérés par l'appelant) : celui-ci
 * garde la conf choisie pour re-préremplir le site (`confLien`) au changement.
 * Il émet les champs cachés `confMode` / `confNom` / `confSlug` d'une conf
 * connue, et les champs de saisie pour une conf nouvelle — mêmes noms de champ
 * que le schéma (`parseEditionForm`).
 */
export default function ConferenceFields<S extends object>({
  conferences,
  state,
  value,
  onChange,
}: {
  conferences: ConferenceRef[];
  state: ActionState<S>;
  value: string;
  onChange: (slug: string) => void;
}) {
  const existante = conferences.find((c) => c.confSlug === value);
  // La saisie libre ne se restaure (après erreur) que si c'est bien elle qui a
  // été soumise : sinon on re-préremplirait le nom/slug de la conf EXISTANTE
  // précédemment choisie (édition créée sous la mauvaise URL, irréversible).
  const nouvelleSoumise = restoredValue(state, "confMode") === "nouvelle";

  return (
    <>
      <input type="hidden" name="confMode" value={existante ? "existante" : "nouvelle"} />
      <label className="text-sm flex flex-col gap-1">
        Conférence
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          className={inputCls}
        >
          {conferences.length > 0 && (
            <option value="" disabled>
              Choisir une conférence…
            </option>
          )}
          {conferences.map((c) => (
            <option key={c.confSlug} value={c.confSlug}>
              {nomConference(c.confNom, c.confLieu)}
            </option>
          ))}
          <option value={NOUVELLE_CONF}>Nouvelle conférence…</option>
        </select>
      </label>
      {existante && (
        <>
          {/* Conf connue : nom + lieu + slug repris tels quels (cohérence des
              URLs ET du nom affiché « DevFest Toulouse »). */}
          <input type="hidden" name="confNom" value={existante.confNom} />
          <input type="hidden" name="confLieu" value={existante.confLieu ?? ""} />
          <input type="hidden" name="confSlug" value={existante.confSlug} />
        </>
      )}
      {value === NOUVELLE_CONF && (
        <>
          <label className="text-sm flex flex-col gap-1">
            Nom de la nouvelle conférence
            <input
              type="text"
              name="confNom"
              required
              defaultValue={nouvelleSoumise ? restoredValue(state, "confNom") : undefined}
              placeholder="Ex. Devoxx (sans la ville ni l'année)"
              className={inputCls}
            />
          </label>
          <label className="text-sm flex flex-col gap-1">
            Ville ou pays (optionnel)
            <input
              type="text"
              name="confLieu"
              defaultValue={nouvelleSoumise ? restoredValue(state, "confLieu") : undefined}
              placeholder="Ex. Toulouse, ou France"
              className={inputCls}
            />
          </label>
          <label className="text-sm flex flex-col gap-1">
            Identifiant d&apos;URL (optionnel, déduit du nom et du lieu)
            <input
              type="text"
              name="confSlug"
              defaultValue={nouvelleSoumise ? restoredValue(state, "confSlug") : undefined}
              placeholder="Ex. devoxx-france → /tremplin/devoxx-france/2027"
              className={inputCls}
            />
          </label>
        </>
      )}
    </>
  );
}
