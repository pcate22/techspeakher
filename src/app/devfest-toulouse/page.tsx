import Breadcrumb from "@/components/Breadcrumb";
import type { Metadata } from "next";
import Link from "next/link";
import Button from "@/components/Button";
import RecitConference from "@/components/RecitConference";
import ExternalLink from "@/components/ExternalLink";
import LinkedInIcon from "@/components/icons/LinkedInIcon";
import { devfest2026Conferences, devfest2026Quickies, devfestChiffres } from "@/data/devfest";
import { BASE_URL } from "@/constants/site";
import { ASSOCIATION } from "@/data/association";
import { getEditionsByConfSlug } from "@/lib/tremplin-editions";
import { getConferenceEditionByConfSlugAndYear } from "@/lib/conferences";
import {
  getPublicSpeakersByConferenceEdition,
  type ConferenceSpeaker,
} from "@/lib/conference-speakers";
import { getPublishedArticleByConferenceEdition } from "@/lib/contenus";
import { getPublicEdition, aUnChapitreMonteeSurScene } from "@/lib/tremplin-public";
import ConferenceSpeakers from "@/components/ConferenceSpeakers";
import EditionListItem from "@/components/EditionListItem";

/** Couleur d'un chiffre. En clair : Tailwind ne compile pas une classe construite. */
const TON_CHIFFRE = {
  magenta: "text-magenta",
  cyan: "text-cyan",
  orange: "text-orange",
} as const;

/** L'année de l'édition DevFest dont on reflète le programme sur cette page. */
const DEVFEST_ANNEE = 2026;
/** Celle qu'on raconte au passé, juste en dessous. Se décale toute seule. */
const DEVFEST_ANNEE_PASSEE = DEVFEST_ANNEE - 1;

// La liste des éditions du Tremplin vient de la BDD : une nouvelle édition met
// la page à jour seule. Le reste de la page reste éditorial (data/devfest).
export const revalidate = 300;

const devfestEventSchema = {
  "@context": "https://schema.org",
  "@type": "Event",
  name: "DevFest Toulouse 2026",
  startDate: "2026-11-19T08:00:00",
  endDate: "2026-11-19T22:00:00",
  eventStatus: "https://schema.org/EventScheduled",
  eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
  image: `${BASE_URL}/logo-full.webp`,
  location: {
    "@type": "Place",
    name: "Centre de Congrès et d'Exposition Diagora",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Labège",
      addressRegion: "Occitanie",
      addressCountry: "FR",
    },
  },
  // Pas d'`offers` : la billetterie est celle de GDG Toulouse, et un bloc
  // `Offer` sur notre domaine annoncerait que nous vendons l'entrée. Le lien
  // vers l'organisateur suffit à situer l'évènement.
  performer: {
    "@type": "Organization",
    name: "GDG Toulouse",
    url: "https://gdg.community.dev/gdg-toulouse/",
  },
  organizer: {
    "@type": "Organization",
    name: "GDG Toulouse",
    url: "https://gdg.community.dev/gdg-toulouse/",
  },
  description:
    `Le DevFest Toulouse 2026 est la grande conférence tech de Toulouse organisée par GDG Toulouse. ${ASSOCIATION.nom} y accompagne les femmes de la tech pour monter sur scène via le programme Tremplin.`,
  url: `${BASE_URL}/devfest-toulouse`,
};

export const metadata: Metadata = {
  title: "DevFest Toulouse 2026 | Tech Speak'Her",
  description:
    "Le DevFest Toulouse 2026, c'est le 19 novembre au Diagora à Labège. Tech Speak'Her accompagne les femmes de la tech pour monter sur scène grâce au programme Tremplin.",
  keywords: [
    "DevFest Toulouse",
    "DevFest Toulouse 2026",
    "conférence tech Toulouse",
    "GDG Toulouse",
    "Tech Speak'Her",
    "speakeuse DevFest",
    "Diagora Labège",
    "femmes tech Toulouse",
  ],
  alternates: {
    canonical: "/devfest-toulouse",
  },
  openGraph: {
    title: "DevFest Toulouse 2026 | Tech Speak'Her",
    description:
      "Les speakeuses Tech Speak'Her sur scène au DevFest Toulouse le 19 novembre 2026, issues du Tremplin et du CFP. Rendez-vous au Diagora à Labège.",
    type: "website",
  },
};

