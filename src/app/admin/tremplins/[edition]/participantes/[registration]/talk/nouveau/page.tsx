import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOrgaId } from "@/lib/auth-guards";
import { registrationLabel } from "@/lib/tremplin-registrations";
import { loadRegistrationOrNotFound } from "@/lib/tremplin-admin";
import TalkForm from "@/app/mon-espace/TalkForm";
import ParticipanteEntete from "../../ParticipanteEntete";
import { addRegistrationTalkAction } from "../../../../../actions";

export const metadata: Metadata = {
  title: "Ajouter un talk | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/** Page dédiée : ajouter un talk à une participante. Le créer ici le désigne
 * comme talk pitché au Tremplin (redirection vers la page « Talk »). */
export default async function NouveauTalkParticipante({
  params,
}: {
  params: Promise<{ edition: string; registration: string }>;
}) {
  await requireOrgaId();
  const { edition: editionParam, registration: registrationParam } = await params;
  const { editionId, registration: r } = await loadRegistrationOrNotFound(
    editionParam,
    registrationParam,
  );
  const base = `/admin/tremplins/${editionId}/participantes/${r.id}`;
  // Sans compte : pas de profil d'accueil pour le talk → on renvoie choisir/relier.
  if (r.userId == null) redirect(`${base}/talk`);

  return (
    <div className="py-10 px-4">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        <ParticipanteEntete fonction="Ajouter un talk" nom={registrationLabel(r)}>
          Le talk qu&apos;elle pitche au Tremplin. En l&apos;ajoutant ici, il
          devient son talk pitché et apparaît sur son profil speakeuse.
        </ParticipanteEntete>

        <TalkForm
          addAction={addRegistrationTalkAction}
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
