"use client";

import { useEffect, useState } from "react";
import type { RegistreConf } from "@/lib/talks";
import { filtrerConferences } from "@/lib/conference-recherche";
import { foldRecherche } from "@/lib/normalise-recherche";
import { inputClass, labelClass, errorClass } from "@/components/ChampTexte";

/** Valeur remontée pour « ma conférence manque dans la liste ». */
export const HORS_REGISTRE = "proposer";

const LIBELLE_HORS_REGISTRE = "Ma conférence manque dans la liste…";

/**
 * Choix de conférence : un champ où on TAPE au lieu de dérouler — avec 126
 * conférences au répertoire, la recherche filtre indifféremment sur le nom,
 * la ville et le pays (« Belgique » fait remonter Devoxx Belgium, « Lille »
 * Cloud Nord). Le filtre vit dans `filtrerConferences` (pur, testé seul).
 *
 * Même pattern accessible éprouvé que la recherche du site (SearchBar) :
 * input `role="combobox"`, listbox toujours dans le DOM (aria-controls valide),
 * options parcourues aux flèches via aria-activedescendant et cliquables
 * directement, nombre de résultats annoncé dans une région vivante.
 *
 * L'option « Ma conférence manque dans la liste… » ferme TOUJOURS la liste,
 * quel que soit le filtre : c'est la porte du circuit de proposition
 * (migration 068), elle suit la recherche au lieu de disparaître derrière.
 * La choisir remonte aussi le texte tapé — le parent peut en pré-remplir le
 * champ « nom de la conférence », pour éviter de le retaper.
 *
 * CONTRÔLÉ par le parent (`valeur` = "" | id | HORS_REGISTRE) : le composant
 * ne garde que l'éphémère — texte en cours de frappe, liste ouverte, option
 * active. Fermer sans choisir rend le texte au choix en cours.
 */
