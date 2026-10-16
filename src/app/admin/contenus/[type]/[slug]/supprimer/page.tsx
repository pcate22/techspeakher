import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOrgaPage } from "@/lib/auth-guards";
import { getContenuBySlug } from "@/lib/contenus";
import Breadcrumb from "@/components/Breadcrumb";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import LienRetour from "@/components/LienRetour";
import { deleteContenuAction } from "../../../actions";

export const metadata: Metadata = {
  title: "Supprimer un contenu | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/** Zone danger : supprimer un contenu. Page dédiée mono-fonction (règle d'or). */
export default async function SupprimerContenuPage({
  params,
}: {
  params: Promise<{ type: string; slug: string }>;
}) {
  await requireOrgaPage();
  const { type, slug } = await params;
  if (type !== "publication" && type !== "page") notFound();
  const contenu = await getContenuBySlug(slug);
  if (!contenu || contenu.type !== type) notFound();

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Espace organisatrices", href: "/admin" },
          { label: "Contenus", href: "/admin/contenus" },
          { label: contenu.titre, href: `/admin/contenus/${contenu.type}/${contenu.slug}` },
          { label: "Supprimer" },
        ]}
      />
      <div className="py-10 px-4">
        <section className="max-w-2xl mx-auto flex flex-col gap-6" aria-labelledby="suppr-title">
          <div>
            <h1 id="suppr-title" className="text-2xl font-bold mb-2">
              <span className="text-magenta">Supprimer</span> {contenu.titre}
            </h1>
            <p className="text-sm text-gray-light">
              Retire définitivement ce contenu du site. À réserver aux doublons ou
              aux erreurs.
            </p>
          </div>

          <section aria-label="Zone danger" className="border border-orange/30 rounded-lg px-4 py-4">
            <form action={deleteContenuAction}>
              <input type="hidden" name="contenuId" value={contenu.id} />
              <input type="hidden" name="type" value={contenu.type} />
              <input type="hidden" name="slug" value={contenu.slug} />
              <ConfirmSubmitButton
                title={`Supprimer « ${contenu.titre} » ?`}
                message="Ce contenu sera retiré du site. Cette action est définitive."
                confirmLabel="Supprimer définitivement"
                pendingLabel="Suppression…"
                variant="danger"
                className="min-h-[44px]"
              >
                Supprimer ce contenu
              </ConfirmSubmitButton>
            </form>
          </section>

          <LienRetour
            href={`/admin/contenus/${contenu.type}/${contenu.slug}`}
            label="Retour au contenu"
          />
        </section>
      </div>
    </>
  );
}
