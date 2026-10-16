import type { Metadata } from "next";
import Link from "next/link";
import { requireOrgaId } from "@/lib/auth-guards";
import InlineActionForm from "@/components/InlineActionForm";
import ExternalLink from "@/components/ExternalLink";
import { registrationLabel } from "@/lib/tremplin-registrations";
import { getDocumentsByEdition } from "@/lib/tremplin-documents";
import { loadRegistrationOrNotFound } from "@/lib/tremplin-admin";
import ParticipanteEntete from "../ParticipanteEntete";
import { deleteDocumentAction } from "../../../../actions";
import AddDocumentDialog from "../../../AddDocumentDialog";

export const metadata: Metadata = {
  title: "Documents privés | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/** Sous-page mono-fonction (lot C3c) : ses documents privés (retour du jury,
 * vidéo de pitch, notes…), visibles d'elle seule et des orgas. */
export default async function DocumentsParticipante({
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

  const documents = (await getDocumentsByEdition(editionId)).filter(
    (d) => d.registrationId === r.id,
  );

  return (
    <div className="py-10 px-4">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        <ParticipanteEntete fonction="Documents privés" nom={nom}>
          Retour du jury, vidéo de pitch, notes… Visibles d&apos;elle
            seule (et des organisatrices), jamais publiés.
        </ParticipanteEntete>

        <section>
          {documents.length === 0 ? (
            <p className="text-sm text-gray-light mb-2">Aucun document pour l&apos;instant.</p>
          ) : (
            <ul className="flex flex-col gap-2 list-none mb-2" role="list">
              {documents.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 text-sm">
                  <span>
                    {d.lien ? (
                      <ExternalLink
                        href={d.lien}
                        className="text-cyan hover:text-cyan-light underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded"
                      >
                        {d.titre}
                      </ExternalLink>
                    ) : (
                      d.titre
                    )}
                  </span>
                  <InlineActionForm
                    action={deleteDocumentAction}
                    hidden={{ editionId, documentId: d.id }}
                    submitLabel="Supprimer"
                    confirm={{
                      title: `Supprimer « ${d.titre} » ?`,
                      message:
                        "Le document disparaît, pour elle comme pour les organisatrices. Action définitive.",
                      label: "Supprimer définitivement",
                    }}
                    className="flex flex-col items-end gap-1"
                  />
                </li>
              ))}
            </ul>
          )}
          <AddDocumentDialog
            triggerVariant="primary"
            editionId={editionId}
            portee="participante"
            registrationId={r.id}
            triggerLabel="Ajouter un document privé"
            title={`Document privé pour ${nom}`}
            defaultType="feedback_jury"
            cible={nom}
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
