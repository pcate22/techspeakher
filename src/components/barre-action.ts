"use client";

import { useEffect, useState, type RefObject } from "react";

/** Air laissé entre le champ dégagé et le haut de la barre. */
const MARGE = 8;

/**
 * Hauteur du chrome HAUT (en-tête collant + fil d'Ariane), LUE sur le
 * `scroll-padding-top` de `globals.css` : il répond déjà à « quelle place
 * reste-t-il pour lire ? », et le recopier en pixels ici aurait divergé au
 * premier en-tête retouché — le même piège que la hauteur des onglets, qui a
 * son token pour cette raison.
 */
function chromeHaut(): number {
  const valeur = getComputedStyle(document.documentElement).scrollPaddingTop;
  return Number.parseFloat(valeur) || 0;
}

/**
 * WCAG 2.2 — 2.4.11 « focus non masqué », le volet que le CSS ne peut pas
 * tenir. `scroll-padding-bottom` réserve la hauteur des ONGLETS (cf.
 * `globals.css` et `barre-action-collante.test.ts`) : le navigateur amène donc
 * le champ focalisé au-dessus d'eux… c'est-à-dire pile là où flotte la barre
 * d'action, qui n'a pas de hauteur connue du CSS. Et il ne fait défiler que ce
 * qui SORT de la fenêtre : un champ recouvert y est bien, simplement caché.
 *
 * On dégage donc nous-mêmes, et seulement en cas de chevauchement réel.
 *
 * `focusin` (pas `focus`) : l'évènement remonte, un seul écouteur sur le
 * formulaire couvre donc tous ses champs, présents et à venir (les étapes de
 * l'assistant sont montées/démontées au fil du parcours).
 *
 * Défilement INSTANTANÉ, sans animation : un mouvement à chaque tabulation
 * fatiguerait, et `prefers-reduced-motion` n'aurait rien à dire d'un `behavior`
 * forcé à « smooth ».
 */
export function useChampDegage(form: RefObject<HTMLFormElement | null>) {
  useEffect(() => {
    const noeud = form.current;
    if (!noeud) return;

    const degager = (e: FocusEvent) => {
      const cible = e.target;
      if (!(cible instanceof HTMLElement)) return;
      const barre = noeud.querySelector<HTMLElement>(".barre-action-collante");
      // Le CTA vit DANS la barre : le dégager la ferait fuir devant lui.
      if (!barre || barre.contains(cible)) return;

      const champ = cible.getBoundingClientRect();
      const bord = barre.getBoundingClientRect();
      const recouvrement = champ.bottom - bord.top;
      // Rien dessous, ou champ déjà au-dessus : on ne touche pas au défilement.
      if (recouvrement <= 0 || champ.top >= bord.bottom) return;

      window.scrollBy({ top: recouvrement + MARGE, behavior: "instant" });
    };

    noeud.addEventListener("focusin", degager);
    return () => noeud.removeEventListener("focusin", degager);
  }, [form]);
}

/**
 * Faut-il rendre la barre d'action COLLANTE ? Oui seulement si le formulaire
 * dépasse l'écran : c'est le cas qui a motivé la barre (sur quinze cases à
 * cocher, le CTA sortait de l'écran dès la troisième). Sur un formulaire qui
 * tient à l'écran — l'attestation, c'est UNE case — une barre qui flotte ne
 * rapproche rien et recouvre le peu qu'il y a à lire : elle se pose alors en
 * fin de formulaire, comme un bouton ordinaire.
 *
 * La place utile déduit le chrome qui mange l'écran : l'en-tête collant en
 * haut, la barre d'onglets en bas quand elle est rendue.
 *
 * Défaut COLLANTE, et on ne se dédit qu'après avoir MESURÉ (`offsetHeight` nul
 * = pas encore mis en page) : entre deux erreurs, mieux vaut une barre qui
 * flotte pour rien qu'un CTA hors écran.
 *
 * Re-mesuré à chaque changement de taille du FORMULAIRE, pas seulement de la
 * fenêtre : les étapes de l'assistant n'ont pas du tout la même hauteur, et une
 * erreur qui s'affiche rallonge la page.
 */
export function useBarreCollante(form: RefObject<HTMLFormElement | null>): boolean {
  const [collante, setCollante] = useState(true);

  useEffect(() => {
    const noeud = form.current;
    if (!noeud) return;

    const mesurer = () => {
      const hauteur = noeud.offsetHeight;
      if (!hauteur) return;
      const onglets =
        document.querySelector<HTMLElement>("[data-bottom-nav]")?.offsetHeight ?? 0;
      setCollante(hauteur > window.innerHeight - chromeHaut() - onglets);
    };

    mesurer();
    window.addEventListener("resize", mesurer);
    const observateur =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(mesurer);
    observateur?.observe(noeud);
    return () => {
      window.removeEventListener("resize", mesurer);
      observateur?.disconnect();
    };
  }, [form]);

  return collante;
}
