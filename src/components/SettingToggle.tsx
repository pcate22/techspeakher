"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IDLE, type ActionState } from "@/lib/action-state";

/**
 * Ligne de réglage « à la Google » : libellé + description à gauche, contrôle à
 * droite (interrupteur de niveau 1, ou case à cocher de niveau 2 dépendante).
 * Enregistrement À LA VOLÉE au changement (doctrine prévisibilité) : un clic
 * soumet la Server Action, et le succès rafraîchit la page (l'état réel vient
 * du serveur). L'affichage est OPTIMISTE le temps de l'aller-retour ; une erreur
 * le ramène à l'état réel.
 *
 * `present` (valeur cible) est calculé depuis l'état SERVEUR (`checked`), jamais
 * depuis l'optimiste : le contrôle reste juste même en cas de double-clic.
 */
export default function SettingToggle<S extends object>({
  action,
  hidden,
  checked,
  label,
  ariaLabel,
  description,
  control = "switch",
  disabled = false,
  successMessage = "Enregistré.",
  onOptimistic,
  controlsId,
}: {
  action: (state: ActionState<S>, formData: FormData) => Promise<ActionState<S>>;
  hidden: Record<string, string | number>;
  checked: boolean;
  label: string;
  /** Nom accessible du contrôle quand le libellé visible ne suffit pas à le
   * distinguer (ex. cases « Présente » répétées : le nom de la participante y
   * est ajouté pour un intitulé UNIQUE, RGAA 11.1). Défaut : `label`. */
  ariaLabel?: string;
  description?: string;
  control?: "switch" | "checkbox";
  disabled?: boolean;
  successMessage?: string;
  /** Si l'interrupteur RÉVÈLE une région dépendante (cf. ToggleWithDependent) :
   * son `id`. Le contrôle porte alors `aria-controls` + `aria-expanded` (suit
   * l'état affiché), pour annoncer l'apparition du sous-contrôle (RGAA 7.1). */
  controlsId?: string;
  /** Notifié de l'état OPTIMISTE (clic immédiat, ou retour au réel sur erreur) :
   * permet à un parent d'afficher/masquer un contrôle dépendant sans attendre
   * l'aller-retour serveur (le sous-contrôle « suit » l'interrupteur tout de suite). */
  onOptimistic?: (next: boolean) => void;
}) {
  const [state, formAction, pending] = useActionState<ActionState<S>, FormData>(
    action as (s: Awaited<ActionState<S>>, fd: FormData) => Promise<ActionState<S>>,
    IDLE as Awaited<ActionState<S>>,
  );
  const router = useRouter();
  const [optimiste, setOptimiste] = useState(checked);
  // Descriptions reliées au contrôle (aria-describedby) : conséquence du toggle
  // + note « s'enregistre automatiquement ». Sinon le lecteur d'écran n'entend
  // que le libellé, jamais l'effet du changement (RGAA 11.2).
  const descId = useId();
  const noteId = useId();
  const describedBy = [description ? descId : null, noteId].filter(Boolean).join(" ");
  const statusRef = useRef<HTMLParagraphElement>(null);
  const alertRef = useRef<HTMLParagraphElement>(null);

  // Resynchronisation sur la vérité serveur SANS effet (motif « état dérivé »,
  // pas de flash) : quand la prop change (rafraîchissement post-succès), on
  // réaligne l'optimiste pendant le rendu.
  const [checkedVu, setCheckedVu] = useState(checked);
  if (checked !== checkedVu) {
    setCheckedVu(checked);
    setOptimiste(checked);
  }

  useEffect(() => {
    if (state.status === "success") router.refresh();
    else if (state.status === "error") {
      setOptimiste(checked); // rien enregistré : on revient au réel
      onOptimistic?.(checked); // et le contrôle dépendant aussi
    }
    // onOptimistic est stable côté appelant ; state suffit comme déclencheur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, checked, router]);

  // Régions vivantes vider-puis-remplir (annonce fiable même message répété).
  useEffect(() => {
    const status = statusRef.current;
    const alert = alertRef.current;
    if (!status || !alert) return;
    status.textContent = "";
    alert.textContent = "";
    if (state.status === "success") status.textContent = successMessage;
    else if (state.status === "error") alert.textContent = state.error;
    // successMessage est stable : state suffit comme déclencheur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  /**
   * INDISPONIBLE, mais toujours dans le parcours clavier.
   *
   * `disabled` posé sur le contrôle QUI A LE FOCUS le retire du parcours : le
   * focus tombe sur `body` et la tabulation repart du début du document.
   * Mesuré sur l'écran des présences : `focusout` à t+6 ms après chaque
   * pointage, 12 tabulations pour revenir à la première case, une de plus par
   * personne — 285 tabulations pour en pointer quinze (WCAG 2.4.3 et 3.2.2).
   *
   * Même motif que `RangeeGlissante` et `ConfirmSubmitButton` : « un bouton
   * désactivé sort du parcours clavier, donc disparaît au lecteur d'écran ».
   */
  const indisponible = disabled || pending;
  const bloquerSiIndisponible = (e: React.MouseEvent) => {
    if (indisponible) e.preventDefault();
  };
  const commun =
    "shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-navy aria-disabled:opacity-40 aria-disabled:cursor-not-allowed";

  return (
    <form
      action={formAction}
      className="flex items-start justify-between gap-4 py-3"
      onSubmit={(e) => {
        // Le clic est déjà neutralisé plus haut ; cette garde couvre les autres
        // chemins de soumission (« Entrée » dans le formulaire, par exemple).
        if (indisponible) return e.preventDefault();
        const next = !optimiste;
        setOptimiste(next);
        onOptimistic?.(next);
      }}
    >
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {/* Valeur cible = inverse de l'état AFFICHÉ (optimiste), pas du prop serveur :
          un clic « annuler » dans la fenêtre post-succès / pré-rafraîchissement
          (où le prop est encore périmé) envoie ainsi la bonne cible. */}
      <input type="hidden" name="present" value={String(!optimiste)} />

      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {description && (
          <span id={descId} className="block text-xs text-gray-light mt-0.5">
            {description}
          </span>
        )}
        <span id={noteId} className="sr-only">
          Chaque changement s&apos;enregistre automatiquement.
        </span>
        <p ref={statusRef} role="status" aria-live="polite" className="text-xs text-cyan mt-1 empty:hidden" />
        <p ref={alertRef} role="alert" className="text-xs text-orange mt-1 empty:hidden" />
      </span>

      {control === "switch" ? (
        <button
          type="submit"
          role="switch"
          aria-checked={optimiste}
          aria-label={ariaLabel ?? label}
          aria-describedby={describedBy}
          aria-expanded={controlsId ? optimiste : undefined}
          aria-controls={controlsId}
          aria-disabled={indisponible || undefined}
          onClick={bloquerSiIndisponible}
          className={`${commun} relative inline-flex h-6 w-11 items-center rounded-full ${
            optimiste ? "bg-cyan" : "bg-navy-lighter"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
              optimiste ? "translate-x-[22px]" : "translate-x-0.5"
            }`}
          />
        </button>
      ) : (
        <button
          type="submit"
          role="checkbox"
          aria-checked={optimiste}
          aria-label={ariaLabel ?? label}
          aria-describedby={describedBy}
          aria-expanded={controlsId ? optimiste : undefined}
          aria-controls={controlsId}
          aria-disabled={indisponible || undefined}
          onClick={bloquerSiIndisponible}
          className={`${commun} grid h-6 w-6 place-items-center rounded-md border-2 ${
            optimiste ? "border-cyan bg-cyan text-navy" : "border-gray-light bg-navy"
          }`}
        >
          {optimiste && (
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-4 w-4">
              <path
                fillRule="evenodd"
                d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.3 3.29 6.8-6.8a1 1 0 0 1 1.4 0Z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </button>
      )}
    </form>
  );
}
