"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { useFormStatus } from "react-dom";
import Button from "@/components/Button";
import { nb } from "@/lib/format";
import { inviterAAdhererAction } from "./actions";

/** Submit DANS le `<form>`, sans `AlertDialog.Action` (même piège que
 *  `RelancerLot` : l'Action fermerait la popup et annulerait l'envoi). */
function ConfirmSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Envoi en cours…" : "Envoyer maintenant"}
    </Button>
  );
}

/**
 * LE CTA de la page : inviter à adhérer, avec confirmation chiffrée (de vrais
 * e-mails partent, une seule fois par personne).
 */
export default function InviterLot({ count, lot }: { count: number; lot: number }) {
  const envoi = Math.min(count, lot);
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>
        <Button type="button" size="sm">
          Inviter {nb(envoi, "speakeuse")}
        </Button>
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/60 z-50" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-md bg-navy-light border border-navy-lighter rounded-xl p-6 z-50 shadow-sticky">
          <AlertDialog.Title className="text-lg font-bold text-white">
            Envoyer l&apos;invitation à adhérer&nbsp;?
          </AlertDialog.Title>
          <AlertDialog.Description className="text-sm text-gray-light mt-2">
            Les adhésions sont d&apos;abord relues sur HelloAsso, pour écrire seulement
            aux speakeuses encore sans adhésion. Puis un e-mail part à{" "}
            <strong>{nb(envoi, "speakeuse")}</strong> au plus, une seule fois chacune.
            {count > lot ? ` Les ${count - lot} autres partiront au clic suivant.` : ""}
          </AlertDialog.Description>
          <div className="flex flex-wrap justify-end gap-3 mt-6">
            <AlertDialog.Cancel asChild>
              <Button type="button" variant="secondary" size="sm">
                Annuler
              </Button>
            </AlertDialog.Cancel>
            <form action={inviterAAdhererAction}>
              <ConfirmSubmit />
            </form>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
