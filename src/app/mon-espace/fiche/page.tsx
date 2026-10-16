import type { Metadata } from "next";
import Link from "next/link";
import { STATUTS_RETIRABLES } from "@/lib/profile-status";
import { DELAI_ADHESION } from "@/lib/adhesion";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  getProfileByUserId,
  canSubmitToDirectory,
  speakeuseHref,
  type BlocageAnnuaire,
} from "@/lib/profiles";
import { getCompte, peutCreerFiche } from "@/lib/users";
import { photoLinkedInReprenable } from "@/lib/linkedin-photo";
import { getTalksByProfileId, getOccurrenceSuggestions } from "@/lib/talks";
import { completude } from "@/lib/completude";
import { statusLabel } from "@/lib/profile-status";
import { BASE_URL } from "@/constants/site";
import type { ProfileStatus } from "@/lib/profiles";
import Breadcrumb from "@/components/Breadcrumb";
import ConfirmationBanner from "@/components/ConfirmationBanner";
import { SECTION_PAR_CLE, type CleSection } from "@/lib/profil-sections";
import FicheSpeakeuseCorps from "@/components/FicheSpeakeuseCorps";
import ProfileForm from "../ProfileForm";
import { indexEtape } from "../profil-etapes";
import PartagerFiche from "@/components/PartagerFiche";
import Button from "@/components/Button";
import ProgressBar from "@/components/ProgressBar";
import Completude from "@/components/Completude";
import RetirerFicheRow from "../RetirerFicheRow";
import AjoutDateRapide from "../AjoutDateRapide";
import NavRow from "@/components/NavRow";
import { submitProfileAction } from "../actions";
import { statsFiche } from "@/lib/stats-fiche";
import { aujourdhuiParis } from "@/lib/tremplin-statut";
import { nb, formatDateFr } from "@/lib/format";

/**
 * Message par MOTIF de blocage (`BlocageAnnuaire`), tel que le pose
 * `submitProfileAction` — arrivé du hub avec la soumission (lot N2 §4).
 */
const ERREUR_SOUMISSION: Record<BlocageAnnuaire, string> = {
  nom: "Renseigne ton prénom et ton nom à l'étape Profil avant de soumettre : une fiche sans nom s'afficherait sans ton nom dans l'annuaire.",
  contact:
    "Ajoute au moins un moyen de contact (LinkedIn ou contact par e-mail) avant de soumettre.",
  attestation:
    "Coche l'attestation (être une femme ou une personne non binaire) à l'étape Attestation de ton profil avant de soumettre.",
};

/** Libellé du CTA d'onboarding, à l'impératif (le href reste celui de
 * l'étape, source unique dans la complétude). */
const CTA_LABEL: Record<string, string> = {
  nom: "Indiquer mon prénom et mon nom",
  profil: "Compléter mon profil",
  talks: "Ajouter un talk",
  contact: "Ajouter un moyen de contact",
  attestation: "Compléter l'attestation",
};

export const metadata: Metadata = {
  title: "Ma fiche publique | Tech Speak'Her",
  robots: { index: false },
  alternates: { canonical: "/mon-espace/fiche" },
};

export const dynamic = "force-dynamic";

/**
 * Ce que l'écran promet, statut par statut. Un ternaire « publiée ou pas »
 * annonçait « apparaîtra une fois validée » à une fiche EN RETRAIT (déjà validée,
 * volontairement sortie de l'annuaire) et à une fiche REFUSÉE (où ça n'arrivera
 * pas sans geste). Le `Record` force l'exhaustivité : un statut ajouté est une
 * erreur de compilation, pas une phrase fausse.
 */
const PROMESSE_PAR_STATUT: Record<ProfileStatus, string> = {
  publie: "Voici ta fiche telle que les organisatrices la lisent dans l'annuaire.",
  en_attente: "Voici ta fiche telle qu'elle apparaîtra dans l'annuaire une fois validée.",
  brouillon: "Voici ta fiche telle qu'elle apparaîtra dans l'annuaire. Il reste à la soumettre.",
  refuse:
    "Voici ta fiche telle qu'elle est aujourd'hui. Une organisatrice t'a répondu\u00a0: reprends-la, puis soumets-la de nouveau.",
  masque: "Voici ta fiche telle qu'elle est. Elle reste en retrait de l'annuaire, à ta demande.",
  en_pause:
    `Voici ta fiche telle qu'elle est. Elle est en pause, hors de l'annuaire. Après ton adhésion, elle y revient ${DELAI_ADHESION}.`,
};

