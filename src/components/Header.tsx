"use client";

import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { navLinks, navRejoindre } from "@/constants/navigation";
import MenuNousRejoindre from "@/components/MenuNousRejoindre";
import SearchBar from "@/components/SearchBar";
import Button from "@/components/Button";

// Menu compte (Radix dropdown) rendu uniquement aux personnes connectées : on
// le charge à la demande pour que le chunk Radix ne parte pas dans le bundle
// des visiteurs anonymes (le gros du trafic public).
const AccountMenu = dynamic(() => import("@/components/AccountMenu"));

/** La porte magenta du tiroir (« Mon espace » connectée, « Rejoindre
 * l'annuaire » sinon) : une seule écriture du style, deux libellés. */
const porteCls =
  "block py-2.5 px-3 text-sm font-bold text-navy text-center rounded-xl bg-magenta transition-colors hover:bg-magenta-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white";

/** Rangée du tiroir : lien pleine largeur + chevron, style uniforme. */
function TiroirLien({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        onClick={onClick}
        className="flex min-h-[44px] items-center justify-between gap-3 py-2.5 px-3 text-sm font-medium text-white transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-navy-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-inset"
      >
        {children}
        <span aria-hidden="true" className="text-gray-light">
          ›
        </span>
      </Link>
    </li>
  );
}

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: session, status } = useSession();
  const authed = status === "authenticated";
  const user = session?.user;

  return (
    <header className="sticky top-0 z-50 bg-navy/95 backdrop-blur-sm border-b border-navy-lighter">
      <nav
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
        aria-label="Navigation principale"
      >
        <div className="flex items-center justify-between gap-2 h-16">
          {/* ☰ à GAUCHE (conception N1 §2.1) : le tiroir ouvre le SITE, un
              geste rare — la gauche est sa place, la droite reste à la
              recherche. Le « moi » a quitté le header : l'onglet Profil de la
              barre basse le porte. */}
          <button
            className="text-white p-2 -ml-2 xl:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            aria-label={mobileOpen ? "Fermer le menu" : "Ouvrir le menu"}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              {mobileOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>

          {/* Logo — lien vers l'accueil du SITE, sur toutes les tailles. */}
          <Link
            href="/"
            className="flex items-center gap-2 group mr-auto"
            aria-label="Tech Speak'Her, accueil"
          >

            <Image
              src="/logo-icon.webp"
              alt=""
              width={44}
              height={44}
              aria-hidden="true"
              priority
            />
            {/* Entre 1024 et 1280 px, le menu ordinateur prend toute la place :
                l'icône seule tient lieu de logo (le lien garde son nom
                accessible). Sur mobile, le nom reste (conception N1 §3). */}
            <span className="text-lg font-bold tracking-wider text-cyan lg:hidden xl:inline">
              TECH SPEAK&apos;HER
            </span>
          </Link>

          {/* Desktop Nav — à partir de `xl` seulement : entre 1024 et 1279 px,
              elle chevauchait le logo (2026-10-14). Le burger et la barre
              d'onglets partagent ce point de rupture (cf. globals.css). */}
          <div className="hidden xl:flex items-center gap-3">
            <ul className="flex items-center gap-3" role="list">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="whitespace-nowrap text-sm font-medium text-gray-light hover:text-cyan focus-visible:text-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-navy rounded transition-colors duration-200"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <MenuNousRejoindre />
              </li>
            </ul>
            <SearchBar />
            <span aria-hidden="true" className="h-5 w-px bg-navy-lighter" />
            {authed && user ? (
              <AccountMenu user={user} />
            ) : (
              <>
                <Link
                  href="/connexion"
                  className="text-sm font-medium text-cyan border border-cyan/40 rounded-full px-3 py-1.5 hover:bg-cyan/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-navy transition-colors whitespace-nowrap"
                >
                  Se connecter
                </Link>
                <Button href="/mon-espace" size="sm" className="whitespace-nowrap px-3!">
                  Rejoindre l&apos;annuaire
                </Button>
              </>
            )}
          </div>

          {/* Sous `xl` : la loupe, à droite. Entre `lg` et `xl`, le menu
              compte la rejoint : le burger a pris cette bande (#365), et sur
              le site public aucune barre d'onglets ne porte le compte. Sous
              `lg`, le tiroir garde « Mon espace » (conception N1 §2.2). */}
          <div className="flex items-center gap-3 xl:hidden">
            <SearchBar />
            {authed && user && (
              <div className="hidden lg:block">
                <AccountMenu user={user} />
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Tiroir mobile — LE SITE, RIEN QUE LE SITE (conception N1 §2.2,
          validée) : l'app vit dans la barre d'onglets, le « moi » (profil,
          réglages, déconnexion) sur l'onglet Profil. Seule l'entrée de
          session diffère : une visiteuse trouve ici « Rejoindre l'annuaire »
          et « Se connecter », faute de barre basse hors connexion. */}
      {mobileOpen && (
        <nav
          id="mobile-menu"
          className="xl:hidden bg-navy-light border-t border-navy-lighter"
          aria-label="Menu mobile"
        >
          <div className="px-4 py-3 space-y-4">
            {/* L'ENTRÉE, selon la session — la seule chose qui varie dans ce
                tiroir. Connectée : LA porte de retour vers l'app (finding de
                revue du lot N1 : sur une page du site public, la barre basse
                n'existe pas — sans cette porte, une connectée mobile restait
                coincée côté site). Une porte, jamais l'inventaire : le « moi »
                et les rôles vivent sur l'onglet Profil. Sous `lg` seulement :
                entre `lg` et `xl`, l'avatar de l'en-tête est déjà cette porte. */}
            {authed ? (
              <Link href="/mon-espace" className={`${porteCls} lg:hidden`} onClick={() => setMobileOpen(false)}>
                Mon espace
              </Link>
            ) : (
              <div className="flex flex-col gap-2">
                <Link href="/mon-espace" className={porteCls} onClick={() => setMobileOpen(false)}>
                  Rejoindre l&apos;annuaire
                </Link>
                <Link
                  href="/connexion"
                  className="block py-2.5 px-3 text-sm font-medium text-cyan rounded-xl bg-navy border border-cyan/40 transition-colors hover:bg-cyan/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
                  onClick={() => setMobileOpen(false)}
                >
                  Se connecter
                </Link>
              </div>
            )}

            <div>
              <span
                id="burger-site"
                className="block px-1 pb-1 text-[11px] font-bold uppercase tracking-wide text-gray-light"
              >
                Site
              </span>
              <ul
                className="rounded-xl bg-navy border border-navy-lighter divide-y divide-navy-lighter list-none"
                role="list"
                aria-labelledby="burger-site"
              >
                {/* L'accueil du site, en toutes lettres : sur mobile, seul le
                    logo y menait — un chemin implicite n'est pas un chemin. */}
                <TiroirLien href="/" onClick={() => setMobileOpen(false)}>
                  Accueil du site
                </TiroirLien>
                {navLinks.map((link) => (
                  <TiroirLien
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                  >
                    {link.label}
                  </TiroirLien>
                ))}
              </ul>
            </div>

            <div>
              <span
                id="burger-rejoindre"
                className="block px-1 pb-1 text-[11px] font-bold uppercase tracking-wide text-gray-light"
              >
                {navRejoindre.label}
              </span>
              <ul
                className="rounded-xl bg-navy border border-navy-lighter divide-y divide-navy-lighter list-none"
                role="list"
                aria-labelledby="burger-rejoindre"
              >
                {navRejoindre.links.map((link) => (
                  <TiroirLien
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                  >
                    {link.label}
                  </TiroirLien>
                ))}
              </ul>
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
