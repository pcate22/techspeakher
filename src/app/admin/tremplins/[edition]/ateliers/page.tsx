import type { Metadata } from "next";
import Link from "next/link";
import { requireOrgaId } from "@/lib/auth-guards";
import ListPageTemplate from "@/components/ListPageTemplate";
import ListeSection from "@/components/ListeSection";
import NavRow from "@/components/NavRow";
import ColonneDate from "@/components/ColonneDate";
import BandeauVue from "@/components/BandeauVue";
import RangeeProgramme from "@/components/RangeeProgramme";
import RangeeGlissante from "@/components/RangeeGlissante";
import { AnnonceListe } from "@/components/AnnonceListe";
import AddAtelierDialog from "../AddAtelierDialog";
import { PARAM_CREER } from "@/lib/creer-atelier";
import { deplacerAtelierAction, retirerAtelierAction } from "../../actions";
import { SetFilCrumbs } from "../FilContext";
import {
  getAteliersByEdition,
  getAtelierMembersByEdition,
  getSousGroupesByEdition,
  getTaillesCohortesByEdition,
  trierAteliersParDate,
  NATURE_ATELIER_COURT,
  PHASE_ATELIER_LABEL,
  PHASES_ATELIER,
  ordonnerParPhase,
  type SousGroupesEtat,
} from "@/lib/tremplin-ateliers";
import { countRegistrationsByEdition } from "@/lib/tremplin-registrations";

import { countDocumentsByEdition } from "@/lib/tremplin-documents";
import { getCoachsByEdition } from "@/lib/tremplin-coachs";
import { moisAgendaFr, nb, quandLongFr } from "@/lib/format";
import { confirmationRetraitAtelier } from "@/lib/atelier-retrait";
import { tremplinPageMetadata } from "@/lib/tremplin-page-meta";
import { loadEditionOrNotFound } from "@/lib/tremplin-admin";
import { aujourdhuiParis, estPasse, finEffective } from "@/lib/tremplin-statut";
import { presencesPerimees } from "@/lib/taches";
import { VUES, cleVue, messageVide, avecVue } from "@/lib/vue-liste";
import { agendaAteliers } from "@/lib/agenda-ateliers";
import { atelierEtat } from "@/lib/atelier-etat";
import MessagesFlash from "@/components/MessagesFlash";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ edition: string }>;
}): Promise<Metadata> {
  return tremplinPageMetadata((await params).edition, "Ateliers");
}

export const dynamic = "force-dynamic";

const AUCUN_SOUS_GROUPE: SousGroupesEtat = { total: 0, faits: 0, avecCoach: 0, ranges: 0 };

/**
 * Liste des ateliers en AGENDA (lot F, refonte §4) : chronologie, mois en
 * repère, passé replié derrière un `<details>`, « à dater » en fin. La phase et
 * la nature deviennent des pastilles VISIBLES de la rangée — plus de sections
 * par phase qui coupaient le temps en deux.
 *
 * Le sous-titre vient de `atelierEtat`, la même dérivation que la fiche : une
 * seule écriture de « qui est concerné et où en est-on », donc aucun risque de
 * voir la liste et la fiche raconter deux choses. Les présences n'y sont pas
 * chargées (`presences: null`) : une liste ne compte pas les pointages, elle
 * situe.
 *
 * RGPD : des nombres, pas de noms. Les prénoms des participantes vivent sur la
 * fiche de l'atelier, pas dans une liste de consultation où ils seraient de
 * toute façon tronqués.
 */
