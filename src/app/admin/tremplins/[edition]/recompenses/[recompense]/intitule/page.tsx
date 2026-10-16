import type { Metadata } from "next";
import Link from "next/link";
import { requireOrgaId } from "@/lib/auth-guards";
import InlineActionForm from "@/components/InlineActionForm";
import { loadRecompenseOrNotFound } from "@/lib/tremplin-admin";
import SujetEntete from "../../../SujetEntete";
import { updateRecompenseAction } from "../../../../actions";

export const metadata: Metadata = {
  title: "Récompense · Intitulé | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/** Sous-page mono-fonction : l'intitulé, le détail et le rang de podium. */
export default async function IntituleRecompense({
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
        <SujetEntete surtitre="Intitulé et rang" titre={rec.intitule}>
          Ce que la récompense recouvre. Le rang la relie au podium (vide pour un
          talk en meetup, un coaching CFP…).
        </SujetEntete>

        <InlineActionForm
          action={updateRecompenseAction}
          hidden={{ editionId, recompenseId: rec.id }}
          fields={[
            { kind: "input", name: "intitule", label: "Intitulé", required: true, defaultValue: rec.intitule },
            { kind: "input", name: "detail", label: "Détail (facultatif)", defaultValue: rec.detail ?? "", placeholder: "Salle communauté" },
            { kind: "input", name: "rang", label: "Rang du podium (facultatif)", defaultValue: rec.rang === null ? "" : String(rec.rang), placeholder: "1" },
          ]}
          variant="primary"
          submitLabel="Enregistrer"
          pendingLabel="Enregistrement…"
          successMessage="Intitulé enregistré."
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
