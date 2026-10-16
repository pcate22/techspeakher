import Breadcrumb from "@/components/Breadcrumb";
import type { Metadata } from "next";
import Link from "next/link";
import Button from "@/components/Button";
import { BASE_URL } from "@/constants/site";
import { tremplinSteps, editionEditoriale, estEditionEditoriale } from "@/data/tremplin";
import { verbatims } from "@/data/verbatims";
import { listEditionsPubliques } from "@/lib/tremplin-editions";
import { editionStatutAffiche, aujourdhuiParis } from "@/lib/tremplin-statut";
import { rangOrdinal } from "@/lib/tremplin-registrations";
import { nomConference } from "@/lib/tremplin-conf";
import CarrouselVerbatims from "@/components/CarrouselVerbatims";

// La vitrine met en avant l'édition publique la plus récente : dérivée de la
// base en ISR (même motif que /devfest-toulouse), jamais requêtée à chaque hit.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Le Tremplin Tech Speak'Her, de la salle à la scène",
  description:
    "Le Tremplin Tech Speak'Her accompagne les femmes de la tech pour préparer un talk et pitcher devant un jury indépendant et bienveillant. Les speakeuses accompagnées montent sur scène à la conférence partenaire.",
  keywords: [
    "Tremplin Tech Speak'Her",
    "programme speakeuse",
    "prise de parole femmes tech",
    "coaching talk",
    "CFP conférence",
    "DevFest Toulouse",
  ],
  alternates: { canonical: "/tremplin" },
  openGraph: {
    title: "Le Tremplin Tech Speak'Her, de la salle à la scène",
    description:
      "Un programme pour accompagner les femmes de la tech : 5 ateliers, un jury bienveillant, une scène en conférence. Reproductible sur n'importe quelle conf.",
    type: "website",
    url: `${BASE_URL}/tremplin`,
  },
};

