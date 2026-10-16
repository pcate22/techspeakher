"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useChampDegage } from "@/components/barre-action";
import { useAnnonceListe } from "@/components/AnnonceListe";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import ClearableInput from "@/components/ClearableInput";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { IDLE, restoredValue, restoredChecked, type ActionState } from "@/lib/action-state";
import { inputCls } from "@/app/admin/tremplins/[edition]/styles";

/**
 * Champs déclarés en DONNÉES (sérialisables) : ce composant client est rendu
 * par des pages serveur, qui ne peuvent pas lui passer de fonctions (règle
 * RSC — c'était le crash « Oups » des fiches en preview). La restauration de
 * la saisie sur erreur (React 19) est appliquée ici, côté client.
 */
export type ChampSpec =
  | {
      kind: "input";
      name: string;
      label: string;
      type?: "text" | "url" | "email" | "date" | "time" | "number";
      required?: boolean;
      defaultValue?: string;
      placeholder?: string;
      /** Aide courte SOUS le champ (une idée), reliée en aria-describedby. */
      hint?: string;
      /** Bornes natives (type number/date) : l'action reste la référence. */
      min?: string;
      max?: string;
      step?: string;
      /** Bouton « Effacer » explicite (retour à vide fiable sur mobile, où le
       * picker natif de date ne sait que réinitialiser à la valeur d'origine). */
      clearable?: boolean;
    }
  | {
      kind: "textarea";
      name: string;
      label: string;
      rows?: number;
      defaultValue?: string;
      placeholder?: string;
    }
  | {
      kind: "select";
      name: string;
      label: string;
      options: { value: string; label: string }[];
      defaultValue?: string;
      required?: boolean;
    }
  | {
      kind: "checkboxes";
      name: string;
      legend: string;
      options: { value: string; label: string; checked: boolean }[];
    };

/**
 * Formulaire d\'action « sur place » : soumet une Server Action à résultat
 * (`useActionState`), SANS rechargement de page ni perte de scroll. Le
 * feedback (erreur, confirmation) s\'affiche à côté du bouton — pas dans une
 * bannière à l\'autre bout de la page. Toutes les props sont sérialisables.
 */
