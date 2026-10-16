import type { Metadata } from "next";
import Link from "next/link";
import { requireOrgaPage } from "@/lib/auth-guards";
import { listConferencesForAdmin, type AdminConference } from "@/lib/conferences";
import { countConferencePropositions } from "@/lib/conference-propositions";
import Breadcrumb from "@/components/Breadcrumb";
import Button from "@/components/Button";
import NavRow from "@/components/NavRow";
import ConfirmationBanner from "@/components/ConfirmationBanner";
import LienRetour from "@/components/LienRetour";
import { nb } from "@/lib/format";
import { seedCatalogueAction } from "./actions";

export const metadata: Metadata = {
  title: "Conférences | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/** Résumé lisible de l'activité d'une conférence (compteurs seuls, pas d'action). */
function resumeEditions(conf: AdminConference): string {
  const n = conf.editions.length;
  if (n === 0) return "aucun événement";
  const actives = conf.editions.filter((e) => e.actif).length;
  const base = `${n} événement${n > 1 ? "s" : ""}`;
  return actives > 0 ? `${base}, ${actives} moissonné${actives > 1 ? "s" : ""}` : base;
}

/**
 * Une conférence dans le hub : une LIGNE cliquable vers sa page dédiée. Le hub
 * ne porte que l'état (nom, ville, compteurs) ; corriger / gérer les éditions /
 * supprimer se font sur la page de la conférence (règle d'or : une page = un
 * rôle ; jamais de formulaires empilés sur une liste de consultation).
 */
function ConferenceLigne({ conf }: { conf: AdminConference }) {
  return (
    <li className="bg-navy-light border border-navy-lighter rounded-xl">
      <Link
        href={`/admin/conferences/${conf.slug}`}
        aria-label={`Gérer ${conf.nom}`}
        className="flex items-center justify-between gap-3 p-5 rounded-xl hover:bg-navy-lighter/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
      >
        <span className="min-w-0">
          <span className="font-bold text-white">{conf.nom}</span>{" "}
          <span className="text-xs font-normal text-gray-light">
            {conf.ville ? `${conf.ville} · ` : ""}
            {resumeEditions(conf)}
          </span>
        </span>
        <span className="text-sm text-cyan shrink-0">
          Gérer <span aria-hidden="true">→</span>
        </span>
      </Link>
    </li>
  );
}

/**
 * Hub de la référence des conférences (vue orga). RÔLE UNIQUE : consulter le
 * catalogue et choisir où aller. Un seul CTA de création (« Ajouter une
 * conférence ») ; toute la gestion d'un item vit sur sa page dédiée
 * (`/admin/conferences/[slug]`).
 *
 * L'arbitrage des propositions a sa page depuis le 2026-08-21
 * (`docs/conception-arbitrage-conferences.md`, défaut E) : il vivait ICI, en
 * cartes à deux boutons, et un import de portefeuille en a empilé 113 sur une
 * page de consultation. C'est l'erreur exacte que le registre des principes UI
 * note au 2026-07-11, et le point de bascule que la dette avait posé d'avance.
 */
export default async function AdminConferencesPage({
  searchParams,
}: {
  searchParams: Promise<{ supprimee?: string; seed?: string }>;
}) {
  await requireOrgaPage();

  const sp = await searchParams;
  const confirmation = sp.supprimee
    ? `« ${sp.supprimee} » a été retirée de la référence.`
    : sp.seed != null
      ? `Catalogue amorcé : ${sp.seed} conférence${Number(sp.seed) > 1 ? "s" : ""} ajoutée${Number(sp.seed) > 1 ? "s" : ""}.`
      : null;
  const [conferences, aArbitrer] = await Promise.all([
    listConferencesForAdmin(),
    countConferencePropositions(),
  ]);
  const confs = conferences.filter((c) => c.type !== "asso");
  const assos = conferences.filter((c) => c.type === "asso");

  return (
    <>
      <Breadcrumb
        items={[{ label: "Espace organisatrices", href: "/admin" }, { label: "Conférences" }]}
      />
      <div className="py-10 px-4">
        <section className="max-w-3xl mx-auto" aria-labelledby="conf-title">
          <div className="mb-8">
            <h1 id="conf-title" className="text-2xl font-bold mb-2">
              <span className="text-magenta">Conférences référencées</span>
            </h1>
            {confirmation && <ConfirmationBanner message={confirmation} />}
            <p className="text-sm text-gray-light">
              La référence partagée : proposée aux speakeuses à la saisie d&apos;un
              talk, moissonnée quand une édition porte un id d&apos;endpoint
              Sessionize actif. Ouvre une conférence pour la corriger, gérer ses
              éditions ou activer la moisson.
            </p>
          </div>

          {/* L'arbitrage vit sur SA page : ici, une rangée qui dit le compte
              et y mène. Le nombre plutôt qu'un point, parce qu'il change la
              décision — 2 s'arbitrent d'affilée, 113 se planifient (principes
              UI, § listes). */}
          <div className="mb-8">
            <NavRow
              href="/admin/conferences/propositions"
              title={
                aArbitrer > 0
                  ? `Conférences proposées (${aArbitrer})`
                  : "Conférences proposées"
              }
              subtitle={
                aArbitrer > 0
                  ? `${nb(aArbitrer, "conférence")} proposée${aArbitrer > 1 ? "s" : ""} par des membres, à valider ou à écarter`
                  : "Rien en attente. Tout roule."
              }
              flag={aArbitrer > 0}
            />
          </div>

          {conferences.length === 0 && (
            <section
              aria-labelledby="seed-title"
              className="mb-8 rounded-xl border border-navy-lighter bg-navy-light/60 p-5"
            >
              {/* Ni capitales forcées, ni interlettrage élargi, ni 12 px : une
                  étiquette qui structure est le texte le PLUS lisible de
                  l'écran (principes UI, § Ce qui se lit). C'était le jumeau du
                  titre que ce lot a retiré avec le mur d'arbitrage — le laisser
                  aurait gardé ce fichier inscrit dans les `RESTANTS` de
                  `typographie-lisible.test.ts` pour une seule ligne. */}
              <h2 id="seed-title" className="text-sm font-bold text-cream mb-2">
                Amorcer le catalogue
              </h2>
              <p className="text-sm text-gray-light mb-3">
                Insère les principales conférences tech et product/UX de France et
                les communautés toulousaines (rejouable, ne réécrit rien).
              </p>
              <form action={seedCatalogueAction}>
                <Button type="submit" size="sm">
                  Amorcer le catalogue France
                </Button>
              </form>
            </section>
          )}

          {/* CTA unique du hub : la création vit sur sa page dédiée (règle d'or :
              pas de formulaire sur une page de consultation). Masqué à l'état
              vide, où « Amorcer le catalogue » est la bonne première action. */}
          {conferences.length > 0 && (
            <div className="mb-8">
              <Link
                href="/admin/conferences/nouvelle"
                className="inline-flex items-center min-h-[44px] rounded-lg bg-cyan px-4 py-2 text-sm font-semibold text-navy hover:bg-cyan-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-navy"
              >
                Ajouter une conférence
              </Link>
            </div>
          )}

          <section aria-labelledby="confs-title" className="mb-10">
            <h2 id="confs-title" className="text-lg font-bold text-white mb-3">
              Conférences{" "}
              <span className="text-gray-light font-normal">({confs.length})</span>
            </h2>
            {confs.length === 0 ? (
              <p className="text-sm text-gray-light">
                Aucune conférence référencée pour le moment.
              </p>
            ) : (
              <ul className="flex flex-col gap-3 list-none">
                {confs.map((c) => (
                  <ConferenceLigne key={c.id} conf={c} />
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="assos-title" className="mb-10">
            <h2 id="assos-title" className="text-lg font-bold text-white mb-3">
              Associations &amp; communautés{" "}
              <span className="text-gray-light font-normal">({assos.length})</span>
            </h2>
            <p className="text-sm text-gray-light mb-3">
              Leurs meetups sont synchronisés chaque jour depuis le Toulouse Tech
              Hub et proposés aux speakeuses à la saisie d&apos;un talk. Rien à
              moissonner ici.
            </p>
            {assos.length === 0 ? (
              <p className="text-sm text-gray-light">Aucune association référencée.</p>
            ) : (
              <ul className="flex flex-col gap-3 list-none">
                {assos.map((c) => (
                  <ConferenceLigne key={c.id} conf={c} />
                ))}
              </ul>
            )}
          </section>

          <footer className="mt-10 text-xs text-gray-light">
            <p>
              Sources du catalogue&nbsp;:{" "}
              <a
                href="https://developers.events/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded"
              >
                developers.events
                <span className="sr-only"> (nouvelle fenêtre)</span>
              </a>{" "}
              (CC BY-NC 4.0) et{" "}
              <a
                href="https://toulouse-tech-hub.fr/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded"
              >
                Toulouse Tech Hub
                <span className="sr-only"> (nouvelle fenêtre)</span>
              </a>{" "}
              (MIT). Merci à elles&nbsp;!
            </p>
            <div className="mt-2">
              <LienRetour href="/admin" label="Retour à l'espace organisatrices" />
            </div>
          </footer>
        </section>
      </div>
    </>
  );
}
