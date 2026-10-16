import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getProfileByUserId } from "@/lib/profiles";
import { getTalksCountByProfileId } from "@/lib/talks";
import { getEditionsForUser } from "@/lib/tremplin-registrations";
import { getEditionEnCours } from "@/lib/tremplin-editions";
import { getMesProchainsTalks } from "@/lib/mon-agenda";
import { getPendingSuggestionsCount } from "@/lib/cfp-suggestions";
import { countMesArticles } from "@/lib/articles-membres";
import { countTransmittedMessagesForProfile } from "@/lib/contact-message";
import { siSchemaEnRetard } from "@/lib/pg-errors";
import { getLinkedProviders, hasUnlinkedOAuth } from "@/lib/accounts";
import { enabledOAuthProviders } from "@/auth.config";
import { getCompte, peutCreerFiche } from "@/lib/users";
import { prochaineEtape } from "@/lib/prochaine-etape";
import { statusLabel } from "@/lib/profile-status";
import { libelleEditionRaccourci } from "@/lib/tremplin-statut";
import { adhesionDuCompte } from "@/lib/adhesions";
import { sousTitreAdhesion } from "@/lib/adhesion-libelle";
import { helloassoConfig } from "@/lib/helloasso";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import Button from "@/components/Button";
import NavRow from "@/components/NavRow";
import SegmentLabel from "@/components/SegmentLabel";
import SeDeconnecterRow from "./SeDeconnecterRow";

export const metadata: Metadata = {
  title: "Mon profil | Tech Speak'Her",

  robots: { index: false },
  alternates: { canonical: "/mon-espace/profil" },
};

export const dynamic = "force-dynamic";

/**
 * « Mon profil » (conception N1 §2.5, écran A — validée le 2026-08-07) : la
 * cible de l'onglet-photo. PRIVÉ, dit par une pastille sobre (la seule
 * visibilité qu'un nom ne dit pas) : la fiche publique et le compte ne se
 * mélangent JAMAIS — la fiche vit sur son écran (« Ma fiche publique »,
 * /mon-espace/fiche), qui parle de lui-même.
 *
 * Une page = un rôle : « moi et mes accès ». Son CTA : « Ta prochaine
 * étape », UNE carte dérivée des données (lib pure `prochaineEtape`). Le
 * mot a remplacé « marche » le 2026-08-16 : comprendre « marche » demandait
 * de se représenter un escalier, et le mot est ambigu en français (une
 * marche, marcher, ça marche). Une étiquette se lit au premier degré —
 * relecture d'accessibilité cognitive, cf.
 * `docs/conception-profil-et-a-faire.md` §5 P6. Le
 * travail de rôle vit ici en rangées discrètes — c'est ce que la barre
 * canonique et le tiroir ont perdu (E1-E2) : À faire et l'espace organisatrices pour
 * une orga (avec l'accès DIRECT aux ateliers de l'édition en cours, promis
 * avec la refonte), Mes coachées pour une coach, Documents pour une
 * participante, Réglages et la déconnexion pour toutes.
 */
