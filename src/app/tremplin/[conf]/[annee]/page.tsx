import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";
import Button from "@/components/Button";
import ExternalLink from "@/components/ExternalLink";
import Avatar from "@/components/Avatar";
import DateFr from "@/components/DateFr";
import VideoCard from "@/components/VideoCard";
import Accompagnantes from "@/components/Accompagnantes";
import { BASE_URL } from "@/constants/site";
import { formatDateFr, nb, quandFr } from "@/lib/format";
import { aujourdhuiParis, getEditionByConfAndYear, paramsEditionsPubliques } from "@/lib/tremplin-editions";
import { estPasse } from "@/lib/tremplin-statut";
import {
  getPublicEdition,
  mentionTransfert,
  aUnChapitreMonteeSurScene,
} from "@/lib/tremplin-public";
import { juryLabel, juryRole } from "@/lib/tremplin-jury";
import { confHubHref, nomConference } from "@/lib/tremplin-conf";
import {
  recitEdition,
  semainesParcours,
  derniereSeance,
  aDesChiffresAAfficher,
  aUnTremplinADecrire,
} from "@/lib/recit-edition";
import RecitConference from "@/components/RecitConference";
// Blocs éditoriaux (constantes du programme, v1 — cf. docs/tremplin-edition-publique.md §3).
import {
  jury,
  prix,
  partenaires,
  faq,
  estEditionEditoriale,
  retoursPourTous,
} from "@/data/tremplin";
import { replayDe } from "@/data/videos";

/** Format long « 28 avr. 2026 » pour les dates d'édition (UTC-safe). */
const dateLongue = (iso: string | null) =>
  formatDateFr(iso, { day: "numeric", month: "short", year: "numeric" });

export const revalidate = 300;

type Params = { conf: string; annee: string };

// Les deux routes d'édition partagent le même ensemble : un seul endroit.
export const generateStaticParams = paramsEditionsPubliques;

function parseAnnee(s: string): number | null {
  const n = Number(s);
  return Number.isInteger(n) && n >= 2000 && n <= 2100 ? n : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { conf, annee } = await params;
  const an = parseAnnee(annee);
  // Métadonnées : l'édition seule suffit (1 requête) — pas besoin du DTO complet.
  const ed = an ? await getEditionByConfAndYear(conf, an) : null;
  // En préparation = pas encore publique, ou supprimée (tombstone) : dans les
  // deux cas, hors index (robots noindex), comme une page introuvable.
  if (!ed || ed.statut === "preparation" || ed.deletedAt) {
    return { title: "Édition introuvable | Tech Speak'Her", robots: { index: false } };
  }
  const nomConf = nomConference(ed.confNom, ed.confLieu);
  const titre = `${ed.nom} × ${nomConf || "conférence"}`;
  return {
    title: `${titre} | Tech Speak'Her`,
    description:
      ed.description ??
      `Édition ${ed.annee} du Tremplin Tech Speak'Her, organisée avec ${nomConf || "la conférence partenaire"}.`,
    alternates: { canonical: `/tremplin/${conf}/${ed.annee}` },
    openGraph: { title: `${titre} | Tech Speak'Her`, type: "website", url: `${BASE_URL}/tremplin/${conf}/${ed.annee}` },
  };
}

