"use client";

import { useRef, useState } from "react";
import Button from "@/components/Button";

/**
 * Le HTML d'une version, à coller dans l'éditeur de campagne Brevo.
 *
 * Un bouton « Copier » ET la zone de texte : le presse-papiers demande une
 * permission que le navigateur peut refuser, et rester bloquée devant un HTML
 * qu'on voit sans pouvoir le prendre serait absurde. La zone est en lecture
 * seule — ce qui part se change dans le code, jamais ici.
 */
export default function CopierHtml({ html, titre }: { html: string; titre: string }) {
  const zoneRef = useRef<HTMLTextAreaElement>(null);
  const [copie, setCopie] = useState(false);

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(html);
    } catch {
      // Presse-papiers refusé : on sélectionne, il reste Ctrl+C.
      zoneRef.current?.select();
    }
    setCopie(true);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" size="sm" onClick={copier}>
          Copier le HTML
        </Button>
        {/* Région vivante : la confirmation s'entend, elle ne se devine pas. */}
        <p role="status" className="text-xs text-cyan empty:hidden">
          {copie ? `HTML de la version « ${titre} » copié.` : ""}
        </p>
      </div>
      <textarea
        ref={zoneRef}
        readOnly
        value={html}
        aria-label={`HTML de la version « ${titre} »`}
        rows={6}
        className="w-full rounded-lg border border-navy-lighter bg-navy p-3 font-mono text-xs text-gray-light"
      />
    </div>
  );
}
