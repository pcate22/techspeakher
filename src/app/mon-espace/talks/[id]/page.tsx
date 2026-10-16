import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getProfileByUserId } from "@/lib/profiles";
import { getTalkById } from "@/lib/talks";
import { nb } from "@/lib/format";
import Breadcrumb from "@/components/Breadcrumb";
import ConfirmationBanner from "@/components/ConfirmationBanner";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import TalkForm from "../../TalkForm";
import TalkConferences from "../../TalkConferences";
import { deleteTalkAction } from "../../actions";

export const metadata: Metadata = {
  title: "Modifier un talk | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

const OK_MESSAGES: Record<string, string> = {
  talk_ajoute: "Talk créé. Rattache maintenant les conférences où tu l'as donné.",
  talk_modifie: "Talk mis à jour ✓",
  conf_ajoutee: "Conférence ajoutée ✓",
  conf_modifiee: "Conférence mise à jour ✓",
  conf_retiree: "Conférence retirée ✓",
  // Conférence hors répertoire : la saisie EST enregistrée, seule sa mise en
  // ligne attend l'arbitrage — le message le dit dans cet ordre. Il décrit un
  // ÉTAT, pas un envoi : des trois chemins qui mènent ici, un seul dépose une
  // demande neuve (les deux autres corrigent ou rejoignent une demande déjà en
  // file). « part en validation » était donc faux deux fois sur trois. Mêmes
  // mots que le bandeau de l'écran d'édition : un seul vocabulaire par concept.
  conf_proposee:
    "Saisie enregistrée ✓ Cette conférence attend la validation de l'équipe : elle rejoint ta fiche publique dès que c'est fait.",
};

export default async function ModifierTalk({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/connexion");

  const profile = await getProfileByUserId(Number(session.user.id));
  if (!profile) redirect("/mon-espace/talks");

  const { id } = await params;
  const talkId = Number(id);
  const talk = Number.isFinite(talkId) ? await getTalkById(talkId, profile.id) : null;
  if (!talk) redirect("/mon-espace/talks");

  // Périmètre de la cascade, accordé : « ses 1 conférence » se lisait mal, et
  // c'est le cas le plus courant (un talk donné une seule fois).
  const nbConfs = talk.occurrences.length;
  const apercuSuppression =
    nbConfs === 0
      ? "Supprimer définitivement ce talk."
      : nbConfs === 1
        ? "Supprimer définitivement ce talk et sa conférence."
        : `Supprimer définitivement ce talk et ses ${nb(nbConfs, "conférence")}.`;
  const consequenceSuppression =
    nbConfs === 0
      ? "Le talk part de ta fiche et de l'annuaire. Action irréversible."
      : `Le talk part de ta fiche et de l'annuaire, avec ${
          nbConfs === 1 ? "la conférence" : `les ${nb(nbConfs, "conférence")}`
        } où tu l'as donné. Action irréversible.`;

  const { ok } = await searchParams;
  const okMsg = ok ? OK_MESSAGES[ok] : null;

  return (
    <>
      {/* Le fil nomme le talk (comme le fait déjà la sous-page conférence) :
          « Modifier » seul ne disait pas QUOI on éditait. */}
      <Breadcrumb
        items={[
          { label: "Mon espace", href: "/mon-espace" },
          { label: "Mes talks", href: "/mon-espace/talks" },
          { label: talk.titre },
        ]}
      />
      <div className="py-10 px-4">
        <div className="max-w-2xl mx-auto flex flex-col gap-6">
          {okMsg && <ConfirmationBanner message={okMsg} />}

          <section
            aria-labelledby="modifier-talk-title"
            className="bg-navy-light border border-navy-lighter rounded-2xl p-5 sm:p-8"
          >
            <h1 id="modifier-talk-title" className="text-2xl font-bold mb-6">
              <span className="text-magenta">Modifier</span> le talk
            </h1>

            <TalkForm initial={talk} />

            {/* Zone danger, à la même place que sur la page d'une conférence
                du talk : sous le formulaire, séparée du CTA par un filet.
                Confirmation à emphase inversée (« Annuler » porte le poids et
                reçoit le focus) : le clic réflexe ne détruit rien, ce qui suffit
                ici. Retaper le titre serait plus lourd que pour supprimer son
                COMPTE, geste bien plus grave — l'échelle serait à l'envers. */}
            <div className="mt-8 pt-6 border-t border-navy-lighter">
              <p className="text-sm text-gray-light mb-3">{apercuSuppression}</p>
              <form action={deleteTalkAction}>
                <input type="hidden" name="talkId" value={talk.id} />
                <ConfirmSubmitButton
                  title="Supprimer ce talk ?"
                  message={consequenceSuppression}
                  confirmLabel="Supprimer définitivement"
                  pendingLabel="Suppression…"
                  variant="ghost"
                  className="!text-orange hover:!text-orange px-0 min-h-[44px]"
                >
                  Supprimer ce talk
                </ConfirmSubmitButton>
              </form>
            </div>
          </section>

          <TalkConferences talk={talk} />
        </div>
      </div>
    </>
  );
}
