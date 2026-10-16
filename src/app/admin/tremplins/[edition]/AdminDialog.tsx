"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import { IDLE, type ActionState } from "@/lib/action-state";
export { inputCls } from "./styles";

/**
 * Coquille commune des modales admin « + Ajouter … » (documents, participante,
 * atelier) : une seule implémentation du déclencheur, du chrome `<dialog>`
 * natif et du câblage `useActionState`.
 *
 * PRÉVISIBILITÉ (doctrine, cf. docs/parcours-participante.md §4) : un succès
 * FERME toujours la modale — le résultat est visible sur la page rafraîchie.
 * La saisie en série est un second bouton EXPLICITE (`chainLabel`, ex.
 * « Inviter et enchaîner ») : lui seul garde la modale ouverte (formulaire
 * réinitialisé, message de confirmation, focus sur le 1ᵉʳ champ).
 *
 * Accessibilité intégrée (une fois pour toutes les modales) :
 * - régions vivantes PERMANENTES (présentes dès l'ouverture, texte mis à jour)
 *   pour que succès/erreur soient annoncés de façon fiable, y compris quand le
 *   même message revient (compteur d'ajouts) ;
 * - focus initial sur le 1ᵉʳ champ (pas le bouton ×), focus restauré après
 *   chaque soumission (1ᵉʳ champ en succès, message en erreur) ;
 * - nommage par `aria-labelledby` vers le titre visible ; cible tactile du ×
 *   élargie ; messages masqués à la réouverture (pas de statut périmé).
 *
 * `children` est un render-prop recevant l'état : les champs restaurent leur
 * saisie sur erreur via `restoredValue`/`restoredChecked` (React 19 vide le
 * formulaire à chaque soumission, succès comme échec).
 */
