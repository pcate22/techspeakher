import type { Metadata } from "next";
import { requireOrgaId } from "@/lib/auth-guards";
import ListPageTemplate from "@/components/ListPageTemplate";
import BandeauVue from "@/components/BandeauVue";
import { SetFilCrumbs } from "../FilContext";
import { VUES, cleVue, messageVide } from "@/lib/vue-liste";
import {
  getRegistrationsByEdition,
  rangLabel,
  registrationLabel,
  trierParLabel,
} from "@/lib/tremplin-registrations";
import {
  getPhaseMembersByEdition,
  type MembershipPhase,
} from "@/lib/tremplin-registration-phases";
import { getVenuesByEdition } from "@/lib/tremplin-ateliers";
import { nb } from "@/lib/format";
import { getComptesSpeakeuses, compteLabel } from "@/lib/users";
import AddParticipanteDialog from "../AddParticipanteDialog";
import NavRow from "@/components/NavRow";
import ParticipantesNav from "../ParticipantesNav";
import { tremplinPageMetadata } from "@/lib/tremplin-page-meta";
import { loadEditionOrNotFound } from "@/lib/tremplin-admin";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ edition: string }>;
}): Promise<Metadata> {
  return tremplinPageMetadata((await params).edition, "Participantes");
}

export const dynamic = "force-dynamic";

export default async function ParticipantesIndex({
  params,
  searchParams,
}: {
  params: Promise<{ edition: string }>;
  searchParams: Promise<{ vue?: string | string[] }>;
}) {
  await requireOrgaId();
  const { editionId, edition } = await loadEditionOrNotFound((await params).edition);
  // Vue filtrée : d'où l'on vient quand la tâche « Relier N participantes à un
  // compte » désigne un sous-ensemble.
  const vue = cleVue((await searchParams).vue, ["sans-compte"]);

  const [registrations, comptesSpeakeuses, venues, phaseMembers] = await Promise.all([
    getRegistrationsByEdition(editionId),
    getComptesSpeakeuses(),
    getVenuesByEdition(editionId).catch((e) => {
      console.error("Présences indisponibles (migration 019 ?)", e);
      return new Set<number>();
    }),
    getPhaseMembersByEdition(editionId).catch((e) => {
      console.error("Appartenances de phase indisponibles (migration 025 ?)", e);
      return new Map<number, Set<MembershipPhase>>();
    }),
  ]);

  const participantesTriees = trierParLabel(registrations);
  // La vue réduit la liste à son sujet : on arrive SUR les inscrites à relier,
  // au lieu de les chercher parmi toutes (cf. src/lib/vue-liste.ts).
  const visibles = vue
    ? participantesTriees.filter((r) => !r.userId)
    : participantesTriees;
  const nbPubliques = registrations.filter((r) => r.public).length;
  const nbSansCompte = registrations.filter((r) => !r.userId).length;
  const nbVenues = registrations.filter((r) => venues.has(r.id)).length;
  const pouls = [
    nbVenues > 0 && `${nb(nbVenues, "venue")} aux ateliers`,
    nbPubliques > 0 && `${nb(nbPubliques, "visible")} du public`,
    nbSansCompte > 0 && `${nbSansCompte} sans compte relié`,
  ].filter((x): x is string => Boolean(x));

  // Le sous-titre d'une inscrite, écrit UNE fois pour les deux rendus (liste
  // complète sectionnée, vue filtrée plate) : tout ce qui compte est ÉCRIT —
  // son sujet, son rang, ou ce qui manque. Aucun pictogramme à décoder (KISS).
  const sousTitreDe = (r: (typeof registrations)[number]): string =>
    [
      (r.talkTitre ?? r.titrePalmares) && `« ${r.talkTitre ?? r.titrePalmares} »`,
      rangLabel(r.classement),
      !r.userId && "sans compte relié",
    ]
      .filter(Boolean)
      .join(" · ") || "Inscrite";

  // Les phases d'une inscription pour le sectionnement : 1 et 3 depuis
  // l'appartenance, 2 (finale) depuis finale_presente (source de vérité).
  const phaseKeysOf = (r: (typeof registrations)[number]): string[] => {
    const set = phaseMembers.get(r.id);
    return [
      set?.has("cfp_et_pitch") && "cfp_et_pitch",
      r.finalePresente && "finale",
      set?.has("montee_sur_scene") && "montee_sur_scene",
    ].filter((k): k is string => Boolean(k));
  };

  return (
    <>
      <SetFilCrumbs crumbs={[{ label: "Participantes" }]} />
      <ListPageTemplate
      title="Participantes"
      meta={`${edition.nom} · ${nb(registrations.length, "inscrite")}`}
      create={
        <AddParticipanteDialog
          editionId={editionId}
          comptes={comptesSpeakeuses.map((c) => ({ id: c.id, label: compteLabel(c) }))}
        />
      }
    >
      {/* Le pouls de l'édition en une phrase : on ne dit QUE ce qui est
          (un « 0 venue » n'apprend rien), les compteurs par phase vivent sur
          les filtres juste en dessous. En VUE filtrée, il se tait : le bandeau
          porte déjà le seul compte qui intéresse, et trois périmètres de
          chiffres coprésents (édition, vue, phases) se contredisaient à l'œil
          (« Toutes (1) » au-dessus de « Voir toutes les participantes » qui en
          rend 3). */}
      {!vue && pouls.length > 0 && (
        <p className="text-xs text-gray-light -mt-2">{pouls.join(" · ")}.</p>
      )}
      {vue && (
        <BandeauVue
          titre={VUES[vue].titre}
          resume={
            visibles.length > 0
              ? `${nb(visibles.length, "inscrite")} sur ${registrations.length}`
              : messageVide(vue, registrations.length > 0)
          }
          hrefTout={`/admin/tremplins/${editionId}/participantes`}
          libelleTout="Voir toutes les participantes"
        />
      )}
      {/* En vue filtrée : la liste PLATE, sans chips de phase ni sections — une
          vue d'une poignée d'inscrites n'a rien à sous-filtrer (KISS). Le
          bandeau dit déjà ce qu'on regarde ; s'il ne retient rien, il dit ce
          qui EST vrai et la liste se tait. */}
      {vue ? (
        visibles.length > 0 && (
          <ul role="list" className="flex flex-col gap-2 list-none">
            {visibles.map((r) => (
              <li key={r.id}>
                <NavRow
                  href={`/admin/tremplins/${editionId}/participantes/${r.id}`}
                  title={registrationLabel(r)}
                  subtitle={sousTitreDe(r)}
                />
              </li>
            ))}
          </ul>
        )
      ) : (
      <ParticipantesNav
        // Libellés COURTS : trois chips longues faisaient trois rangées avant
        // la première ligne sur un téléphone. « Fin » plutôt que « F » pour que
        // la série « P1·Fin·P3 » se lise sans chercher un « P2 » absent.
        sections={[
          { key: "cfp_et_pitch", titre: "Phase 1", court: "P1" },
          { key: "finale", titre: "Finale", court: "Fin" },
          { key: "montee_sur_scene", titre: "Phase 3", court: "P3" },
        ]}
        items={visibles.map((r) => ({
          id: r.id,
          href: `/admin/tremplins/${editionId}/participantes/${r.id}`,
          nom: registrationLabel(r),
          sousTitre: sousTitreDe(r),
          phaseKeys: phaseKeysOf(r),
        }))}
      />
      )}
      </ListPageTemplate>
    </>
  );
}
