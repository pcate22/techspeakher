"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Button from "@/components/Button";
import { PARAM_DATE_TALK } from "@/lib/gestes-creation";
import OccurrenceForm from "./OccurrenceForm";
import { addOccurrenceRapideAction, type SaisieOccurrenceState } from "./actions";
import type { OccurrenceSuggestions } from "@/lib/talks";

/**
 * « Une date » sur un talk de la fiche : ajouter une conférence à un talk
 * SANS l'ouvrir (refonte de la navigation connectée, 2026-10-15). C'est la
 * mise à jour la plus fréquente d'une speakeuse — « mon talk est retenu à une
 * nouvelle conf » — et elle coûtait la page du talk puis un formulaire de dix
 * champs.
 *
 * UN bouton par talk ouvre une fenêtre (principes UI, règle d'or : pas de
 * formulaire en ligne dans une liste) ; elle porte la variante rapide de
 * `OccurrenceForm`, même noyau serveur que l'ajout complet. Enregistrée, elle
 * se ferme et la confirmation NOMME le talk à côté du bouton (principes UI
 * §4-5), sans perdre la place dans la page. La liste se met à jour par le
 * `revalidatePath` de l'action, sans `router.refresh()` (qui rejouait tout le
 * rendu). Une condition, MESURÉE en E2E le 2026-10-15 : fermer APRÈS la
 * transition de l'action (relais par effet dans `OccurrenceForm`). Fermée
 * pendant, depuis une enveloppe autour de l'action, la fenêtre démontait le
 * formulaire en vol et la fiche gardait l'ancienne liste jusqu'au rechargement.
 *
 * Arrivée par « Ajouter une date à un talk » de la feuille ➕
 * (`/mon-espace/fiche?date=<id>`) : la fenêtre de CE talk s'ouvre d'elle-même,
 * puis le paramètre quitte l'adresse. Lu ici, côté client, et sur sa
 * TRANSITION, pas au montage : déjà sur la fiche, ➕ → « Ajouter une date à un
 * talk » ne change que l'URL et ne remonte pas le composant (relevé par la
 * passe simplification du 2026-10-15). Consommé, le paramètre peut resservir
 * (même lien recliqué), et un rechargement ne rouvre pas une fenêtre fermée.
 * Un id qui n'est celui d'aucun talk de la fiche n'ouvre rien.
 *
 * <dialog> natif, même patron que la feuille ➕ (focus piégé, Échap, contenu
 * monté seulement ouvert : la saisie repart de zéro à chaque ouverture).
 */
export default function AjoutDateRapide({
  talk,
  suggestions,
  action = addOccurrenceRapideAction,
}: {
  talk: { id: number; titre: string };
  suggestions: OccurrenceSuggestions;
  action?: (etat: SaisieOccurrenceState, formData: FormData) => Promise<SaisieOccurrenceState>;
}) {
  const demandee = useSearchParams().get(PARAM_DATE_TALK) === String(talk.id);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [montee, setMontee] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  // Guillemets à insécables : « seul en fin de ligne, jamais.
  const nom = `«\u00a0${talk.titre}\u00a0»`;
  const boutonRef = useRef<HTMLButtonElement>(null);
  const titreId = `date-rapide-${talk.id}`;

  const ouvrir = () => {
    setConfirmation(null);
    setMontee(true);
  };
  // Le focus revient TOUJOURS au bouton « Une date » de CE talk. Le <dialog>
  // natif le rend à ce qui l'avait avant l'ouverture : par ➕ → « Ajouter une
  // date à un talk », c'est le « Créer » de la navigation (ou <body>), loin du
  // talk et de sa confirmation (revues RGAA et justesse du 2026-10-15). La
  // fenêtre est modale : rien d'autre ne peut légitimement garder le focus.
  const rendreLeFocus = () => boutonRef.current?.focus();
  const fermer = () => {
    dialogRef.current?.close();
    // jsdom : close() polyfillé ne déclenche pas l'événement `close`.
    setMontee(false);
    rendreLeFocus();
  };

  // La fenêtre s'ouvre quand `montee` passe à vrai : l'état décide, le DOM
  // suit (le contenu est monté avant `showModal`, le focus y tombe).
  useEffect(() => {
    if (montee && !dialogRef.current?.open) dialogRef.current?.showModal();
  }, [montee]);

  // `?date=<ce talk>` qui ARRIVE ouvre la fenêtre — ajusté au rendu, sur la
  // transition (patron React « ajuster l'état quand une valeur change ») ;
  // puis le paramètre quitte l'adresse, sans état touché dans l'effet.
  const [demandeVue, setDemandeVue] = useState(false);
  if (demandee !== demandeVue) {
    setDemandeVue(demandee);
    if (demandee) ouvrir();
  }
  useEffect(() => {
    if (!demandee) return;
    const url = new URL(window.location.href);
    url.searchParams.delete(PARAM_DATE_TALK);
    window.history.replaceState(null, "", url);
  }, [demandee]);

  const enregistre = (etat: SaisieOccurrenceState) => {
    fermer();
    setConfirmation(
      etat.issue === "conf_proposee"
        ? `Date enregistrée pour ${nom}. La conférence attend la validation de l'équipe, puis rejoint ta fiche publique.`
        : `Date ajoutée à ${nom}.`,
    );
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        ref={boutonRef}
        type="button"
        variant="secondary"
        size="sm"
        onClick={ouvrir}
        aria-haspopup="dialog"
        // Libellé visible EN TÊTE du nom (WCAG 2.5.3) ; le titre distingue
        // les « Une date » de chaque talk (principes UI §6).
        aria-label={`Une date pour ${nom}`}
      >
        <span aria-hidden="true" className="mr-1">
          +
        </span>
        Une date
      </Button>
      <p role="status" className="text-sm text-cyan">
        {confirmation}
      </p>

      <dialog
        ref={dialogRef}
        aria-labelledby={titreId}
        onClose={() => {
          setMontee(false);
          rendreLeFocus();
        }}
        onClick={(e) => {
          if (e.target === dialogRef.current) fermer();
        }}
        className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[90dvh] w-full max-w-none overflow-y-auto rounded-t-2xl border border-navy-lighter bg-navy p-0 text-white backdrop:bg-black/60 sm:inset-0 sm:m-auto sm:h-fit sm:w-[90vw] sm:max-w-lg sm:rounded-2xl"
      >
        {montee && (
          <div className="flex flex-col gap-4 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="flex items-start justify-between gap-3">
              <h2 id={titreId} className="text-base font-bold">
                Une date pour {nom}
              </h2>
              <button
                type="button"
                onClick={fermer}
                aria-label="Fermer"
                className="-m-2 flex min-h-11 min-w-11 items-center justify-center rounded text-lg leading-none text-gray-light hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <OccurrenceForm
              talkId={talk.id}
              suggestions={suggestions}
              rapide
              addAction={action}
              onEnregistre={enregistre}
            />
          </div>
        )}
      </dialog>
    </div>
  );
}
