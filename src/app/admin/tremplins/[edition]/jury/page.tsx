import type { Metadata } from "next";
import { requireOrgaId } from "@/lib/auth-guards";
import ListPageTemplate from "@/components/ListPageTemplate";
import InlineActionForm from "@/components/InlineActionForm";
import { getJuryByEdition, juryLabel, juryRole, type Jury } from "@/lib/tremplin-jury";
import { deleteJuryAction } from "../../actions";
import AddJuryDialog from "../AddJuryDialog";
import { tremplinPageMetadata } from "@/lib/tremplin-page-meta";
import { loadEditionOrNotFound } from "@/lib/tremplin-admin";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ edition: string }>;
}): Promise<Metadata> {
  return tremplinPageMetadata((await params).edition, "Jury");
}

export const dynamic = "force-dynamic";

export default async function JuryIndex({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  await requireOrgaId();
  const { editionId, edition } = await loadEditionOrNotFound((await params).edition);

  // Table pas encore migrée en prod → liste vide plutôt qu'une page cassée.
  const jury = await getJuryByEdition(editionId).catch((e) => {
    console.error("Jury indisponible (migration 025 ?)", e);
    return [] as Jury[];
  });

  return (
    <ListPageTemplate
      title="Jury"
      meta={`${edition.nom} · ${jury.length} juré${jury.length > 1 ? "s" : ""}`}
      create={<AddJuryDialog editionId={editionId} />}
    >
      <p className="text-xs text-gray-light -mt-2">
        Nom, prénom, fonction et entreprise s&apos;affichent publiquement (avec leur
        accord). L&apos;e-mail reste interne, jamais publié.
      </p>
      {jury.length === 0 ? (
        <p className="text-sm text-gray-light">
          Aucun juré pour l&apos;instant. Ajoute-les avec le bouton ci-dessus (leur
          accord est requis avant tout affichage public).
        </p>
      ) : (
        <ul role="list" className="flex flex-col gap-2 list-none">
          {jury.map((j) => {
            const role = juryRole(j);
            return (
              <li
                key={j.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-navy-lighter bg-navy px-4 py-3"
              >
                <span className="text-sm">
                  <span className="font-medium">{juryLabel(j)}</span>
                  {role && <span className="text-gray-light"> · {role}</span>}
                  {j.email && (
                    <span className="block text-xs text-gray-light">{j.email}</span>
                  )}
                </span>
                <InlineActionForm
                  action={deleteJuryAction}
                  hidden={{ editionId, juryId: j.id }}
                  submitLabel="Retirer"
                  confirm={{
                    title: `Retirer ${juryLabel(j)} du jury ?`,
                    message: "Le juré sort du jury, côté public comme en interne. Action définitive.",
                    label: "Retirer définitivement",
                  }}
                  className="flex flex-col items-end gap-1"
                />
              </li>
            );
          })}
        </ul>
      )}
    </ListPageTemplate>
  );
}