export default async function EditionPublique({ params }: { params: Promise<Params> }) {
  const { conf, annee } = await params;
  const an = parseAnnee(annee);
  if (!an) notFound();
  const ed = await getPublicEdition(conf, an);
  if (!ed) notFound();
  // Tombstone : édition supprimée. On garde l'URL (pas de 404) avec un message
  // clair et un chemin de repli vers les autres éditions de la conférence.
  if (ed === "deleted") {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Accueil", href: "/" },
            { label: "Tremplin", href: "/tremplin" },
            { label: String(an) },
          ]}
        />
        <div className="py-20 px-4">
          <div className="max-w-xl mx-auto text-center flex flex-col gap-4">
            <h1 className="text-2xl sm:text-3xl font-bold">Cette édition a été supprimée</h1>
            <p className="text-gray-light">{`Le contenu de l'édition ${an} a été effacé ; l'adresse reste pour les liens déjà partagés.`}</p>
            <p className="flex flex-wrap justify-center gap-4 mt-2">
              <Link href={confHubHref(conf)} className="text-cyan hover:text-cyan-light underline underline-offset-2">
                Voir les éditions de la conférence
              </Link>
              <Link href="/tremplin" className="text-cyan hover:text-cyan-light underline underline-offset-2">
                Le Tremplin
              </Link>
            </p>
          </div>
        </div>
      </>
    );
  }

  const todayStr = aujourdhuiParis();
  // L'éditorial de `src/data/tremplin.ts` (FAQ, jury nommé, lots, partenaires)
  // décrit UNE édition : celle-là. Sur une autre année il répond à côté ; sur une
  // autre conférence la même année, il annonce le DevFest à des gens venus pour
  // autre chose.
  const editorialDeCetteEdition = estEditionEditoriale(conf, ed.annee);
  // CHAPITRE 1 — cette page raconte le Tremplin JUSQU'À la soirée finale.
  // L'accompagnement d'après (la montée sur scène vers la conférence) a sa
  // propre page : autre calendrier, autres coachs, autre cohorte. Tant que les
  // quinze séances se suivaient en liste plate, on lisait un seul programme, et
  // la durée annoncée courait d'avril à novembre.
  const ateliersDuTremplin = ed.ateliers.filter((a) => a.phase === "cfp_et_pitch");
  // La mesure s'arrête là où le chapitre s'arrête : la finale, ou à défaut la
  // dernière séance de CE parcours.
  const semaines = semainesParcours(
    ateliersDuTremplin,
    ed.finaleDate ?? derniereSeance(ateliersDuTremplin),
  );
  const jusquALaFinale = ed.finaleDate !== null;
  const accompagnantes = ed.accompagnantes.cfp_et_pitch;
  // La suite ne s'annonce que si elle existe VRAIMENT côté public : un lien vers
  // une page vide est pire qu'un lien absent. Même prédicat que le 404 de la
  // page visée — c'est le DTO qui le porte, pas deux copies.
  const suiteHref = aUnChapitreMonteeSurScene(ed)
    ? `/tremplin/${conf}/${ed.annee}/montee-sur-scene`
    : null;
  // Le RÉCIT de l'édition (lot G, refonte §8) : la vitrine raconte où en est
  // l'aventure et chiffre l'accompagnement réel, au lieu d'afficher un statut.
  // Les bornes du parcours se dérivent dans le module (couvert par ses tests),
  // à partir des ateliers PUBLICS déjà filtrés.
  const recit = recitEdition({
    annee: ed.annee,
    statut: ed.statut,
    finaleDate: ed.finaleDate,
    confDate: ed.confDate,
    confNom: nomConference(ed.confNom, ed.confLieu),
    ateliers: ateliersDuTremplin,
    inscriptionsDebut: ed.inscriptionsDebut,
    inscriptionsFin: ed.inscriptionsFin,
    nbInscrites: ed.counts.inscrites,
    nbGagnantes: ed.counts.gagnantes,
    aujourdhui: todayStr,
  });
  const aDesChiffres = aDesChiffresAAfficher(ed.counts);
  // Une édition bouclée qui n'a rien tenu n'a pas de règlement à afficher :
  // elle a un récit. Sans cette garde, 2025 promettait des prix à gagner et
  // une soirée pitch qui n'ont jamais eu lieu.
  const aUnTremplin = aUnTremplinADecrire({
    statut: ed.statut,
    finaleDate: ed.finaleDate,
    confDate: ed.confDate,
    inscriptionsDebut: ed.inscriptionsDebut,
    inscriptionsFin: ed.inscriptionsFin,
    aujourdhui: todayStr,
    nbAteliers: ateliersDuTremplin.length,
    nbInscrites: ed.counts.inscrites,
    nbPalmares: ed.palmares.length,
    nbRecompenses: ed.recompenses.length,
    nbJury: ed.jury.length,
  });
  const winnerNames = new Set(ed.palmares.map((p) => p.nom).filter(Boolean));

  // La FAQ et son schéma ne se construisent que là où ils seront rendus : sur
  // toutes les autres éditions — le cas courant — c'était dix questions mappées
  // et un objet JSON-LD jetés. C'est ICI, où l'on sait de quelle édition il
  // s'agit, que la question du replay reçoit la bonne vidéo (sans replay, le
  // lien vers la chaîne reste).
  const replay = editorialDeCetteEdition ? replayDe(conf, ed.annee) : null;
  const faqAffichee = !editorialDeCetteEdition
    ? []
    : replay
      ? faq.map((f) =>
          f.id === "replay"
            ? { ...f, lien: { href: replay.url, label: "Revoir la soirée sur YouTube" } }
            : f,
        )
      : faq;

  const faqPageSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqAffichee.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  // Pas de « × » orphelin si la conf n'a pas de nom (lu littéralement par l'AT).
  const nomConf = nomConference(ed.confNom, ed.confLieu);
  const titre = nomConf ? `${ed.nom} × ${nomConf}` : ed.nom;
  const confDate = dateLongue(ed.confDate);
  const confHref = confHubHref(conf);
  // Section palmarès/prix : le titre rendu dépend de la présence de gagnantes.
  const palmaresHeadingId = ed.palmares.length > 0 ? "palmares-title" : "prix-title";
  // Le palmarès vient de la base, les lots aussi ; à défaut on montre les lots
  // éditoriaux, qui datent. Sans aucun des trois, la section n'aurait qu'un titre.
  const aQuelqueChoseAuPalmares =
    ed.palmares.length > 0 || ed.recompenses.length > 0 || editorialDeCetteEdition;
  // Jury : la base fait foi dès qu'un juré y est saisi (accord recueilli) ;
  // sinon on garde la liste éditoriale (même logique que les prix). On ne
  // sérialise que nom + fonction/entreprise — l'e-mail n'existe pas dans le DTO.
  // La base fait foi dès qu'un juré y est saisi ; le repli statique nomme le
  // jury 2026, donc il ne sert que sur SA page.
  const juryAffiche =
    ed.jury.length > 0
      ? ed.jury.map((j) => ({ name: juryLabel(j), role: juryRole(j) }))
      : editorialDeCetteEdition
        ? jury
        : [];

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Accueil", href: "/" },
          { label: "Tremplin", href: "/tremplin" },
          { label: nomConf || "Conférence", href: confHref },
          { label: String(ed.annee) },
        ]}
      />
      {/* Le JSON-LD ne publie la FAQ que sous l'adresse de SON édition. */}
      {editorialDeCetteEdition && (
        <script
          type="application/ld+json"
          // `<` échappé : un « </script> » dans une réponse fermerait la balise.
          // Le schéma est statique aujourd'hui, mais cette page fait justement
          // remonter du contenu de base vers le public.
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(faqPageSchema).replace(/</g, "\\u003c"),
          }}
        />
      )}

      {/* Hero — BDD */}
      <section className="py-16 sm:py-20 px-4 relative overflow-hidden" aria-labelledby="edition-title">
        <div className="absolute inset-0 -z-10" aria-hidden="true">
          <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] bg-magenta/8 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-cyan/8 rounded-full blur-3xl" />
        </div>
        <div className="max-w-4xl mx-auto text-center">
          <Link
            href="/tremplin"
            className="inline-flex items-center gap-1 text-xs text-gray-light hover:text-cyan transition-colors mb-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded"
          >
            <span aria-hidden="true">← </span>Le Tremplin Tech Speak&apos;Her
          </Link>
          {/* Le récit, pas le statut : on dit où en est l'aventure. Pas de
              capitales — c'est une PHRASE, pas une étiquette (elles se lisent
              mal au-delà de quelques mots). */}
          <p className="text-sm sm:text-base font-semibold text-magenta-light mb-4 text-balance">
            {ed.annee} · {recit.kicker}
          </p>
          <h1 id="edition-title" className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-6 text-balance">
            {titre}
          </h1>
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-gray-light text-sm sm:text-base">
            {ed.finaleDate && <span><span aria-hidden="true">🎤 </span>Soirée finale&nbsp;: <DateFr iso={ed.finaleDate} weekday /></span>}
            {ed.finaleLieu && <span><span aria-hidden="true">📍 </span>{ed.finaleLieu}</span>}
            {confDate && <span><span aria-hidden="true">🏆 </span>{nomConf}&nbsp;: {confDate}</span>}
          </div>
        </div>
      </section>

      {/* En chiffres — BDD. Trois zéros, ce n'est pas une information : c'est
          « ça a raté » écrit en grand, sous un titre invisible (sr-only). Une
          année sans parcours a un récit à raconter, aucun compteur à montrer,
          et une édition qui ouvre ses inscriptions demain non plus. */}
      {aDesChiffres && (
        <section className="px-4" aria-labelledby="chiffres-title">
          <div className="max-w-4xl mx-auto">
            <h2 id="chiffres-title" className="sr-only">En chiffres</h2>
            <ul role="list" className="grid grid-cols-3 gap-3 sm:gap-4 list-none">
              <StatCard n={ed.counts.inscrites} label="inscrites" tone="cyan" />
              <StatCard n={ed.counts.finalistes} label="finalistes" tone="magenta" />
              <StatCard n={ed.counts.gagnantes} label="gagnantes" tone="gold" />
            </ul>
          </div>
        </section>
      )}

      {/* CE QUI S'EST PASSÉ — le contenu rattaché à la conférence répertoriée
          où se tient cette édition (`contenus.conference_edition_id`).
          Une édition peut avoir été un tremplin AUTREMENT qu'en parcours : 2025
          s'est tenue sans préparation, mais avec une salle des communautés, la
          communauté présentée et un premier talk en conférence pour Cateline —
          le jour où elle s'est lancée. Sans ce bloc, sa page se réduisait à une
          séance isolée et trois compteurs, et laissait croire à un échec. */}
      {ed.recit && <RecitConference recit={ed.recit} headingId="recit-conf-title" />}

      {/* Le parcours (ateliers + descriptions) — BDD */}
      {ateliersDuTremplin.length > 0 && (
        <section className="py-16 px-4 mt-6" aria-labelledby="parcours-title">
          <div className="max-w-5xl mx-auto">
            <p className="text-xs font-bold text-cyan uppercase tracking-wider mb-3">Le parcours</p>
            <h2 id="parcours-title" className="text-2xl sm:text-3xl font-bold mb-3">
              {recit.titreParcours}
            </h2>
            {/* L'argument n° 1 du Tremplin, chiffré : on accompagne vraiment,
                du premier atelier jusqu'à la scène. */}
            {semaines !== null && (
              <p className="text-base sm:text-lg text-cream font-semibold mb-8">
                <span className="whitespace-nowrap">{nb(semaines, "semaine")}</span>{" "}
                {jusquALaFinale
                  ? "d'accompagnement, du premier atelier à la soirée finale."
                  : "d'accompagnement, du premier au dernier atelier."}
              </p>
            )}
            <ul role="list" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 list-none">
              {ateliersDuTremplin.map((a, i) => {
                // « Fait » quand la FIN effective est passée (règle partagée).
                const done = estPasse(a, todayStr);
                // Période (« du 7 au 13 sept. 2026 ») ou date — règle partagée.
                const d = quandFr(a.date, a.dateFin);
                return (
                  <li key={`${a.titre}-${i}`} className="bg-navy-light border border-navy-lighter rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold bg-magenta/15 text-magenta" aria-hidden="true">
                        {i + 1}
                      </span>
                      {done && <span className="text-xs font-semibold text-cyan bg-cyan/15 px-2 py-0.5 rounded-full">Fait</span>}
                      {d && <span className="ml-auto text-xs text-gray-light">{d}</span>}
                    </div>
                    <h3 className="text-base font-bold text-white mb-1">{a.titre}</h3>
                    {a.description && <p className="text-sm text-gray-light leading-relaxed">{a.description}</p>}
                  </li>
                );
              })}
            </ul>

            {/* CELLES QUI ONT ACCOMPAGNÉ. Le parcours se racontait sans elles,
                alors que c'est leur travail. Nommées sur leur seul accord (fiche
                coach consentie) : sans accord, la phase se raconte quand même,
                le nom attend. */}
            <Accompagnantes personnes={accompagnantes} className="mt-10" />
          </div>
        </section>
      )}

      {/* La suite, quand elle existe : deux calendriers, deux cohortes, deux
          pages. HORS de la section « parcours », volontairement — une édition
          dont les séances de printemps sont réservées à l'espace des inscrites
          n'affiche pas cette section, et le lien serait parti avec elle. Le
          chapitre 2 n'aurait plus alors qu'une seule porte : le sitemap. */}
      {suiteHref && (
        <section className="px-4" aria-labelledby="suite-title">
          <div className="max-w-5xl mx-auto">
            <h2 id="suite-title" className="sr-only">
              La suite du parcours
            </h2>
            <Button href={suiteHref} variant="ghost" size="sm">
              La suite&nbsp;: l&apos;accompagnement vers la scène
              <span aria-hidden="true"> →</span>
            </Button>
          </div>
        </section>
      )}

      {/* Palmarès & prix — BDD (gagnantes) + éditorial (les lots).
          Une seule section : si la finale est passée on montre QUI a gagné QUOI
          (récompense + talk + lot) ; sinon on montre ce qu'il y a à gagner.
          Rien des deux sur une édition bouclée qui n'a rien tenu. */}
      {aUnTremplin && aQuelqueChoseAuPalmares && (
      <section className="py-16 px-4 bg-navy-light" aria-labelledby={palmaresHeadingId}>
        <div className="max-w-4xl mx-auto">
          {ed.palmares.length > 0 ? (
            <>
              <p className="text-xs font-bold text-gold uppercase tracking-wider mb-3">Le palmarès</p>
              <h2 id="palmares-title" className="text-2xl sm:text-3xl font-bold mb-6">Les gagnantes et leur prix</h2>
              <ul role="list" className="flex flex-col gap-3 list-none">
                {ed.palmares.map((p, i) => {
                  // Lot éditorial statique : SECOURS des éditions sans
                  // récompenses en base (la section ci-dessous prime sinon).
                  const lot =
                    ed.recompenses.length > 0 || !editorialDeCetteEdition
                      ? undefined
                      : prix.find((x) => x.place === p.recompense);
                  return (
                    <li key={i} className={`flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 bg-navy border-2 ${lot?.color ?? "border-navy-lighter"} rounded-xl p-4`}>
                      <span className="text-sm font-bold text-gold shrink-0 w-24">{p.recompense}</span>
                      <span className="flex-1">
                        <span className="font-semibold text-white">{p.nom ?? "Gagnante (non communiquée)"}</span>
                        {p.sujet && <span className="block text-sm text-gray-light mt-0.5">{p.sujet}</span>}
                        {lot && (
                          <span className="block text-xs text-cyan mt-1">
                            {lot.reward}
                            {lot.detail && ` · ${lot.detail}`}
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : ed.recompenses.length === 0 ? (
            // `aQuelqueChoseAuPalmares` a déjà établi qu'on est sur l'édition
            // décrite par l'éditorial : sans palmarès ni récompense en base, la
            // section n'ouvre ailleurs.
            // Aucune récompense en base : on montre les lots éditoriaux statiques
            // — mais eux aussi datent (« une présentation au DevFest Toulouse
            // 2026 »), donc seulement sur leur édition. Dès qu'il y a des
            // récompenses en base, c'est la section ci-dessous qui les porte.
            <>
              <p className="text-xs font-bold text-gold uppercase tracking-wider mb-3">Les prix</p>
              <h2 id="prix-title" className="text-2xl sm:text-3xl font-bold mb-6">Ce qu&apos;il y a à gagner</h2>
              <ul role="list" className="grid grid-cols-1 sm:grid-cols-3 gap-6 list-none">
                {prix.map((p) => (
                  <li key={p.place} className={`bg-navy border-2 ${p.color} rounded-xl p-6 text-center`}>
                    <h3 className="text-lg font-bold text-white mb-2">{p.place}</h3>
                    <p className="text-gray-light text-sm">{p.reward}</p>
                    {p.detail && <p className="text-xs text-cyan mt-1">{p.detail}</p>}
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {/* Récompenses de l'édition — BDD (attribuables et suivies par
              l'orga) : bénéficiaire nommée uniquement si elle a consenti. */}
          {ed.recompenses.length > 0 && (
            <div className={ed.palmares.length > 0 ? "mt-8" : ""}>
              {ed.palmares.length > 0 ? (
                // En complément du palmarès (après la finale).
                <h3 className="text-lg font-bold mb-4">Les récompenses de cette édition</h3>
              ) : (
                // Avant la finale : ce sont elles, les prix à gagner (elles
                // remplacent les lots éditoriaux statiques, plus de doublon).
                <>
                  <p className="text-xs font-bold text-gold uppercase tracking-wider mb-3">Les prix</p>
                  <h2 id="prix-title" className="text-2xl sm:text-3xl font-bold mb-6">
                    Ce qu&apos;il y a à gagner
                  </h2>
                </>
              )}
              <ul role="list" className="flex flex-col gap-3 list-none">
                {ed.recompenses.map((r, i) => {
                  const bordure =
                    r.rang === 1
                      ? "border-gold"
                      : r.rang === 2
                        ? "border-silver"
                        : r.rang === 3
                          ? "border-bronze"
                          : "border-navy-lighter";
                  // Transfert : phrase autoportante (elle nomme déjà la
                  // bénéficiaire) → on ne double pas avec « Attribuée à ».
                  const transfert = mentionTransfert(r);
                  return (
                    <li key={i} className={`bg-navy border-2 ${bordure} rounded-xl p-4`}>
                      <p className="font-semibold text-white">{r.intitule}</p>
                      {r.detail && <p className="text-xs text-cyan mt-0.5">{r.detail}</p>}
                      {transfert ? (
                        <p className="text-sm text-gray-light mt-1">{transfert}</p>
                      ) : (
                        r.beneficiaireNom && (
                          <p className="text-sm text-gray-light mt-1">
                            Attribuée à{" "}
                            <span className="text-white font-medium">{r.beneficiaireNom}</span>
                          </p>
                        )
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Retours pour toutes — éditorial : le retour jury écrit et la vidéo
              sont des promesses de 2026, pas un dû de toute édition à venir.
              Le dernier bloc éditorial qui fuyait hors de son édition (P1). */}
          {editorialDeCetteEdition && (
          <div className="mt-8 bg-gradient-to-r from-cyan/10 to-magenta/10 rounded-xl p-6 sm:p-8 border border-navy-lighter">
            <h3 className="text-lg font-bold text-center mb-4">
              Pour <span className="text-magenta">toutes</span> les participantes
            </h3>
            <ul role="list" className="space-y-3 max-w-md mx-auto list-none">
              {retoursPourTous.map((item) => (
                <li key={item} className="flex items-center gap-3 text-gray-light">
                  <span className="text-cyan font-bold" aria-hidden="true">&#10003;</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          )}
        </div>
      </section>
      )}

      {/* Galerie finalistes — BDD (consenties) */}
      {ed.finalistes.length > 0 && (
        <section className="py-16 px-4" id="participantes" aria-labelledby="finalistes-title">
          <div className="max-w-4xl mx-auto">
            <p className="text-xs font-bold text-cyan uppercase tracking-wider mb-3">Les finalistes</p>
            <h2 id="finalistes-title" className="text-2xl sm:text-3xl font-bold mb-8">
              {ed.counts.finalistes} speakeuse{ed.counts.finalistes > 1 ? "s" : ""} sur scène
            </h2>
            <ul role="list" className="grid grid-cols-1 sm:grid-cols-2 gap-4 list-none">
              {ed.finalistes.map((f) => (
                <li key={f.nom} className="bg-navy-light border border-navy-lighter rounded-2xl p-5 flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <Avatar name={f.nom} image={f.photoUrl} size="md" />
                    <div>
                      <p className="font-bold leading-tight">
                        {f.nom}
                        {winnerNames.has(f.nom) && (
                          <span className="ml-2 text-xs text-gold">
                            <span aria-hidden="true">🏆</span>
                            <span className="sr-only">gagnante</span>
                          </span>
                        )}
                      </p>
                      {f.role && <p className="text-xs text-gray-light">{f.role}</p>}
                    </div>
                  </div>
                  {f.sujet && <p className="text-sm text-cyan-light font-medium">{f.sujet}</p>}
                  {/* Récompense dont elle bénéficie (ex. « présentera au
                      DevFest ») : elle est déjà publique par consentement. */}
                  {f.recompenses.map((intitule) => (
                    <p key={intitule} className="text-sm text-gold">
                      <span aria-hidden="true">🏆 </span>
                      {intitule}
                    </p>
                  ))}
                  {f.bio && <p className="text-sm text-gray-light leading-relaxed">{f.bio}</p>}
                  {/* Liens donnés par la finaliste elle-même : `ugc` (donc
                      `ugc nofollow`), comme sur les fiches d'annuaire. Un
                      « Site » de finaliste mène régulièrement à une activité
                      indépendante. Voir docs/google-ad-grants.md. */}
                  <p className="text-sm mt-auto flex gap-3">
                    {f.linkedin && <ExternalLink href={f.linkedin} ugc aria-label={`LinkedIn de ${f.nom}`} className="text-cyan underline underline-offset-2">LinkedIn</ExternalLink>}
                    {f.siteWeb && <ExternalLink href={f.siteWeb} ugc aria-label={`Site web de ${f.nom}`} className="text-cyan underline underline-offset-2">Site</ExternalLink>}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Revoir la soirée — éditorial (chaîne YouTube). La vidéo n'apparaît
          qu'une fois déclarée dans `src/data/videos.ts` pour cette édition. */}
      {replay && (
        <section className="py-16 px-4" aria-labelledby="replay-title">
          <div className="max-w-2xl mx-auto">
            <p className="text-xs font-bold text-cyan uppercase tracking-wider mb-3">
              Sur notre chaîne YouTube
            </p>
            <h2 id="replay-title" className="text-2xl sm:text-3xl font-bold mb-6">
              Revoir la soirée
            </h2>
            <VideoCard video={replay} />
          </div>
        </section>
      )}

      {/* Photos — BDD (publiables) */}
      {ed.photos.length > 0 && (
        <section className="py-16 px-4 bg-navy-light" aria-labelledby="photos-title">
          <div className="max-w-4xl mx-auto">
            <p className="text-xs font-bold text-magenta uppercase tracking-wider mb-3">La soirée en images</p>
            <h2 id="photos-title" className="text-2xl sm:text-3xl font-bold mb-6">Photos</h2>
            <ul role="list" className="grid grid-cols-2 sm:grid-cols-3 gap-3 list-none">
              {ed.photos.map((p) => (
                <li key={p.id}>
                  {/* Garde http(s) au rendu (défense anti-XSS, même si l'URL est
                      déjà validée à l'écriture). Légende affichée sous l'image →
                      image décorative (alt="") pour éviter la double annonce. */}
                  {/^https?:\/\//i.test(p.url) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.url}
                      alt={p.legende ? "" : `Photo de la soirée du Tremplin ${ed.annee}`}
                      loading="lazy"
                      decoding="async"
                      className="w-full aspect-[4/3] object-cover rounded-xl border border-navy-lighter"
                    />
                  )}
                  {p.legende && <p className="text-xs text-gray-light mt-1">{p.legende}</p>}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* La soirée : format + grille d'évaluation + jury — éditorial. Une
          édition bouclée sans soirée ne raconte pas comment elle s'est passée. */}
      {aUnTremplin && (
      <section className="py-16 px-4" aria-labelledby="soiree-title">
        <div className="max-w-4xl mx-auto">
          <h2 id="soiree-title" className="text-2xl sm:text-3xl font-bold text-center mb-8">La soirée pitch devant jury</h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
            <FormatCard n="3 min" label="Pitch" sub="Le talk en version courte" tone="cyan" />
            <FormatCard n="5 min" label="Questions / réponses" sub="Échange direct avec le jury" tone="magenta" />
            <FormatCard n="100 %" label="Retours pour toutes" sub="Pas seulement la gagnante" tone="orange" />
          </div>

          {/* Grille d'évaluation */}
          <div className="bg-navy border border-navy-lighter rounded-xl p-6 sm:p-8 mb-8">
            <h3 className="text-lg font-bold text-white mb-1">La grille d&apos;évaluation</h3>
            <p className="text-xs text-gray-light mb-5 leading-relaxed">
              On évalue le <span className="text-white font-semibold">potentiel d&apos;un super talk avec accompagnement</span>, pas le pitch fini. 5 critères notés sur <span className="text-white font-semibold">/28</span>.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-cyan uppercase tracking-wider mb-3">Axe Sujet&nbsp;: ce que le pitch raconte</p>
                <ul role="list" className="space-y-2 list-none">
                  <li className="text-sm text-gray-light flex gap-2"><span className="text-cyan shrink-0">1.</span><span>Clarté et pertinence <span className="text-cyan text-xs">(×&nbsp;2)</span></span></li>
                  <li className="text-sm text-gray-light flex gap-2"><span className="text-cyan shrink-0">2.</span><span>Apport pour l&apos;audience</span></li>
                  <li className="text-sm text-gray-light flex gap-2"><span className="text-cyan shrink-0">3.</span><span>Angle distinctif</span></li>
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-magenta uppercase tracking-wider mb-3">Axe Personne&nbsp;: ce qu&apos;elle dégage</p>
                <ul role="list" className="space-y-2 list-none">
                  <li className="text-sm text-gray-light flex gap-2"><span className="text-magenta shrink-0">4.</span><span>Légitimité sur ce sujet</span></li>
                  <li className="text-sm text-gray-light flex gap-2"><span className="text-magenta shrink-0">5.</span><span>Capacité à porter le sujet <span className="text-magenta text-xs">(×&nbsp;2)</span></span></li>
                </ul>
              </div>
            </div>
          </div>

          {/* Jury — la base, ou le repli statique sur SON édition. Sans l'un ni
              l'autre, on ne titre pas une liste vide. */}
          {juryAffiche.length > 0 && (
          <div className="mb-8">
            <h3 className="text-xl font-bold text-center mb-3">Le <span className="text-cyan">jury</span></h3>
            <p className="text-gray-light text-center max-w-2xl mx-auto mb-8">
              Un jury <span className="text-magenta font-semibold">100&nbsp;% féminin</span> représentant la tech et le leadership occitan.
            </p>
            <ul role="list" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 list-none">
              {juryAffiche.map((j, i) => (
                <li key={`${j.name}-${i}`} className="bg-navy border border-navy-lighter rounded-xl p-5">
                  <p className="text-base font-bold text-white">{j.name}</p>
                  {j.role && <p className="text-sm text-gray-light mt-1">{j.role}</p>}
                </li>
              ))}
            </ul>
          </div>
          )}
        </div>
      </section>
      )}

      {/* Partenaires — éditoriaux, et datés : « nous accueille pour la soirée »,
          « co-animatrice de l'atelier CFP ». Ils remercient les partenaires d'UNE
          édition, pas d'une année où rien de tout ça n'a eu lieu. */}
      {editorialDeCetteEdition && (
      <section className="py-16 px-4 bg-navy-light" aria-labelledby="merci-title">
        <div className="max-w-3xl mx-auto">
          <h2 id="merci-title" className="text-xl font-bold text-center text-white mb-8">Merci à nos <span className="text-cyan">partenaires</span></h2>
          <ul role="list" className="space-y-4 list-none">
            {partenaires.map((p) => (
              <li key={p.name} className="bg-navy border border-navy-lighter rounded-xl p-5">
                {p.url ? (
                  <ExternalLink href={p.url} className="text-cyan font-bold hover:text-cyan-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded transition-colors">{p.name}</ExternalLink>
                ) : (
                  <span className="text-cyan font-bold">{p.name}</span>
                )}
                <p className="text-sm text-gray-light mt-1">{p.description}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
      )}

      {/* FAQ — éditoriale, et propre à l'édition qu'elle décrit */}
      {editorialDeCetteEdition && (
      <section className="py-16 px-4" id="faq" aria-labelledby="faq-title">
        <div className="max-w-3xl mx-auto">
          <h2 id="faq-title" className="text-2xl font-bold text-center mb-10"><span className="text-magenta">FAQ</span></h2>
          <dl className="space-y-6">
            {faqAffichee.map((item) => (
              <div key={item.q} className="bg-navy-light border border-navy-lighter rounded-lg p-5">
                <dt className="text-white font-semibold mb-2">{item.q}</dt>
                <dd className="text-gray-light text-sm">
                  {item.a}
                  {item.lien && (
                    <>
                      {" "}
                      <ExternalLink
                        href={item.lien.href}
                        className="text-cyan hover:text-cyan-light underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded transition-colors"
                      >
                        {item.lien.label}
                      </ExternalLink>
                    </>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
      )}

      {/* Le code de conduite et le retour vers les autres éditions vivaient DANS
          la FAQ : masquer celle-ci emportait la seule porte de sortie de la page
          et le rappel qui vaut pour tous nos événements, FAQ ou pas. */}
      <section className="px-4 pb-16" aria-labelledby="pied-edition-title">
        <div className="max-w-3xl mx-auto">
          <h2 id="pied-edition-title" className="sr-only">
            Le code de conduite et les autres éditions
          </h2>
          <p className="text-xs text-center text-gray-light">
            Tous nos événements suivent notre{" "}
            <Link href="/code-de-conduite" className="text-cyan hover:text-cyan-light underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded transition-colors">code de conduite</Link>.
          </p>
          <div className="text-center mt-6">
            <Button href={confHref} variant="ghost" size="sm"><span aria-hidden="true">← </span>Toutes les éditions {nomConf}</Button>
          </div>
        </div>
      </section>
    </>
  );
}

function StatCard({ n, label, tone }: { n: number; label: string; tone: "cyan" | "magenta" | "gold" }) {
  const color = tone === "cyan" ? "text-cyan" : tone === "magenta" ? "text-magenta" : "text-gold";
  return (
    <li className="bg-navy-light border border-navy-lighter rounded-2xl p-5 text-center">
      <p className={`text-3xl sm:text-4xl font-extrabold tabular-nums ${color}`}>{n}</p>
      <p className="text-sm text-gray-light mt-1">{label}</p>
    </li>
  );
}

function FormatCard({ n, label, sub, tone }: { n: string; label: string; sub: string; tone: "cyan" | "magenta" | "orange" }) {
  const border = tone === "cyan" ? "border-cyan/40" : tone === "magenta" ? "border-magenta/40" : "border-orange/40";
  const color = tone === "cyan" ? "text-cyan" : tone === "magenta" ? "text-magenta" : "text-orange";
  return (
    <div className={`bg-navy border ${border} rounded-xl p-5 text-center`}>
      <p className={`text-3xl font-extrabold mb-1 ${color}`}>{n}</p>
      <p className="text-sm font-semibold text-white mb-1">{label}</p>
      <p className="text-xs text-gray-light">{sub}</p>
    </div>
  );
}
