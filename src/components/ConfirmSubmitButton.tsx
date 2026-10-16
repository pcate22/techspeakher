"use client";

import { useId, useRef, useState } from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { useFormStatus } from "react-dom";
import Button from "@/components/Button";
import { plierConfirmation } from "@/lib/confirmation";
import { inputCls } from "@/app/admin/tremplins/[edition]/styles";

/** Bouton de confirmation : un simple submit, le `pending` vient du form parent.
 * `locked` (saisie de confirmation non satisfaite) le bloque au-delà du
 * `pending` — le geste destructif attend qu'on ait retapé la valeur demandée.
 *
 * Verrou en `aria-disabled` + `preventDefault`, jamais en `disabled` matériel
 * (même choix que DeleteEditionDialog) : un bouton `disabled` sort du parcours
 * clavier, donc au lecteur d'écran il DISPARAÎT — on ne saurait même plus qu'une
 * confirmation reste à débloquer. Là il reste atteignable et annoncé, il refuse
 * seulement de soumettre. */
function ConfirmAction({
  label,
  pendingLabel,
  locked,
  describedBy,
}: {
  label: string;
  pendingLabel: string;
  locked?: boolean;
  describedBy?: string;
}) {
  const { pending } = useFormStatus();
  const bloque = Boolean(pending || locked);
  return (
    <Button
      type="submit"
      variant="ghost"
      size="sm"
      aria-disabled={bloque}
      aria-describedby={describedBy}
      onClick={(e) => {
        if (bloque) e.preventDefault();
      }}
      className={`!text-orange hover:!text-orange min-h-[44px] ${
        bloque ? "opacity-60 cursor-not-allowed" : ""
      }`}
    >
      {pending ? pendingLabel : label}
    </Button>
  );
}

/**
 * Bouton qui ouvre une VRAIE modale de confirmation (Radix AlertDialog)
 * avant de soumettre le `<form action={…}>`
 * parent — plus de `window.confirm`, illisible et estampillé de l'URL du site.
 *
 * EMPHASE INVERSÉE (pattern maison des confirmations destructives) : c'est
 * « Annuler » qui porte le poids visuel (bouton plein) et qui reçoit le focus à
 * l'ouverture — défaut Radix, conservé. Le geste destructif reste parfaitement
 * lisible mais discret. Le clic réflexe sur le bouton le plus voyant ne détruit
 * donc rien, ce qui suffit comme garde-fou pour la plupart des suppressions ;
 * `confirmText` reste là pour les rares gestes qui méritent davantage (compte,
 * édition publiée).
 *
 * Deux pièges assumés ici :
 * - PAS de `AlertDialog.Portal` : le bouton de confirmation doit rester DANS
 *   le `<form>` parent pour que son `type="submit"` soumette l'action ;
 * - PAS de `AlertDialog.Action` : fermer la modale dans le même évènement
 *   démonterait le bouton et React annulerait la soumission (cf. InviteButton).
 *   La modale reste ouverte pendant l'envoi (bouton en `pending`), puis la
 *   navigation ou le re-rendu la referme.
 *
 * Garde « retape pour confirmer » (optionnelle, `confirmText`) : pour les
 * gestes vraiment irréversibles (supprimer un COMPTE), un clic ne suffit pas —
 * on demande de RÉÉCRIRE une valeur qui identifie la personne (son nom si on le
 * connaît, sinon son e-mail, qu'on a dans tous les cas). Tant que la saisie ne
 * correspond à aucune valeur acceptée (repli commun `plierConfirmation` :
 * casse, accents, blancs, ponctuation typographique), le bouton destructif
 * refuse de soumettre. La saisie PART avec le formulaire (`name="confirmation"`)
 * pour que l'action serveur la revérifie — palier 3, cf. §10 des principes.
 */
