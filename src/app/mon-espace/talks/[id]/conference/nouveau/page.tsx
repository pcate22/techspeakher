import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getProfileByUserId } from "@/lib/profiles";
import { getTalkById, getOccurrenceSuggestions } from "@/lib/talks";
import { getAideSlidesHref } from "@/lib/contenus";
import Breadcrumb from "@/components/Breadcrumb";
import OccurrenceForm from "../../../../OccurrenceForm";

export const metadata: Metadata = {
  title: "Ajouter une conférence | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function NouvelleConference({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/connexion");

  const profile = await getProfileByUserId(Number(session.user.id));
  if (!profile) redirect("/mon-espace/talks");

  const { id } = await params;
  const talkId = Number(id);
  const [talk, suggestions, aideSlidesHref] = await Promise.all([
    Number.isFinite(talkId) ? getTalkById(talkId, profile.id) : Promise.resolve(null),
    getOccurrenceSuggestions(),
    getAideSlidesHref(),
  ]);
  if (!talk) redirect("/mon-espace/talks");

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Mon espace", href: "/mon-espace" },
          { label: "Mes talks", href: "/mon-espace/talks" },
          { label: talk.titre, href: `/mon-espace/talks/${talk.id}` },
          { label: "Ajouter une conférence" },
        ]}
      />
      <div className="py-10 px-4">
        <section
          aria-labelledby="nouvelle-conf-title"
          className="max-w-2xl mx-auto bg-navy-light border border-navy-lighter rounded-2xl p-5 sm:p-8"
        >
          <h1 id="nouvelle-conf-title" className="text-2xl font-bold mb-6">
            <span className="text-magenta">Ajouter</span> une conférence
          </h1>
          <OccurrenceForm
            talkId={talk.id}
            suggestions={suggestions}
            aideSlidesHref={aideSlidesHref}
          />
        </section>
      </div>
    </>
  );
}
