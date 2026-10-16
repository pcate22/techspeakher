import type { Metadata } from "next";
import Link from "next/link";
import { requireOrgaId } from "@/lib/auth-guards";
import InlineActionForm from "@/components/InlineActionForm";
import { loadRecompenseOrNotFound } from "@/lib/tremplin-admin";
import { RECOMPENSE_STATUT_LABEL } from "@/lib/tremplin-recompenses";
import SujetEntete from "../../../SujetEntete";
import { setRecompenseSuiviAction } from "../../../../actions";

export const metadata: Metadata = {
  title: "Récompense · Suivi | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/** Sous-page mono-fonction : où en est l'organisation de ce qui découle de la
 * récompense (le meetup est-il calé ? a-t-il eu lieu ?). */
export default async function SuiviRecompense({
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

  return (
    <div className="py-10 px-4">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        <SujetEntete surtitre="Suivi de l'événement" titre={rec.intitule}>
          Où en est l&apos;organisation de ce qui découle de la récompense.
        </SujetEntete>

        <InlineActionForm
          action={setRecompenseSuiviAction}
          hidden={{ editionId, recompenseId: rec.id }}
          fields={[
            {
              kind: "select",
              name: "statut",
              label: "Statut",
              defaultValue: rec.statut,
              options: (Object.entries(RECOMPENSE_STATUT_LABEL) as [string, string][]).map(([value, label]) => ({ value, label })),
            },
            { kind: "input", name: "evenementLe", label: "Date de l'événement (facultatif)", type: "date", defaultValue: rec.evenementLe ?? "" },
          ]}
          variant="primary"
          submitLabel="Enregistrer le suivi"
          pendingLabel="Enregistrement…"
          successMessage="Suivi enregistré."
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
