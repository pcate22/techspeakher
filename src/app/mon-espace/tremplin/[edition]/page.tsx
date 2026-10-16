import type { Metadata } from "next";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import Breadcrumb from "@/components/Breadcrumb";
import { getEditionById } from "@/lib/tremplin-editions";
import { getAteliersByEdition, getAtelierMembersByEdition } from "@/lib/tremplin-ateliers";
import {
  getRegistrationByUser,
  getRegistrationTalkId,
  getConsentLog,
} from "@/lib/tremplin-registrations";
import ConsentJournal from "@/components/ConsentJournal";
import { getProfileByUserId } from "@/lib/profiles";
import { getTalksByProfileId } from "@/lib/talks";
import { TALK_PROPOSAL } from "@/data/domaines";
import { getSharedDocuments, getMyDocuments } from "@/lib/tremplin-documents";
import { canViewEditionSpace, atelierVisiblePour } from "@/lib/tremplin-guards";
import {
  getPhaseMembersByEdition,
  espaceFinaleSections,
  type MembershipPhase,
} from "@/lib/tremplin-registration-phases";
import TremplinEspace from "./TremplinEspace";
import { getCoachsByEdition, getCoachsByRegistration, coachLabel } from "@/lib/tremplin-coachs";
import InlineActionForm from "@/components/InlineActionForm";
import PitchedTalkPicker from "@/components/PitchedTalkPicker";

import {
  setMaVisibiliteAction,
  setOwnPitchedTalkAction,
} from "../actions";

