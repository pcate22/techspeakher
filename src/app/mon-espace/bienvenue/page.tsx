import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getProfileByUserId } from "@/lib/profiles";
import { getCompte, peutCreerFiche } from "@/lib/users";
import BienvenueForm from "./BienvenueForm";

export const metadata: Metadata = {
  title: "Ta fiche en deux écrans | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/**
 * Inscription express : le nom, puis les thèmes, et la fiche paraît. Ce
 * parcours ne sert qu'à créer une fiche : qui en a déjà une retourne à Mon
 * espace.
 */
export default async function Bienvenue() {
  const session = await auth();
  if (!session?.user?.id) redirect("/connexion");
  const uid = Number(session.user.id);

  const [profile, compte] = await Promise.all([getProfileByUserId(uid), getCompte(uid)]);
  if (profile || !peutCreerFiche(compte?.genre)) redirect("/mon-espace");

  // Le nom du compte lu en base plutôt que dans la session : le JWT le fige à
  // la connexion. C'est aussi celui auquel l'action compare la saisie.
  const nom = compte?.name ?? session.user.name ?? "";

  return (
    <div className="py-10 px-4">
      <section aria-labelledby="bienvenue-titre" className="max-w-2xl mx-auto">
        <h1 id="bienvenue-titre" className="sr-only">
          Ta fiche speakeuse
        </h1>
        <BienvenueForm nomInitial={nom} />
      </section>
    </div>
  );
}
