"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

/**
 * LE COMPTE RENDU D'UNE ACTION DE LISTE, hors de la rangée qui disparaît.
 *
 * Une rangée qui se supprime ne peut pas raconter sa propre disparition : la
 * réponse d'une Server Action embarque l'arbre RSC revalidé — sans elle — et
 * React l'applique dans le même commit que l'état retourné. La rangée était
 * donc démontée AVANT d'avoir rendu sa confirmation. Mesuré : l'action
 * renvoyait bien `status: "success"`, et zéro région vive bougeait, sur six
 * essais, au clavier comme à la souris. Le seul compte rendu prévu par le §10
 * des principes — celui qui remplace la modale — n'existait pas à l'écran.
 *
 * La région vit donc AU-DESSUS de la liste, dans un composant que le
 * rafraîchissement ne démonte pas. Elle est montée VIDE puis remplie : une
 * région déjà pleine à son montage n'est annoncée par aucun lecteur d'écran.
 * Et elle prend le FOCUS, qui tombait sur `body` — la personne repartait du
 * début du document sans savoir si son geste avait abouti.
 */

interface Annonceur {
  annoncer: (message: string) => void;
}

const Contexte = createContext<Annonceur | null>(null);

/**
 * À poser autour d'une liste dont les rangées portent une action destructive.
 * Sans lui, une rangée rend son compte rendu à sa place — utile pour un usage
 * isolé, mais fragile dès que le serveur revalide.
 */
export function AnnonceListe({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState("");
  const ref = useRef<HTMLParagraphElement>(null);
  // Le focus se pose APRÈS le rendu du texte, sinon on focalise un cadre vide.
  const aFocaliser = useRef(false);

  const annoncer = useCallback((m: string) => {
    aFocaliser.current = true;
    setMessage(m);
  }, []);

  useEffect(() => {
    if (!message || !aFocaliser.current) return;
    aFocaliser.current = false;
    ref.current?.focus();
  }, [message]);

  return (
    <Contexte.Provider value={{ annoncer }}>
      {/* La région existe TOUJOURS, vide au repos : c'est ce qui la rend
          annonçable quand elle se remplit. */}
      <p
        ref={ref}
        role="status"
        tabIndex={message ? -1 : undefined}
        className={
          message
            ? "mb-4 rounded-xl border border-cyan/30 bg-cyan/10 px-4 py-3 text-sm text-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
            : "sr-only"
        }
      >
        {message}
      </p>
      {children}
    </Contexte.Provider>
  );
}

/** L'annonceur de la liste englobante, ou `null` si la rangée vit seule. */
export function useAnnonceListe(): Annonceur | null {
  return useContext(Contexte);
}
