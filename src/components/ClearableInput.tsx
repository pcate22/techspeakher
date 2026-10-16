"use client";

import { useRef, useState } from "react";
import { inputCls } from "@/app/admin/tremplins/[edition]/styles";

/**
 * Champ `date`/`time` (ou texte) muni d'un bouton « Effacer » explicite.
 *
 * Motivation : sur mobile (Safari iOS notamment), le picker natif d'un
 * `<input type="date">` propose « Réinitialiser », qui remet la date à sa
 * valeur d'origine — il n'existe AUCUN moyen de repasser le champ à vide une
 * fois une date saisie. Un bouton « Effacer » dans le formulaire, indépendant
 * du picker natif, garantit ce retour à vide sur tous les navigateurs.
 *
 * Le champ reste NON CONTRÔLÉ (`defaultValue`) comme les autres champs
 * d'`InlineActionForm` (restauration React 19 sur erreur). On ne suit en état
 * local que la présence d'une valeur, pour afficher « Effacer » à bon escient.
 */
export default function ClearableInput({
  name,
  type = "text",
  label,
  defaultValue = "",
  placeholder,
  min,
  max,
  step,
}: {
  name: string;
  type?: "text" | "date" | "time" | "number";
  label: string;
  defaultValue?: string;
  placeholder?: string;
  min?: string;
  max?: string;
  step?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const [rempli, setRempli] = useState(defaultValue !== "");
  const [annonce, setAnnonce] = useState("");

  const effacer = () => {
    const el = ref.current;
    if (!el) return;
    el.value = "";
    setRempli(false);
    // Notifie les écouteurs éventuels du formulaire (validation, enregistrement
    // à la volée) d'un vrai changement.
    el.dispatchEvent(new Event("input", { bubbles: true }));
    // Gestion du focus (RGAA / WCAG 2.4.3) : le bouton « Effacer » disparaît
    // avec la valeur, le focus tomberait sinon sur <body>. On le renvoie sur le
    // LIBELLÉ du champ (élément stable et adjacent) — et surtout PAS sur le
    // champ date/heure lui-même, dont le focus rouvrirait le sélecteur natif
    // sur mobile. Une région live annonce l'effacement aux lecteurs d'écran.
    labelRef.current?.focus();
    setAnnonce(`${label} : effacé`);
  };

  return (
    // Proximité (loi de Fitts / Gestalt) : « Effacer » colle à SON champ
    // (gap-1 au-dessus) et `mb-2` creuse l'écart avec le champ suivant — il ne
    // doit pas paraître à égale distance des deux. `mb-2` s'ajoute au `gap` du
    // formulaire parent, donnant une séparation nette vers le bas.
    <div className="flex flex-col gap-1 mb-2">
      <label className="text-sm flex flex-col gap-1">
        <span
          ref={labelRef}
          tabIndex={-1}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded"
        >
          {label}
        </span>
        <input
          ref={ref}
          type={type}
          name={name}
          defaultValue={defaultValue}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
          onChange={(e) => setRempli(e.target.value !== "")}
          className={inputCls}
        />
      </label>
      {rempli && (
        <button
          type="button"
          onClick={effacer}
          // Nom accessible qualifié par le libellé : plusieurs « Effacer »
          // peuvent coexister sur une même page (dates d'une édition), ils
          // doivent rester distinguables à la navigation par boutons (RGAA).
          aria-label={`Effacer : ${label}`}
          // Cible tactile confortable (Fitts) : `py-2 px-2` élargit la zone
          // cliquable ; `-mx-2` réaligne le texte sur le bord gauche du champ.
          className="self-start text-sm text-cyan hover:text-cyan-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded px-2 py-2 -mx-2"
        >
          Effacer
        </button>
      )}
      <p role="status" aria-live="polite" className="sr-only">
        {annonce}
      </p>
    </div>
  );
}