export default async function AteliersIndex({
  params,
  searchParams,
}: {
  params: Promise<{ edition: string }>;
  searchParams: Promise<{
    vue?: string | string[];
    err?: string;
    ok?: string;
    creer?: string;
  }>;
}) {
  await requireOrgaId();
  const { editionId, edition } = await loadEditionOrNotFound((await params).edition);
  const { vue: vueParam, err, ok, [PARAM_CREER]: creer } = await searchParams;
  // Vue filtrée : d'où l'on vient quand une tâche groupée du cockpit désigne un
  // sous-ensemble (« Donner une date à 5 ateliers »).
  const vue = cleVue(vueParam, ["a-dater", "presences", "programme"]);


  const [
    ateliers,
    atelierMembers,
    supportsParAtelier,
    nbInscritesEdition,
    coachsParAtelier,
    sousGroupes,
    taillesCohortes,
  ] = await Promise.all([
    getAteliersByEdition(editionId),
    getAtelierMembersByEdition(editionId),
    countDocumentsByEdition(editionId),
    countRegistrationsByEdition(editionId),
    getCoachsByEdition(editionId).catch((e) => {
      console.error("Coachs indisponibles (migration 017 ?)", e);
      return new Map<number, never[]>();
    }),
    getSousGroupesByEdition(editionId).catch((e) => {
      console.error("Sous-groupes indisponibles (migration 047 ?)", e);
      return new Map<number, SousGroupesEtat>();
    }),
    // UNE requête pour toute la page (anti N+1) : combien de personnes chaque
    // atelier concerne. C'est l'ensemble que ses sous-groupes doivent couvrir,
    // donc ce qui reste à ranger — le fait qu'on cherchait sans le trouver.
    getTaillesCohortesByEdition(editionId).catch((e) => {
      console.error("Tailles de cohortes indisponibles", e);
      return new Map<number, number>();
    }),
  ]);
  const aujourdhui = aujourdhuiParis();
  const { moisAVenir, passes, aDater } = agendaAteliers(ateliers, aujourdhui);

  // Chaque vue recopie la règle EXACTE de la tâche qui y mène (`taches.ts`),
  // avec les données DÉJÀ chargées ici — aucune requête de plus. Péremption
  // post-finale comprise : sinon, cas mixte (des présences d'avant ET d'après la
  // finale), la tâche compte N ateliers et la vue en montrerait N+1, dont
  // l'« histoire » que le cockpit a décidé de taire.
  const nbNonPointees = (atelierId: number) =>
    (atelierMembers.get(atelierId) ?? []).filter((m) => m.presence === "non_renseignee")
      .length;
  const visibles = trierAteliersParDate(
    vue === "a-dater"
      ? ateliers.filter((a) => !a.date)
      : vue === "presences"
        ? ateliers.filter(
            (a) =>
              a.nature !== "sous_groupes" &&
              nbNonPointees(a.id) > 0 &&
              estPasse(a, aujourdhui) &&
              !presencesPerimees(finEffective(a)!, edition.finaleDate, aujourdhui),
          )
        : [],
  );

  // Le PROGRAMME : ce que l'orga conçoit avant d'avoir les dates. Une séance
  // non datée garde son rang au lieu de tomber dans un tas « à dater ».
  const programme = ordonnerParPhase(ateliers);

  /**
   * Ce qu'on DIT d'un atelier dans une liste, calculé une fois : les deux rendus
   * (agenda et programme) montrent les mêmes faits, ils les disposent seulement
   * autrement. Recopiés, ils auraient divergé sur un sous-titre ou un équivalent
   * textuel — celui qui compte pour les lecteurs d'écran.
   */
  const faitsDe = (a: (typeof ateliers)[number], sansPhase = false) => {
    const membres = atelierMembers.get(a.id) ?? [];
    const etat = atelierEtat({
      atelier: a,
      nbMembres: membres.length,
      nbInscritesEdition,
      nbCoachs: (coachsParAtelier.get(a.id) ?? []).length,
      presences: null, // une liste situe, elle ne pointe pas
      // `presences: null` neutralise l'avancement — mais la cohorte sert AUSSI
      // au reste à ranger, qui se lit dès la liste : c'est là qu'on cherchait
      // « où en est la répartition » sans le trouver, et qu'un sous-groupe a
      // fini par être créé comme un atelier de plus.
      nbCohorte: taillesCohortes.get(a.id) ?? 0,
      sousGroupes: sousGroupes.get(a.id) ?? AUCUN_SOUS_GROUPE,
      aujourdhui,
    });
    const nbSupports = supportsParAtelier.get(a.id) ?? 0;
    // La phase situe l'atelier dans le parcours ; la nature ne se dit que quand
    // elle sort de l'ordinaire (les collectifs sont la norme). Dans le
    // programme, la SECTION porte déjà la phase : la répéter serait du bruit.
    const pastilles = [
      !sansPhase && PHASE_ATELIER_LABEL[a.phase],
      a.nature === "sous_groupes" && NATURE_ATELIER_COURT[a.nature],
    ].filter((p): p is string => Boolean(p));
    return {
      href: `/admin/tremplins/${editionId}/ateliers/${a.id}`,
      sousTitre: [etat.qui.texte, nbSupports > 0 && nb(nbSupports, "support")]
        .filter(Boolean)
        .join(" · "),
      pastilles,
      badges: [quandLongFr(a.date, a.dateFin) ?? "Date à définir", ...pastilles].join(", ") + ".",
      colonneDate: <ColonneDate date={a.date} dateFin={a.dateFin} aujourdhui={aujourdhui} />,
    };
  };

  /**
   * Ce que la suppression de cet atelier EMPORTERAIT, compté avec les données
   * DÉJÀ chargées pour la page (anti N+1 : pas une requête de plus par rangée)
   * et sur le même périmètre que `getAtelierDeletionCounts` — participantes,
   * sous-groupes, supports, coachs rattachés.
   *
   * Ça ne garde aucune porte : depuis qu'un atelier se supprime en deux actions
   * (§10, décision du 01/08), ça sert à ce que la CONFIRMATION nomme ce qui est
   * parti avec lui, seul compte rendu du geste faute de modale.
   */
  const emporteDe = (a: (typeof ateliers)[number]) => {
    const compte = {
      nbParticipantes: (atelierMembers.get(a.id) ?? []).length,
      nbSousGroupes: sousGroupes.get(a.id)?.total ?? 0,
      nbSupports: supportsParAtelier.get(a.id) ?? 0,
      nbCoachs: (coachsParAtelier.get(a.id) ?? []).length,
    };
    return {
      ...compte,
      total: Object.values(compte).reduce((t, n) => t + n, 0),
    };
  };

  /** `dansADater` : la section porte déjà le mot, la rangée ne le redit pas. */
  const renderAtelier = (a: (typeof ateliers)[number], dansADater = false) => {
    const f = faitsDe(a);
    return (
      // La rangée se GLISSE vers la gauche pour découvrir sa poubelle : deux
      // actions pour retirer un atelier, au lieu de traverser la fiche, son
      // sommaire, sa page de retrait et une modale. Le sous-titre dit déjà ce
      // que l'atelier porte, et la confirmation redit ce qui est parti (§10).
      <RangeeGlissante
        key={a.id}
        titre={a.titre}
        action={retirerAtelierAction}
        hidden={{ editionId, atelierId: a.id }}
        messageSucces={confirmationRetraitAtelier(a.titre, emporteDe(a))}
      >
        <NavRow
          href={f.href}
          title={a.titre}
          titleClamp={2}
          subtitle={f.sousTitre}
          pastilles={f.pastilles}
          badgesLabel={f.badges}
          trailing={a.date || !dansADater ? f.colonneDate : undefined}
        />
      </RangeeGlissante>
    );
  };

  /** La même séance, vue depuis le PROGRAMME : son rang, et de quoi le changer. */
  const renderRangeeProgramme = (
    a: (typeof ateliers)[number],
    position: number,
    total: number,
  ) => {
    const f = faitsDe(a, true);
    return (
      <RangeeProgramme
        key={a.id}
        href={f.href}
        titre={a.titre}
        sousTitre={f.sousTitre}
        pastilles={f.pastilles}
        badgesLabel={f.badges}
        trailing={f.colonneDate}
        action={deplacerAtelierAction}
        hidden={{ editionId, atelierId: a.id }}
        rang={position}
        total={total}
      />
    );
  };

  return (
    <>
      <SetFilCrumbs crumbs={[{ label: "Ateliers" }]} />
      <ListPageTemplate
        title="Ateliers"
        meta={`${edition.nom} · ${nb(ateliers.length, "atelier")}`}
        create={
          // Création dans un DIALOG (un bouton), pas en formulaire inline en
          // tête de liste : une page de liste montre et laisse choisir.
          // `?creer=1` (feuille ➕ de la barre canonique, lot N1) : la
          // modale s'ouvre d'emblée — le ➕ promet le formulaire, pas la liste.
          <AddAtelierDialog editionId={editionId} defaultOpen={creer === "1"} />
        }
      >
        {/* La suppression d'un atelier ramène ICI : sa fiche n'existe plus,
            c'est la liste qui en rend compte. */}
        <MessagesFlash err={err} ok={ok} />

        {/* Le compte rendu des suppressions faites SUR PLACE vit ici, au-dessus
            de la liste : une rangée qui disparaît ne peut pas raconter sa propre
            disparition (cf. AnnonceListe). */}
        <AnnonceListe>

        {/* Le geste est ANNONCÉ : une affordance cachée qui se découvre par
            tâtonnement n'existe pas (charge cognitive, checklist COGA). La
            phrase dit aussi l'équivalent clavier, pour que la fonction ne
            paraisse pas réservée aux doigts. Annoncé seulement là où il y a des
            rangées à glisser : le programme a ses flèches, et une vue vide
            n'aurait rien à quoi appliquer la phrase. */}
        {(vue === "programme" ? 0 : vue ? visibles.length : ateliers.length) > 0 && (
          <p className="text-xs text-gray-light">
            Glisse une rangée vers la gauche pour découvrir sa poubelle. Au clavier, la tabulation y
            mène\u00a0: un premier appui arme, le second supprime.
          </p>
        )}

        {vue === "programme" ? (
          // LE PROGRAMME : la cadence, phase par phase, dans l'ordre — et pas
          // dans celui des dates, qu'on n'a pas encore quand on la conçoit.
          <>
            <BandeauVue
              titre={VUES.programme.titre}
              resume={
                ateliers.length > 0
                  ? `${nb(ateliers.length, "atelier")} en ${nb(PHASES_ATELIER.length, "phase")}`
                  : messageVide("programme", false)
              }
              hrefTout={`/admin/tremplins/${editionId}/ateliers`}
              libelleTout="Revenir à l'agenda"
            />
            <div className="flex flex-col gap-6">
              {programme.map((g) => (
                <ListeSection
                  key={g.phase}
                  id={`phase-${g.phase}`}
                  titre={`${PHASE_ATELIER_LABEL[g.phase]} (${g.ateliers.length})`}
                  ton="repere"
                >
                  {g.ateliers.length === 0 ? (
                    <li className="text-sm text-gray-light list-none">
                      Aucune séance dans cette phase pour l&apos;instant.
                    </li>
                  ) : (
                    g.ateliers.map((a, i) =>
                      renderRangeeProgramme(a, i + 1, g.ateliers.length),
                    )
                  )}
                </ListeSection>
              ))}
            </div>
          </>
        ) : vue ? (
          // Une VUE remplace l'agenda par la liste plate de ce que la tâche
          // désigne : on est venu pour ces ateliers-là, pas pour le calendrier.
          <>
            <BandeauVue
              titre={VUES[vue].titre}
              resume={
                visibles.length > 0
                  ? `${nb(visibles.length, "atelier")} sur ${ateliers.length}`
                  : messageVide(vue, vue === "presences" ? passes.length > 0 : ateliers.length > 0)
              }
              hrefTout={`/admin/tremplins/${editionId}/ateliers`}
              libelleTout="Voir tous les ateliers"
            />
            {visibles.length > 0 && (
              <ul role="list" className="flex flex-col gap-2 list-none">
                {visibles.map((a) => renderAtelier(a, vue === "a-dater"))}
              </ul>
            )}
          </>
        ) : ateliers.length === 0 ? (
          <p className="text-sm text-gray-light">
            Aucun atelier pour l&apos;instant. Crée-en un avec le bouton ci-dessus.
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            {/* L'accès au PROGRAMME : la cadence par phase se conçoit sans les
                dates, l'agenda ne sait pas la montrer. Un lien en tête plutôt
                qu'une vue atteignable seulement par une tâche du cockpit. */}
            <p>
              <Link
                href={avecVue(`/admin/tremplins/${editionId}/ateliers`, "programme")}
                className="inline-flex min-h-[44px] items-center rounded text-sm text-cyan underline underline-offset-2 hover:text-cyan-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
              >
                Voir le programme par phase
              </Link>
            </p>
            {moisAVenir.map((m) => (
              <ListeSection key={m.cle} id={`mois-${m.cle}`} titre={moisAgendaFr(m.cle)} ton="repere">
                {m.items.map((a) => renderAtelier(a))}
              </ListeSection>
            ))}

            {aDater.length > 0 && (
              <ListeSection id="a-dater-titre" titre={`À dater (${aDater.length})`}>
                {aDater.map((a) => renderAtelier(a, true))}
              </ListeSection>
            )}

            {passes.length > 0 && (
              // Le passé se consulte, il n'encombre pas : replié par défaut —
              // sauf quand il n'y a plus rien à venir, où il EST la page.
              <details open={moisAVenir.length === 0 && aDater.length === 0} className="group">
                <summary className="cursor-pointer list-none rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan">
                  {/* Un `h2` porteur : le passé entre dans le plan de titres au
                      même titre que les mois, et la cible fait 44 px. */}
                  <h2 className="flex min-h-[44px] items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-light group-hover:text-white">
                    <span aria-hidden="true" className="text-base transition-transform group-open:rotate-90">
                      ›
                    </span>
                    Ateliers passés ({passes.length})
                  </h2>
                </summary>
                <ul role="list" className="flex flex-col gap-2 list-none mt-2">
                  {passes.map((a) => renderAtelier(a))}
                </ul>
              </details>
            )}
          </div>
        )}
        </AnnonceListe>
      </ListPageTemplate>
    </>
  );
}
