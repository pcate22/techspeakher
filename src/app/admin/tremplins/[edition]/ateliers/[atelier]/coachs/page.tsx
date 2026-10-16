import type { Metadata } from "next";
import { requireOrgaId } from "@/lib/auth-guards";
import InlineActionForm from "@/components/InlineActionForm";
import SousPage from "@/components/SousPage";
import { getCoachsByAtelier, coachLabel } from "@/lib/tremplin-coachs";
import { getComptesPlateforme, compteLabel } from "@/lib/users";
import { loadAtelierOrNotFound } from "@/lib/tremplin-admin";
import Link from "next/link";
import { removeCoachAction } from "../../../../actions";
import AddCoachDialog from "../../../AddCoachDialog";

export const metadata: Metadata = {
  title: "Coachs de l'atelier | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/** Sous-page mono-fonction (lot C3b) : les coachs de l'atelier. */
export default async function CoachsAtelier({
  params,
}: {
  params: Promise<{ edition: string; atelier: string }>;
}) {
  await requireOrgaId();
  const { edition: editionParam, atelier: atelierParam } = await params;
  const { editionId, atelier: a } = await loadAtelierOrNotFound(editionParam, atelierParam);

  const [coachs, comptesBruts] = await Promise.all([
    getCoachsByAtelier(a.id).catch((e) => {
      console.error("Coachs indisponibles (migration 017 ?)", e);
      return [];
    }),
    getComptesPlateforme(),
  ]);
  const comptes = comptesBruts.map((c) => ({ id: c.id, label: compteLabel(c) }));

  return (
    <SousPage
      titre="Coachs"
      retour={{
        href: `/admin/tremplins/${editionId}/ateliers/${a.id}`,
        label: "Retour à l'atelier",
      }}
    >
      <section className="flex flex-col gap-4">
        {coachs.length === 0 ? (
          <p className="text-sm text-gray-light">
            {a.coachs
              ? `Coachs saisis en texte libre : ${a.coachs}. Relie-les à un compte ci-dessous.`
              : "Aucun coach pour l'instant."}
          </p>
        ) : (
          <ul className="flex flex-col gap-2 list-none" role="list">
            {coachs.map((c) => (
              <li
                key={c.userId}
                className="flex items-center justify-between gap-3 rounded-xl border border-navy-lighter bg-navy px-4 py-3"
              >
                {/* La rangée MÈNE à sa fiche (rôle, lien, accord d'être citée) :
                    une page par personne, plutôt qu'un formulaire par ligne sur
                    un écran dont le rôle est de montrer qui anime. */}
                <Link
                  href={`/admin/tremplins/${editionId}/ateliers/${a.id}/coachs/${c.userId}`}
                  className="min-w-0 flex-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
                >
                  <span className="block font-medium truncate text-cyan">{coachLabel(c)}</span>
                  {c.nom && c.email && (
                    <span className="block text-xs text-gray-light truncate">{c.email}</span>
                  )}
                </Link>
                <InlineActionForm
                  action={removeCoachAction}
                  hidden={{ editionId, atelierId: a.id, userId: c.userId }}
                  submitLabel="Retirer"
                  confirm={{
                    title: `Retirer ${coachLabel(c)} ?`,
                    message: `${coachLabel(c)} sort de l’animation de cet atelier.`,
                    label: "Retirer",
                  }}
                  className="flex shrink-0 flex-col items-end gap-1"
                />
              </li>
            ))}
          </ul>
        )}
        {/* Quand un coach existe déjà, la LISTE est le contenu : l'ajout passe en
            secondaire (une page = un CTA principal maxi). Sans coach, l'ajout EST
            l'action principale. */}
        <AddCoachDialog
          triggerVariant={coachs.length > 0 ? "secondary" : "primary"}
          editionId={editionId}
          atelierId={a.id}
          cible={`« ${a.titre} »`}
          comptes={comptes}
        />
      </section>
    </SousPage>
  );
}
