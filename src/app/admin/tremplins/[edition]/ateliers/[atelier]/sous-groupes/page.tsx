import type { Metadata } from "next";
import Link from "next/link";
import SousPage from "@/components/SousPage";
import NavRow from "@/components/NavRow";
import { requireOrgaId } from "@/lib/auth-guards";
import InlineActionForm from "@/components/InlineActionForm";
import { getCohorteAtelier, getSousGroupesByAtelier } from "@/lib/tremplin-ateliers";
import { getRegistrationsByEdition, nommerInscriptions } from "@/lib/tremplin-registrations";
import { coachLabel } from "@/lib/tremplin-coachs";
import { couvertureSousGroupes } from "@/lib/atelier-sous-groupes";
import { libelleSousGroupe, libelleCoachsEtiquete } from "@/lib/sous-groupe-libelle";
import { libelleAudience } from "@/lib/atelier-audience";
import { loadAtelierOrNotFound } from "@/lib/tremplin-admin";
import { formatDateFr, nb } from "@/lib/format";
import { createSousGroupeAction } from "../../../../actions";

export const metadata: Metadata = {
  title: "Sous-groupes | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/**
 * LA RÉPARTITION d'un atelier en sous-groupes — la vue qui manquait (demande
 * orga du 01/08 : « on n'a pas une vue globale des différents sous-groupes dans
 * un atelier »). Une page, un rôle : voir d'un coup d'œil tous les sous-groupes,
 * qui est dedans, et surtout **qui n'est rangée nulle part**. C'est à ça que
 * servent les sous-groupes — « s'assurer que tout le monde a un sous-groupe
 * dans un ensemble donné » ; l'écran doit donc répondre à cette question-là,
 * pas se contenter d'énumérer des groupes.
 *
 * CONSULTATION (règle d'or) : un sous-groupe est une LIGNE vers sa page dédiée,
 * où l'on range les participantes, désigne la coach et note la réalisation. Un
 * seul CTA ici : créer un sous-groupe (dialog).
 *
 * Les noms des participantes sont légitimes sur CETTE page — répartir, c'est
 * nommer. Rien n'en sort : le DTO public d'un atelier ignore les sous-groupes.
 */
export default async function RepartitionSousGroupes({
  params,
}: {
  params: Promise<{ edition: string; atelier: string }>;
}) {
  await requireOrgaId();
  const { edition: editionParam, atelier: atelierParam } = await params;
  const { editionId, atelier: a } = await loadAtelierOrNotFound(editionParam, atelierParam);

  const [sousGroupes, registrations, cohorte] = await Promise.all([
    getSousGroupesByAtelier(a.id),
    getRegistrationsByEdition(editionId),
    // L'ensemble à couvrir, c'est l'AUDIENCE de l'atelier — la même règle que
    // « qui le voit » et « qui reste à pointer », résolue une seule fois.
    getCohorteAtelier(a.id, editionId).catch((e): number[] => {
      console.error("Cohorte de l'atelier indisponible", e);
      return [];
    }),
  ]);

  const couverture = couvertureSousGroupes(
    cohorte,
    sousGroupes.map((g) => g.membres),
  );
  const personneARepartir = couverture.total === 0;

  const nommer = (ids: readonly number[]) => nommerInscriptions(ids, registrations);

  const base = `/admin/tremplins/${editionId}/ateliers/${a.id}`;
  const aRanger = nommer(couverture.aRanger);

  return (
    <SousPage titre="Sous-groupes" retour={{ href: base, label: "Retour à l'atelier" }}>
      {/* LA question d'abord, la liste ensuite : « tout le monde a-t-il un
          sous-groupe ? ». Le manque est écrit en toutes lettres — la couleur ne
          porte jamais l'information seule (RGAA 3.1). */}
      <section
        aria-labelledby="couverture-titre"
        className="rounded-2xl border border-navy-lighter bg-navy-light p-5"
      >
        <h2 id="couverture-titre" className="text-xs font-bold uppercase tracking-wider text-gray-light">
          Répartition
        </h2>
        {personneARepartir ? (
          <>
            <p className="mt-1 text-white">Personne à répartir pour l&apos;instant.</p>
            <p className="mt-1 text-sm text-gray-light">
              Dis d&apos;abord qui participe à cet atelier{" "}
              <Link
                href={`${base}/presences`}
                className="text-cyan hover:text-cyan-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded"
              >
                sur la page Participantes
              </Link>
              , puis reviens répartir.
            </p>
          </>
        ) : (
          <>
            <p className={`mt-1 text-lg font-bold ${couverture.complete ? "text-white" : "text-orange"}`}>
              {couverture.complete
                ? "Tout le monde a un sous-groupe."
                : `${nb(couverture.nbRangees, "rangée")} sur ${couverture.total} · ${nb(couverture.aRanger.length, "participante")} à ranger`}
            </p>
            <p className="mt-1 text-sm text-gray-light">
              Sur l&apos;audience de l&apos;atelier&nbsp;: {libelleAudience(a.audience, a.phase).toLowerCase()}.
            </p>
          </>
        )}
      </section>

      {aRanger.length > 0 && (
        <section aria-labelledby="a-ranger-titre">
          <h2 id="a-ranger-titre" className="text-lg font-bold">
            Sans sous-groupe
          </h2>
          <p className="mt-1 mb-3 text-sm text-gray-light">
            Ouvre un sous-groupe ci-dessous pour y ranger l&apos;une d&apos;elles, ou crées-en un
            nouveau.
          </p>
          <ul role="list" className="flex flex-wrap gap-2 list-none">
            {aRanger.map((p) => (
              <li
                key={p.id}
                className="rounded-lg border border-orange/30 bg-orange/10 px-3 py-1.5 text-sm text-white"
              >
                {p.nom}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="groupes-titre" className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <h2 id="groupes-titre" className="text-lg font-bold">
            Les sous-groupes
          </h2>
          {/* UN bouton, aucun champ : « Ils n'ont pas besoin de noms ». Le clic
              crée le groupe et OUVRE sa page (l'action redirige), là où l'on
              coche les participantes et les coachs. Rendu ici plutôt que dans un
              composant client dédié — toutes les props sont sérialisables. */}
          <InlineActionForm
            action={createSousGroupeAction}
            hidden={{ editionId, atelierId: a.id }}
            submitLabel="Ajouter un sous-groupe"
            pendingLabel="Création…"
            variant="primary"
          />
        </div>
        {sousGroupes.length === 0 ? (
          <p className="text-sm text-gray-light">
            Aucun sous-groupe pour l&apos;instant. Le bouton « Ajouter un
            sous-groupe » en crée un et l&apos;ouvre aussitôt, pour que tu y
            mettes des participantes et, si besoin, une ou plusieurs coachs.
          </p>
        ) : (
          <ul role="list" className="flex flex-col gap-2 list-none">
            {sousGroupes.map((sg, i) => {
              const membres = nommer(sg.membres);
              // Le sous-groupe se DÉSIGNE par qui est dedans (migration 052) :
              // « Binôme 1 », « Binôme 2 »… n'apprenaient rien, il fallait
              // ouvrir chaque groupe pour savoir qui le composait. TOUS les
              // membres sont nommés : écourter la liste laissait la quatrième
              // participante d'un groupe absente de l'écran qui sert justement à
              // savoir qui est dedans. Deux lignes suffisent (`titleClamp`).
              const titre = libelleSousGroupe(
                membres.map((m) => m.nom),
                i + 1,
              );
              const coachs = libelleCoachsEtiquete(sg.coachs.map(coachLabel));
              const faitLisible =
                sg.faitLe && formatDateFr(sg.faitLe, { day: "numeric", month: "long" });
              return (
                <li key={sg.id}>
                  <NavRow
                    href={`${base}/sous-groupes/${sg.id}`}
                    title={titre}
                    titleClamp={2}
                    // Un groupe encore vide n'a qu'une chose à dire : ce qu'il
                    // reste à faire. « Autonome · à faire » y serait du bruit.
                    subtitle={
                      membres.length === 0
                        ? "À composer"
                        : [coachs, faitLisible ? `fait le ${faitLisible}` : "à faire"].join(" · ")
                    }
                    // Un sous-groupe vide est le seul manque qui se signale ici :
                    // le reste (autonome, à faire) est un état normal.
                    flag={membres.length === 0}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </SousPage>
  );
}
