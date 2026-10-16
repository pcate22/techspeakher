import type { Metadata } from "next";
import Link from "next/link";
import { requireOrgaId } from "@/lib/auth-guards";
import InlineActionForm from "@/components/InlineActionForm";
import { loadRecompenseOrNotFound } from "@/lib/tremplin-admin";
import {
  getRegistrationsByEdition,
  registrationLabel,
} from "@/lib/tremplin-registrations";
import { RECOMPENSE_TRANSFERT_RAISON_LABEL } from "@/lib/tremplin-recompenses";
import SujetEntete from "../../../SujetEntete";
import { setRecompenseBeneficiaireAction } from "../../../../actions";

export const metadata: Metadata = {
  title: "Récompense · Bénéficiaire | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/** Sous-page mono-fonction : à qui la récompense est attribuée (+ transfert). */
export default async function BeneficiaireRecompense({
  params,
}: {
  params: Promise<{ edition: string; recompense: string }>;
}) {
  await requireOrgaId();
  const { edition, recompense } = await params;
  const { editionId, recompense: rec } = await loadRecompenseOrNotFound(
    edition,
    recompense,
  );
  const hub = `/admin/tremplins/${editionId}/recompenses/${rec.id}`;
  const participantes = [...(await getRegistrationsByEdition(editionId))].sort((a, b) =>
    registrationLabel(a).localeCompare(registrationLabel(b), "fr"),
  );

  return (
    <div className="py-10 px-4">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        <SujetEntete surtitre="Bénéficiaire" titre={rec.intitule}>
          Attribution libre parmi les participantes. Si la récompense d&apos;un
          rang est transmise à une autre (ex. lauréate déjà retenue via le CFP
          officiel), indique la raison : elle apparaît publiquement, sans nom. La
          note interne n&apos;est jamais affichée.
        </SujetEntete>

        <InlineActionForm
          action={setRecompenseBeneficiaireAction}
          hidden={{ editionId, recompenseId: rec.id }}
          fields={[
            {
              kind: "select",
              name: "registrationId",
              label: "Bénéficiaire",
              defaultValue:
                rec.beneficiaireRegistrationId === null
                  ? ""
                  : String(rec.beneficiaireRegistrationId),
              options: [
                { value: "", label: "Personne (pas encore attribuée)" },
                ...participantes.map((p) => ({ value: String(p.id), label: registrationLabel(p) })),
              ],
            },
            {
              kind: "select",
              name: "transfertRaison",
              label: "Raison du transfert (peut apparaître publiquement, sans nom)",
              defaultValue: rec.transfertRaison ?? "",
              options: [
                { value: "", label: "Aucun transfert" },
                ...Object.entries(RECOMPENSE_TRANSFERT_RAISON_LABEL).map(([value, label]) => ({ value, label })),
              ],
            },
            {
              kind: "input",
              name: "motif",
              label: "Note interne (jamais affichée)",
              defaultValue: rec.motif ?? "",
              placeholder: "Contexte pour l'équipe, non public",
            },
          ]}
          variant="primary"
          submitLabel="Enregistrer l'attribution"
          pendingLabel="Enregistrement…"
          successMessage="Attribution enregistrée."
        />

        <p>
          <Link
            href={hub}
            className="inline-block py-2 -my-2 text-sm text-cyan hover:text-cyan-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded"
          >
            ← Retour à la récompense
          </Link>
        </p>
      </div>
    </div>
  );
}
