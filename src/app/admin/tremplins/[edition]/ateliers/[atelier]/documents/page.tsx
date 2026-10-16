import type { Metadata } from "next";
import { requireOrgaId } from "@/lib/auth-guards";
import InlineActionForm from "@/components/InlineActionForm";
import SousPage from "@/components/SousPage";
import ExternalLink from "@/components/ExternalLink";
import { getAtelierMembers } from "@/lib/tremplin-ateliers";
import { getDocumentsByEdition } from "@/lib/tremplin-documents";
import { loadAtelierOrNotFound } from "@/lib/tremplin-admin";
import { deleteDocumentAction } from "../../../../actions";
import AddDocumentDialog from "../../../AddDocumentDialog";

export const metadata: Metadata = {
  title: "Supports de l'atelier | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/** Sous-page mono-fonction (lot C3b) : les supports partagés de l'atelier. */
export default async function SupportsAtelier({
  params,
}: {
  params: Promise<{ edition: string; atelier: string }>;
}) {
  await requireOrgaId();
  const { edition: editionParam, atelier: atelierParam } = await params;
  const { editionId, atelier: a } = await loadAtelierOrNotFound(editionParam, atelierParam);

  const [allDocs, membreIds] = await Promise.all([
    getDocumentsByEdition(editionId),
    getAtelierMembers(a.id),
  ]);
  const documents = allDocs.filter((d) => d.atelierId === a.id);

  return (
    <SousPage
      titre="Supports"
      indice={
        membreIds.length === 0
          ? "Partagés avec toutes les inscrites de l'édition."
          : "Partagés avec les participantes de cet atelier uniquement."
      }
      retour={{
        href: `/admin/tremplins/${editionId}/ateliers/${a.id}`,
        label: "Retour à l'atelier",
      }}
    >
      <section>
        {documents.length === 0 ? (
          <p className="text-sm text-gray-light mb-2">Aucun support pour l&apos;instant.</p>
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
                    title: `Supprimer « ${d.titre} » ?`,
                    message: "Le document disparaît de l’atelier, pour tout le monde. Action définitive.",
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
          portee="atelier"
          atelierId={a.id}
          triggerLabel="Ajouter un support"
          title={`Support pour « ${a.titre} »`}
          defaultType="support_atelier"
          cible={`l'atelier « ${a.titre} »`}
        />
      </section>
    </SousPage>
  );
}
