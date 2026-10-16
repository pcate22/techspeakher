"use client";

import { useRef, useState } from "react";
import Button from "@/components/Button";

/**
 * « Partager ma fiche » (conception N1 §2.5, écran B) : LE geste d'une
 * speakeuse vers une orga de conférence. Partage natif quand le navigateur le
 * propose (mobile), sinon copie du lien — et le résultat est DIT (région
 * vive) : un bouton qui copie en silence semble en panne. Aucune donnée
 * envoyée ailleurs : l'URL passe au menu de partage du système, c'est tout.
 */
export default function PartagerFiche({ url, titre }: { url: string; titre: string }) {
  const [message, setMessage] = useState("");
  const minuterie = useRef<ReturnType<typeof setTimeout>>(null);

  const dire = (texte: string) => {
    setMessage(texte);
    if (minuterie.current) clearTimeout(minuterie.current);
    minuterie.current = setTimeout(() => setMessage(""), 4000);
  };

  const partager = async () => {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: titre, url });
      } catch {
        /* partage refermé : le menu système a déjà tout dit */
      }
      return;
    }
    // Le presse-papiers peut manquer ou refuser (contexte non sécurisé,
    // permission) : le geste est TOUJOURS dit — l'adresse publique s'affiche
    // juste en dessous, la copie manuelle reste possible.
    try {
      await navigator.clipboard.writeText(url);
      dire("Lien copié ✓");
    } catch {
      dire("Copie indisponible sur ce navigateur : ton adresse publique est juste en dessous.");
    }
  };

  return (
    <span className="inline-flex items-center gap-3">
      <Button type="button" size="sm" onClick={partager}>
        Partager ma fiche
      </Button>
      <span role="status" aria-live="polite" className="text-sm text-cyan">
        {message}
      </span>
    </span>
  );
}
