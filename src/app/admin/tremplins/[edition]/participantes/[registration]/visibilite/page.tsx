import type { Metadata } from "next";
import Link from "next/link";
import { requireOrgaId } from "@/lib/auth-guards";
import CarteSection from "@/components/CarteSection";
import InlineActionForm from "@/components/InlineActionForm";
import ConsentJournal from "@/components/ConsentJournal";
import { registrationLabel, getConsentLog } from "@/lib/tremplin-registrations";
import { loadRegistrationOrNotFound } from "@/lib/tremplin-admin";
import ParticipanteEntete from "../ParticipanteEntete";
import { setRegistrationVisibilityAction } from "../../../../actions";

export const metadata: Metadata = {
  title: "Visibilité sur la page publique | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/** Sous-page mono-fonction (lot C3c) : apparaître (ou non) sur la page
 * publique de l'édition. Un seul CTA principal (la bascule) ; le classement au
 * podium vit sur sa propre sous-page. */
export default async function VisibiliteParticipante({
  params,
}: {
  params: Promise<{ edition: string; registration: string }>;
}) {
  await requireOrgaId();
  const { edition: editionParam, registration: registrationParam } = await params;
  const { editionId, registration: r } = await loadRegistrationOrNotFound(
    editionParam,
    registrationParam,
  );
  const nom = registrationLabel(r);
  // Journal RGPD en lecture (démontrabilité). Repli défensif : si la migration
  // 037 n'est pas encore jouée, la fiche s'affiche quand même (journal vide).
  const journal = await getConsentLog(r.id).catch((e) => {
    console.error("Journal de consentement indisponible (migration 037 ?)", e);
    return [];
  });

  return (
    <div className="py-10 px-4">
      <div className="max-w-2xl mx-auto flex flex-col gap-4">
        <ParticipanteEntete fonction="Visibilité sur la page publique" nom={nom} />

        <CarteSection
          id="visibilite-titre"
          titre="Visibilité sur la page publique"
          description={
            r.public
              ? "Son nom, son rôle, son sujet, sa bio, ses liens et sa photo apparaissent dans la galerie publique de l'édition. La masquer la retire immédiatement (elle reste comptée anonymement)."
              : "Elle n'apparaît pas sur la page publique de l'édition (comptée anonymement dans les statistiques). Ne la rendre visible qu'avec son accord."
          }
        >
          <InlineActionForm
            action={setRegistrationVisibilityAction}
            hidden={{ editionId, registrationId: r.id, public: String(!r.public) }}
            variant="primary"
            fields={
              r.public
                ? []
                : [
                    {
                      kind: "select",
                      name: "base",
                      label: "D'où vient l'autorisation de diffusion ?",
                      required: true,
                      options: [
                        { value: "", label: "Choisis l'origine…" },
                        {
                          value: "formulaire_inscription",
                          label: "Le formulaire d'inscription (clause de diffusion)",
                        },
                        { value: "email", label: "Un accord par e-mail" },
                        { value: "autre", label: "Un autre recueil" },
                      ],
                    },
                    {
                      // type "text" (pas "url") : `optionalUrl` accepte une URL
                      // sans schéma (« exemple.com ») et préfixe https:// ; la
                      // validation native de type="url" la refuserait.
                      kind: "input",
                      name: "preuveLien",
                      label: "Lien de preuve (optionnel)",
                      type: "text",
                      placeholder: "exemple.com/preuve",
                      hint: "Vers la source (formulaire archivé, fil d'e-mail), dans un espace restreint réservé à l’équipe organisatrice.",
                    },
                  ]
            }
            submitLabel={r.public ? "Masquer du public" : "Rendre visible du public"}
            pendingLabel="Enregistrement…"
            confirm={
              r.public
                ? {
                    title: `Masquer ${nom} de la page publique ?`,
                    message: "Le retrait est immédiat, et il sera journalisé.",
                    label: "Masquer",
                  }
                : {
                    title: `Rendre ${nom} visible sur la page publique ?`,
                    message:
                      "Elle doit avoir donné son accord. Ce consentement sera journalisé.",
                    label: "Rendre visible",
                  }
            }
            successMessage="Visibilité mise à jour."
          />
        </CarteSection>

        <CarteSection
          id="journal-titre"
          titre="Journal de consentement"
          description="Trace datée de chaque accord et retrait, avec son origine (preuve RGPD). En lecture seule ; la personne concernée voit le même journal dans son espace."
        >
          <ConsentJournal entries={journal} />
        </CarteSection>

        <CarteSection
          id="fiche-perso-titre"
          titre="Bio, site et photo"
          description="Données personnelles : la speakeuse les gère sur sa fiche, pas l’équipe organisatrice."
        >
          <p className="text-sm text-gray-light">
            Sa biographie, son site et sa photo affichés dans la galerie viennent
            de sa fiche speakeuse (elle les modifie dans son espace).
            {r.userId
              ? " L’équipe organisatrice ne les édite pas ici : pour les mettre à jour, demande-lui de compléter sa fiche depuis son espace."
              : " Elle n'a pas encore de compte relié : ils apparaîtront quand elle en aura un et complétera sa fiche."}
          </p>
        </CarteSection>

        <p>
          <Link
            href={`/admin/tremplins/${editionId}/participantes/${r.id}`}
            className="inline-block py-2 -my-2 text-sm text-cyan hover:text-cyan-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded"
          >
            ← Retour à la fiche
          </Link>
        </p>
      </div>
    </div>
  );
}
