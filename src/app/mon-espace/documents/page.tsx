import type { Metadata } from "next";
import Breadcrumb from "@/components/Breadcrumb";
import DocList from "@/components/DocList";
import ListPageTemplate from "@/components/ListPageTemplate";
import { requireUserId } from "@/lib/auth-guards";
import { getEditionsForUser } from "@/lib/tremplin-registrations";
import {
  getMyDocuments,
  getSharedDocumentsVisiblesPour,
} from "@/lib/tremplin-documents";

export const metadata: Metadata = {
  title: "Mes documents | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/**
 * MES DOCUMENTS (onglet, refonte §11) : tout ce qui est documentaire, toutes
 * éditions confondues — mes retours privés (jury, vidéos, notes) et les
 * ressources partagées de chaque édition. Consultation pure, zéro action.
 *
 * RGPD : les documents privés viennent de `getMyDocuments` (joint par
 * l'inscription de la personne connectée) ; les partagés passent par la garde
 * de visibilité (`getSharedDocumentsVisiblesPour`) — un support d'atelier
 * restreint reste invisible ici comme dans l'espace de l'édition.
 */
export default async function MesDocuments() {
  const uid = await requireUserId();

  const editions = await getEditionsForUser(uid);
  const parEdition = (
    await Promise.all(
      editions.map(async (e) => {
        const [miens, partages] = await Promise.all([
          getMyDocuments(uid, e.editionId),
          // Repli, comme partout ailleurs dans le dépôt : la garde de visibilité
          // dépend de `audience` (migration 051) et des phases (025). Une
          // migration en attente ferait tomber TOUT l'onglet, y compris les
          // ressources générales — alors qu'un repli vide ne montre rien de trop.
          getSharedDocumentsVisiblesPour(uid, e.editionId).catch((err) => {
            console.error("Ressources partagées indisponibles (migration 051 ?)", err);
            return [];
          }),
        ]);
        return { ...e, blocs: [
          { titre: "Mes retours", docs: miens, cls: "text-gold" },
          { titre: "Ressources partagées", docs: partages, cls: "text-gray-light" },
        ].filter((b) => b.docs.length > 0) };
      }),
    )
  ).filter((e) => e.blocs.length > 0);

  return (
    <>
      <Breadcrumb
        items={[{ label: "Mon espace", href: "/mon-espace" }, { label: "Mes documents" }]}
      />
      <ListPageTemplate
        title="Mes documents"
        meta="Tes retours et les ressources de tes éditions, au même endroit."
      >
        {parEdition.length === 0 ? (
          <p className="text-sm text-gray-light">
            Tes documents apparaîtront ici : supports d&apos;atelier, retour du
            jury, vidéos de pitch.
          </p>
        ) : (
          parEdition.map((e) => (
            <section
              key={e.editionId}
              aria-labelledby={`docs-ed-${e.editionId}`}
              className="rounded-2xl border border-navy-lighter bg-navy-light p-5"
            >
              <h2 id={`docs-ed-${e.editionId}`} className="text-base font-bold">
                {e.nom}
              </h2>
              {e.blocs.map((b) => (
                <div key={b.titre}>
                  <h3 className={`text-xs font-bold uppercase tracking-wider mt-4 ${b.cls}`}>
                    {b.titre}
                  </h3>
                  <DocList docs={b.docs} />
                </div>
              ))}
            </section>
          ))
        )}
      </ListPageTemplate>
    </>
  );
}
