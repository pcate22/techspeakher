"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ONGLET_BARRE } from "@/components/onglet-barre";
import { hrefCreerAtelier } from "@/lib/creer-atelier";
import type { FeuilleDonnees } from "@/lib/feuille-creer";
import { gestePrincipal, hrefDateTalk } from "@/lib/gestes-creation";

/** Lien-entrée de la feuille : pleine largeur, cible ≥ 44 px. */
const entreeCls =
  "flex min-h-[48px] items-center gap-3 rounded-xl border border-navy-lighter px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-navy-lighter focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan";

/**
 * La feuille ➕ « Créer » (conception N1 §2.4, validée) — le bouton central de
 * la barre. Elle RACCOURCIT vers les formulaires existants, elle n'en invente
 * aucun : talk (ou fiche, le vrai premier pas d'un compte qui n'en a pas) ;
 * une orga gagne actualité et atelier. L'atelier se crée dans le tremplin en
 * cours ; PLUSIEURS éditions actives → la feuille glisse vers un choix
 * d'édition avant le formulaire (tranché le 2026-08-07). « Ajouter une date
 * à un talk » (2026-10-15) mène à la fenêtre de date du talk sur la fiche — un talk
 * retenu à une nouvelle conférence est la mise à jour la plus fréquente, et
 * elle obligeait à ouvrir le talk ; plusieurs talks → choix du talk d'abord.
 * « Écrire un article » est là pour TOUTE membre (lot N3). « Demander de
 * l'aide » arrivera au lot N5.
 *
 * Deux déclencheurs pour UNE feuille : l'onglet central de la barre basse
 * (mobile) et l'entrée « Créer » du rail (bureau).
 *
 * <dialog> natif (focus piégé, Échap) ; le contenu est monté seulement
 * ouvert, l'état React suit l'événement `close` natif. Clic sur le fond =
 * fermer.
 */
/** Où en est la feuille : ses entrées, ou un choix intercalé avant le lien. */
type Etape = "entrees" | "atelier" | "talk";

// Insécables avant « : » et « ? » (typographie du dépôt) — écrites en
// échappement pour qu'elles se voient à la relecture.
const TITRES: Record<Etape, string> = {
  entrees: "Créer",
  atelier: "Ajouter un atelier\u00a0: dans quel tremplin\u00a0?",
  talk: "Ajouter une date\u00a0: sur quel talk\u00a0?",
};

