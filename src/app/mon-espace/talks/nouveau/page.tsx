import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumb";
import TalkForm from "../../TalkForm";

export const metadata: Metadata = {
  title: "Ajouter un talk | Tech Speak'Her",
  robots: { index: false },
  alternates: { canonical: "/mon-espace/talks/nouveau" },
};

export const dynamic = "force-dynamic";

export default async function NouveauTalk() {
  const session = await auth();
  if (!session?.user?.id) redirect("/connexion");

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Mon espace", href: "/mon-espace" },
          { label: "Mes talks", href: "/mon-espace/talks" },
          { label: "Ajouter un talk" },
        ]}
      />
      <div className="py-10 px-4">
      <section
        aria-labelledby="nouveau-talk-title"
        className="max-w-2xl mx-auto bg-navy-light border border-navy-lighter rounded-2xl p-5 sm:p-8"
      >
        <h1 id="nouveau-talk-title" className="text-2xl font-bold mb-6">
          <span className="text-magenta">Ajouter</span> un talk
        </h1>
        <TalkForm mode="creation" />
        {/* Sortie vers l'import : celles qui ont déjà leurs talks ailleurs ne
            les ressaisissent pas un par un. Lien discret, le CTA reste le champ. */}
        <p className="text-sm text-gray-light mt-8">
          Tes talks sont sur Notist ou dans un fichier&nbsp;?{" "}
          <Link href="/mon-espace/talks/importer" className="text-cyan underline">
            Importer
          </Link>
        </p>
      </section>
      </div>
    </>
  );
}
