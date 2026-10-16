import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listMesArticles } from "@/lib/articles-membres";
import { dateLongueFr } from "@/lib/format";
import Breadcrumb from "@/components/Breadcrumb";
import Button from "@/components/Button";
import ConfirmationBanner from "@/components/ConfirmationBanner";
import NavRow from "@/components/NavRow";

export const metadata: Metadata = {
  title: "Mes articles | Tech Speak'Her",
  robots: { index: false },
  alternates: { canonical: "/mon-espace/articles" },
};

export const dynamic = "force-dynamic";

/** L'état d'un article, EN MOTS (jamais la couleur seule, RGAA 3.1). */
function sousTitre(a: {
  statut: "brouillon" | "en_relecture" | "publie";
  publieLe: string | null;
  relectureMotif: string | null;
}): { texte: string; flag: boolean } {
  if (a.statut === "publie")
    return {
      texte: a.publieLe ? `Publié · ${dateLongueFr(a.publieLe)}` : "Publié",
      flag: false,
    };
  if (a.statut === "en_relecture")
    return { texte: "En relecture chez l’équipe organisatrice", flag: false };
  if (a.relectureMotif)
    return { texte: `Renvoyé avec un motif : ${a.relectureMotif}`, flag: true };
  return { texte: "Brouillon", flag: false };
}

/**
 * « Mes articles » (lot N3, maquette validée) : suivre ses statuts, reprendre
 * un brouillon, lire un motif de renvoi. L'écriture démarre au ➕ de la barre
 * (ou au bouton d'ici) ; UNE rangée = UN article, sa page porte le reste.
 */
export default async function MesArticles({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/connexion");
  const { ok } = await searchParams;

  const articles = await listMesArticles(Number(session.user.id));

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Mon profil", href: "/mon-espace/profil" },
          { label: "Mes articles" },
        ]}
      />
      {/* <div>, pas <main> : le layout racine fournit déjà le landmark principal. */}
      <div className="py-10 px-4">
        <section aria-labelledby="articles-title" className="max-w-2xl mx-auto flex flex-col gap-4">
          <h1 id="articles-title" className="text-2xl font-bold">
            <span className="text-magenta">Mes</span> articles
          </h1>

          {ok === "soumis" && (
            <ConfirmationBanner message="Ton article est chez l’équipe organisatrice : une relecture avant publication, comme pour la fiche." />
          )}

          {articles.length > 0 ? (
            <ul role="list" className="flex flex-col gap-3 list-none">
              {articles.map((a) => {
                const st = sousTitre(a);
                return (
                  <li key={a.id}>
                    <NavRow
                      href={`/mon-espace/articles/${a.id}`}
                      title={a.titre}
                      subtitle={st.texte}
                      flag={st.flag}
                      titleClamp={2}
                    />
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-gray-light bg-navy-light border border-navy-lighter rounded-2xl p-6">
              Une astuce, un retour d&apos;expérience, un conseil de
              speakeuse&nbsp;: ton premier article alimentera le fil et les
              actualités du site, après relecture par une organisatrice.
            </p>
          )}

          <div>
            <Button href="/mon-espace/articles/nouveau" size="sm">
              Écrire un article
            </Button>
          </div>
        </section>
      </div>
    </>
  );
}
