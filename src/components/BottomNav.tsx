"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import Avatar from "@/components/Avatar";
import FeuilleCreer from "@/components/FeuilleCreer";
import { ONGLET_BARRE } from "@/components/onglet-barre";
import { IconeAccueil, IconeAgenda, IconeAFaire } from "@/components/icons/icones-barre";
import { entreeCourante, marqueCourante, nomAvecPoint, type EntreeNav } from "@/lib/entree-courante";
import type { FeuilleDonnees } from "@/lib/feuille-creer";

type Onglet = EntreeNav & {
  label: string;
  icone?: ReactNode;
  /** Le POINT de « À faire » (D3) : quelque chose que la personne peut
   * refermer attend. Il entre dans le nom accessible — jamais une couleur
   * seule — et disparaît ENTIÈREMENT à zéro. */
  point?: boolean;
};

/**
 * La barre d'onglets basse CANONIQUE (conception N1 §2.3, révisée à l'étape
 * B) : `Accueil · Agenda · ➕ · À faire · [ma photo]` — LA MÊME pour tous les
 * rôles, la stabilité de la barre est l'identité du produit.
 *
 * L'onglet 4 était « Messages » : une boîte ouverte pour rien la plupart des
 * jours. « À faire » porte les notifications de la plateforme — et les
 * messages restent atteignables par la rangée « Mes messages » du profil,
 * livrée AVANT ce changement précisément pour ça (D6).
 * Le travail de rôle (orga, coach, participante) vit en rangées sur la page
 * « Mon profil » : ~3 orgas paient un tap de plus pour que ~200 membres
 * aient une app canonique.
 *
 * L'onglet 5 est la PHOTO de la personne (patron Instagram), libellé visible
 * « Ma fiche », et il mène À LA FICHE depuis le 2026-10-15 (refonte de la
 * navigation connectée) : mettre sa fiche à jour est LE geste du produit, il
 * coûtait l'onglet Profil puis une rangée à trouver. « Mon profil » (messages,
 * réglages, portes de rôle) s'atteint par la fiche (fil d'Ariane, rangée) et
 * par le menu du compte. L'onglet ne s'allume que sur la fiche et les talks :
 * ailleurs, aucun onglet n'est vrai, et la barre n'en allume aucun (décision
 * de Cateline du 2026-10-15, qui remplace le repli de l'audit C5). Sur grand
 * écran, c'est le rail (`RailEspace`) qui porte la navigation, avec la MÊME
 * règle (`entreeCourante`), et il a une entrée exacte pour chaque page.
 *
 * RGAA : landmark nav nommé, libellés VISIBLES (jamais l'icône seule),
 * `aria-current` sur le SEUL onglet le plus spécifique (`page` quand son lien
 * mène bien à la page affichée, `true` quand il n'en est que le repli), cibles
 * ≥ 44 px, safe-area iOS. `data-bottom-nav` pilote le dégagement du footer
 * (globals.css, WCAG 2.4.11).
 */
export default function BottomNav({
  nom,
  image,
  feuille,
  attend = false,
}: {
  nom: string;
  image: string | null;
  feuille: FeuilleDonnees;
  /** Quelque chose que la personne connectée peut refermer attend dans « À
   * faire » (`desTachesAttendent`, calculé par `NavEspaceServeur`). */
  attend?: boolean;
}) {
  const pathname = usePathname();

  const onglets: Onglet[] = [
    { href: "/mon-espace", label: "Accueil", icone: <IconeAccueil />, exact: true },
    { href: "/mon-espace/agenda", label: "Agenda", icone: <IconeAgenda /> },
    { href: "/mon-espace/a-faire", label: "À faire", icone: <IconeAFaire />, point: attend },
    // « Ma fiche » ne s'allume QUE sur la fiche (et ses sections) et les
    // talks, qui en sont une partie — tranché par Cateline le 2026-10-15.
    // Ailleurs (réglages, messages, /admin…), rien ne s'allume : le possessif
    // doit être vrai, et aucun onglet ne l'est là. Sans fiche possible
    // (`creation: null` : genre « homme », ou repli de panne de
    // `NavEspaceServeur`), l'onglet garde la photo mais mène et se nomme là où
    // la personne a quelque chose ; « Mon profil » rallume alors tout le
    // « moi », où ce nom reste juste.
    feuille.creation === null
      ? { href: "/mon-espace/profil", label: "Mon profil", prefixes: ["/mon-espace", "/admin"] }
      : { href: "/mon-espace/fiche", label: "Ma fiche", prefixes: ["/mon-espace/talks"] },
  ];

  const actif = entreeCourante(pathname, onglets);

  const ongletCls = (courant: boolean) =>
    `${ONGLET_BARRE} ${courant ? "font-bold text-cyan" : "text-gray-light"}`;

  const rendu = (o: Onglet) => (
    <Link
      href={o.href}
      aria-current={marqueCourante(o, actif, pathname)}
      // Le point entre dans le NOM, libellé visible EN TÊTE (WCAG 2.5.3 :
      // « cliquer À faire » à la voix continue de marcher) ; à zéro, RIEN —
      // le nom redevient le libellé seul.
      aria-label={nomAvecPoint(o.label, o.point)}
      className={ongletCls(actif === o)}
    >
      {o.icone ? (
        <span aria-hidden="true" className="relative leading-none">
          {o.icone}
          {o.point && (
            // DANS la boîte de l'onglet (R6) : ancré au pictogramme, aucun
            // décalage qui franchirait le bord du <nav> — `--hauteur-onglets`
            // reste la source unique du dégagement du pied (WCAG 2.4.11).
            // `aria-hidden` : son sens passe par le nom du lien. Le contraste
            // cyan sur navy-light tient très au-delà de 3:1 (1.4.11).
            <span
              data-testid="point-onglet"
              aria-hidden="true"
              className="absolute -right-1.5 top-0 h-2 w-2 rounded-full bg-cyan ring-2 ring-navy-light"
            />
          )}
        </span>
      ) : (
        // L'onglet-photo : l'avatar est décoratif, le libellé visible porte
        // le nom accessible (RGAA — jamais l'image seule).
        <span aria-hidden="true" className={actif === o ? "rounded-full ring-2 ring-cyan" : ""}>
          <Avatar name={nom} image={image} size="xxs" />
        </span>
      )}
      {o.label}
    </Link>
  );

  return (
    <nav
      aria-label="Mon espace"
      data-bottom-nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-navy-lighter bg-navy-light pb-[env(safe-area-inset-bottom)] xl:hidden"
    >
      <ul role="list" className="flex list-none">
        <li className="flex-1">{rendu(onglets[0])}</li>
        <li className="flex-1">{rendu(onglets[1])}</li>
        <li className="flex-1">
          <FeuilleCreer donnees={feuille} />
        </li>
        <li className="flex-1">{rendu(onglets[2])}</li>
        <li className="flex-1">{rendu(onglets[3])}</li>
      </ul>
    </nav>
  );
}
