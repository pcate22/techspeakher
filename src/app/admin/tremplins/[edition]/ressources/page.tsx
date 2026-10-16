import type { Metadata } from "next";
import { requireOrgaId } from "@/lib/auth-guards";
import ListPageTemplate from "@/components/ListPageTemplate";
import { SetFilCrumbs } from "../FilContext";
import DocList from "@/components/DocList";
import InlineActionForm from "@/components/InlineActionForm";
import { getDocumentsByEdition } from "@/lib/tremplin-documents";
import { deleteDocumentAction } from "../../actions";
import AddDocumentDialog from "../AddDocumentDialog";
import { tremplinPageMetadata } from "@/lib/tremplin-page-meta";
import { loadEditionOrNotFound } from "@/lib/tremplin-admin";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ edition: string }>;
}): Promise<Metadata> {
  return tremplinPageMetadata((await params).edition, "Ressources générales");
}

export const dynamic = "force-dynamic";

export default async function RessourcesIndex({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  await requireOrgaId();
  const { editionId, edition } = await loadEditionOrNotFound((await params).edition);

  const documents = await getDocumentsByEdition(editionId);
  const generalDocs = documents.filter(
    (d) => d.atelierId === null && d.registrationId === null,
  );

  return (
    <>
      <SetFilCrumbs crumbs={[{ label: "Ressources" }]} />
      <ListPageTemplate
      title="Ressources générales"
      meta={`${edition.nom} · ${generalDocs.length} ressource${generalDocs.length > 1 ? "s" : ""}`}
      create={
        <AddDocumentDialog
          editionId={editionId}
          portee="generale"
          triggerLabel="Ajouter une ressource"
          title="Ressource pour toutes"
          cible="toutes les participantes"
        />
      }
    >
      <p className="text-xs text-gray-light -mt-2">
        Visibles de toutes les inscrites dans leur espace (les supports d&apos;un
        atelier se gèrent sur sa fiche, les documents privés sur la fiche de
        chaque participante).
      </p>
      <DocList
        docs={generalDocs}
        empty="Aucune ressource pour l'instant."
        action={(d) => (
          <InlineActionForm
            action={deleteDocumentAction}
            hidden={{ editionId, documentId: d.id }}
            submitLabel="Supprimer"
            confirm={{
              title: `Supprimer « ${d.titre} » ?`,
              message: "Le document disparaît des ressources, pour tout le monde. Action définitive.",
              label: "Supprimer définitivement",
            }}
            className="flex flex-col items-end gap-1"
          />
        )}
      />
      </ListPageTemplate>
    </>
  );
}
