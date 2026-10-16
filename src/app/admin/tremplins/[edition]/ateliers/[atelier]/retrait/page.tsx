import type { Metadata } from "next";
import SousPage from "@/components/SousPage";
import SubmitButton from "@/components/SubmitButton";
import { requireOrgaId } from "@/lib/auth-guards";
import { getAtelierDeletionCounts } from "@/lib/tremplin-ateliers";
import { loadAtelierOrNotFound } from "@/lib/tremplin-admin";
import MessagesFlash from "@/components/MessagesFlash";
import { apercuRetraitAtelier } from "@/lib/atelier-retrait";
import { deleteAtelierAction } from "../../../../actions";

export const metadata: Metadata = {
  title: "Suppression de l'atelier | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/**
 * Sous-page mono-fonction : SUPPRIMER l'atelier. Une séance annulée, ou un
 * doublon créé par erreur, doit pouvoir disparaître — jusqu'ici rien ne le
 * permettait, et l'orga n'avait d'autre choix que de laisser traîner la ligne
 * dans l'agenda.
 *
 * Le geste vit sur SA page, hors de la fiche : destructif et rare, il n'a rien
 * à faire à côté des réglages courants (règle d'or).
 *
 * DEUX ACTIONS, pas plus (§10, décision du 01/08) : depuis la fiche, ouvrir
 * cette page (1) puis appuyer (2). La page ARME — elle ne fait que ça, et elle
 * chiffre ce qui va partir — et le bouton CONFIRME. Donc pas de modale
 * par-dessus (ce serait la troisième action), et pas de titre à retaper : un
 * atelier n'est pas assez critique pour ça, une séance se repointe.
 *
 * Ce qui tient à la place de la saisie : le périmètre CHIFFRÉ avant l'appui, et
 * ce qui reste dit juste après (personne ne quitte l'édition).
 */
export default async function RetraitAtelier({
  params,
  searchParams,
}: {
  params: Promise<{ edition: string; atelier: string }>;
  searchParams: Promise<{ err?: string }>;
}) {
  await requireOrgaId();
  const { edition: editionParam, atelier: atelierParam } = await params;
  const { editionId, atelier: a } = await loadAtelierOrNotFound(editionParam, atelierParam);
  const counts = await getAtelierDeletionCounts(a.id, editionId);
  // Un refus serveur (atelier déjà supprimé ailleurs, id d'une autre édition)
  // revient ICI, pas sur la liste.
  const { err } = await searchParams;

  // Le périmètre CHIFFRÉ, avant l'appui, écrit UNE fois dans
  // `atelier-retrait.ts` : la confirmation que renvoie la poubelle de la liste
  // en sort aussi. Deux écritures auraient fini par annoncer deux périmètres
  // pour un seul geste.
  const apercu = apercuRetraitAtelier(a.titre, counts);

  return (
    <SousPage
      titre={<span className="text-orange">Supprimer l&apos;atelier</span>}
      retour={{
        href: `/admin/tremplins/${editionId}/ateliers/${a.id}`,
        label: "Retour à l'atelier",
      }}
      indice={`${apercu} Les inscrites, elles, restent inscrites à l'édition. Irréversible.`}
    >
      <MessagesFlash err={err} />

      <form action={deleteAtelierAction}>
        <input type="hidden" name="editionId" value={editionId} />
        <input type="hidden" name="atelierId" value={a.id} />
        {/* Bouton BORDÉ orange plutôt qu'un simple lien-texte : c'est LE geste
            de la page, il doit se voir (contour ≥ 3:1, §9) et se désactiver
            pendant l'envoi (pas de double suppression au double-tap). */}
        <SubmitButton variant="danger" size="sm" pendingLabel="Suppression…">
          Supprimer cet atelier
        </SubmitButton>
      </form>
    </SousPage>
  );
}
