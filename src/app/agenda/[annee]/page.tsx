import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";
import PageHero from "@/components/PageHero";
import Button from "@/components/Button";
import TranchePeriode from "@/components/TranchePeriode";
import ArchiveLiens from "../ArchiveLiens";
import AgendaFiltres from "../AgendaFiltres";
import {
  getScenesDeLAnnee,
  getAnneesArchive,
  grouperScenesParPeriode,
  type ScenePublique,
  type AnneeArchive,
} from "@/lib/agenda-public";
import {
  adresseCanonique,
  filtresActifs,
  lireFiltres,
  vueFiltree,
} from "@/lib/agenda-filtres";
import { aujourdhuiParis } from "@/lib/tremplin-statut";
import { nb } from "@/lib/format";
import { agendaItemList } from "@/lib/agenda-jsonld";
import { ASSOCIATION } from "@/data/association";
import { BASE_URL } from "@/constants/site";

type Params = { annee: string };

/**
 * LE COMPTE RENDU D'UNE ANNÉE — l'autre moitié de la décision du 2026-08-16.
 *
 * `/agenda` est un HORIZON glissant ; cette page-ci est un DOCUMENT. Une année
 * révolue est finie, stable et citable, ce qu'une page glissante ne sera
 * jamais — et c'est exactement ce qu'un moteur de réponse sait reprendre.
 *
 * Elle porte la MÉMOIRE COMPLÈTE : rien n'est plafonné, rien n'est masqué en
 * silence. L'ancien `maxPassees = 12` cachait les deux tiers de l'archive du
 * décor d'audit sans le dire.
 *
 * AUCUN SEUIL de publication : une année existe dès UNE intervention. Le passé
 * se remplit à retardement, à mesure que les speakeuses complètent leur fiche.
 * Le remède maison contre les pages creuses n'a jamais été de les cacher, mais
 * de taire les compteurs vides (`aDesChiffresAAfficher`) — ici, il n'y a rien à
 * taire : s'il y a une ligne, il y a une page.
 */

/** Bornes de plausibilité : au-delà, l'URL est une saisie au hasard. */
function parseAnnee(valeur: string): number | null {
  if (!/^\d{4}$/.test(valeur)) return null;
  const n = Number(valeur);
  return n >= 2000 && n <= 2100 ? n : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const annee = parseAnnee((await params).annee);
  if (annee === null) return {};
  const titre = `Les speakeuses en scène en ${annee} | Tech Speak'Her`;
  return {
    title: titre,
    description: `Les interventions des speakeuses de Tech Speak'Her en ${annee} : conférences, meetups et tables rondes, toutes speakeuses confondues.`,
    // Chaque année porte SON adresse : c'est ce qui la rend partageable et
    // indexable, et c'est la raison d'être de cette surface.
    alternates: { canonical: `/agenda/${annee}` },
    openGraph: {
      type: "website",
      title: titre,
      url: `${BASE_URL}/agenda/${annee}`,
    },
  };
}

// Dynamique comme l'horizon : une année révolue est stable d'ADRESSE, pas figée
// de CONTENU. Une contribution ajoutée six mois après coup doit apparaître —
// sinon la mémoire complète serait complète le jour de la publication, et
// fausse ensuite.
export const dynamic = "force-dynamic";

