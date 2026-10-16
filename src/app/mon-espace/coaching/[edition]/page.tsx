import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireCoachId } from "@/lib/auth-guards";
import Breadcrumb from "@/components/Breadcrumb";
import DocList from "@/components/DocList";
import RangeeAtelier from "@/components/RangeeAtelier";
import SegmentLabel from "@/components/SegmentLabel";
import InlineActionForm from "@/components/InlineActionForm";
import { nb } from "@/lib/format";
import { libelleAudience } from "@/lib/atelier-audience";
import { getEditionById } from "@/lib/tremplin-editions";
import { tremplinPageMetadata } from "@/lib/tremplin-page-meta";
import {
  getCoachAteliers,
  getCoachCoachees,
  getCoachDocuments,
  getCoachAtelierMembres,
  type CoachDocument,
} from "@/lib/tremplin-coachs";
import { deleteOwnDocumentAction } from "../actions";
import CoachDepotDialog from "../CoachDepotDialog";

/** Titre distinct par édition (RGAA 8.5) : une coach aussi participante peut
 * avoir deux pages « Tremplin 2026 » ouvertes — l'onglet doit les distinguer.
 * Le FORMAT vient du helper partagé (une seule vérité, `getEditionById` est
 * mémoïsé par requête : pas de requête de plus). */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ edition: string }>;
}): Promise<Metadata> {
  return tremplinPageMetadata((await params).edition, "Coaching");
}

export const dynamic = "force-dynamic";

/**
 * Liste de documents du coach — s'appuie sur le composant mutualisé `DocList` ;
 * seule la suppression (limitée à ses propres dépôts) est spécifique au rôle.
 */
function Docs({ docs, editionId }: { docs: CoachDocument[]; editionId: number }) {
  return (
    <div className="mb-2">
      <DocList
        docs={docs}
        empty="Rien pour le moment : dépose le premier support avec « Déposer un document » ci-dessous."
        action={(d) =>
          d.estAuteur ? (
            <InlineActionForm
              action={deleteOwnDocumentAction}
              hidden={{ editionId, documentId: d.id }}
              submitLabel="Supprimer"
              confirm={{
                title: `Supprimer « ${d.titre} » ?`,
                message: "Ton dépôt disparaît de l’espace des participantes. Action définitive.",
                label: "Supprimer définitivement",
              }}
              className="flex flex-col items-end gap-1"
            />
          ) : null
        }
      />
    </div>
  );
}

export default async function CoachingEdition({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  const coachId = await requireCoachId();
  const editionId = Number((await params).edition);
  if (!Number.isInteger(editionId)) notFound();
  const edition = await getEditionById(editionId);
  if (!edition) notFound();

  const [ateliers, coachees, documents, membres] = await Promise.all([
    getCoachAteliers(coachId, editionId),
    getCoachCoachees(coachId, editionId),
    getCoachDocuments(coachId, editionId),
    getCoachAtelierMembres(coachId, editionId),
  ]);
  // Pas de mission dans cette édition → introuvable (pas de fuite d'existence).
  if (ateliers.length === 0 && coachees.length === 0) notFound();

  return (
    <>
      {/* Le fil saute la liste des missions : avec une seule (le cas courant)
          elle redirige ICI, donc le maillon serait revenu sur cette page. La
          liste, quand elle a vraiment un rôle, s'atteint par l'onglet Coaching. */}
      <Breadcrumb
        items={[{ label: "Mon espace", href: "/mon-espace" }, { label: edition.nom }]}
      />
      {/* <div>, pas <main> : le layout racine fournit déjà le landmark principal. */}
      <div className="py-10 px-4">
        <div className="max-w-2xl mx-auto flex flex-col gap-4">
          <header>
            <h1 className="text-2xl font-bold">{edition.nom}</h1>
            <p className="text-sm text-gray-light mt-1">
              Ton espace d&apos;animation&nbsp;: tes coachées, tes ateliers, et
              tes dépôts de documents. Tu vois uniquement tes missions.
            </p>
          </header>

          {/* Les COACHÉES en premier : c'est la première question d'une coach
              (« qui j'accompagne ? ») et ce que promet la rangée du hub. Les deux
              groupes sont TITRÉS — la page enchaînait des cartes sans jamais dire
              où commençait quoi. */}
          {coachees.length > 0 && (
            <section aria-labelledby="mes-coachees" className="flex flex-col gap-4">
              <SegmentLabel id="mes-coachees">
                Mes coachées
              </SegmentLabel>
              {coachees.map((c) => (
                <article
                  key={c.registrationId}
                  aria-labelledby={`coachee-${c.registrationId}-titre`}
                  className="bg-navy-light border border-navy-lighter rounded-2xl p-6"
                >
                  <h3
                    id={`coachee-${c.registrationId}-titre`}
                    className="text-sm font-bold mb-1"
                  >
                    {c.nom}
                  </h3>
                  <p className="text-xs text-gray-light mb-3">
                    {c.sujet ? `Son sujet : « ${c.sujet} »` : "Suivi individuel"}. Elle
                    retrouve tes dépôts dans son espace.
                  </p>
                  <Docs
                    docs={documents.filter((d) => d.registrationId === c.registrationId)}
                    editionId={editionId}
                  />
                  <CoachDepotDialog
                    editionId={editionId}
                    registrationId={c.registrationId}
                    cible={c.nom}
                    defaultType="note"
                  />
                </article>
              ))}
            </section>
          )}

          {ateliers.length > 0 && (
            <section aria-labelledby="mes-ateliers" className="flex flex-col gap-3">
              <SegmentLabel id="mes-ateliers">
                Mes ateliers
              </SegmentLabel>
              {/* Une RANGÉE par séance, et sa PAGE derrière : le détail (lien de
                  visio, supports, dépôt) tenait ici en cartes empilées, si bien
                  qu'une carte d'agenda ne pouvait mener qu'à une ancre au milieu
                  d'une longue page. Une carte mène à une page. */}
              <ul role="list" className="flex flex-col gap-2 list-none">
                {ateliers.map((a) => {
                  const avecQui =
                    (membres.get(a.id)?.length ?? 0) > 0
                      ? `Avec\u00a0: ${membres.get(a.id)!.join(", ")}`
                      : libelleAudience(a.audience, a.phase);
                  const nbSupports = documents.filter((d) => d.atelierId === a.id).length;
                  return (
                    <li key={a.id}>
                      <RangeeAtelier
                        href={`/mon-espace/coaching/${editionId}/ateliers/${a.id}`}
                        titre={a.titre}
                        infos={[avecQui, nbSupports > 0 && nb(nbSupports, "support")]}
                        date={a.date}
                        dateFin={a.dateFin}
                      />
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
