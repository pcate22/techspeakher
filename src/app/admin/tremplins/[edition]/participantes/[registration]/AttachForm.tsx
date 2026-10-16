"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PersonPicker from "@/components/PersonPicker";
import Button from "@/components/Button";
import { IDLE } from "@/lib/action-state";
import { inputCls } from "../../styles";
import { attachRegistrationAction, type AttachState } from "../../../actions";

/**
 * Rattachement d'une inscription à un compte. Deux chemins dans UN champ :
 * on TAPE un nom → la recherche propose les comptes speakeuses existants (y
 * compris les brouillons), on relie en un clic ; si la personne n'est pas dans
 * la liste, « inviter par e-mail » révèle l'e-mail (compte pré-créé, relié à sa
 * première connexion). L'identité et l'autorisation restent côté serveur.
 */
export default function AttachForm({
  editionId,
  registrationId,
  comptes,
}: {
  editionId: number;
  registrationId: number;
  /** Comptes speakeuses proposés à la recherche (nom en libellé, e-mail en secours). */
  comptes: { id: number; label: string; sousTitre?: string }[];
}) {
  const [state, formAction, pending] = useActionState<AttachState, FormData>(
    attachRegistrationAction,
    IDLE as AttachState,
  );
  const router = useRouter();
  const alertRef = useRef<HTMLParagraphElement>(null);
  // Le bloc « inviter par e-mail » est-il ouvert ? (adapte le bouton et affiche
  // la conséquence : un e-mail part alors à un tiers.)
  const [inviteMode, setInviteMode] = useState(false);

  // Succès RATTACHÉ mais e-mail d'invitation non parti : le rattachement est
  // fait, on prévient l'orga de la contacter directement plutôt que de laisser
  // croire qu'elle a été invitée (le compte ne se relie qu'à sa 1re connexion).
  const inviteRatee =
    state.status === "success" && !state.parCompte && !state.invited;

  // Succès : l'inscription est rattachée → on rafraîchit, la section repasse en
  // « ✓ Rattachée » (ce formulaire disparaît). Sauf invitation ratée : on garde
  // le formulaire et l'avertissement visibles, focus dessus.
  useEffect(() => {
    if (state.status === "success") {
      if (inviteRatee) alertRef.current?.focus();
      else router.refresh();
    } else if (state.status === "error") {
      alertRef.current?.focus();
    }
  }, [state, router, inviteRatee]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="editionId" value={editionId} />
      <input type="hidden" name="registrationId" value={registrationId} />
      <label id="attach-compte-label" className="text-sm font-medium">
        Son compte speakeuse
      </label>
      <PersonPicker
        name="compteId"
        candidats={comptes}
        ariaLabel="Son compte speakeuse"
        placeholder="Tape son nom…"
        emptyLabel="Aucun compte à ce nom."
        createLabel={() => "Pas dans la liste ? L'inviter par e-mail"}
        onCreationChange={setInviteMode}
      >
        {(nomTape) => (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-gray-light">
              Un e-mail d&apos;invitation lui sera envoyé pour rejoindre son
              espace ; son inscription s&apos;y reliera à sa première connexion.
            </p>
            <label className="text-sm flex flex-col gap-1">
              Son adresse e-mail
              <input
                type="email"
                name="email"
                required
                placeholder="prenom.nom@exemple.fr"
                className={inputCls}
              />
            </label>
            <label className="text-sm flex flex-col gap-1">
              Prénom et nom (facultatif)
              <input
                type="text"
                name="nom"
                defaultValue={nomTape}
                placeholder="Ex. Ada Lovelace"
                className={inputCls}
              />
            </label>
          </div>
        )}
      </PersonPicker>
      <div>
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          {inviteMode
            ? pending
              ? "Invitation…"
              : "Inviter"
            : pending
              ? "Rattachement…"
              : "Relier"}
        </Button>
      </div>
      <p
        ref={alertRef}
        role="alert"
        tabIndex={-1}
        className="text-sm text-orange focus-visible:outline-none empty:hidden"
      >
        {state.status === "error"
          ? state.error
          : inviteRatee
            ? "Rattachée, mais l'e-mail d'invitation n'est pas parti : préviens-la directement."
            : ""}
      </p>
    </form>
  );
}
