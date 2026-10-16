"use client";

import { useRef, useState } from "react";
import type { Verbatim } from "@/types";
import {
  comportementDefilement,
  indexBorne,
  indexVisible,
} from "@/lib/carrousel";

/**
 * Les verbatims de la home, qu'on fait DÉFILER : une voix à la fois, celle des
 * personnes concernées.
 *
 * RIEN NE BOUGE TOUT SEUL (WCAG 2.2.2). Un défilement automatique volerait la
 * lecture d'une citation en cours — et une pause à trouver, c'est déjà un
 * problème pour qui lit lentement. C'est le visiteur qui avance.
 *
 * LE DÉFILEMENT NATIF PORTE TOUT. La piste est un conteneur qui défile
 * (`overflow-x` + `scroll-snap`) : le doigt le fait glisser, la molette aussi,
 * le clavier également puisqu'elle est atteignable par tabulation. On n'écrit
 * donc AUCUNE mathématique de glissement (contrairement à `RangeeGlissante`,
 * qui découvre une action cachée) : le navigateur le fait mieux, et sans
 * dépendre du doigt (WCAG 2.5.7 « mouvements de glissement »).
 *
 * CE QUE LE JS AJOUTE, et seulement ça : des flèches, des pastilles, et le fait
 * de DIRE où on en est.
 * - flèches et pastilles sont de vrais boutons, `aria-disabled` aux deux bords
 *   (un `disabled` sortirait du parcours clavier, cf. `RangeeGlissante`) ;
 * - la position est annoncée dans une région vivante : les commandes ne
 *   déplacent pas le focus, sans elle un lecteur d'écran ignorerait le
 *   changement ;
 * - le défilement animé se coupe sous `prefers-reduced-motion` (`lib/carrousel`),
 *   que `globals.css` ne couvre pas pour un conteneur piloté en JS.
 *
 * Sans JS, les huit citations restent dans le DOM et la piste reste défilable :
 * le bloc dégrade en liste horizontale, jamais en cadre vide.
 */
