import type { Metadata } from "next";
import Link from "next/link";
import { requireOrgaId } from "@/lib/auth-guards";
import {
  registrationLabel,
  getRegistrationTalkId,
} from "@/lib/tremplin-registrations";
import { getTalksByProfileId, type Talk } from "@/lib/talks";
import { getProfileByUserId } from "@/lib/profiles";
import { loadRegistrationOrNotFound } from "@/lib/tremplin-admin";
import { TALK_PROPOSAL } from "@/data/domaines";
import ParticipanteEntete from "../ParticipanteEntete";
import PitchedTalkPicker from "@/components/PitchedTalkPicker";
import { setRegistrationPitchedTalkAction } from "../../../../actions";

export const metadata: Metadata = {
  title: "Talk pitché au Tremplin | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/** Métadonnée courte d'un talk (type + conférence la plus récente, si donnée). */
function talkMeta(t: Talk): string {
  return [t.type, t.occurrences[0]?.conference].filter(Boolean).join(" · ");
}

/**
 * Sous-page mono-fonction : désigner LE talk pitché au Tremplin par la
 * participante (le lien inscription ↔ talk). La sélection est un groupe radio
 * (un contrôle, pas des CTA) ; la page garde UN seul CTA principal :
 * « Ajouter un talk ». Le talk vit sur son profil speakeuse (et le préremplit)
 * → un compte relié est requis.
 */
export default async function TalkParticipante({
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
  const nom = registrationLabel(r);
  const base = `/admin/tremplins/${editionId}/participantes/${r.id}`;

  const profile = r.userId != null ? await getProfileByUserId(r.userId) : null;
  const talks = profile ? await getTalksByProfileId(profile.id).catch(() => []) : [];
  const pitchedId = await getRegistrationTalkId(r.id, editionId).catch(() => null);

  // Le talk pitché d'abord (repère fort en tête), puis les autres. Chaque option
  // porte SON lien « Modifier » (route admin) : le composant est mutualisé sans
  // connaître le rôle de l'appelante.
  const options = [...talks]
    .sort((a, b) => (a.id === pitchedId ? -1 : b.id === pitchedId ? 1 : 0))
    .map((t) => ({
      id: t.id,
      titre: t.titre,
      meta: talkMeta(t),
      editHref: `${base}/talk/${t.id}`,
      proposition: t.type === TALK_PROPOSAL,
    }));

  return (
    <div className="py-10 px-4">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        <ParticipanteEntete fonction="Talk pitché au Tremplin" nom={nom}>
          Le talk qu&apos;elle pitche à la finale. Il vit sur son profil speakeuse
          et le préremplit ; tu peux le créer ou le compléter pour elle.
        </ParticipanteEntete>

        {r.userId == null ? (
          <div className="rounded-xl border border-navy-lighter bg-navy px-4 py-4 text-sm">
            <p className="text-gray-light">
              Pour lui associer un talk, relie d&apos;abord un compte : le talk vit
              sur son profil speakeuse (et le préremplit), ce qui suppose un compte
              (créé par e-mail au besoin).
            </p>
            <p className="mt-3">
              <Link
                href={`${base}/compte`}
                className="text-cyan hover:text-cyan-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded"
              >
                Aller à « Son compte »
              </Link>
            </p>
          </div>
        ) : (
          <>
            {options.length > 0 ? (
              <PitchedTalkPicker
                action={setRegistrationPitchedTalkAction}
                editionId={editionId}
                registrationId={r.id}
                options={options}
                pitchedId={pitchedId}
                legend={"Quel talk pitche-t-elle ?"}
              />
            ) : (
              <p className="text-sm text-gray-light">
                Ajoute le talk qu&apos;elle pitche au Tremplin : il apparaîtra ici
                et sur son profil speakeuse.
              </p>
            )}

            {/* CTA unique de la page. */}
            <Link
              href={`${base}/talk/nouveau`}
              className="block text-center font-bold text-navy bg-cyan hover:bg-cyan-light rounded-xl px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-navy"
            >
              + Ajouter un talk
            </Link>
          </>
        )}

        <p>
          <Link
            href={base}
            className="inline-block py-2 -my-2 text-sm text-cyan hover:text-cyan-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded"
          >
            ← Retour à la fiche
          </Link>
        </p>
      </div>
    </div>
  );
}
