"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Champ texte de formulaire (label + marqueur obligatoire accessible + input +
 * indice + erreur) : primitive partagée des formulaires « conférences »
 * (admin et espace membre). Extrait dès la 2ᵉ répétition (`docs/design-system.md`
 * §2 « Primitives ») —
 * le câblage aria-invalid/aria-describedby ne se maintient qu'ICI.
 *
 * Deux modes de saisie, pour que ce câblage n'ait aucune raison d'être recopié :
 * - **non contrôlé** (`defaultValue`), le cas courant d'un formulaire de page ;
 * - **contrôlé** (`value` + `onChange`), quand un autre champ pilote celui-ci
 *   (ex. choisir une édition pré-remplit le lien de la conférence).
 * Les deux ensemble sont interdits par React : `value` gagne quand il est fourni.
 *
 * Option `multiligne` : la valeur reste UNE ligne (un titre), mais le champ se
 * dimensionne sur son contenu au lieu de le faire défiler hors du cadre — cf.
 * commentaire de `multiligne` plus bas.
 */

/** Hauteur de repli (en lignes) avant que le script n'ajuste la hauteur. */
const LIGNES_AU_REPOS = 2;

export const inputClass =
  "w-full bg-navy border border-field-border rounded-lg px-3 py-2 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan";
export const labelClass = "block text-sm text-gray-light mb-1";
export const errorClass = "text-xs text-orange mt-1";

export default function ChampTexte({
  id,
  name,
  label,
  error,
  defaultValue,
  required,
  placeholder,
  hint,
  inputMode,
  maxLength,
  value,
  onChange,
  suggestions,
  multiligne,
  autoComplete,
}: {
  id: string;
  name: string;
  label: string;
  error?: string;
  defaultValue?: string | null;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  inputMode?: "url" | "numeric";
  /** Borne dure de saisie, alignée sur la limite validée côté serveur. */
  maxLength?: number;
  /** Saisie contrôlée : fournir `value` ET `onChange` (sinon `defaultValue`). */
  value?: string;
  onChange?: (v: string) => void;
  /** Valeurs proposées à la saisie (`<datalist>`). Le champ reste libre : une
   * suggestion aide, elle ne contraint pas. La liste et son `id` sont câblés
   * ici, jamais à la main dans les formulaires. Liste vide = rien de câblé. */
  suggestions?: string[];
  /** Saisie d'une ligne de DONNÉES, affichée sur autant de lignes qu'il en faut.
   * Un titre de talk fait couramment 60 à 120 caractères : dans un champ d'une
   * ligne, la saisie défile hors du cadre et on ne relit jamais son titre en
   * entier (surtout sur téléphone). Le champ devient une zone de texte dont la
   * hauteur suit le contenu, et « Entrée » soumet toujours le formulaire au lieu
   * d'insérer un retour à la ligne. */
  multiligne?: boolean;
  /** Objet de la saisie pour l'autoremplissage (WCAG 1.3.5 / RGAA 11.13) :
   * « name », « email », « tel »… Sans lui, les gestionnaires d'identité et
   * l'autofill du navigateur restent muets — coûteux au clavier et sur mobile. */
  autoComplete?: string;
}) {
  const describedBy = error ? `err-${id}` : hint ? `hint-${id}` : undefined;
  // Une liste vide n'annonce rien d'utile : on ne câble `list` que s'il y a
  // vraiment des valeurs à proposer (sinon l'aide technique promet une
  // autocomplétion creuse).
  // Une zone de texte n'a pas de `list` : on ne rend alors aucune datalist
  // plutôt qu'une liste orpheline que personne ne pourrait atteindre.
  const listeId = suggestions?.length && !multiligne ? `${id}-list` : undefined;
  // Un seul des deux attributs part vers le DOM : React avertit dès qu'un input
  // reçoit `value` et `defaultValue` ensemble. Le mode se décide sur `value`
  // SEUL : un `value` sans `onChange` reste contrôlé, ce qui déclenche
  // l'avertissement React (champ en lecture seule) au lieu de retomber en non
  // contrôlé, où la valeur passée serait avalée en silence.
  const saisie =
    value !== undefined
      ? {
          value,
          onChange: onChange
            ? (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                onChange(e.target.value)
            : undefined,
        }
      : { defaultValue: defaultValue ?? "" };
  // Attributs communs aux deux rendus : le câblage a11y ne se dédouble pas.
  const commun = {
    id,
    name,
    required,
    maxLength,
    placeholder,
    "aria-invalid": error ? (true as const) : undefined,
    "aria-describedby": describedBy,
    autoComplete,
  };

  const zoneRef = useRef<HTMLTextAreaElement>(null);
  // Hauteur recalculée sur le contenu : `scrollHeight` n'est lisible qu'après
  // avoir relâché la hauteur imposée au tour précédent. Un navigateur sans mise
  // en page (jsdom) renvoie 0 : on laisse alors la hauteur de repli.
  const ajusteHauteur = useCallback(() => {
    const zone = zoneRef.current;
    if (!zone) return;
    zone.style.height = "auto";
    if (zone.scrollHeight === 0) return;
    // `box-sizing: border-box` (preflight Tailwind) : `height` englobe les
    // bordures, que `scrollHeight` ignore. Sans ce rattrapage, le champ garde
    // 2 px de défilement et rogne le bas de la dernière ligne.
    const bordures = zone.offsetHeight - zone.clientHeight;
    zone.style.height = `${zone.scrollHeight + bordures}px`;
  }, []);
  // Au montage (valeur déjà remplie en édition) et à chaque valeur pilotée de
  // l'extérieur. La frappe passe par `onInput`, qui couvre aussi le collage.
  useEffect(() => {
    if (multiligne) ajusteHauteur();
  }, [multiligne, ajusteHauteur, value, defaultValue]);

  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
        {required && (
          <>
            {" "}
            <span aria-hidden="true">*</span>
            <span className="sr-only"> (obligatoire)</span>
          </>
        )}
      </label>
      {multiligne ? (
        <textarea
          {...commun}
          ref={zoneRef}
          rows={LIGNES_AU_REPOS}
          // Le clavier mobile annonce « OK » plutôt qu'un retour à la ligne,
          // puisque c'est ce que fait la touche ici.
          enterKeyHint="done"
          {...saisie}
          onInput={ajusteHauteur}
          onKeyDown={(e) => {
            // Une ligne de données : « Entrée » garde le comportement d'un champ
            // simple (soumettre) plutôt que d'introduire un retour à la ligne
            // dans le titre. Pendant une composition (clavier à accents, IME),
            // « Entrée » valide la saisie en cours : on la laisse passer.
            if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
            e.preventDefault();
            e.currentTarget.form?.requestSubmit();
          }}
          // Poignée de redimensionnement retirée : la hauteur est déjà celle du
          // contenu, la poignée ne ferait que lutter contre elle.
          className={`${inputClass} resize-none`}
        />
      ) : (
        <input
          {...commun}
          inputMode={inputMode}
          list={listeId}
          {...saisie}
          className={inputClass}
        />
      )}
      {listeId && (
        <datalist id={listeId}>
          {suggestions?.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
      {hint && !error && (
        <p id={`hint-${id}`} className="text-xs text-gray-light mt-1">
          {hint}
        </p>
      )}
      {error && (
        <p id={`err-${id}`} role="alert" className={errorClass}>
          {error}
        </p>
      )}
    </div>
  );
}
