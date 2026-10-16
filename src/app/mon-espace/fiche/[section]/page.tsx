import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import Breadcrumb from "@/components/Breadcrumb";
import { getProfileByUserId } from "@/lib/profiles";
import { getCompte } from "@/lib/users";
import { photoLinkedInReprenable } from "@/lib/linkedin-photo";
import { sectionParCle } from "@/lib/profil-sections";
import SectionForm from "./SectionForm";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string }>;
}): Promise<Metadata> {
  const section = sectionParCle((await params).section);
  return {
    title: `${section?.titre ?? "Ma fiche"} | Tech Speak'Her`,
    robots: { index: false },
  };
}

export const dynamic = "force-dynamic";

/**
 * LA page d'UNE section de la fiche (lot I) : « Qui tu es », « Tes secteurs »…
 * Un crayon depuis la fiche mène ici, on change ce qu'on veut, on enregistre,
 * on revient. Plus d'assistant en six étapes à re-parcourir pour un mot.
 *
 * Le périmètre est décidé ICI, par l'URL, et re-décidé côté action : ce sont
 * les champs de la section qui bornent l'écriture, jamais le contenu du POST.
 *
 * Sans fiche, on renvoie à l'assistant de création : c'est lui qui recueille
 * l'attestation, et une fiche à moitié écrite section par section n'aurait
 * aucun sens.
 */
export default async function SectionDeMaFiche({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/connexion");

  const section = sectionParCle((await params).section);
  if (!section) notFound();

  const uid = Number(session.user.id);
  const profile = await getProfileByUserId(uid);
  if (!profile) redirect("/mon-espace/fiche");

  // Deux lectures indépendantes, donc menées ENSEMBLE :
  //  - le nom du COMPTE en base, jamais dans la session (le JWT le fige à la
  //    connexion, donc le champ obligatoire s'affichait VIDE pour qui venait de
  //    renseigner son nom) ;
  //  - la reprise de photo LinkedIn, demandée SEULEMENT par la section qui
  //    porte le champ Photo. Sans ce garde, les cinq autres sections payaient
  //    une requête `accounts` dont elles jetaient le résultat.
  const [nomCompte, linkedinLie] = await Promise.all([
    profile.name ? Promise.resolve(profile.name) : getCompte(uid).then((c) => c?.name ?? ""),
    section.cle === "identite" ? photoLinkedInReprenable(uid) : Promise.resolve(false),
  ]);
  const nom = nomCompte ?? "";

  return (
    <>
      {/* Même racine de fil d'Ariane que la page fiche (« Mon profil ») :
          une page qui change de parent selon d'où on la regarde désoriente
          (finding de revue N1). */}
      <Breadcrumb
        items={[
          { label: "Mon profil", href: "/mon-espace/profil" },
          { label: "Ma fiche publique", href: "/mon-espace/fiche" },
          { label: section.titre },
        ]}
      />
      {/* <div>, pas <main> : le layout racine fournit déjà le landmark principal. */}
      <div className="py-10 px-4">
        <section aria-labelledby="section-titre" className="max-w-2xl mx-auto">
          <h1 id="section-titre" className="text-2xl font-bold mb-2">
            {section.titre}
          </h1>
          <p className="text-sm text-gray-light mb-6">{section.aide}</p>
          <SectionForm
            cle={section.cle}
            initial={profile}
            nom={nom}
            linkedinLie={linkedinLie}
          />
        </section>
      </div>
    </>
  );
}
