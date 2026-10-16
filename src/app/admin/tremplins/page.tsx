import type { Metadata } from "next";
import Link from "next/link";
import { requireOrgaId } from "@/lib/auth-guards";
import Breadcrumb from "@/components/Breadcrumb";
import {
  listEditions,
  listConferences,
  editionStatutAffiche,
  aujourdhuiParis,
} from "@/lib/tremplin-editions";
import { errMessage } from "@/lib/tremplin-messages";
import { nomConference } from "@/lib/tremplin-conf";
import AddEditionDialog from "./AddEditionDialog";
import { listEditionOptions } from "@/lib/conferences";

export const metadata: Metadata = {
  title: "Tremplins | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function AdminTremplins({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  await requireOrgaId();
  const { err } = await searchParams;
  const errMsg = errMessage(err);
  const editions = await listEditions();
  const conferences = await listConferences();
  // Événements de la référence des conférences : lien facultatif d'une
  // édition de Tremplin vers sa conférence partenaire.
  const editionOptions = await listEditionOptions();
  // Même libellé que le public (dérivé des dates d'inscriptions) : l'orga
  // vérifie d'un coup d'œil ce que le site affiche vraiment.
  const today = aujourdhuiParis();

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Espace organisatrices", href: "/admin" },
          { label: "Tremplins" },
        ]}
      />
      <div className="py-10 px-4">
        <div className="max-w-2xl mx-auto flex flex-col gap-6">
          <header>
            <h1 className="text-2xl font-bold">Éditions du Tremplin</h1>
            <p className="text-sm text-gray-light mt-1">
              Gère les éditions, leurs ateliers, inscriptions et documents.
            </p>
          </header>

          {errMsg && (
            <p
              role="alert"
              className="text-sm text-orange bg-orange/10 border border-orange/30 rounded-lg px-4 py-3 break-words"
            >
              {errMsg}
            </p>
          )}

          <AddEditionDialog
            conferences={conferences}
            editions={editions.map((e) => ({
              id: e.id,
              nom: e.nom,
              annee: e.annee,
              confSlug: e.confSlug,
              confNom: e.confNom,
            }))}
            editionOptions={editionOptions}
          />

          {editions.length === 0 ? (
            <p className="text-sm text-gray-light">Aucune édition pour l&apos;instant.</p>
          ) : (
            <ul className="flex flex-col gap-3 list-none">
              {editions.map((e) => {
                const confLabel = nomConference(e.confNom, e.confLieu);
                return (
                <li key={e.id}>
                  <Link
                    href={`/admin/tremplins/${e.id}`}
                    className="flex items-center justify-between gap-3 bg-navy-light border border-navy-lighter rounded-xl px-5 py-4 hover:border-cyan/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan transition-colors"
                  >
                    <span>
                      <span className="font-medium">{e.nom}</span>
                      {confLabel && (
                        <span className="block text-xs text-gray-light">{confLabel}</span>
                      )}
                    </span>
                    <span className="text-[11px] font-bold uppercase tracking-wide text-gray-light">
                      {editionStatutAffiche(e, today)}
                    </span>
                  </Link>
                </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
