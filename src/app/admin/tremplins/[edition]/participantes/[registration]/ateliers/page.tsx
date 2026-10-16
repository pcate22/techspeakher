import type { Metadata } from "next";
import Link from "next/link";
import { requireOrgaId } from "@/lib/auth-guards";
import SettingToggle from "@/components/SettingToggle";
import ToggleWithDependent from "@/components/ToggleWithDependent";
import { registrationLabel } from "@/lib/tremplin-registrations";
import {
  getAteliersByEdition,
  getAtelierMembersByEdition,
  PHASE_ATELIER_LABEL,
  type PhaseAtelier,
  type MembreAtelier,
} from "@/lib/tremplin-ateliers";
import { loadRegistrationOrNotFound } from "@/lib/tremplin-admin";
import ParticipanteEntete from "../ParticipanteEntete";
import { setAtelierMembreAction, setAtelierPresenceAction } from "../../../../actions";

export const metadata: Metadata = {
  title: "Ateliers | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

// Ordre chronologique des phases d'atelier (avant puis après la soirée).
const PHASES: PhaseAtelier[] = ["cfp_et_pitch", "montee_sur_scene"];

/**
 * Sous-page mono-fonction : les ateliers de l'édition, vus DEPUIS la fiche de la
 * participante. On coche ceux auxquels elle participe (et on pointe sa présence)
 * sans changer de contexte. Aucune nouvelle action serveur : `setAtelierMembre`
 * / `setAtelierPresence` sont symétriques (atelier ↔ participante), on fixe la
 * participante et on fait varier l'atelier.
 */
export default async function AteliersParticipante({
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

  const [ateliers, membresParAtelier] = await Promise.all([
    getAteliersByEdition(editionId),
    getAtelierMembersByEdition(editionId).catch((e) => {
      console.error("Membres d'atelier indisponibles (migration 015 ?)", e);
      return new Map<number, MembreAtelier[]>();
    }),
  ]);

  const maPresence = (atelierId: number): MembreAtelier | undefined =>
    (membresParAtelier.get(atelierId) ?? []).find((m) => m.registrationId === r.id);

  return (
    <div className="py-10 px-4">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        <ParticipanteEntete fonction="Ateliers" nom={nom}>
          Coche les ateliers auxquels elle participe. Sa présence se pointe ici,
          ou sur la fiche de chaque atelier : c&apos;est la même donnée.
        </ParticipanteEntete>

        {ateliers.length === 0 ? (
          <p className="text-sm text-gray-light">Aucun atelier sur cette édition.</p>
        ) : (
          PHASES.map((phase) => {
            const duGroupe = ateliers.filter((a) => a.phase === phase);
            if (duGroupe.length === 0) return null;
            const titreId = `ateliers-${phase}`;
            return (
              <section key={phase} aria-labelledby={titreId}>
                <h2
                  id={titreId}
                  className="text-xs font-bold uppercase tracking-wide text-gray-light mb-1"
                >
                  {PHASE_ATELIER_LABEL[phase]}
                </h2>
                <div className="divide-y divide-navy-lighter">
                  {duGroupe.map((a) => {
                    const mine = maPresence(a.id);
                    const membreToggle = {
                      action: setAtelierMembreAction,
                      hidden: { editionId, atelierId: a.id, registrationId: r.id },
                      checked: mine != null,
                      label: a.titre,
                      description: a.date ?? undefined,
                      successMessage: "Atelier mis à jour.",
                    };
                    return (
                      <div key={a.id}>
                        <ToggleWithDependent
                          toggle={membreToggle}
                          dependent={
                            <SettingToggle
                              action={setAtelierPresenceAction}
                              hidden={{ editionId, atelierId: a.id, registrationId: r.id }}
                              checked={mine?.presence === "presente"}
                              control="checkbox"
                              label="Présente"
                              // Cases « Présente » répétées : nom accessible UNIQUE
                              // par atelier (RGAA 11.1).
                              ariaLabel={`Présente — ${a.titre}`}
                              successMessage="Présence mise à jour."
                            />
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}

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
