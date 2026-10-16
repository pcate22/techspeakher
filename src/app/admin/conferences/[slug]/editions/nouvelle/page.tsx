import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOrgaPage } from "@/lib/auth-guards";
import { getConferenceBySlugForAdmin } from "@/lib/conferences";
import Breadcrumb from "@/components/Breadcrumb";
import LienRetour from "@/components/LienRetour";
import InlineActionForm from "@/components/InlineActionForm";
import { createEditionAction } from "../../../actions";

export const metadata: Metadata = {
  title: "Ajouter une édition | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/** Créer une édition (événement daté) d'une conférence. Un rôle, un CTA collant. */
export default async function NouvelleEditionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireOrgaPage();
  const { slug } = await params;
  const conf = await getConferenceBySlugForAdmin(slug);
  if (!conf) notFound();

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Espace organisatrices", href: "/admin" },
          { label: "Conférences", href: "/admin/conferences" },
          { label: conf.nom, href: `/admin/conferences/${conf.slug}` },
          { label: "Ajouter une édition" },
        ]}
      />
      <div className="py-10 px-4">
        <section className="max-w-2xl mx-auto" aria-labelledby="ed-title">
          <h1 id="ed-title" className="text-2xl font-bold mb-2">
            <span className="text-magenta">Ajouter une édition</span>
          </h1>
          <p className="text-sm text-gray-light mb-6">
            À {conf.nom}. L&apos;année suffit&nbsp;: tu pourras compléter le reste
            plus tard, sur la page de l&apos;édition.
          </p>

          <InlineActionForm
            action={createEditionAction}
            hidden={{ conferenceId: conf.id, slug: conf.slug }}
            fields={[
              { kind: "input", name: "annee", label: "Année", type: "number", min: "1990", max: "2100", placeholder: "2026" },
              { kind: "input", name: "dateDebut", label: "Date de début (optionnel)", type: "date", clearable: true },
              { kind: "input", name: "dateFin", label: "Date de fin (si plusieurs jours, optionnel)", type: "date", clearable: true, hint: "Sur un événement multi-jours, un talk hérite du mois plutôt que d'un jour choisi au hasard." },
              { kind: "input", name: "ville", label: "Ville (si différente, optionnel)" },
              { kind: "input", name: "url", label: "Page de cette édition (optionnel)", type: "url", placeholder: "https://…" },
              { kind: "input", name: "endpoint", label: "Moisson Sessionize (optionnel)", hint: "Colle l'adresse de la page programme de la conférence (https://…) : l'id d'endpoint y est détecté. L'id seul marche aussi (la partie ID du motif sessionize.com/api/v2/ID). Testé à l'enregistrement." },
            ]}
            variant="primary"
            submitLabel="Ajouter l'édition"
            pendingLabel="Ajout…"
            stickySubmit
          />

          <div className="mt-8">
            <LienRetour href={`/admin/conferences/${conf.slug}`} label="Retour à la conférence" />
          </div>
        </section>
      </div>
    </>
  );
}
