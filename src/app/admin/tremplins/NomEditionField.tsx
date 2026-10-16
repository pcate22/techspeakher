"use client";

import { inputCls } from "./[edition]/styles";

/**
 * Champ « Nom de l'édition » avec proposition suiveuse, PARTAGÉ par les modales
 * qui dupliquent (« Dupliquer cette édition », « Créer » en mode « À partir
 * de »). Contrôlé avec drapeau « nom touché » : tant que l'orga n'a pas édité
 * (`value === null`), le champ AFFICHE la proposition et suit ses recalculs
 * (changement de conf ou d'année) ; dès qu'elle tape, sa saisie prime et n'est
 * plus jamais écrasée. Pas de remount par `key` : un remount ré-appliquerait la
 * proposition et jetterait silencieusement un nom personnalisé.
 */
export default function NomEditionField({
  nomPropose,
  value,
  onChange,
}: {
  /** Proposition courante (« Tremplin {conf} {année} »), recalculée par l'appelant. */
  nomPropose: string;
  /** Saisie de l'orga, ou `null` tant qu'elle n'a pas touché le champ. */
  value: string | null;
  onChange: (nom: string) => void;
}) {
  return (
    <label className="text-sm flex flex-col gap-1">
      Nom de l&apos;édition
      <input
        type="text"
        name="nom"
        required
        value={value ?? nomPropose}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ex. Tremplin DevFest Toulouse 2027"
        className={inputCls}
      />
    </label>
  );
}
