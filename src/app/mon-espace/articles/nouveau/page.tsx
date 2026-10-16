import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import Breadcrumb from "@/components/Breadcrumb";
import ArticleForm from "../ArticleForm";
import { creerArticleAction } from "../actions";

export const metadata: Metadata = {
  title: "Écrire un article | Tech Speak'Her",
  robots: { index: false },
  alternates: { canonical: "/mon-espace/articles/nouveau" },
};

export const dynamic = "force-dynamic";

/**
 * Écrire (lot N3, maquette validée) : l'éditeur SIMPLE d'une membre — le
 * brouillon d'abord, la soumission (et la cession de droits, dite en toutes
 * lettres) sur la page de l'article. Une page = un rôle : ici, écrire.
 */
export default async function EcrireArticle() {
  const session = await auth();
  if (!session?.user?.id) redirect("/connexion");

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Mon profil", href: "/mon-espace/profil" },
          { label: "Mes articles", href: "/mon-espace/articles" },
          { label: "Écrire" },
        ]}
      />
      {/* <div>, pas <main> : le layout racine fournit déjà le landmark principal. */}
      <div className="py-10 px-4">
        <section aria-labelledby="ecrire-title" className="max-w-2xl mx-auto">
          <h1 id="ecrire-title" className="text-2xl font-bold mb-2">
            <span className="text-magenta">Écrire</span> un article
          </h1>
          <p className="text-sm text-gray-light mb-6">
            Une astuce, un retour d&apos;expérience, un conseil&nbsp;: ce qui
            t&apos;aurait aidée, aidera une autre. Tu enregistres un brouillon,
            tu le soumets quand il te plaît — une organisatrice le relit avant
            publication.
          </p>
          <ArticleForm action={creerArticleAction} initial={null} />
        </section>
      </div>
    </>
  );
}
