import Breadcrumb from "@/components/Breadcrumb";
import type { Metadata } from "next";
import LinkedInIcon from "@/components/icons/LinkedInIcon";
import Card from "@/components/Card";
import ExternalLink from "@/components/ExternalLink";
import PageHero from "@/components/PageHero";
import { LINKEDIN_URL } from "@/constants/site";
import ContactForm from "./ContactForm";

export const metadata: Metadata = {
  title: "Contact | Tech Speak'Her Toulouse",
  description:
    "Contactez Tech Speak'Her pour rejoindre la communauté, proposer un partenariat ou trouver des speakeuses pour vos événements tech à Toulouse.",
  keywords: [
    "contact Tech Speak'Her",
    "speakeuses tech Toulouse",
    "intervenantes conférence",
    "GDG Toulouse",
  ],
  alternates: {
    canonical: "/contact",
  },
};

export default function Contact() {
  return (
    <>
      <Breadcrumb items={[{ label: "Accueil", href: "/" }, { label: "Contact" }]} />
      {/* Hero */}
      <PageHero
        id="contact-title"
        title={<><span className="text-cyan">Contactez</span>-nous</>}
        subtitle="On vous lit et on vous répond."
      />

      <section className="pb-16 px-4" aria-label="Formulaire et informations de contact">
        <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10">
          <ContactForm />

          {/* Informations */}
          <div className="space-y-8">
            {/* LinkedIn */}
            <Card>
              <h2 className="text-lg font-bold mb-3">Suivez-nous</h2>
              <ExternalLink
                href={LINKEDIN_URL}
                className="inline-flex items-center gap-2 text-cyan hover:text-cyan-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded transition-colors"
              >
                <LinkedInIcon className="w-5 h-5" />
                Tech Speak&apos;Her sur LinkedIn
              </ExternalLink>
            </Card>

            {/* Structure */}
            <Card>
              <h2 className="text-lg font-bold mb-3">Notre structure</h2>
              <p className="text-gray-light text-sm leading-relaxed">
                Tech Speak&apos;Her est une association loi 1901.
              </p>
            </Card>

            {/* Cherche speakeuses */}
            <div className="bg-gradient-to-br from-magenta/10 to-cyan/10 border border-navy-lighter rounded-xl p-6">
              <h2 className="text-lg font-bold mb-3 text-cyan">
                Vous cherchez des intervenantes&nbsp;?
              </h2>
              <p className="text-gray-light text-sm leading-relaxed">
                Vous organisez un événement tech et cherchez des speakeuses&nbsp;?
                Nous pouvons vous mettre en relation avec les femmes de notre
                communauté. Contactez-nous via le formulaire ou sur LinkedIn.
              </p>
            </div>

          </div>
        </div>
      </section>
    </>
  );
}
