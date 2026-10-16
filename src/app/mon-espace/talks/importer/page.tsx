import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import Breadcrumb from "@/components/Breadcrumb";
import ImportTalksForm from "./ImportTalksForm";

export const metadata: Metadata = {
  title: "Importer mes talks | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";
// Un lot de 300 talks = autant d'écritures séquentielles vers Neon : la limite
// par défaut d'une Server Action serait trop courte pour les gros exports.
export const maxDuration = 60;

/**
 * Importer ses talks depuis un export (Notist JSON, CSV d'un tableur…) :
 * UN rôle, en trois temps sur cette page — analyser, vérifier, confirmer.
 * Le formulaire d'occurrence reste le geste unitaire ; l'import est le même
 * geste en masse, avec les mêmes garanties (conférence hors répertoire →
 * proposition, saisie gardée hors ligne jusqu'à validation).
 */
export default async function ImporterTalks() {
  const session = await auth();
  if (!session?.user?.id) redirect("/connexion");

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Mon espace", href: "/mon-espace" },
          { label: "Mes talks", href: "/mon-espace/talks" },
          { label: "Importer" },
        ]}
      />
      <div className="py-10 px-4">
        <section
          aria-labelledby="import-title"
          className="max-w-2xl mx-auto bg-navy-light border border-navy-lighter rounded-2xl p-5 sm:p-8"
        >
          <h1 id="import-title" className="text-2xl font-bold mb-2">
            <span className="text-magenta">Importer</span> mes talks
          </h1>
          <p className="text-sm text-gray-light mb-6">
            Deux formats sont acceptés&nbsp;: <strong>ton export Notist</strong> (le
            JSON de ton profil, à télécharger sur
            noti.st/<em>ton-pseudo</em>.json) ou un <strong>tableur</strong> (CSV
            avec au moins une colonne «&nbsp;titre&nbsp;»). Tes talks sont
            regroupés, comparés à ta fiche et au répertoire, et tu choisis ce qui
            entre.
            {" "}L&apos;import s&apos;appuie sur les <strong>titres de tes
            talks</strong> et retrouve leurs conférences&nbsp;: nommées dans le
            fichier (colonne «&nbsp;conference&nbsp;» ou «&nbsp;event&nbsp;») ou
            lues dans les fiches d&apos;événements Notist. Celles qui manquent
            au répertoire partent en validation à l&apos;équipe et rejoignent
            ta fiche dès qu&apos;elles sont acceptées&nbsp;; une scène dont la
            conférence reste introuvable entre en «&nbsp;date seule&nbsp;», à
            compléter quand tu veux.
          </p>
          <ImportTalksForm />
        </section>
      </div>
    </>
  );
}