export default async function AgendaAnnee({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  /**
   * Les mêmes facettes que l'horizon, sur l'autre surface (décision du 16/08,
   * §8 : l'année sélectionne un document, ville et conférence filtrent DEDANS).
   * Un filtre qui ne ramène rien ne ferme PAS la page : le document existe, il
   * n'a simplement rien à Lyon cette année-là. Seule une année VIDE ferme.
   */
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const annee = parseAnnee((await params).annee);
  if (annee === null) notFound();
  const requete = await searchParams;
  const filtres = lireFiltres(requete);
  // Même rangement d'adresse que l'horizon, et pour la même raison : ce qu'on
  // copie dans un message doit être `?ville=toulouse`, pas les quatre champs du
  // formulaire dont trois sont vides.
  const propre = adresseCanonique(requete, filtres);
  if (propre !== null) {
    redirect(propre ? `/agenda/${annee}?${propre}` : `/agenda/${annee}`);
  }

  const aujourdhui = aujourdhuiParis();
  let scenes: ScenePublique[] = [];
  let annees: AnneeArchive[] = [];
  try {
    [scenes, annees] = await Promise.all([
      getScenesDeLAnnee(annee),
      getAnneesArchive(aujourdhui),
    ]);
  } catch (err) {
    console.error("Archive de l'agenda indisponible", err);
  }

  // Une année sans la moindre intervention n'a rien à raconter : mieux vaut une
  // porte fermée qu'une page qui laisse croire à un trou dans la mémoire.
  if (scenes.length === 0) notFound();

  const enCours = annee === Number(aujourdhui.slice(0, 4));

  const actifs = filtresActifs(filtres);
  const { facettes, affichees, resume } = vueFiltree(scenes, filtres, (n) =>
    // L'ANNÉE dans les deux cas : « Aucune intervention » tout court perdait le
    // seul mot qui situe la page (revue du 18/08), sur la surface dont le rôle
    // entier est d'être le document citable d'une année.
    n === 0
      ? `Aucune intervention en ${annee}`
      : `${nb(n, "intervention")} en ${annee}`,
  );

  // Une année révolue est le document le plus citable de l'agenda : c'est
  // celle-là qu'un moteur de réponse peut reprendre sans risque de péremption.
  // Une vue FILTRÉE n'en déclare rien : son `canonical` pointe l'année nue, un
  // balisage tronqué servi là décrirait ce document sans en être un.
  const ld = actifs
    ? null
    : agendaItemList({
        scenes: affichees,
        url: `${BASE_URL}/agenda/${annee}`,
        nom: `Les interventions des speakeuses de ${ASSOCIATION.nom} en ${annee}`,
      });

  return (
    <>
      {ld && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(ld).replace(/</g, "\\u003c"),
          }}
        />
      )}
      <Breadcrumb
        items={[
          { label: "Accueil", href: "/" },
          { label: "Agenda", href: "/agenda" },
          { label: String(annee) },
        ]}
      />
      <PageHero
        id="annee-title"
        title={
          <>
            En scène en <span className="text-cyan">{annee}</span>
          </>
        }
        subtitle={
          // Le COMPTE vit sous la barre de filtres, en région vivante : il y
          // suit ce que la page affiche vraiment. Le répéter ici en donnerait
          // deux, et le second mentirait dès le premier filtre.
          enCours
            ? "L'année court encore : cette page continue de se remplir."
            : "Le compte rendu de ce que la communauté a porté cette année-là."
        }
        padY="pt-8 pb-8 sm:pt-12 sm:pb-10"
      />

      <div className="mx-auto max-w-5xl px-4 pb-16">
        <AgendaFiltres
          action={`/agenda/${annee}`}
          filtres={filtres}
          facettes={facettes}
        />
        <section aria-labelledby="annee-liste-title" className="flex flex-col gap-8">
          <h2 id="annee-liste-title" className="sr-only">
            Les interventions de {annee}
          </h2>
          {/* Le compte de la page, et le nom du filtre actif. Monté en
              permanence, il annonce chaque changement de filtre (leçon écrite
              dans `LiveStatus` : une région insérée après coup se tait). */}
          <p role="status" aria-live="polite" className="text-sm text-gray-light">
            {resume}
          </p>
          {affichees.length > 0 ? (
            grouperScenesParPeriode(affichees).map((t) => (
              <TranchePeriode key={t.cle} tranche={t} zone="annee" />
            ))
          ) : (
            <p className="text-gray-light">
              Élargis ta recherche, ou efface tout pour retrouver tout ce que{" "}
              {annee} a porté.
            </p>
          )}
        </section>

        <section aria-labelledby="autres-annees-title" className="mt-16">
          <h2
            id="autres-annees-title"
            className="mb-3 text-sm font-bold text-gold"
          >
            Les autres années
          </h2>
          <ArchiveLiens annees={annees} actuelle={annee} />
          <Button href="/agenda" variant="ghost" size="sm" className="mt-4 px-0">
            Voir les dates à venir →
          </Button>
        </section>
      </div>
    </>
  );
}
