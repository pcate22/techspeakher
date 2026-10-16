import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { requireOrgaId } from "@/lib/auth-guards";
import NavRow from "@/components/NavRow";
import { registrationLabel, rangLabel } from "@/lib/tremplin-registrations";
import {
  getPhaseMembersByEdition,
  type MembershipPhase,
} from "@/lib/tremplin-registration-phases";
import { getDocumentsByEdition } from "@/lib/tremplin-documents";
import {
  getAteliersByEdition,
  getAtelierMembersByEdition,
  type Atelier,
  type MembreAtelier,
  type Presence,
} from "@/lib/tremplin-ateliers";
import { getCoachsByRegistration, coachLabel } from "@/lib/tremplin-coachs";
import {
  getRecompensesByRegistration,
  type Recompense,
} from "@/lib/tremplin-recompenses";
import { loadRegistrationOrNotFound } from "@/lib/tremplin-admin";
import { nb } from "@/lib/format";

export const metadata: Metadata = {
  title: "Participante | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

// Présence : libellé + couleur. L'info est TOUJOURS portée par le mot, jamais
// par la couleur seule (WCAG 1.4.1, cf. docs/principes-conception-ui.md §9).
const PRESENCE: Record<Presence, { label: string; cls: string }> = {
  presente: { label: "Présente", cls: "text-cyan" },
  absente: { label: "Absente", cls: "text-orange" },
  non_renseignee: { label: "Non pointée", cls: "text-gray-light" },
};

/**
 * HUB de la participante, en CHRONOLOGIE autour de la soirée (= la finale du
 * Tremplin). Avant la soirée : ses ateliers et sa présence. La soirée / finale :
 * son résultat (finaliste, classement, récompenses) — les résultats vivent DANS
 * la finale, pas dans une section à part. Après la soirée : la préparation à la
 * conférence (ateliers, coaching). Puis les documents (transverses) et « Son
 * espace » (administratif). L'édition de chaque item vit sur sa page dédiée.
 */
export default async function FicheParticipante({
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

  const [allDocs, coachs, recompenses, phaseMembers, ateliers, membresParAtelier] =
    await Promise.all([
      getDocumentsByEdition(editionId),
      getCoachsByRegistration(r.id).catch((e) => {
        console.error("Coachs indisponibles (migration 017 ?)", e);
        return [];
      }),
      getRecompensesByRegistration(r.id).catch((e) => {
        console.error("Récompenses indisponibles (migration 018 ?)", e);
        return [] as Recompense[];
      }),
      getPhaseMembersByEdition(editionId).catch((e) => {
        console.error("Appartenances de phase indisponibles (migration 025 ?)", e);
        return new Map<number, Set<MembershipPhase>>();
      }),
      getAteliersByEdition(editionId).catch((e) => {
        console.error("Ateliers indisponibles", e);
        return [];
      }),
      getAtelierMembersByEdition(editionId).catch((e) => {
        console.error("Membres d'atelier indisponibles (migration 015 ?)", e);
        return new Map<number, MembreAtelier[]>();
      }),
    ]);
  const mesPhases = phaseMembers.get(r.id);
  const documents = allDocs.filter((d) => d.registrationId === r.id);
  const base = `/admin/tremplins/${editionId}/participantes/${r.id}`;
  // Talk pitché : son titre est déjà porté par l'inscription (jointure
  // `talk_id → speaker_talks.titre`), pas de requête séparée.
  const talkTitre = r.talkTitre;
  // Repli d'affichage : une classée SANS talk (gagnante archivée) montre son
  // titre primé figé (titre_palmares) plutôt que « À définir ».
  const titreAffiche = talkTitre ?? r.titrePalmares;

  // Ses ateliers (là où elle est inscrite), avec sa présence, dans l'ordre.
  const mesAteliers = ateliers
    .map((a) => {
      const membre = (membresParAtelier.get(a.id) ?? []).find(
        (m) => m.registrationId === r.id,
      );
      return membre ? { atelier: a, presence: membre.presence } : null;
    })
    .filter((x): x is { atelier: Atelier; presence: Presence } => x !== null);
  const ateliersAvant = mesAteliers.filter((x) => x.atelier.phase === "cfp_et_pitch");
  const ateliersApres = mesAteliers.filter((x) => x.atelier.phase === "montee_sur_scene");

  const confActive = mesPhases?.has("montee_sur_scene") ?? false;

  const phasesLabel = [
    mesPhases?.has("cfp_et_pitch") && "Phase 1",
    r.finalePresente && "Finaliste",
    mesPhases?.has("montee_sur_scene") && "Phase 3",
  ]
    .filter(Boolean)
    .join(" · ");

  const carteAtelier = ({ atelier: a, presence }: { atelier: Atelier; presence: Presence }) => (
    <li
      key={a.id}
      className="flex items-center justify-between gap-3 rounded-xl border border-navy-lighter bg-navy px-4 py-3"
    >
      <span className="min-w-0">
        <span className="block font-medium truncate">{a.titre}</span>
        {a.date && <span className="block text-xs text-gray-light">{a.date}</span>}
      </span>
      <span
        className={`shrink-0 text-xs font-bold uppercase tracking-wide ${PRESENCE[presence].cls}`}
      >
        {PRESENCE[presence].label}
      </span>
    </li>
  );

  const dot = "self-start mt-0.5 relative z-10 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-2 border-navy";

  const espace = [
    {
      href: `${base}/parcours`,
      title: "Phases du Tremplin",
      subtitle: phasesLabel || "Aucune phase pour l'instant",
    },
    {
      href: `${base}/compte`,
      title: "Son compte sur la plateforme",
      subtitle: r.userId
        ? `Rattachée à ${r.userName ?? r.userEmail ?? `n° ${r.userId}`}`
        : "Sans compte relié",
      flag: !r.userId,
    },
    {
      href: `${base}/visibilite`,
      title: "Visibilité sur la page publique",
      subtitle: r.public ? "Visible du public" : "Masquée du public",
    },
    {
      href: `${base}/retrait`,
      title: "Retirer de l'édition",
      subtitle: "À réserver aux erreurs ou à une demande de sa part",
      danger: true,
    },
  ];

  // Un temps de la frise : pastille sur le rail + libellé + contenu.
  const temps = (marker: string, label: ReactNode, contenu: ReactNode) => (
    <li className="flex gap-4">
      <span aria-hidden="true" className={marker} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold uppercase tracking-wide mb-2">{label}</p>
        {contenu}
      </div>
    </li>
  );

  return (
    <div className="py-10 px-4">
      <div className="max-w-2xl mx-auto flex flex-col gap-8">
        <header>
          <p
            aria-hidden="true"
            className="text-xs font-bold uppercase tracking-wide text-gray-light"
          >
            Participante
          </p>
          <h1 className="text-2xl font-bold">
            <span className="sr-only">Participante&nbsp;: </span>
            {nom}
          </h1>
          <p className="text-sm text-gray-light mt-1">
            {[r.participanteRole, titreAffiche && `« ${titreAffiche} »`]
              .filter(Boolean)
              .join(" · ") || "Inscrite à cette édition"}
          </p>
          <p className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold uppercase tracking-wide">
            <span className={r.userId ? "text-cyan" : "text-gray-light"}>
              {r.userId ? "✓ Compte rattaché" : "Sans compte"}
            </span>
            <span className={r.public ? "text-cyan" : "text-gray-light"}>
              {r.public ? "● Visible du public" : "Masquée du public"}
            </span>
            <span className={r.finalePresente ? "text-gold" : "text-gray-light"}>
              {r.finalePresente ? "★ Finaliste" : "Non finaliste"}
            </span>
            {r.classement != null && (
              <span className="text-gold">🏆 {rangLabel(r.classement)}</span>
            )}
          </p>
        </header>

        {/* Chronologie autour de la soirée (= la finale). */}
        <section aria-labelledby="parcours-titre">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 id="parcours-titre" className="text-lg font-bold">
              Parcours
            </h2>
            <Link
              href={`${base}/ateliers`}
              className="text-sm text-cyan hover:text-cyan-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded shrink-0"
            >
              Gérer les ateliers
            </Link>
          </div>

          <div className="relative">
            <span
              aria-hidden="true"
              className="absolute left-[9px] top-4 bottom-4 w-px bg-navy-lighter"
            />
            <ol role="list" className="relative flex flex-col gap-8 list-none m-0 p-0">
              {/* Avant la soirée */}
              {temps(
                `${dot} bg-cyan`,
                <span className="text-gray-light">Avant la soirée</span>,
                ateliersAvant.length > 0 ? (
                  <ul role="list" className="flex flex-col gap-2 list-none m-0 p-0">
                    {ateliersAvant.map(carteAtelier)}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-light">Aucun atelier avant la soirée.</p>
                ),
              )}

              {/* La soirée = la finale : le résultat vit ici */}
              {temps(
                `${dot} bg-gold ring-2 ring-gold/40`,
                <span className="text-gold">
                  La soirée · la finale
                  <span className="ml-2 font-normal normal-case tracking-normal text-gray-light">
                    {r.finalePresente ? "Finaliste" : "Non finaliste"}
                  </span>
                </span>,
                <ul role="list" className="flex flex-col gap-2 list-none m-0 p-0">
                  <li>
                    <NavRow
                      href={`${base}/talk`}
                      title="Talk pitché au Tremplin"
                      subtitle={
                        talkTitre ??
                        (r.titrePalmares
                          ? `« ${r.titrePalmares} » (titre primé archivé)`
                          : "À définir")
                      }
                      flag={talkTitre == null && r.titrePalmares == null}
                    />
                  </li>
                  <li>
                    <NavRow
                      href={`${base}/classement`}
                      title="Classement au podium"
                      subtitle={rangLabel(r.classement) ?? "Non classée"}
                    />
                  </li>
                  <li>
                    <NavRow
                      href={`${base}/recompenses`}
                      title="Récompenses"
                      subtitle={
                        recompenses.length === 0
                          ? "Aucune récompense"
                          : nb(recompenses.length, "récompense")
                      }
                    />
                  </li>
                  <li>
                    <NavRow
                      href={`${base}/documents`}
                      title="Documents (dont feedback jury)"
                      subtitle={
                        documents.length === 0 ? "Aucun document" : nb(documents.length, "document")
                      }
                    />
                  </li>
                </ul>,
              )}

              {/* Après la soirée : préparation à la conférence */}
              {temps(
                `${dot} ${confActive ? "bg-magenta-light ring-2 ring-magenta-light/40" : "bg-navy-lighter"}`,
                <span className={confActive ? "text-cyan" : "text-gray-light"}>
                  Après la soirée · préparation à la conférence
                  {confActive && (
                    <span className="ml-2 font-normal normal-case tracking-normal">· en cours</span>
                  )}
                </span>,
                <ul role="list" className="flex flex-col gap-2 list-none m-0 p-0">
                  {ateliersApres.map(carteAtelier)}
                  <li>
                    <NavRow
                      href={`${base}/coaching`}
                      title="Coaching individuel"
                      subtitle={
                        coachs.length > 0
                          ? coachs.map(coachLabel).join(", ")
                          : "Aucun coach individuel"
                      }
                    />
                  </li>
                </ul>,
              )}
            </ol>
          </div>
        </section>

        <section aria-labelledby="espace-titre">
          <h2
            id="espace-titre"
            className="text-xs font-bold uppercase tracking-wide text-gray-light mb-2"
          >
            Son espace
          </h2>
          <ul role="list" className="flex flex-col gap-2 list-none m-0 p-0">
            {espace.map((row) => (
              <li key={row.href}>
                <NavRow
                  href={row.href}
                  title={row.title}
                  subtitle={row.subtitle}
                  flag={row.flag}
                  tone={row.danger ? "danger" : undefined}
                />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
