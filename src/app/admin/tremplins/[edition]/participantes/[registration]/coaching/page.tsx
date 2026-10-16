import type { Metadata } from "next";
import Link from "next/link";
import { requireOrgaId } from "@/lib/auth-guards";
import InlineActionForm from "@/components/InlineActionForm";
import { registrationLabel } from "@/lib/tremplin-registrations";
import { getCoachsByRegistration, coachLabel } from "@/lib/tremplin-coachs";
import { getComptesPlateforme, compteLabel } from "@/lib/users";
import { loadRegistrationOrNotFound } from "@/lib/tremplin-admin";
import ParticipanteEntete from "../ParticipanteEntete";
import { removeCoachAction } from "../../../../actions";
import AddCoachDialog from "../../../AddCoachDialog";

export const metadata: Metadata = {
  title: "Coaching individuel | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/** Sous-page mono-fonction (lot C3c) : son coach individuel. */
export default async function CoachingParticipante({
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

  const [coachs, comptesBruts] = await Promise.all([
    getCoachsByRegistration(r.id).catch((e) => {
      console.error("Coachs indisponibles (migration 017 ?)", e);
      return [];
    }),
    getComptesPlateforme(),
  ]);
  const comptes = comptesBruts.map((c) => ({ id: c.id, label: compteLabel(c) }));

  return (
    <div className="py-10 px-4">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        <ParticipanteEntete fonction="Coaching individuel" nom={nom}>
          Coach assigné pour son suivi personnel (en plus des
            ateliers). Elle le voit dans son espace.
        </ParticipanteEntete>

        <section>
          {coachs.length === 0 ? (
            <p className="text-sm text-gray-light mb-2">
              Aucun coach individuel pour l&apos;instant.
            </p>
          ) : (
            <ul className="flex flex-col gap-2 list-none mb-2" role="list">
              {coachs.map((c) => (
                <li key={c.userId} className="flex items-center justify-between gap-3 text-sm">
                  <span>
                    {coachLabel(c)}
                    {c.nom && c.email && <span className="text-gray-light"> ({c.email})</span>}
                  </span>
                  <InlineActionForm
                    action={removeCoachAction}
                    hidden={{ editionId, registrationId: r.id, userId: c.userId }}
                    submitLabel="Retirer"
                    confirm={{
                      title: `Retirer ${coachLabel(c)} ?`,
                      message: `${coachLabel(c)} sort du coaching individuel de ${nom}.`,
                      label: "Retirer",
                    }}
                    className="flex flex-col items-end gap-1"
                  />
                </li>
              ))}
            </ul>
          )}
          <AddCoachDialog
            triggerVariant="primary"
            editionId={editionId}
            registrationId={r.id}
            cible={nom}
            comptes={comptes}
          />
        </section>

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
