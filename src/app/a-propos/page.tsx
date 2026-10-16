import Breadcrumb from "@/components/Breadcrumb";
import type { Metadata } from "next";
import Link from "next/link";
import Button from "@/components/Button";
import ExternalLink from "@/components/ExternalLink";
import PageHero from "@/components/PageHero";
import { GDG_TOULOUSE_URL } from "@/constants/site";
import { getPublishedAnnuaire } from "@/lib/profiles";
import { fondatrices } from "@/data/fondatrices";
import { ASSOCIATION, NOM_AFFICHE, SIEGE_UNE_LIGNE, formaterImmatriculation } from "@/data/association";
import LienTexte, { LIEN_TEXTE } from "@/components/LienTexte";

export const metadata: Metadata = {
  title: "À propos | Tech Speak'Her",
  description:
    "Réseau et communauté de femmes de la tech à Toulouse, ouverte à toutes en France. Développeuses, PM, UX, data scientists, PhD reconverties, developer advocates, CTO, CPO, DSI. Mission, valeurs, qui peut rejoindre Tech Speak'Her.",
  alternates: {
    canonical: "/a-propos",
  },
};

// Rendu DYNAMIQUE : chaque fondatrice est reliée à sa fiche de l'annuaire, dont
// le contenu vit en base. Comme /speakeuses, on rend en direct plutôt qu'au
// build pour ne pas coupler le build à la base. Dégradation propre : si la base
// est indisponible, les noms s'affichent en texte simple, sans lien.
export const dynamic = "force-dynamic";

/** Minuscules sans accents, pour rapprocher un nom de fondatrice d'une fiche. */
function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

/** Nom normalisé de fondatrice -> id de sa fiche publiée (si elle en a une). */
async function getFondatriceProfileIds(): Promise<Record<string, number>> {
  try {
    const annuaire = await getPublishedAnnuaire();
    const parNom: Record<string, number> = {};
    for (const p of annuaire) {
      if (p.name) parNom[normalizeName(p.name)] = p.id;
    }
    return parNom;
  } catch {
    // Base indisponible : on affiche les noms sans lien plutôt que de planter.
    return {};
  }
}

