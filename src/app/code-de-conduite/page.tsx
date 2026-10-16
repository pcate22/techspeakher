import Breadcrumb from "@/components/Breadcrumb";
import type { Metadata } from "next";
import { codeDeConduite, VERSION_CODE_DE_CONDUITE } from "@/data/charte";
import { BASE_URL, CONTACT_EMAIL } from "@/constants/site";
import { LIEN_TEXTE } from "@/components/LienTexte";
import { ASSOCIATION } from "@/data/association";

export const metadata: Metadata = {
  title: "Code de conduite | Tech Speak'Her Toulouse",
  description:
    "Le code de conduite de Tech Speak'Her : respect, bienveillance, place à toutes les voix. S'applique à tous nos événements : meetups, programme Tremplin, soirée finale à Toulouse.",
  keywords: [
    "code de conduite",
    "charte",
    "charte de conduite",
    "code of conduct",
    "conférence tech femmes",
    "événement inclusif",
    "Tech Speak'Her",
    "femmes tech Toulouse",
    "prise de parole en sécurité",
    "règles communauté tech",
  ],
  alternates: {
    canonical: "/code-de-conduite",
  },
  openGraph: {
    title: "Code de conduite Tech Speak'Her",
    description:
      "Respect, débats bienveillants, place à toutes les voix : notre code de conduite pour que chaque événement Tech Speak'Her soit un espace sûr pour les femmes de la tech.",
    type: "article",
    url: `${BASE_URL}/code-de-conduite`,
  },
};

const tshOrg = { "@type": "Organization" as const, name: ASSOCIATION.nom, url: BASE_URL };

const charteSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: `Code de conduite ${ASSOCIATION.nom}`,
  description:
    `Le code de conduite (charte) de ${ASSOCIATION.nom} pour tous ses événements : meetups, programme Tremplin et soirée finale à Toulouse.`,
  author: tshOrg,
  publisher: tshOrg,
  url: `${BASE_URL}/code-de-conduite`,
  inLanguage: "fr-FR",
  about: [
    { "@type": "Thing", name: "Code de conduite" },
    { "@type": "Thing", name: "Femmes dans la technologie" },
    { "@type": "Thing", name: "Inclusion en conférence tech" },
  ],
  version: VERSION_CODE_DE_CONDUITE.numero,
};

/**
 * Le texte adopté écrit l'adresse en clair : on la rend cliquable à
 * l'affichage, sans toucher à la formulation (signaler doit rester à un clic).
 */
function avecLienEmail(texte: string) {
  const i = texte.indexOf(CONTACT_EMAIL);
  if (i === -1) return texte;
  return (
    <>
      {texte.slice(0, i)}
      <a href={`mailto:${CONTACT_EMAIL}`} className={`${LIEN_TEXTE} break-all`}>
        {CONTACT_EMAIL}
      </a>
      {texte.slice(i + CONTACT_EMAIL.length)}
    </>
  );
}

export default function CodeDeConduite() {
  return (
    <>
      <Breadcrumb items={[{ label: "Accueil", href: "/" }, { label: "Code de conduite" }]} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(charteSchema) }}
      />

      <section className="py-16 sm:py-24 px-4" aria-labelledby="charte-title">
        <div className="max-w-3xl mx-auto">
          <h1
            id="charte-title"
            className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-6"
          >
            Code de <span className="text-cyan">conduite</span>
          </h1>
          {/* Le texte vit dans src/data/charte.ts : il est adopté avec le
              règlement intérieur et se recopie, il ne se reformule pas. */}
          <p className="text-sm text-gray-light leading-relaxed">
            Annexe 1 du règlement intérieur (article 22), version{" "}
            {VERSION_CODE_DE_CONDUITE.numero} du {VERSION_CODE_DE_CONDUITE.date},
            adoptée et modifiée avec lui.
          </p>

          <div className="mt-10 space-y-10">
            {codeDeConduite.map((section) => (
              <section key={section.id} aria-labelledby={section.id}>
                <h2 id={section.id} className="text-xl font-bold text-white mb-4">
                  {section.titre}
                </h2>
                <div className="space-y-3 text-gray-light leading-relaxed">
                  {section.paragraphes.map((p) => (
                    <p key={p}>{p}</p>
                  ))}
                  {section.liste && (
                    <ul className="list-disc pl-6 space-y-2">
                      {section.liste.map((item) => (
                        <li key={item}>{avecLienEmail(item)}</li>
                      ))}
                    </ul>
                  )}
                  {section.apresListe?.map((p) => (
                    <p key={p}>{p}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
