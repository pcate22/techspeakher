"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Button from "@/components/Button";
import FeuilleCreer from "@/components/FeuilleCreer";
import { entreeCourante, marqueCourante, nomAvecPoint, type EntreeNav } from "@/lib/entree-courante";
import type { FeuilleDonnees } from "@/lib/feuille-creer";
import { gestePrincipal } from "@/lib/gestes-creation";

type Entree = EntreeNav & {
  label: string;
  /** Le point de « À faire » : même contrat que la barre basse. */
  point?: boolean;
};

const entreeCls = (courante: boolean) =>
  `flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan ${
    courante ? "bg-navy-lighter font-bold text-cyan" : "text-gray-light hover:bg-navy-light hover:text-white"
  }`;

/**
 * Le rail de l'espace connecté sur grand écran (refonte de la navigation
 * connectée, maquette validée le 2026-10-15). Avant lui, la barre basse était
 * masquée sur grand écran et RIEN ne la remplaçait : l'espace n'avait sur bureau
 * aucune navigation propre, seulement le menu du compte.
 *
 * Les MÊMES destinations que la barre basse (et la même règle de « vous êtes
 * ici », `entreeCourante`), dans la forme d'un grand écran :
 * - le geste n° 1 en tête, en bouton secondaire : « Ajouter un talk » (le
 *   même que la feuille ➕, `gestePrincipal`), effacé sur sa propre page et
 *   sans fiche ;
 * - « Ma fiche » en première destination ; ses talks s'y rangent ;
 * - Messages en plus (la barre basse l'a cédé à « À faire » faute de place) ;
 * - « Créer » ouvre la même feuille que le ➕ ;
 * - un groupe « Organisation » pour les seules orgas : sur bureau la place
 *   existe, le tap de plus payé sur mobile n'a pas lieu d'être ici ;
 * - « Mon profil » est le repli du reste du « moi » (coaching, connexions,
 *   tremplin…), comme on y entre depuis lui.
 *
 * Il paraît au MÊME seuil que la navigation de bureau de l'en-tête et que la
 * disparition de la barre basse (`xl`, 1 280 px, depuis le correctif de
 * l'en-tête entre 1 024 et 1 279 px) : jamais les deux à la fois.
 *
 * Collant sous l'en-tête (`top-16`, hauteur de `Header`), dans le flux : il ne
 * recouvre jamais le pied de page.
 */
export default function RailEspace({
  feuille,
  attend = false,
}: {
  feuille: FeuilleDonnees;
  attend?: boolean;
}) {
  const pathname = usePathname();

  const principales: Entree[] = [
    // Les talks se rangent sous la fiche, dont ils sont une section. Sans
    // fiche possible (`creation: null`, ou repli de panne), aucune entrée
    // « Ma fiche » : elle mènerait à un assistant que la personne ne peut pas
    // remplir, ou à une page qui tomberait sur la même panne.
    ...(feuille.creation === null
      ? []
      : [{ href: "/mon-espace/fiche", label: "Ma fiche", prefixes: ["/mon-espace/talks"] }]),
    { href: "/mon-espace", label: "Accueil", exact: true },
    { href: "/mon-espace/agenda", label: "Agenda" },
    { href: "/mon-espace/a-faire", label: "À faire", point: attend },
    { href: "/mon-espace/messages", label: "Messages" },
  ];
  const organisation: Entree[] = feuille.orga
    ? [
        { href: "/admin/speakeuses", label: "Speakeuses" },
        { href: "/admin/conferences", label: "Conférences" },
        { href: "/admin/tremplins", label: "Tremplins" },
        { href: "/admin", label: "Espace organisatrices" },
      ]
    : [];
  const moi: Entree[] = [
    { href: "/mon-espace/profil", label: "Mon profil", prefixes: ["/mon-espace"] },
    { href: "/mon-espace/reglages", label: "Réglages" },
  ];
  const actif = entreeCourante(pathname, [...principales, ...organisation, ...moi]);

  const rendu = (e: Entree) => (
    <li key={e.href}>
      <Link
        href={e.href}
        aria-current={marqueCourante(e, actif, pathname)}
        aria-label={nomAvecPoint(e.label, e.point)}
        className={entreeCls(actif === e)}
      >
        {e.label}
        {e.point && (
          <span aria-hidden="true" className="ml-auto h-2 w-2 rounded-full bg-cyan" />
        )}
      </Link>
    </li>
  );

  // Le bouton de tête s'efface sur la page où il mène (un CTA par écran) et
  // sans fiche : il mènerait là où mène déjà « Ma fiche », juste dessous.
  const gesteBrut = gestePrincipal(feuille.creation);
  const geste =
    gesteBrut && feuille.creation === "talk" && pathname !== gesteBrut.href ? gesteBrut : null;

  return (
    // Un <div>, pas un <aside> : un repère « complémentaire » de plus autour
    // du <nav>, et niché dans <main> (axe landmark-complementary-is-top-level).
    <div className="hidden w-60 shrink-0 border-r border-navy-lighter xl:order-first xl:block">
      <nav
        aria-label="Mon espace"
        className="sticky top-16 max-h-[calc(100vh-4rem)] overflow-y-auto px-3 py-6"
      >
        {geste && (
          // Secondaire : la page affichée garde SON action principale.
          <Button href={geste.href} variant="secondary" size="sm" className="mb-4 w-full">
            {geste.label}
          </Button>
        )}
        <ul role="list" className="flex list-none flex-col gap-0.5">
          {principales.map(rendu)}
          <li>
            <FeuilleCreer donnees={feuille} declencheurClassName={`${entreeCls(false)} w-full`} />
          </li>
        </ul>

        {organisation.length > 0 && (
          <div role="group" aria-labelledby="rail-organisation" className="mt-6">
            <p
              id="rail-organisation"
              className="px-3 pb-1 text-sm font-bold text-gray-light"
            >
              Organisation
            </p>
            <ul role="list" className="flex list-none flex-col gap-0.5">
              {organisation.map(rendu)}
            </ul>
          </div>
        )}

        <ul role="list" className="mt-6 flex list-none flex-col gap-0.5 border-t border-navy-lighter pt-4">
          {moi.map(rendu)}
        </ul>
      </nav>
    </div>
  );
}