export default async function APropos() {
  const profileIds = await getFondatriceProfileIds();
  return (
    <>
      <Breadcrumb items={[{ label: "Accueil", href: "/" }, { label: "À propos" }]} />
      {/* Hero */}
      <PageHero
        id="apropos-title"
        title={<>À propos de <span className="text-cyan">Tech Speak&apos;Her</span></>}
        subtitle="On s'est dit qu'il manquait des femmes sur les scènes de conférences tech à Toulouse. Alors on a décidé de faire quelque chose."
        titleClassName="mb-6"
        subtitleClassName="text-xl max-w-3xl leading-relaxed"
      />

      {/* Mission */}
      <section className="py-12 px-4 bg-navy-light" aria-labelledby="mission-title">
        <div className="max-w-4xl mx-auto">
          <h2 id="mission-title" className="text-2xl font-bold text-magenta mb-6">Notre mission</h2>
          <div className="space-y-4 text-gray-light leading-relaxed">
            <p>
              En France, les femmes ne représentent que{" "}
              <strong className="text-magenta">17&nbsp;%</strong> des métiers
              techniques et sont largement sous-représentées sur les scènes de
              conférences technologiques.
            </p>
            <p>
              <strong className="text-white">Tech Speak&apos;Her</strong>{" "}
              est née de ce constat. On a démarré nos premiers meetups avec{" "}
              <ExternalLink
                href={GDG_TOULOUSE_URL}
                className={LIEN_TEXTE}
              >
                GDG Toulouse
              </ExternalLink>
              , on aide des femmes à préparer leurs talks, et on
              essaie de montrer que monter sur scène, c&apos;est pas réservé aux
              autres.
            </p>
            <p>
              À travers nos meetups, notre{" "}
              <LienTexte href="/tremplin">
                programme Tremplin
              </LienTexte>{" "}
              et nos interviews{" "}
              <LienTexte href="/actualites">
                &laquo;&nbsp;Behind the Scenes&nbsp;&raquo;
              </LienTexte>
              , nous montrons que c&apos;est possible
              de passer de la salle… à la scène.
            </p>
          </div>
        </div>
      </section>

      {/* Valeurs */}
      <section className="py-16 px-4" aria-labelledby="valeurs-title">
        <div className="max-w-4xl mx-auto">
          <h2 id="valeurs-title" className="text-2xl font-bold text-cyan mb-8 text-center">
            Nos valeurs
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-3 gap-6 list-none" role="list">
            {[
              {
                title: "Bienveillance",
                description:
                  "On peut se planter, hésiter, recommencer. Personne ne juge.",
                color: "text-cyan",
              },
              {
                title: "Entraide",
                description:
                  "On s'aide entre nous. Celles qui sont déjà passées par là accompagnent celles qui débutent.",
                color: "text-magenta",
              },
              {
                title: "Visibilité",
                description:
                  "Montrer que les femmes de la tech ont leur place sur scène.",
                color: "text-orange",
              },
            ].map((v) => (
              <li
                key={v.title}
                className="bg-navy-light border border-navy-lighter rounded-xl p-6 text-center"
              >
                <h3 className={`text-lg font-bold ${v.color} mb-3`}>
                  {v.title}
                </h3>
                <p className="text-sm text-gray-light">{v.description}</p>
              </li>
            ))}
          </ul>
          <div className="mt-10 bg-navy-light border border-cyan/30 rounded-xl p-6 sm:p-8 text-center">
            <p className="text-gray-light leading-relaxed mb-4">
              Ces valeurs ne sont pas que des mots&nbsp;: elles sont écrites
              noir sur blanc dans notre code de conduite, qui s&apos;applique
              à tous nos événements.
            </p>
            <Button href="/code-de-conduite" variant="secondary">
              Lire le code de conduite
            </Button>
          </div>
        </div>
      </section>

      {/* Qui sommes-nous */}
      <section className="py-16 px-4" aria-labelledby="qui-title">
        <div className="max-w-3xl mx-auto text-center">
          <h2 id="qui-title" className="text-2xl sm:text-3xl font-bold mb-6">
            Qui <span className="text-magenta">sommes-nous</span>&nbsp;?
          </h2>
          <p className="text-gray-light leading-relaxed mb-6">
            Tech Speak&apos;Her, c&apos;est un groupe de femmes de la tech
            qui veulent donner de la visibilité aux femmes sur les scènes
            de conférences. On est speakeuses, organisatrices, mentors, et
            surtout convaincues que ça vaut le coup d&apos;essayer.
          </p>
          <p className="text-gray-light leading-relaxed mb-6">
            Tech Speak&apos;Her a été fondée par{" "}
            {fondatrices.map((f, i) => {
              const id = profileIds[normalizeName(f.name)];
              const separateur =
                i === 0
                  ? ""
                  : i === fondatrices.length - 1
                    ? " et "
                    : ", ";
              return (
                <span key={f.name}>
                  {separateur}
                  {id ? (
                    <Link
                      href={`/speakeuses/${id}`}
                      className={LIEN_TEXTE}
                    >
                      {f.name}
                    </Link>
                  ) : (
                    <strong className="text-white">{f.name}</strong>
                  )}
                </span>
              );
            })}
            .
          </p>
          <Button href="/speakeuses">
            Découvrir les speakeuses
          </Button>
        </div>
      </section>

      {/* L'association : l'entité juridique derrière la communauté. Utile aux
          visiteurs, et indispensable aux organismes qui instruisent un dossier
          (subventions, programmes associatifs) : ils rapprochent ce qui est
          écrit ici du numéro RNA déclaré. Voir docs/google-ad-grants.md. */}
      <section className="py-16 px-4" aria-labelledby="association-title">
        <div className="max-w-3xl mx-auto">
          <h2 id="association-title" className="text-2xl sm:text-3xl font-bold mb-6">
            L&apos;<span className="text-cyan">association</span>
          </h2>
          <div className="space-y-4 text-gray-light leading-relaxed">
            <p>
              <strong className="text-white">{NOM_AFFICHE}</strong> est une{" "}
              {ASSOCIATION.formeJuridique}, à but non lucratif, déclarée le{" "}
              {ASSOCIATION.dateDeclaration} sous le numéro RNA{" "}
              <strong className="text-white">{ASSOCIATION.rna}</strong> (SIREN{" "}
              <strong className="text-white">{formaterImmatriculation(ASSOCIATION.siren)}</strong>
              ). Son siège est au {SIEGE_UNE_LIGNE}, et son action porte sur
              toute la France.
            </p>
            <p>
              Son objet, tel qu&apos;il figure dans ses statuts&nbsp;:
              «&nbsp;{ASSOCIATION.objet}&nbsp;»
            </p>
            <p>Au quotidien, cela prend quatre formes&nbsp;:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                des <strong className="text-white">meetups</strong>{" "}
                et rencontres, dont les deux premiers avec GDG Toulouse&nbsp;;
              </li>
              <li>
                le <strong className="text-white">Tremplin</strong>, un programme
                d&apos;accompagnement (ateliers, coaching, soirée de pitch) qui
                mène des speakeuses jusqu&apos;à la scène du DevFest
                Toulouse&nbsp;;
              </li>
              <li>
                un <strong className="text-white">annuaire public</strong>{" "}
                de speakeuses, pour que les organisateurs de conférences
                trouvent des intervenantes&nbsp;;
              </li>
              <li>
                des <strong className="text-white">articles et interviews</strong>{" "}
                qui racontent des parcours et démontent les blocages devant la
                prise de parole.
              </li>
            </ul>
            {/* Cette phrase disait « tout est gratuit pour les femmes qui
                participent ». L'adhésion devient la porte d'entrée de la
                plateforme, et la gratuité cesse alors d'être vraie : une page
                « à propos » qui promet le contraire du bulletin d'adhésion se
                retourne contre l'association, devant un examinateur comme
                devant une adhérente. On dit la règle, et le montant vit là où
                l'on adhère. Voir docs/google-ad-grants.md §4 bis. */}
            <p>
              L&apos;<LienTexte href="/adherer">adhésion</LienTexte>{" "}
              à l&apos;association, et l&apos;acceptation de son règlement
              intérieur, ouvrent l&apos;accès à la plateforme Tech Speak&apos;Her
              et à ses services&nbsp;: la fiche dans
              l&apos;annuaire, l&apos;agenda des talks,
              l&apos;accompagnement.
            </p>
            <p>
              L&apos;association fonctionne grâce au bénévolat de ses membres et
              au soutien de{" "}
              <LienTexte href="/partenaires">
                sponsors et de structures amies
              </LienTexte>{" "}
              qui prennent en charge un lieu, un outil ou un frais
              d&apos;événement. Les ressources reçues financent les événements
              et l&apos;accompagnement des speakeuses.
            </p>
            <p>
              La gouvernance est <strong className="text-white">collégiale</strong>&nbsp;: les décisions se prennent ensemble, par consensus, au sein du
              collège dirigeant, formé des {ASSOCIATION.collegeDirigeant}{" "}
              fondatrices. L&apos;association est représentée par des
              co-représentantes légales, et le droit de vote en assemblée
              générale appartient aux membres du collège.
            </p>
            <p>
              Éditeur, hébergement, traitement des données et accessibilité sont
              détaillés dans les{" "}
              <LienTexte href="/mentions-legales">
                mentions légales
              </LienTexte>
              .
            </p>
          </div>
        </div>
      </section>

      {/* À qui s'adresse la communauté */}
      <section
        className="py-16 px-4 bg-navy-light"
        aria-labelledby="audience-title"
      >
        <div className="max-w-4xl mx-auto">
          <h2
            id="audience-title"
            className="text-2xl sm:text-3xl font-bold mb-3 text-center"
          >
            À qui s&apos;adresse la <span className="text-cyan">communauté</span>&nbsp;?
          </h2>
          <p className="text-gray-light text-center max-w-2xl mx-auto mb-10 leading-relaxed">
            Toutes les femmes de la tech en France, tous métiers et tous niveaux.
            Tu te reconnais probablement quelque part&nbsp;:
          </p>

          <ul
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 list-none"
            role="list"
          >
            <li className="bg-navy border border-navy-lighter rounded-xl p-5">
              <h3 className="text-base font-bold text-cyan mb-2">
                Engineering &amp; ops
              </h3>
              <p className="text-sm text-gray-light leading-relaxed">
                Développeuses (front, back, full-stack, mobile), ingénieures
                logiciel, tech leads, architectes, SRE, DevOps, ingénieures
                cloud, QA, sécurité, developer advocates (DevRel).
              </p>
            </li>

            <li className="bg-navy border border-navy-lighter rounded-xl p-5">
              <h3 className="text-base font-bold text-magenta mb-2">
                Data, IA &amp; ML
              </h3>
              <p className="text-sm text-gray-light leading-relaxed">
                Data engineers, data scientists, data analysts, ML engineers,
                IA / AI engineers, LLM engineers, MLOps, prompt engineers,
                research engineers, AI architects, dont les PhD reconverties
                dans la tech.
              </p>
            </li>

            <li className="bg-navy border border-navy-lighter rounded-xl p-5">
              <h3 className="text-base font-bold text-orange mb-2">
                Produit &amp; design
              </h3>
              <p className="text-sm text-gray-light leading-relaxed">
                Product managers (junior, senior, lead), product owners, UX/UI
                designers, product designers, UX researchers, product marketing.
              </p>
            </li>

            <li className="bg-navy border border-navy-lighter rounded-xl p-5">
              <h3 className="text-base font-bold text-cyan mb-2">
                Management
              </h3>
              <p className="text-sm text-gray-light leading-relaxed">
                Engineering managers, product leads, design leads, data leads,
                head of product, head of design, head of engineering, head of
                data, head of AI, head of security.
              </p>
            </li>

            <li className="bg-navy border border-navy-lighter rounded-xl p-5">
              <h3 className="text-base font-bold text-magenta mb-2">
                Leadership &amp; C-level
              </h3>
              <p className="text-sm text-gray-light leading-relaxed">
                VP Engineering, VP Product, directrices techniques (CTO),
                directrices produit (CPO), CPTO, CISO, directrices de
                l&apos;ingénierie, DSI.
              </p>
            </li>

            <li className="bg-navy border border-navy-lighter rounded-xl p-5">
              <h3 className="text-base font-bold text-orange mb-2">
                Tous les niveaux d&apos;expérience
              </h3>
              <p className="text-sm text-gray-light leading-relaxed">
                Que tu n&apos;aies jamais parlé en public, que tu enchaînes
                déjà les meetups, ou que tu veuilles passer à des scènes plus
                grandes, il y a une place pour toi.
              </p>
            </li>
          </ul>

          <p className="text-sm text-gray-light text-center mt-8 max-w-2xl mx-auto">
            Tu ne te retrouves dans aucune case&nbsp;? Pas grave. Si tu es
            une femme de la tech qui veut prendre la parole, tu es la bienvenue.
          </p>
        </div>
      </section>

    </>
  );
}
