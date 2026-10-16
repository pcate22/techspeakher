import type { ReactNode } from "react";
import { requireOrgaId } from "@/lib/auth-guards";
import { loadAtelierOrNotFound } from "@/lib/tremplin-admin";
import SetFilTail from "../../FilContext";
import { ATELIER_SOUS_PAGES } from "../../fil-sous-pages";

/**
 * Layout d'un atelier : ajoute le fil de contexte manquant
 * (« Ateliers › {titre} › {sous-page} ») sous les pastilles de l'édition, comme
 * pour les participantes. `loadAtelierOrNotFound` est mémoïsé par requête.
 */
export default async function AtelierLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ edition: string; atelier: string }>;
}) {
  await requireOrgaId();
  const { edition, atelier } = await params;
  const { editionId, atelier: a } = await loadAtelierOrNotFound(edition, atelier);
  const base = `/admin/tremplins/${editionId}/ateliers`;

  return (
    <>
      <SetFilTail
        sectionLabel="Ateliers"
        sectionHref={base}
        entiteNom={a.titre}
        entiteHref={`${base}/${a.id}`}
        sousPages={ATELIER_SOUS_PAGES}
      />
      {children}
    </>
  );
}
