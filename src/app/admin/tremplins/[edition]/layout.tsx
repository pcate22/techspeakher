import type { ReactNode } from "react";
import { requireOrgaId } from "@/lib/auth-guards";
import { loadEditionOrNotFound } from "@/lib/tremplin-admin";
import EditionSousNav from "./EditionSousNav";
import { FilProvider } from "./FilContext";

/**
 * Layout du sous-arbre d'une édition (lot C3) : fil d'Ariane raciné + pastilles
 * de section au-dessus de chaque page. L'édition est chargée via
 * `loadEditionOrNotFound`, mémoïsé par requête (`React.cache`) — la page qui la
 * recharge ne coûte pas une seconde requête SQL. La garde orga est posée ICI
 * EN PLUS de chaque page : un layout ne se re-rend pas aux navigations client
 * entre ses enfants (la garde des pages reste nécessaire), mais sans elle un
 * compte connecté non orga pourrait sonder l'existence d'éditions en
 * préparation (404 vs redirection), et un futur `loading.tsx` ferait fuiter
 * le nom d'édition avant la redirection de la page.
 */
export default async function EditionLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ edition: string }>;
}) {
  await requireOrgaId();
  const { editionId, edition } = await loadEditionOrNotFound((await params).edition);
  return (
    <FilProvider>
      <EditionSousNav editionId={editionId} editionNom={edition.nom} />
      {children}
    </FilProvider>
  );
}
