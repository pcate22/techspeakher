"use client";

import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { deleteProfileAction } from "./actions";

/**
 * Suppression du compte (zone danger) via la confirmation partagée (Radix
 * AlertDialog : focus piégé, Échap, rôles ARIA). Action irréversible : on ne se
 * contente pas d'un clic, on demande de RÉÉCRIRE son nom (si on le connaît) ou
 * son e-mail (qu'on a dans tous les cas) — un garde-fou contre la suppression
 * accidentelle. Le `<form>` porte l'action ; le bouton de confirmation vit
 * dedans (cf. ConfirmSubmitButton : pas de Portal, pas d'AlertDialog.Action).
 */
export default function DeleteAccountButton({
  name,
  email,
}: {
  name: string | null;
  email: string | null;
}) {
  // Valeurs acceptées : le nom (s'il est connu) et l'e-mail. L'e-mail est
  // toujours présent (OAuth ou lien magique), donc la confirmation reste
  // toujours possible même sans nom déclaré.
  const nom = name?.trim() || null;
  const mail = email?.trim() || null;
  const accepted = [nom, mail].filter((v): v is string => v !== null);

  const label = nom
    ? "Pour confirmer, réécris ton nom ou ton adresse e-mail"
    : "Pour confirmer, réécris ton adresse e-mail";
  const hint = nom
    ? `Ton nom (« ${nom} ») ou ton e-mail (${mail ?? ""}).`
    : mail
      ? `Ton e-mail : ${mail}.`
      : undefined;

  return (
    <form action={deleteProfileAction}>
      <ConfirmSubmitButton
        title="Supprimer ton compte ?"
        message="Action irréversible : ta fiche, tes talks et ton compte seront définitivement supprimés. Tu seras déconnectée."
        confirmLabel="Supprimer définitivement"
        pendingLabel="Suppression…"
        variant="danger"
        confirmText={accepted}
        confirmTextLabel={label}
        confirmTextHint={hint}
      >
        Supprimer mon compte
      </ConfirmSubmitButton>
    </form>
  );
}
