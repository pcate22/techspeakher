"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { useFormStatus } from "react-dom";
import Button from "@/components/Button";
import { withdrawProfileAction } from "./actions";

/** Bouton de confirmation : le `pending` vient du form parent. */
function ConfirmAction({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="sm" disabled={pending}>
      {pending ? "Un instant…" : label}
    </Button>
  );
}

/**
 * « Retirer ma fiche de l'annuaire » — action RÉVERSIBLE (retour en brouillon),
 * rangée avec les autres actions de la fiche, sous « Mes talks » / « Mes
 * messages ». Présentée comme une LIGNE (même langage que le hub) mais SANS
 * chevron : ce n'est pas une navigation, c'est un geste, donc il passe par une
 * confirmation (modale Radix). On garde le pattern maison (cf.
 * ConfirmSubmitButton) : pas de Portal ni d'AlertDialog.Action, le bouton de
 * confirmation est un submit DANS le `<form>` parent.
 */
export default function RetirerFicheRow({ enAttente }: { enAttente: boolean }) {
  const label = enAttente
    ? "Retirer ma soumission"
    : "Retirer ma fiche de l'annuaire";

  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-xl border border-navy-lighter bg-navy px-4 py-3 text-left hover:border-cyan/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan transition-colors"
        >
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{label}</span>
            <span className="block text-xs text-gray-light">
              Elle repasse en brouillon, à re-soumettre quand tu veux.
            </span>
          </span>
        </button>
      </AlertDialog.Trigger>
      <AlertDialog.Overlay className="fixed inset-0 bg-black/60 z-50" />
      <AlertDialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-md bg-navy-light border border-navy-lighter rounded-xl p-6 z-50 shadow-sticky">
        <AlertDialog.Title className="text-lg font-bold text-white">
          Retirer ta fiche de l&apos;annuaire&nbsp;?
        </AlertDialog.Title>
        <AlertDialog.Description className="text-sm text-gray-light mt-2">
          Elle repasse en brouillon et sort de l&apos;annuaire. Tu gardes toutes
          tes infos et tu peux la re-soumettre quand tu veux.
        </AlertDialog.Description>
        <form action={withdrawProfileAction} className="flex flex-wrap justify-end gap-3 mt-6">
          <AlertDialog.Cancel asChild>
            <Button type="button" variant="secondary" size="sm">
              Annuler
            </Button>
          </AlertDialog.Cancel>
          <ConfirmAction label={label} />
        </form>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}
