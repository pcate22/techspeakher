"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import TrashIcon from "@/components/icons/TrashIcon";
import { IDLE, type ActionState } from "@/lib/action-state";
import { useAnnonceListe } from "@/components/AnnonceListe";
import {
  axeDuGeste,
  decalageGlissement,
  tiroirOuvertApres,
  type AxeGeste,
} from "@/lib/glissement";

/** Largeur du tiroir : la cible tactile minimale du projet (44 px) plus la
 * marge qui la détache du bord de la rangée. */
const LARGEUR_TIROIR = 56;

/**
 * Combien de temps la confirmation reste seule à l'écran avant que la liste ne
 * se remette à jour. Le rafraîchissement retire la rangée — donc la
 * confirmation si c'est elle qui la porte : on lui laisse le temps d'être lue.
 */
const DELAI_AVANT_RAFRAICHISSEMENT = 2500;

/**
 * Une rangée de liste qui se GLISSE vers la gauche pour découvrir sa poubelle.
 *
 * Le problème : supprimer un atelier demandait cinq écrans (liste → fiche →
 * sommaire → page de retrait → modale), là où le cas courant est un doublon
 * créé deux minutes plus tôt. Le geste met la poubelle à un glissement de la
 * liste, sans rien retirer aux garde-fous.
 *
 * LE GESTE ARME, LA POUBELLE CONFIRME. Une modale de plus au bout d'un
 * glissement rendrait le raccourci inutile ; ce sont donc les DEUX temps du
 * geste qui tiennent le rôle du filet (principes §10) : le clic réflexe sur la
 * rangée navigue, il ne détruit rien. Ce qui complète le filet vit hors de ce
 * composant : la rangée DIT ce que l'objet porte, et `messageSucces` redit ce
 * qui est parti avec lui.
 *
 * DEUX TEMPS DES DEUX CÔTÉS. Ce paragraphe affirmait « la poubelle est hors
 * d'atteinte tant qu'on n'a pas glissé la rangée exprès » : c'était vrai du
 * DOIGT seulement. Le glissement arme, mais ce déplacement n'a AUCUN équivalent
 * dans l'arbre d'accessibilité — au clavier, `Tab` ouvrait le tiroir et `Entrée`
 * effaçait l'atelier, avec ses présences pointées, ses sous-groupes et ses
 * documents (cascade). Le premier temps existe donc aussi au clavier : un appui
 * sur une poubelle DÉSARMÉE l'arme et le dit (« Confirmer la suppression de
 * « X » »), le suivant supprime. Après un glissement elle est déjà armée : le
 * raccourci au doigt garde ses deux temps, pas trois.
 *
 * A11y — la fonction ne dépend jamais du doigt :
 * - la poubelle est un vrai bouton, APRÈS la rangée dans l'ordre du DOM (on
 *   atteint la rangée d'abord, sa poubelle ensuite) ; le focus ouvre le tiroir,
 *   sans quoi le focus serait invisible sous la rangée — mais il n'ARME pas ;
 * - elle NOMME sa rangée (RGAA 11.1 : quinze « Supprimer » côte à côte ne
 *   s'annoncent pas), comme les flèches du programme ;
 * - `Échap` referme, et un geste vertical reste un défilement (`glissement.ts`) ;
 * - l'animation passe par une transition CSS, donc `prefers-reduced-motion`
 *   la neutralise (globals.css) ;
 * - pattern RÉSULTAT et non redirection (§4) : la liste ne remonte pas en haut,
 *   la confirmation est nominative, sur place, PRISE PAR LE FOCUS, et la liste
 *   ne se rafraîchit qu'ensuite (elle démontait la confirmation avant qu'elle
 *   n'apparaisse : l'action réussissait et personne ne voyait jamais rien).
 *
 * Pourquoi un formulaire à la main plutôt qu'`InlineActionForm` (qui porte déjà
 * les micro-actions de liste, cf. les flèches du programme) : ses régions de
 * feedback vivent DANS le formulaire, ici un tiroir de 56 px que le cadre
 * rogne, et son bouton-confirmation « Enregistré ✓ » ne veut rien dire pour une
 * rangée qui vient de disparaître. Le résultat se rend donc à la place de la
 * rangée, hors du tiroir.
 */
