import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import Breadcrumb from "@/components/Breadcrumb";
import AtelierDetail, { metaLine } from "@/components/AtelierDetail";
import Heures from "@/components/Heures";
import QuandAtelier from "@/components/QuandAtelier";
import SousGroupeDetail from "@/components/SousGroupeDetail";
import { getEditionById } from "@/lib/tremplin-editions";
import { aujourdhuiParis } from "@/lib/tremplin-statut";
import {
  getAtelierById,
  getAtelierMembers,
  getMesSousGroupes,
} from "@/lib/tremplin-ateliers";
import { getRegistrationByUser } from "@/lib/tremplin-registrations";
import { getPhasesForRegistration } from "@/lib/tremplin-registration-phases";
import { getSharedDocuments } from "@/lib/tremplin-documents";
import { canViewEditionSpace, atelierVisiblePour } from "@/lib/tremplin-guards";
import { setMonSousGroupeFaitLeAction } from "../../../actions";

/** RGAA 8.6 : le titre nomme l'édition — « Mon atelier » quinze fois ne
 * distingue rien dans une barre d'onglets. Le nom de l'atelier, lui, reste
 * dehors : il n'est pas public pour une séance réservée. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ edition: string }>;
}): Promise<Metadata> {
  const editionId = Number((await params).edition);
  const edition = Number.isInteger(editionId) ? await getEditionById(editionId) : null;
  return {
    title: `Atelier · ${edition?.nom ?? "Tremplin"} | Tech Speak'Her`,
    robots: { index: false },
  };
}

export const dynamic = "force-dynamic";

/**
 * LA page d'UN atelier, côté participante.
 *
 * L'espace d'édition liste le programme ; ici on ouvre une séance : quand, où,
 * le lien pour s'y retrouver, ses supports, et — quand la séance se fait en
 * duo — son sous-groupe avec « marquer comme fait ». C'est la destination des
 * cartes d'agenda : une carte mène à une PAGE, plus à une rangée surlignée au
 * milieu d'une liste de quinze.
 *
 * Deux gardes, les mêmes que l'espace, dans le même ordre : être inscrite à
 * l'édition (ou orga), puis que CET atelier lui soit visible (`atelierVisiblePour`
 * — un atelier réservé à d'autres reste introuvable, supports compris).
 */
export default async function MonAtelier({
  params,
}: {
  params: Promise<{ edition: string; atelier: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/connexion");

  const { edition: editionRaw, atelier: atelierRaw } = await params;
  const editionId = Number(editionRaw);
  const atelierId = Number(atelierRaw);
  if (!Number.isInteger(editionId) || !Number.isInteger(atelierId)) notFound();

  const userId = Number(session.user.id);
  const isOrga = Boolean(session.user.isOrga);

  const edition = await getEditionById(editionId);
  if (!edition) notFound();

  const registration = await getRegistrationByUser(userId, editionId);
  if (!canViewEditionSpace(registration, isOrga)) notFound();

  // `getAtelierById` est scopé à l'édition : un id d'une AUTRE édition ne peut
  // pas se glisser dans l'URL pour être lu ici.
  const atelier = await getAtelierById(atelierId, editionId);
  if (!atelier) notFound();

  const [membres, sharedDocs, mesSousGroupes, mesPhases] = await Promise.all([
    // AUCUN repli sur ces deux lectures. `membres` alimente `atelierVisiblePour` :
    // se rabattre sur `[]` ferait décider l'autorisation sur une liste vide
    // obtenue par erreur. Et répondre « aucun support » quand la table est
    // injoignable, c'est affirmer faux à la participante.
    getAtelierMembers(atelierId),
    getSharedDocuments(editionId),
    // Le sous-groupe, lui, est optionnel (migration 047 pas forcément jouée) :
    // la séance s'affiche sans — mais la panne se journalise.
    getMesSousGroupes(userId, editionId).catch((e) => {
      console.error("Sous-groupes indisponibles (migration 047 ?)", e);
      return [] as Awaited<ReturnType<typeof getMesSousGroupes>>;
    }),
    // Ses phases : elles décident de la visibilité d'un atelier « de phase ».
    // Repli NON exposant (migration 025 pas jouée) : sans phase connue, un tel
    // atelier reste fermé plutôt que de s'ouvrir à tout le monde.
    registration
      ? getPhasesForRegistration(registration.id).catch((e) => {
          console.error("Appartenances de phase indisponibles (migration 025 ?)", e);
          return undefined;
        })
      : Promise.resolve(undefined),
  ]);

  if (
    !atelierVisiblePour({
      audience: atelier.audience,
      phase: atelier.phase,
      membres,
      registration,
      phasesDeLInscrite: mesPhases,
      isOrga,
    })
  ) {
    notFound();
  }

  const supports = sharedDocs.filter((d) => d.atelierId === atelierId);
  const sousGroupe = mesSousGroupes.find((sg) => sg.atelierId === atelierId);

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Mon espace", href: "/mon-espace" },
          { label: edition.nom, href: `/mon-espace/tremplin/${editionId}` },
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
                // Période OU date : une revue « du 7 au 13 » ne s'affiche pas
                // comme un rendez-vous le lundi 7 (lot A).
                (atelier.date || atelier.dateFin) && (
                  <QuandAtelier date={atelier.date} dateFin={atelier.dateFin} weekday />
                ),
                <Heures key="h" debut={atelier.heureDebut} fin={atelier.heureFin} />,
                atelier.lieu,
                atelier.coachs && `Coach\u00a0: ${atelier.coachs}`,
              ])}
              lienVisio={atelier.lienVisio}
              supports={supports}
              supportsEmpty="Les supports de cette séance arriveront ici."
            />
            {atelier.description && (
              <p className="mt-3 text-sm text-gray-light whitespace-pre-line">
                {atelier.description}
              </p>
            )}
          </section>

          {/* Le sous-groupe : ce qui est PROPRE à cette participante sur cette
              séance (avec qui, le lien, « fait le »). Absent quand la séance est
              collective — la page ne montre pas de cadre vide. */}
          {sousGroupe && (
            <section
              aria-labelledby="sous-groupe-titre"
              className="bg-navy-light border border-navy-lighter rounded-2xl p-6"
            >
              <h2 id="sous-groupe-titre" className="text-sm font-bold mb-3">
                Ton sous-groupe
              </h2>
              <SousGroupeDetail
                sg={sousGroupe}
                editionId={editionId}
                aujourdhui={aujourdhuiParis()}
                action={setMonSousGroupeFaitLeAction}
              />
            </section>
          )}
        </div>
      </div>
    </>
  );
}
