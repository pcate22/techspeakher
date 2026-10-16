"use client";

import { useActionState } from "react";
import { sendMessageAction, type ContactState } from "./actions";
import Button from "@/components/Button";
import { CONTACT_MOTIFS } from "@/data/contact-motifs";

const inputClass =
  "w-full bg-navy border border-navy-lighter rounded-lg px-3 py-2 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan";
const labelClass = "block text-sm text-gray-light mb-1";

export default function ContactSpeakeuseForm({
  profileId,
  nom,
}: {
  profileId: number;
  nom: string;
}) {
  const [state, action, pending] = useActionState<ContactState, FormData>(
    sendMessageAction,
    {},
  );

  if (state.ok) {
    return (
      <p
        role="status"
        className="text-sm text-cyan bg-cyan/10 border border-cyan/30 rounded-lg p-4"
      >
        Votre message a bien été reçu. Il sera transmis à {nom} après une
        vérification par l&apos;équipe Tech Speak&apos;Her, s&apos;il respecte
        notre règlement intérieur.
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="profileId" value={profileId} />

      <div>
        <label htmlFor="motif" className={labelClass}>
          Motif du contact *
        </label>
        <select
          id="motif"
          name="motif"
          required
          defaultValue=""
          aria-invalid={state.errors?.motif ? true : undefined}
          aria-describedby={state.errors?.motif ? "err-motif" : undefined}
          className={inputClass}
        >
          <option value="" disabled>
            Choisissez un motif…
          </option>
          {CONTACT_MOTIFS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        {state.errors?.motif && (
          <p id="err-motif" role="alert" className="text-xs text-orange mt-1">{state.errors.motif}</p>
        )}
      </div>

      <div>
        <label htmlFor="nom" className={labelClass}>
          Votre nom *
        </label>
        <input id="nom" name="nom" required aria-invalid={state.errors?.nom ? true : undefined} aria-describedby={state.errors?.nom ? "err-nom" : undefined} className={inputClass} />
        {state.errors?.nom && (
          <p id="err-nom" role="alert" className="text-xs text-orange mt-1">{state.errors.nom}</p>
        )}
      </div>

      <div>
        <label htmlFor="email" className={labelClass}>
          Votre e-mail * <span className="text-gray-light">(pour qu&apos;elle vous réponde)</span>
        </label>
        <input id="email" name="email" type="email" required aria-invalid={state.errors?.email ? true : undefined} aria-describedby={state.errors?.email ? "err-email" : undefined} className={inputClass} />
        {state.errors?.email && (
          <p id="err-email" role="alert" className="text-xs text-orange mt-1">{state.errors.email}</p>
        )}
      </div>

      <div>
        <label htmlFor="message" className={labelClass}>
          Message *
        </label>
        <textarea id="message" name="message" rows={5} required aria-invalid={state.errors?.message ? true : undefined} aria-describedby={state.errors?.message ? "err-message" : undefined} className={inputClass} />
        {state.errors?.message && (
          <p id="err-message" role="alert" className="text-xs text-orange mt-1">{state.errors.message}</p>
        )}
      </div>

      <Button type="submit" size="sm" disabled={pending} className="self-start">
        {pending ? "Envoi…" : "Envoyer le message"}
      </Button>
    </form>
  );
}
