import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";
import Button from "@/components/Button";
import ConferenceSpeakers from "@/components/ConferenceSpeakers";
import ExternalLinkIcon from "@/components/icons/ExternalLinkIcon";
import TagBadge from "@/components/TagBadge";
import { isSafeHttpUrl, isSafeInternalPath } from "@/components/ExternalLink";
import LienTexte from "@/components/LienTexte";
import LienVideo, { CTA_VIDEO } from "@/components/LienVideo";
import { MarkdownContenu } from "@/lib/markdown";
import { getContenuPublieBySlug, type Contenu } from "@/lib/contenus";
import { getProfilPublicByUserId } from "@/lib/profiles";
import { getPublicSpeakersByConferenceEdition } from "@/lib/conference-speakers";
import { formatDateFr } from "@/lib/format";
import { BASE_URL } from "@/constants/site";
import { ASSOCIATION } from "@/data/association";

export const dynamic = "force-dynamic";

/**
 * Un article = une publication PUBLIÉE ayant un corps. Sinon 404.
 *
 * PAS DE `try/catch` ICI, ET C'EST VOULU — la panne remonte (500). Même
 * raisonnement que la fiche speakeuse : un 404 affirmerait « cet article
 * n'existe pas » et inviterait les moteurs à le désindexer, alors qu'il est
 * publié et que seule la base est momentanément muette. `/[slug]`, lui,
 * rattrape pour une raison qui n'appartient qu'à lui : il capte TOUT chemin
 * inconnu du site. Verrouillé par `panne-base-pages-publiques.test.tsx`.
 */