export default function FeuilleCreer({
  donnees,
  declencheurClassName,
}: {
  donnees: FeuilleDonnees;
  /** Habillage du déclencheur hors barre basse (le rail) : la feuille reste
   * la même, seul le bouton change de forme. */
  declencheurClassName?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [ouverte, setOuverte] = useState(false);
  const [etape, setEtape] = useState<Etape>("entrees");
  const titreRef = useRef<HTMLHeadingElement>(null);
  // Changer d'étape démonte le bouton qui portait le focus : il tombait sur
  // <body>, et le nouveau titre restait muet (WCAG 2.4.3, 4.1.3 — revue RGAA
  // du 2026-10-15). Le focus va au titre de l'étape, qui s'annonce.
  const etapePrecedente = useRef<Etape>("entrees");
  useEffect(() => {
    if (ouverte && etape !== etapePrecedente.current) titreRef.current?.focus();
    etapePrecedente.current = etape;
  }, [etape, ouverte]);

  const ouvrir = () => {
    // Remis à zéro AVEC l'étape : rouverte après une fermeture sur une étape
    // intermédiaire, la feuille ne doit pas prendre l'ouverture pour un
    // changement d'étape.
    etapePrecedente.current = "entrees";
    setEtape("entrees");
    setOuverte(true);
    dialogRef.current?.showModal();
  };
  const fermer = () => {
    dialogRef.current?.close();
    // jsdom : close() polyfillé ne déclenche pas l'événement `close`.
    setOuverte(false);
  };

  // `editions` est déjà vide hors rôle orga (contrat de getFeuilleDonnees).
  const atelier = donnees.editions.length > 0 ? donnees.editions : null;
  const talks = donnees.talks;
  const geste = gestePrincipal(donnees.creation);

  const retour = (
    <button
      type="button"
      onClick={() => setEtape("entrees")}
      className={`${entreeCls} border-dashed text-gray-light`}
    >
      <span aria-hidden="true">‹</span>
      Retour
    </button>
  );

  return (
    <>
      <button
        type="button"
        onClick={ouvrir}
        aria-haspopup="dialog"
        className={declencheurClassName ?? `${ONGLET_BARRE} w-full text-gray-light`}
      >
        {/* Le geste qu'on encourage occupe le centre de la barre, en couleur
            (patron Vinted) : créer, c'est ce qui rapproche d'une scène. Dans
            le rail, une entrée parmi les autres, marquée du même « + ». */}
        <span
          aria-hidden="true"
          className={
            declencheurClassName
              ? "w-5 text-center font-bold text-magenta"
              : "-mt-4 flex h-9 w-9 items-center justify-center rounded-full border-3 border-navy bg-magenta text-lg font-bold leading-none text-navy"
          }
        >
          +
        </span>
        Créer
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="feuille-creer-titre"
        onClose={() => setOuverte(false)}
        onClick={(e) => {
          if (e.target === dialogRef.current) fermer();
        }}
        className="fixed inset-x-0 bottom-0 top-auto m-0 w-full max-w-none rounded-t-2xl border border-navy-lighter bg-navy p-0 text-white backdrop:bg-black/60 sm:inset-0 sm:bottom-0 sm:m-auto sm:h-fit sm:w-[90vw] sm:max-w-md sm:rounded-2xl"
      >
        {ouverte && (
          <div className="flex flex-col gap-2 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between gap-3">
              <h2
                id="feuille-creer-titre"
                ref={titreRef}
                tabIndex={-1}
                className="text-sm font-bold focus:outline-none"
              >
                {TITRES[etape]}
              </h2>
              <button
                type="button"
                onClick={fermer}
                aria-label="Fermer"
                className="-m-2 flex min-h-11 min-w-11 items-center justify-center rounded text-lg leading-none text-gray-light hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>

            {etape === "atelier" && atelier ? (
              <>
                {atelier.map((e) => (
                  <Link key={e.id} href={hrefCreerAtelier(e.id)} className={entreeCls} onClick={fermer}>
                    <span aria-hidden="true">🚀</span>
                    {e.nom}
                  </Link>
                ))}
                {retour}
              </>
            ) : etape === "talk" ? (
              <>
                {talks.map((t) => (
                  <Link key={t.id} href={hrefDateTalk(t.id)} className={entreeCls} onClick={fermer}>
                    {t.titre}
                  </Link>
                ))}
                {retour}
              </>
            ) : (
              <>
                {geste && (
                  <Link href={geste.href} className={entreeCls} onClick={fermer}>
                    <span aria-hidden="true">{donnees.creation === "talk" ? "🎤" : "👤"}</span>
                    {geste.label}
                  </Link>
                )}
                {talks.length === 1 && (
                  <Link href={hrefDateTalk(talks[0].id)} className={entreeCls} onClick={fermer}>
                    <span aria-hidden="true">📅</span>
                    Ajouter une date à un talk
                  </Link>
                )}
                {talks.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setEtape("talk")}
                    className={`${entreeCls} w-full text-left`}
                  >
                    <span aria-hidden="true">📅</span>
                    Ajouter une date à un talk
                    <span aria-hidden="true" className="ml-auto text-gray-light">
                      ›
                    </span>
                  </button>
                )}
                {/* TOUTE membre écrit (lot N3, Q4 tranchée) : l'entrée est
                    inconditionnelle. */}
                <Link href="/mon-espace/articles/nouveau" className={entreeCls} onClick={fermer}>
                  <span aria-hidden="true">✍️</span>
                  <span>
                    Écrire un article
                    <small className="block text-xs font-normal text-gray-light">
                      une astuce, un retour d&apos;expérience, un conseil
                    </small>
                  </span>
                </Link>
                {donnees.orga && (
                  <Link
                    href="/admin/contenus/publication/nouveau"
                    className={entreeCls}
                    onClick={fermer}
                  >
                    <span aria-hidden="true">📰</span>
                    Ajouter une actualité
                  </Link>
                )}
                {atelier &&
                  (atelier.length === 1 ? (
                    <Link href={hrefCreerAtelier(atelier[0].id)} className={entreeCls} onClick={fermer}>
                      <span aria-hidden="true">🛠️</span>
                      Ajouter un atelier
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEtape("atelier")}
                      className={`${entreeCls} w-full text-left`}
                    >
                      <span aria-hidden="true">🛠️</span>
                      Ajouter un atelier
                      <span aria-hidden="true" className="ml-auto text-gray-light">
                        ›
                      </span>
                    </button>
                  ))}
              </>
            )}
          </div>
        )}
      </dialog>
    </>
  );
}
