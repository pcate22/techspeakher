import Breadcrumb from "@/components/Breadcrumb";
import type { Metadata } from "next";
import Button from "@/components/Button";
import PageHero from "@/components/PageHero";
import SiteLink from "@/components/SiteLink";
import ConferenceLogo from "@/components/ConferenceLogo";
import { listPartnerConferences, type PartnerConference } from "@/lib/conference-speakers";
import LienTexte from "@/components/LienTexte";

export const metadata: Metadata = {
  title: "Conférences & associations partenaires | Tech Speak'Her Toulouse",
  description:
    "Les conférences et communautés qui nous accueillent, nous, nos meetups et nos tremplins : DevFest Toulouse, GDG Toulouse, JS&Co et les autres.",
  keywords: [
    "conférences partenaires Tech Speak'Her",
    "communautés tech Toulouse",
    "DevFest Toulouse",
    "GDG Toulouse",
  ],
  alternates: {
    canonical: "/conferences",
  },
};

// Contenu dérivé de la base (éditions reliées à TSH) : une nouvelle activité
// (talk d'une speakeuse, tremplin, article) fait apparaître la conf/asso seule.
export const revalidate = 300;

function ConfCard({ c }: { c: PartnerConference }) {
  const lieu = [c.ville, c.pays].filter(Boolean).join(", ");
  return (
    <li className="bg-navy border border-navy-lighter rounded-xl p-6 hover:border-cyan/40 transition-colors">
      <div className="flex items-center gap-3 mb-1">
        <ConferenceLogo nom={c.nom} slug={c.slug} />
        <h3 className="text-lg font-bold text-white">{c.nom}</h3>
      </div>
      {lieu && <p className="text-sm text-gray-light mb-2">{lieu}</p>}
      <p className="text-sm text-cyan mb-3">
        {c.nbEvenements > 1
          ? `${c.nbEvenements} évènements avec nous`
          : "1 évènement avec nous"}
      </p>
      {c.siteUrl && <SiteLink href={c.siteUrl} nom={c.nom} />}
    </li>
  );
}

function Groupe({
  id,
  titre,
  items,
}: {
  id: string;
  titre: React.ReactNode;
  items: PartnerConference[];
}) {
  if (items.length === 0) return null;
  return (
    <section className="mb-12 last:mb-0" aria-labelledby={id}>
      <h2 id={id} className="text-2xl font-bold text-center mb-8">
        {titre}
      </h2>
      <ul className="grid grid-cols-1 sm:grid-cols-3 gap-6 list-none" role="list">
        {items.map((c) => (
          <ConfCard key={c.slug} c={c} />
        ))}
      </ul>
    </section>
  );
}

export default async function Conferences() {
  // Résilient : base indisponible au prerender (build, sans Postgres) → liste
  // vide, l'ISR (revalidate) la remplit une fois déployée. Même pattern que
  // /devfest-toulouse (siTableAbsente ne couvre QUE la table absente).
  const partners = await listPartnerConferences().catch(() => [] as PartnerConference[]);
  const conferences = partners.filter((c) => c.type === "conference");
  const assos = partners.filter((c) => c.type !== "conference");

  return (
    <>
      <Breadcrumb items={[{ label: "Accueil", href: "/" }, { label: "Conférences & associations" }]} />
      <PageHero
        id="conferences-title"
        title={
          <>
            Conférences &amp; associations <span className="text-cyan">partenaires</span>
          </>
        }
        subtitle="Les conférences et communautés qui accueillent nos speakeuses, nos meetups et nos tremplins. Une scène s'ajoute ici dès qu'une femme de la communauté y prend la parole."
      />

      <div className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          {partners.length === 0 ? (
            /* Un état vide qui se tient tout seul. L'ancienne version annonçait
               « la liste arrive bientôt » : une page en construction, ce que la
               règle Ad Grants proscrit nommément, et une promesse de contenu
               plutôt qu'un contenu. On dit à quoi sert cette page et on mène
               ailleurs sur le site. Voir docs/google-ad-grants.md. */
            <div className="max-w-2xl mx-auto text-center space-y-4 text-gray-light leading-relaxed">
              <p>
                Deux endroits pour voir la communauté à l&apos;œuvre&nbsp;:{" "}
                <LienTexte href="/agenda">
                  l&apos;agenda des speakeuses
                </LienTexte>{" "}
                et{" "}
                <LienTexte href="/partenaires">
                  celles et ceux qui nous soutiennent
                </LienTexte>
                .
              </p>
            </div>
          ) : (
            <>
              <Groupe
                id="groupe-conferences"
                titre={
                  <>
                    Les <span className="text-magenta-light">conférences</span>
                  </>
                }
                items={conferences}
              />
              <Groupe
                id="groupe-assos"
                titre={
                  <>
                    Communautés &amp; <span className="text-cyan">associations</span>
                  </>
                }
                items={assos}
              />
              {/* Une destination chez nous sous la grille, plutôt qu'un lien par
                  carte : les talks comptés ci-dessus vivent dans l'agenda. On
                  visait `/tremplin/{slug}`, plus précis, mais ce hub n'existe
                  que pour les confs ayant une édition de Tremplin, et le lien
                  aurait cassé sur les autres. Voir docs/google-ad-grants.md. */}
              <p className="text-center mt-12">
                <LienTexte href="/agenda">
                  Voir ces talks dans l&apos;agenda des speakeuses
                </LienTexte>
              </p>
            </>
          )}
        </div>
      </div>

      {/* CTA */}
      <section className="py-16 px-4 bg-navy-light" aria-labelledby="conferences-cta-title">
        <div className="max-w-3xl mx-auto text-center">
          <h2 id="conferences-cta-title" className="text-2xl font-bold mb-4">
            Vous nous accueillez&nbsp;?
          </h2>
          <p className="text-gray-light mb-6">
            Un meetup, une conférence, un créneau sur scène : on adore faire
            monter nos speakeuses. Écrivez-nous pour en parler.
          </p>
          <Button href="/partenaires">Devenir partenaire</Button>
        </div>
      </section>
    </>
  );
}
