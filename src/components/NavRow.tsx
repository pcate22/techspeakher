import type { ReactNode } from "react";
import Link from "next/link";

/**
 * Ligne cliquable MUTUALISÉE (hub, pages liste) : un élément de tête optionnel
 * (compteur, miniature), un titre, un sous-titre, des badges, un chevron › vers sa
 * page. Remplace les `<Link className="flex …">` recopiés partout.
 *
 * Composant **partagé** (server-safe) : `ParticipantesNav` (client) doit
 * pouvoir le rendre.
 *
 * A11y (RGAA) :
 * - les badges symboliques sont `aria-hidden` ; leur sens passe par
 *   `badgesLabel` (équivalent textuel `sr-only`) ;
 * - `flag` ne fait que COLORER le sous-titre (état « à traiter ») : l'info doit
 *   déjà être portée par le texte du `subtitle`, jamais par la couleur seule.
 */
export default function NavRow({
  href,
  leading,
  title,
  subtitle,
  pastilles,
  badges,
  badgesLabel,
  flag,
  tone,
  titleClamp = 2,
  trailing,
}: {
  href: string;
  leading?: ReactNode;
  title: string;
  subtitle?: ReactNode;
  /** Étiquettes de CLASSEMENT (phase, nature…), sous le titre et sur leur propre
   * ligne. Elles ne vont pas dans `subtitle` : un enfant `inline-block` casse le
   * `line-clamp` du sous-titre, qui peut alors grandir sans fin. `aria-hidden`
   * comme `badges` — leur sens passe par `badgesLabel`. */
  pastilles?: string[];
  badges?: string[];
  badgesLabel?: string;
  flag?: boolean;
  /** « danger » : rangée menant à une action destructive (titre orange),
   * pour la distinguer des rangées fonctionnelles d'un sommaire. */
  tone?: "danger";
  /** Nombre de lignes du titre avant coupure : **2 (défaut)** = deux lignes
   * (`line-clamp-2`) ; « none » = jamais tronqué (le titre s'affiche en
   * entier).
   *
   * La règle : **on tronque une donnée (un nom, un sujet de talk), jamais une
   * destination.** Qui ne peut pas deviner la fin d'un intitulé ne peut pas
   * choisir où aller — le défaut d'une ligne coupait « Ateliers du tremplin
   * en cours » en « Ateliers du tremplin en c… » sur un téléphone
   * (accessibilité cognitive, relecture du 2026-08-16 ;
   * `docs/conception-profil-et-a-faire.md` §5 P2).
   *
   * La coupure à UNE ligne a ensuite été retirée : elle était l'exception que
   * la règle prévoyait, mais AUCUNE rangée du produit ne s'en servait — elle
   * ne subsistait que comme invitation à recommencer. Une rangée de navigation
   * dont l'intitulé dépasse deux lignes prend « none ». */
  titleClamp?: 2 | "none";
  /** Bloc de droite (date d'un rappel, heure…), rendu avant le chevron. */
  trailing?: ReactNode;
}) {
  const clampClass = titleClamp === 2 ? "line-clamp-2" : "";
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 rounded-xl border border-navy-lighter bg-navy px-4 py-3 hover:border-cyan/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan transition-colors"
    >
      {leading != null && <span className="shrink-0">{leading}</span>}
      <span className="min-w-0 flex-1">
        <span className={`block font-medium ${clampClass} ${tone === "danger" ? "text-orange" : ""}`}>{title}</span>
        {pastilles && pastilles.length > 0 && (
          <span className="mt-1 flex flex-wrap gap-1" aria-hidden="true">
            {pastilles.map((p) => (
              <span
                key={p}
                className="rounded border border-field-border px-1.5 text-xs leading-5 text-gray-light"
              >
                {p}
              </span>
            ))}
          </span>
        )}
        {subtitle && (
          <span className={`block text-xs line-clamp-2 ${flag ? "text-orange" : "text-gray-light"}`}>
            {subtitle}
          </span>
        )}
        {badgesLabel && <span className="sr-only">{badgesLabel}</span>}
      </span>
      <span className="flex shrink-0 items-center gap-1 text-xs">
        {trailing != null && <span className="text-right">{trailing}</span>}
        {badges && badges.length > 0 && (
          <span className="flex items-center gap-1" aria-hidden="true">
            {badges.map((b) => (
              <span key={b}>{b}</span>
            ))}
          </span>
        )}
        {/* Même chevron que le tiroir du burger : un seul langage d'affordance
            de navigation sur toute la plateforme. */}
        <span className="text-gray-light text-base ml-1" aria-hidden="true">
          ›
        </span>
      </span>
    </Link>
  );
}