export default function ConferenceCombobox({
  id,
  label,
  registre,
  valeur,
  onChange,
  error,
  required,
}: {
  id: string;
  label: string;
  registre: RegistreConf[];
  /** "" (aucun choix), un id de conférence, ou HORS_REGISTRE. */
  valeur: string;
  /** Le choix, plus le texte tapé au moment du choix (pour pré-remplir). */
  onChange: (valeur: string, saisie: string) => void;
  error?: string;
  required?: boolean;
}) {
  // `null` = « affiche le choix en cours » ; une chaîne = frappe en cours.
  const [saisie, setSaisie] = useState<string | null>(null);
  const [ouverte, setOuverte] = useState(false);
  const [active, setActive] = useState(-1);

  const confChoisie =
    valeur === "" || valeur === HORS_REGISTRE
      ? null
      : (registre.find((c) => String(c.id) === valeur) ?? null);
  const affichage =
    saisie ??
    (valeur === HORS_REGISTRE ? LIBELLE_HORS_REGISTRE : (confChoisie?.nom ?? ""));

  const trouvees = filtrerConferences(registre, saisie ?? "");
  // L'option « manque » est TOUJOURS là, en dernier : index = trouvees.length.
  const nbOptions = trouvees.length + 1;
  const listboxId = `${id}-listbox`;
  const optionId = (i: number) => `${id}-option-${i}`;

  function ouvre() {
    setOuverte(true);
    setActive(-1);
  }

  /** Ferme et rend le texte au choix en cours (la frappe était exploratoire). */
  function ferme() {
    setOuverte(false);
    setSaisie(null);
    setActive(-1);
  }

  function choisit(i: number) {
    const texteTape = saisie ?? "";
    if (i === trouvees.length) onChange(HORS_REGISTRE, texteTape);
    else if (trouvees[i]) onChange(String(trouvees[i].id), texteTape);
    ferme();
  }

  /**
   * Quitter le champ (blur, ou Entrée sans option active) : une frappe qui est
   * EXACTEMENT un nom du répertoire (casse et accents libres) vaut un choix —
   * sur téléphone, taper « DevFest Toulouse » en entier puis toucher le champ
   * suivant est un geste courant, et le rejeter garderait l'ANCIEN choix en
   * silence. Une frappe partielle reste exploratoire : rien d'engagé.
   */
  function fermeEnEngageant() {
    const pliee = foldRecherche(saisie ?? "").trim();
    if (pliee !== "") {
      const exacte = registre.find((c) => foldRecherche(c.nom).trim() === pliee);
      if (exacte) return choisit(trouvees.indexOf(exacte));
    }
    ferme();
  }

  // L'option active suit les flèches jusque HORS de la fenêtre visible de la
  // liste (max-h-64 ≈ 6 options sur 126) : sans ce défilement, on navigue en
  // aveugle et la dernière option — la porte « ma conférence manque » — reste
  // visuellement inatteignable au clavier. Le natif du <select> le faisait.
  useEffect(() => {
    if (active < 0) return;
    document
      .getElementById(`${id}-option-${active}`)
      ?.scrollIntoView?.({ block: "nearest" });
  }, [active, id]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!ouverte) return ouvre();
      const pas = e.key === "ArrowDown" ? 1 : -1;
      setActive((a) => Math.min(Math.max(a + pas, 0), nbOptions - 1));
    } else if (e.key === "Enter") {
      // Liste ouverte : Entrée agit sur ELLE (jamais une soumission surprise
      // en pleine exploration). Fermée, elle garde son sens de formulaire.
      if (!ouverte) return;
      e.preventDefault();
      if (active >= 0) choisit(active);
      else fermeEnEngageant();
    } else if (e.key === "Escape") {
      if (!ouverte) return;
      e.preventDefault();
      ferme();
    }
  }

  const describedBy = error ? `err-${id}` : undefined;

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
      <div className="relative">
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={ouverte}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? optionId(active) : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          autoComplete="off"
          value={affichage}
          placeholder="Nom, ville ou pays…"
          onChange={(e) => {
            setSaisie(e.target.value);
            setOuverte(true);
            setActive(-1);
          }}
          onFocus={(e) => {
            // Le texte affiché (choix en cours) se remplace d'une frappe au
            // lieu de se rallonger.
            e.target.select();
            ouvre();
          }}
          onClick={ouvre}
          onBlur={fermeEnEngageant}
          onKeyDown={onKeyDown}
          className={inputClass}
        />
        {/* Toujours dans le DOM : aria-controls pointe une vraie cible. */}
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Conférences correspondantes"
          className={
            ouverte
              ? "absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-field-border bg-navy py-1 shadow-2xl"
              : "hidden"
          }
        >
          {trouvees.map((c, i) => (
            // Option cliquable directement (pas de bouton imbriqué), parcourue
            // au clavier via aria-activedescendant — le focus reste au champ.
            <li
              key={c.id}
              id={optionId(i)}
              role="option"
              aria-selected={String(c.id) === valeur}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault(); // garde le focus (et le blur) au champ
                choisit(i);
              }}
              // L'option active porte un ANNEAU en plus du fond :
              // `bg-navy-lighter` sur `bg-navy` plafonne à 1,26:1 (§9 du
              // formulaire), imperceptible en basse vision (WCAG 1.4.11).
              className={`cursor-pointer px-3 py-2 text-sm ${
                i === active ? "bg-navy-lighter ring-2 ring-inset ring-cyan" : ""
              }`}
            >
              <span className="text-white">{c.nom}</span>
              {(c.ville || c.pays) && (
                // Le lieu est AFFICHÉ : on voit pourquoi « Lille » fait
                // remonter Cloud Nord, et il départage deux DevFest.
                <span className="ml-2 text-xs text-gray-light">
                  {[c.ville, c.pays].filter(Boolean).join(", ")}
                </span>
              )}
            </li>
          ))}
          <li
            id={optionId(trouvees.length)}
            role="option"
            aria-selected={valeur === HORS_REGISTRE}
            onMouseEnter={() => setActive(trouvees.length)}
            onMouseDown={(e) => {
              e.preventDefault();
              choisit(trouvees.length);
            }}
            className={`cursor-pointer px-3 py-2 text-sm text-cyan ${
              active === trouvees.length
                ? "bg-navy-lighter ring-2 ring-inset ring-cyan"
                : ""
            }`}
          >
            {LIBELLE_HORS_REGISTRE}
          </li>
        </ul>
      </div>
      {/* Les mises à jour de la listbox s'annoncent ici (RGAA 7.5). */}
      <p role="status" aria-live="polite" className="sr-only">
        {/* Annoncé dès l'OUVERTURE, pas seulement à la frappe : sans lui, la
            liste déployée au clic reste muette au lecteur d'écran. */}
        {ouverte
          ? trouvees.length > 0
            ? `${trouvees.length} conférence${trouvees.length > 1 ? "s" : ""} trouvée${trouvees.length > 1 ? "s" : ""}`
            : "Aucune conférence trouvée. Propose la tienne avec la dernière option."
          : ""}
      </p>
      {error && (
        <p id={`err-${id}`} role="alert" className={errorClass}>
          {error}
        </p>
      )}
    </div>
  );
}
