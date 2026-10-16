import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOrgaId } from "@/lib/auth-guards";
import InlineActionForm from "@/components/InlineActionForm";
import SettingToggle from "@/components/SettingToggle";
import SousPage from "@/components/SousPage";
import { getCoachsByAtelier, coachLabel } from "@/lib/tremplin-coachs";
import { getCoachProfile } from "@/lib/coach-profiles";
import { loadAtelierOrNotFound } from "@/lib/tremplin-admin";
import { setCoachProfileAction, setCoachProfilePublicAction } from "../../../../../actions";

export const metadata: Metadata = {
  title: "Fiche coach | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/**
 * LA FICHE COACH d'une accompagnante — rôle, lien, et son accord d'être citée.
 *
 * Une page dédiée par personne (patron hub-and-spoke) : la liste des coachs d'un
 * atelier montre et laisse choisir où aller, elle n'héberge pas un formulaire
 * par ligne.
 *
 * La fiche est rattachée au COMPTE, pas à l'atelier ni à l'édition : on y arrive
 * par un atelier parce que c'est là qu'on pense à elle, mais ce qu'on y écrit
 * vaut partout où elle a accompagné. Une seule révocation suffit donc à retirer
 * son nom de toutes les éditions.
 *
 * Elle N'est PAS la fiche speakeuse : être citée comme coach ne suppose pas de
 * vouloir figurer dans l'annuaire des speakeuses. Deux finalités, deux fiches
 * (cf. src/lib/coach-profiles.ts).
 */
export default async function FicheCoach({
  params,
}: {
  params: Promise<{ edition: string; atelier: string; userId: string }>;
}) {
  await requireOrgaId();
  const { edition: editionParam, atelier: atelierParam, userId: userParam } = await params;
  const { editionId, atelier: a } = await loadAtelierOrNotFound(editionParam, atelierParam);

  const userId = Number(userParam);
  if (!Number.isInteger(userId) || userId <= 0) notFound();
  // On n'ouvre la fiche que d'une coach RÉELLEMENT rattachée à cet atelier : un
  // id de compte forgé dans l'URL ne donne pas accès à la fiche de n'importe qui.
  const coachs = await getCoachsByAtelier(a.id).catch(() => []);
  const coach = coachs.find((c) => c.userId === userId);
  if (!coach) notFound();

  const fiche = await getCoachProfile(userId);
  const nom = coachLabel(coach);

  return (
    <SousPage
      titre={nom}
      indice="Sa fiche vaut pour toutes les éditions qu'elle accompagne."
      retour={{
        href: `/admin/tremplins/${editionId}/ateliers/${a.id}/coachs`,
        label: "Retour aux coachs de l'atelier",
      }}
    >
      <section aria-labelledby="fiche-coach-titre" className="flex flex-col gap-4">
        <h2 id="fiche-coach-titre" className="sr-only">
          Rôle et lien affichés
        </h2>
        <InlineActionForm
          action={setCoachProfileAction}
          hidden={{ userId }}
          fields={[
            {
              kind: "input",
              name: "role",
              label: "Rôle affiché",
              defaultValue: fiche?.role ?? "",
              placeholder: "Coach produit, conceptrice-rédactrice…",
              hint: "Tel qu'il apparaîtra sous son nom sur la page publique.",
            },
            {
              kind: "input",
              name: "lien",
              label: "Lien vers elle",
              type: "url",
              defaultValue: fiche?.lien ?? "",
              placeholder: "https://…",
              hint: "LinkedIn ou site. Commence par http:// ou https://.",
            },
          ]}
          submitLabel="Enregistrer"
          successMessage={`Fiche de ${nom} enregistrée.`}
        />
      </section>

      {/* LE CONSENTEMENT, à part du descriptif : décrire quelqu'un n'est pas
          obtenir son accord, et l'un se coche quand l'autre est déjà écrit. */}
      <section
        aria-labelledby="accord-coach-titre"
        className="border border-navy-lighter rounded-xl px-4 py-3 bg-navy"
      >
        <h2 id="accord-coach-titre" className="sr-only">
          Accord d&apos;être citée publiquement
        </h2>
        <SettingToggle
          action={setCoachProfilePublicAction}
          hidden={{ userId }}
          checked={fiche?.public ?? false}
          label="Citée sur le site public"
          description="Décide de la présence de son nom parmi les accompagnantes des éditions qu'elle a animées. À cocher une fois son accord recueilli : il est horodaté, et se retire d'un geste."
          successMessage="Accord mis à jour."
        />
      </section>
    </SousPage>
  );
}
