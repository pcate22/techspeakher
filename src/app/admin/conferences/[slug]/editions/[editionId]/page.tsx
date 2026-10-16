import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOrgaPage } from "@/lib/auth-guards";
import { getEditionByIdForAdmin, buildEditionLibelle } from "@/lib/conferences";
import Breadcrumb from "@/components/Breadcrumb";
import LienRetour from "@/components/LienRetour";
import ConfirmationBanner from "@/components/ConfirmationBanner";
import InlineActionForm from "@/components/InlineActionForm";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import MoissonToggle from "../../../MoissonToggle";
import { updateEditionAction, deleteEditionAction } from "../../../actions";

export const metadata: Metadata = {
  title: "Modifier une édition | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/**
 * Page éditable d'UNE édition : corriger ses champs (pré-remplis), activer la
 * moisson, la supprimer. Un rôle (gérer cette édition), CTA collant, reste EN
 * PLACE. Fini le « retaper l'année pour corriger ».
 */
export default async function EditionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; editionId: string }>;
  searchParams: Promise<{ cree?: string }>;
}) {
  await requireOrgaPage();
  const { slug, editionId } = await params;
  const cree = (await searchParams).cree;
  const ed = await getEditionByIdForAdmin(Number(editionId));
  // Cohérence de l'URL : l'édition doit bien appartenir à la conf du slug.
  if (!ed || ed.confSlug !== slug) notFound();

  const libelle = buildEditionLibelle({
    confNom: ed.confNom,
    type: ed.type,
    nom: ed.nom,
    annee: ed.annee,
    dateDebut: ed.dateDebut,
  });

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Espace organisatrices", href: "/admin" },
          { label: "Conférences", href: "/admin/conferences" },
          { label: ed.confNom, href: `/admin/conferences/${ed.confSlug}` },
          { label: libelle },
        ]}
      />
      <div className="py-10 px-4">
        <section className="max-w-2xl mx-auto flex flex-col gap-8" aria-labelledby="ed-title">
          <div>
            <h1 id="ed-title" className="text-2xl font-bold">
              <span className="text-magenta">{libelle}</span>
            </h1>
            {cree && <ConfirmationBanner message="L'édition a été ajoutée. Complète-la si besoin." />}
          </div>

          <InlineActionForm
            action={updateEditionAction}
            hidden={{ editionId: ed.id, conferenceId: ed.conferenceId, slug: ed.confSlug }}
            fields={[
              { kind: "input", name: "annee", label: "Année", type: "number", min: "1990", max: "2100", defaultValue: ed.annee != null ? String(ed.annee) : "" },
              { kind: "input", name: "dateDebut", label: "Date de début (optionnel)", type: "date", clearable: true, defaultValue: ed.dateDebut ?? "" },
              { kind: "input", name: "dateFin", label: "Date de fin (si plusieurs jours, optionnel)", type: "date", clearable: true, defaultValue: ed.dateFin ?? "", hint: "Sur un événement multi-jours, un talk hérite du mois plutôt que d'un jour choisi au hasard." },
              { kind: "input", name: "ville", label: "Ville (si différente, optionnel)", defaultValue: ed.ville ?? "" },
              { kind: "input", name: "url", label: "Page de cette édition (optionnel)", type: "url", placeholder: "https://…", defaultValue: ed.url ?? "" },
              { kind: "input", name: "endpoint", label: "Moisson Sessionize (optionnel)", defaultValue: ed.endpoint ?? "", hint: "Colle l'adresse de la page programme de la conférence (https://…) : l'id d'endpoint y est détecté. L'id seul marche aussi (la partie ID du motif sessionize.com/api/v2/ID). Testé à l'enregistrement." },
            ]}
            variant="primary"
            submitLabel="Enregistrer l'édition"
            pendingLabel="Enregistrement…"
            successMessage="L'édition est enregistrée."
            stickySubmit
          />

          <section aria-labelledby="moisson-title" className="border-t border-navy-lighter pt-5">
            <h2 id="moisson-title" className="text-sm font-bold text-white mb-2">
              Moisson
            </h2>
            {ed.endpoint ? (
              <MoissonToggle editionId={ed.id} actif={ed.actif} nomConf={ed.confNom} />
            ) : (
              <p className="text-sm text-gray-light">
                Renseigne le champ « Moisson Sessionize » ci-dessus pour pouvoir activer la moisson.
              </p>
            )}
          </section>

          <section aria-label="Zone danger" className="border border-orange/30 rounded-lg px-4 py-4">
            <form action={deleteEditionAction}>
              <input type="hidden" name="editionId" value={ed.id} />
              <input type="hidden" name="slug" value={ed.confSlug} />
              <ConfirmSubmitButton
                title={`Supprimer l'édition « ${libelle} » ?`}
                message="Cette édition sera retirée. Les talks qui y étaient reliés gardent leur libellé. Action définitive."
                confirmLabel="Supprimer définitivement"
                pendingLabel="Suppression…"
                variant="danger"
                className="min-h-[44px]"
              >
                Supprimer cette édition
              </ConfirmSubmitButton>
            </form>
          </section>

          <LienRetour href={`/admin/conferences/${ed.confSlug}`} label="Retour à la conférence" />
        </section>
      </div>
    </>
  );
}
