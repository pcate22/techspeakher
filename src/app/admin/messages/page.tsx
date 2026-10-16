import type { Metadata } from "next";
import { requireOrgaId } from "@/lib/auth-guards";
import Breadcrumb from "@/components/Breadcrumb";
import NavRow from "@/components/NavRow";
import { formatDateFr } from "@/lib/format";
import {
  getPendingContactMessages,
  getRecentModeratedMessages,
  type PendingContactMessage,
} from "@/lib/contact-message";
import { contactMotifLabel } from "@/data/contact-motifs";
import ContactStatusChip from "@/components/ContactStatusChip";

export const metadata: Metadata = {
  title: "Messages | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/** Destinataire + date (le statut est porté par le chip, pas répété en texte). */
function destEtDate(m: PendingContactMessage): string {
  const dest = m.speakeuseName ?? `Fiche #${m.profileId}`;
  const date = formatDateFr(m.moderatedAt ?? m.createdAt);
  return [`pour ${dest}`, date].filter(Boolean).join(" · ");
}

/**
 * Messages de contact (SOMMAIRE, page de consultation — règle d'or « une page =
 * un rôle » : aucune action ici). La modération (transmettre / rejeter) vit sur
 * la page de l'item (`/admin/messages/[id]`).
 */
export default async function MessagesPage() {
  await requireOrgaId();
  const [aModerer, traites] = await Promise.all([
    getPendingContactMessages(),
    getRecentModeratedMessages(30),
  ]);

  return (
    <>
      <Breadcrumb
        items={[{ label: "Espace organisatrices", href: "/admin" }, { label: "Messages" }]}
      />
      <div className="py-10 px-4">
        <div className="max-w-2xl mx-auto flex flex-col gap-6">
          <header>
            <h1 className="text-2xl font-bold">Messages</h1>
            <p className="text-sm text-gray-light mt-1">
              Messages envoyés via les fiches speakeuses. Ouvrez-en un pour le
              transmettre (s&apos;il respecte le règlement intérieur) ou le
              rejeter.
            </p>
          </header>

          <section aria-labelledby="amoderer-titre">
            <h2
              id="amoderer-titre"
              className="text-xs font-bold uppercase tracking-wide text-gray-light mb-2"
            >
              À modérer ({aModerer.length})
            </h2>
            {aModerer.length === 0 ? (
              <p className="text-gray-light">Aucun message en attente. 🎉</p>
            ) : (
              <ul role="list" className="flex flex-col gap-2 list-none">
                {aModerer.map((m) => (
                  <li key={m.id}>
                    <NavRow
                      href={`/admin/messages/${m.id}`}
                      title={`${contactMotifLabel(m.motif)} — ${m.senderName}`}
                      subtitle={destEtDate(m)}
                      flag
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {traites.length > 0 && (
            <section aria-labelledby="traites-titre">
              <h2
                id="traites-titre"
                className="text-xs font-bold uppercase tracking-wide text-gray-light mb-2"
              >
                Traités récemment
              </h2>
              <ul role="list" className="flex flex-col gap-2 list-none">
                {traites.map((m) => (
                  <li key={m.id}>
                    <NavRow
                      href={`/admin/messages/${m.id}`}
                      title={`${contactMotifLabel(m.motif)} — ${m.senderName}`}
                      subtitle={
                        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                          <ContactStatusChip status={m.status} />
                          <span>{destEtDate(m)}</span>
                        </span>
                      }
                    />
                  </li>
                ))}
              </ul>
              <p className="text-xs text-gray-light mt-2">
                30 derniers messages traités.
              </p>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