export default async function TremplinConcept() {
  // L'édition MISE EN AVANT était écrite en dur (« Voir l'édition 2026 ») :
  // le jour où une édition 2027 passait en `ouvert`, la vitrine continuait
  // d'envoyer tout le monde deux ans en arrière (dette P1). Résilient : base
  // injoignable → repli sur l'édition éditoriale, ce que la page a toujours
  // montré — la vitrine se dégrade, elle ne casse jamais.
  const editions = await listEditionsPubliques().catch(() => []);
  const enAvant = editions[0] ?? null;
  // Le repli se résout UNE fois : tout le reste (adresse, libellés, gate de la
  // phrase-preuve) découle de ce (conf, année)-là.
  const { confSlug, annee } = enAvant ?? editionEditoriale;
  const hrefEdition = `/tremplin/${confSlug}/${annee}`;
  // La phrase-preuve (« 8 finalistes, 3 gagnantes… ») et le lien vers les
  // finalistes racontent des FAITS 2026 : ils restent chez l'édition
  // éditoriale, jamais prêtés à la suivante.
  const estEditoriale = estEditionEditoriale(confSlug, annee);
  // La plus récente de N éditions publiques est la Nᵉ (liste triée récentes
  // d'abord) ; sans base, l'éditoriale est la 1ʳᵉ — ce qu'elle est.
  const ordinal = rangOrdinal(Math.max(editions.length, 1));
  // Quand le nom manque, le segment disparaît (même convention que le h1 de
  // la page cible : jamais de « × » orphelin, jamais un « Conférence » neutre
  // qui contredirait la page à l'arrivée).
  const nomConf = enAvant ? nomConference(enAvant.confNom, enAvant.confLieu) : "DevFest Toulouse";
  // Hors éditorial, la carte garde UNE raison d'y aller, dérivée sans rien
  // inventer : l'état réel de l'édition (« Inscriptions ouvertes »…).
  const contexte = !estEditoriale && enAvant
    ? editionStatutAffiche(enAvant, aujourdhuiParis())
    : null;

  return (
    <>
      <Breadcrumb items={[{ label: "Accueil", href: "/" }, { label: "Tremplin" }]} />

      {/* Hero */}
      <section className="py-16 sm:py-20 px-4 relative overflow-hidden" aria-labelledby="tremplin-title">
        <div className="absolute inset-0 -z-10" aria-hidden="true">
          <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] bg-magenta/8 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-cyan/8 rounded-full blur-3xl" />
        </div>
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-sm font-semibold text-cyan uppercase tracking-wide mb-4">
            Programme
          </p>
          <h1 id="tremplin-title" className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-6">
            Le <span className="text-cyan">Tremplin</span>{" "}
            Tech Speak&apos;Her
          </h1>
          <p className="text-lg text-gray-light max-w-2xl mx-auto mb-8 leading-relaxed">
            De la salle à la scène en six semaines&nbsp;: des ateliers de coaching, une
            soirée finale devant un jury bienveillant, et une scène en conférence pour
            celles qu&apos;on accompagne jusqu&apos;au bout.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button href={hrefEdition}>Voir l&apos;édition {annee}</Button>
            <Button href="/contact" variant="secondary">
              Nous contacter
            </Button>
          </div>
        </div>
      </section>

      {/* Comment ça marche : les 5 étapes (le cœur de la vitrine) */}
      <section className="py-16 px-4 bg-navy-light" aria-labelledby="comment-title">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-bold text-cyan uppercase tracking-wider mb-3">
            Comment ça marche
          </p>
          <h2 id="comment-title" className="text-2xl sm:text-3xl font-bold mb-8">
            Inscription → Parcours → Soirée → Coaching → Scène
          </h2>

          <ol role="list" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 list-none">
            {tremplinSteps.map((s) => (
              <li key={s.number} className={`bg-navy border ${s.border} rounded-xl p-5`}>
                <span
                  className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold mb-3 ${s.bg} ${s.color}`}
                  aria-hidden="true"
                >
                  {s.number}
                </span>
                <h3 className={`text-base font-bold ${s.color} mb-1.5`}>{s.title}</h3>
                <p className="text-sm text-gray-light leading-relaxed">{s.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Le jury : 3 repères scannables */}
      <section className="py-16 px-4" aria-labelledby="jury-title">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-bold text-magenta uppercase tracking-wider mb-3">
            La sélection
          </p>
          <h2 id="jury-title" className="text-2xl sm:text-3xl font-bold mb-3">
            Un jury <span className="text-magenta">indépendant et bienveillant</span>
          </h2>
          <p className="text-gray-light max-w-2xl mb-8 leading-relaxed">
            On évalue le potentiel d&apos;un super talk avec accompagnement, pas le pitch
            fini. Chaque participante repart avec un retour exploitable, gagnante ou pas.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-navy-light border border-cyan/30 rounded-xl p-5 text-center">
              <p className="text-2xl font-extrabold text-cyan mb-1">100&nbsp;%</p>
              <p className="text-sm font-semibold text-white">Féminin</p>
              <p className="text-xs text-gray-light mt-1">Jury exclusivement composé de femmes</p>
            </div>
            <div className="bg-navy-light border border-magenta/30 rounded-xl p-5 text-center">
              <p className="text-2xl font-extrabold text-magenta mb-1">5</p>
              <p className="text-sm font-semibold text-white">Critères objectifs</p>
              <p className="text-xs text-gray-light mt-1">Notés /28, axe Sujet + axe Personne</p>
            </div>
            <div className="bg-navy-light border border-orange/30 rounded-xl p-5 text-center">
              <p className="text-2xl font-extrabold text-orange mb-1">Toutes</p>
              <p className="text-sm font-semibold text-white">Reçoivent un feedback</p>
              <p className="text-xs text-gray-light mt-1">Pas seulement la gagnante</p>
            </div>
          </div>
        </div>
      </section>

      {/* Édition mise en avant : teaser compact (le détail vit sur la page
          d'édition). La phrase-preuve et les finalistes sont des faits 2026 :
          ils restent chez l'édition éditoriale. */}
      <section className="py-16 px-4 bg-navy-light" aria-labelledby="edition-title">
        <div className="max-w-3xl mx-auto">
          <div className="bg-navy border border-gold/30 rounded-2xl p-6 sm:p-8">
            <p className="text-xs font-bold text-gold uppercase tracking-wider mb-2">
              {ordinal} édition
            </p>
            <h2 id="edition-title" className="text-xl sm:text-2xl font-bold mb-3">
              Tremplin <span className="text-gold">{nomConf ? `× ${nomConf} ${annee}` : annee}</span>
            </h2>
            {estEditoriale && (
              <p className="text-gray-light leading-relaxed mb-5">
                8 finalistes, 3 gagnantes, un jury
                100&nbsp;% féminin lors de la soirée du 4 juin à Toulouse.
              </p>
            )}
            {contexte && (
              <p className="text-gray-light leading-relaxed mb-5">{contexte}.</p>
            )}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button href={hrefEdition} size="sm">
                L&apos;édition {annee} en détail
              </Button>
              {estEditoriale && (
                <Button href={`${hrefEdition}#participantes`} variant="ghost" size="sm">
                  Les finalistes →
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Ce qu'elles en disent — la page promet un jury bienveillant et un
          retour pour chacune : ce sont les voix de la première édition qui le
          prouvent, juste après avoir appris qu'elle a eu lieu. Même composant
          et même donnée que la home (`src/data/verbatims.ts`), seul l'habillage
          de section change. Aucun lien : la page a déjà ses CTA. */}
      <section className="py-16 px-4" aria-labelledby="verbatims-tremplin-title">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-bold text-cyan uppercase tracking-wider mb-3">
            Elles y étaient
          </p>
          <h2 id="verbatims-tremplin-title" className="text-2xl sm:text-3xl font-bold mb-3">
            Ce qu&apos;elles en <span className="text-cyan">disent</span>
          </h2>
          <p className="text-gray-light max-w-2xl mb-8 leading-relaxed">
            Les paroles des participantes et des jurées de la première édition.
          </p>
          <CarrouselVerbatims
            verbatims={verbatims}
            libelle="Verbatims du premier Tremplin Tech Speak'Her"
          />
        </div>
      </section>

      {/* Pour qui & pourquoi : condensé */}
      <section className="py-16 px-4" aria-labelledby="pourquoi-title">
        <div className="max-w-4xl mx-auto">
          <h2 id="pourquoi-title" className="text-2xl sm:text-3xl font-bold mb-6">
            Pour qui, et <span className="text-cyan">pourquoi</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="bg-navy-light border border-navy-lighter rounded-xl p-6">
              <h3 className="text-base font-bold text-white mb-2">Pour qui</h3>
              <p className="text-sm text-gray-light leading-relaxed">
                Toutes les femmes de la tech&nbsp;: dev, product, data, design, agilité…
                Avec ou sans idée de sujet, avec ou sans expérience de prise de parole.
              </p>
            </div>
            <div className="bg-navy-light border border-navy-lighter rounded-xl p-6">
              <h3 className="text-base font-bold text-white mb-2">L&apos;objectif réel</h3>
              <p className="text-sm text-gray-light leading-relaxed">
                Que tu oses te lancer dans n&apos;importe quelle conf, pas seulement le
                Tremplin&nbsp;: on encourage à soumettre à d&apos;autres CFP en parallèle.
              </p>
            </div>
          </div>
          {/* D'OÙ ÇA VIENT, en une phrase. Le récit de 2025 vit en base
              (migration 059) et se lit sur la page de la conférence : cette page
              dit pourquoi le programme existe, elle ne raconte pas l'année. */}
          <p className="text-sm text-gray-light leading-relaxed mt-5">
            Le Tremplin est né de 2025&nbsp;: le{" "}
            <Link
              href="/devfest-toulouse"
              className="text-cyan hover:text-cyan-light underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded transition-colors"
            >
              DevFest Toulouse
            </Link>{" "}
            nous avait ouvert sa salle des communautés, et c&apos;est lui qui nous a
            proposé de recommencer en plus grand. Les speakeuses de demain existent
            déjà&nbsp;: il leur faut juste une scène.
          </p>
        </div>
      </section>

      {/* Concept reproductible : CTA final */}
      <section className="py-16 px-4 bg-navy-light" aria-labelledby="duplicable-title">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-xs font-bold text-magenta uppercase tracking-wider mb-3">
            Pour les conférences
          </p>
          <h2 id="duplicable-title" className="text-2xl sm:text-3xl font-bold mb-4">
            Du mal à féminiser votre conférence&nbsp;?
          </h2>
          <p className="text-gray-light mb-8 leading-relaxed">
            Le Tremplin est conçu pour s&apos;adapter à n&apos;importe quelle conférence
            tech&nbsp;: on accompagne des femmes de votre écosystème jusqu&apos;à votre
            scène, avec coaching et jury indépendant. Parlons-en.
          </p>
          <Button href="/contact">Nous contacter</Button>
          <p className="text-xs text-gray-light mt-8">
            Tous nos événements suivent notre{" "}
            <Link
              href="/code-de-conduite"
              className="text-cyan hover:text-cyan-light underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded transition-colors"
            >
              code de conduite
            </Link>
            .
          </p>
        </div>
      </section>
    </>
  );
}
