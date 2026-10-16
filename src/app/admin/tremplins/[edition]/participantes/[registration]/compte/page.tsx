import type { Metadata } from "next";
import Link from "next/link";
import { requireOrgaId } from "@/lib/auth-guards";
import { registrationLabel } from "@/lib/tremplin-registrations";
import { getComptesSpeakeuses } from "@/lib/users";
import { loadRegistrationOrNotFound } from "@/lib/tremplin-admin";
import AttachForm from "../AttachForm";
import ParticipanteEntete from "../ParticipanteEntete";

export const metadata: Metadata = {
  title: "Compte de la participante | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/** Sous-page mono-fonction (lot C3c) : le compte plateforme relié à son
 * inscription (rattachement par nom, ou invitation par e-mail). */
export default async function CompteParticipante({
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

  // Rattachement : on cherche par NOM (e-mail en secours seulement), parmi les
  // comptes speakeuses (brouillons inclus).
  const comptesSpeakeuses = r.userId
    ? []
    : (await getComptesSpeakeuses()).map((c) => ({
        id: c.id,
        label: c.name ?? c.email ?? `Compte n° ${c.id}`,
        sousTitre: c.name ? (c.email ?? undefined) : undefined,
      }));

  return (
    <div className="py-10 px-4">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        <ParticipanteEntete fonction="Compte sur la plateforme" nom={nom}>
          {r.userId
              ? "Elle retrouve ses ateliers, ressources et retours dans son espace personnel."
              : "Pas encore de compte relié : elle ne voit pas encore son espace Tremplin. Cherche son compte par son nom pour l'y relier ; si elle n'en a pas, invite-la par e-mail (son inscription se reliera à sa première connexion)."}
        </ParticipanteEntete>

        <section>
          {r.userId ? (
            <p className="text-sm">
              ✓ Rattachée au compte{" "}
              <span className="font-medium">
                {r.userName ?? r.userEmail ?? `n° ${r.userId}`}
              </span>
              {r.userEmail && r.userName && (
                <span className="text-gray-light"> ({r.userEmail})</span>
              )}
            </p>
          ) : (
            <AttachForm
              editionId={editionId}
              registrationId={r.id}
              comptes={comptesSpeakeuses}
            />
          )}
        </section>

        <p>
          <Link
            href={`/admin/tremplins/${editionId}/participantes/${r.id}`}
            className="inline-block py-2 -my-2 text-sm text-cyan hover:text-cyan-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded"
          >
            ← Retour à la fiche
          </Link>
        </p>
      </div>
    </div>
  );
}
