import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";
import { MarkdownContenu } from "@/lib/markdown";
import { getContenuPublieBySlug, type Contenu } from "@/lib/contenus";
import { BASE_URL } from "@/constants/site";
import { ASSOCIATION } from "@/data/association";

export const dynamic = "force-dynamic";

/**
 * Page éditoriale autonome (contenu de type `page`, à slug fixe : ex.
 * /plan-du-site). Sert le pendant public de l'admin `contenus` — sans quoi une
 * page publiée n'aurait aucune URL (lien « Voir sur le site » vers un 404, cf.
 * `listPagesPubliees` dans le sitemap). Les routes statiques (/a-propos…) et
 * les articles (/articles/[slug]) gardent la priorité : ce segment ne capte que
 * les chemins d'un seul niveau non déjà servis.
 */
async function chargerPage(slug: string): Promise<Contenu | null> {
  try {
    const c = await getContenuPublieBySlug(slug);
    return c && c.type === "page" ? c : null;
  } catch {
    // Ce segment capte TOUT chemin d'un seul niveau non déjà servi : si la base
    // est indisponible (ou absente, ex. en CI), on traite comme « page absente »
    // → notFound() rend le 404 habituel, au lieu de planter chaque URL inconnue.
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await chargerPage(slug);
  if (!page) return { title: "Page | Tech Speak'Her", robots: { index: false } };

  const title = `${page.titre} | Tech Speak'Her`;
  const description = page.chapo ?? undefined;
  const canonical = `/${page.slug}`;
  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      title,
      description,
      url: `${BASE_URL}${canonical}`,
      images: page.imageUrl
        ? [{ url: page.imageUrl, alt: page.imageAlt ?? page.titre }]
        : undefined,
    },
  };
}

export default async function PageContenu({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await chargerPage(slug);
  if (!page) notFound();

  // JSON-LD WebPage (SEO). `<` échappé : un « </script> » dans le contenu
  // fermerait la balise et exécuterait la suite (XSS stocké).
  const pageLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: page.titre,
    description: page.chapo ?? undefined,
    image: page.imageUrl ?? undefined,
    dateModified: page.majLe,
    publisher: { "@type": "Organization", name: ASSOCIATION.nom },
    mainEntityOfPage: `${BASE_URL}/${page.slug}`,
    inLanguage: "fr-FR",
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(pageLd).replace(/</g, "\\u003c"),
        }}
      />
      <Breadcrumb items={[{ label: "Accueil", href: "/" }, { label: page.titre }]} />
      <div className="py-10 px-4">
        <article className="max-w-2xl mx-auto">
          <header className="mb-6">
            <h1 className="text-3xl font-bold text-white">{page.titre}</h1>
            {page.chapo && <p className="text-lg text-cream mt-4">{page.chapo}</p>}
          </header>

          <MarkdownContenu corps={page.corps} />
        </article>
      </div>
    </>
  );
}
