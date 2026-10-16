"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { useFormStatus } from "react-dom";
import Button from "@/components/Button";
import { nb } from "@/lib/format";
import { relancerLotAction } from "./actions";

/**
 * Bouton de confirmation : un simple submit DANS le `<form>`, sans
 * `AlertDialog.Action`. Enveloppé dans `AlertDialog.Action`, le clic fermerait
 * la popup (donc démonterait le portail, donc le formulaire) dans le même
 * évènement, et React annulerait la soumission avant qu'elle ne parte : la
 * popup se ferme et rien n'est envoyé. Même piège, même parade que
 * `InviteButton` (l'erreur a déjà été payée une fois).
 */
function ConfirmSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Envoi en cours…" : "Envoyer maintenant"}
    </Button>
  );
}

/**
 * LE CTA de la page : relancer d'un coup toutes les fiches en sommeil, avec
 * confirmation chiffrée (action irréversible, tournée vers l'extérieur : de
 * vrais e-mails partent).
 */
export default function RelancerLot({ count }: { count: number }) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>
        <Button type="button" size="sm">
          Relancer {nb(count, "speakeuse")}
        </Button>
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/60 z-50" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-md bg-navy-light border border-navy-lighter rounded-xl p-6 z-50 shadow-sticky">
          <AlertDialog.Title className="text-lg font-bold text-white">
            Envoyer les relances&nbsp;?
          </AlertDialog.Title>
          <AlertDialog.Description className="text-sm text-gray-light mt-2">
            Un e-mail va partir à <strong>{count}</strong> speakeuse
            {count > 1 ? "s" : ""}, avec la liste de ce qu&apos;il lui reste à
            faire. Chacune sort ensuite de cette liste pour toute la durée du
            délai réglé.
          </AlertDialog.Description>
          <div className="flex flex-wrap justify-end gap-3 mt-6">
            <AlertDialog.Cancel asChild>
              <Button type="button" variant="secondary" size="sm">
                Annuler
              </Button>
            </AlertDialog.Cancel>
            {/* Pas d'AlertDialog.Action ici : il fermerait la popup (et
                démonterait le <form>) avant que l'action serveur ne parte. */}
            <form action={relancerLotAction}>
              <ConfirmSubmit />
            </form>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
