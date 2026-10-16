import type { Metadata } from "next";
import Link from "next/link";
import { requireOrgaId } from "@/lib/auth-guards";
import ListeTaches from "@/components/ListeTaches";
import NavRow from "@/components/NavRow";
import QuandAtelier from "@/components/QuandAtelier";
import Heures from "@/components/Heures";
import { metaLine } from "@/components/AtelierDetail";
import { editionStatutAffiche, aujourdhuiParis, listConferences } from "@/lib/tremplin-editions";
import { deriverTaches } from "@/lib/taches";
import { chargerEditionEntrees } from "@/lib/taches-chargement";
import { getReglages } from "@/lib/reglages";
import { errMessage, okMessage } from "@/lib/tremplin-messages";
import { tremplinPageMetadata } from "@/lib/tremplin-page-meta";
import { loadEditionOrNotFound } from "@/lib/tremplin-admin";
import { nomConference } from "@/lib/tremplin-conf";
import { formatDateFr, nb } from "@/lib/format";
import { estPasse } from "@/lib/tremplin-statut";
import { trierAteliersParDate, NATURE_ATELIER_COURT } from "@/lib/tremplin-ateliers";
import DuplicateEditionDialog from "./DuplicateEditionDialog";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ edition: string }>;
}): Promise<Metadata> {
  return tremplinPageMetadata((await params).edition);
}

export const dynamic = "force-dynamic";

/**
 * Hub d'une édition, hiérarchisé par FRÉQUENCE d'usage (retour preview) :
 * le quotidien d'abord — « À faire sur cette édition » (moteur C1 filtré) et
 * les domaines via la sous-nav du layout — puis, en bas et discret, le
 * « une fois » : un sommaire Réglages de l'édition (Informations / Statut /
 * Retrait, une page = une fonction). RGPD : uniquement des libellés
 * d'ateliers et des nombres, aucune donnée nominative.
 */
