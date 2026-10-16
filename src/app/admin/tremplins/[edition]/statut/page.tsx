import type { Metadata } from "next";
import Link from "next/link";
import { requireOrgaId } from "@/lib/auth-guards";
import InlineActionForm from "@/components/InlineActionForm";
import {
  EDITION_STATUT_LABEL,
  EDITION_STATUTS,
  aujourdhuiParis,
} from "@/lib/tremplin-editions";
import { resumeEdition } from "@/lib/recit-edition";
import { tremplinPageMetadata } from "@/lib/tremplin-page-meta";
import { loadEditionOrNotFound } from "@/lib/tremplin-admin";
import SetFilLeaf from "../SetFilLeaf";
import { setEditionStatutAction } from "../../actions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ edition: string }>;
}): Promise<Metadata> {
  return tremplinPageMetadata((await params).edition, "Statut");
}

export const dynamic = "force-dynamic";

/** Sous-page mono-fonction du hub d'édition : le STATUT — c'est ici qu'on
 * ouvre l'édition au public (une fois), la clôt ou l'archive. */
export default async function StatutEdition({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  await requireOrgaId();
  const { editionId, edition } = await loadEditionOrNotFound((await params).edition);
  // Ce que le PUBLIC lit vraiment depuis le lot G : un récit, plus l'étiquette
  // de statut. L'orga réglait son statut sur la foi d'une promesse fausse
  // (« Affiché publiquement : « Inscriptions ouvertes » »).
  const recitPublic = resumeEdition({
    statut: edition.statut,
    finaleDate: edition.finaleDate,
    confDate: edition.confDate,
    inscriptionsDebut: edition.inscriptionsDebut,
    inscriptionsFin: edition.inscriptionsFin,
    aujourdhui: aujourdhuiParis(),
  });

  return (
    <div className="py-10 px-4">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        <SetFilLeaf label="Statut" />
        <header>
          <h1 className="text-2xl font-bold">Statut</h1>
          <p className="text-sm text-gray-light mt-1">
            «&nbsp;{edition.nom}&nbsp;» ·{" "}
            {edition.statut === "preparation"
              ? "Invisible du public (en préparation)."
              : `Visible du public, qui lit\u00a0: «\u00a0${recitPublic}\u00a0».`}
          </p>
        </header>

        <InlineActionForm
          action={setEditionStatutAction}
          hidden={{ editionId }}
          fields={[
            {
              kind: "select",
              name: "statut",
              label: "Statut de l'édition",
              defaultValue: edition.statut,
              options: EDITION_STATUTS.map((value) => ({
                value,
                label: EDITION_STATUT_LABEL[value],
              })),
            },
          ]}
          variant="primary"
          submitLabel="Enregistrer le statut"
          pendingLabel="Enregistrement…"
          successMessage="Statut enregistré."
        />

        <div className="flex flex-col gap-1 text-xs text-gray-light">
          <p>
            «&nbsp;En préparation&nbsp;»&nbsp;: l&apos;édition reste invisible du public
            (pages Tremplin) jusqu&apos;à ce que tu l&apos;ouvres.
          </p>
          <p>
            Quand des dates d&apos;inscriptions sont posées (sous Informations), le
            libellé public suit le calendrier tout seul&nbsp;: le statut manuel n&apos;a
            pas besoin d&apos;être basculé au jour près.
          </p>
        </div>

        <p>
          <Link
            href={`/admin/tremplins/${editionId}`}
            className="inline-block py-2 -my-2 text-sm text-cyan hover:text-cyan-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded"
          >
            ← Retour à l&apos;édition
          </Link>
        </p>
      </div>
    </div>
  );
}
