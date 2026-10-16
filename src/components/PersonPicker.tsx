"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { foldRecherche } from "@/lib/normalise-recherche";

export type PersonOption = { id: number; label: string; sousTitre?: string };

/**
 * Champ « personne » : on tape un nom, on choisit une (ou plusieurs) personnes
 * existantes, ou on crée si absente. Combobox accessible (patron ARIA
 * combobox + listbox, navigation clavier, option active ramenée à l'écran et
 * annoncée). Composant CLIENT, sans accès base : il reçoit les `candidats`
 * (sérialisables) et porte la sélection ; les ids choisis sont soumis via des
 * `<input type="hidden" name={name}>` (plusieurs si `multiple`). La création
 * est portée par le formulaire appelant : quand on active « Créer … »,
 * `children(nomTapé)` révèle les champs à remplir.
 */
export default function PersonPicker({
  name,
  candidats,
  multiple = false,
  placeholder = "Tape un nom…",
  ariaLabel,
  ariaLabelledBy,
  emptyLabel = "Aucune personne ne correspond.",
  createLabel,
  onCreationChange,
  children,
}: {
  name: string;
  candidats: PersonOption[];
  multiple?: boolean;
  placeholder?: string;
  /** Nom accessible explicite ; sinon, préférer `ariaLabelledBy` (lie le
   * `<label>` visible au combobox, RGAA 11.1). */
  ariaLabel?: string;
  /** id d'un `<label>` visible dont le texte nomme le combobox (RGAA 11.1). */
  ariaLabelledBy?: string;
  emptyLabel?: string;
  /** Active l'entrée « Créer … » (libellé calculé à partir de la saisie). */
  createLabel?: (query: string) => string;
  /** Notifie l'ouverture/fermeture du bloc de création (le parent adapte son
   * bouton de validation : « Relier » vs « Inviter »…). */
  onCreationChange?: (active: boolean) => void;
  /** Champs de création, révélés quand « Créer … » est activé. */
  children?: (query: string) => ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState<PersonOption[]>([]);
  const [creation, setCreation] = useState<string | null>(null);
  const [annonce, setAnnonce] = useState("");
  const listId = useId();
  const optionId = (i: number) => `${listId}-opt-${i}`;
  const inputRef = useRef<HTMLInputElement>(null);
  const activeRef = useRef<HTMLLIElement>(null);
  const creationRef = useRef<HTMLDivElement>(null);

  // MONO déjà rempli : une personne est choisie et on n'en veut qu'une. On
  // REMPLACE alors le champ de recherche par la valeur choisie (encadré clair +
  // « Changer ») — sinon le placeholder « Tape son nom… » restait affiché et
  // laissait croire qu'on pouvait en ajouter une seconde (retour preview).
  const monoRempli = !multiple && selected.length > 0;

  const selectedIds = new Set(selected.map((s) => s.id));
  const matches = useMemo(() => {
    const q = foldRecherche(query.trim());
    return candidats
      .filter((c) => !selectedIds.has(c.id))
      .filter((c) => q === "" || foldRecherche(c.label).includes(q));
    // selectedIds via selected : recalcul quand l'un ou l'autre change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, candidats, selected]);

  // En MONO, créer remplacerait la sélection en cours : on ne le propose pas
  // tant qu'un jeton est posé (le retirer d'abord) — aucune perte silencieuse.
  // En multi, sélection(s) et création se cumulent.
  // Et une seule invitation par envoi (un seul champ e-mail) : bloc de
  // création déjà ouvert → on ne re-propose pas « Créer » (sinon il
  // remplacerait le nom mémorisé sans prévenir).
  const showCreate =
    !!createLabel &&
    query.trim().length > 0 &&
    creation === null &&
    (multiple || selected.length === 0);
  // Nombre d'entrées de la liste (options + éventuel « Créer »).
  const itemCount = matches.length + (showCreate ? 1 : 0);

  // L'option active suit la navigation clavier : on la ramène dans la zone
  // visible (liste défilante), sinon aria-activedescendant pointe hors écran.
  useEffect(() => {
    if (open) activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  // « L'inviter par e-mail » révèle les champs de création : on y place le
  // focus (sinon l'utilisateur clavier/lecteur d'écran ne sait pas qu'ils sont
  // apparus, le focus restant sur le combobox).
  useEffect(() => {
    onCreationChange?.(creation !== null);
    if (creation !== null) {
      creationRef.current
        ?.querySelector<HTMLElement>("input, select, textarea")
        ?.focus();
    }
    // onCreationChange : le parent le mémoïse ou non ; on ne dépend que de creation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creation]);

  const choisir = (opt: PersonOption) => {
    setSelected((prev) => (multiple ? [...prev, opt] : [opt]));
    setQuery("");
    setActive(0);
    // En MONO, compte et invitation s'excluent : choisir referme la création.
    // En multi ils se cumulent — l'e-mail déjà tapé ne doit pas se perdre.
    if (!multiple) setCreation(null);
    setOpen(false);
    setAnnonce(`${opt.label} ajoutée.`);
    inputRef.current?.focus();
  };

  const creer = () => {
    setCreation(query.trim());
    setOpen(false);
  };

  const activer = (i: number) => {
    if (showCreate && i === matches.length) return creer();
    const opt = matches[i];
    if (opt) choisir(opt);
  };

  const retirer = (id: number) => {
    const partant = selected.find((s) => s.id === id);
    setSelected((prev) => prev.filter((s) => s.id !== id));
    if (partant) setAnnonce(`${partant.label} retirée.`);
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      // Liste fermée : on l'ouvre et on surligne la 1re entrée (index 0) ;
      // liste ouverte : on descend d'un cran (patron ARIA combobox).
      if (!open) {
        setOpen(true);
        setActive(0);
      } else {
        setActive((a) => Math.min(a + 1, Math.max(0, itemCount - 1)));
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setActive(0);
      } else {
        setActive((a) => Math.max(a - 1, 0));
      }
    } else if (e.key === "Enter") {
      if (open && itemCount > 0) {
        e.preventDefault();
        activer(active);
      }
    } else if (e.key === "Escape") {
      // Liste ouverte : Échap la replie et ne doit PAS remonter au <dialog>
      // parent (sinon `showModal()` fermerait toute la modale et perdrait la
      // saisie). Liste fermée : on laisse passer, le dialog gère sa fermeture.
      if (open) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      }
    } else if (e.key === "Backspace" && query === "" && selected.length > 0) {
      retirer(selected[selected.length - 1].id);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {/* ids sélectionnés soumis avec le formulaire */}
      {selected.map((s) => (
        <input key={s.id} type="hidden" name={name} value={s.id} />
      ))}

      {/* Annonce vocale (sélection / retrait), invisible à l'écran. */}
      <span role="status" aria-live="polite" className="sr-only">
        {annonce}
      </span>

      {/* MONO rempli : la valeur choisie remplace le champ (plus de ligne de
          recherche « vide » trompeuse). MULTI : jetons cumulables au-dessus du
          champ, qui reste ouvert pour en ajouter d'autres. */}
      {monoRempli ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-field-border bg-navy px-3 py-2 text-sm">
          <span className="min-w-0 truncate">{selected[0].label}</span>
          <button
            type="button"
            onClick={() => retirer(selected[0].id)}
            aria-label={`Changer (actuellement ${selected[0].label})`}
            className="shrink-0 rounded px-1 text-cyan hover:text-cyan-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
          >
            Changer
          </button>
        </div>
      ) : (
        <>
          {multiple && selected.length > 0 && (
            <ul className="flex flex-wrap gap-2 list-none" aria-label="Personnes sélectionnées">
              {selected.map((s) => (
                <li
                  key={s.id}
                  className="inline-flex items-center gap-1 rounded-full border border-navy-lighter bg-navy px-3 py-1 text-sm"
                >
                  {s.label}
                  <button
                    type="button"
                    onClick={() => retirer(s.id)}
                    aria-label={`Retirer ${s.label}`}
                    className="p-2 -m-2 text-gray-light hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded leading-none"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              role="combobox"
          aria-expanded={open && itemCount > 0}
          aria-controls={open && itemCount > 0 ? listId : undefined}
          aria-autocomplete="list"
          aria-label={ariaLabelledBy ? undefined : ariaLabel}
          aria-labelledby={ariaLabelledBy}
          aria-activedescendant={open && itemCount > 0 ? optionId(active) : undefined}
          value={query}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => query && setOpen(true)}
          onKeyDown={onKeyDown}
          className="w-full max-w-full min-w-0 bg-navy border border-navy-lighter rounded-lg px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
        />
        {open && itemCount > 0 && (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-navy-lighter bg-navy-light shadow-sticky list-none"
          >
            {matches.map((c, i) => (
              <li
                key={c.id}
                id={optionId(i)}
                ref={active === i ? activeRef : undefined}
                role="option"
                aria-selected={active === i}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choisir(c)}
                className={`cursor-pointer px-3 py-2 text-sm border-l-2 ${
                  active === i
                    ? "bg-navy-lighter border-cyan font-medium"
                    : "border-transparent"
                }`}
              >
                <span className="block">{c.label}</span>
                {c.sousTitre && <span className="block text-xs text-gray-light">{c.sousTitre}</span>}
              </li>
            ))}
            {showCreate && (
              <li
                id={optionId(matches.length)}
                ref={active === matches.length ? activeRef : undefined}
                role="option"
                aria-selected={active === matches.length}
                onMouseDown={(e) => e.preventDefault()}
                onClick={creer}
                className={`cursor-pointer px-3 py-2 text-sm text-cyan border-l-2 ${
                  active === matches.length
                    ? "bg-navy-lighter border-cyan font-medium"
                    : "border-transparent"
                }`}
              >
                {createLabel!(query.trim())}
              </li>
            )}
          </ul>
        )}
        {/* Liste vide : message annoncé (aria-live) hors du listbox, jamais un
            <li> sans rôle dans role="listbox". Région PERSISTANTE (toujours
            montée, texte conditionnel + empty:hidden) : une live region insérée
            avec son texte déjà présent n'est pas annoncée de façon fiable. */}
        <p
          role="status"
          aria-live="polite"
          className="absolute z-20 mt-1 w-full rounded-lg border border-navy-lighter bg-navy-light px-3 py-2 text-sm text-gray-light shadow-sticky empty:hidden"
        >
          {open && itemCount === 0 ? emptyLabel : ""}
        </p>
          </div>

          {creation !== null && children && (
            <div ref={creationRef} className="rounded-lg border border-dashed border-navy-lighter p-3">
              {children(creation)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
