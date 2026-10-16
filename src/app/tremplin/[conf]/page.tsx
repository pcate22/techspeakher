import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";
import EditionListItem from "@/components/EditionListItem";
import { BASE_URL } from "@/constants/site";
import { getEditionsByConfSlug, listEditions } from "@/lib/tremplin-editions";
import { confDedicatedPage, nomConference } from "@/lib/tremplin-conf";

export const revalidate = 300;

type Params = { conf: string };

// Pré-rend les hubs de conf connus au build → l'ISR (`revalidate`) prend effet
// (sinon la route reste rendue à la demande à chaque requête). On exclut les
// confs à page dédiée (elles redirigent) et les éditions en préparation (non
// publiques). Résilient : base indisponible au build → rendu à la demande.
export async function generateStaticParams(): Promise<Params[]> {
  try {
    const editions = await listEditions();
    const slugs = new Set(
      editions
        .filter(
          (e) =>
            e.confSlug != null &&
            e.statut !== "preparation" &&
            !confDedicatedPage(e.confSlug),
        )
        .map((e) => e.confSlug as string),
    );
    return [...slugs].map((conf) => ({ conf }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { conf } = await params;
  const editions = await getEditionsByConfSlug(conf);
  const nom = nomConference(editions[0]?.confNom, editions[0]?.confLieu) || "Conférence";
  return {
    title: `Le Tremplin × ${nom} | Tech Speak'Her`,
    description: `Les éditions du Tremplin Tech Speak'Her organisées avec ${nom}.`,
    alternates: { canonical: `/tremplin/${conf}` },
    openGraph: { title: `Le Tremplin × ${nom} | Tech Speak'Her`, type: "website", url: `${BASE_URL}/tremplin/${conf}` },
  };
}

export default async function ConfPage({ params }: { params: Promise<Params> }) {
  const { conf } = await params;
  // Conf avec page éditoriale dédiée (ex. DevFest) → on y renvoie : c'est elle
  // le hub des éditions, pas de doublon générique. Cf. lib/tremplin-conf.ts.
  const dedicated = confDedicatedPage(conf);
  if (dedicated) permanentRedirect(dedicated);
  const editions = await getEditionsByConfSlug(conf);
  if (editions.length === 0) notFound();
  const nom = nomConference(editions[0].confNom, editions[0].confLieu) || "Conférence";
  const pluriel = editions.length > 1;

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Accueil", href: "/" },
          { label: "Tremplin", href: "/tremplin" },
          { label: nom },
        ]}
      />
      <section aria-labelledby="conf-title" className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <p className="text-sm font-semibold text-cyan uppercase tracking-wide mb-4">Conférence partenaire</p>
          <h1 id="conf-title" className="text-3xl sm:text-4xl font-extrabold mb-4 text-balance">
            Le <span className="text-cyan">Tremplin</span> × {nom}
          </h1>
          <p className="text-gray-light max-w-2xl mb-10 leading-relaxed">
            Chaque année, le Tremplin Tech Speak&apos;Her accompagne des
            femmes de la tech jusqu&apos;à la scène de {nom}.{" "}
            {pluriel ? "Voici les éditions." : "Voici l'édition."}
          </p>

          <ul role="list" className="flex flex-col gap-3 list-none">
            {editions.map((e) => (
              <EditionListItem key={e.id} edition={e} confSlug={conf} />
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
