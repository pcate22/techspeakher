import Breadcrumb from "@/components/Breadcrumb";
import type { Metadata } from "next";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import Link from "next/link";
import Button from "@/components/Button";
import PageHero from "@/components/PageHero";
import {
  getPublishedAnnuaire,
  toPublicSpeaker,
  speakeuseHref,
  type PublicSpeaker,
} from "@/lib/profiles";
import {
  getPublicTalkTextByProfile,
  getPublicTalkTitlesByProfile,
  type PublicTalkPreview,
} from "@/lib/talks";
import { BASE_URL } from "@/constants/site";
import { TAG_ANNUAIRE } from "@/lib/annuaire-cache";
import SpeakeusesFilter from "./SpeakeusesFilter";
import { ASSOCIATION } from "@/data/association";

const METADATA_BASE: Metadata = {
  title: "Annuaire des speakeuses et conférencières tech | Tech Speak'Her Toulouse",
  description:
    "L'annuaire des speakeuses de Tech Speak'Her, communauté née à Toulouse\u00A0: des conférencières et speakers femmes de la tech partout en France, qui prennent la parole en conférence, meetup ou table ronde.",

  keywords: [
    "speakeuses tech",
    "speakeuses tech France",
    "conférencières tech",
    "conférencières tech France",
    "speakers femmes tech",
    "femmes speakers France",
    "trouver une speakeuse",
    "intervenantes tech",
    "women in tech speakers France",
    "speakeuses Toulouse",
    "speakeuses tech Toulouse",
    "conférencières tech Toulouse",
    "femmes speakers Toulouse",
    "Tech Speak'Her",
  ],
  alternates: {
    canonical: "/speakeuses",
  },
  openGraph: {
    type: "website",
    title: "Annuaire des speakeuses et conférencières tech | Tech Speak'Her Toulouse",
    description:
      "L'annuaire des speakeuses de Tech Speak'Her, communauté née à Toulouse\u00A0: des conférencières et speakers femmes de la tech partout en France.",

    url: `${BASE_URL}/speakeuses`,
  },
};

// Rendu DYNAMIQUE (comme la fiche `[id]` et l'espace orga). L'ISR était tentant
// (annuaire identique pour tous, sans donnée par-session), MAIS il pré-génère la
// page AU BUILD : si la base est injoignable à ce moment-là, `getPublishedAnnuaire`
// échoue, le `catch` renvoie une liste vide, et ce « L'annuaire arrive bientôt »
// se retrouve FIGÉ en cache — sur l'une des pages cœur de visibilité de TSH.
// Constaté en prod (2026-07-23) : annuaire vide alors que 5 fiches sont publiées.
// On rend donc en direct depuis le runtime (base prouvée joignable, l'orga marche).
// Depuis le 2026-08-22, c'est la DONNÉE qui est en cache (`lireAnnuaire`
// ci-dessous : unstable_cache + TAG_ANNUAIRE, invalidé par les écritures via
// `invaliderAnnuaire`) — et elle refuse de mémoriser une panne : la fonction
// cachée JETTE, la dégradation reste hors cache.
export const dynamic = "force-dynamic";

/**
 * LA LECTURE, cachée entre requêtes (dette P1 « cacher la donnée, pas la
 * page », soldée le 2026-08-22) : la page reste dynamique, la donnée est
 * servie du cache — invalidé par TAG (les écritures appellent
 * `invaliderAnnuaire`), avec un filet périodique qui borne le coût d'une
 * invalidation oubliée.
 *
 * En PANNE elle JETTE, et c'est le point dur : `unstable_cache` ne mémorise
 * pas un rejet, donc la dégradation reste HORS cache (la leçon du 2026-07-23,
 * racontée au commentaire de `dynamic`). Les lectures de talks
 * gardent leur repli individuel : des cartes sans talks pendant cinq minutes
 * au plus valent mieux qu'un annuaire entier déclaré indisponible.
 *
 * On projette en `PublicSpeaker` : seuls les champs publics partent vers le
 * client (pas de userId, statut, validation, e-mail…). `searchText` (bio +
 * texte des talks, pour matcher sans afficher) laisse la VILLE dehors
 * (minimisation : pas d'agrégation ville↔identité en masse) ; les titres de
 * talks, eux, s'affichent sur la carte (le titre vend mieux qu'un tag).
 */
