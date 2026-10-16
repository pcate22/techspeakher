import type { Metadata } from "next";
import Link from "next/link";
import { requireOrgaId } from "@/lib/auth-guards";
import InlineActionForm from "@/components/InlineActionForm";
import { tremplinPageMetadata } from "@/lib/tremplin-page-meta";
import { loadEditionOrNotFound } from "@/lib/tremplin-admin";
import { listEditionOptions } from "@/lib/conferences";
import SetFilLeaf from "../SetFilLeaf";
import { updateEditionAction } from "../../actions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ edition: string }>;
}): Promise<Metadata> {
  return tremplinPageMetadata((await params).edition, "Informations");
}

export const dynamic = "force-dynamic";

/** Sous-page mono-fonction du hub d'édition : les informations générales
 * (réglées une fois à la création, retouchées rarement). Le statut a sa
 * propre sous-page — c'est là qu'on ouvre l'édition. */
export default async function InfosEdition({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  await requireOrgaId();
  const { editionId, edition } = await loadEditionOrNotFound((await params).edition);
  // Événements de la référence des conférences (migration 027) : lien
  // facultatif « — Aucune » + les événements récents.
  const editionOptions = await listEditionOptions();

  return (
    <div className="py-10 px-4">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        <SetFilLeaf label="Informations" />
        <header>
          <h1 className="text-2xl font-bold">Informations</h1>
          <p className="text-sm text-gray-light mt-1">
            «&nbsp;{edition.nom}&nbsp;» · Conférence, dates et description.
          </p>
        </header>

        <InlineActionForm
          action={updateEditionAction}
          hidden={{ editionId }}
          fields={[
            { kind: "input", name: "nom", label: "Nom de l'édition", required: true, defaultValue: edition.nom, placeholder: "Ex. Tremplin 2027" },
            { kind: "input", name: "confNom", label: "Conférence (sans la ville ni l'année)", required: true, defaultValue: edition.confNom ?? "", placeholder: "Ex. DevFest" },
            { kind: "input", name: "confLieu", label: "Ville ou pays (optionnel)", defaultValue: edition.confLieu ?? "", placeholder: "Ex. Toulouse, ou France" },
            { kind: "input", name: "confDate", label: "Date de la conférence (optionnel)", type: "date", clearable: true, defaultValue: edition.confDate ?? "" },
            { kind: "input", name: "confLien", label: "Site de la conférence (optionnel)", type: "url", defaultValue: edition.confLien ?? "", placeholder: "https://…" },
            { kind: "input", name: "finaleDate", label: "Date de la soirée finale (optionnel)", type: "date", clearable: true, defaultValue: edition.finaleDate ?? "" },
            { kind: "input", name: "finaleLieu", label: "Lieu de la finale (optionnel)", defaultValue: edition.finaleLieu ?? "", placeholder: "Ex. Toulouse" },
            { kind: "input", name: "inscriptionsDebut", label: "Début des inscriptions (optionnel)", type: "date", clearable: true, defaultValue: edition.inscriptionsDebut ?? "" },
            { kind: "input", name: "inscriptionsFin", label: "Fin des inscriptions (optionnel)", type: "date", clearable: true, defaultValue: edition.inscriptionsFin ?? "" },
            {
              kind: "select",
              name: "conferenceEditionId",
              // Mêmes libellés que le formulaire de création (EditionChampsCommuns) :
              // une seule formulation pour l'orga, quel que soit l'écran.
              label: "Conférence partenaire dans la référence (optionnel)",
              defaultValue: edition.conferenceEditionId != null ? String(edition.conferenceEditionId) : "",
              options: [
                { value: "", label: "Non reliée" },
                ...editionOptions.map((o) => ({ value: String(o.id), label: o.libelle })),
              ],
            },
            { kind: "textarea", name: "description", label: "Description (optionnel)", defaultValue: edition.description ?? "" },
          ]}
          variant="primary"
          submitLabel="Enregistrer les informations"
          pendingLabel="Enregistrement…"
          successMessage="Informations enregistrées."
        />

        <div className="flex flex-col gap-1 text-xs text-gray-light">
          <p>
            Avec les dates d&apos;inscriptions, le libellé public («&nbsp;Inscriptions à
            venir / ouvertes / closes&nbsp;») suit le calendrier automatiquement, sans
            toucher au statut.
          </p>
          <p>
            L&apos;URL publique reste celle d&apos;origine
            (/tremplin/{edition.confSlug ?? "…"}/{edition.annee})&nbsp;: renommer la
            conférence ne la change pas.
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
