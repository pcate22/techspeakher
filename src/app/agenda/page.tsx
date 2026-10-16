import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";
import PageHero from "@/components/PageHero";
import Button from "@/components/Button";
import LienTexte from "@/components/LienTexte";
import SceneCard from "@/components/SceneCard";
import TranchePeriode from "@/components/TranchePeriode";
import ArchiveLiens from "./ArchiveLiens";
import AgendaFiltres from "./AgendaFiltres";
import {
  getScenesHorizon,
  getAnneesArchive,
  getApercuPasse,
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

export const metadata: Metadata = {
  title: "Agenda des speakeuses tech | Tech Speak'Her",
  description:
    "Où les speakeuses de Tech Speak'Her prennent la parole : conférences, meetups et tables rondes à venir, toutes speakeuses confondues.",
  keywords: [
    "agenda speakeuses",
    "conférences femmes tech",
    "prochaines conférences tech",
    "meetup tech Toulouse",
    "speakeuses en conférence",
    "Tech Speak'Her",
  ],
  alternates: {
    canonical: "/agenda",
    // Le flux iCalendar de l'horizon (lot 4), déclaré comme `feed.xml` l'est
    // pour les actualités : un client de calendrier ou un agrégateur le trouve
    // sans qu'on le lui dise.
    types: { "text/calendar": "/agenda.ics" },
  },
  openGraph: {
    type: "website",
    title: "Agenda des speakeuses tech | Tech Speak'Her",
    description:
      "Les prochaines dates des speakeuses de Tech Speak'Her, toutes fiches confondues.",
    url: `${BASE_URL}/agenda`,
  },
};

// Rendu DYNAMIQUE, pour la même raison que l'annuaire : l'ISR figerait au build
// un agenda vide si la base est injoignable à cet instant — sur une page dont
// l'intérêt entier est d'être à jour.
export const dynamic = "force-dynamic";

/** Nombre d'interventions passées montrées en aperçu, sous l'horizon. */
const APERCU_PASSE = 3;

/**
 * Le fait que la page annonce. « Aucune intervention annoncée » à la forme
 * POSITIVE (jamais « il n'y a plus… ») : c'est ce que le résumé dit quand un
 * filtre ne ramène rien, et il nomme ensuite CE SUR QUOI il a filtré.
 */
function compteInterventions(n: number): string {
  if (n === 0) return "Aucune intervention annoncée";
  return `${nb(n, "intervention")} annoncée${n > 1 ? "s" : ""}`;
}

/**
 * L'AGENDA PUBLIC EST UN HORIZON, JAMAIS UNE ANNÉE.
 *
 * Décision du 2026-08-16 (docs/audit-ux-agenda-2026-08.md §8) : cette page
 * porte ce qui VIENT, en fenêtre glissante. Une page d'atterrissage calée sur
 * l'année civile se viderait en décembre, et ce défaut n'apparaîtrait qu'une
 * semaine par an — donc aucune revue ne le verrait passer.
 *
 * Le passé, lui, a sa propre surface : `/agenda/[annee]`, un compte rendu
 * FINI et citable. La mémoire y est COMPLÈTE — l'ancien plafond de douze
 * interventions en cachait les deux tiers sans le dire.
 *
 * L'aperçu du passé récent reste affiché EN PERMANENCE, même quand l'horizon
 * est bien rempli : c'est ce qui empêche la page d'être nue en creux de saison,
 * et c'est le sens de « glissant » — l'horizon glisse dans les deux sens.
 *
 * DEPUIS LE LOT 1, ELLE A UNE ENTRÉE (recherche + facettes, `AgendaFiltres`),
 * et cet état vit dans l'URL : `?q=`, `?ville=`, `?region=`, `?conference=`,
 * lus ICI, côté serveur. L'ANNÉE, elle, n'est pas une facette de plus — elle
 * sélectionne un AUTRE document (`/agenda/[annee]`), là où ces quatre-là
 * filtrent à l'intérieur de celui-ci (décision du 16/08, §8).
 *
 * Les métadonnées restent statiques, donc le `canonical` de toute vue filtrée
 * pointe la page nue : c'est le défaut retenu tant que la question « quelles
 * vues filtrées mérite-t-on d'indexer ? » reste ouverte (§8), et il évite
 * d'ouvrir à l'indexation la combinatoire des filtres.
 */
export default async function AgendaPublic({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filtres = lireFiltres(params);
  // L'ADRESSE SE RANGE AVANT TOUT AFFICHAGE. Un formulaire GET soumet tous ses
  // champs, donc filtrer sur une ville produisait
  // `?q=&ville=toulouse&region=&conference=` — et c'est cette adresse-là qu'une
  // visiteuse copie dans un message, alors que le lot pose que le lien partagé
  // est le produit. Une redirection, avant la moindre requête en base.
  const propre = adresseCanonique(params, filtres);
  if (propre !== null) redirect(propre ? `/agenda?${propre}` : "/agenda");

  const aujourdhui = aujourdhuiParis();
  // Résilient comme l'annuaire : base indisponible → page qui s'affiche, avec
  // son mot d'attente, plutôt qu'une erreur sur une page de visibilité.
  let aVenir: ScenePublique[] = [];
  let recentes: ScenePublique[] = [];
  let annees: AnneeArchive[] = [];
  try {
    [aVenir, recentes, annees] = await Promise.all([
      getScenesHorizon(aujourdhui),
      getApercuPasse(APERCU_PASSE, aujourdhui),
      getAnneesArchive(aujourdhui),
    ]);
  } catch (err) {
    console.error("Agenda public indisponible", err);
  }

  const totalArchive = annees.reduce((n, a) => n + a.nombre, 0);

  const actifs = filtresActifs(filtres);
  // Ce que l'aperçu du passé MONTRE vraiment — et la seule source de la phrase
  // qui l'annonce. Sur une vue filtrée il ne montre rien (un filtre gouverne la
  // page entière), et l'archive peut par ailleurs ne porter que des périodes
  // encore ouvertes. Faire lire la phrase ET la liste dans la MÊME valeur rend
  // la contradiction impossible plutôt que testée : la page a annoncé « Voici la
  // plus récente. » au-dessus de rien (constat de prod du 18/08).
  const apercu = actifs ? [] : recentes;
  // « à ce jour » n'appartient qu'à l'horizon nu : sur une vue filtrée, la
  // phrase se termine par ce sur quoi elle a filtré.
  const { facettes, affichees, resume } = vueFiltree(aVenir, filtres, (n) =>
    actifs ? compteInterventions(n) : `${compteInterventions(n)} à ce jour`,
  );

  // Ce que la page montre, dit aux moteurs : une liste d'événements datés,
  // chacun relié à la speakeuse qui le porte (§4.4 de l'audit). Seules les
  // dates EXACTES y entrent — reprendre « courant 2026 » inventerait un jour.
  //
  // RIEN SUR UNE VUE FILTRÉE, et c'est un correctif de revue (18/08) : son
  // `canonical` pointe la page nue, donc un balisage servi là prétendrait
  // décrire `/agenda` en n'y listant qu'une date sur quarante. Le document
  // décrit est la page nue ; c'est elle qui le déclare, en entier.
  const ld = actifs
    ? null
    : agendaItemList({
        scenes: affichees,
        url: `${BASE_URL}/agenda`,
        nom: `Les prochaines interventions des speakeuses de ${ASSOCIATION.nom}`,
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
      <Breadcrumb items={[{ label: "Accueil", href: "/" }, { label: "Agenda" }]} />
      <PageHero
        id="agenda-title"
        title={
          <>
            Nos speakeuses <span className="text-cyan">en scène</span>
          </>
        }
        subtitle="Les dates de la communauté, toutes speakeuses confondues. Chaque intervention mène à la fiche de celle qui la porte."
        padY="pt-8 pb-8 sm:pt-12 sm:pb-10"
      />

      <div className="mx-auto max-w-5xl px-4 pb-16">
        {/* L'entrée gouverne la PAGE, pas seulement la section : elle vit donc
            au-dessus des deux, et l'aperçu du passé s'y plie.
            Elle s'affiche aussi quand l'horizon est VIDE mais qu'un filtre est
            posé : sans ça, un lien partagé `?ville=toulouse` ouvert en creux de
            saison rendait une page sans commande, sans « Tout effacer » et sans
            aucun lien vers l'agenda nu — un cul-de-sac (revue du 18/08). */}
        {(aVenir.length > 0 || actifs) && (
          <AgendaFiltres action="/agenda" filtres={filtres} facettes={facettes} />
        )}
        {aVenir.length > 0 ? (
          <>
            <section aria-labelledby="a-venir-title" className="flex flex-col gap-8">
              <div>
                <h2 id="a-venir-title" className="text-2xl font-bold">
                  À venir
                </h2>
                {/* Un fait, énoncé en toutes lettres, et qui NOMME le filtre
                    actif. Il dit à la visiteuse ce qu'elle parcourt (la page
                    n'annonçait rien : on ignorait s'il restait deux dates ou
                    quarante), il donne une phrase que les moteurs de réponse
                    savent citer, et il est la région vivante d'un écran qui
                    filtre — sans le nom du filtre, deux filtres au même compte
                    rendraient le même texte, donc aucune annonce.
                    Il reste MONTÉ d'un filtre à l'autre : une région insérée
                    après coup n'est pas annoncée de façon fiable. */}
                <p
                  role="status"
                  aria-live="polite"
                  className="mt-1 text-sm text-gray-light"
                >
                  {resume}
                </p>
              </div>
              {affichees.length > 0 ? (
                grouperScenesParPeriode(affichees).map((t) => (
                  <TranchePeriode key={t.cle} tranche={t} zone="avenir" />
                ))
              ) : (
                <p className="text-gray-light">
                  Élargis ta recherche, ou efface tout pour retrouver toutes les
                  dates annoncées.
                </p>
              )}
            </section>
          </>
        ) : (
          <section
            aria-labelledby="a-venir-title"
            className="rounded-2xl border border-navy-lighter bg-navy-light p-6"
          >
            <h2 id="a-venir-title" className="text-lg font-bold">
              Les prochaines dates arrivent
            </h2>
            <p className="mt-2 text-sm text-gray-light">
              Dès qu&apos;une speakeuse annonce une conférence sur sa fiche, elle
              apparaît ici. En attendant, l&apos;annuaire dit qui parle de quoi.
            </p>
            <Button href="/speakeuses" variant="ghost" size="sm" className="mt-3 px-0">
              Voir l&apos;annuaire →
            </Button>
          </section>
        )}

        {/* APERÇU PERMANENT du passé, et la porte vers la mémoire complète.
            Il s'affiche même quand l'horizon est plein : sans lui, la page
            serait nue les semaines creuses, et l'archive resterait invisible. */}
        {totalArchive > 0 && (
          <section aria-labelledby="deja-title" className="mt-16 flex flex-col gap-6">
            <div>
              <h2 id="deja-title" className="text-2xl font-bold">
                Déjà en scène
              </h2>
              <p className="mt-1 text-sm text-gray-light">
                {nb(totalArchive, "intervention")} depuis {annees[annees.length - 1].annee}.{" "}
                {/* Les portes d'année restent, elles, même sous un filtre : une
                    année est un AUTRE document, et son compte reste celui de
                    l'année entière. (Pourquoi l'aperçu se vide, lui : voir
                    `apercu` plus haut.) */}
                {apercu.length === 0
                  ? "Chaque année garde son compte rendu complet."
                  : `Voici ${apercu.length > 1 ? "les plus récentes" : "la plus récente"}.`}
              </p>
            </div>
            {apercu.length > 0 && (
              <ul role="list" className="grid list-none grid-cols-1 gap-4 sm:grid-cols-2">
                {apercu.map((s) => (
                  <li key={s.occurrenceId}>
                    <SceneCard scene={s} headingLevel="h3" />
                  </li>
                ))}
              </ul>
            )}
            <div>
              <h3 className="mb-3 text-sm font-bold text-gold">
                Toute la mémoire de la communauté
              </h3>
              <ArchiveLiens annees={annees} />
            </div>
          </section>
        )}
      </div>

      <section className="bg-navy-light px-4 py-16" aria-labelledby="agenda-cta-title">
        <div className="mx-auto max-w-3xl text-center">
          <h2 id="agenda-cta-title" className="mb-4 text-2xl font-bold">
            Une date à annoncer&nbsp;?
          </h2>
          <p className="mb-6 text-gray-light">
            Annonce ta prochaine date depuis ton espace&nbsp;: elle rejoint cet
            agenda et ta fiche d&apos;annuaire.
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Button href="/mon-espace/talks">Gérer mes talks</Button>
            <Button href="/speakeuses" variant="secondary">
              Voir l&apos;annuaire
            </Button>
          </div>
          <p className="mt-6 text-sm text-gray-light">
            Vous organisez un événement et cherchez des intervenantes&nbsp;?{" "}
            <LienTexte href="/contact">Contactez-nous</LienTexte>
          </p>
          {/* Lot 4 : on s'abonne à des dates, on ne les recopie pas. Discret à
              dessein — la page garde UN CTA principal (« Gérer mes talks »), et
              ceci est un confort, pas une action de la visiteuse majoritaire. */}
          <p className="mt-2 text-sm text-gray-light">
            Suivre ces dates depuis votre agenda&nbsp;:{" "}
            <LienTexte href="/agenda.ics">
              s&apos;abonner au calendrier
              <span className="sr-only"> (fichier iCalendar)</span>
            </LienTexte>
          </p>
        </div>
      </section>
    </>
  );
}
