"use client";

import { useContext, useEffect } from "react";
import { FilCtx } from "./FilContext";

/**
 * Ajoute UN maillon terminal au fil de l'édition (« … › Informations »). Pour
 * les sous-pages RÉGLAGE de l'édition (infos, statut, retrait) : pas d'entité
 * intermédiaire, juste le nom de la page, sinon le fil s'arrête à l'édition et
 * on ne voit plus où l'on est. Nettoie au démontage.
 */
export default function SetFilLeaf({ label }: { label: string }) {
  const ctx = useContext(FilCtx);
  const setTail = ctx?.setTail;
  useEffect(() => {
    if (!setTail) return;
    setTail([{ label }]);
    return () => setTail([]);
  }, [setTail, label]);
  return null;
}
