import type { Metadata } from "next";
import Breadcrumb from "@/components/Breadcrumb";
import Button from "@/components/Button";
import { LandingHero, QuestionsOui } from "@/components/Landing";
import { landingBenevole as L, missionsBenevoles } from "@/data/benevole";

export const metadata: Metadata = {
  title: "Devenir bénévole | Tech\u00A0Speak'Her",
  description:
    "Coacher une speakeuse, faire partie du jury du Tremplin, organiser un meetup : donnez un peu de temps pour mettre plus de femmes de la tech sur scène.",
  alternates: { canonical: "/benevole" },
};

/**
 * Une page, un rôle : proposer son temps. Une action, la même partout : nous
 * écrire. Même grille que /partenaires et /adherer (cible, promesse, questions
 * « oui », réassurance, puis la demande).
 */
function Proposer({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <Button href="/contact" size={size}>
      Proposer mon aide
    </Button>
  );
}

export default function Benevole() {
  return (
    <>
      <Breadcrumb items={[{ label: "Accueil", href: "/" }, { label: "Devenir bénévole" }]} />

      <LandingHero id="benevole-title" cible={L.cible} promesse={L.promesse} sousPromesse={L.sousPromesse}>
        <Proposer size="lg" />
      </LandingHero>

      <QuestionsOui questions={L.questions} reassurance={L.reassurance} fonce />

      <section className="py-16 px-4" aria-labelledby="missions-title">
        <div className="max-w-4xl mx-auto">
          <h2 id="missions-title" className="text-2xl font-bold text-center mb-8">
            Ce que vous pouvez <span className="text-cyan">faire</span>
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-3 gap-6 list-none mb-10" role="list">
            {missionsBenevoles.map((m) => (
              <li key={m.titre} className="bg-navy-light border border-navy-lighter rounded-xl p-6">
                <div className="text-3xl mb-3" aria-hidden="true">{m.icon}</div>
                <h3 className="text-lg font-bold text-white mb-2">{m.titre}</h3>
                <p className="text-sm text-gray-light leading-relaxed">{m.description}</p>
              </li>
            ))}
          </ul>
          <p className="text-center text-gray-light">{L.adhesion}</p>
        </div>
      </section>

      <section className="py-16 px-4 bg-navy-light" aria-labelledby="appel-benevole-title">
        <div className="max-w-3xl mx-auto text-center">
          <h2 id="appel-benevole-title" className="text-2xl font-bold mb-4">
            Proposer votre aide
          </h2>
          <p className="text-gray-light mb-8">{L.appel}</p>
          <Proposer size="lg" />
        </div>
      </section>
    </>
  );
}
