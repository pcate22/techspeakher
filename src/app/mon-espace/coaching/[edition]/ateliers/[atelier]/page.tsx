import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireCoachId } from "@/lib/auth-guards";
import Breadcrumb from "@/components/Breadcrumb";
import AtelierDetail, { metaLine } from "@/components/AtelierDetail";
import Heures from "@/components/Heures";
import QuandAtelier from "@/components/QuandAtelier";
import InlineActionForm from "@/components/InlineActionForm";
import { libelleAudience } from "@/lib/atelier-audience";
import { getEditionById } from "@/lib/tremplin-editions";
import {
  getCoachAteliers,
  getCoachDocuments,
  getCoachAtelierMembres,
} from "@/lib/tremplin-coachs";
import { deleteOwnDocumentAction } from "../../../actions";
import CoachDepotDialog from "../../../CoachDepotDialog";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ edition: string }>;
}): Promise<Metadata> {
  const editionId = Number((await params).edition);
  const edition = Number.isInteger(editionId) ? await getEditionById(editionId) : null;
  return {
    title: `Atelier · ${edition?.nom ?? "Coaching"} | Tech Speak'Her`,
    robots: { index: false },
  };
}

export const dynamic = "force-dynamic";

/**
 * LA page d'UN atelier, côté coach : la séance qu'elle anime, avec qui, et ses
 * dépôts. Destination des cartes d'agenda — une carte mène à une PAGE, plus à
 * une rangée surlignée au milieu de son espace.
 *
 * La garde est la liste elle-même : `getCoachAteliers` ne renvoie QUE les
 * ateliers que ce compte anime dans cette édition. Un atelier qu'elle n'anime
 * pas (ou d'une autre édition) est donc introuvable — pas de fuite d'existence,
 * et rien à re-vérifier ailleurs.
 */
export default async function AtelierCoache({
  params,
}: {
  params: Promise<{ edition: string; atelier: string }>;
}) {
  const coachId = await requireCoachId();
  const { edition: editionRaw, atelier: atelierRaw } = await params;
  const editionId = Number(editionRaw);
  const atelierId = Number(atelierRaw);
  if (!Number.isInteger(editionId) || !Number.isInteger(atelierId)) notFound();

  const edition = await getEditionById(editionId);
  if (!edition) notFound();

  const [ateliers, documents, membres] = await Promise.all([
    getCoachAteliers(coachId, editionId),
    getCoachDocuments(coachId, editionId),
    getCoachAtelierMembres(coachId, editionId),
  ]);
  const atelier = ateliers.find((a) => a.id === atelierId);
  if (!atelier) notFound();

  const participantes = membres.get(atelierId) ?? [];

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Mon espace", href: "/mon-espace" },
          { label: edition.nom, href: `/mon-espace/coaching/${editionId}` },
          { label: atelier.titre },
        ]}
      />
      {/* <div>, pas <main> : le layout racine fournit déjà le landmark principal. */}
      <div className="py-10 px-4">
        <div className="max-w-2xl mx-auto flex flex-col gap-4">
          <section
            aria-labelledby="atelier-titre"
            className="bg-navy-light border border-navy-lighter rounded-2xl p-6"
          >
            <AtelierDetail
              titre={atelier.titre}
              as="h1"
              titreId="atelier-titre"
              titreClassName="text-2xl font-bold mb-1"
              meta={metaLine([
                (atelier.date || atelier.dateFin) && (
                  <QuandAtelier date={atelier.date} dateFin={atelier.dateFin} weekday />
                ),
                <Heures key="h" debut={atelier.heureDebut} fin={atelier.heureFin} />,
                atelier.lieu,
                participantes.length > 0
                  ? `Avec\u00a0: ${participantes.join(", ")}`
                  : libelleAudience(atelier.audience, atelier.phase),
              ])}
              lienVisio={atelier.lienVisio}
              supports={documents.filter((d) => d.atelierId === atelierId)}
              supportsEmpty="Rien pour le moment : dépose le premier support ci-dessous."
              supportAction={(d) =>
                d.estAuteur ? (
                  <InlineActionForm
                    action={deleteOwnDocumentAction}
                    hidden={{ editionId, documentId: d.id }}
                    submitLabel="Supprimer"
                    confirm={{
                      title: `Supprimer « ${d.titre} » ?`,
                      message:
                        "Ton dépôt disparaît de l’espace des participantes. Action définitive.",
                      label: "Supprimer définitivement",
                    }}
                    className="flex flex-col items-end gap-1"
                  />
                ) : null
              }
            >
              <CoachDepotDialog
                editionId={editionId}
                atelierId={atelierId}
                cible={`« ${atelier.titre} »`}
                defaultType="support_atelier"
              />
            </AtelierDetail>
          </section>
        </div>
      </div>
    </>
  );
}
