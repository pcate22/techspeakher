import type { Metadata } from "next";
import { requireOrgaId } from "@/lib/auth-guards";
import InlineActionForm from "@/components/InlineActionForm";
import SousPage from "@/components/SousPage";
import { loadAtelierOrNotFound } from "@/lib/tremplin-admin";
import { PHASE_ATELIER_LABEL, NATURE_ATELIER_LABEL } from "@/lib/tremplin-ateliers";
import { updateAtelierInfosAction } from "../../../../actions";

export const metadata: Metadata = {
  title: "Informations de l'atelier | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/** Sous-page mono-fonction (lot C3b) : informations de fond de l'atelier
 * (titre, date, horaires, description) ET sa phase (avant / après la soirée) —
 * regroupée ici car elle dépend de la date. */
export default async function InfosAtelier({
  params,
}: {
  params: Promise<{ edition: string; atelier: string }>;
}) {
  await requireOrgaId();
  const { edition: editionParam, atelier: atelierParam } = await params;
  const { editionId, atelier: a } = await loadAtelierOrNotFound(editionParam, atelierParam);

  return (
    <SousPage
      titre="Informations"
      retour={{
        href: `/admin/tremplins/${editionId}/ateliers/${a.id}`,
        label: "Retour à l'atelier",
      }}
    >
      <InlineActionForm
        action={updateAtelierInfosAction}
        hidden={{ editionId, atelierId: a.id }}
        fields={[
          { kind: "input", name: "titre", label: "Titre", required: true, defaultValue: a.titre, placeholder: "Ex. Coaching DevFest : préparer ses slides" },
          {
            kind: "select",
            name: "phase",
            label: "Phase",
            defaultValue: a.phase,
            options: (Object.entries(PHASE_ATELIER_LABEL) as [string, string][]).map(
              ([value, label]) => ({ value, label }),
            ),
          },
          {
            kind: "select",
            name: "nature",
            label: "Nature",
            defaultValue: a.nature,
            options: (Object.entries(NATURE_ATELIER_LABEL) as [string, string][]).map(
              ([value, label]) => ({ value, label }),
            ),
          },
          { kind: "input", name: "date", label: "Date ou début de fenêtre (optionnel)", type: "date", clearable: true, defaultValue: a.date ?? "" },
          { kind: "input", name: "dateFin", label: "Fin de fenêtre (optionnel)", type: "date", clearable: true, defaultValue: a.dateFin ?? "" },
          { kind: "input", name: "heureDebut", label: "Heure de début (optionnel)", type: "time", clearable: true, defaultValue: a.heureDebut ?? "" },
          { kind: "input", name: "heureFin", label: "Heure de fin (optionnel)", type: "time", clearable: true, defaultValue: a.heureFin ?? "" },
          { kind: "input", name: "lieu", label: "Lieu physique (optionnel)", clearable: true, defaultValue: a.lieu ?? "", placeholder: "Ex. BPCE Solutions informatiques, Toulouse" },
          { kind: "textarea", name: "description", label: "Description (optionnel)", defaultValue: a.description ?? "" },
        ]}
        variant="primary"
        submitLabel="Enregistrer les informations"
        pendingLabel="Enregistrement…"
        successMessage="Informations enregistrées."
        stickySubmit
      />
    </SousPage>
  );
}