export default function InlineActionForm<S extends object>({
  action,
  hidden = {},
  fields = [],
  submitLabel,
  pendingLabel,
  confirm,
  successMessage,
  submitOnChange = false,
  stickySubmit = false,
  variant = "ghost",
  ariaLabel,
  boutonClassName = "",
  className = "flex flex-col gap-2",
}: {
  action: (state: ActionState<S>, formData: FormData) => Promise<ActionState<S>>;
  hidden?: Record<string, string | number>;
  fields?: ChampSpec[];
  submitLabel: string;
  pendingLabel?: string;
  /** Confirmation via une modale (Radix) : question courte, conséquence,
   * verbe du bouton. Objet 100 % sérialisable (rendu depuis des pages serveur). */
  confirm?: { title: string; message: string; label: string };
  /** Message de succès (chaîne calculée côté serveur, nominative). */
  successMessage?: string;
  /** Commandes discrètes (cases, sélecteurs) : enregistrement À LA VOLÉE au
   * changement, sans bouton (doctrine prévisibilité, cf.
   * docs/parcours-participante.md §4). Incompatible avec `confirm`. */
  submitOnChange?: boolean;
  /** Formulaire de page entière : rend le CTA dans une barre COLLANTE en bas
   * (toujours visible, jamais sous la flottaison) et déplace le focus sur la
   * confirmation au succès. Cf. principes §9 + checklist cognitive. */
  stickySubmit?: boolean;
  variant?: "primary" | "ghost";
  /** Nom accessible du bouton quand son libellé visible ne suffit pas à le
   * distinguer — une flèche « ↑ » répétée sur quinze rangées ne s'annonce pas
   * (RGAA 11.1). Le libellé visible reste le symbole. */
  ariaLabel?: string;
  /** Classes du bouton (cible tactile, largeur) : le gabarit reste au parent. */
  boutonClassName?: string;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState<S>, FormData>(
    action as (state: Awaited<ActionState<S>>, payload: FormData) => Promise<ActionState<S>>,
    IDLE as Awaited<ActionState<S>>,
  );
  const statusRef = useRef<HTMLParagraphElement>(null);
  const alertRef = useRef<HTMLParagraphElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  // `stickySubmit` : la barre ne doit pas masquer le champ qu'on vient
  // d'atteindre (sans barre collante, le crochet est sans effet).
  useChampDegage(formRef);
  const router = useRouter();
  // La liste englobante porte-t-elle une région vive qui SURVIT au
  // rafraîchissement ? (cf. AnnonceListe) — sinon on garde la région locale.
  const annonceListe = useAnnonceListe();
  const [confirmOpen, setConfirmOpen] = useState(false);
  // En enregistrement à la volée, les contrôles sont CONTRÔLÉS : React 19
  // réinitialise les champs non contrôlés sur des defaultValue encore périmés
  // après chaque soumission — le sélecteur « ressautait » à l'ancienne valeur
  // pendant l'aller-retour réseau (feedback dominant faux).
  const [choix, setChoix] = useState<Record<string, string>>({});
  const [cochees, setCochees] = useState<Record<string, boolean>>({});
  // Le bouton EST le feedback : au succès il devient « Enregistré ✓ », puis
  // redevient son libellé dès qu'on retouche un champ (repère clair et visible,
  // là où l'œil est déjà — pas un message perdu ailleurs).
  const [justSaved, setJustSaved] = useState(false);

  // Un succès rafraîchit la page : le reste de la fiche (compteurs,
  // descriptions, listes dérivées) reflète tout de suite le nouvel état.
  // Une ERREUR en enregistrement à la volée réinitialise l'état optimiste :
  // le contrôle retombe sur la valeur RÉELLE (celle des props, inchangée en
  // base) au lieu de garder la valeur choisie — sinon l'orga voit « Présente »
  // alors que rien n'a été enregistré (divergence UI/base silencieuse).
  useEffect(() => {
    if (state.status === "success") {
      // Un geste en LOT se supprime souvent lui-même : « Marquer présentes les
      // N non encore pointées » disparaît quand N tombe à zéro, emportant sa
      // région vive avant qu'elle n'ait parlé — succès parfaitement silencieux.
      // Quand la liste porte un annonceur, il survit au rafraîchissement.
      if (annonceListe && successMessage) annonceListe.annoncer(successMessage);
      router.refresh();
      // Bouton-confirmation (formulaires à bouton). Pas en enregistrement à la
      // volée : pas de bouton visible à transformer.
      if (!submitOnChange) setJustSaved(true);
    } else if (state.status === "error" && submitOnChange) {
      setChoix({});
      setCochees({});
    }
  }, [state, router, submitOnChange, annonceListe, successMessage]);

  // Le retour du résultat (succès OU erreur) referme la confirmation : le
  // feedback vit dans les régions vivantes à côté du bouton, pas dans la modale.
  useEffect(() => {
    if (state.status !== "idle") setConfirmOpen(false);
  }, [state]);

  // Régions vivantes permanentes, vider-puis-remplir : annonce fiable par les
  // lecteurs d\'écran même quand le même message revient (cf. AdminDialog).
  useEffect(() => {
    const status = statusRef.current;
    const alert = alertRef.current;
    if (!status || !alert) return;
    status.textContent = "";
    alert.textContent = "";
    if (state.status === "idle") return;
    const t = setTimeout(() => {
      if (state.status === "success") {
        // Jamais DEUX annonces pour un geste : si la liste l'a pris en charge,
        // la région locale reste muette.
        status.textContent = annonceListe ? "" : (successMessage ?? "");
        // Formulaire de page entière : on déplace le focus sur la confirmation
        // (repère clair « c'est enregistré » pour lecteur d'écran ET charge
        // cognitive). Jamais en enregistrement à la volée (on ne vole pas le
        // focus du contrôle qu'on vient de changer).
        if (stickySubmit && !submitOnChange) status.focus();
      } else if (state.status === "error") {
        alert.textContent = state.error;
        // En enregistrement à la volée, on ne VOLE pas le focus du contrôle
        // que la personne vient de changer (role="alert" suffit à annoncer).
        if (!submitOnChange) alert.focus();
      }
    }, 30);
    return () => clearTimeout(t);
    // successMessage est une prop stable : state suffit comme déclencheur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className={className}
      onChange={() => {
        // Retoucher un champ ramène le bouton à son libellé standard.
        setJustSaved(false);
        if (submitOnChange) formRef.current?.requestSubmit();
      }}
      // Garde de la soumission IMPLICITE (Entrée dans un champ) : tant que la
      // confirmation n'est pas ouverte, on la demande au lieu de soumettre.
      // Dialogue ouvert = la soumission ne peut venir que de son bouton
      // « confirmer » (le focus y est piégé), on laisse passer.
      onSubmit={(e) => {
        if (confirm && !confirmOpen) {
          e.preventDefault();
          setConfirmOpen(true);
        }
      }}
    >
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {submitOnChange && (
        <p className="sr-only">Chaque modification s&apos;enregistre automatiquement.</p>
      )}
      {fields.map((f) => {
        if (f.kind === "checkboxes") {
          return (
            <fieldset key={f.name} className="border border-navy-lighter rounded-lg p-3">
              <legend className="text-xs text-gray-light px-1">{f.legend}</legend>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 list-none">
                {f.options.map((o) => (
                  <li key={o.value}>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name={f.name}
                        value={o.value}
                        {...(submitOnChange
                          ? {
                              // Non contrôlé mais RE-CLÉ sur le dernier choix :
                              // le reset post-action de React re-applique ce
                              // defaultChecked (un contrôlé serait écrasé au
                              // niveau DOM sans re-rendu).
                              key: `${o.value}:${cochees[`${f.name}:${o.value}`] ?? o.checked}`,
                              defaultChecked:
                                cochees[`${f.name}:${o.value}`] ?? o.checked,
                              onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                                setCochees((c) => ({
                                  ...c,
                                  [`${f.name}:${o.value}`]: e.target.checked,
                                })),
                            }
                          : {
                              defaultChecked:
                                state.status === "error"
                                  ? restoredChecked(state, f.name, o.value)
                                  : o.checked,
                            })}
                        className="accent-cyan"
                      />
                      {o.label}
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          );
        }
        // Restauration UNIQUEMENT sur erreur (restoredValue renvoie "" hors
        // erreur, jamais undefined : un `??` masquerait le defaultValue et un
        // « Enregistrer » réécrirait des champs vides en base).
        const valeur =
          state.status === "error" ? restoredValue(state, f.name) : (f.defaultValue ?? "");
        if (f.kind === "input" && f.clearable) {
          // key : re-monte le champ quand la valeur restaurée change (défaut
          // non contrôlé lu au premier rendu seulement), comme les selects.
          return (
            <ClearableInput
              key={`${f.name}:${valeur}`}
              name={f.name}
              type={f.type === "date" || f.type === "time" || f.type === "number" ? f.type : "text"}
              label={f.label}
              defaultValue={valeur}
              placeholder={f.placeholder}
              min={f.min}
              max={f.max}
              step={f.step}
            />
          );
        }
        if (f.kind === "select") {
          return (
            <label key={f.name} className="text-sm flex flex-col gap-1">
              {f.label}
              {/* key : re-monte le select quand la valeur restaurée change
                  (defaultValue seul n'est lu qu'au premier rendu). */}
              <select
                name={f.name}
                required={f.required}
                {...(submitOnChange
                  ? {
                      // Idem : re-clé sur le dernier choix pour que le reset
                      // post-action retombe dessus (pas de « ressaut »).
                      key: choix[f.name] ?? valeur,
                      defaultValue: choix[f.name] ?? valeur,
                      onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
                        setChoix((c) => ({ ...c, [f.name]: e.target.value })),
                    }
                  : // key : re-monte le select quand la valeur restaurée change
                    // (defaultValue seul n'est lu qu'au premier rendu).
                    { key: valeur, defaultValue: valeur })}
                className={inputCls}
              >
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          );
        }
        return (
          // L'indice est un FRÈRE du label (relié en aria-describedby), pas un
          // enfant : dans ce label enveloppant, tout texte enfant entrerait
          // dans le NOM accessible du champ (verbeux, et redondant avec la
          // description). Il reste donc description seule.
          <div key={f.name} className="flex flex-col gap-1">
            <label className="text-sm flex flex-col gap-1">
              {/* Libellé et astérisque sur UNE seule ligne : sans ce span, le
                  `flex flex-col` du label mettait le « * » sur sa propre ligne,
                  entre le libellé et le champ (affichage cassé). */}
              <span>
                {f.label}
                {f.kind === "input" && f.required && (
                  <>
                    {/* Indicateur d'obligation VISIBLE (RGAA 11.10) en plus du
                        rappel sr-only : l'astérisque seul ne suffit pas au lecteur
                        d'écran, le sr-only seul ne suffit pas au voyant. */}
                    <span aria-hidden="true" className="text-orange"> *</span>
                    <span className="sr-only"> (obligatoire)</span>
                  </>
                )}
              </span>
              {f.kind === "textarea" ? (
                <textarea
                  name={f.name}
                  rows={f.rows ?? 3}
                  defaultValue={valeur}
                  placeholder={f.placeholder}
                  className={inputCls}
                />
              ) : (
                <input
                  type={f.type ?? "text"}
                  name={f.name}
                  required={f.required}
                  defaultValue={valeur}
                  placeholder={f.placeholder}
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  aria-describedby={f.kind === "input" && f.hint ? `hint-${f.name}` : undefined}
                  className={inputCls}
                />
              )}
            </label>
            {f.kind === "input" && f.hint && (
              <span id={`hint-${f.name}`} className="text-xs text-gray-light">
                {f.hint}
              </span>
            )}
          </div>
        );
      })}
      {(() => {
        const actionRow = submitOnChange ? (
          // Enregistrement à la volée : pas de bouton (sauf sans JavaScript,
          // où le changement ne déclenche rien — le bouton reste le secours).
          <noscript>
            <Button type="submit" variant={variant} size="sm">
              {submitLabel}
            </Button>
          </noscript>
        ) : (
          <div className="flex items-center gap-3">
            {confirm ? (
              <ConfirmSubmitButton
                title={confirm.title}
                message={confirm.message}
                confirmLabel={confirm.label}
                pendingLabel={pendingLabel ?? confirm.label}
                variant={variant}
                disabled={pending}
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
              >
                {pending ? (pendingLabel ?? submitLabel) : submitLabel}
              </ConfirmSubmitButton>
            ) : (
              <Button
                type="submit"
                variant={variant}
                size="sm"
                disabled={pending}
                aria-label={ariaLabel}
                className={`${stickySubmit ? "w-full justify-center" : ""} ${boutonClassName}`.trim()}
              >
                {pending
                  ? (pendingLabel ?? submitLabel)
                  : justSaved
                    ? "Enregistré ✓"
                    : submitLabel}
              </Button>
            )}
          </div>
        );
        const feedback = (
          <>
            {/* Confirmation : le BOUTON la porte visuellement (« Enregistré ✓ »)
                pour les formulaires à bouton → statut en sr-only (annonce lecteur
                d'écran). En enregistrement à la volée (pas de bouton), le statut
                reste VISIBLE : c'est le seul retour. */}
            <p
              ref={statusRef}
              role="status"
              aria-live="polite"
              tabIndex={-1}
              className={
                submitOnChange
                  ? "text-sm text-cyan empty:hidden focus-visible:outline-none"
                  : "sr-only"
              }
            />
            <p
              ref={alertRef}
              role="alert"
              tabIndex={-1}
              className="text-sm text-orange focus-visible:outline-none empty:hidden"
            />
          </>
        );
        // CTA de page entière : barre COLLANTE en bas, confirmation AU-DESSUS du
        // bouton pour qu'elle reste visible (jamais un bouton sous la flottaison,
        // ni un message perdu dessous). Sinon, disposition normale sous le champ.
        // Collante SANS condition de hauteur, contrairement aux formulaires de
        // profil : `stickySubmit` est demandé écran par écran, et il l'a été
        // pour la sous-page « Informations » d'un atelier — CINQ champs, et le
        // CTA hors écran quand même (registre des erreurs). Mesurer le seul
        // formulaire y rendrait la barre statique et rejouerait l'incident : ce
        // qui débordait, c'était la page.
        return stickySubmit && !submitOnChange ? (
          <div className="barre-action-collante -mx-1 mt-2 flex flex-col gap-2 border-t border-field-border bg-navy px-1 pt-3 pb-3">
            {feedback}
            {actionRow}
          </div>
        ) : (
          <>
            {actionRow}
            {feedback}
          </>
        );
      })()}
    </form>
  );
}
