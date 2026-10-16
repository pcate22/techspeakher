import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getProfileByUserId } from "@/lib/profiles";
import { getTalksByProfileId } from "@/lib/talks";
import { getPendingSuggestions } from "@/lib/cfp-suggestions";
import Breadcrumb from "@/components/Breadcrumb";
import TalksActions from "../TalksActions";
import ConfirmationBanner from "@/components/ConfirmationBanner";
import MoissonneurExplainer from "@/components/MoissonneurExplainer";
import TalksManager from "../TalksManager";
import TalkSuggestions from "../TalkSuggestions";
import ReperageTools from "../ReperageTools";

export const metadata: Metadata = {
  title: "Mes talks | Tech Speak'Her",
  robots: { index: false },
  alternates: { canonical: "/mon-espace/talks" },
};

export const dynamic = "force-dynamic";
// « Lancer le repérage » enchaîne des fetchs Sessionize (10 s de timeout
// chacun) : on laisse de la marge au-delà des 10 s par défaut de Vercel.
export const maxDuration = 60;

/**
 * Talks de la speakeuse — page dédiée (spoke du hub « Mon espace »). C'est ici
 * que vit la gestion des talks, le repérage automatique et les suggestions à
 * confirmer, plutôt que d'empiler ces trois domaines sur le tableau de bord.
 */
export default async function MesTalks({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/connexion");
  const uid = Number(session.user.id);

  const profile = await getProfileByUserId(uid);
  // Sans fiche, la gestion des talks n'a pas de sens : on renvoie créer la fiche.
  if (!profile) redirect("/mon-espace/fiche");

  const { ok } = await searchParams;
  // Création et modification confirment sur la page DU talk (on y reste) :
  // seule la suppression atterrit ici, faute de talk où revenir.
  const okMsg = ok === "talk_supprime" ? "Talk supprimé ✓" : null;

  // Les suggestions ne doivent jamais casser la page (ex. table pas encore
  // migrée) : en cas d'erreur, section vide.
  const [talks, suggestions] = await Promise.all([
    getTalksByProfileId(profile.id),
    getPendingSuggestions(profile.id).catch((err) => {
      console.error("Suggestions indisponibles", err);
      return [];
    }),
  ]);

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Mon espace", href: "/mon-espace" },
          { label: "Mes talks" },
        ]}
      />
      <div className="py-10 px-4">
        <div className="max-w-2xl mx-auto flex flex-col gap-6">
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Mes talks</h1>
              <p className="text-sm text-gray-light mt-1">
                Tes talks au fil de l&apos;année, passés ou à venir. Ils
                s&apos;affichent sur ta fiche publique.
              </p>
            </div>
            {/* La paire d'actions au complet dans l'en-tête, SEULEMENT quand
                il y a des talks : fiche vide, c'est la carte qui l'accueille
                (TalksManager) — jamais les deux à la fois. Le chemin « avec
                talks » est gardé par l'E2E d'import, qui clique ce lien. */}
            {talks.length > 0 && <TalksActions size="sm" />}
          </header>

          {okMsg && <ConfirmationBanner message={okMsg} />}

          {/* Talks repérés par le moissonneur CFP, à confirmer en un clic. */}
          <TalkSuggestions suggestions={suggestions} />

          {/* Talks */}
          <section
            aria-labelledby="talks-title"
            className="bg-navy-light border border-navy-lighter rounded-2xl p-6"
          >
            <h2 id="talks-title" className="sr-only">
              Liste de mes talks
            </h2>
            <TalksManager talks={talks} />
          </section>

          {/* Repérage automatique — explication + repérage à la demande. */}
          <section
            aria-labelledby="moissonneur-title"
            className="bg-navy-light border border-navy-lighter rounded-2xl p-6"
          >
            <h2
              id="moissonneur-title"
              className="text-xs font-bold uppercase tracking-wider text-gray-light mb-3"
            >
              Repérage automatique de tes talks
            </h2>
            <MoissonneurExplainer />
            <ReperageTools />
          </section>

          {/* Rappel semestriel. */}
          <p className="text-sm text-gray-light bg-navy-light border border-dashed border-navy-lighter rounded-2xl p-4">
            🔔 On t&apos;enverra un petit rappel tous les 6 mois pour ajouter tes
            prochaines dates de talk. Reviens quand tu veux, tout reste en ligne.
          </p>
        </div>
      </div>
    </>
  );
}