export default async function MonProfil() {
  const session = await auth();
  if (!session?.user?.id) redirect("/connexion");

  const uid = Number(session.user.id);
  const estOrga = session.user.isOrga === true;
  const estCoach = session.user.isCoach === true;

  // UNE vague de requêtes : les lectures qui dépendent du profil s'y
  // enchaînent (`getProfileByUserId` est mémoïsée par requête — tous les
  // appels partagent UN SELECT, ici comme dans la barre d'onglets) au lieu
  // d'attendre la plus lente des autres.
  // `getMesProchainsTalks` et pas tout l'agenda : seule compte SA prochaine
  // scène, les ateliers n'ont rien à faire ici.
  const [
    profile,
    mesEditions,
    prochainsTalks,
    tremplin,
    talksCount,
    compte,
    suggestionsCount,
    linkedOAuth,
    nbArticles,
    nbMessages,
    adhesion,
  ] = await Promise.all([
    getProfileByUserId(uid),
    getEditionsForUser(uid),
    getMesProchainsTalks(uid),
    estOrga ? getEditionEnCours() : Promise.resolve(null),
    getProfileByUserId(uid).then((p) => (p ? getTalksCountByProfileId(p.id) : 0)),
    // Nom et genre du COMPTE, en base et jamais dans la session (le JWT
    // les fige) — lus seulement sans fiche, là où l'éligibilité se joue.
    getProfileByUserId(uid).then((p) => (p ? null : getCompte(uid))),
    // Les talks repérés (moissonneur CFP) nourrissent l'étape (lot N2 §4).
    getProfileByUserId(uid).then((p) =>
      p
        ? getPendingSuggestionsCount(p.id).catch((err) => {
            console.error("Suggestions indisponibles", err);
            return 0;
          })
        : 0,
    ),
    getLinkedProviders(uid),
    // Colonnes du lot N3 : une base pas encore synchronisée n'a rien écrit —
    // et SEULEMENT elle (un vrai incident base doit se voir, pas se taire).
    countMesArticles(uid).catch(siSchemaEnRetard(0)),
    // Combien de messages reçus, jamais lesquels : la rangée est une porte.
    // Même dégradation que ses deux voisines : une table en retard de
    // migration masque la rangée, elle ne fait pas tomber la page.
    getProfileByUserId(uid).then((p) =>
      p ? countTransmittedMessagesForProfile(p.id).catch(siSchemaEnRetard(0)) : 0,
    ),
    // L'adhésion n'est connue que si la synchro HelloAsso est configurée :
    // sans elle, la rangée dirait « aucune adhésion » à toutes les membres.
    // `undefined` = rangée absente.
    helloassoConfig() ? adhesionDuCompte(uid) : Promise.resolve(undefined),
  ]);

  const nom = profile?.name ?? compte?.name ?? session.user.name ?? "?";
  const etape = prochaineEtape({
    aFiche: profile !== null,
    peutCreerFiche: !profile && peutCreerFiche(compte?.genre),
    talksCount,
    suggestionsCount,
    prochaineScene: prochainsTalks[0]?.date ?? null,
    ficheEnPause: profile?.status === "en_pause",
  });
  // Tant qu'une méthode OAuth configurée reste non reliée, une connexion par
  // cette méthode (e-mail différent) créerait une seconde fiche : on invite à
  // la rattacher. Une opportunité du COMPTE — elle vit ici (lot N2 §4).
  const inciteRegroupement = hasUnlinkedOAuth(linkedOAuth, enabledOAuthProviders());

  // Une rangée absente vaut `null` : le segment la filtre, et s'efface s'il
  // n'en garde aucune. `titre: null` = groupe sans étiquette, ni à l'écran ni
  // au lecteur d'écran.
  type Rangee = { cle: string; noeud: ReactNode } | null;
  const segments: {
    id: string;
    titre: string | null;
    rangees: Rangee[];
  }[] = [
    {
      id: "moi",
      // Le groupe n'a pas de nom simple, et on ne fabrique pas un mot pour
      // avoir une étiquette : « Mon profil », le `h1`, le couvre. Il en portait
      // une malgré tout, « Mes pages », servie en `sr-only` — donc un mot que
      // personne n'emploie, lu à voix haute aux seules personnes qui ne peuvent
      // pas le recouper avec l'écran (relecture du 2026-08-16, F2). Une règle
      // qu'on énonce puis qu'on contourne dans la ligne suivante ne tient pas :
      // ce groupe n'a plus de titre du tout.
      titre: null,
      rangees: [
        profile
          ? {
              cle: "fiche",
              // La porte vers le public — jamais le public lui-même.
              noeud: <NavRow href="/mon-espace/fiche" title="Ma fiche publique" />,
            }
          : {
              // Sans fiche, aucun écran ne porterait la photo : celle du
              // provider n'arrive plus toute seule, et le champ Photo vit dans
              // la fiche. Avec une fiche, la photo appartient à la fiche — pas
              // de seconde porte vers le même geste (arrivé de `main`, PR
              // « photo de la fiche »).
              cle: "photo",
              noeud: (
                <NavRow
                  href="/mon-espace/photo"
                  title="Ma photo"
                  // Le sous-titre DÉCRIT la destination ; il n'ordonne pas.
                  // Deux impératifs dans un sommaire demandaient d'agir avant
                  // même d'avoir ouvert la page (F9) — les consignes vivent
                  // sur l'écran qui les demande.
                  subtitle="Depuis un fichier ou ton profil LinkedIn"
                />
              ),
            },
        // Ses messages : la SEULE porte du produit vers cette page était
        // l'onglet de la barre — une occurrence dans tout `src/`. L'étape B
        // le remplace par « À faire », où un message n'est une ligne que tant
        // qu'il attend une réponse ; et il n'existe aucun état « lu »
        // (répondre est un `mailto:` qui quitte le produit). Sans cette
        // rangée, les messages LUS deviennent inatteignables (revue de
        // conception du 2026-08-16, C2). Elle part donc AVANT l'onglet.
        //
        // Aucun compteur : une porte, pas une notification. Ce qui attend une
        // réponse vivra dans « À faire », à un seul endroit.
        nbMessages > 0
          ? {
              cle: "messages",
              noeud: (
                <NavRow
                  href="/mon-espace/messages"
                  title="Mes messages"
                  subtitle="Reçus via ta fiche publique"
                />
              ),
            }
          : null,
        // Ses articles (lot N3) : la rangée apparaît avec le premier — le geste
        // d'écrire vit dans la feuille ➕, jamais de rangée vide.
        nbArticles > 0
          ? {
              cle: "articles",
              noeud: (
                <NavRow
                  href="/mon-espace/articles"
                  title="Mes articles"
                  // On ne nomme pas l'état du milieu : « relecture » est le mot
                  // de celles qui relisent, « validation » promettrait un
                  // verdict là où l'article peut revenir avec un motif.
                  subtitle="Du brouillon à la publication"
                />
              ),
            }
          : null,
      ],
    },
    {
      id: "benevolat",
      titre: "Mon bénévolat",
      rangees: [
        // « À faire » quitte cette page quand l'onglet le reprend (étape B de
        // la conception technique) : le retirer avant priverait l'orga de sa
        // seule porte vers la liste.
        estOrga
          ? {
              cle: "afaire",
              noeud: (
                <NavRow
                  href="/mon-espace/a-faire?vue=association"
                  title="À faire"
                  subtitle="Ce qui attend une action"
                />
              ),
            }
          : null,
        estOrga
          ? {
              cle: "orga",
              noeud: (
                <NavRow
                  href="/admin"
                  title="Espace organisatrices"
                  subtitle="Speakeuses, contenus, messages, tremplins"
                />
              ),
            }
          : null,
        estOrga && tremplin
          ? {
              cle: "ateliers",
              noeud: (
                <NavRow
                  href={`/admin/tremplins/${tremplin.id}/ateliers`}
                  // « Tremplin », le mot d'une orga — « édition » est celui du
                  // schéma. Le titre dit quoi, le sous-titre dit lequel.
                  title="Ateliers du tremplin en cours"
                  subtitle={libelleEditionRaccourci(tremplin.nom)}
                />
              ),
            }
          : null,
        estCoach
          ? {
              cle: "coaching",
              noeud: (
                <NavRow
                  href="/mon-espace/coaching"
                  title="Mes coachées"
                  subtitle="Speakeuses accompagnées et ateliers"
                />
              ),
            }
          : null,
      ],
    },
    {
      id: "participation",
      titre: "Ma participation",
      rangees: [
        ...mesEditions.map((e) => ({
          cle: `edition-${e.editionId}`,
          noeud: (
            <NavRow
              href={`/mon-espace/tremplin/${e.editionId}`}
              title={e.nom}
              subtitle="Ateliers, ressources et retour du jury"
            />
          ),
        })),
        mesEditions.length > 0
          ? {
              cle: "documents",
              noeud: (
                <NavRow
                  href="/mon-espace/documents"
                  title="Documents"
                  subtitle="Retours du jury et ressources"
                />
              ),
            }
          : null,
      ],
    },
    {
      id: "compte",
      titre: "Mon compte",
      rangees: [
        adhesion !== undefined
          ? {
              cle: "adhesion",
              // Une porte, jamais un second CTA : vers le détail quand une
              // adhésion est reliée, vers /adherer sinon. L'état se lit dans
              // le sous-titre.
              noeud: (
                <NavRow
                  href={adhesion ? "/mon-espace/adhesion" : "/adherer"}
                  title="Mon adhésion"
                  subtitle={sousTitreAdhesion(adhesion, profile?.status === "en_pause")}
                />
              ),
            }
          : null,
        {
          cle: "reglages",
          noeud: (
            <NavRow
              href="/mon-espace/reglages"
              title="Réglages"
              subtitle="Méthodes de connexion, e-mails, compte"
            />
          ),
        },
        { cle: "sortie", noeud: <SeDeconnecterRow /> },
      ],
    },
  ];

  return (
    // <div>, pas <main> : le layout racine fournit déjà le landmark principal.
    <div className="py-10 px-4">
      <div className="max-w-2xl mx-auto flex flex-col gap-4">
        <header className="flex items-center gap-4 mb-2">
          <Avatar name={nom} image={session.user.image ?? null} size="md" />
          <div>
            {/* La pastille est du TEXTE (RGAA : jamais une icône seule), et
                elle vit À CÔTÉ du titre, jamais dedans : dans le `h1`, le nom
                accessible de la page devenait « Mon profil Privé » — un repère
                de page qui annonce un état (relecture RGAA du 2026-08-16, F4).
                Elle reste dans l'échelle typographique : le plancher de
                lecture vaut aussi pour une étiquette. */}
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">Mon profil</h1>
              <span className="rounded-full border border-navy-lighter px-2.5 py-0.5 text-xs font-bold text-gray-light">
                Privé
              </span>
            </div>
            <p className="text-sm text-gray-light">
              {nom !== "?" ? `${nom} · ` : ""}
              {profile
                ? `Fiche : ${statusLabel(profile.status).toLowerCase()}`
                : "Membre de la communauté"}
            </p>
          </div>
        </header>

        {/* Ta prochaine étape — LE CTA de la page, UNE carte dérivée. */}
        {etape && (
          <section
            aria-labelledby="etape-title"
            className="rounded-2xl border border-gold/40 bg-gold/8 p-5"
          >
            <h2
              id="etape-title"
              className="text-sm font-bold text-gold mb-2"
            >
              Ta prochaine étape
            </h2>
            <p className="text-sm mb-4">{etape.texte}</p>
            <Button href={etape.href} size="sm">
              {etape.cta}
            </Button>
          </section>
        )}

        {/* LES ACCÈS, GROUPÉS PAR MONDE (conception
            `docs/conception-profil-et-a-faire.md` §4.1, validée le
            2026-08-16). Avant : huit rangées de même graisse sous une seule
            étiquette « Mes accès », où rien ne disait qu'on passait du travail
            donné à l'association à sa propre participation.

            Une STRUCTURE de données, pas du JSX empilé : c'est elle qui rend
            « un segment vide ne s'affiche pas » impossible à oublier. Ordre
            FIXE, jamais réordonné selon le rôle — une page qui se réorganise
            n'est plus apprenable.

            Le premier groupe n'a pas d'étiquette du tout : « Mon profil » le
            couvre (tranché sur écran réel — « comme on a Mon profil, ça flotte
            pas »).

            Un groupe n'est PAS une région : `<section aria-labelledby>` partout
            donnait six repères de navigation sur un écran qui n'en a qu'un
            (relecture RGAA du 2026-08-16, F1). Le plan se lit par les titres ;
            la liste porte le nom de son groupe par `aria-labelledby`, ce qui la
            nomme sans encombrer la liste des repères.

            Les étiquettes suivent le patron « Mon / Ma / Mes + nom courant »,
            et leur possessif est VRAI : le bénévolat, la participation et le
            compte sont bien à la personne — l'association et le Tremplin, non
            (principes UI, checklist COGA). */}
        {segments.map((seg) => {
          const rangees = seg.rangees.filter((r) => r !== null);
          if (rangees.length === 0) return null;
          return (
            <div key={seg.id} className="flex flex-col gap-3">
              {seg.titre && (
                <SegmentLabel id={`${seg.id}-titre`}>
                  {seg.titre}
                </SegmentLabel>
              )}
              <ul
                role="list"
                aria-labelledby={seg.titre ? `${seg.id}-titre` : undefined}
                className="flex flex-col gap-3 list-none"
              >
                {rangees.map((r) => (
                  <li key={r.cle}>{r.noeud}</li>
                ))}
              </ul>
            </div>
          );
        })}

        {/* Incitation au regroupement des connexions : une OPPORTUNITÉ à
            saisir — arrivée du hub avec le reste du « moi » (lot N2 §4). */}
        {inciteRegroupement && (
          // Une carte d'incitation, pas un repère de navigation : son `h2` la
          // place dans le plan de la page, ce qui suffit (F1).
          <div className="rounded-xl border border-cyan/30 bg-cyan/8 px-4 py-3 mt-2">
            <h2 className="text-sm font-medium text-white">
              Retrouve ta fiche à coup sûr
            </h2>
            <p className="text-xs text-gray-light mt-0.5">
              Ajoute une deuxième façon de te connecter (Google, LinkedIn ou
              e-mail)&nbsp;: tu retomberas toujours sur cette fiche, même en
              changeant de méthode.
            </p>
            <Link
              href="/mon-espace/connexions"
              className="inline-block mt-2 text-sm text-cyan underline underline-offset-2 hover:text-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded"
            >
              Ajouter une méthode de connexion
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
