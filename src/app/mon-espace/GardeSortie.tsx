"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import Button from "@/components/Button";

/**
 * « Tu as commencé à saisir, tu cliques ailleurs » — la garde qui demande avant
 * de laisser partir. Partagée par l'assistant de création et par les pages de
 * section (lot I) : recopiée, elle aurait divergé, et une des deux aurait fini
 * par laisser filer une saisie en silence.
 *
 * Elle intercepte au niveau du DOCUMENT, en capture. C'est le seul niveau qui
 * couvre TOUT ce qui fait sortir de la page — le fil d'Ariane, la barre
 * d'onglets basse, le menu du compte — et pas seulement les liens qu'on aurait
 * pensé à câbler. Ce qui laisse passer sans rien demander : un nouvel onglet
 * (rien n'est perdu), une ancre, un lien externe.
 */
export function useGardeSortie(modifie: boolean) {
  const [sortieVoulue, setSortieVoulue] = useState<string | null>(null);
  // LE LIEN INTERCEPTÉ tient lieu de déclencheur. Radix rend le focus à son
  // `Dialog.Trigger` ; ici il n'y en a pas — le déclencheur, c'est n'importe
  // quel lien de la page, saisi au vol par l'écouteur en capture. Sans cette
  // référence, Radix annule la restitution native (`preventDefault` sur
  // `onCloseAutoFocus`) puis ne trouve personne à focaliser : après « Rester sur
  // le formulaire », le focus retombe sur `body` et la tabulation repart du haut
  // du document (WCAG 2.4.3).
  const declencheur = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!modifie) return;
    const garde = (e: MouseEvent) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      )
        return; // nouvel onglet : rien n'est perdu
      const cible = e.target as HTMLElement;
      const lien = cible.closest?.("a[href]");
      if (!lien) return;
      const href = lien.getAttribute("href") ?? "";
      if (!href || href.startsWith("#") || lien.getAttribute("target") === "_blank") return;
      if (/^[a-z]+:/i.test(href) && !href.startsWith(window.location.origin)) return;
      e.preventDefault();
      e.stopPropagation();
      declencheur.current = lien as HTMLElement;
      setSortieVoulue(href);
    };
    document.addEventListener("click", garde, true);
    return () => document.removeEventListener("click", garde, true);
  }, [modifie]);

  /**
   * Rend le focus au lien qu'on a intercepté. Appelé à la FERMETURE, jamais au
   * départ : quand on quitte pour de bon, la page suivante prend la main.
   */
  const rendreLeFocus = useCallback(() => {
    const lien = declencheur.current;
    declencheur.current = null;
    // Le lien peut avoir disparu entre-temps (re-rendu, liste raccourcie) :
    // `isConnected` évite de focaliser un nœud détaché, ce qui ne ferait rien.
    if (lien?.isConnected) lien.focus();
  }, []);

  return { sortieVoulue, setSortieVoulue, rendreLeFocus };
}

/** La confirmation elle-même : le libellé annonce la conséquence. */
export function DialogueSortie({
  sortieVoulue,
  setSortieVoulue,
  onQuitter,
  rendreLeFocus,
}: {
  sortieVoulue: string | null;
  setSortieVoulue: (v: string | null) => void;
  /** Appelé avant la navigation : c'est le moment de lever le drapeau « modifié ». */
  onQuitter: () => void;
  /** Rend le focus au lien intercepté (cf. `useGardeSortie`). */
  rendreLeFocus: () => void;
}) {
  const router = useRouter();
  // On reste sur la page : le focus revient d'où il est parti. On quitte : la
  // page suivante prend la main, et ce drapeau évite de lui voler le focus.
  const onQuitte = useRef(false);
  return (
    <AlertDialog.Root
      open={sortieVoulue !== null}
      onOpenChange={(o) => {
        if (!o) setSortieVoulue(null);
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/60 z-50" />
        <AlertDialog.Content
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            if (!onQuitte.current) rendreLeFocus();
            onQuitte.current = false;
          }}
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-md bg-navy-light border border-field-border rounded-xl p-6 z-50 shadow-sticky"
        >
          <AlertDialog.Title className="text-lg font-bold text-white">
            Quitter sans enregistrer&nbsp;?
          </AlertDialog.Title>
          <AlertDialog.Description className="text-sm text-gray-light mt-2">
            Tes réponses attendent encore un enregistrement&nbsp;: si tu quittes
            maintenant, elles seront perdues.
          </AlertDialog.Description>
          <div className="flex flex-wrap justify-end gap-3 mt-6">
            <AlertDialog.Cancel asChild>
              <Button type="button" variant="secondary" size="sm">
                Rester sur le formulaire
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => {
                  const href = sortieVoulue;
                  onQuitte.current = true;
                  onQuitter();
                  setSortieVoulue(null);
                  if (href) router.push(href);
                }}
              >
                Quitter sans enregistrer
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
