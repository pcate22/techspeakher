import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireOrgaPage } from "@/lib/auth-guards";
import {
  getConferenceBySlugForAdmin,
  buildEditionLibelle,
  type AdminConference,
  type AdminEdition,
} from "@/lib/conferences";
import Breadcrumb from "@/components/Breadcrumb";
import ConfirmationBanner from "@/components/ConfirmationBanner";
import LienRetour from "@/components/LienRetour";

export const metadata: Metadata = {
  title: "Gérer une conférence | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/** Lien d'action (bouton discret, cible ≥ 44 px) vers une sous-page. */
function ActionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center min-h-[44px] rounded-lg border border-field-border bg-navy-light px-4 py-2 text-sm font-semibold text-cyan hover:bg-navy-lighter/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
    >
      {children}
    </Link>
  );
}

/** Une édition = un LIEN vers sa page éditable (moisson, correction, suppression). */
function EditionLien({ conf, e }: { conf: AdminConference; e: AdminEdition }) {
  const libelle = buildEditionLibelle({
    confNom: conf.nom, type: e.type, nom: e.nom, annee: e.annee, dateDebut: e.dateDebut,
  });
  const etat = e.endpoint
    ? e.actif
      ? "moisson active"
      : "moisson inactive"
    : "sans endpoint";
  return (
    <li>
      <Link
        href={`/admin/conferences/${conf.slug}/editions/${e.id}`}
        className="flex items-center justify-between gap-3 rounded-lg border border-navy-lighter bg-navy-light px-4 py-3 hover:bg-navy-lighter/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
      >
        <span className="text-sm text-white">
          {libelle}
          {e.lieu ? ` · ${e.lieu}` : ""}
          {e.proposeParCommunaute && (
            <span className="ml-2 inline-block rounded-full bg-cyan/15 text-cyan px-2 py-0.5 text-xs">
              ajoutée par la communauté
            </span>
          )}
        </span>
        <span className="text-xs text-cyan shrink-0">
          {etat} <span aria-hidden="true">→</span>
        </span>
      </Link>
    </li>
  );
}

/**
 * Page d'UNE conférence (aperçu). RÔLE UNIQUE : consulter l'état et choisir où
 * aller. Aucun formulaire ici : les éditions sont des liens vers leur page,
 * corriger / ajouter / supprimer sont des liens vers leurs sous-pages.
 */
export default async function AdminConferencePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ cree?: string; "edition-suppr"?: string; suppr?: string }>;
}) {
  await requireOrgaPage();
  const { slug } = await params;
  const sp = await searchParams;
  const conf = await getConferenceBySlugForAdmin(slug);
  if (!conf) notFound();

  const estAsso = conf.type === "asso";
  const confirmation = sp.cree
    ? `« ${conf.nom} » a été ajoutée à la référence.`
    : sp["edition-suppr"]
      ? "L'édition a été supprimée."
      : null;
  const echec =
    sp.suppr === "refus"
      ? `Impossible de supprimer « ${conf.nom} » : retire d'abord ses événements.`
      : null;

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Espace organisatrices", href: "/admin" },
          { label: "Conférences", href: "/admin/conferences" },
          { label: conf.nom },
        ]}
      />
      <div className="py-10 px-4">
        <section className="max-w-3xl mx-auto" aria-labelledby="conf-title">
          <header className="mb-8">
            <h1 id="conf-title" className="text-2xl font-bold mb-2">
              <span className="text-magenta">{conf.nom}</span>
            </h1>
            <p className="text-sm text-gray-light">
              {[conf.ville, conf.pays].filter(Boolean).join(" · ") || "Lieu non précisé"}
              {conf.siteUrl && (
                <>
                  {" · "}
                  <a
                    href={conf.siteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded"
                  >
                    Site officiel
                    <span className="sr-only"> de {conf.nom} (nouvelle fenêtre)</span>
                  </a>
                </>
              )}
            </p>
            {confirmation && <ConfirmationBanner message={confirmation} />}
            {echec && <ConfirmationBanner message={echec} ton="alerte" />}
          </header>

          <section aria-labelledby="editions-title" className="mb-8">
            <h2 id="editions-title" className="text-lg font-bold text-white mb-3">
              Événements{" "}
              <span className="text-gray-light font-normal">({conf.editions.length})</span>
            </h2>
            {conf.editions.length === 0 ? (
              <p className="text-sm text-gray-light mb-4">
                {estAsso
                  ? "Les meetups arrivent par la synchronisation quotidienne du Tech Hub."
                  : "Aucun événement daté pour l'instant."}
              </p>
            ) : (
              <ul className="flex flex-col gap-2 list-none mb-4">
                {conf.editions.map((e) => (
                  <EditionLien key={e.id} conf={conf} e={e} />
                ))}
              </ul>
            )}
            <ActionLink href={`/admin/conferences/${conf.slug}/editions/nouvelle`}>
              Ajouter une édition
            </ActionLink>
          </section>

          <section aria-labelledby="reglages-title" className="mb-10">
            <h2 id="reglages-title" className="text-lg font-bold text-white mb-3">
              Réglages
            </h2>
            <ActionLink href={`/admin/conferences/${conf.slug}/modifier`}>
              Modifier ou supprimer cette {estAsso ? "association" : "conférence"}
            </ActionLink>
          </section>

          <LienRetour href="/admin/conferences" label="Toutes les conférences" />
        </section>
      </div>
    </>
  );
}
