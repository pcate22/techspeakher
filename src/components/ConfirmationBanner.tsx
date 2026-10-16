"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Bandeau de confirmation après une redirection PRG (création, mise à jour…).
 * Un message présent dès le HTML initial dans une région `aria-live` n'est PAS
 * annoncé (la région n'annonce que les changements survenus APRÈS son montage).
 * On règle les deux exigences RGAA / COGA §9 :
 * - annonce fiable : la région est montée VIDE, puis remplie après hydratation
 *   (l'insertion différée est bien annoncée) ;
 * - confirmation focalisée : le focus est porté sur le bandeau ;
 * - on nettoie le paramètre d'URL pour qu'un rechargement ne ré-annonce pas un
 *   geste qui n'a pas eu lieu.
 */
export default function ConfirmationBanner({
  message,
  ton = "succes",
}: {
  message: string;
  /** « succes » (cyan, role=status) ou « alerte » (orange, role=alert). */
  ton?: "succes" | "alerte";
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [texte, setTexte] = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      setTexte(message);
      ref.current?.focus();
    }, 60);
    // Retire le paramètre de confirmation de l'URL (rechargement = pas de
    // ré-annonce d'un geste déjà fait), sans recharger ni polluer l'historique.
    const url = new URL(window.location.href);
    // `prop`, `nom` et `talks` sont ceux de l'arbitrage des conférences
    // (2026-08-21) : la liste est FERMÉE, donc un paramètre neuf oublié ici
    // ré-annonce, à chaque rechargement, un geste déjà fait — précisément
    // l'invariant que ce composant existe pour tenir.
    for (const p of [
      "cree",
      "edition-suppr",
      "supprimee",
      "suppr",
      "seed",
      "ok",
      "err",
      "n",
      "prop",
      "nom",
      "talks",
      "corrige",
    ]) {
      url.searchParams.delete(p);
    }
    window.history.replaceState(null, "", url.pathname + url.search);
    return () => clearTimeout(t);
  }, [message]);

  const couleur =
    ton === "alerte"
      ? "text-orange bg-orange/10 border-orange/30"
      : "text-cyan bg-cyan/10 border-cyan/30";

  return (
    <p
      ref={ref}
      role={ton === "alerte" ? "alert" : "status"}
      tabIndex={-1}
      className={`mt-3 text-sm border rounded-lg px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan ${couleur}`}
    >
      {texte}
    </p>
  );
}