/**
 * « Ma fiche » (lot I) — DEUX rôles selon qu'il y a une fiche ou pas, et un
 * seul à la fois :
 *
 * - Sans fiche : l'assistant de CRÉATION, six étapes guidées. C'est le seul
 *   endroit qui recueille l'attestation, et on veut être accompagnée la
 *   première fois.
 * - Avec une fiche : LA FICHE, telle que les orgas la lisent, avec un crayon par
 *   section. Chaque crayon mène à une page qui ne porte que cette section et son
 *   « Enregistrer » — corriger un mot n'oblige plus à re-parcourir six étapes.
 *
 * On y listait les NOMS des sections avec un résumé d'une ligne. Il fallait donc
 * ouvrir chaque section pour savoir ce qu'elle contenait, et on ne voyait jamais
 * sa fiche comme elle est lue. Le rendu est PARTAGÉ avec la page publique
 * (`FicheSpeakeuseCorps`) : deux rendus auraient divergé au premier changement.
 */
export default async function MaFiche({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; ok?: string; error?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/connexion");

  const { step, ok, error } = await searchParams;
  // Ce qui vient d'être enregistré, NOMMÉ. L'enregistrement d'une section était
  // parfaitement muet : redirection ici, focus retombé sur `body`, régions vives
  // vides — sur un lecteur d'écran, rien ne se passait. Le même geste côté talks
  // annonçait correctement depuis toujours ; on réutilise sa mécanique
  // (`ConfirmationBanner` : région montée vide puis remplie, focus porté dessus,
  // paramètre nettoyé de l'URL).
  const sectionEnregistree = ok ? SECTION_PAR_CLE[ok as CleSection] : undefined;
  const uid = Number(session.user.id);
  const profile = await getProfileByUserId(uid);
  // Les talks : la vue COMPLÈTE (contrat de la lib pour l'espace perso). La
  // lecture publique excluait les propositions issues du backfill Tremplin : une
  // speakeuse dont les talks venaient de là lisait « Aucun talk sur ta fiche » et
  // était invitée à en créer un qui existait déjà.
  // Le registre des conférences sert aux fenêtres « Une date » : lu EN MÊME
  // TEMPS que les talks (pas après), et seulement avec une fiche.
  const [talks, registre] = profile
    ? await Promise.all([
        getTalksByProfileId(profile.id),
        // Un filet : le registre ne sert qu'aux boutons « Une date ». Sa panne
        // les masque, elle n'emporte pas la fiche (revue justesse 2026-10-15).
        getOccurrenceSuggestions().catch((e) => {
          console.error("getOccurrenceSuggestions a échoué, fiche sans « Une date » :", e);
          return null;
        }),
      ])
    : [[], null];
  const suggestionsDates = talks.length > 0 ? registre : null;
  const stats = statsFiche(talks, aujourdhuiParis());
  // Nom (et photo) du COMPTE en base, jamais dans la session : le JWT les fige
  // à la connexion, donc le champ nom obligatoire s'affichait VIDE pour qui
  // venait de renseigner son nom (§6 : ne jamais faire ressaisir), et l'avatar
  // OAuth déjà posé n'apparaissait pas dans le nouveau champ Photo de
  // l'assistant. Lu SEULEMENT sans fiche, là où l'assistant en a besoin — avec
  // une fiche, la lecture était un aller-retour base pour personne (l'avatar
  // vient alors de `profile.image`, déjà dans la ligne chargée).
  // Les deux lectures ne servent QUE l'assistant de création (seul rendu de
  // cette page à porter le champ Photo), et elles sont indépendantes : menées
  // ensemble plutôt que l'une après l'autre.
  const [compte, linkedinLie] = await Promise.all([
    profile === null ? getCompte(uid) : Promise.resolve(null),
    profile === null ? photoLinkedInReprenable(uid) : Promise.resolve(false),
  ]);
  // « Ma fiche » est partout depuis le 2026-10-15 (onglet, rail, menu du
  // compte) : un compte SANS fiche possible ne tombe jamais sur un assistant
  // qu'il n'a pas le droit de remplir (jamais de CTA impossible).
  if (profile === null && !peutCreerFiche(compte?.genre)) redirect("/mon-espace/profil");
  const nomCompte = profile === null ? (compte?.name ?? "") : null;
  const avatarCompte = compte?.image ?? null;

  // La soumission vit ICI depuis le lot N2 (§4) : compléter, soumettre et
  // retirer sont des gestes de fiche. La complétude ne montre que ce qu'il
  // reste à faire ; le CTA suit l'avancement (étape requise → soumettre).
  const { chantiers, percentRequis, requisRestants, aFaire } = completude(
    profile,
    talks.length,
    profile?.name ?? nomCompte,
  );
  const enrichRestants = aFaire.filter((c) => c.optionnel).length;
  const publie = profile?.status === "publie";
  const enLigneOuEnRelecture = publie || profile?.status === "en_attente";
  const premierRequis = requisRestants[0];
  const ctaOnboarding =
    profile && !enLigneOuEnRelecture
      ? premierRequis?.href
        ? {
            label:
              CTA_LABEL[premierRequis.key] ??
              `Compléter : ${premierRequis.label.toLowerCase()}`,
            href: premierRequis.href,
          }
        : canSubmitToDirectory(profile)
          ? "submit"
          : null
      : null;
  const peutRetirer =
    profile !== null &&
    (STATUTS_RETIRABLES as readonly string[]).includes(profile.status);
  // Les méta-dates du hub (« rien ne se perd », lot N2 §4) : quand la fiche
  // est en ligne, quand elle a bougé et quand une orga l'a validée.
  const metaDates = publie
    ? [
        profile?.updatedAt ? `Mise à jour le ${formatDateFr(profile.updatedAt)}` : null,
        profile?.validatedAt ? `validée le ${formatDateFr(profile.validatedAt)}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;
  // Lookup gardé par possession PROPRE : `?error=__proto__` atteindrait la
  // chaîne de prototypes (objet rendu comme enfant React → 500 sur requête
  // forgée). Revue de sécurité N2.
  const errorMsg =
    error && Object.hasOwn(ERREUR_SOUMISSION, error)
      ? ERREUR_SOUMISSION[error as BlocageAnnuaire]
      : undefined;

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Mon profil", href: "/mon-espace/profil" },
          { label: "Ma fiche publique" },
        ]}
      />
      {/* <div>, pas <main> : le layout racine fournit déjà le landmark principal. */}
      <div className="py-10 px-4">
        {/* Pas de « carte » englobante : le titre vit au niveau de la page et le
            contenu occupe toute la largeur — sinon le padding de la carte rogne
            les champs sur mobile. Cohérent avec le hub Mon espace. */}
        <section aria-labelledby="profil-title" className="max-w-2xl mx-auto">
          {/* Le NOM de l'écran porte la visibilité (conception N1 §2.5,
              retour de Cateline : les phrases d'explication alourdissent,
              « Ma fiche publique » parle d'elle-même). */}
          <h1 id="profil-title" className="text-2xl font-bold mb-2">
            <span className="text-magenta">Ma fiche</span> publique
          </h1>

          {sectionEnregistree && (
            <ConfirmationBanner
              message={`«\u00a0${sectionEnregistree.titre}\u00a0»\u00a0: c'est enregistré.`}
            />
          )}

          {errorMsg && (
            <p
              role="alert"
              className="text-sm text-orange bg-orange/10 border border-orange/30 rounded-lg px-4 py-3 mb-4"
            >
              {errorMsg}
            </p>
          )}

          {profile ? (
            <>
              {/* Le STATUT, en mots : l'écran ressemble désormais à la fiche
                  finie, donc « ce que les orgas voient » se lit comme un constat.
                  Or sur cinq statuts, quatre ne sont pas dans l'annuaire — et
                  « En retrait » en est l'inverse. La couleur ne porte jamais
                  l'information seule (RGAA 3.1). */}
              <p className="text-sm text-gray-light mb-1">
                Statut&nbsp;: <span className="text-white">{statusLabel(profile.status)}</span>
              </p>
              {/* Les stats sobres, jamais comparatives : des FAITS publics —
                  la même règle de « scène faite » que le fil (date exacte,
                  strictement passée). */}
              <p className="text-sm text-gray-light mb-1">
                {nb(stats.talks, "talk")} · {nb(stats.scenes, "scène")}{" "}
                {stats.scenes > 1 ? "faites" : "faite"}
              </p>
              {metaDates && (
                <p className="text-xs text-gray-light mb-1">{metaDates}</p>
              )}
              <p className="text-sm text-gray-light mb-6">
                {/* `{" "}` explicite : collée à l'expression, l'espace du texte
                    suivant est mangée par JSX — la phrase s'affichait
                    « …dans l'annuaire.Chaque partie… ». */}
                {PROMESSE_PAR_STATUT[profile.status]}{" "}
                {/* Consentement éclairé (correctif du lot N0) : l'annonce sur
                    l'accueil n'a lieu qu'à la PREMIÈRE publication — la phrase
                    ne s'affiche qu'à qui n'a jamais été publiée. */}
                {!profile.publishedAt &&
                  (profile.status === "brouillon" || profile.status === "refuse") &&
                  "Une fiche publiée est annoncée sur l'accueil du site. "}
                Chaque partie s&apos;ouvre et s&apos;enregistre séparément. Ton
                e-mail reste masqué&nbsp;: les messages passent par un relais.
              </p>

              {/* L'avancement vers l'annuaire (arrivé du hub, lot N2 §4) :
                  jauge des requis, ce qu'il RESTE à faire, et le geste — une
                  étape à compléter, ou la soumission. En relecture, rien à
                  presser ; publiée, seuls les enrichissements restants. */}
              {/* Un seul cas, nommé : hors ligne ET hors relecture — le même
                  périmètre que ctaOnboarding. */}
              {!enLigneOuEnRelecture ? (
                <div className="mb-8">
                  {requisRestants.length > 0 && (
                    <div className="mb-4">
                      <ProgressBar value={percentRequis} label="Fiche complétée" />
                    </div>
                  )}
                  <Completude chantiers={chantiers} />
                  <div className="mt-4">
                    {ctaOnboarding === "submit" ? (
                      <form action={submitProfileAction}>
                        <Button type="submit" size="sm">
                          Soumettre à l&apos;annuaire
                        </Button>
                      </form>
                    ) : ctaOnboarding ? (
                      <Button href={ctaOnboarding.href} size="sm">
                        {ctaOnboarding.label}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : publie && enrichRestants > 0 ? (
                <div className="mb-8">
                  <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-gray-light mb-3">
                    Pour aller plus loin
                  </p>
                  <Completude chantiers={chantiers} />
                </div>
              ) : null}

              <FicheSpeakeuseCorps
                vue="proprietaire"
                profile={profile}
                talks={talks}
                editBase="/mon-espace/fiche"
                talksBase="/mon-espace/talks"
                actionTalk={
                  suggestionsDates
                    ? (t) => (
                        // Ouvre aussi sa fenêtre à l'arrivée par « Une date
                        // sur un talk » (`?date=<id>`, lu par le composant).
                        <AjoutDateRapide
                          talk={{ id: t.id, titre: t.titre }}
                          suggestions={suggestionsDates}
                        />
                      )
                    : undefined
                }
              />
              {/* LE CTA de la page (conception N1 §2.5, écran B) : le geste
                  d'une speakeuse vers une orga de conférence. Fiche publiée
                  seulement — hors annuaire, la promesse par statut a déjà
                  expliqué, jamais de bouton inerte. */}
              {profile.status === "publie" && (
                <p className="mt-8">
                  <PartagerFiche
                    url={`${BASE_URL}${speakeuseHref(profile)}`}
                    titre={`${profile.nomAffiche} · Tech Speak'Her`}
                  />
                </p>
              )}
              {/* L'adresse publique, et pas « voir ma fiche telle qu'on la lit » :
                  l'écran vient de la montrer, la promesse faisait doublon. Ce que
                  la destination apporte, c'est le LIEN à partager. */}
              <p className="mt-4 text-sm text-gray-light">
                Mon adresse publique&nbsp;:{" "}
                <Link
                  href={speakeuseHref(profile)}
                  className="inline-flex min-h-[44px] items-center rounded text-cyan hover:text-cyan-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
                >
                  {`${BASE_URL.replace(/^https?:\/\//, "")}${speakeuseHref(profile)}`}
                </Link>
              </p>

              {/* Retirer sa fiche (ou annuler sa soumission) : le geste
                  réversible vit avec la fiche (lot N2 §4). */}
              {peutRetirer && (
                <div className="mt-6">
                  <RetirerFicheRow enAttente={profile.status === "en_attente"} />
                </div>
              )}
            </>
          ) : (
            <>
              <p className="text-sm text-gray-light mb-6">
                Ces informations alimenteront ta fiche dans l&apos;annuaire, après
                validation par une organisatrice. Ton e-mail et ton téléphone ne sont
                jamais publiés.
              </p>
              <ProfileForm
                initial={null}
                nom={nomCompte ?? ""}
                avatarCompte={avatarCompte}
                linkedinLie={linkedinLie}
                initialStep={indexEtape(step)}
              />
            </>
          )}
          {/* La porte du reste du « moi » (messages, réglages, rôles) : depuis
              le 2026-10-15, l'onglet-photo de la barre basse mène ICI, à la
              fiche — « Mon profil » s'atteint par cette rangée sur mobile, par
              le rail et le menu du compte sur bureau. */}
          <div className="mt-10 border-t border-navy-lighter pt-4 xl:hidden">
            <NavRow
              href="/mon-espace/profil"
              title="Mon profil"
              subtitle="Messages, réglages et tes autres espaces"
            />
          </div>
        </section>
      </div>
    </>
  );
}
