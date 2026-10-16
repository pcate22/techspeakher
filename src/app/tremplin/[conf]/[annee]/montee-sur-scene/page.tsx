import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";
import Button from "@/components/Button";
import ExternalLink from "@/components/ExternalLink";
import Avatar from "@/components/Avatar";
import DateFr from "@/components/DateFr";
import Accompagnantes from "@/components/Accompagnantes";
import { BASE_URL } from "@/constants/site";
import { nb, quandFr } from "@/lib/format";
import { aujourdhuiParis, getEditionByConfAndYear } from "@/lib/tremplin-editions";
import { estPasse } from "@/lib/tremplin-statut";
import { getPublicEdition, aUnChapitreMonteeSurScene } from "@/lib/tremplin-public";
import { nomConference } from "@/lib/tremplin-conf";
import { semainesParcours, derniereSeance } from "@/lib/recit-edition";

/**
 * CHAPITRE 2 d'une édition : l'accompagnement d'APRÈS la soirée finale, celui
 * qui mène à la scène de la conférence partenaire.
 *
 * Une page à part, et pas une section de plus sur la page d'édition, parce que
 * ce n'est pas le même récit : autre calendrier (septembre-novembre contre
 * avril-mai), autres accompagnantes, et surtout une AUTRE COHORTE — les
 * gagnantes de la finale, plus les participantes retenues au CFP de la
 * conférence, qui n'étaient pas forcément finalistes.
 *
 * Ce que cette page NE reprend PAS, volontairement : le jury, la grille
 * d'évaluation, les prix, les partenaires de la soirée, la FAQ. Ils
 * appartiennent au chapitre 1. Les recopier ferait une seconde page de douze
 * sections — et deux pages quasi jumelles se font traiter en doublons par les
 * moteurs, en plus de rejouer la surcharge qu'on est en train de corriger.
 * Cf. docs/conception-deux-temps-edition-publique.md §3.2.
 */

export const revalidate = 300;

type Params = { conf: string; annee: string };

// Pas de `generateStaticParams` ici, à dessein. Cette page fait `notFound()`
// quand l'édition n'a ni atelier de montée sur scène ni accompagnée : servir
// l'ensemble des éditions publiques pré-rendrait des 404 (mesuré : une sur deux
// sur le jeu de référence), chacun coûtant une douzaine de requêtes et un rendu
// complet. Et déterminer lesquelles qualifient coûte exactement ce que le
// pré-rendu voulait économiser. Cette page n'étant pas une cible d'annonce, on
// la laisse en rendu à la demande, avec l'ISR de `revalidate`. C'est la page
// parente, elle, qui est pré-rendue.

function parseAnnee(s: string): number | null {
  const n = Number(s);
  return Number.isInteger(n) && n >= 2000 && n <= 2100 ? n : null;
}

const CHEMIN = (conf: string, annee: number) =>
  `/tremplin/${conf}/${annee}/montee-sur-scene`;

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { conf, annee } = await params;
  const an = parseAnnee(annee);
  const ed = an ? await getEditionByConfAndYear(conf, an) : null;
  if (!ed || ed.statut === "preparation" || ed.deletedAt) {
    return { title: "Page introuvable | Tech Speak'Her", robots: { index: false } };
  }
  const nomConf = nomConference(ed.confNom, ed.confLieu);
  const titre = `En route vers ${nomConf || "la scène"} ${ed.annee}`;
  return {
    title: `${titre} | Tech Speak'Her`,
    description: `L'accompagnement des speakeuses Tech Speak'Her après la soirée Tremplin ${ed.annee}, jusqu'à la scène\u00a0: ${nomConf || "la conférence partenaire"}.`,
    alternates: { canonical: CHEMIN(conf, ed.annee) },
    openGraph: {
      title: `${titre} | Tech Speak'Her`,
      type: "website",
      url: `${BASE_URL}${CHEMIN(conf, ed.annee)}`,
    },
  };
}

