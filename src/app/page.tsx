import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Button from "@/components/Button";
import CarteActualite from "@/components/CarteActualite";
import StickyNote from "@/components/StickyNote";
import SceneCard from "@/components/SceneCard";
import { listPublicationsRecentes, type Contenu } from "@/lib/contenus";
import { toCarteActu } from "@/lib/carte-actu";
import { verbatims } from "@/data/verbatims";
import CarrouselVerbatims from "@/components/CarrouselVerbatims";
import { countPublishedProfiles } from "@/lib/profiles";
import {
  getScenesPubliques,
  prochainesScenesExtrait,
  separerScenes,
  type ScenePublique,
} from "@/lib/agenda-public";
import { getNouvellesVenues, type NouvelleVenue } from "@/lib/fil-communaute";
import CarteNouvelleVenue from "@/components/CarteNouvelleVenue";
import { aujourdhuiParis } from "@/lib/tremplin-statut";

export const metadata: Metadata = {
  title: "Tech Speak'Her | Une communauté de femmes de la tech pour oser passer de la salle à la scène",
  description:
    "Tech Speak'Her est une communauté toulousaine de femmes dans la tech. Meetups, conférences, talks, Tremplin DevFest Toulouse 2026. Rejoignez-nous pour oser prendre la parole\u00A0!",
  keywords: [
    "Tech Speak'Her",
    "femmes tech Toulouse",
    "speakeuses conférences",
    "DevFest Toulouse",
    "GDG Toulouse",
    "women in tech",
    "meetup tech Toulouse",
    "prise de parole",
    "tremplin speakeuse",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Tech Speak'Her | De la salle à la scène",
    description:
      "Une communauté de femmes de la tech pour oser passer de la salle à la scène. Meetups, conférences, talks et Tremplin DevFest Toulouse.",
    type: "website",
  },
};

const hashtags = [
  { text: "#talks", color: "text-cyan", position: "top-20 left-[10%]" },
  { text: "#meetup", color: "text-magenta", position: "top-32 left-[5%]" },
  { text: "#women", color: "text-orange", position: "top-16 right-[8%]" },
  { text: "#conférences", color: "text-cyan", position: "top-36 right-[12%]" },
  { text: "#oser", color: "text-magenta", position: "bottom-40 left-[15%]" },
];

// Le chiffre « speakeuses dans l'annuaire » est LIVE. Rendu dynamique (comme
// l'annuaire) : évite qu'un build sans base fige un compte faux/à zéro.
export const dynamic = "force-dynamic";

/** Cartes d'actualités sur l'accueil (une rangée de la grille à 4 colonnes). */
const ACTUS_ACCUEIL = 4;