const lireAnnuaire = unstable_cache(
  async () => {
    // Requêtes indépendantes : en parallèle (latence = max, pas la somme).
    const [rows, talkText, talkTitles] = await Promise.all([
      getPublishedAnnuaire(),
      getPublicTalkTextByProfile().catch(() => new Map<number, string>()),
      getPublicTalkTitlesByProfile().catch(() => new Map<number, PublicTalkPreview[]>()),
    ]);
    return {
      profiles: rows.map(toPublicSpeaker),
      searchText: Object.fromEntries(
        rows.map((r) => [r.id, [r.bio, talkText.get(r.id)].filter(Boolean).join(" ")]),
      ),
      talksByProfile: Object.fromEntries(
        rows.map((r) => [r.id, talkTitles.get(r.id) ?? []]),
      ),
    };
  },
  ["annuaire-donnees"],
  { tags: [TAG_ANNUAIRE], revalidate: 300 },
);

/**
 * LA PANNE ET LE VIDE SONT DEUX CHOSES DIFFÉRENTES, et cette page les a déjà
 * confondues : un `catch` muet donnait le même état (`profiles = []`) à une
 * base injoignable et à un annuaire réellement vide — même écran, même
 * phrase, fausse en panne. Le drapeau `indisponible` porte la distinction, et
 * il sert DEUX publics par deux canaux : la visiteuse, par le libellé
 * (cf. `SpeakeusesFilter`) ; les moteurs, par `robots`
 * (cf. `generateMetadata`).
 *
 * `cache()` (React) : la page ET `generateMetadata` appellent cette fonction
 * dans la même requête — UN seul verdict de panne par affichage (métadonnées
 * et écran cohérents), et un seul appel au cache de données.
 */
const chargerAnnuaire = cache(async () => {
  try {
    return { ...(await lireAnnuaire()), indisponible: false };
  } catch (err) {
    console.error("Annuaire indisponible", err);
    // Le drapeau est la seule chose qui distingue « la base se tait » de
    // « personne n'est encore publiée ». Il ne doit jamais être ravalé ici.
    return {
      profiles: [] as PublicSpeaker[],
      searchText: {} as Record<number, string>,
      talksByProfile: {} as Record<number, PublicTalkPreview[]>,
      indisponible: true,
    };
  }
});

