import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  getProfileByHandle,
  getFicheARelancer,
  getRappelCadence,
  speakeuseHref,
} from "@/lib/profiles";
import { getReglages } from "@/lib/reglages";
import { buildSpeakerPersonLd } from "@/lib/speaker-jsonld";
import { statusLabel } from "@/lib/profile-status";
import { getPublicTalksByProfileId } from "@/lib/talks";
import { BASE_URL } from "@/constants/site";
import Button from "@/components/Button";
import Breadcrumb from "@/components/Breadcrumb";
import FicheSpeakeuseCorps from "@/components/FicheSpeakeuseCorps";
import ModerationPanel from "./ModerationPanel";
import { uneSeuleLigne } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Métadonnées par fiche. Une fiche PUBLIÉE est indexable (objectif : visibilité
 * des speakeuses) avec titre/description/canonical/OG dédiés ; un aperçu non
 * publié (propriétaire / file de modération) reste en noindex.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id: handle } = await params;
  const fallback: Metadata = {
    title: "Fiche speakeuse | Tech Speak'Her",
    robots: { index: false },
  };

  const profile = await getProfileByHandle(handle);
  if (!profile) return fallback;

  const nom = profile.nomAffiche;
  const sousTitre = [profile.poste, profile.entreprise].filter(Boolean).join(" · ");
  // Sans vrai nom, nomAffiche EST le titre du profil : le suffixe du title
  // et l'accroche le répéteraient mot pour mot dans l'onglet et sur Google.
  const nomReel = Boolean(profile.name?.trim());
  const accroche = (nomReel && profile.titreProfil) || sousTitre || "Speakeuse Tech Speak'Her";
  const bioStart = profile.bio
    ? `. ${uneSeuleLigne(profile.bio).slice(0, 110).trim()}…`
    : "";
  const title = `${nom}${nomReel && profile.titreProfil ? ` · ${profile.titreProfil}` : ""} | Tech Speak'Her`;
  const description = `${nom}, ${accroche}. Speakeuse Tech Speak'Her${bioStart}`;
  // URL canonique = le slug quand il existe (une seule URL indexée/partagée).
  const canonical = speakeuseHref(profile);
  const isPublished = profile.status === "publie";

  return {
    title,
    description,
    alternates: { canonical },
    robots: isPublished
      ? { index: true, follow: true }
      : { index: false, follow: false },
    openGraph: {
      type: "profile",
      title,
      description,
      url: `${BASE_URL}${canonical}`,
      images: profile.image ? [{ url: profile.image, alt: nom }] : undefined,
    },
  };
}

