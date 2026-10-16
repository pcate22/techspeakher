import type { ReactNode } from "react";
import { requireOrgaId } from "@/lib/auth-guards";
import { loadRecompenseOrNotFound } from "@/lib/tremplin-admin";
import SetFilTail from "../../FilContext";
import { RECOMPENSE_SOUS_PAGES } from "../../fil-sous-pages";

/**
 * Layout d'une récompense : alimente le fil unique de l'édition
 * (« Récompenses › {intitulé} › {sous-page} »). Loader mémoïsé par requête ;
 * garde orga posée ici en plus des pages.
 */
export default async function RecompenseLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ edition: string; recompense: string }>;
}) {
  await requireOrgaId();
  const { edition, recompense } = await params;
  const { editionId, recompense: rec } = await loadRecompenseOrNotFound(
    edition,
    recompense,
  );
  const base = `/admin/tremplins/${editionId}/recompenses`;

  return (
    <>
      <SetFilTail
        sectionLabel="Récompenses"
        sectionHref={base}
        entiteNom={rec.intitule}
        entiteHref={`${base}/${rec.id}`}
        sousPages={RECOMPENSE_SOUS_PAGES}
      />
      {children}
    </>
  );
}
