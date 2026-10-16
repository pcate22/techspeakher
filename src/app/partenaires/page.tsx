import Breadcrumb from "@/components/Breadcrumb";
import type { Metadata } from "next";
import Link from "next/link";
import type { TypeSoutien } from "@/types";
import Button from "@/components/Button";
import { LandingHero, QuestionsOui } from "@/components/Landing";
import SiteLink from "@/components/SiteLink";
import { partenaires, pourquoi, typesSoutien, landingPartenaires as L } from "@/data/partenaires";
import { HELLOASSO_SOUTIEN_URL } from "@/constants/site";
import Accompagnantes from "@/components/Accompagnantes";
import { listAccompagnantesPubliques } from "@/lib/coach-profiles";
import { countPublishedProfiles } from "@/lib/profiles";
import type { PublicAccompagnante } from "@/lib/tremplin-public";

export const metadata: Metadata = {
  title: "Partenaires : nous soutenir | Tech Speak'Her",
  description:
    "Entreprises, conférences, structures tech, à Toulouse et au-delà : soutenez Tech Speak'Her et aidez plus de femmes de la tech à monter sur scène.",
  keywords: [
    "partenaires Tech Speak'Her",
    "sponsoring femmes tech",
    "mécénat association tech Toulouse",
    "GDG Toulouse",
  ],
  alternates: {
    canonical: "/partenaires",
  },
};

// Les accompagnantes et le compte de speakeuses viennent de la base : un
// changement doit se voir sans redéploiement. Même motif et même repli que
// /conferences.
export const revalidate = 300;

/**
 * LANDING DE CONVERSION (2026-10-15, grille Scalezia : docs/roadmap.md).
 * UNE action principale, la même partout : soutenir sur HelloAsso. UNE action
 * secondaire : nous contacter, pour toute aide qui n'est pas un financement
 * (co-organisation, lieu, buffet, mentorat). Le parcours va de la preuve à la
 * demande, et rien au milieu ne fait sortir de la page.
 */
function Soutenir({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <Button href={HELLOASSO_SOUTIEN_URL} external size={size}>
      Soutenir sur HelloAsso
    </Button>
  );
}

function Contacter() {
  return (
    <Button href="/contact" variant="secondary">
      Nous contacter
    </Button>
  );
}

function DeuxActions({ size }: { size?: "md" | "lg" }) {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
      <Soutenir size={size} />
      <Contacter />
    </div>
  );
}

