import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SessionProvider } from "next-auth/react";
import { BASE_URL, LINKEDIN_URL, MEETUP_URL } from "@/constants/site";
import { ASSOCIATION } from "@/data/association";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "NGO",
  // Les DONNÉES STRUCTURÉES portent la graphie des statuts, celle qu'un
  // organisme instructeur compare à son dossier — pas l'insécable, qui est une
  // affaire de mise en page. Source unique : src/data/association.ts.
  name: ASSOCIATION.nom,
  url: BASE_URL,
  logo: `${BASE_URL}/logo-full.webp`,
  description:
    "Réseau et communauté de femmes de la tech à Toulouse. Networking, mentorat, accompagnement à la prise de parole en conférence. Ouverte à tous les métiers : développeuses, product managers, designers, data, SRE, ingénieures, tech leads, engineering managers, CTO, CPO, CPTO, CISO, VP Engineering. Association loi 1901.",
  sameAs: [LINKEDIN_URL, MEETUP_URL],
  address: {
    "@type": "PostalAddress",
    streetAddress: ASSOCIATION.siege.voie,
    postalCode: ASSOCIATION.siege.codePostal,
    addressLocality: ASSOCIATION.siege.commune,
    addressRegion: "Occitanie",
    addressCountry: "FR",
  },
  areaServed: { "@type": "Country", name: "France" },
  audience: {
    "@type": "Audience",
    audienceType:
      "Femmes de la tech en France cherchant un réseau, un groupe local ou du networking, tous métiers et tous niveaux : développeuses, product managers (PM, PO, CPO, Head of Product), UX/product designers, data scientists, ML engineers, SRE, DevOps, cloud engineers, developer advocates (DevRel), ingénieures, tech leads, engineering managers, DSI, directrices techniques (CTO), directrices produit (CPO, CPTO), CISO, VP Engineering. Inclut les PhD reconverties dans la tech et les professionnelles de la MedTech / santé numérique.",
  },
  foundingDate: "2026-06-23",
  // Identifiants officiels sous forme canonique (sans espaces de lisibilité),
  // pour qu'un outil qui recoupe le site et un registre les retrouve tels
  // quels. Les pages les affichent groupés à la française.
  identifier: (
    [
      ["RNA", ASSOCIATION.rna],
      ["SIREN", ASSOCIATION.siren],
      ["SIRET", ASSOCIATION.siret],
    ] as const
  ).map(([propertyID, value]) => ({
    "@type": "PropertyValue" as const,
    propertyID,
    value,
  })),
};

export const viewport: Viewport = {
  themeColor: "#170E47",
};

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: "Tech Speak'Her | De la salle à la scène",
  description:
    "Communauté et réseau de femmes de la tech à Toulouse : développeuses, product managers, designers, data, ingénieures, tech leads, CTO, CPO. Networking, mentorat, meetups, accompagnement à la prise de parole en conférence. Ouvert à toutes les femmes tech en France.",
  keywords: [
    // Cette liste ÉNUMÈRE les graphies du nom : elle garde donc l'espace
    // ORDINAIRE, celle qu'on tape. L'insécable est une affaire de mise en
    // page, elle n'a rien à faire dans une liste de variantes.
    "Tech Speak'Her",
    "TechSpeakHer",
    "Tech SpeakHer",
    "femmes tech",
    "femmes dans la tech",
    "communauté femmes tech",
    "communauté femmes tech France",
    "réseau femmes tech",
    "réseau femmes tech Toulouse",
    "groupe femmes tech Toulouse",
    "networking femmes tech",
    "networking femmes tech France",
    "communauté product management Toulouse",
    "groupe femmes product manager Toulouse",
    "groupe femmes PM Toulouse",
    "speakeuses",
    "mentorat femmes tech",
    "femme product manager",
    "femmes product management",
    "femme CTO",
    "femme CPO",
    "femme CPTO",
    "femme CISO",
    "femme VP Engineering",
    "femme directrice technique",
    "femme directrice produit",
    "femme tech lead",
    "femme engineering manager",
    "femme développeuse",
    "femme data scientist",
    "femme designer tech",
    "femme UX designer",
    "femme developer advocate",
    "femme DevRel",
    "femme DSI",
    "femme SRE",
    "femme DevOps",
    "femme cloud engineer",
    "femme QA",
    "femme PhD tech",
    "reconversion PhD tech femmes",
    "MedTech femmes",
    "femmes santé numérique",
    "femmes leadership tech",
    "diversité tech",
    "conférences tech",
    "prise de parole",
    "Toulouse",
    "GDG Toulouse",
    "DevFest",
  ],
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: ASSOCIATION.nom,
    images: [
      {
        url: "/logo-full.webp",
        width: 120,
        height: 120,
        alt: "Tech Speak'Her",
      },
    ],
  },
  twitter: {
    card: "summary",
    images: ["/logo-full.webp"],
  },
  icons: {
    icon: [
      { url: "/logo-icon.webp", type: "image/webp" },
      { url: "/favicon.ico", sizes: "32x32" },
    ],
    apple: "/logo-icon.webp",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="h-full antialiased">
      <head>
        {/* Avatars des comptes (Google/LinkedIn) servis en <img> depuis ces
            hôtes : on ouvre la connexion tôt (DNS + TLS) pour ne pas retarder
            leur affichage dans l'annuaire. Sans crossOrigin : les <img> les
            chargent en non-CORS, la connexion préouverte est ainsi réutilisée. */}
        <link rel="preconnect" href="https://lh3.googleusercontent.com" />
        <link rel="preconnect" href="https://media.licdn.com" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        {/* Versions machine-readable de la marque, pour LLMs et outils tiers */}
        <link
          rel="alternate"
          type="application/json"
          href="/brand/tokens.json"
          title="Tech Speak'Her, design tokens"
        />
        <link
          rel="alternate"
          type="text/plain"
          href="/llms.txt"
          title="Tech Speak'Her, LLM index"
        />
        {/* Flux RSS des actualités — lecteurs RSS et automatisations (Zapier, LinkedIn…) */}
        <link
          rel="alternate"
          type="application/rss+xml"
          href="/feed.xml"
          title="Tech Speak'Her, Actualités"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-2 focus:left-2 focus:bg-cyan focus:text-navy focus:px-4 focus:py-2 focus:rounded-lg focus:font-semibold"
        >
          Aller au contenu principal
        </a>
        <SessionProvider>
          <Header />
          <main id="main-content" className="flex-1" role="main">
            {children}
          </main>
          <Footer />
        </SessionProvider>
        <Analytics />
      </body>
    </html>
  );
}
