import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getProfileByUserId } from "@/lib/profiles";
import { getTalkById, getOccurrenceById, getOccurrenceSuggestions } from "@/lib/talks";
import { getAideSlidesHref } from "@/lib/contenus";
import { removeOccurrenceAction } from "../../../../actions";
import Breadcrumb from "@/components/Breadcrumb";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import OccurrenceForm from "../../../../OccurrenceForm";

export const metadata: Metadata = {
  title: "Modifier une conférence | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function ModifierConference({
  params,
}: {
  params: Promise<{ id: string; occId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/connexion");

  const profile = await getProfileByUserId(Number(session.user.id));
  if (!profile) redirect("/mon-espace/talks");

  const { id, occId } = await params;
  const talkId = Number(id);
  const occurrenceId = Number(occId);
  const [talk, occurrence, suggestions, aideSlidesHref] = await Promise.all([
    Number.isFinite(talkId) ? getTalkById(talkId, profile.id) : Promise.resolve(null),
    Number.isFinite(occurrenceId)
      ? getOccurrenceById(occurrenceId, profile.id)
      : Promise.resolve(null),
    getOccurrenceSuggestions(),
    getAideSlidesHref(),
  ]);
  if (!talk || !occurrence) redirect(`/mon-espace/talks/${talkId}`);

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Mon espace", href: "/mon-espace" },
          { label: "Mes talks", href: "/mon-espace/talks" },
          { label: talk.titre, href: `/mon-espace/talks/${talk.id}` },
          { label: "Modifier une conférence" },
        ]}
      />
      <div className="py-10 px-4">
        <section
          aria-labelledby="modifier-conf-title"
          className="max-w-2xl mx-auto bg-navy-light border border-navy-lighter rounded-2xl p-5 sm:p-8"
        >
          <h1 id="modifier-conf-title" className="text-2xl font-bold mb-6">
            <span className="text-magenta">Modifier</span> une conférence
          </h1>
          {occurrence.etat === "en_attente" && (
            <p
              role="status"
              className="mb-6 rounded-lg border border-cyan/30 bg-cyan/10 px-4 py-3 text-sm text-cyan"
            >
              Cette conférence attend la validation de l&apos;équipe. Ta saisie est
              gardée telle quelle&nbsp;: elle rejoint ta fiche publique dès qu&apos;elle
              est validée, tu peux continuer à la compléter ici.
            </p>
          )}
          <OccurrenceForm
            talkId={talk.id}
            initial={occurrence}
            suggestions={suggestions}
            aideSlidesHref={aideSlidesHref}
          />

          <div className="mt-8 pt-6 border-t border-navy-lighter">
            <p className="text-sm text-gray-light mb-3">
              Retirer cette conférence du talk. Le talk reste, seule cette
              intervention part.
            </p>
            <form action={removeOccurrenceAction}>
              <input type="hidden" name="talkId" value={talk.id} />
              <input type="hidden" name="occurrenceId" value={occurrence.id} />
              <ConfirmSubmitButton
                title="Retirer cette conférence ?"
                message="Cette intervention sera retirée du talk. Le talk et ses autres conférences restent."
                confirmLabel="Retirer définitivement"
                pendingLabel="Retrait…"
                variant="ghost"
              >
                Retirer cette conférence
              </ConfirmSubmitButton>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}
