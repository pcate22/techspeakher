/**
 * En-tête de période COLLANT d'une liste chronologique (mois d'un agenda) :
 * reste visible en défilant, calé SOUS les deux barres collantes du site
 * (`top-barres`, cf. globals.css) — sans lui, les cartes ne portent que le
 * jour et, passé l'en-tête, on lit une date sans son mois. La bande va d'un
 * bord à l'autre de la colonne (`-mx-4 px-4`), sinon les cartes affleurent
 * sous un titre en l'air.
 *
 * Cette chaîne de classes vivait recopiée sur deux pages (agenda public, mon
 * agenda) : un composant, un seul endroit à ajuster — le fil connecté
 * (conception v2, lot N2) la reprendra. `as` suit la hiérarchie de la page
 * hôte (h2 sous le h1 d'une page, h3 sous un h2 de section) — le style, lui,
 * est le même partout.
 */
export default function EnTetePeriode({
  id,
  as: Heading = "h2",
  children,
}: {
  id: string;
  as?: "h2" | "h3";
  children: React.ReactNode;
}) {
  return (
    <Heading
      id={id}
      className="sticky top-barres z-20 -mx-4 border-b border-navy-lighter bg-navy px-4 py-2 text-sm font-bold uppercase tracking-wider text-gold"
    >
      {children}
    </Heading>
  );
}
