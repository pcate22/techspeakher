"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import LinkedInIcon from "@/components/icons/LinkedInIcon";
import YouTubeIcon from "@/components/icons/YouTubeIcon";
import ExternalLink from "@/components/ExternalLink";
import Button from "@/components/Button";
import { NOM_AFFICHE } from "@/data/association";
import { HELLOASSO_SOUTIEN_URL, LINKEDIN_URL, YOUTUBE_URL } from "@/constants/site";

// Liens du footer, listes explicites (jamais dérivées de `navLinks` : le footer
// a son propre ordre et ses entrées dédiées). Deux groupes, pour une lecture en
// colonnes claire (patron inspiré du footer DevFest Toulouse).
const siteLinks = [
  { href: "/a-propos", label: "À propos" },
  { href: "/speakeuses", label: "Annuaire speakeuses" },
  { href: "/agenda", label: "Agenda des speakeuses" },
  { href: "/tremplin", label: "Tremplin" },
  { href: "/devfest-toulouse", label: "DevFest Toulouse" },
  { href: "/conferences", label: "Conférences & associations" },
  { href: "/actualites", label: "Actualités" },
];

// Nos soutiens comptent autant que nos pages : ils ont leur colonne. Le kit
// de communication y vit parce qu'il sert d'abord aux partenaires.
const soutienLinks = [
  { href: "/partenaires", label: "Devenir partenaire" },
  { href: HELLOASSO_SOUTIEN_URL, label: "Soutenir sur HelloAsso", externe: true },
  { href: "/adherer", label: "Adhérer" },
  { href: "/benevole", label: "Devenir bénévole" },
  { href: "/kit-de-communication", label: "Kit de communication" },
];

const infoLinks = [
  { href: "/contact", label: "Contact" },
  { href: "/code-de-conduite", label: "Code de conduite" },
];

const linkClass =
  "text-sm text-gray-light hover:text-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded transition-colors";

const reseauClass = `inline-flex items-center gap-2 ${linkClass}`;