export default function ConfirmSubmitButton({
  title,
  message,
  confirmLabel,
  pendingLabel = "Un instant…",
  children,
  variant = "ghost",
  disabled,
  open,
  onOpenChange,
  className = "",
  "aria-label": ariaLabel,
  confirmText,
  confirmTextLabel,
  confirmTextHint,
}: {
  /** Question courte (titre de la modale), ex. « Retirer Camille ? » */
  title: string;
  /** La conséquence, en une ou deux phrases. */
  message: string;
  /** Verbe d'action du bouton de confirmation, ex. « Retirer définitivement ». */
  confirmLabel: string;
  pendingLabel?: string;
  /** Libellé du déclencheur. */
  children: React.ReactNode;
  /** Style du déclencheur (le bouton de confirmation, lui, reste discret). */
  variant?: "primary" | "ghost" | "danger" | "secondary";
  disabled?: boolean;
  /** Mode contrôlé (InlineActionForm referme au retour du résultat). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  "aria-label"?: string;
  /** Valeurs acceptées à retaper pour débloquer le bouton (nom, e-mail…).
   * Vide/absent = confirmation par simple clic (comportement historique). */
  confirmText?: string[];
  /** Libellé du champ « retape pour confirmer » (ex. « Écris ton e-mail »). */
  confirmTextLabel?: string;
  /** Aide sous le champ (ex. rappel de la valeur attendue). */
  confirmTextHint?: string;
}) {
  const [typed, setTyped] = useState("");
  const inputId = useId();
  const hintId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  // Valeurs acceptées (pliées casse/accents), la saisie courante, et si elle
  // correspond : de simples dérivées recalculées à chaque frappe — le travail
  // (plier 1-2 chaînes courtes) est plus rapide que la comptabilité d'un memo.
  // Les blancs sont AUSSI normalisés (suites d'espaces réduites à une, espaces
  // insécables comprises) : l'indice est affiché en HTML, qui fractionne les
  // espaces multiples. Sans ça, une valeur attendue « Coder  proprement » se
  // lirait « Coder proprement », et retaper ce qu'on voit ne débloquerait
  // jamais le bouton — la suppression deviendrait impossible.
  const accepted = (confirmText ?? [])
    .map(plierConfirmation)
    .filter((v) => v.length > 0);
  const gated = accepted.length > 0;
  const folded = plierConfirmation(typed);
  const matches = !gated || (folded.length > 0 && accepted.includes(folded));

  // Une fermeture remet la saisie à zéro : rouvrir re-verrouille le bouton (on
  // ne garde jamais une confirmation « armée » d'une session précédente).
  const handleOpenChange = (o: boolean) => {
    if (!o) setTyped("");
    onOpenChange?.(o);
  };

  return (
    <AlertDialog.Root open={open} onOpenChange={handleOpenChange}>
      <AlertDialog.Trigger asChild>
        <Button
          type="button"
          variant={variant}
          size="sm"
          disabled={disabled}
          aria-label={ariaLabel}
          className={className}
        >
          {children}
        </Button>
      </AlertDialog.Trigger>
      <AlertDialog.Overlay className="fixed inset-0 bg-black/60 z-50" />
      <AlertDialog.Content
        // Garde active : on place le focus sur le champ de saisie plutôt que sur
        // « Annuler » (défaut Radix) — c'est là que l'action attend une saisie.
        onOpenAutoFocus={
          gated
            ? (e) => {
                e.preventDefault();
                inputRef.current?.focus();
              }
            : undefined
        }
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-md bg-navy-light border border-navy-lighter rounded-xl p-6 z-50 shadow-sticky"
      >
        <AlertDialog.Title className="text-lg font-bold text-white">{title}</AlertDialog.Title>
        <AlertDialog.Description className="text-sm text-gray-light mt-2">
          {message}
        </AlertDialog.Description>
        {gated && (
          <div className="mt-4">
            <label htmlFor={inputId} className="block text-sm font-medium text-white mb-1">
              {confirmTextLabel ?? "Pour confirmer, réécris ton nom ou ton adresse e-mail"}
            </label>
            <input
              ref={inputRef}
              id={inputId}
              // La saisie PART avec le formulaire : un garde-fou qui ne vit
              // qu'au navigateur se contourne en deux clics de DevTools. Les
              // actions de palier 3 la revérifient avant de détruire.
              name="confirmation"
              type="text"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              aria-describedby={confirmTextHint ? hintId : undefined}
              className={inputCls}
            />
            {confirmTextHint && (
              <p id={hintId} className="mt-1 text-xs text-gray-light">
                {confirmTextHint}
              </p>
            )}
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-3 mt-6">
          <AlertDialog.Cancel asChild>
            <Button type="button" variant="primary" size="sm" className="min-h-[44px]">
              Annuler
            </Button>
          </AlertDialog.Cancel>
          {/* Le bouton pointe vers l'indice : au lecteur d'écran, un bouton
              atteignable mais bloqué doit dire CE QU'ON ATTEND de lui. */}
          <ConfirmAction
            label={confirmLabel}
            pendingLabel={pendingLabel}
            locked={gated && !matches}
            describedBy={gated && confirmTextHint ? hintId : undefined}
          />
        </div>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}
