"use client";

import { useActionState } from "react";
import SubmitButton from "@/components/SubmitButton";
import { heureParis } from "@/lib/format";
import { relireHelloAssoAction } from "./actions";

/**
 * Relit HelloAsso à la demande. Aucun e-mail ne part : pas de confirmation à
 * demander, le geste se refait sans risque. Le bilan juste au-dessus se met à
 * jour ; la zone `status` annonce la relecture faite (lecteur d'écran compris).
 */
export default function RelireHelloAsso() {
  const [etat, action] = useActionState(relireHelloAssoAction, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <SubmitButton size="sm" variant="secondary" pendingLabel="Relecture en cours…">
        Relire HelloAsso maintenant
      </SubmitButton>
      <p role="status" className="text-sm text-gray-light">
        {etat ? `Relecture faite à ${heureParis(etat.le)}.` : ""}
      </p>
    </form>
  );
}
