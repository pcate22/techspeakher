import Breadcrumb from "@/components/Breadcrumb";
import type { Metadata } from "next";
import Link from "next/link";
import ExternalLink from "@/components/ExternalLink";
import PageHero from "@/components/PageHero";
import { auth } from "@/auth";
import Button from "@/components/Button";
import ConfirmationBanner from "@/components/ConfirmationBanner";
import { listPublications, listContenus, type Contenu } from "@/lib/contenus";
import { toCarteActu } from "@/lib/carte-actu";
import { MEETUP_URL } from "@/constants/site";
import { seedContenusAction } from "@/app/admin/contenus/actions";
import ActualitesListe from "./ActualitesListe";

export const metadata: Metadata = {
  title: "Actualités | Tech Speak'Her Toulouse",
  description:
    "Tout ce qui se passe chez Tech Speak'Her : meetups, talks, interviews, Tremplin DevFest et communauté.",
  keywords: [
    "actualités Tech Speak'Her",
    "meetup tech Toulouse",
    "DevFest Toulouse",
    "conférences femmes tech",
    "interview speakeuse",
  ],
  alternates: { canonical: "/actualites" },
};

export const dynamic = "force-dynamic";

/**
 * Actualités : LA liste unique du site (« article = actualité »). Le public voit
 * le contenu publié ; une orga connectée voit en plus les brouillons, un filtre
 * de statut et les affordances d'ajout/édition (composant piloté par capacités).
 */
export default async function Actualites({
  searchParams,
}: {
  searchParams: Promise<{ importe?: string; supprime?: string }>;
}) {
  const session = await auth();
  const estOrga = !!session?.user?.isOrga;

  // Résilient : si la base est indisponible (ou pas encore migrée/seedée, ex. en
  // CI), on affiche la page avec une liste vide plutôt que de la faire planter.
  // Orga : tous statuts (pour voir/éditer les brouillons). Public : publiés seuls.
  let contenus: Contenu[] = [];
  try {
    contenus = estOrga ? await listContenus("publication") : await listPublications();
  } catch (err) {
    console.error("Actualités : base indisponible", err);
  }
  const cartes = contenus.map((c) => toCarteActu(c, estOrga));
  const sp = await searchParams;
  const importe = estOrga && sp.importe != null ? Number(sp.importe) : null;
  const supprime = estOrga && sp.supprime != null;

  return (
    <>
      <Breadcrumb items={[{ label: "Accueil", href: "/" }, { label: "Actualités" }]} />
      <PageHero
        id="actualites-title"
        title={<span className="text-cyan">Actualités</span>}
        subtitle="Meetups, talks, interviews, Tremplin : tout ce qui se passe chez Tech Speak'Her."
      />

      {importe != null && (
        <div className="max-w-4xl mx-auto px-4 pt-6">
          <ConfirmationBanner
            message={`${importe} actualité${importe > 1 ? "s" : ""} historique${importe > 1 ? "s" : ""} importée${importe > 1 ? "s" : ""} (hors flux RSS).`}
          />
        </div>
      )}

      {supprime && (
        <div className="max-w-4xl mx-auto px-4 pt-6">
          <ConfirmationBanner message="Contenu supprimé." />
        </div>
      )}

      {estOrga && cartes.length === 0 && (
        <section className="max-w-4xl mx-auto px-4 pt-6" aria-label="Importer l'historique">
          <div className="rounded-xl border border-navy-lighter bg-navy-light/60 p-5">
            <p className="text-sm text-gray-light mb-3">
              Importer les anciennes actualités du site (elles resteront{" "}
              <strong className="text-white">hors</strong> du flux RSS, donc pas de
              republication LinkedIn). Rejouable sans risque.
            </p>
            <form action={seedContenusAction}>
              <Button type="submit" size="sm">
                Importer les anciennes actualités
              </Button>
            </form>
          </div>
        </section>
      )}

      <ActualitesListe items={cartes} estOrga={estOrga} />

      <section className="py-8 px-4" aria-label="Liens utiles">
        <div className="text-center space-y-3">
          <ExternalLink
            href={MEETUP_URL}
            className="block text-sm text-cyan hover:text-cyan-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded transition-colors"
          >
            Voir tous les meetups GDG Toulouse sur Meetup.com &rarr;
          </ExternalLink>
          <p className="text-sm text-gray-light">
            Nos événements sont régis par un{" "}
            <Link
              href="/code-de-conduite"
              className="text-cyan hover:text-cyan-light underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded transition-colors"
            >
              code de conduite
            </Link>
            .
          </p>
        </div>
      </section>
    </>
  );
}
