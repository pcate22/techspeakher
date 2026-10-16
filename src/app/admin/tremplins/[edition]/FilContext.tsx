"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useSelectedLayoutSegment } from "next/navigation";
import type { Crumb } from "@/components/Breadcrumb";

/**
 * Contexte du fil d'Ariane d'une édition : le layout d'édition rend UN SEUL fil
 * (EditionSousNav), et les pages profondes (participante, atelier…) y AJOUTENT
 * leurs maillons via `SetFilTail`. On obtient un fil unique et complet
 * — « … › Léa Dubois › Compte » — qui reste collé en haut au scroll, au lieu
 * d'une 2ᵉ ligne qui défilait. Le contexte descend du provider (au-dessus des
 * pastilles) vers EditionSousNav (consommateur) ET vers les layouts enfants
 * (producteurs) : un enfant peut donc alimenter le fil rendu par son ancêtre.
 */
export const FilCtx = createContext<{
  tail: Crumb[];
  setTail: (c: Crumb[]) => void;
} | null>(null);

export function FilProvider({ children }: { children: ReactNode }) {
  const [tail, setTail] = useState<Crumb[]>([]);
  return <FilCtx.Provider value={{ tail, setTail }}>{children}</FilCtx.Provider>;
}

/** Maillons ajoutés par la page profonde courante (vide sur les pages d'édition). */
export function useFilTail(): Crumb[] {
  return useContext(FilCtx)?.tail ?? [];
}

/**
 * Ajoute des maillons FIXES au fil (pages de liste d'une section : Ateliers,
 * Participantes…). Sans les pastilles (lot F « hub franc »), c'est le fil qui
 * situe la section : « … › édition › Ateliers ». Nettoie au démontage.
 */
export function SetFilCrumbs({ crumbs }: { crumbs: Crumb[] }) {
  const ctx = useContext(FilCtx);
  const setTail = ctx?.setTail;
  // `crumbs` est recréé à chaque rendu : on dépend de sa sérialisation, stable.
  const cle = JSON.stringify(crumbs);
  useEffect(() => {
    if (!setTail) return;
    setTail(crumbs);
    return () => setTail([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setTail, cle]);
  return null;
}

/**
 * Alimente le fil depuis un layout d'entité : « Section › Nom [› Sous-page] ».
 * La sous-page vient du segment d'URL sous ce layout ; sur le sommaire de
 * l'entité (pas de segment), le nom est le dernier maillon (page courante).
 * Nettoie au démontage (retour sur une page d'édition → fil de base seul).
 */
export default function SetFilTail({
  sectionLabel,
  sectionHref,
  entiteNom,
  entiteHref,
  sousPages,
}: {
  sectionLabel: string;
  sectionHref: string;
  entiteNom: string;
  entiteHref: string;
  sousPages: Record<string, string>;
}) {
  const ctx = useContext(FilCtx);
  const segment = useSelectedLayoutSegment();
  const sousPage = segment ? (sousPages[segment] ?? null) : null;
  const setTail = ctx?.setTail;

  useEffect(() => {
    if (!setTail) return;
    const tail: Crumb[] = [{ label: sectionLabel, href: sectionHref }];
    // Sur une sous-page, le nom redevient un lien (retour au sommaire) et la
    // sous-page est le maillon courant ; sur le sommaire, le nom est courant.
    tail.push(sousPage ? { label: entiteNom, href: entiteHref } : { label: entiteNom });
    if (sousPage) tail.push({ label: sousPage });
    setTail(tail);
    return () => setTail([]);
  }, [setTail, sectionLabel, sectionHref, entiteNom, entiteHref, sousPage]);

  return null;
}