export default function RangeeGlissante<S extends object>({
  children,
  titre,
  action,
  hidden,
  messageSucces,
  largeur = LARGEUR_TIROIR,
}: {
  /** La rangée elle-même (un `NavRow` rendu par la page serveur). */
  children: React.ReactNode;
  /** Nom de la chose : il NOMME le geste et la confirmation. */
  titre: string;
  action: (state: ActionState<S>, formData: FormData) => Promise<ActionState<S>>;
  hidden: Record<string, string | number>;
  /** Confirmation nominative affichée sur place au succès : elle NOMME ce qui
   * est parti (c'est le seul compte rendu, il n'y a pas de modale). */
  messageSucces: string;
  largeur?: number;
}) {
  const [state, formAction, pending] = useActionState<ActionState<S>, FormData>(
    action as (state: Awaited<ActionState<S>>, payload: FormData) => Promise<ActionState<S>>,
    IDLE as Awaited<ActionState<S>>,
  );
  const router = useRouter();
  const [decalage, setDecalage] = useState(0);
  /**
   * La poubelle est-elle ARMÉE ? Au doigt, c'est le glissement qui arme — un
   * geste long et délibéré. Au clavier, `Tab` ouvrait le tiroir sans rien
   * armer : le filet en deux temps n'existait donc que pour les doigts, et
   * `Tab` puis `Entrée` effaçait un atelier avec ses présences pointées.
   * Le premier appui arme, le second supprime : deux temps des deux côtés.
   */
  const [armee, setArmee] = useState(false);
  // Pendant le geste, le contenu colle au doigt : pas de transition, sinon il
  // traîne derrière et le glissement paraît mou.
  const [suitLeDoigt, setSuitLeDoigt] = useState(false);
  const geste = useRef<{ x: number; y: number; depart: number; axe: AxeGeste }>({
    x: 0,
    y: 0,
    depart: 0,
    axe: "indetermine",
  });
  // Un glissement se termine par un « click » du navigateur : sans ce drapeau,
  // glisser la rangée ouvrirait sa page — le raccourci deviendrait un piège.
  const aGlisse = useRef(false);
  const tiroirRef = useRef<HTMLDivElement>(null);
  const confirmationRef = useRef<HTMLParagraphElement>(null);
  // La liste englobante porte une région qui SURVIT au rafraîchissement ; à
  // défaut, la rangée rend son compte rendu à sa place (usage isolé).
  const annonceListe = useAnnonceListe();

  // La rangée supprimée n'existe plus côté serveur : on redemande la liste (et
  // ses compteurs) au lieu de la laisser mentir.
  useEffect(() => {
    if (state.status !== "success") return;
    // Le compte rendu passe à la liste quand elle en porte une : elle survit au
    // rafraîchissement, la rangée non. Sinon la rangée le rend elle-même, et
    // prend le focus — qui tombait sur `body`, donc la personne repartait du
    // début du document sans savoir si son geste avait abouti.
    if (annonceListe) annonceListe.annoncer(messageSucces);
    else confirmationRef.current?.focus();
    // La liste ne se remet à jour qu'ENSUITE : le compte rendu a le temps
    // d'exister, d'être lu et de recevoir le focus.
    const t = setTimeout(() => router.refresh(), DELAI_AVANT_RAFRAICHISSEMENT);
    return () => clearTimeout(t);
  }, [state, router, annonceListe, messageSucces]);

  const refermer = () => {
    setDecalage(0);
    setSuitLeDoigt(false);
    setArmee(false);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!e.isPrimary) return;
    aGlisse.current = false;
    geste.current = { x: e.clientX, y: e.clientY, depart: decalage, axe: "indetermine" };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = geste.current;
    if (g.axe === "vertical") return; // la liste défile, on lui laisse la main
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (g.axe === "indetermine") {
      g.axe = axeDuGeste(dx, dy);
      if (g.axe !== "horizontal") return;
      setSuitLeDoigt(true);
      // Le doigt peut sortir de la rangée en route : on garde le pointeur pour
      // ne pas perdre le relâchement (absent de jsdom, d'où l'appel optionnel).
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    }
    setDecalage(decalageGlissement(g.depart, dx, largeur));
  };

  const onPointerUp = () => {
    const g = geste.current;
    if (g.axe !== "horizontal") return;
    g.axe = "indetermine";
    aGlisse.current = true;
    setSuitLeDoigt(false);
    const ouvert = tiroirOuvertApres(decalage, largeur);
    setDecalage(ouvert ? largeur : 0);
    // LE GESTE ARME (principes §10) : c'est lui, et lui seul, qui dispense du
    // premier appui. Un tiroir ouvert par la tabulation reste désarmé.
    setArmee(ouvert);
  };

  // Un clic né d'un glissement, ou posé sur la rangée pendant que le tiroir est
  // ouvert, ne navigue pas : il conclut le geste (le second referme).
  const onClickCapture = (e: React.MouseEvent) => {
    if (tiroirRef.current?.contains(e.target as Node)) return;
    const gestePropre = aGlisse.current;
    aGlisse.current = false;
    if (!gestePropre && decalage === 0) return;
    e.preventDefault();
    e.stopPropagation();
    if (!gestePropre) refermer();
  };

  // Supprimé : la rangée cède la place à sa confirmation, le temps que la liste
  // revienne du serveur sans elle. Nominative (§5) et annoncée (`role=status`).
  if (state.status === "success") {
    if (annonceListe) return null;
    return (
      <li>
        <p
          ref={confirmationRef}
          role="status"
          tabIndex={-1}
          className="rounded-xl border border-cyan/30 bg-cyan/10 px-4 py-3 text-sm text-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
        >
          {messageSucces}
        </p>
      </li>
    );
  }

  const contenuPoubelle = (
    <>
      <TrashIcon />
      {/* Le nom accessible NOMME sa rangée : quinze « Supprimer » côte à côte
          ne s'annoncent pas (RGAA 11.1). ARMÉE, il dit ce que le prochain appui
          fera — c'est le compte rendu du premier temps, et il est annoncé
          puisque le focus est déjà sur le bouton. */}
      <span className="sr-only">
        {armee ? `Confirmer la suppression de « ${titre} »` : `Supprimer : ${titre}`}
      </span>
    </>
  );
  // Cible pleine hauteur, trait orange : le tiroir se lit comme une commande
  // (contour ≥ 3:1, §9), jamais comme un aplat décoratif derrière la rangée.
  // Anneau de focus INTÉRIEUR : le tiroir colle au bord du cadre qui le rogne,
  // un anneau extérieur y serait coupé en deux (focus à moitié visible).
  const clsPoubelle =
    "flex h-full w-full items-center justify-center rounded-xl border border-orange/50 bg-orange/20 text-orange transition-colors hover:bg-orange/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange";

  return (
    <li className="flex flex-col gap-1">
      <div
        className="relative overflow-hidden rounded-xl"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={onClickCapture}
        onKeyDown={(e) => {
          if (e.key === "Escape") refermer();
        }}
      >
        {/* La RANGÉE, au-dessus du tiroir (z-10) : elle le recouvre au repos et
            reçoit les clics. Elle vient AVANT dans le DOM pour que la
            tabulation l'atteigne avant sa poubelle. */}
        <div
          // `select-none` : sans lui, glisser à la souris surligne le titre au
          // lieu de bouger la rangée.
          className={`relative z-10 select-none ${suitLeDoigt ? "" : "transition-transform duration-200"}`}
          style={{ transform: `translateX(${-decalage}px)`, touchAction: "pan-y" }}
          // Glisser un lien à la souris déclencherait le glisser-déposer natif
          // (image fantôme, geste perdu).
          onDragStart={(e) => e.preventDefault()}
        >
          {children}
        </div>
        <div
          ref={tiroirRef}
          className="absolute inset-y-0 right-0 z-0 flex"
          style={{ width: largeur }}
          // Le focus clavier OUVRE le tiroir : un bouton focalisé sous la
          // rangée serait un focus invisible (WCAG 2.4.11).
          onFocus={() => setDecalage(largeur)}
          onBlur={(e) => {
            if (!tiroirRef.current?.contains(e.relatedTarget as Node)) refermer();
          }}
        >
          <form action={formAction} className="h-full w-full">
            {Object.entries(hidden).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            {/* `aria-disabled` et non `disabled` : un bouton désactivé sort du
                parcours clavier, donc disparaît au lecteur d'écran. */}
            <button
              type="submit"
              aria-disabled={pending}
              onClick={(e) => {
                if (pending) return e.preventDefault();
                // PREMIER TEMPS. Le tiroir ouvert par la tabulation n'arme
                // rien : ce clic-ci arme, le suivant supprime. Après un
                // glissement, `armee` est déjà vrai et l'appui supprime — le
                // raccourci au doigt garde ses deux temps, pas trois.
                if (!armee) {
                  e.preventDefault();
                  setArmee(true);
                }
              }}
              className={`${clsPoubelle} ${pending ? "opacity-60" : ""} ${
                armee ? "bg-orange/40 ring-2 ring-inset ring-orange" : ""
              }`}
            >
              {contenuPoubelle}
            </button>
          </form>
        </div>
      </div>
      {state.status === "error" && (
        <p
          role="alert"
          className="rounded-lg border border-orange/30 bg-orange/10 px-4 py-2 text-sm text-orange"
        >
          {state.error}
        </p>
      )}
    </li>
  );
}
