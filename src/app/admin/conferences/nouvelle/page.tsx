import type { Metadata } from "next";
import { requireOrgaPage } from "@/lib/auth-guards";
import Breadcrumb from "@/components/Breadcrumb";
import LienRetour from "@/components/LienRetour";
import InlineActionForm from "@/components/InlineActionForm";
import { createConferenceAction } from "../actions";

export const metadata: Metadata = {
  title: "Ajouter une conférence | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/**
 * Création d'une conférence ou d'une asso. Page dédiée, un rôle, un CTA collant.
 * Succès → PRG vers la page de la conférence créée.
 */
export default async function NouvelleConferencePage() {
  await requireOrgaPage();

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Espace organisatrices", href: "/admin" },
          { label: "Conférences", href: "/admin/conferences" },
          { label: "Ajouter" },
        ]}
      />
      <div className="py-10 px-4">
        <section className="max-w-2xl mx-auto" aria-labelledby="nouvelle-title">
          <h1 id="nouvelle-title" className="text-2xl font-bold mb-2">
            <span className="text-magenta">Ajouter une conférence</span>
          </h1>
          <p className="text-sm text-gray-light mb-6">
            Une conférence ou une communauté (association). Tu ajouteras ses éditions et
            l&apos;id de moisson ensuite, sur sa page.
          </p>

          <InlineActionForm
            action={createConferenceAction}
            fields={[
              { kind: "input", name: "nom", label: "Nom", required: true, placeholder: "Ex. DevFest Toulouse" },
              {
                kind: "select",
                name: "type",
                label: "Type",
                defaultValue: "conference",
                options: [
                  { value: "conference", label: "Conférence" },
                  { value: "asso", label: "Association / communauté" },
                ],
              },
              { kind: "input", name: "ville", label: "Ville (optionnel)" },
              { kind: "input", name: "pays", label: "Pays (optionnel)", defaultValue: "France" },
              { kind: "input", name: "siteUrl", label: "Site officiel (optionnel)", type: "url", placeholder: "https://…" },
            ]}
            variant="primary"
            submitLabel="Ajouter la conférence"
            pendingLabel="Ajout…"
            stickySubmit
          />

          <div className="mt-8">
            <LienRetour href="/admin/conferences" label="Toutes les conférences" />
          </div>
        </section>
      </div>
    </>
  );
}