export default async function AdminEdition({
  params,
  searchParams,
}: {
  params: Promise<{ edition: string }>;
  searchParams: Promise<{ err?: string; ok?: string }>;
}) {
  await requireOrgaId();
  const { editionId, edition } = await loadEditionOrNotFound((await params).edition);

  const { err, ok } = await searchParams;
  const errMsg = errMessage(err);
  const okMsg = okMessage(ok);

  const [chargee, reglages, conferences] = await Promise.all([
    chargerEditionEntrees(edition),
    getReglages(),
    // Pour « Dupliquer cette édition » (repartir sur une nouvelle année).
    listConferences(),
  ]);
  const aujourdhui = aujourdhuiParis();
  // Le moteur ne voit QUE cette édition (pas les fiches speakeuses : elles
  // relèvent de l'asso, sur /admin).
  const taches =
    edition.statut === "archive"
      ? []
      : deriverTaches(
          // Le hub d'ÉDITION ne montre que les tâches de son tremplin :
          // fiches, articles et conférences proposées (hors édition) relèvent
          // du tableau /admin.
          {
            fiches: [],
            fichesEnSommeil: [],
            fichesSansNom: [],
            editions: [chargee.entrees],
            articles: [],
            conferencesProposees: { attend: false },
          },
          {
            slaFicheJours: reglages.validation_fiche_jours,
            fenetreAtelierJours: reglages.alerte_atelier_jours,
          },
          aujourdhui,
        );

  const statutAffiche = editionStatutAffiche(edition, aujourdhui);

  // PROCHAIN RENDEZ-VOUS (lot B, refonte §3) : LA carte — le premier atelier
  // encore à venir (une fenêtre en cours compte), dérivé des données déjà
  // chargées. La ligne « programme » résume le reste en un lien. Une édition
  // archivée vit au passé : pas de carte, rien à dériver.
  const dates = edition.statut === "archive" ? [] : chargee.ateliers.filter((a) => a.date);
  const aVenir = trierAteliersParDate(dates.filter((a) => !estPasse(a, aujourdhui)));
  const prochain: (typeof aVenir)[number] | undefined = aVenir[0];
  const nbPasses = dates.length - aVenir.length;
  // Les « à dater » comptent dans le résumé : la liste leur consacre une
  // section, et ce sont eux qui appellent une action — les taire donnait un
  // « 5 à venir · 5 passés » sous une rangée « 15 ateliers ».
  const nbADater =
    edition.statut === "archive" ? 0 : chargee.ateliers.length - dates.length;
  // Combien de personnes ce prochain rendez-vous concerne : son AUDIENCE le
  // dit. « Toutes » → l'édition entière ; une sélection → sa liste. Une
  // audience de phase se compte sur sa cohorte, qu'on n'a pas ici : on retombe
  // sur les membres pointés, quitte à annoncer moins plutôt que trop.
  const nbParticipantesRdv = prochain
    ? prochain.audience === "toutes"
      ? chargee.nbParticipantes
      : (chargee.nbMembresParAtelier.get(prochain.id) ?? 0)
    : 0;
  // Une seule dérivation de la finale : l'en-tête (pouls) et la rangée
  // Informations (valeur du sommaire) affichent la même chose.
  const finaleTexte = edition.finaleDate
    ? `Finale le ${formatDateFr(edition.finaleDate, { day: "numeric", month: "short", year: "numeric" })}`
    : "Finale sans date";
  const base = `/admin/tremplins/${editionId}`;

  // Navigation PRINCIPALE de l'édition (lot F « hub franc ») : de grandes
  // lignes lisibles remplacent la barre de pastilles peu visible. Compteurs
  // déjà chargés (aucune requête en plus). Un compteur = un nombre, jamais
  // de donnée nominative (RGPD).
  const rangeesSections = [
    { href: `${base}/ateliers`, title: "Ateliers", subtitle: nb(chargee.ateliers.length, "atelier") },
    { href: `${base}/participantes`, title: "Participantes", subtitle: nb(chargee.nbParticipantes, "inscrite") },
    { href: `${base}/finale`, title: "Finale", subtitle: finaleTexte },
    { href: `${base}/photos`, title: "Photos", subtitle: nb(chargee.nbPhotos, "photo") },
    { href: `${base}/ressources`, title: "Ressources", subtitle: "Supports partagés à l'édition" },
  ];

  // Le « une fois » : réglé à la création, retouché rarement — en bas,
  // en sommaire (une rangée = une fonction, la valeur en sous-titre).
  const rangeesReglages = [
    {
      href: `${base}/infos`,
      title: "Informations",
      subtitle: [nomConference(edition.confNom, edition.confLieu), finaleTexte]
        .filter(Boolean)
        .join(" · "),
      flag: !edition.finaleDate,
    },
    {
      href: `${base}/statut`,
      title: "Statut",
      subtitle:
        edition.statut === "preparation"
          ? `${statutAffiche} · invisible du public`
          : statutAffiche,
      flag: edition.statut === "preparation",
    },
    {
      href: `${base}/retrait`,
      title: "Suppression",
      subtitle: "Supprimer l'édition et toutes ses données",
      tone: "danger" as const,
    },
  ];

  return (
    // <div>, pas <main> : le layout racine fournit déjà le landmark principal.
    <div className="py-10 px-4">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        <header>
          <h1 className="text-2xl font-bold">{edition.nom}</h1>
          <p className="text-sm text-gray-light mt-1">
            {[nomConference(edition.confNom, edition.confLieu), statutAffiche, finaleTexte]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </header>

        {errMsg && (
          <p
            role="alert"
            className="text-sm text-orange bg-orange/10 border border-orange/30 rounded-lg px-4 py-3"
          >
            {errMsg}
          </p>
        )}
        {okMsg && (
          <p
            role="status"
            className="text-sm text-cyan bg-cyan/10 border border-cyan/30 rounded-lg px-4 py-3"
          >
            {okMsg}
          </p>
        )}

        {/* LA carte (refonte §3, lot B) : le prochain rendez-vous de
            l'édition, puis le programme résumé en une ligne. */}
        {prochain && (
          <section
            aria-labelledby="prochain-rdv-title"
            className="rounded-2xl border border-gold/40 bg-gold/8 p-5"
          >
            <h2
              id="prochain-rdv-title"
              className="text-xs font-bold uppercase tracking-wider text-gold mb-2"
            >
              Prochain rendez-vous
            </h2>
            <Link
              href={`${base}/ateliers/${prochain.id}`}
              className="block rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
            >
              <p className="text-sm font-semibold text-white">{prochain.titre}</p>
              <p className="text-xs text-gray-light mt-0.5">
                {metaLine([
                  <QuandAtelier key="q" date={prochain.date} dateFin={prochain.dateFin} weekday />,
                  <Heures key="h" debut={prochain.heureDebut} fin={prochain.heureFin} />,
                  prochain.lieu,
                  prochain.nature === "sous_groupes"
                    ? NATURE_ATELIER_COURT[prochain.nature]
                    : null,
                  nbParticipantesRdv > 0 ? nb(nbParticipantesRdv, "participante") : null,
                ])}
              </p>
            </Link>
            <p className="text-xs text-gray-light mt-3">
              Programme : {nb(aVenir.length, "atelier")} à venir
              {nbPasses > 0 && <> · {nb(nbPasses, "passé")}</>}
              {nbADater > 0 && <> · {nbADater} à dater</>}
              {" · "}
              <Link
                href={`${base}/ateliers`}
                className="text-cyan underline underline-offset-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
              >
                voir les ateliers
              </Link>
            </p>
          </section>
        )}

        {/* Le QUOTIDIEN ensuite : dérivé des données de l'édition, chaque
            tâche mène à l'écran d'action. Les domaines (ateliers,
            participantes…) s'atteignent par les pastilles de la sous-nav. */}
        <section aria-labelledby="afaire-edition-title">
          <h2
            id="afaire-edition-title"
            className="text-xs font-bold uppercase tracking-wider text-gray-light mb-3"
          >
            À faire sur cette édition{taches.length > 0 && ` (${taches.length})`}
          </h2>
          <ListeTaches
            taches={taches}
            aujourdhui={aujourdhui}
            montreContexte={false}
            max={3}
            vide={
              edition.statut === "archive"
                ? "Édition archivée\u00a0: plus de tâches suivies."
                : "Rien à faire sur cette édition. Tout roule."
            }
          />
        </section>

        {/* La NAVIGATION de l'édition : grandes lignes lisibles (hub franc,
            lot F). Remplace la barre de pastilles peu visible. */}
        <section aria-labelledby="sections-edition-title">
          <h2
            id="sections-edition-title"
            className="text-xs font-bold uppercase tracking-wider text-gray-light mb-3"
          >
            Gérer l&apos;édition
          </h2>
          <ul role="list" className="flex flex-col gap-2 list-none">
            {rangeesSections.map((r) => (
              <li key={r.href}>
                <NavRow href={r.href} title={r.title} subtitle={r.subtitle} />
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="reglages-edition-title" className="mt-4">
          <h2
            id="reglages-edition-title"
            className="text-xs font-bold uppercase tracking-wider text-gray-light mb-3"
          >
            Réglages de l&apos;édition
          </h2>
          <ul role="list" className="flex flex-col gap-2 list-none">
            {rangeesReglages.map((r) => (
              <li key={r.href}>
                <NavRow
                  href={r.href}
                  title={r.title}
                  subtitle={r.subtitle}
                  flag={r.flag}
                  tone={r.tone}
                />
              </li>
            ))}
          </ul>
          {/* Repartir d'ici pour une nouvelle édition (même conf/autre année,
              ou autre conf) : ne recopie que le squelette des ateliers. */}
          <DuplicateEditionDialog edition={edition} conferences={conferences} />
        </section>
      </div>
    </div>
  );
}
