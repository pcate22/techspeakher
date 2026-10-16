import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOrgaPage } from "@/lib/auth-guards";
import Breadcrumb from "@/components/Breadcrumb";
import LienRetour from "@/components/LienRetour";
import InlineActionForm from "@/components/InlineActionForm";
import { createContenuAction } from "../../actions";

export const metadata: Metadata = {
  title: "Nouveau contenu | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/**
 * Création minimale d'un contenu (titre + chapô) → PRG vers son éditeur, où on
 * rédige le corps et on publie. Un rôle, un CTA collant. Le type (publication /
 * page) vient de l'URL, jamais saisi.
 */
export default async function NouveauContenuPage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  await requireOrgaPage();
  const { type } = await params;
  if (type !== "publication" && type !== "page") notFound();
  const estPub = type === "publication";

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Espace organisatrices", href: "/admin" },
          { label: "Contenus", href: "/admin/contenus" },
          { label: estPub ? "Nouvelle publication" : "Nouvelle page" },
        ]}
      />
      <div className="py-10 px-4">
        <section className="max-w-2xl mx-auto" aria-labelledby="nouveau-title">
          <h1 id="nouveau-title" className="text-2xl font-bold mb-2">
            <span className="text-magenta">
              {estPub ? "Nouvelle publication" : "Nouvelle page"}
            </span>
          </h1>
          <p className="text-sm text-gray-light mb-6">
            {estPub
              ? "Le titre et le chapô suffisent pour commencer. Tu rédigeras le contenu et publieras ensuite."
              : "Le titre et un court résumé pour commencer. Tu rédigeras la page ensuite."}
          </p>

          <InlineActionForm
            action={createContenuAction}
            hidden={{ type }}
            fields={[
              {
                kind: "input",
                name: "titre",
                label: "Titre",
                required: true,
                placeholder: estPub ? "Ex. Retour sur le meetup d'octobre" : "Ex. À propos",
              },
              {
                kind: "textarea",
                name: "chapo",
                label: estPub ? "Chapô (accroche)" : "Résumé",
                rows: 3,
                placeholder: estPub
                  ? "Une ou deux phrases qui donnent envie de lire. Sert aussi d'accroche sur LinkedIn et pour le référencement."
                  : "Une phrase qui décrit la page (référencement).",
              },
            ]}
            variant="primary"
            submitLabel={estPub ? "Créer la publication" : "Créer la page"}
            pendingLabel="Création…"
            stickySubmit
          />

          <div className="mt-8">
            <LienRetour href="/admin/contenus" label="Tous les contenus" />
          </div>
        </section>
      </div>
    </>
  );
}
