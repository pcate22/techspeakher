import type { Metadata } from "next";
import Link from "next/link";
import { requireOrgaId } from "@/lib/auth-guards";
import InlineActionForm from "@/components/InlineActionForm";
import { AnnonceListe } from "@/components/AnnonceListe";
import SettingToggle from "@/components/SettingToggle";
import ChoixAudience from "@/components/ChoixAudience";
import {
  libelleAudience,
  PROGRAMME_PUBLIC_LABEL,
  PROGRAMME_PUBLIC_AIDE,
} from "@/lib/atelier-audience";
import ToggleWithDependent from "@/components/ToggleWithDependent";
import {
  getAtelierMembers,
  getAtelierPresences,
  type Presence,
} from "@/lib/tremplin-ateliers";
import {
  getRegistrationsByEdition,
  registrationLabel,
} from "@/lib/tremplin-registrations";
import {
  getPhaseMembersOuVide,
  cohortePhaseAAjouter,
  MEMBERSHIP_PHASE_LABEL,
} from "@/lib/tremplin-registration-phases";
import { loadAtelierOrNotFound } from "@/lib/tremplin-admin";
import {
  setAtelierMembreAction,
  setAtelierAudienceAction,
  setAtelierProgrammePublicAction,
  setAtelierPresenceAction,
  activerCohortePhaseAtelierAction,
  marquerToutesPresentesAction,
} from "../../../../actions";

