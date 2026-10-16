import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
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
        <p className="text-sm text-gray-light mb-6">
          Donne d&apos;abord un titre et un type. Tu pourras ensuite rattacher les
          conférences où tu l&apos;as donné.
        </p>
        <TalkForm />
      </section>
      </div>
    </>
  );
}
