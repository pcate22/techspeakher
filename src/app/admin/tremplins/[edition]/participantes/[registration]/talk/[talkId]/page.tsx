import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireOrgaId } from "@/lib/auth-guards";
import { registrationLabel } from "@/lib/tremplin-registrations";
import { getTalkById } from "@/lib/talks";
import { getProfileByUserId } from "@/lib/profiles";
import { loadRegistrationOrNotFound } from "@/lib/tremplin-admin";
import TalkForm from "@/app/mon-espace/TalkForm";
import ParticipanteEntete from "../../ParticipanteEntete";
import { updateRegistrationTalkAction } from "../../../../../actions";

export const metadata: Metadata = {
  title: "Modifier le talk | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/** Page dédiée : éditer le CONTENU d'un talk de la participante (ownership
 * vérifié via son profil). Ne change pas quel talk est pitché. */
export default async function ModifierTalkParticipante({
  params,
}: {
  params: Promise<{ edition: string; registration: string; talkId: string }>;
}) {
  await requireOrgaId();
  const {
    edition: editionParam,
    registration: registrationParam,
    talkId: talkIdParam,
  } = await params;
  const { editionId, registration: r } = await loadRegistrationOrNotFound(
    editionParam,
    registrationParam,
  );
  const base = `/admin/tremplins/${editionId}/participantes/${r.id}`;
  if (r.userId == null) redirect(`${base}/talk`);

  const profile = await getProfileByUserId(r.userId);
  const talkId = Number(talkIdParam);
  const talk =
    profile != null && Number.isInteger(talkId) ? await getTalkById(talkId, profile.id) : null;
  if (!talk) notFound();

  return (
    <div className="py-10 px-4">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        <ParticipanteEntete fonction="Modifier le talk" nom={registrationLabel(r)}>
          Son titre, son type et sa description. Les conférences où il a été donné
          se gèrent depuis son espace. Pour changer quel talk est pitché, reviens
          à « Talk pitché au Tremplin ».
        </ParticipanteEntete>

        <TalkForm
          initial={talk}
          updateAction={updateRegistrationTalkAction}
          hidden={{ ctxEditionId: editionId, registrationId: r.id }}
        />

        <p>
          <Link
            href={`${base}/talk`}
            className="inline-block py-2 -my-2 text-sm text-cyan hover:text-cyan-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded"
          >
            ← Retour à ses talks
          </Link>
        </p>
      </div>
    </div>
  );
}
