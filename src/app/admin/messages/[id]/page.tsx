import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOrgaId } from "@/lib/auth-guards";
import Breadcrumb from "@/components/Breadcrumb";
import Button from "@/components/Button";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import MotifBadge from "@/components/MotifBadge";
import ContactStatusChip from "@/components/ContactStatusChip";
import { formatDateFr } from "@/lib/format";
import { getContactMessageById } from "@/lib/contact-message";
import { moderateContactMessageAction } from "../../actions";

export const metadata: Metadata = {
  title: "Message | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function MessagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOrgaId();
  const { id } = await params;
  const messageId = Number(id);
  if (!Number.isFinite(messageId)) notFound();

  const message = await getContactMessageById(messageId);
  if (!message) notFound();

  const dest = message.speakeuseName ?? `Fiche #${message.profileId}`;
  const enAttente = message.status === "en_attente";

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Espace organisatrices", href: "/admin" },
          { label: "Messages", href: "/admin/messages" },
          { label: "Message" },
        ]}
      />
      <div className="py-10 px-4">
        <div className="max-w-2xl mx-auto flex flex-col gap-6">
          <header className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold">Message pour {dest}</h1>
            <div className="flex flex-wrap items-center gap-2">
              {!enAttente && <ContactStatusChip status={message.status} />}
              <MotifBadge motif={message.motif} />
            </div>
            <p className="text-sm text-gray-light">
              De <strong className="text-white">{message.senderName}</strong>{" "}
              &lt;{message.senderEmail}&gt;
              {formatDateFr(message.createdAt) ? ` · reçu le ${formatDateFr(message.createdAt)}` : ""}
            </p>
          </header>

          <section
            aria-label="Contenu du message"
            className="bg-navy-light border border-navy-lighter rounded-xl p-5"
          >
            <p className="text-sm text-white whitespace-pre-wrap">{message.body}</p>
          </section>

          {enAttente ? (
            <div className="flex flex-wrap gap-3">
              <form action={moderateContactMessageAction}>
                <input type="hidden" name="messageId" value={message.id} />
                <input type="hidden" name="decision" value="transmis" />
                <Button type="submit" variant="secondary" size="sm">
                  Transmettre
                </Button>
              </form>
              <form action={moderateContactMessageAction}>
                <input type="hidden" name="messageId" value={message.id} />
                <input type="hidden" name="decision" value="rejete" />
                <ConfirmSubmitButton
                  variant="danger"
                  title={`Rejeter le message de ${message.senderName} ?`}
                  message="Il ne sera pas transmis à la speakeuse. Le message reste conservé mais ne réapparaît pas dans la file."
                  confirmLabel="Rejeter"
                >
                  Rejeter
                </ConfirmSubmitButton>
              </form>
            </div>
          ) : (
            <p className="text-sm text-gray-light">
              {formatDateFr(message.moderatedAt)
                ? `Traité le ${formatDateFr(message.moderatedAt)} · `
                : ""}
              {message.status === "transmis"
                ? "la speakeuse a été prévenue par e-mail."
                : "non relayé."}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