/** Colonne de liens du footer : un titre (repère navigable) + sa liste. */
function FooterColumn({
  id,
  title,
  links,
}: {
  id: string;
  title: string;
  links: { href: string; label: string; externe?: boolean }[];
}) {
  return (
    <div>
      <h2
        id={id}
        className="text-sm font-bold text-white mb-3"
      >
        {title}
      </h2>
      <ul className="space-y-2 list-none" role="list" aria-labelledby={id}>
        {links.map((link) => (
          <li key={link.href}>
            {link.externe ? (
              <ExternalLink href={link.href} className={linkClass}>
                {link.label}
              </ExternalLink>
            ) : (
              <Link href={link.href} className={linkClass}>
                {link.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** La coquille d'APP (espace connecté) : elle a déjà une barre d'onglets et un
 * burger dont le seul rôle est d'aller au site. */
function dansLApp(chemin: string): boolean {
  return (
    chemin === "/mon-espace" ||
    chemin.startsWith("/mon-espace/") ||
    chemin === "/admin" ||
    chemin.startsWith("/admin/")
  );
}

/**
 * Pied de page. **Client** — comme `Header`, et pour la même raison : il doit
 * connaître la route. Le layout racine, lui, ne la connaît pas.
 *
 * Deux variantes (audit 2026-08-15, C10). Sur le SITE, le pied complet. Dans
 * la coquille d'app, une ligne : ~17 liens y occupaient environ un tiers de la
 * hauteur d'un téléphone, entre « Se déconnecter » et la barre d'onglets,
 * alors que le burger porte déjà les mêmes destinations.
 *
 * On RETIRE, on ne masque pas : `hidden`/`sr-only` laisserait treize liens
 * dans le parcours de tabulation, hors écran — l'erreur « masqué à l'œil,
 * gardé au clavier » du registre.
 *
 * Ce que la variante courte GARDE, et pourquoi : le burger ne porte que
 * `navLinks` et `navRejoindre` (et l'accueil). Tout le reste du pied long n'a
 * donc aucune autre porte depuis l'espace connecté : le tableau ci-dessous
 * fait le compte, à retenir à chaque lien qui quitte la nav (relectures du
 * 2026-08-16 et du 2026-10-15).
 *
 * | Destination | Sort |
 * |---|---|
 * | Mentions légales, Code de conduite | **gardées** — obligation légale et règle de la communauté |
 * | Partenaires (« Devenir sponsor ») | **gardée** — la porte de financement de l'asso, sinon injoignable depuis l'app |
 * | Contact | **gardée** depuis le 2026-10-15 — elle a quitté `navLinks` (donc le burger) au profit de « Partenaires » |
 * | À propos | **gardée** depuis le 2026-10-15 — même raison : elle a quitté `navLinks` |
 * | Conférences & assos, DevFest Toulouse, flux RSS, LinkedIn, YouTube | partent : de la découverte, qu'on retrouve depuis le site |
 */
export default function Footer() {
  const court = dansLApp(usePathname() ?? "/");

  if (court) {
    return (
      <footer className="bg-navy border-t border-navy-lighter mt-auto" role="contentinfo">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-gray-light">
          {/* Une seule chaîne : l'année et le nom ne dépendent d'aucun blanc
              entre deux nœuds de texte (« © 2026Tech » vu en prod, 15/10). */}
          <p>{`© ${new Date().getFullYear()}\u00A0${NOM_AFFICHE}`}</p>
          <span aria-hidden="true">·</span>
          <Link href="/mentions-legales" className={linkClass}>
            Mentions légales
          </Link>
          <span aria-hidden="true">·</span>
          <Link href="/contact" className={linkClass}>
            Contact
          </Link>
          <span aria-hidden="true">·</span>
          <Link href="/code-de-conduite" className={linkClass}>
            Code de conduite
          </Link>
          <span aria-hidden="true">·</span>
          <Link href="/partenaires" className={linkClass}>
            Partenaires
          </Link>
          <span aria-hidden="true">·</span>
          <Link href="/a-propos" className={linkClass}>
            À propos
          </Link>
        </div>
      </footer>
    );
  }

  return (
    <footer className="bg-navy border-t border-navy-lighter mt-auto" role="contentinfo">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-8">
          {/* Marque + appels à l'action */}
          <div>
            <Image
              src="/logo-full.webp"
              alt="Tech Speak'Her"
              width={120}
              height={120}
              className="mb-4"
            />
            <p className="text-gray-light text-sm leading-relaxed">
              Une communauté de femmes de la tech pour oser passer de la
              salle… à la scène&nbsp;!
            </p>
            <p className="text-gray-light text-sm mt-3">Association loi 1901.</p>
            <div className="mt-5 flex flex-col items-start gap-2">
              <Button href="/partenaires" size="sm">
                Devenir partenaire
              </Button>
              <Button href="/contact" variant="secondary" size="sm">
                Nous contacter
              </Button>
            </div>
          </div>

          {/* Le site */}
          <FooterColumn id="footer-site" title="Le site" links={siteLinks} />

          {/* Nous soutenir */}
          <FooterColumn id="footer-soutien" title="Nous soutenir" links={soutienLinks} />

          {/* Infos */}
          <FooterColumn id="footer-infos" title="Infos" links={infoLinks} />

          {/* Suivez-nous */}
          <div>
            <h2 className="text-sm font-bold text-white mb-3">
              Suivez-nous
            </h2>
            {/* Colonne : un réseau par ligne, l'icône reste alignée au libellé. */}
            <div className="flex flex-col items-start gap-3">
              <ExternalLink href={LINKEDIN_URL} className={reseauClass}>
                <LinkedInIcon className="w-5 h-5" />
                LinkedIn
              </ExternalLink>
              <ExternalLink href={YOUTUBE_URL} className={reseauClass}>
                <YouTubeIcon className="w-5 h-5" />
                YouTube
              </ExternalLink>
              <a href="/feed.xml" className={linkClass}>
                Flux RSS des actualités
              </a>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-navy-lighter flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-light">
          <p>
            {`© ${new Date().getFullYear()}\u00A0${NOM_AFFICHE} · Association loi\u00A01901`}
          </p>
          <Link
            href="/mentions-legales"
            className="hover:text-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded transition-colors"
          >
            Mentions légales
          </Link>
        </div>
      </div>
    </footer>
  );
}