export default async function MonteeSurScene({ params }: { params: Promise<Params> }) {
  const { conf, annee } = await params;
  const an = parseAnnee(annee);
  if (!an) notFound();
  const ed = await getPublicEdition(conf, an);
  // Édition absente OU supprimée : ce chapitre n'a pas de tombstone à lui. La
  // page d'édition en porte un (elle a l'antériorité et les liens entrants) ;
  // en ouvrir un second ferait deux pages « supprimée » pour une seule édition.
  if (!ed || ed === "deleted") notFound();

  // Une édition sans parcours d'après-finale n'a rien à raconter ici : 404
  // plutôt qu'une page vide qui laisserait croire que l'accompagnement s'arrête.
  // La règle vit dans le DTO : les surfaces qui LIENT vers cette page lisent la
  // même, sans quoi elles pointeraient vers ce 404.
  if (!aUnChapitreMonteeSurScene(ed)) notFound();
  const ateliers = ed.ateliers.filter((a) => a.phase === "montee_sur_scene");
  const accompagnantes = ed.accompagnantes.montee_sur_scene;

  const todayStr = aujourdhuiParis();
  const nomConf = nomConference(ed.confNom, ed.confLieu);
  const chapitre1 = `/tremplin/${conf}/${ed.annee}`;
  // La mesure part de la finale — c'est là que ce chapitre commence — ou de la
  // première séance si la finale n'est pas datée.
  const semaines = semainesParcours(
    ed.finaleDate ? [{ date: ed.finaleDate, dateFin: null }, ...ateliers] : ateliers,
    ed.confDate ?? derniereSeance(ateliers),
  );

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Accueil", href: "/" },
          { label: "Tremplin", href: "/tremplin" },
          { label: String(ed.annee), href: chapitre1 },
          { label: "Montée sur scène" },
        ]}
      />

      {/* Hero */}
      <section className="py-16 sm:py-20 px-4 relative overflow-hidden" aria-labelledby="scene-title">
        <div className="absolute inset-0 -z-10" aria-hidden="true">
          <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] bg-gold/8 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] bg-cyan/8 rounded-full blur-3xl" />
        </div>
        <div className="max-w-4xl mx-auto text-center">
          <Button href={chapitre1} variant="ghost" size="sm" className="mb-6">
            <span aria-hidden="true">← </span>Le Tremplin {ed.annee}
          </Button>
          <p className="text-sm sm:text-base font-semibold text-magenta-light mb-4 text-balance">
            {ed.annee} · Après la soirée finale
          </p>
          <h1 id="scene-title" className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-6 text-balance">
            En route vers {nomConf || "la scène"}
          </h1>
          <p className="text-gray-light max-w-2xl mx-auto">
            Après la soirée finale, l&apos;accompagnement continue&nbsp;: les
            gagnantes, et celles dont le talk a été retenu au CFP de la
            conférence, préparent ensemble leur passage sur scène.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-1 text-gray-light text-sm sm:text-base">
            {ed.finaleDate && (
              <span>
                <span aria-hidden="true">🎤 </span>Soirée finale&nbsp;:{" "}
                <DateFr iso={ed.finaleDate} />
              </span>
            )}
            {ed.confDate && (
              <span>
                <span aria-hidden="true">🏆 </span>
                {nomConf || "Conférence"}&nbsp;: <DateFr iso={ed.confDate} />
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Les speakeuses accompagnées — BDD (consentement DE CETTE PHASE).
          Conditionnée à l'effectif : sans cohorte rattachée, le titre annonçait
          « 0 speakeuse accompagnée vers la scène » sur une page qui existe
          justement parce qu'on accompagne. */}
      {ed.counts.accompagnees > 0 && (
      <section className="px-4 pb-4" aria-labelledby="accompagnees-title">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-bold text-gold uppercase tracking-wider mb-3">
            La cohorte
          </p>
          <h2 id="accompagnees-title" className="text-2xl sm:text-3xl font-bold mb-8">
            {nb(ed.counts.accompagnees, "speakeuse")} accompagnée
            {ed.counts.accompagnees > 1 ? "s" : ""} vers la scène
          </h2>
          {/* Nommées seulement si ELLES l'ont voulu, pour CETTE phase (le
              consentement de la galerie des finalistes parlait d'autre chose).
              Le compteur ci-dessus reste un agrégat, il les compte toutes. */}
          {ed.accompagnees.length > 0 && (
            <ul role="list" className="grid grid-cols-1 sm:grid-cols-2 gap-4 list-none">
              {ed.accompagnees.map((f, i) => (
                <li
                  key={`${f.nom}-${i}`}
                  className="bg-navy-light border border-navy-lighter rounded-2xl p-5 flex flex-col gap-2"
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={f.nom} image={f.photoUrl} size="md" />
                    <div>
                      <p className="font-bold leading-tight">{f.nom}</p>
                      {f.role && <p className="text-xs text-gray-light">{f.role}</p>}
                    </div>
                  </div>
                  {f.sujet && <p className="text-sm text-cyan-light font-medium">{f.sujet}</p>}
                  {f.recompenses.map((intitule) => (
                    <p key={intitule} className="text-sm text-gold">
                      <span aria-hidden="true">🏆 </span>
                      {intitule}
                    </p>
                  ))}
                  {f.bio && <p className="text-sm text-gray-light leading-relaxed">{f.bio}</p>}
                  <p className="text-sm mt-auto flex gap-3">
                    {/* Liens donnés par la finaliste : `ugc nofollow`, comme
                        sur la page d'édition et les fiches d'annuaire. */}
                    {f.linkedin && (
                      <ExternalLink
                        href={f.linkedin}
                        ugc
                        aria-label={`LinkedIn de ${f.nom}`}
                        className="text-cyan underline underline-offset-2"
                      >
                        LinkedIn
                      </ExternalLink>
                    )}
                    {f.siteWeb && (
                      <ExternalLink
                        href={f.siteWeb}
                        ugc
                        aria-label={`Site web de ${f.nom}`}
                        className="text-cyan underline underline-offset-2"
                      >
                        Site
                      </ExternalLink>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
      )}

      {/* Le parcours de la phase — BDD */}
      {ateliers.length > 0 && (
        <section className="py-16 px-4" aria-labelledby="parcours-scene-title">
          <div className="max-w-5xl mx-auto">
            <p className="text-xs font-bold text-cyan uppercase tracking-wider mb-3">
              Le parcours
            </p>
            <h2 id="parcours-scene-title" className="text-2xl sm:text-3xl font-bold mb-3">
              De la soirée finale à la scène
            </h2>
            {semaines !== null && (
              <p className="text-base sm:text-lg text-cream font-semibold mb-8">
                <span className="whitespace-nowrap">{nb(semaines, "semaine")}</span>{" "}
                {ed.confDate
                  ? "de préparation, de la soirée finale à la scène."
                  : "de préparation après la soirée finale."}
              </p>
            )}
            <ul role="list" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 list-none">
              {ateliers.map((a, i) => {
                const done = estPasse(a, todayStr);
                const d = quandFr(a.date, a.dateFin);
                return (
                  <li
                    key={`${a.titre}-${i}`}
                    className="bg-navy-light border border-navy-lighter rounded-xl p-5"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <span
                        className="inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold bg-gold/15 text-gold"
                        aria-hidden="true"
                      >
                        {i + 1}
                      </span>
                      {done && (
                        <span className="text-xs font-semibold text-cyan bg-cyan/15 px-2 py-0.5 rounded-full">
                          Fait
                        </span>
                      )}
                      {d && <span className="ml-auto text-xs text-gray-light">{d}</span>}
                    </div>
                    <h3 className="text-base font-bold text-white mb-1">{a.titre}</h3>
                    {a.description && (
                      <p className="text-sm text-gray-light leading-relaxed">{a.description}</p>
                    )}
                  </li>
                );
              })}
            </ul>

            <Accompagnantes personnes={accompagnantes} className="mt-10" />
          </div>
        </section>
      )}

      {/* La scène — l'unique action de la page */}
      <section className="py-16 px-4 bg-navy-light" aria-labelledby="scene-conf-title">
        <div className="max-w-2xl mx-auto text-center flex flex-col gap-4">
          <h2 id="scene-conf-title" className="text-2xl sm:text-3xl font-bold">
            {nomConf ? `Rendez-vous\u00a0: ${nomConf}` : "Rendez-vous sur scène"}
          </h2>
          {ed.confDate && (
            <p className="text-gray-light">
              <DateFr iso={ed.confDate} weekday />
            </p>
          )}
          {ed.confLien && (
            <p>
              <Button href={ed.confLien} external>
                Voir le programme{nomConf ? `\u00a0: ${nomConf}` : ""}
              </Button>
            </p>
          )}
          <p className="text-sm mt-2">
            <Button href={chapitre1} variant="ghost" size="sm">
              <span aria-hidden="true">← </span>Revoir le Tremplin {ed.annee}
            </Button>
          </p>
        </div>
      </section>
    </>
  );
}