export default function AdminDialog<S extends object>({
  triggerLabel,
  triggerPrefix = "+",
  triggerVariant = "ghost",
  title,
  action,
  submitLabel = "Ajouter",
  pendingLabel = "Ajout…",
  successMessage,
  chainLabel,
  children,
  wrapperClassName = "mt-3",
  defaultOpen = false,
  paramConsomme,
}: {
  triggerLabel: string;
  /** Style du bouton d'ouverture : « primary » quand le dialogue EST le CTA
   * principal d'une page mono-fonction (une page = une fonction). */
  triggerVariant?: "primary" | "secondary" | "ghost";
  /** Préfixe décoratif du déclencheur (« + » par défaut ; null = aucun). */
  triggerPrefix?: string | null;
  title: string;
  action: (state: ActionState<S>, formData: FormData) => Promise<ActionState<S>>;
  submitLabel?: string;
  pendingLabel?: string;
  /** Message de confirmation à partir de l'état de succès. Optionnel : une
   * action qui REDIRIGE en cas de succès n'en produit jamais. */
  successMessage?: (state: { status: "success" } & S) => string;
  /** Libellé du second bouton « … et enchaîner » (saisie en série). Sans lui,
   * seul le bouton principal existe et tout succès ferme la modale. */
  chainLabel?: string;
  /** Render-prop des champs. `resetKey` s'incrémente à CHAQUE succès : les
   * champs à état React interne (PersonPicker : jetons, bloc invitation) le
   * passent en `key` pour repartir à zéro — `form.reset()` ne vide que le
   * DOM, pas leur état, et « … et enchaîner » re-soumettrait les mêmes
   * personnes à chaque tour. */
  children: (state: ActionState<S>, resetKey: number) => React.ReactNode;
  wrapperClassName?: string;
  /** Ouvre la modale dès le rendu (`?creer=1`) : le ➕ de la barre canonique
   * promet le formulaire, pas la liste (conception N1 §2.4). */
  defaultOpen?: boolean;
  /** Nom du paramètre d'URL one-shot qui a demandé l'ouverture : il est
   * RETIRÉ de l'adresse une fois consommé (patron ConfirmationBanner) —
   * sinon un rechargement rouvrirait une modale volontairement fermée, et
   * un second passage par le même lien (URL identique, aucune transition de
   * prop) resterait muet. */
  paramConsomme?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const alertRef = useRef<HTMLParagraphElement>(null);
  const titleId = useId();
  const router = useRouter();
  // Type explicite : l'inférence de useActionState bute sur `Awaited<… & S>`
  // avec un générique non résolu ; le contrat réel est bien (état, FormData).
  const [state, formAction, pending] = useActionState<ActionState<S>, FormData>(
    action as (state: Awaited<ActionState<S>>, payload: FormData) => Promise<ActionState<S>>,
    IDLE as Awaited<ActionState<S>>,
  );
  const statusRef = useRef<HTMLParagraphElement>(null);
  // Vrai si la DERNIÈRE soumission vient du bouton « … et enchaîner »
  // (posé au clic, AVANT le submit) : décide fermer vs enchaîner au succès.
  const chainRef = useRef(false);
  // Le déclencheur : à la fermeture, on y ramène le focus ET la vue. Sans ça,
  // après `router.refresh()` la page restait où le fond avait défilé (souvent
  // en bas de liste). On revient à l'endroit d'où l'action est partie.
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Incrémenté à chaque succès (cf. doc de `children`).
  const [resetKey, setResetKey] = useState(0);

  const focusFirstField = () => {
    formRef.current
      ?.querySelector<HTMLElement>("input:not([type='hidden']), select, textarea")
      ?.focus();
  };

  // Messages succès/erreur écrits IMPÉRATIVEMENT dans des régions vivantes
  // permanentes, en vider-puis-remplir : c'est ce qui garantit l'annonce par
  // les lecteurs d'écran, y compris quand deux ajouts d'affilée produisent le
  // même texte (un nœud inséré avec son texte, ou un texte inchangé, ne sont
  // pas annoncés de façon fiable).
  useEffect(() => {
    const status = statusRef.current;
    const alert = alertRef.current;
    if (!status || !alert) return;
    status.textContent = "";
    alert.textContent = "";
    if (state.status === "idle") return;

    const t = setTimeout(() => {
      if (state.status === "success" && chainRef.current) {
        status.textContent = successMessage?.(state) ?? "";
      } else if (state.status === "error") {
        alert.textContent = state.error;
        alert.focus(); // le bouton désactivé a perdu le focus : on le pose sur l'erreur
      }
    }, 30);

    if (state.status === "success") {
      formRef.current?.reset();
      setResetKey((k) => k + 1);
      router.refresh();
      if (chainRef.current) {
        focusFirstField(); // « … et enchaîner » : prête pour la suivante
      } else {
        // Comportement annoncé par le bouton principal : la modale se ferme,
        // le résultat est visible sur la page. On RAMÈNE explicitement le focus
        // ET la vue sur le déclencheur (le natif `close()` ne fait pas toujours
        // remonter la page — on se retrouvait sinon en bas de liste).
        dialogRef.current?.close();
        triggerRef.current?.focus();
        triggerRef.current?.scrollIntoView({ block: "center" });
      }
    }
    return () => clearTimeout(t);
    // successMessage est une prop stable : state suffit comme déclencheur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, router]);

  const open = () => {
    // Une réouverture ne doit pas ré-afficher un statut périmé.
    if (statusRef.current) statusRef.current.textContent = "";
    if (alertRef.current) alertRef.current.textContent = "";
    dialogRef.current?.showModal();
    focusFirstField(); // sinon le focus initial tombe sur le bouton ×
  };
  const close = () => {
    dialogRef.current?.close();
  };

  // Ouverture à l'arrivée (`?creer=1`) : sur la TRANSITION de la prop, pas
  // seulement au montage — déjà sur la page ateliers, taper ➕ → « Ajouter un
  // atelier » ne remonte pas le composant (navigation searchParams seule),
  // seul defaultOpen passe à true. Le paramètre est ensuite RETIRÉ de
  // l'adresse : consommé, il peut resservir (findings de revue N1).
  useEffect(() => {
    if (!defaultOpen) return;
    open();
    if (paramConsomme) {
      const url = new URL(window.location.href);
      url.searchParams.delete(paramConsomme);
      window.history.replaceState(null, "", url);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultOpen]);

  return (
    <div className={wrapperClassName}>
      <Button ref={triggerRef} type="button" variant={triggerVariant} size="sm" onClick={open}>
        {triggerPrefix && (
          <span aria-hidden="true" className="mr-1">
            {triggerPrefix}
          </span>
        )}
        {triggerLabel}
      </Button>

      {/* Positionnement EXPLICITE (fixed + inset), aucune dépendance aux
          styles UA du <dialog> (iOS le décalait hors écran) : bottom sheet
          pleine largeur sur mobile, carte centrée à partir de sm. En-tête et
          pied FIXES, seul le corps défile (max-h en dvh : clavier/URL bar). */}
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="fixed inset-x-0 bottom-0 top-auto m-0 w-full max-w-none rounded-t-2xl border border-navy-lighter bg-navy p-0 text-white backdrop:bg-black/60 sm:inset-0 sm:bottom-0 sm:m-auto sm:h-fit sm:w-[90vw] sm:max-w-md sm:rounded-2xl"
      >
        <form ref={formRef} action={formAction} className="flex max-h-[85dvh] flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-navy-lighter px-5 py-3">
            <h3 id={titleId} className="text-sm font-bold">
              {title}
            </h3>
            <button
              type="button"
              onClick={close}
              aria-label="Fermer"
              className="p-3 -m-2 text-gray-light hover:text-white text-lg leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-5 py-4">
            {children(state, resetKey)}

            {/* Régions vivantes permanentes, remplies impérativement par l'effet
                ci-dessus (vider-puis-remplir → annonce fiable au lecteur d'écran). */}
            <p ref={statusRef} role="status" aria-live="polite" className="text-sm text-cyan" />
            <p
              ref={alertRef}
              role="alert"
              tabIndex={-1}
              className="text-sm text-orange focus-visible:outline-none"
            />
          </div>

          {/* Pied de modale : sur mobile les actions s'EMPILENT pleine largeur
              (jamais 3 boutons qui se cassent sur 2 lignes) ; à partir de sm,
              elles reviennent en ligne. */}
          <div className="flex flex-col gap-2 border-t border-navy-lighter px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
            <Button
              type="submit"
              size="sm"
              disabled={pending}
              onClick={() => {
                chainRef.current = false;
              }}
              className="w-full sm:w-auto"
            >
              {pending ? pendingLabel : submitLabel}
            </Button>
            {chainLabel && (
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => {
                  chainRef.current = true;
                }}
                className="w-full sm:w-auto"
              >
                {chainLabel}
              </Button>
            )}
            <button
              type="button"
              onClick={close}
              // min-h : la cible tactile ≥ 44 px du projet, comme les Button sm.
              className="w-full min-h-[44px] rounded py-2 text-sm text-gray-light hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan sm:ml-auto sm:w-auto sm:py-0"
            >
              Annuler
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
