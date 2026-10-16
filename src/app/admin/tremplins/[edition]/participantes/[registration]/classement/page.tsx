import type { Metadata } from "next";
import Link from "next/link";
import { requireOrgaId } from "@/lib/auth-guards";
import CarteSection from "@/components/CarteSection";
import InlineActionForm from "@/components/InlineActionForm";
import { registrationLabel } from "@/lib/tremplin-registrations";
import { loadRegistrationOrNotFound } from "@/lib/tremplin-admin";
import ParticipanteEntete from "../ParticipanteEntete";
import { updateRegistrationDetailsAction } from "../../../../actions";

export const metadata: Metadata = {
  title: "Classement au podium | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/** Sous-page mono-fonction : le rang de podium (le seul champ de galerie que
 * l'orga gère). La visibilité vit sur sa propre sous-page — une page, un CTA. */
export default async function ClassementParticipante({
  params,
}: {
  params: Promise<{ edition: string; registration: string }>;
}) {
  await requireOrgaId();
  const { edition: editionParam, registration: registrationParam } = await params;
  const { editionId, registration: r } = await loadRegistrationOrNotFound(
    editionParam,
    registrationParam,
  );
  const nom = registrationLabel(r);

  return (
    <div className="py-10 px-4">
      <div className="max-w-2xl mx-auto flex flex-col gap-4">
        <ParticipanteEntete fonction="Classement au podium" nom={nom} />

        <CarteSection
          id="podium-titre"
          titre="Classement au podium"
          description="Le rang de podium (1, 2, 3…) est le mérite de l'édition : c'est le seul champ de galerie que l’équipe organisatrice gère. Laisser vide si non classée."
        >
          <InlineActionForm
            action={updateRegistrationDetailsAction}
            hidden={{ editionId, registrationId: r.id }}
            fields={[
              { kind: "input", name: "classement", label: "Classement au podium (optionnel : 1, 2, 3…)", defaultValue: r.classement != null ? String(r.classement) : "", placeholder: "Ex. 1" },
            ]}
            variant="primary"
            submitLabel="Enregistrer le classement"
            pendingLabel="Enregistrement…"
            successMessage="Classement enregistré."
          />
        </CarteSection>

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