export const metadata: Metadata = {
  title: "Mon Tremplin | Tech Speak'Her",
  description: "Tes ateliers, ressources et retours du Tremplin.",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function MonTremplin({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/connexion");

  const editionId = Number((await params).edition);
  if (!Number.isInteger(editionId)) notFound();

  const edition = await getEditionById(editionId);
  if (!edition) notFound();

  const userId = Number(session.user.id);

  // Garde-fou : seules une participante inscrite ou une orga voient l'espace
  // (les supports d'un Tremplin ne fuitent pas vers un compte non participant).
  const registration = await getRegistrationByUser(userId, editionId);
  if (!canViewEditionSpace(registration, Boolean(session.user.isOrga))) notFound();

  // Toutes les lectures de l'espace en parallèle (latence = la plus lente, pas
  // la somme). La seule dépendance réelle est profil → talks, repliée en une
  // branche du batch. Chaque lecture garde son repli (migrations pas forcément
  // jouées → l'espace s'affiche quand même).
  const [
    allAteliers,
    sharedDocs,
    membersByAtelier,
    myDocs,
    talkPitcheId,
    mesTalks,
    coachsParAtelier,
    mesCoachs,
    phaseMembers,
    consentLog,
  ] = await Promise.all([
    getAteliersByEdition(editionId),
    getSharedDocuments(editionId),
    getAtelierMembersByEdition(editionId),
    registration ? getMyDocuments(userId, editionId) : Promise.resolve([]),
    // Son talk pitché (source unique du « sujet », cf.
    // docs/conception-talk-pitche-migration.md). Lecture protégée (migration 032).
    registration
      ? getRegistrationTalkId(registration.id, editionId).catch((e) => {
          console.error("Talk pitché indisponible (migration 032 ?)", e);
          return null;
        })
      : Promise.resolve(null),
    // Ses talks via son profil (chaîne profil → talks).
    registration
      ? getProfileByUserId(userId)
          .catch(() => null)
          .then((p) => (p ? getTalksByProfileId(p.id).catch(() => []) : []))
      : Promise.resolve([]),
    // Jamais bloquant pour l'espace participante (table pas encore migrée…).
    getCoachsByEdition(editionId).catch((e) => {
      console.error("Coachs indisponibles (migration 017 ?)", e);
      return new Map<number, never[]>();
    }),
    registration
      ? getCoachsByRegistration(registration.id).catch(() => [])
      : Promise.resolve([]),
    // Appartenance de phase (migration 025 pas forcément jouée → repli vide,
    // non exposant : sans info de phase on ne montre pas les sections finale).
    getPhaseMembersByEdition(editionId).catch((e) => {
      console.error("Phases indisponibles (migration 025 ?)", e);
      return new Map<number, Set<MembershipPhase>>();
    }),
    // Son journal de consentement (lecture, transparence RGPD). Repli défensif :
    // migration 037 pas forcément jouée → journal vide, l'espace s'affiche.
    registration
      ? getConsentLog(registration.id).catch((e) => {
          console.error("Journal de consentement indisponible (migration 037 ?)", e);
          return [];
        })
      : Promise.resolve([]),
  ]);
  // Séparation phase 3 ↔ phases 1/2 : le pitch de finale et la visibilité
  // galerie (concerns phase 2) ne s'affichent pas pour une inscrite seulement
  // en phase 3 (montée sur scène). Règle : cf. espaceFinaleSections.
  const finaleSections = espaceFinaleSections(
    registration,
    registration ? phaseMembers.get(registration.id) : undefined,
  );
  // Le talk pitché d'abord (repère en tête), puis les autres. Chaque option porte
  // SON lien « Modifier » vers l'édition de talk de l'espace perso.
  const talkOptions = [...mesTalks]
    .sort((a, b) => (a.id === talkPitcheId ? -1 : b.id === talkPitcheId ? 1 : 0))
    .map((t) => ({
      id: t.id,
      titre: t.titre,
      meta: [t.type, t.occurrences[0]?.conference].filter(Boolean).join(" · "),
      editHref: `/mon-espace/talks/${t.id}`,
      proposition: t.type === TALK_PROPOSAL,
    }));

  // Visibilité par atelier : règle partagée `atelierVisiblePour`, dérivée de la
  // seule `audience` (migration 051). Les supports suivent la même règle plus
  // bas. L'onglet « Documents » applique la même disjonction d'audience en SQL,
  // à une nuance près : il n'a pas la branche orga d'ici, donc une orga y voit
  // moins (le sens sûr, documenté sur `getSharedDocumentsVisiblesPour`).
  const isOrga = Boolean(session.user.isOrga);
  // Ses phases (l'audience « phase » les consulte) ; `phaseMembers` est déjà
  // chargé pour l'édition, on y pioche la sienne plutôt que de relire.
  const mesPhases = registration ? phaseMembers.get(registration.id) : undefined;
  const canSeeAtelier = (a: (typeof allAteliers)[number]): boolean =>
    atelierVisiblePour({
      audience: a.audience,
      phase: a.phase,
      membres: (membersByAtelier.get(a.id) ?? []).map((m) => m.registrationId),
      registration,
      phasesDeLInscrite: mesPhases,
      isOrga,
    });
  // Les coachs reliés priment sur la saisie texte historique (même champ
  // d'affichage : pas de changement de contrat pour TremplinEspace).
  const ateliers = allAteliers
    .filter((a) => canSeeAtelier(a))
    .map((a) => {
      const noms = (coachsParAtelier.get(a.id) ?? []).map(coachLabel).join(", ");
      return noms ? { ...a, coachs: noms } : a;
    });
  const visibleAtelierIds = new Set(ateliers.map((a) => a.id));
  // Un support d'atelier restreint ne fuite pas : on ne garde que les ressources
  // générales (atelier_id null) et les supports des ateliers visibles.
  const visibleSharedDocs = sharedDocs.filter(
    (d) => d.atelierId === null || visibleAtelierIds.has(d.atelierId),
  );

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Mon espace", href: "/mon-espace" },
          { label: edition.nom },
        ]}
      />
      {/* <div>, pas <main> : le layout racine fournit déjà le landmark principal. */}
      <div className="py-10 px-4">
        <div className="max-w-2xl mx-auto">
          <TremplinEspace
            edition={edition}
            ateliers={ateliers}
            sharedDocs={visibleSharedDocs}
            myDocs={myDocs}
            access={
              registration !== null
                ? "registered"
                : session.user.isOrga
                  ? "orga-preview"
                  : "guest"
            }
          />

          {mesCoachs.length > 0 && (
            <section
              aria-labelledby="mon-coaching-titre"
              className="mt-6 bg-navy-light border border-navy-lighter rounded-2xl p-6"
            >
              <h2 id="mon-coaching-titre" className="text-sm font-bold mb-1">
                Ton coaching individuel
              </h2>
              <p className="text-sm text-gray-light">
                {mesCoachs.length > 1 ? "Tes coachs : " : "Ton coach : "}
                <span className="text-white font-medium">
                  {mesCoachs.map(coachLabel).join(", ")}
                </span>
                . Tes documents de suivi arrivent dans « Mes documents » ci-dessus.
              </p>
            </section>
          )}

          {/* Talk pitché self-service : la participante choisit, parmi SES talks,
              celui qu'elle met en avant à la finale — même écran que l'orga
              (composant mutualisé). Le talk vit sur son profil speakeuse ; son
              titre alimente la page publique quand elle est visible.
              Concern PHASE 2 : masqué pour une inscrite seulement en phase 3. */}
          {finaleSections.showPitch && (
            <section
              aria-labelledby="mon-talk-titre"
              className="mt-6 bg-navy-light border border-navy-lighter rounded-2xl p-6"
            >
              <h2 id="mon-talk-titre" className="text-sm font-bold mb-1">
                Mon talk pitché
              </h2>
              <p className="text-xs text-gray-light mb-4">
                Le talk que tu mets en avant à la finale du Tremplin. Si tu es
                visible sur la page publique, son titre s&apos;y affiche.
              </p>
              {talkOptions.length > 0 ? (
                <PitchedTalkPicker
                  action={setOwnPitchedTalkAction}
                  editionId={editionId}
                  options={talkOptions}
                  pitchedId={talkPitcheId}
                  legend={"Quel talk pitches-tu ?"}
                  pitchedBadge="★ Ton talk pitché"
                />
              ) : (
                <p className="text-sm text-gray-light mb-4">
                  Ajoute un talk : il apparaîtra ici et tu pourras le mettre en
                  avant à la finale.
                </p>
              )}
              <Link
                href="/mon-espace/talks/nouveau"
                className="inline-block mt-3 py-2 -my-2 text-sm text-cyan hover:text-cyan-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded"
              >
                Ajouter un talk
              </Link>
            </section>
          )}

          {/* Consentement self-service : c'est la participante qui décide de
              sa visibilité publique, pas l'orga. Journalisé, effet immédiat.
              Galerie = finalistes (phase 2) : masqué hors finaliste confirmée. */}
          {registration !== null && finaleSections.showVisibility && (
            <section
              aria-labelledby="ma-visibilite-titre"
              className="mt-6 bg-navy-light border border-navy-lighter rounded-2xl p-6"
            >
              <h2 id="ma-visibilite-titre" className="text-sm font-bold mb-1">
                Ma visibilité publique
              </h2>
              <p className="text-xs text-gray-light mb-4">
                {registration.public
                  ? "Ton nom, ton rôle, ton sujet, ta bio, ton site, ton LinkedIn et ta photo apparaissent dans la galerie publique de l'édition. Tu peux te masquer à tout moment : le retrait est immédiat."
                  : "Tu restes en retrait de la page publique de l'édition (comptée anonymement dans les chiffres). Toi seule décides de te rendre visible."}
              </p>
              <InlineActionForm
                action={setMaVisibiliteAction}
                hidden={{ editionId, public: String(!registration.public) }}
                submitLabel={
                  registration.public
                    ? "Me masquer de la page publique"
                    : "Me rendre visible sur la page publique"
                }
                pendingLabel="Enregistrement…"
                confirm={
                  registration.public
                    ? {
                        title: "Te masquer de la page publique ?",
                        message:
                          "Ton nom, ton rôle, ton sujet, ta bio, tes liens et ta photo en disparaissent immédiatement.",
                        label: "Me masquer",
                      }
                    : {
                        title: "Apparaître sur la page publique ?",
                        message:
                          "Seront visibles de toutes et tous : ton nom, ton rôle, ton sujet, ta bio, ton site, ton LinkedIn et ta photo. Tu pourras te masquer à tout moment.",
                        label: "Me rendre visible",
                      }
                }
                successMessage={
                  registration.public
                    ? "C'est fait : tu es masquée de la page publique."
                    : registration.finalePresente
                      ? "C'est fait : tu apparais sur la page publique."
                      : "C'est fait : ton accord est enregistré. Tu apparaîtras dans la galerie dès que ta place de finaliste sera confirmée."
                }
              />
              <div className="mt-4 border-t border-navy-lighter pt-4">
                <h3 className="text-xs font-bold mb-2">
                  Ton journal de consentement
                </h3>
                <p className="text-[11px] text-gray-light mb-2">
                  Chaque accord et retrait y est consigné, avec sa date (preuve
                  RGPD). Tu vois le même journal que l&apos;organisation.
                </p>
                <ConsentJournal
                  entries={consentLog}
                  emptyLabel="Rien de consigné pour l'instant."
                />
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
