import type { Metadata } from "next";
import Link from "next/link";
import { requireOrgaId } from "@/lib/auth-guards";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { getEditionDeletionCounts } from "@/lib/tremplin-editions";
import { tremplinPageMetadata } from "@/lib/tremplin-page-meta";
import { loadEditionOrNotFound } from "@/lib/tremplin-admin";
import { nb } from "@/lib/format";
import { errMessage } from "@/lib/tremplin-messages";
import { exigeReecriture } from "@/lib/confirmation";
import SetFilLeaf from "../SetFilLeaf";
import { deleteEditionAction } from "../../actions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ edition: string }>;
}): Promise<Metadata> {
  return tremplinPageMetadata((await params).edition, "Suppression");
}

export const dynamic = "force-dynamic";

/** Sous-page mono-fonction du hub d'édition : le RETRAIT (action destructive
 * et rarissime — elle quitte le hub pour rester hors de l'écran courant).
 * Palier 3 quel que soit le statut (§10) : on retape le nom, revérifié serveur.
 * Une édition « en préparation » efface PLUS qu'une publiée (hard delete
 * cascadant contre soft delete + tombstone) ; le statut ne change que la
 * conséquence annoncée. */
export default async function RetraitEdition({
  params,
  searchParams,
}: {
  params: Promise<{ edition: string }>;
  searchParams: Promise<{ err?: string }>;
}) {
  await requireOrgaId();
  const { editionId, edition } = await loadEditionOrNotFound((await params).edition);
  const { nbParticipantes, nbAteliers, nbPhotos, total } =
    await getEditionDeletionCounts(editionId);
  // La revérification serveur du type-to-confirm redirige ICI (c'est la page
  // du formulaire), pas sur le hub.
  const errMsg = errMessage((await searchParams).err);

  const apercuSuppression = `Supprime définitivement ${nb(nbParticipantes, "participante")}, ${nb(nbAteliers, "atelier")}, ${nb(nbPhotos, "photo")}, le jury et les récompenses de «\u00a0${edition.nom}\u00a0».`;
  const editionPubliee = edition.statut !== "preparation";

  return (
    <div className="py-10 px-4">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        <SetFilLeaf label="Suppression" />
        <header>
          <h1 className="text-2xl font-bold text-orange">Suppression</h1>
          <p className="text-sm text-gray-light mt-1">
            {apercuSuppression} Irréversible.
          </p>
        </header>

        {errMsg && (
          <p
            role="alert"
            className="text-sm text-orange bg-orange/10 border border-orange/30 rounded-lg px-4 py-3"
          >
            {errMsg}
          </p>
        )}

        {/* Palier 3 quel que soit le statut (§10) : on retape le nom exact, et
            le serveur le revérifie. Une édition « en préparation » efface PLUS
            qu'une publiée (hard delete cascadant contre soft delete), le statut
            ne dégrade donc pas le palier — il ne change que la conséquence
            annoncée. */}
        <div>
          <form action={deleteEditionAction}>
            <input type="hidden" name="editionId" value={editionId} />
            <ConfirmSubmitButton
              title={`Supprimer « ${edition.nom} » ?`}
              message={`${apercuSuppression} ${
                editionPubliee
                  ? "Cette édition est publiée : son adresse publique affichera « Cette édition a été supprimée »."
                  : "Rien ne sera récupérable : tout le contenu de l'édition part avec elle (elle n'a pas d'adresse publique à conserver)."
              } Action irréversible.`}
              confirmLabel="Supprimer définitivement"
              pendingLabel="Suppression…"
              className="!text-orange hover:!text-orange px-0 min-h-[44px]"
              // Vide = rien à emporter, donc rien à retaper (§10, le palier se
              // lit sur l'effet). Dès qu'elle porte quoi que ce soit, palier 3.
              confirmText={exigeReecriture(total) ? [edition.nom] : undefined}
              confirmTextLabel="Pour confirmer, réécris le nom de l’édition"
              confirmTextHint={`Le nom : « ${edition.nom} »`}
            >
              Supprimer cette édition
            </ConfirmSubmitButton>
          </form>
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
