import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import LienTexte from "@/components/LienTexte";
import { auth } from "@/auth";
import { getMonArticle } from "@/lib/articles-membres";
import Breadcrumb from "@/components/Breadcrumb";
import Button from "@/components/Button";
import ConfirmationBanner from "@/components/ConfirmationBanner";
import ArticleForm from "../ArticleForm";
import { majArticleAction, soumettreArticleAction } from "../actions";

export const metadata: Metadata = {
  title: "Mon article | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

const CONFIRMATIONS: Record<string, string> = {
  cree: "Brouillon enregistré. Soumets-le quand il te plaît.",
  enregistre: "C'est enregistré.",
};

/**
 * LA page d'UN de ses articles (lot N3, maquette validée) — un seul rôle à la
 * fois, selon le statut :
 *
 * - brouillon : l'éditeur, le motif d'un renvoi éventuel, et LA soumission —
 *   avec la cession de droits en toutes lettres (tranché le 2026-08-08 :
 *   zéro anonymisation, l'article signé survit au compte) ;
 * - en relecture : il est chez l'orga, rien à presser ;
 * - publié : le lien vers l'article public.
 */
export default async function MonArticle({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/connexion");

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const { ok } = await searchParams;

  // Le SIEN, jamais celui d'une autre (borne SQL sur l'id de session).
  const article = await getMonArticle(id, Number(session.user.id));
  if (!article) notFound();

  const confirmation = ok ? CONFIRMATIONS[ok] : undefined;

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Mon profil", href: "/mon-espace/profil" },
          { label: "Mes articles", href: "/mon-espace/articles" },
          { label: article.titre },
        ]}
      />
      {/* <div>, pas <main> : le layout racine fournit déjà le landmark principal. */}
      <div className="py-10 px-4">
        <section aria-labelledby="article-title" className="max-w-2xl mx-auto flex flex-col gap-4">
          <h1 id="article-title" className="text-2xl font-bold">
            {article.titre}
          </h1>

          {confirmation && <ConfirmationBanner message={confirmation} />}

          {article.statut === "brouillon" && (
            <>
              {article.relectureMotif && (
                <p
                  role="alert"
                  className="text-sm text-orange bg-orange/10 border border-orange/30 rounded-lg px-4 py-3"
                >
                  Une organisatrice te l&apos;a renvoyé&nbsp;: {article.relectureMotif}
                </p>
              )}
              <ArticleForm action={majArticleAction} initial={article} />

              {/* LA soumission, et la cession de droits EN TOUTES LETTRES
                  juste au-dessus du geste — jamais dans une page à part. */}
              <div className="mt-4 rounded-2xl border border-navy-lighter bg-navy-light p-5">
                <p className="text-sm text-gray-light mb-4">
                  En soumettant, tu autorises Tech Speak&apos;Her à publier ton
                  article sous ton nom — il reste en ligne même si tu retires
                  ta fiche ou fermes ton compte. Une organisatrice le relit avant
                  publication.
                </p>
                <form action={soumettreArticleAction}>
                  <input type="hidden" name="id" value={article.id} />
                  <Button type="submit" size="sm">
                    Soumettre à la relecture
                  </Button>
                </form>
              </div>
            </>
          )}

          {article.statut === "en_relecture" && (
            <p className="text-sm text-gray-light bg-navy-light border border-navy-lighter rounded-2xl p-6">
              Ton article est chez l&apos;équipe organisatrice, en relecture avant publication
              — comme une fiche. Il revient vers toi avec un motif s&apos;il y
              a quoi que ce soit à reprendre.
            </p>
          )}

          {article.statut === "publie" && (
            <p className="text-sm text-gray-light">
              Publié — le voir comme tout le monde&nbsp;:{" "}
              <LienTexte
                href={`/articles/${article.slug}`}
                className="inline-flex min-h-[44px] items-center"
              >
                /articles/{article.slug}
              </LienTexte>
            </p>
          )}
        </section>
      </div>
    </>
  );
}
