import type { Metadata } from "next";
import Link from "next/link";
import { requireOrgaId } from "@/lib/auth-guards";
import NavRow from "@/components/NavRow";
import { SetFilCrumbs } from "../FilContext";
import { loadEditionOrNotFound } from "@/lib/tremplin-admin";
import { tremplinPageMetadata } from "@/lib/tremplin-page-meta";
import {
  getRegistrationsByEdition,
  registrationLabel,
  rangLabel,
} from "@/lib/tremplin-registrations";
import {
  getRecompensesByEdition,
  RECOMPENSE_STATUT_LABEL,
  type Recompense,
} from "@/lib/tremplin-recompenses";
import { getJuryByEdition, juryLabel, juryRole, type Jury } from "@/lib/tremplin-jury";
import { getDocumentsByEdition } from "@/lib/tremplin-documents";
import { dateCourteFr } from "@/lib/format";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ edition: string }>;
}): Promise<Metadata> {
  return tremplinPageMetadata((await params).edition, "Finale");
}

export const dynamic = "force-dynamic";

/** Vue agrégée de la soirée finale (phase 2) : le roster sur scène, le podium,
 * les récompenses et le jury réunis. Les modifications se font sur les fiches
 * dédiées (participante, récompense, jury) — ici on pilote la soirée d'un coup
 * d'œil. */
export default async function FinaleIndex({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  await requireOrgaId();
  const { editionId, edition } = await loadEditionOrNotFound((await params).edition);
  const base = `/admin/tremplins/${editionId}`;

  const [registrations, recompenses, jury, documents] = await Promise.all([
    getRegistrationsByEdition(editionId),
    getRecompensesByEdition(editionId).catch((e) => {
      console.error("Récompenses indisponibles (migration 018 ?)", e);
      return [] as Recompense[];
    }),
    getJuryByEdition(editionId).catch((e) => {
      console.error("Jury indisponible (migration 025 ?)", e);
      return [] as Jury[];
    }),
    getDocumentsByEdition(editionId),
  ]);

  // Roster de la scène = finalistes (finale_presente). Tri : podium d'abord
  // (1, 2, 3…), puis les non classées par nom.
  const finalistes = registrations
    .filter((r) => r.finalePresente)
    .sort((a, b) => {
      const ca = a.classement ?? Infinity;
      const cb = b.classement ?? Infinity;
      if (ca !== cb) return ca - cb;
      return registrationLabel(a).localeCompare(registrationLabel(b), "fr");
    });

  const nbRecompensesAAttribuer = recompenses.filter((r) => !r.beneficiaireNom).length;
  const recompensesParInscription = new Map<number, Recompense[]>();
  for (const rec of recompenses) {
    if (rec.beneficiaireRegistrationId == null) continue;
    const liste = recompensesParInscription.get(rec.beneficiaireRegistrationId) ?? [];
    liste.push(rec);
    recompensesParInscription.set(rec.beneficiaireRegistrationId, liste);
  }
  const feedbackParInscription = new Set(
    documents
      .filter((d) => d.type === "feedback_jury" && d.registrationId != null)
      .map((d) => d.registrationId as number),
  );

  return (
    <>
      <SetFilCrumbs crumbs={[{ label: "Finale" }]} />
      <div className="py-10 px-4">
      <div className="max-w-2xl mx-auto flex flex-col gap-8">
        <header>
          <h1 className="text-2xl font-bold">Finale · la soirée</h1>
          <p className="text-sm text-gray-light mt-1">
            {[
              edition.finaleDate && dateCourteFr(edition.finaleDate),
              edition.finaleLieu,
              `${finalistes.length} finaliste${finalistes.length > 1 ? "s" : ""} sur scène`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </header>

        <section aria-labelledby="finalistes-titre">
          <h2 id="finalistes-titre" className="text-lg font-bold mb-3">
            Sur scène
          </h2>
          {finalistes.length === 0 ? (
            <p className="text-sm text-gray-light">
              Aucune finaliste pour l&apos;instant. Marque les finalistes sur la fiche de
              chaque participante (phase 2).
            </p>
          ) : (
            <ul role="list" className="flex flex-col gap-2 list-none">
              {finalistes.map((r) => {
                const nom = registrationLabel(r);
                const recs = recompensesParInscription.get(r.id) ?? [];
                const sousTitre = [
                  rangLabel(r.classement),
                  recs.length > 0 &&
                    recs
                      .map((rec) => `${rec.intitule} (${RECOMPENSE_STATUT_LABEL[rec.statut]})`)
                      .join(", "),
                  feedbackParInscription.has(r.id)
                    ? "retour du jury déposé"
                    : "retour du jury à déposer",
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <li key={r.id}>
                    <NavRow
                      href={`${base}/participantes/${r.id}`}
                      title={nom}
                      subtitle={sousTitre || "Finaliste"}
                      flag={!feedbackParInscription.has(r.id)}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="jury-titre">
          <div className="flex items-baseline justify-between gap-3 mb-3">
            <h2 id="jury-titre" className="text-lg font-bold">
              Jury
            </h2>
            <Link
              href={`${base}/jury`}
              className="inline-block py-2 -my-2 text-sm text-cyan hover:text-cyan-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded"
            >
              Gérer le jury <span aria-hidden="true">→</span>
            </Link>
          </div>
          {jury.length === 0 ? (
            <p className="text-sm text-gray-light">Aucun juré listé pour l&apos;instant.</p>
          ) : (
            <ul role="list" className="flex flex-col gap-1 list-none">
              {jury.map((j) => {
                const role = juryRole(j);
                return (
                  <li key={j.id} className="text-sm">
                    <span className="font-medium">{juryLabel(j)}</span>
                    {role && <span className="text-gray-light"> · {role}</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="recompenses-titre">
          <div className="flex items-baseline justify-between gap-3 mb-3">
            <h2 id="recompenses-titre" className="text-lg font-bold">
              Récompenses
            </h2>
            <Link
              href={`${base}/recompenses`}
              className="inline-block py-2 -my-2 text-sm text-cyan hover:text-cyan-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded"
            >
              Gérer les récompenses <span aria-hidden="true">→</span>
            </Link>
          </div>
          <p className="text-sm text-gray-light">
            {recompenses.length === 0
              ? "Aucune récompense pour l'instant."
              : nbRecompensesAAttribuer > 0
                ? `${nbRecompensesAAttribuer} à attribuer sur ${recompenses.length}.`
                : "Toutes attribuées."}
          </p>
        </section>

        <p>
          <Link
            href={base}
            className="inline-block py-2 -my-2 text-sm text-cyan hover:text-cyan-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded"
          >
            <span aria-hidden="true">←</span> Retour à l&apos;édition
          </Link>
        </p>
      </div>
      </div>
    </>
  );
}
