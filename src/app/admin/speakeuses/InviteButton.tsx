"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { useFormStatus } from "react-dom";
import Button from "@/components/Button";
import { sendInvitationsAction } from "../actions";

/**
 * Bouton de confirmation de l'envoi. IMPORTANT : c'est un simple submit DANS le
 * <form>, sans `AlertDialog.Action`. Si on l'enveloppait dans `AlertDialog.Action`,
 * le clic fermerait la popup (donc démonterait le portail, donc le <form>) dans
 * le même évènement, et React annulerait la soumission de l'action serveur avant
 * qu'elle ne parte : la popup se ferme et rien n'est envoyé. Ici le formulaire
 * soumet, puis la redirection serveur referme la popup en changeant de page.
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
 * Envoi des invitations de migration avec confirmation (action irréversible,
 * outward-facing : on envoie de vrais e-mails). Idempotent côté serveur.
 */
export default function InviteButton({ count }: { count: number }) {
  if (count === 0) {
    return (
      <p className="text-sm text-gray-light">
        Toutes les fiches publiées ont été invitées&nbsp;✓
      </p>
    );
  }
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>
        <Button type="button" size="sm">
          Inviter {count} speakeuse{count > 1 ? "s" : ""}
        </Button>
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/60 z-50" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-md bg-navy-light border border-navy-lighter rounded-xl p-6 z-50 shadow-sticky">
          <AlertDialog.Title className="text-lg font-bold text-white">
            Envoyer les invitations&nbsp;?
          </AlertDialog.Title>
          <AlertDialog.Description className="text-sm text-gray-light mt-2">
            Un e-mail va partir à <strong>{count}</strong> speakeuse
            {count > 1 ? "s" : ""} (les fiches publiées jamais invitées). Chacune
            ne reçoit l&apos;invitation qu&apos;une fois.
          </AlertDialog.Description>
          <div className="flex flex-wrap justify-end gap-3 mt-6">
            <AlertDialog.Cancel asChild>
              <Button type="button" variant="secondary" size="sm">
                Annuler
              </Button>
            </AlertDialog.Cancel>
            {/* Pas d'AlertDialog.Action ici : il fermerait la popup (et démonterait
                le <form>) avant que l'action serveur ne parte. */}
            <form action={sendInvitationsAction}>
              <ConfirmSubmit />
            </form>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