export default async function DevFestToulouse() {
  // Page éditoriale d'abord : si la BDD est indisponible (ex. prerender au
  // build, sans Postgres), on rend la page sans la liste des éditions plutôt
  // que d'échouer. L'ISR (revalidate) la remplira une fois déployée.
  // Line-up dérivé du répertoire : les speakeuses PUBLIÉES ayant un talk
  // rattaché à l'édition DevFest de l'année. Tout est résilient (une base
  // indisponible ou une donnée pas encore saisie retombe sur le contenu
  // éditorial statique, sans planter le prerender ni régresser la page).
  // Les lectures indépendantes sont groupées pour éviter une cascade de requêtes.
  // Le chapitre 2 (montée sur scène) renvoie un 404 tant qu'il n'a rien à
  // raconter : on lit donc le MÊME prédicat que lui avant d'y envoyer qui que ce
  // soit. Résilient comme le reste de la page — base indisponible → carte
  // absente, jamais un lien mort.
  const [tremplinEditions, editionId, editionPasseeId, editionPublique] = await Promise.all([
    getEditionsByConfSlug("devfest-toulouse").catch(() => []),
    getConferenceEditionByConfSlugAndYear("devfest-toulouse", DEVFEST_ANNEE).catch(() => null),
    getConferenceEditionByConfSlugAndYear("devfest-toulouse", DEVFEST_ANNEE_PASSEE).catch(
      () => null,
    ),
    getPublicEdition("devfest-toulouse", DEVFEST_ANNEE).catch(() => null),
  ]);
  const aLaMonteeSurScene =
    editionPublique !== null &&
    editionPublique !== "deleted" &&
    aUnChapitreMonteeSurScene(editionPublique);
  // Le récit de l'année en cours voyage DÉJÀ dans le DTO de l'édition (le même
  // rattachement, la même requête) : le redemander ici le paierait deux fois à
  // chaque régénération.
  const recit =
    editionPublique !== null && editionPublique !== "deleted" ? editionPublique.recit : null;
  const [speakers, recitPasse] = await Promise.all([
    editionId
      ? getPublicSpeakersByConferenceEdition(editionId).catch(() => [] as ConferenceSpeaker[])
      : Promise.resolve([] as ConferenceSpeaker[]),
    // Ce qu'on a vécu à l'édition PASSÉE : le contenu rattaché à cette
    // conférence répertoriée, écrit dans /admin/contenus. Il était en dur ici,
    // donc la page du Tremplin de cette année-là ne pouvait pas s'en servir.
    editionPasseeId
      ? getPublishedArticleByConferenceEdition(editionPasseeId).catch(() => null)
      : Promise.resolve(null),
  ]);
  const lineupDynamique = speakers.length > 0;

  return (
    <>
      <Breadcrumb items={[{ label: "Accueil", href: "/" }, { label: "DevFest Toulouse" }]} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(devfestEventSchema) }}
      />

      {/* Hero */}
      <section className="py-16 sm:py-24 px-4 relative overflow-hidden" aria-labelledby="devfest-title">
        <div className="absolute inset-0 -z-10" aria-hidden="true">
          <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] bg-cyan/6 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-magenta/6 rounded-full blur-3xl" />
        </div>
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-sm font-semibold text-cyan uppercase tracking-wide mb-4">
            19 novembre 2026 · Diagora · Labège
          </p>
          <h1 id="devfest-title" className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-6">
            <span className="text-cyan">DevFest Toulouse</span> 2026
          </h1>
          <p className="text-lg sm:text-xl text-gray-light max-w-3xl mx-auto mb-8 leading-relaxed">
            La grande conférence tech de Toulouse, c&apos;est le 19&nbsp;novembre au Diagora.
            Cette année, les speakeuses Tech Speak&apos;Her montent sur scène.
          </p>
          {/* Les deux actions restent chez nous : le programme et le Tremplin.
              La billetterie du DevFest appartient à GDG Toulouse, qui est
              crédité plus bas ; y envoyer d'ici ferait de cette page une
              vitrine de vente pour un tiers. Voir docs/google-ad-grants.md. */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button href="/tremplin">
              Découvrir le Tremplin
            </Button>
            <Button href="#lineup-title" variant="secondary">
              Voir nos speakeuses au programme
            </Button>
          </div>
        </div>
      </section>

      {/* Le line-up : dynamique (annuaire + répertoire) dès qu'une speakeuse a
          un talk rattaché à l'édition DevFest ; repli sur le contenu éditorial
          statique sinon (pas de régression tant que la donnée n'est pas saisie). */}
      {lineupDynamique ? (
        <ConferenceSpeakers
          speakers={speakers}
          titleId="lineup-title"
          title="Tech Speak'Her au DevFest 2026"
          lead={
            <>
              Les speakeuses Tech Speak&apos;Her au programme du 19&nbsp;novembre 2026,
              issues du Tremplin et du CFP.
              {recit && (
                <>
                  {" "}
                  <Link
                    href={`/articles/${recit.slug}`}
                    className="text-cyan hover:text-cyan-light underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded"
                  >
                    Lire le récit complet
                  </Link>
                  .
                </>
              )}
            </>
          }
        />
      ) : (
      <section className="py-16 px-4" aria-labelledby="lineup-title">
        <div className="max-w-4xl mx-auto">
          <h2 id="lineup-title" className="text-2xl sm:text-3xl font-bold text-center mb-4">
            Tech Speak&apos;Her au{" "}
            <span className="text-cyan">DevFest&nbsp;2026</span>
          </h2>
          <p className="text-gray-light text-center max-w-2xl mx-auto mb-10 leading-relaxed">
            Le comité de sélection du DevFest a retenu trois finalistes du
            Tremplin&nbsp;: Sandrine, notre lauréate, Géraldine et Leïla. Sandrine et
            Géraldine ont choisi de se retirer. Bravo à elles
            pour cette sélection&nbsp;! Le créneau réservé à la gagnante du Tremplin
            revient à Camille, 2ᵉ de la soirée. Claire et Asma, retenues elles
            aussi, sont accompagnées par Tech&nbsp;Speak&apos;Her. Le 19&nbsp;novembre,{" "}
            <strong className="text-white font-semibold">6 talks Tech&nbsp;Speak&apos;Her</strong>{" "}
            sont au programme, dont deux portés par nos fondatrices.
          </p>

          {/* Conférences */}
          <h3 className="text-lg font-bold text-magenta mb-4">
            Conférences <span className="text-sm font-normal text-gray-light">· 45&nbsp;min</span>
          </h3>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10 list-none">
            {devfest2026Conferences.map((talk) => (
              <li key={talk.name} className="bg-navy-light border border-navy-lighter rounded-xl p-5">
                <p className="text-base font-bold text-white">{talk.name}</p>
                <p className="text-xs text-cyan font-medium mb-2">{talk.note}</p>
                <p className="text-sm text-gray-light leading-relaxed mb-3">{talk.titre}</p>
                {talk.linkedin && (
                  <ExternalLink
                    href={talk.linkedin}
                    // RGAA 6.1 : six liens « LinkedIn » sur la page, six
                    // destinations. Sans intitulé explicite, la liste des liens
                    // d'un lecteur d'écran affiche six fois le même mot. Même
                    // patron qu'en /tremplin/[conf]/[annee].
                    aria-label={`LinkedIn de ${talk.name}`}
                    className="inline-flex items-center gap-1 text-sm text-cyan hover:text-cyan-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded transition-colors"
                  >
                    <LinkedInIcon />
                    LinkedIn
                  </ExternalLink>
                )}
              </li>
            ))}
          </ul>

          {/* Quickies */}
          <h3 className="text-lg font-bold text-orange mb-4">
            Quickies <span className="text-sm font-normal text-gray-light">· 15&nbsp;min</span>
          </h3>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 list-none">
            {devfest2026Quickies.map((talk) => (
              <li key={talk.name} className="bg-navy-light border border-navy-lighter rounded-xl p-5">
                <p className="text-base font-bold text-white">{talk.name}</p>
                <p className="text-xs text-cyan font-medium mb-2">{talk.note}</p>
                <p className="text-sm text-gray-light leading-relaxed mb-3">{talk.titre}</p>
                {talk.linkedin && (
                  <ExternalLink
                    href={talk.linkedin}
                    // RGAA 6.1 : six liens « LinkedIn » sur la page, six
                    // destinations. Sans intitulé explicite, la liste des liens
                    // d'un lecteur d'écran affiche six fois le même mot. Même
                    // patron qu'en /tremplin/[conf]/[annee].
                    aria-label={`LinkedIn de ${talk.name}`}
                    className="inline-flex items-center gap-1 text-sm text-cyan hover:text-cyan-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded transition-colors"
                  >
                    <LinkedInIcon />
                    LinkedIn
                  </ExternalLink>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>
      )}

      {/* C'est quoi le DevFest Toulouse */}
      <section className="py-16 px-4 bg-navy-light" aria-labelledby="cest-quoi-title">
        <div className="max-w-4xl mx-auto">
          <h2 id="cest-quoi-title" className="text-2xl sm:text-3xl font-bold text-center mb-8">
            C&apos;est quoi le <span className="text-cyan">DevFest Toulouse</span>&nbsp;?
          </h2>
          {/* Les chiffres que la conférence publie, pas des ordres de grandeur.
              L'année vient avec eux (src/data/devfest.ts) : elle ne peut pas se
              désolidariser et coiffer les chiffres d'une autre édition. */}
          <h3 className="text-xs font-bold text-gray-light uppercase tracking-wider text-center mb-6">
            L&apos;édition {devfestChiffres.annee} en chiffres
          </h3>
          <ul role="list" className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center list-none">
            {devfestChiffres.cartes.map((c) => (
              <li key={c.label} className="bg-navy border border-navy-lighter rounded-xl p-6">
                <p className={`text-3xl font-bold mb-2 tabular-nums ${TON_CHIFFRE[c.tone]}`}>
                  {c.n}
                </p>
                <p className="text-sm text-gray-light">{c.label}</p>
              </li>
            ))}
          </ul>
          <p className="text-gray-light text-center max-w-2xl mx-auto mt-8 leading-relaxed">
            Le DevFest Toulouse, c&apos;est la conférence tech de référence à Toulouse,
            organisée par le Google Developer Group Toulouse. Des talks sur le
            développement, le cloud, l&apos;IA, le design, l&apos;agilité, plusieurs scènes en
            parallèle, et une salle dédiée aux communautés toulousaines, dont
            Tech Speak&apos;Her depuis 2025.
          </p>
        </div>
      </section>

      {/* Ce qui s'est passé à l'édition passée — CONTENU rattaché à la
          conférence répertoriée, pas du texte en dur : la page du Tremplin de
          cette année-là le raconte aussi, et l'orga l'écrit sans redéployer. */}
      {recitPasse && <RecitConference recit={recitPasse} headingId="recit-passe-title" />}

      {/* Les deux chemins */}
      <section className="py-16 px-4" aria-labelledby="chemins-title">
        <div className="max-w-4xl mx-auto">
          <h2 id="chemins-title" className="text-2xl font-bold text-center mb-3">
            Le parcours 2026, du Tremplin à la scène
          </h2>
          <p className="text-gray-light text-center text-sm mb-10">
            Deux voies compatibles menaient à la scène&nbsp;: le Tremplin Tech Speak&apos;Her et le CFP du DevFest.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
            {/* Voie Tremplin */}
            <div>
              <h3 className="text-base font-bold text-magenta mb-4 text-center">Via le Tremplin Tech Speak&apos;Her</h3>
              <ol className="space-y-3 list-none">
                {[
                  { date: "12 mars → 17 avril", label: "Inscriptions au Tremplin" },
                  { date: "28 avr. → 26 mai", label: "Coaching, tous les mardis midi" },
                  { date: "Avant le 31 mai", label: "Soumission au CFP DevFest en parallèle" },
                  { date: "4 juin 2026", label: "Soirée Tremplin, pitch devant jury" },
                  { date: "Été 2026", label: "Coaching personnalisé jusqu'à la scène" },
                ].map((step) => (
                  <li
                    key={step.label}
                    className="flex gap-3 items-start bg-navy-light border border-navy-lighter rounded-lg p-3"
                  >
                    <time className="text-xs font-semibold text-magenta whitespace-nowrap min-w-[110px]">
                      {step.date}
                    </time>
                    <span className="text-white text-xs">{step.label}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Voie CFP */}
            <div>
              <h3 className="text-base font-bold text-cyan mb-4 text-center">Via le CFP DevFest</h3>
              <ol className="space-y-3 list-none">
                {[
                  { date: "9 mars → 31 mai", label: "Proposition soumise sur Sessionize" },
                  { date: "Été 2026", label: "Réponses du jury CFP" },
                  { date: "Automne 2026", label: "Préparation du talk retenu" },
                ].map((step) => (
                  <li
                    key={step.label}
                    className="flex gap-3 items-start bg-navy-light border border-navy-lighter rounded-lg p-3"
                  >
                    <time className="text-xs font-semibold text-cyan whitespace-nowrap min-w-[110px]">
                      {step.date}
                    </time>
                    <span className="text-white text-xs">{step.label}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* Convergence */}
          <div className="bg-navy-light border border-cyan/30 rounded-xl p-4 text-center">
            <time className="text-sm font-bold text-cyan block mb-1">19 novembre 2026</time>
            <span className="text-white text-sm font-semibold">DevFest Toulouse 2026, sur scène au Diagora</span>
          </div>
        </div>
      </section>

      {/* Les éditions du Tremplin au DevFest — BDD */}
      {tremplinEditions.length > 0 && (
        <section className="py-16 px-4" aria-labelledby="editions-title">
          <div className="max-w-3xl mx-auto">
            <h2 id="editions-title" className="text-2xl sm:text-3xl font-bold text-center mb-3">
              Les éditions du <span className="text-magenta">Tremplin</span> au DevFest
            </h2>
            <p className="text-gray-light text-center max-w-2xl mx-auto mb-10 leading-relaxed">
              Chiffres, finalistes et palmarès de chaque édition du Tremplin
              Tech Speak&apos;Her au DevFest Toulouse.
            </p>
            {/* Une entrée par destination. L'édition en cours a DEUX chapitres
                (le Tremplin jusqu'à la soirée, puis l'accompagnement vers la
                scène) : le second se propose sur la ligne de son édition. Il a
                vécu un temps dans un bloc « en deux temps » posé en dessous —
                qui rouvrait aussi le chapitre 1, déjà là, et dont les cartes ne
                se donnaient pas pour cliquables (ni flèche, ni couleur ; le
                survol n'existe pas au doigt). */}
            <ul role="list" className="flex flex-col gap-3 list-none">
              {tremplinEditions.map((e) => (
                <EditionListItem
                  key={e.id}
                  edition={e}
                  confSlug="devfest-toulouse"
                  suite={
                    e.annee === DEVFEST_ANNEE && aLaMonteeSurScene
                      ? {
                          href: `/tremplin/devfest-toulouse/${DEVFEST_ANNEE}/montee-sur-scene`,
                          libelle: "L'accompagnement vers la scène",
                        }
                      : undefined
                  }
                />
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* CTA final */}
      <section className="py-16 px-4 bg-navy-light" aria-labelledby="cta-devfest-title">
        <div className="max-w-3xl mx-auto text-center">
          <h2 id="cta-devfest-title" className="text-2xl sm:text-3xl font-bold mb-4">
            Rendez-vous le 19 novembre au{" "}
            <span className="text-cyan">DevFest Toulouse</span>
          </h2>
          <p className="text-gray-light mb-8 max-w-xl mx-auto">
            Le Tremplin 2026 a rendu son verdict et les talks sont sélectionnés.
            Prochaine étape&nbsp;: la scène du DevFest Toulouse, au Diagora à Labège.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button href="/tremplin" size="lg">
              Découvrir le Tremplin
            </Button>
            <Button href="/speakeuses" variant="secondary" size="lg">
              Découvrir les speakeuses
            </Button>
          </div>
          <p className="text-xs text-gray-light mt-6">
            Le DevFest Toulouse est organisé par{" "}
            <ExternalLink
              href="https://gdg.community.dev/gdg-toulouse/"
              // Lien AU MILIEU d'un paragraphe : la couleur seule ne suffit pas
              // à le distinguer du texte (WCAG 1.4.1) — d'où le soulignement,
              // comme les autres liens en ligne du site.
              className="text-cyan hover:text-cyan-light underline underline-offset-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded"
            >
              GDG Toulouse
            </ExternalLink>
            . Tech Speak&apos;Her est une association loi 1901&nbsp;; GDG Toulouse a
            soutenu notre première présence au DevFest.
          </p>
        </div>
      </section>
    </>
  );
}
