import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getProfileByHandle, speakeuseHref } from "@/lib/profiles";
import Breadcrumb from "@/components/Breadcrumb";
import ContactSpeakeuseForm from "./ContactSpeakeuseForm";

export const metadata: Metadata = {
  title: "Contacter une speakeuse | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function ContactSpeakeuse({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: handle } = await params;

  const profile = await getProfileByHandle(handle);
  // Contact e-mail public uniquement pour les fiches publiées qui l'ont activé.
  if (!profile || profile.status !== "publie" || !profile.contactEmailOk) notFound();

  // Canonicalisation : id numérique → slug (307 temporaire, cohérent avec la
  // fiche : le slug est modifiable, pas de 308 mis en cache par le navigateur).
  if (profile.slug && handle !== profile.slug) {
    redirect(`${speakeuseHref(profile)}/contact`);
  }

  const nom = profile.name?.trim() || "cette speakeuse";

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Accueil", href: "/" },
          { label: "Speakeuses", href: "/speakeuses" },
          // Le maillon nomme la DESTINATION comme la fiche se nomme elle-même
          // (nomAffiche) ; « cette speakeuse » reste juste dans la prose.
          { label: profile.nomAffiche, href: speakeuseHref(profile) },
          { label: "Contact" },
        ]}
      />
      <div className="py-10 px-4">
        <section
          aria-labelledby="contact-title"
          className="max-w-xl mx-auto bg-navy-light border border-navy-lighter rounded-2xl p-8"
        >
          <h1 id="contact-title" className="text-2xl font-bold mb-1">
            Écrire à <span className="text-magenta">{nom}</span>
          </h1>
          <p className="text-sm text-gray-light mb-6">
            Votre message est d&apos;abord lu par l&apos;équipe Tech Speak&apos;Her,
            puis transmis à {nom} s&apos;il respecte notre{" "}
            <Link
              href="/code-de-conduite"
              className="text-cyan underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded"
            >
              règlement intérieur
            </Link>
            . Son adresse reste privée ; elle vous répondra directement.
          </p>
          <ContactSpeakeuseForm profileId={profile.id} nom={nom} />
        </section>
      </div>
    </>
  );
}
