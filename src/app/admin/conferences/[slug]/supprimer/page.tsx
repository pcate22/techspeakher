import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOrgaPage } from "@/lib/auth-guards";
import { getConferenceBySlugForAdmin } from "@/lib/conferences";
import Breadcrumb from "@/components/Breadcrumb";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import LienRetour from "@/components/LienRetour";
import { deleteConferenceAction } from "../../actions";

export const metadata: Metadata = {
  title: "Supprimer une conférence | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/**
 * Zone danger : supprimer une conférence de la référence. Page dédiée
 * mono-fonction (miroir du retrait Tremplin). Refusée tant qu'un événement y
 * est rattaché (le bouton n'apparaît pas ; garde serveur en doublure).
 */
export default async function SupprimerConferencePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireOrgaPage();
  const { slug } = await params;
  const conf = await getConferenceBySlugForAdmin(slug);
  if (!conf) notFound();

  const estAsso = conf.type === "asso";
  const nbEditions = conf.editions.length;
  const mot = estAsso ? "association" : "conférence";

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Espace organisatrices", href: "/admin" },
          { label: "Conférences", href: "/admin/conferences" },
          { label: conf.nom, href: `/admin/conferences/${conf.slug}` },
          { label: "Supprimer" },
        ]}
      />
      <div className="py-10 px-4">
        <section className="max-w-2xl mx-auto flex flex-col gap-6" aria-labelledby="suppr-title">
          <div>
            <h1 id="suppr-title" className="text-2xl font-bold mb-2">
              <span className="text-magenta">Supprimer</span> {conf.nom}
            </h1>
            <p className="text-sm text-gray-light">
              Retire définitivement cette {mot} de la référence. À réserver aux
              doublons ou aux erreurs.
            </p>
          </div>

          <section aria-label="Zone danger" className="border border-orange/30 rounded-lg px-4 py-4">
            {nbEditions > 0 ? (
              <p className="text-sm text-gray-light">
                Cette {mot} a {nbEditions} événement{nbEditions > 1 ? "s" : ""}&nbsp;: retire-les
                d&apos;abord (depuis sa page) pour pouvoir la supprimer.
              </p>
            ) : (
              <form action={deleteConferenceAction}>
                <input type="hidden" name="conferenceId" value={conf.id} />
                <input type="hidden" name="slug" value={conf.slug} />
                <ConfirmSubmitButton
                  title={`Supprimer « ${conf.nom} » ?`}
                  message="Cette conférence sera retirée de la référence. Cette action est définitive."
                  confirmLabel="Supprimer définitivement"
                  pendingLabel="Suppression…"
                  variant="danger"
                  className="min-h-[44px]"
                >
                  {`Supprimer cette ${mot}`}
                </ConfirmSubmitButton>
              </form>
            )}
          </section>

          <LienRetour href={`/admin/conferences/${conf.slug}`} label={`Retour à ${estAsso ? "l'association" : "la conférence"}`} />
        </section>
      </div>
    </>
  );
}