export default async function FicheSpeakeuse({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: handle } = await params;

  /**
   * PAS DE `try/catch` ICI, ET C'EST VOULU — la panne doit remonter (500).
   *
   * Le réflexe serait d'imiter `/[slug]`, qui rattrape et rend un 404. Mais son
   * commentaire dit une raison qui lui est PROPRE : ce segment capte tout chemin
   * d'un seul niveau, donc sans filet une base muette transformerait chaque
   * faute de frappe du site en 500. Cette page-ci ne reçoit que ses propres URLs
   * et n'a pas ce problème.
   *
   * Surtout, un 404 est une AFFIRMATION : « cette personne n'existe pas ». Le
   * servir pendant une panne dirait aux moteurs de retirer de l'index la fiche
   * d'une speakeuse bien réelle et publiée. Un 500 dit « je ne peux pas répondre
   * là » : les moteurs repassent, la fiche garde son référencement.
   *
   * Le 404 ci-dessous reste donc réservé à ce qu'il affirme vraiment : la base a
   * répondu, et cette fiche n'existe pas. Verrouillé par
   * `panne-base-pages-publiques.test.tsx`.
   */
  const profile = await getProfileByHandle(handle);
  if (!profile) notFound();

  // Accès : profil publié = public ; sinon réservé à l'orga (validation) ou à
  // la propriétaire (aperçu de sa propre fiche).
  const session = await auth();
  const isOrga = session?.user?.isOrga === true;
  const isOwner =
    session?.user?.id != null && Number(session.user.id) === profile.userId;
  if (profile.status !== "publie" && !isOrga && !isOwner) notFound();

  // Canonicalisation : arrivée par l'id numérique alors qu'un slug existe →
  // redirection (307) vers l'URL slug (l'adresse jolie s'affiche dans la barre).
  // Redirection TEMPORAIRE volontaire : le slug est modifiable, un 308 permanent
  // resterait en cache navigateur et pointerait vers un ancien slug supprimé
  // après un changement. Le SEO est consolidé par la balise `canonical` (slug).
  // Placée APRÈS le contrôle d'accès : une fiche non publiée ne révèle pas son
  // slug à une visiteuse non autorisée.
  if (profile.slug && handle !== profile.slug) {
    redirect(speakeuseHref(profile));
  }

  // Vue publique : exclut les propositions issues du backfill Tremplin (non
  // confirmées). L'espace perso (mon-espace) montre la vue complète.
  const talks = await getPublicTalksByProfileId(profile.id);

  // Le bouton « Relancer » du panneau orga s'affiche d'après LA MÊME lecture que
  // celle qui autorisera l'envoi (`getFicheARelancer`) : l'écran et l'action ne
  // peuvent donc pas se contredire sur les règles. Réservé à l'orga, et aux
  // brouillons — ailleurs on ne paie même pas la requête.
  let relancable = false;
  let rappelRefuse = false;
  if (isOrga && profile.status === "brouillon") {
    const { relance_brouillon_jours } = await getReglages();
    const [fiche, cadence] = await Promise.all([
      getFicheARelancer(profile.id, relance_brouillon_jours),
      // Le seul motif de fermeture DÉFINITIF, et le seul qu'on nomme à l'écran :
      // un choix de la personne. Les autres (message récent, cadence en cours,
      // adresse à confirmer) rouvrent tout seuls et partagent une phrase.
      getRappelCadence(profile.userId),
    ]);
    relancable = fiche !== null;
    rappelRefuse = cadence === "aucun";
  }
  // Le nom sert au fil d'Ariane ; tout le reste de la mise en forme (sous-titre,
  // contact, plateformes de CFP) vit dans `FicheSpeakeuseCorps`, partagé avec
  // « Ma fiche ».
  const nom = profile.nomAffiche;

  // Données structurées Person (fiche publiée uniquement) : aide les moteurs à
  // comprendre la speakeuse comme une entité (résultats enrichis sur recherche
  // de son nom) et, via homeLocation, à la relier à sa ville. Construction
  // extraite et testée dans src/lib/speaker-jsonld.ts.
  const personLd = buildSpeakerPersonLd(profile);

  return (
    <>
      {personLd && (
        <script
          type="application/ld+json"
          // < : un « </script> » dans une bio (texte libre) fermerait le
          // script et exécuterait la suite → XSS stocké. JSON.stringify seul
          // n'échappe pas « < ».
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(personLd).replace(/</g, "\\u003c"),
          }}
        />
      )}
      <Breadcrumb
        items={[
          { label: "Accueil", href: "/" },
          { label: "Speakeuses", href: "/speakeuses" },
          { label: nom },
        ]}
      />
      <div className="py-10 px-4">
      <article className="max-w-2xl mx-auto">
        {/* Barre propriétaire : chrome d'édition + statut, volontairement sobre
            pour ne pas concurrencer le contenu public de la fiche. */}
        {isOwner ? (
          <div className="mb-8 rounded-xl border border-navy-lighter bg-navy-light/60 px-4 py-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-light">
                Ton aperçu
              </p>
              {/* Le statut en MOTS, et à la forme positive : « pas encore
                  publiée » disait ce qui n'est pas. `statusLabel` est la source
                  unique, celle qu'emploie aussi « Ma fiche ». */}
              <p className="text-xs text-gray-light">
                {profile.status === "publie"
                  ? "Publiée : voici ce que voient les visiteuses."
                  : `${statusLabel(profile.status)} : voici à quoi ressemblera ta fiche.`}
              </p>
            </div>
            {/* UNE sortie, nommée comme sa destination : « mes infos » désignait
                une page qui s'appelle « Ma fiche », et trois affordances
                d'édition sur un écran d'aperçu en faisaient une seconde page
                d'édition concurrente. */}
            <Button href="/mon-espace/fiche" variant="ghost" size="sm">
              Modifier ma fiche
            </Button>
          </div>
        ) : (
          isOrga && (
            <ModerationPanel
              profileId={profile.id}
              status={profile.status}
              submittedAt={profile.submittedAt}
              refusMotif={profile.refusMotif}
              relancable={relancable}
              rappelRefuse={rappelRefuse}
            />
          )
        )}

        {/* Le CORPS de la fiche — le MÊME rendu qu'« Ma fiche » côté propriétaire
            (`FicheSpeakeuseCorps`). Il vivait ici en entier ; deux rendus pour la
            même fiche auraient divergé au premier changement, et c'est justement
            l'écart entre « ce que je lis de moi » et « ce que les orgas lisent »
            qu'on voulait supprimer. Sans `crayons` : aucune affordance d'édition
            sur une page publique, et une section vide ne rend rien. */}
        {/* AUCUN `talksBase` : cette page est un APERÇU, elle doit montrer ce que
            voient les visiteuses. Le passer redonnait à une prop de présentation
            le rôle d'un second drapeau de vue — la propriétaire lisait « Tes
            talks / Ajouter » avec un lien vers son espace, au-dessus d'une phrase
            à la troisième personne. L'édition vit sur « Ma fiche ». */}
        <FicheSpeakeuseCorps vue="publique" profile={profile} talks={talks} />

        {!isOwner && (
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <p className="text-sm text-gray-light">
              C&apos;est toi&nbsp;? Reprends la main sur ta fiche.
            </p>
            <Button href="/connexion" variant="secondary" size="sm">
              C&apos;est moi, je me connecte
            </Button>
          </div>
        )}
      </article>
      </div>
    </>
  );
}
