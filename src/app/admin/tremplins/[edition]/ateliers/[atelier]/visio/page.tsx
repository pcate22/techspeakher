import type { Metadata } from "next";
import { requireOrgaId } from "@/lib/auth-guards";
import InlineActionForm from "@/components/InlineActionForm";
import SousPage from "@/components/SousPage";
import { loadAtelierOrNotFound } from "@/lib/tremplin-admin";
import { setAtelierVisioAction } from "../../../../actions";

export const metadata: Metadata = {
  title: "Lien de connexion | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/** Sous-page mono-fonction (lot C3b) : le lien visio de l'atelier. */
export default async function VisioAtelier({
  params,
}: {
  params: Promise<{ edition: string; atelier: string }>;
}) {
  await requireOrgaId();
  const { edition: editionParam, atelier: atelierParam } = await params;
  const { editionId, atelier: a } = await loadAtelierOrNotFound(editionParam, atelierParam);

  return (
    <SousPage
      titre="Lien de connexion (visio)"
      retour={{
        href: `/admin/tremplins/${editionId}/ateliers/${a.id}`,
        label: "Retour à l'atelier",
      }}
    >
      <InlineActionForm
        action={setAtelierVisioAction}
        hidden={{ editionId, atelierId: a.id }}
        fields={[
          {
            kind: "input",
            name: "lienVisio",
            label: "Adresse de la visio",
            type: "url",
            defaultValue: a.lienVisio ?? "",
            placeholder: "https://meet.google.com/…",
          },
        ]}
        variant="primary"
        submitLabel="Enregistrer le lien"
        pendingLabel="Enregistrement…"
        successMessage="Lien de connexion enregistré."
      />
    </SousPage>
  );
}
