/**
 * Le ton magenta prend `magenta-light` pour son TEXTE : le magenta plein sur le
 * fond éclairci par `bg-magenta/10` donne 4,17:1, sous les 4,5 exigés pour du
 * corps de texte — la règle que `contrast.test.ts` énonce déjà (« pour du texte
 * normal, utiliser magenta-light »). La bordure et l'aplat restent en magenta
 * plein, où seuls 3:1 sont requis.
 */
const TONES = {
  cyan: "text-cyan bg-cyan/10 border-cyan/30",
  magenta: "text-magenta-light bg-magenta/10 border-magenta/30",
  orange: "text-orange bg-orange/10 border-orange/30",
  neutral: "text-gray-light bg-white/5 border-white/15",
} as const;

/**
 * Groupe de chips étiqueté (ex. « Secteurs », « Sujets »), réutilisable.
 * `max` limite l'affichage et ajoute un « +N » (utile en vue carte).
 */
export default function ChipGroup({
  label,
  items,
  tone = "cyan",
  max,
}: {
  /** Étiquette du groupe. Absente quand un en-tête voisin la dit déjà —
   * « Tes secteurs » suivi de « Secteurs » est du bruit. */
  label?: string;
  items: string[];
  tone?: keyof typeof TONES;
  max?: number;
}) {
  if (items.length === 0) return null;
  const shown = max ? items.slice(0, max) : items;
  const reste = items.length - shown.length;

  return (
    <div>
      {label && (
        <p className="text-xs uppercase tracking-wide text-gray-light mb-1">{label}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {shown.map((item) => (
          <span
            key={item}
            className={`text-xs rounded-full border px-3 py-1 ${TONES[tone]}`}
          >
            {item}
          </span>
        ))}
        {reste > 0 && (
          <span className="text-xs text-gray-light px-1 py-1">
            +{reste}
          </span>
        )}
      </div>
    </div>
  );
}
