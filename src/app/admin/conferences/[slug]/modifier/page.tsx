import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireOrgaPage } from "@/lib/auth-guards";
import { getConferenceBySlugForAdmin } from "@/lib/conferences";
import Breadcrumb from "@/components/Breadcrumb";
import LienRetour from "@/components/LienRetour";
import InlineActionForm from "@/components/InlineActionForm";
import { updateConferenceAction } from "../../actions";

export const metadata: Metadata = {
  title: "Modifier une conférence | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/**
 * Corriger les informations d'UNE conférence. Un rôle, un CTA collant, reste EN
 * PLACE avec confirmation focalisée (redirige seulement si le nom — donc le slug
 * — change). La suppression est une action séparée (lien vers la zone danger).
 */
export default async function ModifierConferencePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireOrgaPage();
  const { slug } = await params;
  const conf = await getConferenceBySlugForAdmin(slug);
  if (!conf) notFound();

  const estAsso = conf.type === "asso";

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Espace organisatrices", href: "/admin" },
          { label: "Conférences", href: "/admin/conferences" },
          { label: conf.nom, href: `/admin/conferences/${conf.slug}` },
          { label: "Modifier" },
        ]}
      />
      <div className="py-10 px-4">
        <section className="max-w-2xl mx-auto" aria-labelledby="modifier-title">
          <h1 id="modifier-title" className="text-2xl font-bold mb-6">
            <span className="text-magenta">Modifier</span> {conf.nom}
          </h1>

          <InlineActionForm
            action={updateConferenceAction}
            hidden={{ conferenceId: conf.id, slug: conf.slug }}
            fields={[
              { kind: "input", name: "nom", label: "Nom", required: true, defaultValue: conf.nom },
              {
                kind: "select",
                name: "type",
                label: "Type",
                defaultValue: conf.type,
                options: [
                  { value: "conference", label: "Conférence" },
                  { value: "asso", label: "Association / communauté" },
                ],
              },
              { kind: "input", name: "ville", label: "Ville (optionnel)", defaultValue: conf.ville ?? "" },
              { kind: "input", name: "pays", label: "Pays (optionnel)", defaultValue: conf.pays ?? "" },
              { kind: "input", name: "siteUrl", label: "Site officiel (optionnel)", type: "url", placeholder: "https://…", defaultValue: conf.siteUrl ?? "" },
            ]}
            variant="primary"
            submitLabel="Enregistrer les modifications"
            pendingLabel="Enregistrement…"
            successMessage={`Les informations de « ${conf.nom} » sont enregistrées.`}
            stickySubmit
          />

          <p className="mt-8 pt-4 border-t border-navy-lighter">
            <Link
              href={`/admin/conferences/${conf.slug}/supprimer`}
              className="inline-flex items-center min-h-[44px] text-sm text-orange underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange rounded"
            >
              Supprimer cette {estAsso ? "association" : "conférence"}
            </Link>
          </p>

          <LienRetour
            href={`/admin/conferences/${conf.slug}`}
            label={`Retour à ${estAsso ? "l'association" : "la conférence"}`}
          />
        </section>
      </div>
    </>
  );
}
