import type { Metadata } from "next";
import Link from "next/link";
import { requireOrgaId } from "@/lib/auth-guards";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { registrationLabel } from "@/lib/tremplin-registrations";
import { loadRegistrationOrNotFound } from "@/lib/tremplin-admin";
import { errMessage } from "@/lib/tremplin-messages";
import ParticipanteEntete from "../ParticipanteEntete";
import { deleteRegistrationAction } from "../../../../actions";

export const metadata: Metadata = {
  title: "Retirer de l'édition | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/** Sous-page mono-fonction (lot C3c) : retirer l'inscription de l'édition
 * (zone danger, action définitive). */
export default async function RetraitParticipante({
  params,
  searchParams,
}: {
  params: Promise<{ edition: string; registration: string }>;
  searchParams?: Promise<{ err?: string }>;
}) {
  await requireOrgaId();
  const { edition: editionParam, registration: registrationParam } = await params;
  const { editionId, edition, registration: r } = await loadRegistrationOrNotFound(
    editionParam,
    registrationParam,
  );
  const nom = registrationLabel(r);
  // La revérification serveur du nom (palier 3) redirige ICI : sans ce message,
  // le refus serait muet et la page se rechargerait à l'identique.
  const errMsg = errMessage((await searchParams)?.err);

  return (
    <div className="py-10 px-4">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        <ParticipanteEntete fonction="Retirer de l'édition" nom={nom}>
          À réserver aux erreurs (mauvais e-mail, doublon) ou à une
            demande de sa part&nbsp;: supprime son inscription, ses documents et
            ses présences sur les photos.
        </ParticipanteEntete>

        {errMsg && (
          <p
            role="alert"
            className="text-sm text-orange bg-orange/10 border border-orange/30 rounded-lg px-4 py-3"
          >
            {errMsg}
          </p>
        )}

        <section
          aria-label="Zone danger"
          className="border border-orange/30 rounded-lg px-4 py-4"
        >
          <form action={deleteRegistrationAction}>
            <input type="hidden" name="editionId" value={editionId} />
            <input type="hidden" name="registrationId" value={r.id} />
            <ConfirmSubmitButton
              title={`Retirer ${nom} de « ${edition.nom} » ?`}
              message="Son inscription, ses documents et ses présences photo seront supprimés. Cette action est définitive."
              confirmLabel="Retirer définitivement"
              pendingLabel="Retrait…"
              variant="danger"
              className="min-h-[44px]"
              confirmText={[nom]}
              confirmTextLabel="Pour confirmer, réécris le nom de la participante"
              confirmTextHint={`Le nom : « ${nom} »`}
            >
              {`Retirer ${nom} de l'édition`}
            </ConfirmSubmitButton>
          </form>
        </section>

        <p>
          <Link
            href={`/admin/tremplins/${editionId}/participantes/${r.id}`}
            className="inline-block py-2 -my-2 text-sm text-cyan hover:text-cyan-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded"
          >
            ← Retour à la fiche
          </Link>
        </p>
      </div>
    </div>
  );
}
