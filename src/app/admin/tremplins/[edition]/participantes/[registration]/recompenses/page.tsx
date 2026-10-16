import type { Metadata } from "next";
import Link from "next/link";
import { requireOrgaId } from "@/lib/auth-guards";
import { registrationLabel } from "@/lib/tremplin-registrations";
import {
  getRecompensesByRegistration,
  RECOMPENSE_STATUT_LABEL,
  type Recompense,
} from "@/lib/tremplin-recompenses";
import { loadRegistrationOrNotFound } from "@/lib/tremplin-admin";
import ParticipanteEntete from "../ParticipanteEntete";

export const metadata: Metadata = {
  title: "Récompenses de la participante | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/** Sous-page mono-fonction (lot C3c) : ses récompenses sur l'édition.
 * L'attribution et le suivi se gèrent sur la fiche de chaque récompense. */
export default async function RecompensesParticipante({
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

  const recompenses = await getRecompensesByRegistration(r.id).catch((e) => {
    console.error("Récompenses indisponibles (migration 018 ?)", e);
    return [] as Recompense[];
  });

  return (
    <div className="py-10 px-4">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        <ParticipanteEntete fonction="Récompenses" nom={nom}>
          L&apos;attribution et le suivi se gèrent sur la fiche de
            chaque récompense.
        </ParticipanteEntete>

        <section>
          {recompenses.length === 0 ? (
            <p className="text-sm text-gray-light">
              Aucune récompense pour l&apos;instant. Elles s&apos;attribuent depuis la
              page{" "}
              <Link
                href={`/admin/tremplins/${editionId}/recompenses`}
                className="text-cyan hover:text-cyan-light underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded"
              >
                Récompenses de l&apos;édition
              </Link>
              .
            </p>
          ) : (
            <ul className="flex flex-col gap-2 list-none" role="list">
              {recompenses.map((rec) => (
                <li key={rec.id} className="text-sm">
                  <Link
                    href={`/admin/tremplins/${editionId}/recompenses/${rec.id}`}
                    className="text-cyan hover:text-cyan-light underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded"
                  >
                    {rec.intitule}
                  </Link>
                  <span className="text-gray-light">
                    {" "}
                    · {RECOMPENSE_STATUT_LABEL[rec.statut]}
                    {rec.motif && ` · ${rec.motif}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
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