export const metadata: Metadata = {
  title: "Participantes et présences | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/** Sous-page mono-fonction : qui participe à l'atelier. Selon la NATURE : soit on
 * pointe les présences (collectif), soit on liste les sous-groupes — chacun a SA
 * page dédiée où l'on range les participantes et suit la réalisation (revue
 * croisée, points individuels). Cette page reste une CONSULTATION : elle montre
 * et laisse choisir où aller (règle d'or ; hub-and-spoke, principes §1). */
export default async function PresencesAtelier({
  params,
}: {
  params: Promise<{ edition: string; atelier: string }>;
}) {
  await requireOrgaId();
  const { edition: editionParam, atelier: atelierParam } = await params;
  const { editionId, atelier: a } = await loadAtelierOrNotFound(editionParam, atelierParam);
  const estSousGroupes = a.nature === "sous_groupes";

  const [registrations, membreIds, presences, phaseMembers] =
    await Promise.all([
      getRegistrationsByEdition(editionId),
      getAtelierMembers(a.id),
      // Colonne pas encore migrée (019) : la page ne casse pas, la liste des
      // présences est simplement masquée.
      getAtelierPresences(a.id).catch((e): null => {
        console.error("Présences indisponibles (migration 019 ?)", e);
        return null;
      }),
      getPhaseMembersOuVide(editionId),
    ]);
  const membreSet = new Set(membreIds);
  const nbCohorteAAjouter = cohortePhaseAAjouter(phaseMembers, a.phase, membreIds).length;
  const presenceParInscription = new Map<number, Presence>(
    (presences ?? []).map((p) => [p.registrationId, p.presence]),
  );
  const triees = [...registrations].sort((x, y) =>
    registrationLabel(x).localeCompare(registrationLabel(y), "fr"),
  );

  // QUI est concerné : l'audience le dit, la page ne liste que celles-là. On
  // pointait auparavant les présences sur TOUTE l'édition, en s'aidant d'un
  // interrupteur d'appartenance par personne — le même interrupteur qui servait
  // aussi de règle de visibilité, d'où la confusion qu'on supprime ici.
  const estSelection = a.audience === "selection";
  const estPhase = a.audience === "phase";
  const concernees = estPhase
    ? triees.filter((r) => phaseMembers.get(r.id)?.has(a.phase))
    : triees;
  // Le pointage ne concerne QUE les rendez-vous collectifs : la réalisation
  // d'un atelier en sous-groupes se suit par sous-groupe, jamais par présence
  // (même règle que l'avancement de `atelier-etat.ts`).
  const pointageActif = !estSousGroupes && presences !== null;
  const nbNonPointees =
    !pointageActif
      ? 0
      : concernees.filter(
          (r) => (presenceParInscription.get(r.id) ?? "non_renseignee") === "non_renseignee",
        ).length;
  const videConcernees = estPhase
    ? `Aucune inscrite rattachée à « ${MEMBERSHIP_PHASE_LABEL[a.phase]} » pour l'instant. Rattache-les depuis leur fiche, elles apparaîtront ici.`
    : "Aucune inscrite sur cette édition.";

  return (
    <div className="py-10 px-4">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        <header>
          <h1 className="text-2xl font-bold">
            {estSousGroupes ? "Participantes" : "Participantes et présences"}
          </h1>
          {/* Ici on pointe des présences : QUI est concerné suffit. L'aide
              complète (avec sa conséquence sur le programme public) appartient à
              l'écran où l'audience se CHOISIT — en sous-titre de pointage, elle
              faisait quatre phrases hors sujet sur un mobile. */}
          <p className="text-sm text-gray-light mt-1">
            « {a.titre} » · {libelleAudience(a.audience, a.phase)}
            {estSousGroupes && " La répartition en sous-groupes se règle sur sa propre page."}
          </p>
        </header>

        {/* L'AUDIENCE : un choix exclusif (migration 051). Elle décide seule
            qui voit l'atelier — la liste nominative n'élargit plus rien. */}
        <section
          aria-labelledby="audience-titre"
          className="border border-navy-lighter rounded-xl px-4 py-3 bg-navy"
        >
          <h2 id="audience-titre" className="sr-only">
            Audience de l&apos;atelier
          </h2>
          <ChoixAudience
            action={setAtelierAudienceAction}
            hidden={{ editionId, atelierId: a.id }}
            audience={a.audience}
            phase={a.phase}
          />
        </section>

        {/* CE QUE LE SITE PUBLIC ANNONCE — une question à part (migration 056).
            Elle se déduisait de l'audience, si bien que l'orga réglait la
            vitrine sans le savoir : régler « qui voit » et « ce qu'on montre »
            sont deux décisions, elles se prennent chacune en connaissance de
            cause. La description dit les champs publiés un par un, et dit que
            le lieu reste entre elles — c'est la question de celle qui hésite. */}
        <section
          aria-labelledby="vitrine-titre"
          className="border border-navy-lighter rounded-xl px-4 py-3 bg-navy"
        >
          <h2 id="vitrine-titre" className="sr-only">
            Visibilité de l&apos;atelier sur le site public
          </h2>
          <SettingToggle
            action={setAtelierProgrammePublicAction}
            hidden={{ editionId, atelierId: a.id }}
            checked={a.auProgrammePublic}
            label={PROGRAMME_PUBLIC_LABEL}
            description={PROGRAMME_PUBLIC_AIDE}
            successMessage="Visibilité mise à jour."
          />
        </section>

        {/* Le compte rendu des gestes en LOT vit au-dessus d'eux : « Marquer
            présentes les N non encore pointées » disparaît quand N tombe à
            zéro, emportant sa région vive avant qu'elle n'ait parlé. */}
        <AnnonceListe>
        <section aria-labelledby="participantes-titre">
          <h2 id="participantes-titre" className="sr-only">
            {estSousGroupes
              ? "Participantes de l'atelier"
              : "Participantes et pointage des présences"}
          </h2>
          {/* Les gestes en lot, seulement là où ils veulent dire quelque
              chose : « activer la cohorte » n'a de sens que pour une
              SÉLECTION (ailleurs l'audience porte déjà la cohorte). */}
          {((estSelection && nbCohorteAAjouter > 0) || nbNonPointees > 0) && (
            <div className="flex flex-wrap gap-x-6 gap-y-2 mb-4">
              {estSelection && nbCohorteAAjouter > 0 && (
                <InlineActionForm
                  action={activerCohortePhaseAtelierAction}
                  hidden={{ editionId, atelierId: a.id }}
                  submitLabel={
                    nbCohorteAAjouter > 1
                      ? `Ajouter les ${nbCohorteAAjouter} participantes de « ${MEMBERSHIP_PHASE_LABEL[a.phase]} »`
                      : `Ajouter la participante de « ${MEMBERSHIP_PHASE_LABEL[a.phase]} »`
                  }
                  pendingLabel="Ajout…"
                  successMessage="Participantes ajoutées à la sélection."
                />
              )}
              {nbNonPointees > 0 && (
                <InlineActionForm
                  action={marquerToutesPresentesAction}
                  hidden={{ editionId, atelierId: a.id }}
                  submitLabel={
                    nbNonPointees > 1
                      ? `Marquer présentes les ${nbNonPointees} non encore pointées`
                      : "Marquer présente la participante non encore pointée"
                  }
                  pendingLabel="Enregistrement…"
                  successMessage="Présences enregistrées."
                />
              )}
            </div>
          )}
          {concernees.length === 0 ? (
            <p className="text-sm text-gray-light">{videConcernees}</p>
          ) : (
            <div className="divide-y divide-navy-lighter">
              {concernees.map((r) => {
                const presence = pointageActif && (
                  <SettingToggle
                    action={setAtelierPresenceAction}
                    hidden={{ editionId, atelierId: a.id, registrationId: r.id }}
                    checked={presenceParInscription.get(r.id) === "presente"}
                    control="checkbox"
                    label="Présente"
                    ariaLabel={`Présente — ${registrationLabel(r)}`}
                    successMessage="Présence mise à jour."
                  />
                );
                // Hors « sélection », l'appartenance ne se règle plus ici :
                // l'audience la donne. Il ne reste qu'à pointer la présence,
                // sur une seule ligne — un interrupteur de moins par personne.
                if (!estSelection) {
                  return (
                    <div key={r.id} className="flex items-center justify-between gap-3 py-1">
                      <span className="text-sm text-white">{registrationLabel(r)}</span>
                      {presence || null}
                    </div>
                  );
                }
                const membreToggle = {
                  action: setAtelierMembreAction,
                  hidden: { editionId, atelierId: a.id, registrationId: r.id },
                  checked: membreSet.has(r.id),
                  label: registrationLabel(r),
                  successMessage: "Participante mise à jour.",
                };
                if (presences === null) {
                  return (
                    <div key={r.id}>
                      <SettingToggle {...membreToggle} />
                    </div>
                  );
                }
                return (
                  <div key={r.id}>
                    <ToggleWithDependent toggle={membreToggle} dependent={presence} />
                  </div>
                );
              })}
            </div>
          )}
        </section>
        </AnnonceListe>

        <p>
          <Link
            href={`/admin/tremplins/${editionId}/ateliers/${a.id}`}
            className="inline-block py-2 -my-2 text-sm text-cyan hover:text-cyan-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded"
          >
            ← Retour à l&apos;atelier
          </Link>
        </p>
      </div>
    </div>
  );
}
