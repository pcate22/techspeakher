import type { Metadata } from "next";
import Breadcrumb from "@/components/Breadcrumb";
import Button from "@/components/Button";
import { LandingHero, QuestionsOui } from "@/components/Landing";
import LienTexte from "@/components/LienTexte";
import ExternalLink from "@/components/ExternalLink";
import { LIEN_TEXTE } from "@/components/LienTexte";
import { HELLOASSO_ADHESION_URL, HELLOASSO_SOUTIEN_URL } from "@/constants/site";
import { aSavoirAdhesion, introAdhesion, landingAdhesion as L, tarifsAdhesion } from "@/data/adhesion";
import { partenaires } from "@/data/partenaires";
import { countPublishedProfiles } from "@/lib/profiles";

/** Les adhésions sont ouvertes dès que l'URL de la campagne est renseignée. */
const adhesionsOuvertes = HELLOASSO_ADHESION_URL !== "";

// Le compte de speakeuses vient de la base : même motif et même repli que
// /partenaires.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Adhérer | Tech\u00A0Speak'Her",
  description:
    "Adhérer à Tech\u00A0Speak'Her, l'association des femmes de la tech qui montent sur scène : 10 € par an, ou gratuit selon votre situation.",
  alternates: { canonical: "/adherer" },
  // Hors index tant que le bouton est masqué : une page sans moyen d'adhérer
  // serait une page « bientôt » (cf. docs/google-ad-grants.md, checklist §5).
  ...(adhesionsOuvertes ? {} : { robots: { index: false, follow: true } }),
};

/**
 * « avec un formulaire séparé » mène à la campagne de soutien : un lien dans le
 * texte, pas un second bouton (la page garde une seule action, adhérer).
 */
const FORMULAIRE_SEPARE = "avec un formulaire séparé";
function avecLienSoutien(texte: string) {
  const i = texte.indexOf(FORMULAIRE_SEPARE);
  if (i === -1) return texte;
  return (
    <>
      {texte.slice(0, i)}avec un{" "}
      <ExternalLink href={HELLOASSO_SOUTIEN_URL} className={LIEN_TEXTE}>
        formulaire séparé
      </ExternalLink>
      {texte.slice(i + FORMULAIRE_SEPARE.length)}
    </>
  );
}

/**
 * LANDING (2026-10-15, grille Scalezia, revue d'Audrey Jargot du 06/10) : UNE
 * action, la même partout, adhérer sur HelloAsso. Le parcours va de la
 * reconnaissance à la demande ; les règles des statuts suivent, mot pour mot.
 * Masquée tant que la campagne n'est pas publiée (HELLOASSO_ADHESION_URL vide).
 */
function Adhesion({ size = "md" }: { size?: "md" | "lg" }) {
  if (!adhesionsOuvertes) return null;
  return (
    <Button href={HELLOASSO_ADHESION_URL} external size={size}>
      Adhérer sur HelloAsso
    </Button>
  );
}

export default async function Adherer() {
  // Résilient : base injoignable → chiffre absent (jamais un nombre faux).
  const speakeuses = await countPublishedProfiles().catch(() => null);
  const chiffres = [
    ...(speakeuses ? [{ valeur: String(speakeuses), libelle: "speakeuses dans l'annuaire" }] : []),
    { valeur: String(partenaires.length), libelle: "structures à nos côtés" },
  ];

  return (
    <>
      <Breadcrumb items={[{ label: "Accueil", href: "/" }, { label: "Adhérer" }]} />

      {/* 1. La cible au-dessus de la promesse : le H1 porte le mot-clé. */}
      <LandingHero id="adherer-title" cible={L.cible} promesse={L.promesse} sousPromesse={L.sousPromesse}>
        <Adhesion size="lg" />
        {/* Le bouton du haut mène droit à HelloAsso : la consigne d'adresse
            doit se lire AVANT le clic, pas seulement en bas de page. */}
        {adhesionsOuvertes && (
          <p className="text-sm text-gray-light max-w-xl mx-auto mt-4">{L.adresseCompte}</p>
        )}
        <ul className="flex flex-col sm:flex-row justify-center gap-6 sm:gap-12 mt-12 list-none" role="list">
          {chiffres.map((c) => (
            <li key={c.libelle}>
              <p className="text-4xl font-bold text-magenta">{c.valeur}</p>
              <p className="text-sm text-gray-light">{c.libelle}</p>
            </li>
          ))}
        </ul>
      </LandingHero>

      {/* 2. Des questions auxquelles on répond « oui », puis la réassurance. */}
      <QuestionsOui questions={L.questions} reassurance={L.reassurance} fonce />

      {/* 3. Ce que l'adhésion apporte, puis la demande. */}
      <section className="py-16 px-4" aria-labelledby="apports-title">
        <div className="max-w-4xl mx-auto">
          <h2 id="apports-title" className="text-2xl font-bold text-center mb-8">
            Ce que l&apos;adhésion vous <span className="text-cyan">apporte</span>
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-3 gap-6 list-none mb-10" role="list">
            {L.apports.map((a) => (
              <li key={a.titre} className="bg-navy-light border border-navy-lighter rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-2">{a.titre}</h3>
                <p className="text-sm text-gray-light leading-relaxed">{a.description}</p>
              </li>
            ))}
          </ul>
          <div className="text-center">
            <Adhesion />
          </div>
        </div>
      </section>

      {/* 4. Les règles, des statuts : mot pour mot. */}
      <section className="py-16 px-4 bg-navy-light" aria-labelledby="tarifs-title">
        <div className="max-w-3xl mx-auto">
          <h2 id="tarifs-title" className="text-2xl font-bold text-white mb-4">
            Tarifs
          </h2>
          <p className="text-gray-light leading-relaxed mb-4">{introAdhesion}</p>
          <ul className="list-disc pl-6 space-y-2 text-gray-light leading-relaxed">
            {tarifsAdhesion.map((t) => (
              <li key={t}>{avecLienSoutien(t)}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="py-16 px-4" aria-labelledby="a-savoir-title">
        <div className="max-w-3xl mx-auto">
          <h2 id="a-savoir-title" className="text-2xl font-bold text-white mb-4">
            À savoir avant d&apos;adhérer
          </h2>
          <ul className="list-disc pl-6 space-y-2 text-gray-light leading-relaxed">
            {aSavoirAdhesion.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-gray-light">
            Lire le <LienTexte href="/code-de-conduite">code de conduite</LienTexte>.
          </p>
        </div>
      </section>

      {/* 5. L'appel final. */}
      <section className="py-16 px-4 bg-navy-light" aria-labelledby="appel-adherer-title">
        <div className="max-w-3xl mx-auto text-center">
          <h2 id="appel-adherer-title" className="text-2xl font-bold mb-4">
            Adhérer
          </h2>
          <p className="text-gray-light mb-4">{L.appel}</p>
          <p className="text-gray-light mb-8">{L.adresseCompte}</p>
          <Adhesion size="lg" />
        </div>
      </section>

      {/* Mobile : l'action reste à portée du pouce. L'attribut de la barre
          donne au pied de page sa marge et le `scroll-padding-bottom`
          (globals.css) : rien ne passe sous ce bandeau (WCAG 2.4.11). */}
      {adhesionsOuvertes && (
        <aside
          data-barre-soutien
          aria-label="Adhérer à Tech Speak'Her"
          className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-navy/95 backdrop-blur-sm border-t border-navy-lighter p-3 flex justify-center"
        >
          <Adhesion />
        </aside>
      )}
    </>
  );
}
