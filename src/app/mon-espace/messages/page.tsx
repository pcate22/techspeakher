import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getProfileByUserId } from "@/lib/profiles";
import { getTransmittedMessagesForProfile } from "@/lib/contact-message";
import { formatDateFr } from "@/lib/format";
import Breadcrumb from "@/components/Breadcrumb";
import MotifBadge from "@/components/MotifBadge";

export const metadata: Metadata = {
  title: "Mes messages | Tech Speak'Her",
  robots: { index: false },
  alternates: { canonical: "/mon-espace/messages" },
};

export const dynamic = "force-dynamic";

export default async function MesMessages() {
  const session = await auth();
  if (!session?.user?.id) redirect("/connexion");

  const profile = await getProfileByUserId(Number(session.user.id));
  const messages = profile
    ? await getTransmittedMessagesForProfile(profile.id)
    : [];

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Accueil", href: "/" },
          { label: "Mon espace", href: "/mon-espace" },
          { label: "Mes messages" },
        ]}
      />
      <div className="py-10 px-4">
        <section
          aria-labelledby="messages-title"
          className="max-w-2xl mx-auto"
        >
          <h1 id="messages-title" className="text-2xl font-bold mb-1">
            Mes <span className="text-magenta">messages</span>
          </h1>
          <p className="text-sm text-gray-light mb-6">
            Messages reçus via ta fiche et vérifiés par l&apos;équipe
            Tech Speak&apos;Her. Réponds directement à l&apos;expéditeur depuis ta
            messagerie ; ton adresse reste privée.
          </p>

          {messages.length === 0 ? (
            <p className="text-gray-light">
              Aucun message pour le moment. Tu seras prévenue par e-mail quand tu
              en recevras un.
            </p>
          ) : (
            <ul className="flex flex-col gap-3 list-none">
              {messages.map((m) => (
                <li
                  key={m.id}
                  className="bg-navy-light border border-navy-lighter rounded-xl p-5"
                >
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <MotifBadge motif={m.motif} />
                    {formatDateFr(m.createdAt) && (
                      <span className="text-xs text-gray-light">
                        {formatDateFr(m.createdAt)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-white mb-2">{m.senderName}</p>
                  <p className="text-sm text-gray-light whitespace-pre-wrap mb-4">
                    {m.body}
                  </p>
                  <a
                    href={`mailto:${m.senderEmail}?subject=${encodeURIComponent(
                      "Re: ton message via Tech Speak'Her",
                    )}`}
                    className="text-sm font-bold text-cyan border border-cyan/40 rounded-lg px-3 py-1.5 hover:bg-cyan/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
                  >
                    Répondre à {m.senderName}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