export default function CarrouselVerbatims({
  verbatims,
  libelle,
}: {
  verbatims: Verbatim[];
  /** Nom accessible de la piste : elle est annoncée avant son contenu. */
  libelle: string;
}) {
  const piste = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  // Le verbatim qu'un défilement animé est en train de rejoindre. Sans ce
  // repère, les positions TRAVERSÉES par l'animation seraient prises pour des
  // arrivées : la pastille reculerait d'un cran juste après le clic, et la
  // région vivante annoncerait « Verbatim 1 » avant « Verbatim 2 ».
  const cible = useRef<number | null>(null);
  const total = verbatims.length;

  const allerA = (vise: number) => {
    const borne = indexBorne(vise, total);
    setIndex(borne);
    cible.current = borne;
    const el = piste.current;
    if (!el) return;
    const gauche = borne * el.clientWidth;
    // Lu au moment du geste, pas au montage : le réglage système peut changer
    // pendant la visite.
    const behavior = comportementDefilement(
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
    );
    // jsdom (et de vieux navigateurs) n'implémentent pas `scrollTo` sur un
    // élément : on retombe sur la propriété, qui suffit à caler la piste.
    if (typeof el.scrollTo === "function") el.scrollTo({ left: gauche, behavior });
    else el.scrollLeft = gauche;
  };

  // Le doigt et la molette défilent SANS passer par nos boutons : les pastilles
  // suivent la piste, sinon elles désigneraient un verbatim qu'on ne voit plus.
  const surDefilement = () => {
    const el = piste.current;
    if (!el) return;
    const vu = indexVisible(el.scrollLeft, el.clientWidth, total);
    if (cible.current !== null) {
      if (vu !== cible.current) return; // encore en route, on ne dit rien
      cible.current = null; // arrivé : la piste reprend la parole
    }
    setIndex(vu);
  };

  // Poser le doigt ou la molette sur la piste ABANDONNE la consigne en cours :
  // une animation interrompue laisserait sinon les pastilles figées sur une
  // destination que plus personne ne rejoint.
  const reprendreLaMain = () => {
    cible.current = null;
  };

  if (total === 0) return null;

  const auPremier = index === 0;
  const auDernier = index === total - 1;
  const commandes = total > 1;

  return (
    <div className="mx-auto max-w-3xl">
      <div
        ref={piste}
        // Une zone qui défile doit défiler sans souris ni doigt : sans
        // `tabindex`, les verbatims suivants sont inatteignables au clavier.
        tabIndex={0}
        role="group"
        aria-label={libelle}
        onScroll={surDefilement}
        onPointerDown={reprendreLaMain}
        onWheel={reprendreLaMain}
        onKeyDown={(e) => {
          // Les flèches font avancer d'UN verbatim : le défilement natif au
          // clavier avance de quelques pixels, ce qui n'a pas de sens ici.
          if (e.key === "ArrowRight") {
            e.preventDefault();
            allerA(index + 1);
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            allerA(index - 1);
          }
        }}
        className="snap-x snap-mandatory overflow-x-auto rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-navy [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <ul role="list" className="flex list-none">
          {verbatims.map((v) => (
            <li key={v.auteur} className="w-full shrink-0 snap-center px-1">
              {/* Toutes les cartes ont la hauteur de la plus longue (une piste
                  qui change de hauteur ferait sauter la page à chaque
                  verbatim) : le contenu est donc CENTRÉ, sinon une citation
                  courte laisserait un trou de plusieurs centimètres entre elle
                  et sa signature sur téléphone. */}
              <figure className="flex h-full flex-col justify-center gap-6 rounded-2xl border border-navy-lighter bg-navy-light p-6 sm:p-8">
                <blockquote>
                  <p className="text-lg italic text-cyan sm:text-xl">
                    &laquo;&nbsp;{v.citation}&nbsp;&raquo;
                  </p>
                </blockquote>
                <figcaption>
                  <p className="font-bold text-magenta-light">{v.auteur}</p>
                  <p className="text-sm text-gray-light">{v.qualite}</p>
                  {v.role && <p className="text-sm text-gray-light">{v.role}</p>}
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </div>

      {commandes && (
        <div className="mt-6 flex items-center justify-center gap-2">
          {/* La position, dite : les commandes ne déplacent pas le focus, donc
              sans région vivante un lecteur d'écran ignorerait le changement.
              Inutile quand il n'y a qu'une citation : rien ne peut bouger. */}
          <p role="status" className="sr-only">
            Verbatim {index + 1} sur {total}
          </p>
          <FlecheDefilement
            libelle="Verbatim précédent"
            auBord={auPremier}
            onClick={() => allerA(index - 1)}
            direction="precedent"
          />
          <ul role="list" className="flex list-none items-center gap-1">
            {verbatims.map((v, i) => (
              <li key={v.auteur}>
                <button
                  type="button"
                  onClick={() => allerA(i)}
                  aria-current={i === index ? "true" : undefined}
                  // Cible de 24 × 44 px autour d'un point de 8 px : huit cibles
                  // de 44 px de large plus les deux flèches ne tiennent pas
                  // dans un écran de téléphone. C'est le minimum AA (WCAG 2.5.8,
                  // 24 × 24 avec l'espacement), et la fonction reste offerte en
                  // 44 px par les flèches, qui font exactement la même chose.
                  className="flex h-11 w-6 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded"
                >
                  <span
                    aria-hidden="true"
                    className={`block h-2 w-2 rounded-full transition-colors ${
                      i === index ? "bg-cyan" : "bg-silver"
                    }`}
                  />
                  <span className="sr-only">
                    Verbatim {i + 1} sur {total}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <FlecheDefilement
            libelle="Verbatim suivant"
            auBord={auDernier}
            onClick={() => allerA(index + 1)}
            direction="suivant"
          />
        </div>
      )}
    </div>
  );
}

/** Une flèche du carrousel : bouton plein, cible 44 px, jamais `disabled`. */
function FlecheDefilement({
  libelle,
  auBord,
  onClick,
  direction,
}: {
  libelle: string;
  auBord: boolean;
  onClick: () => void;
  direction: "precedent" | "suivant";
}) {
  return (
    <button
      type="button"
      aria-label={libelle}
      // `aria-disabled` et non `disabled` : un bouton désactivé sort du parcours
      // clavier, donc disparaît au lecteur d'écran.
      aria-disabled={auBord}
      onClick={() => {
        if (!auBord) onClick();
      }}
      className={`flex h-11 w-11 items-center justify-center rounded-full border border-field-border text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan ${
        auBord ? "opacity-50" : "hover:border-cyan hover:text-cyan"
      }`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
      >
        {direction === "precedent" ? (
          <polyline points="15 18 9 12 15 6" />
        ) : (
          <polyline points="9 18 15 12 9 6" />
        )}
      </svg>
    </button>
  );
}
