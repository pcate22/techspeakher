import type { Metadata } from "next";
import Link from "next/link";
import { requireOrgaId } from "@/lib/auth-guards";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { loadRecompenseOrNotFound } from "@/lib/tremplin-admin";
import SujetEntete from "../../../SujetEntete";
import { deleteRecompenseAction } from "../../../../actions";

export const metadata: Metadata = {
  title: "Récompense · Suppression | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/** Sous-page mono-fonction (danger, rare) : suppression de la récompense. */
export default async function RetraitRecompense({
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
        <SujetEntete surtitre="Suppression" titre={rec.intitule}>
          À réserver aux erreurs de saisie : la récompense et son historique
          d&apos;attribution disparaissent. Irréversible.
        </SujetEntete>

        <form action={deleteRecompenseAction}>
          <input type="hidden" name="editionId" value={editionId} />
          <input type="hidden" name="recompenseId" value={rec.id} />
          <ConfirmSubmitButton
            title={`Supprimer « ${rec.intitule} » ?`}
            message="La récompense et son historique d'attribution disparaissent. Cette action est définitive."
            confirmLabel="Supprimer définitivement"
            pendingLabel="Suppression…"
            className="!text-orange hover:!text-orange px-0 min-h-[44px]"
          >
            Supprimer cette récompense
          </ConfirmSubmitButton>
        </form>

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
