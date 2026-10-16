import type { Metadata } from "next";
import { requireOrgaId } from "@/lib/auth-guards";
import ListPageTemplate from "@/components/ListPageTemplate";
import NavRow from "@/components/NavRow";
import {
  getRecompensesByEdition,
  RECOMPENSE_STATUT_LABEL,
  type Recompense,
} from "@/lib/tremplin-recompenses";
import { dateCourteFr } from "@/lib/format";
import AddRecompenseDialog from "../AddRecompenseDialog";
import { tremplinPageMetadata } from "@/lib/tremplin-page-meta";
import { loadEditionOrNotFound } from "@/lib/tremplin-admin";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ edition: string }>;
}): Promise<Metadata> {
  return tremplinPageMetadata((await params).edition, "Récompenses");
}

export const dynamic = "force-dynamic";

export default async function RecompensesIndex({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  await requireOrgaId();
  const { editionId, edition } = await loadEditionOrNotFound((await params).edition);

  // Comme le hub : une table pas encore migrée dégrade proprement (liste vide)
  // au lieu de casser la page.
  const recompenses = await getRecompensesByEdition(editionId).catch((e) => {
    console.error("Récompenses indisponibles (migration 018 ?)", e);
    return [] as Recompense[];
  });

  return (
    <ListPageTemplate
      title="Récompenses"
      meta={`${edition.nom} · ${recompenses.length} récompense${recompenses.length > 1 ? "s" : ""}`}
      create={<AddRecompenseDialog editionId={editionId} />}
    >
      {recompenses.length === 0 ? (
        <p className="text-sm text-gray-light">
          Aucune récompense pour l&apos;instant. Ajoute-en une avec le bouton ci-dessus.
        </p>
      ) : (
        <ul role="list" className="flex flex-col gap-2 list-none">
          {recompenses.map((rec) => {
            const sousTitre = [
              rec.rang && `podium : ${rec.rang === 1 ? "1ʳᵉ" : `${rec.rang}ᵉ`}`,
              rec.beneficiaireNom ? `pour ${rec.beneficiaireNom}` : "à attribuer",
              RECOMPENSE_STATUT_LABEL[rec.statut],
              rec.evenementLe && dateCourteFr(rec.evenementLe),
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <li key={rec.id}>
                <NavRow
                  href={`/admin/tremplins/${editionId}/recompenses/${rec.id}`}
                  title={rec.intitule}
                  subtitle={sousTitre}
                  flag={!rec.beneficiaireNom}
                />
              </li>
            );
          })}
        </ul>
      )}
    </ListPageTemplate>
  );
}
