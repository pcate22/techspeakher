export const navLinks = [
  // « À propos » vit au pied de page (2026-10-15) : une page qu'on lit une
  // fois, pas un lieu où l'on revient. L'en-tête garde sa place pour l'usage.
  { href: "/speakeuses", label: "Speakeuses" },
  // L'agenda suit l'annuaire : même matière (les talks des speakeuses), lue en
  // travers — l'annuaire dit qui parle de quoi, l'agenda dit quand et où.
  { href: "/agenda", label: "Agenda" },
  { href: "/tremplin", label: "Tremplin" },
  { href: "/actualites", label: "Actualités" },
];

/**
 * Les façons de s'engager, sous UN menu déroulant (2026-10-15) : le header
 * portait « Partenaires » et « Adhérer » côte à côte, et rien pour les
 * bénévoles. Chaque entrée a sa phrase : on choisit son chemin sans deviner ce
 * que cache un mot. « Devenir partenaire » reprend le mot de la page d'arrivée
 * et du pied de page (revue UX du 2026-10-15).
 */
export const navRejoindre = {
  label: "Nous rejoindre",
  links: [
    { href: "/adherer", label: "Adhérer", detail: "10\u00A0€ par an, ou gratuit selon votre situation" },
    { href: "/benevole", label: "Devenir bénévole", detail: "Coacher, faire partie du jury, organiser" },
    { href: "/partenaires", label: "Devenir partenaire", detail: "Pour les entreprises et les structures" },
  ],
};

/** Tout ce que le header mène, premier niveau et menu confondus. */
export const tousLesLiensNav = [...navLinks, ...navRejoindre.links];