async function chargerArticle(slug: string): Promise<Contenu | null> {
  const c = await getContenuPublieBySlug(slug);
  if (!c || c.type !== "publication" || !c.corps.trim()) return null;
  return c;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await chargerArticle(slug);
  if (!article) return { title: "Article | Tech Speak'Her", robots: { index: false } };

  const title = `${article.titre} | Tech Speak'Her`;
  const description = article.chapo ?? undefined;
  const canonical = `/articles/${article.slug}`;
  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      type: "article",
      title,
      description,
      url: `${BASE_URL}${canonical}`,
      publishedTime: article.publieLe ?? undefined,
      images: article.imageUrl
        ? [{ url: article.imageUrl, alt: article.imageAlt ?? article.titre }]
        : undefined,
    },
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await chargerArticle(slug);
  if (!article) notFound();

  // Le lien de la byline (lot N3) : la fiche PUBLIÉE de l'autrice, sinon
  // rien — une fiche retirée replie le lien, jamais le nom.
  const ficheAutrice = article.auteurUserId
    ? await getProfilPublicByUserId(article.auteurUserId)
    : null;
  const byline = ficheAutrice?.href ?? null;

  // Article rattaché à une conférence : on liste les speakeuses de l'annuaire
  // ayant un talk sur cette édition (source unique, pas de line-up codé en dur).
  const speakers =
    article.conferenceEditionId != null
      ? await getPublicSpeakersByConferenceEdition(article.conferenceEditionId)
      : [];

  // JSON-LD Article (SEO). `<` échappé : un « </script> » dans le contenu
  // fermerait la balise et exécuterait la suite (XSS stocké).
  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.titre,
    description: article.chapo ?? undefined,
    datePublished: article.publieLe ?? undefined,
    dateModified: article.publieLe ?? undefined,
    image: article.imageUrl ?? undefined,
    author: { "@type": "Organization", name: ASSOCIATION.nom },
    publisher: { "@type": "Organization", name: ASSOCIATION.nom },
    mainEntityOfPage: `${BASE_URL}/articles/${article.slug}`,
  };

  // CTA de fin d'article : externe prioritaire (et seulement si l'URL est
  // http(s) sûre), sinon lien interne. `lienLabel` = texte du bouton.
  // Défense contre une donnée ancienne : lien externe seulement si http(s) sûr,
  // lien interne seulement si chemin de site sûr (cf. isSafeInternalPath).
  const ctaFin =
    article.lienExterne && isSafeHttpUrl(article.lienExterne)
      ? { href: article.lienExterne, externe: true as const }
      : article.lien && isSafeInternalPath(article.lien)
        ? { href: article.lien, externe: false as const }
        : null;
  const ctaLabel = article.lienLabel || "En savoir plus";

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(articleLd).replace(/</g, "\\u003c"),
        }}
      />
      <Breadcrumb
        items={[
          { label: "Accueil", href: "/" },
          { label: "Articles", href: "/articles" },
          { label: article.titre },
        ]}
      />
      <div className="py-10 px-4">
        <article className="max-w-2xl mx-auto">
          {/* Photo déposée dans l'éditeur (lot 6) : elle ne servait qu'au SEO
              (OpenGraph, JSON-LD) sans jamais apparaître sur la page — en tête
              d'article, avant le titre.

              ENTIÈRE, jamais recadrée (retour de Cateline) : nos visuels sont
              des cartes à lire (titre en haut, nom de la speakeuse en bas), et
              un cadre de ratio fixe les décapitait. La hauteur suit l'image.

              Le champ vient d'un formulaire d'orga (URL http(s) libre, pas
              restreinte à Blob) : pas de next/image, dont l'optimiseur refuse
              tout hôte hors de sa liste (même raison que Avatar.tsx). */}
          {article.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={article.imageUrl}
              alt={article.imageAlt ?? ""}
              // Taille mesurée au dépôt (migration 065) : le navigateur en tire
              // la proportion AVANT le téléchargement et garde la place au bon
              // format — sans elle, le titre et le corps sautaient vers le bas
              // à l'arrivée de la photo. Inconnue pour les images d'avant la
              // mesure : on n'émet alors aucun attribut, et on retrouve
              // l'affichage précédent plutôt qu'une proportion inventée.
              width={article.imageWidth ?? undefined}
              height={article.imageHeight ?? undefined}
              decoding="async"
              // `h-auto` SEUL, jamais `w-auto` : c'est la recette qui réserve la
              // place. L'attribut `width` ci-dessus n'est qu'un indice de
              // présentation, de très faible priorité — une règle `width:auto`
              // l'écraserait, et plus aucun axe défini ne permettrait de tenir
              // la place avant le chargement. La largeur vient donc de
              // l'attribut, ramenée au conteneur par `max-w-full` ; la hauteur
              // se déduit de la proportion.
              //
              // `max-h` borne un visuel très haut (story 9/16), qui occuperait
              // sinon plus d'un écran avant même le titre : il rétrécit alors
              // des DEUX côtés (le calcul des tailles maximales d'une image
              // conserve sa proportion), et se centre. Il ne se coupe pas.
              // Pas de cadre autour : les coins arrondis suivent la photo.
              className="mb-6 mx-auto block h-auto max-w-full max-h-[70vh] rounded-2xl"
            />
          )}
          <header className="mb-6">
            {/* Chip du type de contenu, avant le titre : le même repère que sur
                la carte d'où l'on vient (home ou liste des actualités). */}
            {article.categorie && (
              <p className="mb-3">
                <TagBadge tag={article.categorie} />
              </p>
            )}
            <h1 className="text-3xl font-bold text-white">{article.titre}</h1>
            {(article.auteurNom || article.publieLe) && (
              <p className="text-sm text-gray-light mt-2">
                {/* Byline (lot N3) : le nom FIGÉ à la publication — il survit
                    au retrait de la fiche et à la suppression du compte
                    (droits cédés). Le LIEN, lui, n'existe que si sa fiche est
                    dans l'annuaire aujourd'hui. */}
                {article.auteurNom && (
                  <>
                    Par{" "}
                    {byline ? (
                      <LienTexte href={byline}>
                        {article.auteurNom}
                        <span className="sr-only"> (sa fiche dans l&apos;annuaire)</span>
                      </LienTexte>
                    ) : (
                      article.auteurNom
                    )}
                    {article.publieLe && " · "}
                  </>
                )}
                {article.publieLe && formatDateFr(article.publieLe, { dateStyle: "long" })}
              </p>
            )}
            {article.chapo && <p className="text-lg text-cream mt-4">{article.chapo}</p>}
          </header>

          {/* Lire OU regarder : la vidéo se propose avant le corps, pour que le
              choix se fasse au moment d'entrer dans la lecture. Le titre est
              déjà en H1 juste au-dessus — la façade se suffit, avec une seule
              ligne qui dit où mène le clic. */}
          {article.videoUrl && (
            <LienVideo
              href={article.videoUrl}
              titre={article.titre}
              // Première image de la page, juste sous le titre : on la charge
              // sans attendre plutôt que de la laisser en `lazy`.
              priorite
              className="mb-8"
            >
              <p className="px-4 py-3 text-sm font-semibold text-cyan group-hover:text-cyan-light transition-colors">
                {CTA_VIDEO}
              </p>
            </LienVideo>
          )}

          <MarkdownContenu corps={article.corps} />

          {/* CTA de fin d'article : un bouton (navigation → variant secondary,
              cf. principes-conception-ui) qui prolonge vers une source externe
              (nouvel onglet) ou une page du site. Rattacher un corps ne fait plus
              disparaître ce lien — il vit ici, hors du corps Markdown, distinct
              des liens inline du corps. Externe prioritaire (comme la carte). */}
          {ctaFin && (
            <div className="mt-10 pt-6 border-t border-navy-lighter">
              <Button
                href={ctaFin.href}
                external={ctaFin.externe || undefined}
                variant="secondary"
                className="gap-2"
              >
                {ctaFin.externe && <ExternalLinkIcon />}
                {ctaLabel}
              </Button>
            </div>
          )}
        </article>

        {/* Speakeuses de la conférence rattachée — dérivé du répertoire (BDD). */}
        <ConferenceSpeakers
          speakers={speakers}
          titleId="article-speakeuses-title"
        />
      </div>
    </>
  );
}
