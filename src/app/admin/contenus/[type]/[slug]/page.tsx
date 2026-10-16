import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrgaPage } from "@/lib/auth-guards";
import { getContenuBySlug } from "@/lib/contenus";
import { getCompte } from "@/lib/users";
import { renvoyerArticleAction } from "../../actions";
import Button from "@/components/Button";
import { lienPublicContenu } from "@/lib/contenu-lien-public";
import { listEditionOptions } from "@/lib/conferences";
import { getSpeakerMentionItems } from "@/lib/profiles";
import Breadcrumb from "@/components/Breadcrumb";
import ConfirmationBanner from "@/components/ConfirmationBanner";
import LienRetour from "@/components/LienRetour";
import Editeur from "./Editeur";

export const metadata: Metadata = {
  title: "Éditer un contenu | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function EditerContenuPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string; slug: string }>;
  searchParams: Promise<{
    cree?: string;
    publie?: string;
    brouillon?: string;
    renomme?: string;
    renvoye?: string;
    motif_requis?: string;
    deja_traite?: string;
  }>;
}) {
  await requireOrgaPage();
  const { type, slug } = await params;
  if (type !== "publication" && type !== "page") notFound();
  const contenu = await getContenuBySlug(slug);
  if (!contenu || contenu.type !== type) notFound();

  // Deux lectures indépendantes, en parallèle :
  // - éditions rattachables (répertoire), l'édition déjà rattachée garantie dans
  //   la liste (cf. listEditionOptions) ;
  // - speakeuses mentionnables (« @ » dans le corps), annuaire publié seulement,
  //   chargées côté serveur (pas de fetch client) : prêtes au rendu.
  const [editions, mentions] = await Promise.all([
    listEditionOptions(contenu.conferenceEditionId).catch(() => []),
    getSpeakerMentionItems().catch(() => []),
  ]);

  const sp = await searchParams;
  const confirmation = sp.cree
    ? "Contenu créé. Rédige-le puis publie-le quand il est prêt."
    : sp.renomme
      ? "Titre modifié : l'adresse a été mise à jour."
      : sp.publie
        ? "Publié. Il est maintenant visible sur le site."
        : sp.brouillon
          ? "Repassé en brouillon. Redevient visible de toi seule."
          : sp.renvoye
            ? "Renvoyé à son autrice, motif à l'appui."
            : null;

  // L'article d'une membre en RELECTURE (lot N3) : le nom vivant du compte
  // (le snapshot n'est figé qu'à la publication).
  const enRelecture = contenu.statut === "en_relecture";
  const autrice = enRelecture && contenu.auteurUserId
    ? (await getCompte(contenu.auteurUserId))?.name ?? null
    : null;

  const estPub = contenu.type === "publication";
  const estPublie = contenu.statut === "publie";
  // Lien public (source unique) : article → sa page, annonce → /actualites,
  // page → son slug. `null` si brouillon (pas encore de page publique).
  const lienPublic = lienPublicContenu(contenu);

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Espace organisatrices", href: "/admin" },
          { label: "Contenus", href: "/admin/contenus" },
          { label: contenu.titre },
        ]}
      />
      <div className="py-10 px-4">
        <section className="max-w-2xl mx-auto" aria-labelledby="editer-title">
          <h1 id="editer-title" className="text-2xl font-bold mb-2">
            {contenu.titre}
          </h1>
          <p className="text-sm text-gray-light mb-4 flex flex-wrap items-center gap-2">
            <span>
              {/* « Actualité », jamais « publication » à l'écran (vocabulaire
                  unifié, lot N3) — et l'état en relecture se dit. */}
              {estPub ? "Actualité" : "Page"} ·{" "}
              {estPublie
                ? "Publiée"
                : enRelecture
                  ? "En relecture : l'article d'une membre."
                  : "Brouillon : visible de toi seule."}
            </span>
            {lienPublic && (
              <Link
                href={lienPublic}
                className="text-cyan hover:text-cyan-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded"
              >
                Voir sur le site <span aria-hidden="true">→</span>
              </Link>
            )}
          </p>
          {confirmation && <ConfirmationBanner message={confirmation} />}
          {/* Course perdue : une autre orga a publié ou renvoyé pendant que le
              formulaire de renvoi était ouvert — le renvoi a écrit zéro ligne. */}
          {sp.deja_traite && (
            <p
              role="alert"
              className="mb-4 text-sm text-orange bg-orange/10 border border-orange/30 rounded-lg px-4 py-3"
            >
              Rien à renvoyer&nbsp;: cet article a déjà été traité entre-temps
              (l&apos;état ci-dessous fait foi).
            </p>
          )}

          {/* Bandeau de RELECTURE (lot N3) : l'article d'une membre attend une
              orga. Publier = le CTA de l'éditeur ci-dessous (le nom sera figé
              à la publication) ; renvoyer exige un MOTIF — la charte : la
              forme évidente se corrige, le fond se renvoie. */}
          {enRelecture && (
            <section
              aria-labelledby="relecture-titre"
              className="mb-6 rounded-2xl border border-gold/40 bg-gold/8 p-5"
            >
              <h2
                id="relecture-titre"
                className="text-xs font-bold uppercase tracking-wider text-gold mb-2"
              >
                En relecture
              </h2>
              <p className="text-sm mb-4">
                {autrice
                  ? `L'article de ${autrice}.`
                  : "L'article d'une membre."}{" "}
                Relis-le, corrige la forme évidente — le fond se renvoie avec
                un motif. Publier (bouton de l&apos;éditeur) le signe de son nom et
                l&apos;annonce dans le fil et les actualités.
              </p>
              {sp.motif_requis && (
                <p role="alert" className="text-sm text-orange mb-3">
                  Un renvoi dit son motif : écris-le ci-dessous.
                </p>
              )}
              <form action={renvoyerArticleAction} className="flex flex-col gap-3">
                <input type="hidden" name="contenuId" value={contenu.id} />
                <input type="hidden" name="slug" value={contenu.slug} />
                <label htmlFor="motif-renvoi" className="text-sm font-medium">
                  Motif du renvoi
                </label>
                <textarea
                  id="motif-renvoi"
                  name="motif"
                  rows={2}
                  required
                  className="w-full rounded-lg border border-field-border bg-navy px-3 py-2.5 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
                />
                <div>
                  <Button type="submit" variant="secondary" size="sm">
                    Renvoyer à son autrice
                  </Button>
                </div>
              </form>
            </section>
          )}

          {/* Publier / enregistrer vivent dans le CTA du bas de l'éditeur (pas
              besoin de remonter) ; l'action enregistre toujours avant de publier. */}
          <Editeur contenu={contenu} editions={editions} mentions={mentions} />

          <p className="mt-8 pt-4 border-t border-navy-lighter">
            <Link
              href={`/admin/contenus/${contenu.type}/${contenu.slug}/supprimer`}
              className="inline-flex items-center min-h-[44px] text-sm text-orange underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange rounded"
            >
              Supprimer ce contenu
            </Link>
          </p>

          <LienRetour href="/admin/contenus" label="Tous les contenus" />
        </section>
      </div>
    </>
  );
}
