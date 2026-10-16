"use client";

import { useId, useState, type ComponentProps, type ReactNode } from "react";
import SettingToggle from "@/components/SettingToggle";

/**
 * Interrupteur (niveau 1) + contrôle dépendant (niveau 2) qui n'apparaît que
 * lorsqu'il est activé. La visibilité de l'enfant suit l'état OPTIMISTE de
 * l'interrupteur : elle bascule au clic, sans attendre l'aller-retour serveur
 * (fini la case fille qui reste affichée quelques secondes après extinction).
 * Le serveur reste la source de vérité (rafraîchissement au succès) ; l'affichage
 * optimiste n'est qu'un devancement, resynchronisé sur les props.
 */
export default function ToggleWithDependent({
  toggle,
  dependent,
}: {
  toggle: ComponentProps<typeof SettingToggle>;
  dependent: ReactNode;
}) {
  const [actif, setActif] = useState(toggle.checked);
  const dependentId = useId();
  // Resynchronisation sur la vérité serveur SANS effet (motif « état dérivé »
  // recommandé par React) : quand la prop change (rafraîchissement post-succès),
  // on réaligne l'optimiste pendant le rendu.
  const [checkedVu, setCheckedVu] = useState(toggle.checked);
  if (toggle.checked !== checkedVu) {
    setCheckedVu(toggle.checked);
    setActif(toggle.checked);
  }

  return (
    <>
      <SettingToggle {...toggle} onOptimistic={setActif} controlsId={dependentId} />
      {actif && (
        <div id={dependentId} className="pl-6">
          {dependent}
        </div>
      )}
    </>
  );
}
