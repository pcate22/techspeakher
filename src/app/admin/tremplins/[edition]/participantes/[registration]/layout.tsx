import type { ReactNode } from "react";
import { requireOrgaId } from "@/lib/auth-guards";
import { loadRegistrationOrNotFound } from "@/lib/tremplin-admin";
import { registrationLabel } from "@/lib/tremplin-registrations";
import SetFilTail from "../../FilContext";
import { PARTICIPANTE_SOUS_PAGES } from "../../fil-sous-pages";

/**
 * Layout d'une participante : ajoute le fil de contexte manquant
 * (« Participantes › {nom} › {sous-page} ») sous les pastilles de l'édition.
 * `loadRegistrationOrNotFound` est mémoïsé par requête (React.cache) : la page
 * qui la recharge ne paie pas une seconde requête. Garde orga posée ici en plus
 * des pages (un layout ne se re-rend pas aux navigations client).
 */
export default async function ParticipanteLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ edition: string; registration: string }>;
}) {
  await requireOrgaId();
  const { edition, registration } = await params;
  const { editionId, registration: r } = await loadRegistrationOrNotFound(
    edition,
    registration,
  );
  const base = `/admin/tremplins/${editionId}/participantes`;

  return (
    <>
      <SetFilTail
        sectionLabel="Participantes"
        sectionHref={base}
        entiteNom={registrationLabel(r)}
        entiteHref={`${base}/${r.id}`}
        sousPages={PARTICIPANTE_SOUS_PAGES}
      />
      {children}
    </>
  );
}