export default async function Partenaires() {
  // Résilients : base injoignable → bloc absent (jamais un nombre faux).
  const [accompagnantes, speakeuses] = await Promise.all([
    listAccompagnantesPubliques().catch(() => [] as PublicAccompagnante[]),
    countPublishedProfiles().catch(() => null),
  ]);

  const chiffres = [
    { valeur: String(partenaires.length), libelle: "structures à nos côtés" },
    ...(speakeuses ? [{ valeur: String(speakeuses), libelle: "speakeuses dans l'annuaire" }] : []),
    ...(accompagnantes.length > 0
      ? [{ valeur: String(accompagnantes.length), libelle: "bénévoles qui accompagnent" }]
      : []),
  ];

  return (
    <>
      <Breadcrumb items={[{ label: "Accueil", href: "/" }, { label: "Partenaires" }]} />

      {/* 1. La cible au-dessus de la promesse : le H1 porte le mot-clé. */}
      <LandingHero id="partenaires-title" cible={L.cible} promesse={L.promesse} sousPromesse={L.sousPromesse}>
        <DeuxActions size="lg" />
      </LandingHero>

      {/* 2. Les preuves, tout de suite : une rangée par façon d'aider, et qui
          le fait déjà. La page montre les façons de nous aider ET leurs
          preuves d'un même geste (demande de Cateline, 2026-10-15). */}
      <section className="py-16 bg-navy-light" aria-labelledby="partenaires-actuels-title">
        <div className="max-w-5xl mx-auto">
          <h2 id="partenaires-actuels-title" className="text-2xl font-bold text-center mb-8 px-4">
            Qui nous aide <span className="text-cyan">déjà</span>
          </h2>
          <ul className="flex flex-col sm:flex-row justify-center gap-6 sm:gap-12 text-center mb-12 list-none px-4" role="list">
            {chiffres.map((c) => (
              <li key={c.libelle}>
                <p className="text-4xl font-bold text-magenta">{c.valeur}</p>
                <p className="text-sm text-gray-light">{c.libelle}</p>
              </li>
            ))}
          </ul>
          <div className="space-y-12 mb-12">
            {typesSoutien.map((t) => (
              <RangeeSoutien key={t.id} type={t} />
            ))}
          </div>
          <div className="px-4">
            <DeuxActions />
          </div>
        </div>
      </section>

      {/* 3. Des questions auxquelles on répond « oui », puis 4. la réassurance. */}
      <QuestionsOui questions={L.questions} reassurance={L.reassurance} />

      {/* 5. Ce que vous y gagnez. Cadrage du mécénat : l'association est à but
          non lucratif, cette page remercie, elle ne vend pas un espace.
          Voir docs/google-ad-grants.md. */}
      <section className="py-16 px-4" aria-labelledby="pourquoi-title">
        <div className="max-w-4xl mx-auto">
          <h2 id="pourquoi-title" className="text-2xl font-bold text-center mb-8">
            Pourquoi nous <span className="text-cyan">soutenir</span>&nbsp;?
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-3 gap-6 list-none" role="list">
            {pourquoi.map((item) => (
              <li key={item.title} className="bg-navy-light border border-navy-lighter rounded-xl p-6 text-center">
                <h3 className={`text-lg font-bold ${item.color} mb-3`}>{item.title}</h3>
                <p className="text-sm text-gray-light">{item.description}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 6. Qui sommes-nous, et celles qui donnent déjà leur temps. La liste
          porte DEUX consentements (fiche coach publique + atelier public) :
          voir `listAccompagnantesPubliques`. Vide, elle s'efface. */}
      <section className="py-16 px-4 bg-navy-light" aria-labelledby="qui-title">
        <div className="max-w-3xl mx-auto">
          <h2 id="qui-title" className="text-2xl font-bold text-center mb-8">
            Qui <span className="text-magenta">sommes-nous</span>&nbsp;?
          </h2>
          {L.quiSommesNous.map((p) => (
            <p key={p} className="text-gray-light leading-relaxed mb-4">{p}</p>
          ))}
          {accompagnantes.length > 0 && (
            <div className="mt-10">
              <Accompagnantes personnes={accompagnantes} titre="Elles donnent de leur temps" />
              <p className="text-gray-light mt-4">
                Elles animent les ateliers du Tremplin et accompagnent les
                speakeuses jusqu&apos;à la scène, sur leur temps libre.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* 7. L'appel final, puis la FAQ orientée conversion. */}
      <section className="py-16 px-4" aria-labelledby="appel-title">
        <div className="max-w-3xl mx-auto text-center">
          <h2 id="appel-title" className="text-2xl font-bold mb-4">
            On fait monter plus de femmes sur scène, ensemble&nbsp;?
          </h2>
          <p className="text-gray-light mb-8">
            Soutenez-nous sur HelloAsso, ou écrivez-nous pour une autre forme de partenariat.
          </p>
          <DeuxActions size="lg" />
        </div>
      </section>

      <section className="py-16 px-4 bg-navy-light" aria-labelledby="faq-title">
        <div className="max-w-3xl mx-auto">
          <h2 id="faq-title" className="text-2xl font-bold text-center mb-8">
            Questions fréquentes
          </h2>
          <dl className="space-y-6">
            {L.faq.map((q) => (
              <div key={q.question}>
                <dt className="font-semibold text-white mb-1">{q.question}</dt>
                <dd className="text-gray-light leading-relaxed">{q.reponse}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Mobile : l'action principale reste à portée du pouce. `data-barre-soutien`
          déclenche, dans globals.css, la marge du pied de page et le
          `scroll-padding-bottom` : ni le dernier lien ni un élément qui prend
          le focus ne passent sous ce bandeau (WCAG 2.4.11). */}
      <aside
        data-barre-soutien
        aria-label="Soutenir Tech Speak'Her"
        className="xl:hidden fixed bottom-0 inset-x-0 z-40 bg-navy/95 backdrop-blur-sm border-t border-navy-lighter p-3 flex justify-center"
      >
        <Soutenir />
      </aside>
    </>
  );
}

/**
 * Une façon d'aider : son titre, sa phrase, puis les cartes des structures qui
 * le font déjà, en rangée qui défile (scroll-snap, sans défilement
 * automatique). La rangée prend le focus pour défiler aux flèches du clavier
 * (RGAA 7.3) et se nomme par son titre. Vide, elle invite à être la première.
 *
 * Ce qui vient de la donnée, pas de la boucle : `soutien` divulgue le lien en
 * `rel="sponsored"` ; `membresIntro` et `lien` disent UNE fois pour la rangée
 * ce qui se répéterait sur chaque carte (le jury du Tremplin, 2026-10-15).
 * Chaque carte garde le lien vers le site de sa structure, même si elle figure
 * dans deux rangées : Cateline l'a demandé, au prix d'une part de liens
 * sortants plus haute (critère Ad Grants n° 7, docs/google-ad-grants.md).
 */
function RangeeSoutien({ type }: { type: TypeSoutien }) {
  const titreId = `soutien-${type.id}-title`;
  return (
    <div>
      <div className="px-4 mb-4 max-w-3xl">
        <h3 id={titreId} className="text-xl font-bold text-white">
          {type.titre}
        </h3>
        <p className="text-gray-light mt-1">{type.aide}</p>
        {(type.membresIntro || type.lien) && (
          <p className="text-gray-light mt-3">
            {type.membresIntro}{" "}
            {type.lien && (
              <Link href={type.lien.href} className={LIEN_CARTE}>
                {type.lien.label}
              </Link>
            )}
          </p>
        )}
        {/* L'indice qu'on peut défiler, là où la rangée déborde : dès deux
            cartes sur mobile, dès quatre sur ordinateur (revue UX du
            2026-10-15). */}
        {type.membres.length >= 2 && (
          <p className={`text-sm text-cyan mt-2 ${type.membres.length >= 4 ? "" : "sm:hidden"}`}>
            {type.membres.length} structures, faites défiler <span aria-hidden="true">→</span>
          </p>
        )}
      </div>
      <div
        role="group"
        aria-labelledby={titreId}
        tabIndex={0}
        // `relative` : sans lui, les textes `sr-only` (position absolue) des
        // cartes hors champ prennent la page pour repère et l'élargissent
        // (1356 px sur un écran de 375, e2e/largeur.spec.ts).
        className="relative overflow-x-auto snap-x snap-proximity scroll-px-4 pb-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-inset rounded-xl"
      >
        <ul className="flex gap-4 px-4 w-max list-none" role="list">
          {type.membres.length === 0 ? (
            <li className={`${CARTE} border-dashed border-magenta/50`}>
              <p className="text-lg font-bold text-white mb-2">Aucune structure pour l&apos;instant</p>
              <p className="text-sm text-gray-light leading-relaxed mb-4">
                Vous pouvez être la première.
              </p>
              <div className="mt-auto">
                <Soutenir />
              </div>
            </li>
          ) : (
            type.membres.map((m) => (
              <CarteSoutien
                key={m.nom}
                nom={m.nom}
                role={m.role}
              />
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

function CarteSoutien({ nom, role }: { nom: string; role: string }) {
  const p = partenaires.find((x) => x.name === nom);
  return (
    <li className={`${CARTE} border-navy-lighter`}>
      <h4 className="text-lg font-bold text-white mb-2">{nom}</h4>
      <p className="text-sm text-gray-light leading-relaxed mb-4">{role}</p>
      <div className="mt-auto flex flex-col gap-2">
        {p?.pageInterne ? (
          <Link href={p.pageInterne} className={LIEN_CARTE}>
            En savoir plus<span className="sr-only"> sur {nom}</span>
          </Link>
        ) : (
          p?.url && <SiteLink href={p.url} nom={nom} sponsored={p.soutien} />
        )}
      </div>
    </li>
  );
}

const CARTE = "snap-start w-72 shrink-0 bg-navy border rounded-xl p-6 flex flex-col";

const LIEN_CARTE =
  "text-sm text-cyan hover:text-cyan-light underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded transition-colors";
