import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import Breadcrumb from "@/components/Breadcrumb";
import { getCompte } from "@/lib/users";
import { getProfileByUserId } from "@/lib/profiles";
import { photoLinkedInReprenable } from "@/lib/linkedin-photo";
import ChampPhoto from "../ChampPhoto";

export const metadata: Metadata = {
  title: "Ma photo | Tech Speak'Her",
  robots: { index: false },
  alternates: { canonical: "/mon-espace/photo" },
};

export const dynamic = "force-dynamic";

/**
 * MA PHOTO — pour les comptes SANS fiche.
 *
 * La photo se choisit dans la fiche (section « Qui tu es »), et c'est très bien
 * pour les speakeuses. Restaient toutes les autres : une orga, une coach, une
 * membre qui n'a pas encore créé sa fiche. Leur avatar venait du provider à la
 * première connexion — donc plus rien depuis que la photo Google a quitté les
 * comptes (migration 070). Sans cet écran, elles n'auraient aucun moyen d'en
 * poser une.
 *
 * Un rôle, un champ, le MÊME composant que la fiche (`ChampPhoto`) : recopié,
 * il aurait divergé — et la fiche comme l'avatar écrivent la même colonne.
 */
export default async function MaPhoto() {
  const session = await auth();
  if (!session?.user?.id) redirect("/connexion");
  const uid = Number(session.user.id);

  const [compte, profile, linkedinLie] = await Promise.all([
    getCompte(uid),
    getProfileByUserId(uid),
    photoLinkedInReprenable(uid),
  ]);

  // Avec une fiche, la photo appartient à la fiche : on y renvoie plutôt que
  // d'ouvrir un second endroit pour le même geste.
  if (profile) redirect("/mon-espace/fiche/identite");

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Mon profil", href: "/mon-espace/profil" },
          { label: "Ma photo" },
        ]}
      />
      {/* <div>, pas <main> : le layout racine fournit déjà le landmark principal. */}
      <div className="py-10 px-4">
        <section aria-labelledby="photo-titre" className="max-w-2xl mx-auto">
          <h1 id="photo-titre" className="text-2xl font-bold mb-2">
            Ma photo
          </h1>
          <p className="text-sm text-gray-light mb-6">
            Elle t&apos;identifie partout sur le site, et elle illustrera ta fiche
            le jour où tu la créeras.
          </p>
          <ChampPhoto
            nom={compte?.name ?? session.user.name ?? ""}
            imageInitiale={compte?.image ?? null}
            linkedinLie={linkedinLie}
          />
        </section>
      </div>
    </>
  );
}