/**
 * En panne, la page reste accueillante pour la visiteuse (200 + un message
 * honnête) mais se ferme aux moteurs. Next ne permet pas de servir un 503
 * depuis une page (404, 307/308, et c'est tout) : `noindex` est le seul levier
 * qui empêche un incident passager de se graver dans l'index. Il n'est posé QUE
 * sur le rendu dégradé — un annuaire légitimement vide, lui, reste indexable.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { indisponible } = await chargerAnnuaire();
  if (!indisponible) return METADATA_BASE;
  // `follow` reste vrai : les liens de la page (accueil, contact) gardent leur
  // valeur, c'est le contenu vide qu'on refuse de faire enregistrer.
  return { ...METADATA_BASE, robots: { index: false, follow: true } };
}

export default async function Speakeuses() {
  const { profiles, searchText, talksByProfile, indisponible } = await chargerAnnuaire();

  // Données structurées : la page est une CollectionPage (annuaire) à couverture
  // nationale (spatialCoverage = France ; l'asso est née à Toulouse mais les
  // speakeuses sont partout en France). Elle porte les termes de recherche visés
  // (speakeuses / conférencières / speakers femmes tech) que la marque
  // « speakeuse » seule laisse de côté côté requête, et contient une ItemList des
  // fiches publiées quand il y en a — chaque entrée reliée à sa fiche (cohérent
  // avec le JSON-LD Person).
  const collectionLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Annuaire des speakeuses et conférencières tech en France",
    description:
      `Speakeuses, conférencières et speakers femmes de la tech partout en France, réunies par ${ASSOCIATION.nom} (communauté née à Toulouse).`,

    url: `${BASE_URL}/speakeuses`,
    inLanguage: "fr-FR",
    isPartOf: { "@type": "WebSite", name: ASSOCIATION.nom, url: BASE_URL },
    about: {
      "@type": "Thing",
      name: "Speakeuses et conférencières tech en France",
    },
    spatialCoverage: {
      "@type": "Country",
      name: "France",
    },
    ...(profiles.length > 0
      ? {
          mainEntity: {
            "@type": "ItemList",
            itemListElement: profiles.map((p, i) => ({
              "@type": "ListItem",
              position: i + 1,
              url: `${BASE_URL}${speakeuseHref(p)}`,
              name: p.nomAffiche,
            })),
          },
        }
      : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(collectionLd).replace(/</g, "\\u003c"),
        }}
      />
      <Breadcrumb items={[{ label: "Accueil", href: "/" }, { label: "Speakeuses" }]} />
      {/* Hero : titre seul, pour garder la recherche et les cartes au-dessus de
          la ligne de flottaison (charge cognitive : le sous-titre marketing et
          la ligne « organisez un événement » restent hors du haut). Le H1 porte
          l'ancrage national « tech en France » ; le texte indexable qui couvre les
          termes de recherche (conférencières / speakers femmes) vit SOUS la
          liste, où il pèse zéro sur le premier écran. */}
      <PageHero
        id="speakeuses-title"
        title={<>Annuaire des <span className="text-magenta">speakeuses</span> tech en France</>}
        // Rythme resserré sur mobile : la recherche remonte près du titre (moins
        // de vide avant l'action principale) ; desktop inchangé.
        padY="pt-10 pb-10 sm:py-24"
      />

      {/* Filtres + Liste */}
      <SpeakeusesFilter
        profiles={profiles}
        searchText={searchText}
        talksByProfile={talksByProfile}
        indisponible={indisponible}
      />

      {/* Sous la liste (après avoir parcouru les profils) : une phrase de
          contexte qui porte les termes de recherche (conférencières / speakers
          femmes tech, France) + l'appel aux orga d'événement. Placés ici,
          pas au-dessus de la recherche, pour garder le premier écran épuré.

          Cette phrase dit ce QU'EST l'annuaire, et c'est là que se joue la
          lecture d'un examinateur Ad Grants. La version précédente annonçait des
          speakeuses « disponibles partout en France » : mis bout à bout avec les
          filtres (secteurs, sujets, langues, zone d'intervention), le bouton
          « Contacter » et l'appel aux organisateurs, ça décrit une place de
          marché qui met en relation une offre et une demande — soit du placement
          et de la génération de contacts pour des tiers, deux motifs
          d'inéligibilité. Ce qui se passe vraiment, c'est que des speakeuses
          donnent du temps aux suivantes. On l'écrit. Voir
          docs/google-ad-grants.md. */}
      <div className="max-w-3xl mx-auto px-4 pb-16 text-center">
        <p className="text-sm text-gray-light mb-3">
          Cet annuaire rassemble des conférencières et speakers femmes de la
          tech, partout en France. Chacune y donne de son temps pour aider les
          suivantes à monter sur scène, qu&apos;elle en soit à son premier talk
          ou à son vingtième.

        </p>
        <p className="text-sm text-gray-light">
          Vous organisez un événement et cherchez des intervenantes&nbsp;?{" "}
          <Link href="/contact" className="text-cyan underline hover:text-cyan-light transition-colors">
            Contactez-nous
          </Link>
        </p>
      </div>

      {/* CTA */}
      <section className="py-16 px-4 bg-navy-light" aria-labelledby="devenir-speakeuse-title">
        <div className="max-w-3xl mx-auto text-center">
          <h2 id="devenir-speakeuse-title" className="text-2xl font-bold mb-4">
            Envie de rejoindre cette liste&nbsp;?
          </h2>
          <p className="text-gray-light mb-6">
            Que tu sois débutante ou expérimentée, la communauté Tech Speak&apos;Her
            t&apos;accompagne pour prendre la parole en conférence.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button href="/connexion">
              Créer / gérer ma fiche
            </Button>
            <Button href="/tremplin" variant="secondary">
              Découvrir le Tremplin
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
