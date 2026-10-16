import type { Metadata } from "next";
import { requireOrgaId } from "@/lib/auth-guards";
import NavRow from "@/components/NavRow";
import FaitsAtelier from "@/components/FaitsAtelier";
import {
  getAtelierMembers,
  getAtelierPresences,
  getCohorteAtelier,
  getSousGroupesByAtelier,
  NATURE_ATELIER_COURT,
  PHASE_ATELIER_LABEL,
} from "@/lib/tremplin-ateliers";
import { countDocumentsByAtelier } from "@/lib/tremplin-documents";
import { getCoachsByAtelier, coachLabel } from "@/lib/tremplin-coachs";
import { countRegistrationsByEdition } from "@/lib/tremplin-registrations";
import { couvertureSousGroupes } from "@/lib/atelier-sous-groupes";
import { nb, quandFr } from "@/lib/format";
import { aujourdhuiParis } from "@/lib/tremplin-statut";
import { atelierEtat } from "@/lib/atelier-etat";
import { loadAtelierOrNotFound } from "@/lib/tremplin-admin";

export const metadata: Metadata = {
  title: "Atelier | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/**
 * Fiche ATELIER = un ÉVÉNEMENT (lot C, refonte §4) : ses FAITS d'abord (quand,
 * où, qui, avancement — dérivés par `atelierEtat`), puis les surfaces
 * d'édition, une page par fonction. Les alertes ne sonnent que là où il y a un
 * manque réel : un atelier autonome est « autonome », pas « coach à trouver » ;
 * un atelier en sous-groupes ne réclame jamais de présences ; et rien ne se
 * réclame avant que l'atelier soit daté.
 *
 * RGPD : libellés d'atelier et nombres ; les noms (coachs, participantes)
 * restent sur les sous-pages dédiées. Le compte d'inscrites n'est chargé que
 * pour une audience « toutes les inscrites » — seul cas où il s'affiche.
 */