export default async function Home() {
  // Lectures indépendantes, lancées ensemble (le pool en sert 3 à la fois, cf.
  // `lib/db.ts` : la 4ᵉ attend une connexion libre). Chacune dégrade SEULE :
  // base indisponible → le chiffre disparaît (jamais un nombre faux), l'agenda
  // disparaît (jamais une date inventée), les actualités disparaissent (jamais
  // un contenu périmé), la home reste.
  const [speakerCount, scenes, venues, publications] = await Promise.all([
    countPublishedProfiles().catch((err) => {
      console.error("Compte des speakeuses indisponible", err);
      return null;
    }),
    getScenesPubliques().catch((err) => {
      console.error("Agenda public indisponible", err);
      return [] as ScenePublique[];
    }),
    getNouvellesVenues().catch((err) => {
      console.error("Nouvelles venues indisponibles", err);
      return [] as NouvelleVenue[];
    }),
    listPublicationsRecentes(ACTUS_ACCUEIL).catch((err) => {
      console.error("Actualités indisponibles", err);
      return [] as Contenu[];
    }),
  ]);
  // Les actualités de l'accueil viennent de la MÊME table que `/actualites` et
  // passent par le MÊME mapping : une carte mène au même endroit sur les deux
  // pages. L'extrait garde les plus récentes ; la liste complète vit sur
  // `/actualites`. `estOrga` est false ici : l'accueil ne porte pas d'édition.
  const actualites = publications.map((c) => toCarteActu(c, false));
  // L'extrait de la home montre CE QUI VIENT (3 dates) ; l'agenda complet, avec
  // le passé récent, vit sur /agenda. Quand plusieurs scènes se disputent la
  // dernière place (même date), l'extrait tourne d'un jour civil sur l'autre :
  // sans ça, le départage alphabétique de `separerScenes` figerait toujours
  // les mêmes noms en tête d'un extrait tronqué.
  const aujourdhui = aujourdhuiParis();
  const prochainesScenes = prochainesScenesExtrait(
    separerScenes(scenes, aujourdhui).aVenir,
    aujourdhui,
    3,
  );

  const stats = [
    {
      value: "17\u00A0%",
      label: "de femmes dans les métiers tech en France",
      color: "text-magenta",
    },
    speakerCount != null
      ? {
          value: String(speakerCount),
          label: "speakeuses dans l'annuaire",
          color: "text-cyan",
          href: "/speakeuses",
        }
      : null,
    {
      value: "Toulouse",
      label: "une scène tech qui compte",
      color: "text-orange",
    },
  ].filter((s): s is { value: string; label: string; color: string; href?: string } => s != null);

  return (
    <>
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 sm:py-32 px-4" aria-labelledby="hero-title">
        {/* Floating hashtags — décoratifs */}
        {hashtags.map((h) => (
          <span
            key={h.text}
            className={`hidden lg:block absolute ${h.position} ${h.color} font-medium italic text-sm`}
            aria-hidden="true"
          >
            {h.text}
          </span>
        ))}

        <div className="max-w-4xl mx-auto text-center">
          <h1 id="hero-title" className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-wider mb-6">
            <span className="text-cyan">TECH SPEAK&apos;HER</span>
          </h1>

          <p className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-2">
            Une communauté de{" "}
            <span className="text-magenta">FEMMES</span>{" "}
            <br className="sm:hidden" />de la tech
          </p>
          <p className="text-lg sm:text-xl text-gray-light mb-2">
            pour{" "}
            <span className="font-extrabold text-magenta">OSER</span>{" "}
            passer de la salle…
          </p>
          <p className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-magenta mb-12">
            … à la scène&nbsp;!
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button href="/mon-espace">
              Rejoindre l&apos;annuaire des speakeuses
            </Button>
            <Button href="/a-propos" variant="secondary">
              Découvrir la communauté
            </Button>
          </div>
        </div>

        {/* Mascot — déborde volontairement (cf. tokens.layout.rules.mascot_breaks_frame) */}
        <Image
          src="/tsh_mascot.png"
          alt=""
          aria-hidden="true"
          width={1872}
          height={1600}
          className="hidden md:block absolute bottom-0 right-[-3%] w-[240px] lg:w-[300px] xl:w-[340px] h-auto -z-0 pointer-events-none select-none rotate-[12deg]"
        />

        <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-magenta/5 rounded-full blur-3xl" />
          <div className="absolute top-1/3 left-1/4 w-[400px] h-[400px] bg-cyan/5 rounded-full blur-3xl" />
        </div>
      </section>

      {/* Chiffres clés */}
      <section className="bg-navy-light py-6 border-y border-navy-lighter" aria-label="Chiffres clés">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row justify-center items-center gap-6 sm:gap-12 text-center">
          {stats.map((stat, i) => {
            const inner = (
              <>
                <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-sm text-gray-light">{stat.label}</p>
              </>
            );
            return (
              <div key={stat.label} className="contents">
                {i > 0 && (
                  <div className="hidden sm:block w-px h-10 bg-navy-lighter" aria-hidden="true" />
                )}
                {stat.href ? (
                  // Le chiffre-clé mène à l'annuaire (forte valeur pour l'extérieur).
                  <Link
                    href={stat.href}
                    className="group rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
                  >
                    <p className={`text-3xl font-bold ${stat.color} group-hover:text-cyan-light transition-colors`}>
                      {stat.value}
                    </p>
                    <p className="text-sm text-gray-light group-hover:text-white transition-colors">
                      {stat.label}
                    </p>
                  </Link>
                ) : (
                  <div>{inner}</div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Elles en parlent mieux que nous — la parole des personnes concernées,
          juste après les chiffres : le constat (17 % de femmes dans la tech)
          puis ce que ça change, dit par celles qui sont passées par le
          Tremplin. Aucun lien dans ce bloc : c'est une preuve, pas une porte de
          sortie (le CTA Tremplin vit plus bas, seul de son espèce). */}
      <section className="py-16 px-4" aria-labelledby="verbatims-title">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8 text-center">
            <h2 id="verbatims-title" className="text-3xl font-bold">
              Elles en parlent <span className="text-magenta">mieux que nous</span>
            </h2>
            <p className="text-gray-light mt-1">
              Ce qu&apos;en disent les participantes et les jurées du premier Tremplin.
            </p>
          </div>
          <CarrouselVerbatims
            verbatims={verbatims}
            libelle="Verbatims du premier Tremplin Tech Speak'Her"
          />
        </div>
      </section>

      {/* Bientôt en scène — un bloc VIVANT de la home : il vient des fiches
          des speakeuses, pas d'un contenu rédigé. Placé juste après les chiffres,
          il les prouve : « 12 speakeuses » devient « et voilà où elles parlent ».
          Absent quand aucune date n'est annoncée : mieux vaut rien qu'un cadre
          vide, et jamais une date passée sous un titre « bientôt ». */}
      {prochainesScenes.length > 0 && (
        <section className="py-16 px-4" aria-labelledby="scene-title">
          <div className="max-w-6xl mx-auto">
            <div className="mb-8">
              <h2 id="scene-title" className="text-3xl font-bold">
                Bientôt <span className="text-cyan">en scène</span>
              </h2>
              <p className="text-gray-light mt-1">
                Les prochaines dates de la communauté.
              </p>
            </div>
            <ul
              role="list"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 list-none"
            >
              {prochainesScenes.map((s) => (
                <li key={s.occurrenceId}>
                  <SceneCard scene={s} headingLevel="h3" />
                </li>
              ))}
            </ul>
            <div className="text-center mt-8">
              <Button href="/agenda" variant="ghost" size="sm" className="px-0">
                Voir tout l&apos;agenda →
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Elles viennent d'arriver — l'autre bloc vivant : l'annuaire qui
          grandit. Le fil dit « elle est là, va voir », il ne rejoue pas la
          fiche ; absent sans nouvelle venue (jamais de cadre vide). */}
      {venues.length > 0 && (
        <section className="py-16 px-4 bg-navy-light" aria-labelledby="venues-title">
          <div className="max-w-6xl mx-auto">
            <div className="mb-8">
              <h2 id="venues-title" className="text-3xl font-bold">
                Elles viennent <span className="text-magenta">d&apos;arriver</span>
              </h2>
              <p className="text-gray-light mt-1">
                Les dernières speakeuses entrées dans l&apos;annuaire.
              </p>
            </div>
            <ul
              role="list"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 list-none"
            >
              {venues.map((v) => (
                <li key={v.profileId}>
                  <CarteNouvelleVenue venue={v} headingLevel="h3" />
                </li>
              ))}
            </ul>
            <div className="text-center mt-8">
              <Button href="/speakeuses" variant="ghost" size="sm" className="px-0">
                Voir tout l&apos;annuaire →
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Cette communauté, c'est pour qui ? — Pattern A (cascade tutoyée + sticky) */}
      <section className="py-16 sm:py-20 px-4" aria-labelledby="pour-qui-title">
        <div className="max-w-3xl mx-auto text-center">
          <h2 id="pour-qui-title" className="sr-only">
            Cette communauté, c&apos;est pour qui&nbsp;?
          </h2>
          <div className="space-y-3 text-base sm:text-lg text-white leading-relaxed mb-12">
            <p>Tu prépares ton premier talk ou tu enchaînes les conférences&nbsp;?</p>
            <p>Tu veux partager ton expertise, ton vécu, ta voix&nbsp;?</p>
            <p>Tu cherches une communauté de femmes de la tech qui ose&nbsp;?</p>
          </div>
          <StickyNote>Cette communauté est pour toi&nbsp;!</StickyNote>
        </div>
      </section>

      {/* Actualités — extrait de `/actualites` (la base, pas un contenu figé) :
          publier une actu depuis l'éditeur la fait apparaître ici, interviews
          « Behind the Scenes » comprises (d'où l'absence d'encart dédié : ce
          serait le même contenu deux fois). Absent quand rien n'est publié :
          mieux vaut rien qu'un cadre vide. */}
      {actualites.length > 0 && (
        <section className="py-16 sm:py-24 px-4" aria-labelledby="actualites-title">
          <div className="max-w-6xl mx-auto">
            <h2 id="actualites-title" className="text-3xl font-bold text-center mb-12">
              <span className="text-cyan">Actualités</span>
            </h2>

            <ul
              role="list"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 list-none"
            >
              {actualites.map((actu) => (
                <li key={actu.slug}>
                  {/* Même carte que la liste `/actualites` : la destination, la
                      chip et l'intitulé accessible vivent dans le composant. */}
                  <CarteActualite carte={actu} headingLevel="h3" />
                </li>
              ))}
            </ul>
            <div className="text-center mt-8">
              <Button href="/actualites" variant="ghost" size="sm" className="px-0">
                Voir toutes les actualités &rarr;
              </Button>
            </div>
          </div>
        </section>
      )}
      <section className="py-16 px-4 bg-navy-light" aria-labelledby="tremplin-cta-title">
        <div className="max-w-4xl mx-auto bg-gradient-to-r from-magenta/10 to-cyan/10 border border-navy-lighter rounded-2xl p-8 sm:p-12 text-center">
          <h2 id="tremplin-cta-title" className="text-2xl sm:text-3xl font-bold mb-4">
            Tremplin Tech Speak&apos;Her x DevFest Toulouse 2026
          </h2>
          <p className="text-gray-light mb-6 max-w-2xl mx-auto">
            Vous rêvez de donner votre premier talk en conférence&nbsp;? Le Tremplin
            vous accompagne du pitch à la scène du DevFest Toulouse&nbsp;!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button href="/tremplin">
              Découvrir le Tremplin
            </Button>
            <Button href="/devfest-toulouse" variant="secondary">
              C&apos;est quoi le DevFest Toulouse&nbsp;?
            </Button>
          </div>
        </div>
      </section>

      {/* CTA Organisateurs */}
      <section className="py-16 px-4 bg-navy-light" aria-labelledby="orga-title">
        <div className="max-w-4xl mx-auto text-center">
          <h2 id="orga-title" className="text-xl sm:text-2xl font-semibold text-cyan mb-4">
            Vous cherchez des intervenantes pour vos prochains événements&nbsp;?
          </h2>
          <p className="text-gray-light mb-6">
            Contactez-nous&nbsp;: on a fait une liste des speakeuses de notre communauté&nbsp;!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button href="/speakeuses">
              Voir l&apos;annuaire
            </Button>
            <Button href="/contact" variant="secondary">
              Nous contacter
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
