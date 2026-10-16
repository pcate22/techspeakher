"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { navRejoindre } from "@/constants/navigation";

/**
 * Menu déroulant « Nous rejoindre » du header (ordinateur). Patron
 * « disclosure » plutôt que `role="menu"` : ce sont des liens de navigation,
 * que le clavier parcourt avec Tab. Échap et un clic ailleurs le referment ;
 * Échap rend le focus au bouton.
 */
export default function MenuNousRejoindre() {
  const [ouvert, setOuvert] = useState(false);
  const racine = useRef<HTMLDivElement>(null);
  const bouton = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!ouvert) return;
    const surClic = (e: MouseEvent) => {
      if (!racine.current?.contains(e.target as Node)) setOuvert(false);
    };
    const surTouche = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOuvert(false);
      bouton.current?.focus();
    };
    // Le focus qui sort au clavier (Tab après le dernier lien) referme aussi :
    // sinon le panneau resterait ouvert par-dessus la page (WCAG 2.4.3).
    const surFocus = (e: FocusEvent) => {
      if (!racine.current?.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener("mousedown", surClic);
    document.addEventListener("keydown", surTouche);
    document.addEventListener("focusin", surFocus);
    return () => {
      document.removeEventListener("mousedown", surClic);
      document.removeEventListener("keydown", surTouche);
      document.removeEventListener("focusin", surFocus);
    };
  }, [ouvert]);

  return (
    <div ref={racine} className="relative">
      <button
        ref={bouton}
        type="button"
        aria-expanded={ouvert}
        aria-controls={id}
        onClick={() => setOuvert((o) => !o)}
        className="inline-flex min-h-[44px] items-center gap-1 whitespace-nowrap text-sm font-medium text-gray-light hover:text-cyan focus-visible:text-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-navy rounded transition-colors duration-200"
      >
        {navRejoindre.label}
        <svg
          className={`w-4 h-4 transition-transform ${ouvert ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {ouvert && (
        <ul
          id={id}
          role="list"
          className="absolute right-0 z-50 mt-1 w-72 rounded-xl bg-navy-light border border-navy-lighter shadow-lg p-2 list-none"
        >
          {navRejoindre.links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                onClick={() => setOuvert(false)}
                className="block rounded-lg px-3 py-2.5 hover:bg-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
              >
                <span className="block text-sm font-semibold text-white">{l.label}</span>
                <span className="block text-xs text-gray-light mt-0.5">{l.detail}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
