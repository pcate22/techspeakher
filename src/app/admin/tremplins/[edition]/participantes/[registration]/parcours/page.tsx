import type { Metadata } from "next";
import Link from "next/link";
import { requireOrgaId } from "@/lib/auth-guards";
import SettingToggle from "@/components/SettingToggle";
import ToggleWithDependent from "@/components/ToggleWithDependent";
import { registrationLabel } from "@/lib/tremplin-registrations";
import {
  getPhaseMembersByEdition,
  getPhasesPubliquesForRegistration,
  type MembershipPhase,
} from "@/lib/tremplin-registration-phases";
import { loadRegistrationOrNotFound } from "@/lib/tremplin-admin";
import ParticipanteEntete from "../ParticipanteEntete";
import {
  setRegistrationFinaleAction,
  setRegistrationPhaseMembershipAction,
  setRegistrationPhasePublicAction,
} from "../../../../actions";

export const metadata: Metadata = {
  title: "Parcours | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/** Sous-page mono-fonction (lot C3c) : les trois phases du parcours. */
export default async function ParcoursParticipante({
  params,
}: {
  params: Promise<{ edition: string; registration: string }>;
}) {
  await requireOrgaId();
  const { edition: editionParam, registration: registrationParam } = await params;
  const { editionId, registration: r } = await loadRegistrationOrNotFound(
    editionParam,
    registrationParam,
  );
  const nom = registrationLabel(r);

  const phaseMembers = await getPhaseMembersByEdition(editionId).catch((e) => {
    console.error("Appartenances de phase indisponibles (migration 025 ?)", e);
    return new Map<number, Set<MembershipPhase>>();
  });
  const mesPhases = phaseMembers.get(r.id);
  const enPhase1 = mesPhases?.has("cfp_et_pitch") ?? false;
  const enPhase3 = mesPhases?.has("montee_sur_scene") ?? false;
  // L'accord d'être NOMMÉE sur la page publique de la phase 3 — distinct de
  // celui de la galerie des finalistes (§visibilité), qui portait sur la soirée.
  const phasesPubliques = await getPhasesPubliquesForRegistration(r.id).catch((e) => {
    console.error("Consentements de phase indisponibles (migration 055 ?)", e);
    return new Set<MembershipPhase>();
  });
  const nommeeEnPhase3 = phasesPubliques.has("montee_sur_scene");

  return (
    <div className="py-10 px-4">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        <ParticipanteEntete fonction="Parcours (les trois phases)" nom={nom}>
          La finale (phase 2) dépend de la phase 1 : on ne peut pas
            être finaliste sans avoir préparé son CFP. Les présences aux
            ateliers se pointent sur la fiche de chaque atelier.
        </ParticipanteEntete>

        <div className="divide-y divide-navy-lighter">
          {/* Phase 1 → sa case fille « Finaliste » (phase 2) suit l'interrupteur
              tout de suite (affichage optimiste), sans attendre le serveur. */}
          <ToggleWithDependent
            toggle={{
              action: setRegistrationPhaseMembershipAction,
              hidden: { editionId, registrationId: r.id, phase: "cfp_et_pitch" },
              checked: enPhase1,
              label: "Phase 1 · Préparation au CFP",
              description: "Participe à la préparation au CFP (avant la soirée).",
              successMessage: "Appartenance à la phase 1 mise à jour.",
            }}
            dependent={
              <SettingToggle
                action={setRegistrationFinaleAction}
                hidden={{ editionId, registrationId: r.id }}
                checked={r.finalePresente ?? false}
                control="checkbox"
                label="Finaliste (phase 2 · Finale)"
                description="Retenue pour pitcher à la soirée finale : comptée dans les compteurs publics et la galerie des finalistes."
                successMessage="Statut finaliste mis à jour."
              />
            }
          />

          {/* Phase 3 → sa case fille porte l'ACCORD d'être nommée sur la page
              publique de cette phase. Deux gestes, dans cet ordre : on rattache,
              puis on demande — et l'action refuse l'accord d'une phase à
              laquelle personne n'est rattachée plutôt que de créer le
              rattachement en douce. */}
          <ToggleWithDependent
            toggle={{
              action: setRegistrationPhaseMembershipAction,
              hidden: { editionId, registrationId: r.id, phase: "montee_sur_scene" },
              checked: enPhase3,
              label: "Phase 3 · Préparation à la conférence",
              description:
                "Participe à la préparation à la conférence (montée sur scène, après la soirée).",
              successMessage: "Appartenance à la phase 3 mise à jour.",
            }}
            dependent={
              <SettingToggle
                action={setRegistrationPhasePublicAction}
                hidden={{ editionId, registrationId: r.id, phase: "montee_sur_scene" }}
                checked={nommeeEnPhase3}
                control="checkbox"
                label="Nommée sur la page « montée sur scène »"
                description="Accord recueilli auprès d'elle, horodaté : son nom et sa fiche s'affichent sur la page publique de cette phase. Sans lui, elle reste comptée dans l'effectif, jamais nommée."
                successMessage="Accord mis à jour."
              />
            }
          />
        </div>

        <p>
          <Link
            href={`/admin/tremplins/${editionId}/participantes/${r.id}`}
            className="inline-block py-2 -my-2 text-sm text-cyan hover:text-cyan-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded"
          >
            ← Retour à la fiche
          </Link>
        </p>
      </div>
    </div>
  );
}
