import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumb";

export const metadata: Metadata = {
  title: "Vérifie ta boîte mail | Tech Speak'Her",
  description: "Un lien de connexion t'a été envoyé.",
  robots: { index: false },
  alternates: { canonical: "/connexion/verifie" },
};

/**
 * Raccourcis vers les webmails les plus courants. La page ne connaît pas
 * l'adresse saisie (Auth.js redirige ici sans paramètre), donc on ne peut pas
 * deviner le fournisseur : on propose les principaux. Sur mobile, l'app native
 * du fournisseur intercepte le lien universel et ouvre la boîte de réception.
 */
const WEBMAILS = [
  { nom: "Gmail", url: "https://mail.google.com/mail/u/0/#inbox" },
  { nom: "Outlook", url: "https://outlook.live.com/mail/0/" },
  { nom: "Yahoo", url: "https://mail.yahoo.com/" },
  { nom: "iCloud", url: "https://www.icloud.com/mail/" },
] as const;

/** Page affichée après l'envoi d'un lien magique (pages.verifyRequest). */
export default function VerifieEmail() {
  return (
    <>
      <Breadcrumb
        items={[
          { label: "Accueil", href: "/" },
          { label: "Connexion", href: "/connexion" },
          { label: "Vérification" },
        ]}
      />
      <div className="py-20 px-4">
        <section
          aria-labelledby="verifie-title"
          className="max-w-md mx-auto bg-navy-light border border-navy-lighter rounded-xl p-8 text-center"
        >
          <p className="text-4xl mb-4" aria-hidden="true">
            📬
          </p>
          <h1 id="verifie-title" className="text-2xl font-bold mb-2">
            <span className="text-cyan">Vérifie ta boîte mail</span>
          </h1>
          <p className="text-sm text-gray-light">
            On vient de t&apos;envoyer un <strong>lien de connexion</strong>. Ouvre-le
            depuis cet appareil&nbsp;: un clic et tu es connectée, sans mot de passe.
          </p>
          <div className="mt-6">
            <p className="text-xs text-gray-light mb-3">Ouvre ta messagerie&nbsp;:</p>
            <ul className="flex flex-wrap justify-center gap-2">
              {WEBMAILS.map(({ nom, url }) => (
                <li key={nom}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-navy border border-cyan/40 text-cyan hover:border-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-navy transition-colors"
                  >
                    {nom}
                    <span className="sr-only"> (s&apos;ouvre dans un nouvel onglet)</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-gray-light mt-6">
            Pas de mail&nbsp;? Regarde dans les indésirables, ou
            <Link href="/connexion" className="text-cyan underline underline-offset-2 ml-1">
              redemande un lien
            </Link>
            .
          </p>
          <p className="mt-8">
            <Link
              href="/"
              className="text-sm text-cyan underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded"
            >
              ← Retour à l&apos;accueil
            </Link>
          </p>
        </section>
      </div>
    </>
  );
}