export default async function FicheAtelier({
  params,
}: {
  params: Promise<{ edition: string; atelier: string }>;
}) {
  await requireOrgaId();
  const { edition: editionParam, atelier: atelierParam } = await params;
  const { editionId, atelier: a } = await loadAtelierOrNotFound(editionParam, atelierParam);

  const [membreIds, presences, coachs, nbSupports, sousGroupes, nbInscritesEdition, cohorte] =
    await Promise.all([
      getAtelierMembers(a.id),
      // Colonne pas encore migrée (019) : la fiche ne casse pas, l'avancement
      // est simplement omis.
      getAtelierPresences(a.id).catch((e): null => {
        console.error("Présences indisponibles (migration 019 ?)", e);
        return null;
      }),
      getCoachsByAtelier(a.id).catch((e) => {
        console.error("Coachs indisponibles (migration 017 ?)", e);
        return [];
      }),
      countDocumentsByAtelier(a.id),
      getSousGroupesByAtelier(a.id),
      a.audience === "toutes" ? countRegistrationsByEdition(editionId) : Promise.resolve(0),
      // Qui l'atelier CONCERNE, selon son audience : c'est sur ce total que se
      // comptent les présences restant à pointer — ET l'ensemble que les
      // sous-groupes doivent couvrir.
      getCohorteAtelier(a.id, editionId).catch((e): number[] => {
        console.error("Cohorte de l'atelier indisponible", e);
        return [];
      }),
    ]);

  // La cohorte de l'atelier EST l'ensemble que les sous-groupes doivent couvrir.
  const couverture = couvertureSousGroupes(
    cohorte,
    sousGroupes.map((g) => g.membres),
  );

  const etat = atelierEtat({
    atelier: a,
    nbMembres: membreIds.length,
    nbInscritesEdition,
    nbCoachs: coachs.length,
    presences: presences?.map((p) => p.presence) ?? null,
    nbCohorte: cohorte.length,
    sousGroupes: {
      total: sousGroupes.length,
      faits: sousGroupes.filter((g) => g.faitLe !== null).length,
      avecCoach: sousGroupes.filter((g) => g.coachs.length > 0).length,
      ranges: couverture.nbRangees,
    },
    aujourdhui: aujourdhuiParis(),
  });

  const base = `/admin/tremplins/${editionId}/ateliers/${a.id}`;
  // Une rangée = une fonction, dans l'ordre de remplissage. Chaque sous-titre
  // montre une VALEUR (pas un inventaire de champs), et les surfaces qui ne
  // veulent rien dire pour cette nature ne s'affichent pas (le lien d'atelier
  // d'une revue croisée vit par sous-groupe).
  const rangees = [
    {
      href: `${base}/infos`,
      title: "Informations",
      subtitle: [quandFr(a.date, a.dateFin) ?? "Date à définir", a.lieu]
        .filter(Boolean)
        .join(" · "),
    },
    {
      href: `${base}/coachs`,
      title: "Coachs",
      // `||` et pas `??` : un `coachs` vide en base n'est pas nullish, la
      // rangée restait alors sans sous-titre. Le repli vient de l'état, pour
      // que la rangée et le QUI ne se contredisent jamais.
      subtitle: coachs.map(coachLabel).join(", ") || a.coachs?.trim() || etat.sousTitreCoachs,
      // L'alerte de coach vit dans le QUI (une seule fois) : ici, la rangée
      // reste une porte d'accès neutre.
    },
    ...(etat.montreVisio
      ? [
          {
            href: `${base}/visio`,
            title: "Lien de connexion (visio)",
            subtitle: a.lienVisio ?? "À ajouter",
          },
        ]
      : []),
    {
      href: `${base}/presences`,
      title: etat.libelleParticipantes,
      subtitle: etat.sousTitreParticipantes,
    },
    // La RÉPARTITION a sa propre porte : « qui participe » et « comment c'est
    // réparti » sont deux fonctions, et la seconde restait invisible tant
    // qu'elle vivait au fond de la première.
    ...(etat.sousTitreSousGroupes !== null
      ? [
          {
            href: `${base}/sous-groupes`,
            title: "Sous-groupes",
            subtitle: etat.sousTitreSousGroupes,
          },
        ]
      : []),
    {
      href: `${base}/documents`,
      title: "Supports",
      subtitle: nbSupports === 0 ? "Aucun support" : nb(nbSupports, "support"),
    },
  ];

  return (
    // <div>, pas <main> : le layout racine fournit déjà le landmark principal.
    <div className="py-10 px-4">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        <header>
          <h1 className="text-2xl font-bold">{a.titre}</h1>
          <p className="text-sm text-gray-light mt-1">
            {[PHASE_ATELIER_LABEL[a.phase], NATURE_ATELIER_COURT[a.nature]].join(" · ")}
          </p>
          {a.description && <p className="text-sm text-gray-light mt-2">{a.description}</p>}
        </header>

        {/* Les FAITS avant les actions : on sait où on en est, puis on agit. */}
        <section
          aria-labelledby="faits-titre"
          className="rounded-2xl border border-navy-lighter bg-navy-light p-5"
        >
          <h2 id="faits-titre" className="sr-only">
            L&apos;essentiel de l&apos;atelier
          </h2>
          <FaitsAtelier etat={etat} atelier={a} titre={a.titre} />
        </section>

        <section aria-labelledby="fonctions-titre">
          <h2
            id="fonctions-titre"
            className="text-xs font-bold uppercase tracking-wider text-gray-light mb-3"
          >
            Gérer l&apos;atelier
          </h2>
          <ul role="list" className="flex flex-col gap-2 list-none">
            {rangees.map((r) => (
              <li key={r.href}>
                <NavRow href={r.href} title={r.title} subtitle={r.subtitle} />
              </li>
            ))}
            {/* La suppression ferme le sommaire, en dernier et en orange : rare
                et destructive, elle mène à sa page plutôt que d'exposer un
                bouton au milieu des réglages courants (§10). */}
            <li>
              <NavRow
                href={`${base}/retrait`}
                title="Supprimer l'atelier"
                subtitle="Séance annulée, ou atelier créé en double"
                tone="danger"
              />
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
