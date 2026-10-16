"use client";

import { useActionState } from "react";
import {
  proposeConferenceAction,
  runHarvestAction,
  type SaveState,
  type HarvestState,
} from "./actions";
import ChampTexte from "@/components/ChampTexte";
import SubmitButton from "@/components/SubmitButton";

/**
 * Outils du repérage à la demande (espace membre) : lancer le repérage tout de
 * suite, et PROPOSER une conférence manquante. Une proposition n'entre pas dans
 * le répertoire : elle part en validation orga (anti-saisie erronée). Le repérage
 * ne trouve donc que des conférences déjà validées.
 *
 * Tous les gestes d'ici sont SECONDAIRES : le CTA principal de la page reste
 * « Ajouter un talk » (règle d'or : un seul par page).
 */
export default function ReperageTools() {
  const [propose, proposeAction] = useActionState<SaveState, FormData>(
    proposeConferenceAction,
    {},
  );
  const [harvest, harvestAction] = useActionState<HarvestState, FormData>(
    runHarvestAction,
    {},
  );

  return (
    <div className="mt-4 flex flex-col gap-4">
      <form action={harvestAction} className="flex flex-col gap-2">
        <SubmitButton
          variant="secondary"
          size="sm"
          className="self-start"
          pendingLabel="Repérage en cours…"
        >
          Lancer le repérage maintenant
        </SubmitButton>
        {/* Régions vivantes PERMANENTES (nœud inséré avec son texte = annonce
            non fiable) : statut pour le succès, alerte pour l'échec. */}
        <p role="status" className="text-sm text-cyan">
          {harvest.ok ? harvest.message : ""}
        </p>
        <p role="alert" className="text-sm text-orange">
          {harvest.ok === false ? harvest.message : ""}
        </p>
      </form>

      <details className="rounded-xl border border-navy-lighter bg-navy/40 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded">
          Ta conf n&apos;y est pas&nbsp;? Propose-la
        </summary>
        <form action={proposeAction} className="mt-4 flex flex-col gap-3">
          <p className="text-sm text-gray-light">
            Ta proposition part à l&apos;équipe Tech Speak&apos;Her&nbsp;: elle la valide
            avant que la conférence rejoigne le répertoire (et donc le repérage).
          </p>
          <p role="status" className="text-sm text-cyan">
            {propose.ok
              ? "Merci ! Proposition envoyée : l'équipe la validera bientôt. Une fois validée, relance le repérage pour retrouver tes talks."
              : ""}
          </p>
          <ChampTexte
            id="rep-nom"
            name="nomConference"
            label="Nom de la conférence"
            required
            error={propose.errors?.nomConference}
          />
          <div className="grid grid-cols-2 gap-3">
            <ChampTexte
              id="rep-annee"
              name="annee"
              label="Année"
              inputMode="numeric"
              error={propose.errors?.annee}
            />
            <ChampTexte id="rep-ville" name="ville" label="Ville" error={propose.errors?.ville} />
          </div>
          <ChampTexte
            id="rep-url"
            name="url"
            label="Site de la conférence"
            inputMode="url"
            placeholder="https://…"
            error={propose.errors?.url}
          />
          <ChampTexte
            id="rep-endpoint"
            name="endpoint"
            label="Id Sessionize (pour le repérage)"
            error={propose.errors?.endpoint}
            hint="Facultatif, mais c'est lui qui permet le repérage : dans la page programme de la conf (celle qui affiche l'agenda), l'id apparaît dans sessionize.com/api/v2/<ID>/view/… Colle uniquement l'ID, il est testé à l'envoi."
          />
          <SubmitButton
            variant="secondary"
            size="sm"
            className="self-start"
            pendingLabel="Envoi…"
          >
            Proposer cette conférence
          </SubmitButton>
        </form>
      </details>
    </div>
  );
}
