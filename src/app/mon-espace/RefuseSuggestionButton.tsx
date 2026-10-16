"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import Button from "@/components/Button";
import SubmitButton from "@/components/SubmitButton";
import { refuseSuggestionAction } from "./actions";

/**
 * Écarte une suggestion de talk, avec confirmation accessible (Radix
 * AlertDialog) : le refus est définitif (jamais re-proposée), un clic raté
 * ne doit pas suffire.
 */
export default function RefuseSuggestionButton({
  suggestionId,
  titre,
}: {
  suggestionId: number;
  titre: string;
}) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>
        <Button type="button" variant="ghost" size="sm" className="px-0">
          Écarter
          <span className="sr-only"> la suggestion « {titre} »</span>
        </Button>
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/60 z-50" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-md bg-navy-light border border-navy-lighter rounded-xl p-6 z-50 shadow-sticky">
          <AlertDialog.Title className="text-lg font-bold text-white">
            Écarter cette suggestion ?
          </AlertDialog.Title>
          <AlertDialog.Description className="text-sm text-gray-light mt-2">
            « {titre} » ne te sera <strong>plus jamais proposé</strong>, que ce
            talk ne soit pas de toi ou que tu ne veuilles pas l&apos;afficher.
            Tu pourras toujours l&apos;ajouter à la main plus tard.
          </AlertDialog.Description>
          <div className="flex flex-wrap justify-end gap-3 mt-6">
            <AlertDialog.Cancel asChild>
              <Button type="button" variant="secondary" size="sm">
                Annuler
              </Button>
            </AlertDialog.Cancel>
            {/* Pas d'AlertDialog.Action : fermer démonterait le <form> et
                annulerait la soumission (cf. InviteButton). La revalidation
                retire la suggestion, ce qui referme la modale. */}
            <form action={refuseSuggestionAction}>
              <input type="hidden" name="suggestionId" value={suggestionId} />
              <SubmitButton variant="danger" size="sm" pendingLabel="…">
                Écarter définitivement
              </SubmitButton>
            </form>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
